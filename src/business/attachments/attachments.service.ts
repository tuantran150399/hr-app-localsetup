import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { Attachment } from '../../models/attachment.entity';
import { AttachmentFilterDto } from './dto/attachment.dto';
import { paginate, getSkip } from '../../common/utils/pagination.util';

/**
 * Upload directory is taken from env UPLOAD_DIR (default: ./uploads).
 * Files are organised in sub-folders: <UPLOAD_DIR>/<moduleName>/<entityId>/
 * Original file names are replaced with UUID-based names to prevent path traversal.
 * File paths stored in DB are RELATIVE to UPLOAD_DIR.
 */
@Injectable()
export class AttachmentsService {
  private uploadDir: string;

  constructor(@InjectRepository(Attachment) private repo: Repository<Attachment>) {
    // Resolve upload directory — default relative to project root
    this.uploadDir = path.resolve(process.env.UPLOAD_DIR ?? './uploads');
    if (!fs.existsSync(this.uploadDir)) {
      fs.mkdirSync(this.uploadDir, { recursive: true });
    }
  }

  /**
   * Save a file buffer to local disk and record metadata in DB.
   * Called from the controller after Multer processes the multipart upload.
   */
  async save(
    moduleName: string,
    entityId: number,
    originalName: string,
    buffer: Buffer,
    mimeType: string,
    actorId: number,
  ): Promise<Attachment> {
    // Sanitise original name — keep extension only
    const ext = path.extname(originalName).toLowerCase().replace(/[^a-z0-9.]/g, '');
    const uuid = crypto.randomUUID();
    const fileName = `${uuid}${ext}`;

    // Ensure sub-folder exists
    const subDir = path.join(this.uploadDir, moduleName, String(entityId));
    if (!fs.existsSync(subDir)) fs.mkdirSync(subDir, { recursive: true });

    const absolutePath = path.join(subDir, fileName);
    fs.writeFileSync(absolutePath, buffer);

    // Store relative path to keep DB portable
    const relativePath = path.join(moduleName, String(entityId), fileName);

    const attachment = this.repo.create({
      moduleName,
      entityId,
      originalName,
      fileName,
      filePath: relativePath,
      mimeType,
      fileSize: buffer.length,
      uploadedBy: actorId,
      createdBy: actorId,
      updatedBy: actorId,
    });
    return this.repo.save(attachment);
  }

  async findAll(filter: AttachmentFilterDto) {
    const { page = 1, limit = 20, moduleName, entityId } = filter;
    const qb = this.repo.createQueryBuilder('a');
    if (moduleName) qb.andWhere('a.moduleName = :moduleName', { moduleName });
    if (entityId) qb.andWhere('a.entityId = :entityId', { entityId });
    qb.orderBy('a.createdAt', 'DESC').skip(getSkip(page, limit)).take(limit);
    return paginate(await qb.getManyAndCount(), page, limit);
  }

  async findOne(id: number): Promise<Attachment> {
    const att = await this.repo.findOne({ where: { id } });
    if (!att) throw new NotFoundException('Attachment not found');
    return att;
  }

  /**
   * Returns the absolute disk path and attachment metadata for streaming.
   * The controller must verify the caller has access to the parent entity
   * before calling this method.
   */
  async getFilePath(id: number): Promise<{ attachment: Attachment; absolutePath: string }> {
    const attachment = await this.findOne(id);
    const absolutePath = path.join(this.uploadDir, attachment.filePath);
    if (!fs.existsSync(absolutePath)) {
      throw new NotFoundException('File not found on disk');
    }
    return { attachment, absolutePath };
  }

  async delete(id: number): Promise<{ message: string }> {
    const att = await this.findOne(id);
    const absolutePath = path.join(this.uploadDir, att.filePath);
    if (fs.existsSync(absolutePath)) {
      fs.unlinkSync(absolutePath);
    }
    await this.repo.remove(att);
    return { message: 'Attachment deleted' };
  }
}

import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { Attachment } from '../../models/attachment.entity';
import { Job } from '../../models/job.entity';
import { RevenueEntry } from '../../models/revenue-entry.entity';
import { CostEntry } from '../../models/cost-entry.entity';
import { Partner } from '../../models/partner.entity';
import { AttachmentFilterDto } from './dto/attachment.dto';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { paginate, getSkip } from '../../common/utils/pagination.util';

@Injectable()
export class AttachmentsService {
  private uploadDir: string;

  constructor(
    @InjectRepository(Attachment) private repo: Repository<Attachment>,
    @InjectRepository(Job) private jobRepo: Repository<Job>,
    @InjectRepository(RevenueEntry) private revenueRepo: Repository<RevenueEntry>,
    @InjectRepository(CostEntry) private costRepo: Repository<CostEntry>,
    @InjectRepository(Partner) private partnerRepo: Repository<Partner>,
    private auditLogs: AuditLogsService,
  ) {
    this.uploadDir = path.resolve(process.env.UPLOAD_DIR ?? './uploads');
    if (!fs.existsSync(this.uploadDir)) {
      fs.mkdirSync(this.uploadDir, { recursive: true });
    }
  }

  async save(
    moduleName: string,
    entityId: number,
    originalName: string,
    buffer: Buffer,
    mimeType: string,
    actorId: number,
  ): Promise<Attachment> {
    const normalizedModule = this.normalizeModuleName(moduleName);
    await this.assertParentExists(normalizedModule, entityId);

    const ext = path.extname(originalName).toLowerCase().replace(/[^a-z0-9.]/g, '');
    const uuid = crypto.randomUUID();
    const fileName = `${uuid}${ext}`;

    const subDir = path.join(this.uploadDir, normalizedModule, String(entityId));
    if (!fs.existsSync(subDir)) fs.mkdirSync(subDir, { recursive: true });

    const absolutePath = path.join(subDir, fileName);
    fs.writeFileSync(absolutePath, buffer);

    const relativePath = path.join(normalizedModule, String(entityId), fileName);

    const attachment = await this.repo.save(this.repo.create({
      moduleName: normalizedModule,
      entityId,
      originalName,
      fileName,
      filePath: relativePath,
      mimeType,
      fileSize: buffer.length,
      uploadedBy: actorId,
      createdBy: actorId,
      updatedBy: actorId,
    }));
    await this.auditLogs.log({
      entityName: 'Attachment',
      entityId: attachment.id,
      action: 'UPLOAD',
      userId: actorId,
      newValues: { moduleName: normalizedModule, entityId, originalName, fileSize: buffer.length },
    });
    return attachment;
  }

  async findAll(filter: AttachmentFilterDto) {
    const { page = 1, limit = 20, moduleName, entityId } = filter;
    const qb = this.repo.createQueryBuilder('a');
    if (moduleName) qb.andWhere('a.moduleName = :moduleName', { moduleName: this.normalizeModuleName(moduleName) });
    if (entityId) qb.andWhere('a.entityId = :entityId', { entityId });
    qb.orderBy('a.createdAt', 'DESC').skip(getSkip(page, limit)).take(limit);
    return paginate(await qb.getManyAndCount(), page, limit);
  }

  async findOne(id: number): Promise<Attachment> {
    const att = await this.repo.findOne({ where: { id } });
    if (!att) throw new NotFoundException('Attachment not found');
    return att;
  }

  async getFilePath(id: number): Promise<{ attachment: Attachment; absolutePath: string }> {
    const attachment = await this.findOne(id);
    await this.assertParentExists(attachment.moduleName, attachment.entityId);
    const absolutePath = path.join(this.uploadDir, attachment.filePath);
    if (!fs.existsSync(absolutePath)) {
      throw new NotFoundException('File not found on disk');
    }
    return { attachment, absolutePath };
  }

  async delete(id: number, actorId: number): Promise<{ message: string }> {
    const att = await this.findOne(id);
    const absolutePath = path.join(this.uploadDir, att.filePath);
    if (fs.existsSync(absolutePath)) {
      fs.unlinkSync(absolutePath);
    }
    await this.repo.remove(att);
    await this.auditLogs.log({
      entityName: 'Attachment',
      entityId: id,
      action: 'DELETE',
      userId: actorId,
      oldValues: { moduleName: att.moduleName, entityId: att.entityId, originalName: att.originalName },
    });
    return { message: 'Attachment deleted' };
  }

  private normalizeModuleName(moduleName: string): string {
    const value = String(moduleName).trim();
    const aliases: Record<string, string> = {
      job: 'Job',
      jobs: 'Job',
      revenue: 'RevenueEntry',
      revenueentry: 'RevenueEntry',
      revenueentries: 'RevenueEntry',
      cost: 'CostEntry',
      costentry: 'CostEntry',
      costentries: 'CostEntry',
      partner: 'Partner',
      partners: 'Partner',
    };
    const normalized = aliases[value.toLowerCase()] ?? value;
    if (!['Job', 'RevenueEntry', 'CostEntry', 'Partner'].includes(normalized)) {
      throw new BadRequestException('Unsupported attachment moduleName');
    }
    return normalized;
  }

  private async assertParentExists(moduleName: string, entityId: number) {
    if (moduleName === 'Job') {
      const job = await this.jobRepo.findOne({ where: { id: entityId } });
      if (!job || job.archivedAt) throw new NotFoundException('Attachment parent job not found');
      return;
    }
    if (moduleName === 'RevenueEntry') {
      const entry = await this.revenueRepo.findOne({ where: { id: entityId } });
      if (!entry) throw new NotFoundException('Attachment parent revenue entry not found');
      return;
    }
    if (moduleName === 'CostEntry') {
      const entry = await this.costRepo.findOne({ where: { id: entityId } });
      if (!entry) throw new NotFoundException('Attachment parent cost entry not found');
      return;
    }
    if (moduleName === 'Partner') {
      const partner = await this.partnerRepo.findOne({ where: { id: entityId } });
      if (!partner) throw new NotFoundException('Attachment parent partner not found');
    }
  }
}

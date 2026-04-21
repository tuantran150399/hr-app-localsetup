import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  ParseIntPipe,
  UseGuards,
  Query,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  Res,
  Body,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import * as path from 'path';
import { AttachmentsService } from './attachments.service';
import { AttachmentFilterDto } from './dto/attachment.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../auth/guards/permission.guard';
import { RequirePermission } from '../auth/decorators/require-permission.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20 MB

@UseGuards(JwtAuthGuard, PermissionGuard)
@Controller('attachments')
export class AttachmentsController {
  constructor(private svc: AttachmentsService) {}

  /**
   * Upload a file for a specific module + entity.
   * POST /attachments/upload
   * Body (multipart): file, moduleName, entityId
   *
   * File size is validated here — Multer memStorage keeps file in RAM temporarily.
   * For production on Plesk, 20 MB RAM per upload is acceptable for logistics docs.
   */
  @RequirePermission('job:edit')
  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  async upload(
    @UploadedFile() file: Express.Multer.File,
    @Body('moduleName') moduleName: string,
    @Body('entityId') entityId: string,
    @CurrentUser() user: { id: number },
  ) {
    if (!file) throw new BadRequestException('No file uploaded');
    if (!moduleName) throw new BadRequestException('moduleName is required');
    if (!entityId || isNaN(Number(entityId))) throw new BadRequestException('entityId must be a number');
    if (file.size > MAX_FILE_SIZE) throw new BadRequestException('File exceeds 20 MB limit');

    return this.svc.save(
      moduleName,
      Number(entityId),
      file.originalname,
      file.buffer,
      file.mimetype,
      user.id,
    );
  }

  /** List attachments with optional module/entity filter + pagination */
  @Get()
  findAll(@Query() filter: AttachmentFilterDto) {
    return this.svc.findAll(filter);
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.svc.findOne(id);
  }

  /**
   * Secure file download — file path is NEVER exposed to the client.
   * The endpoint streams the file from disk after JWT validation.
   * GET /attachments/:id/download
   */
  @Get(':id/download')
  async download(
    @Param('id', ParseIntPipe) id: number,
    @Res() res: Response,
  ) {
    const { attachment, absolutePath } = await this.svc.getFilePath(id);
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(attachment.originalName)}"`);
    if (attachment.mimeType) res.setHeader('Content-Type', attachment.mimeType);
    res.sendFile(absolutePath);
  }

  @RequirePermission('job:edit')
  @Delete(':id')
  delete(@Param('id', ParseIntPipe) id: number) {
    return this.svc.delete(id);
  }
}

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
import { AttachmentsService } from './attachments.service';
import { AttachmentFilterDto } from './dto/attachment.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../auth/guards/permission.guard';
import { RequirePermission } from '../auth/decorators/require-permission.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

const MAX_FILE_SIZE = 20 * 1024 * 1024;

@UseGuards(JwtAuthGuard, PermissionGuard)
@Controller('attachments')
export class AttachmentsController {
  constructor(private svc: AttachmentsService) {}

  @RequirePermission('attachment:upload')
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

  @Get()
  findAll(@Query() filter: AttachmentFilterDto) {
    return this.svc.findAll(filter);
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.svc.findOne(id);
  }

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

  @RequirePermission('attachment:delete')
  @Delete(':id')
  delete(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: { id: number }) {
    return this.svc.delete(id, user.id);
  }
}

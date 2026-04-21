import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MulterModule } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { AttachmentsController } from './attachments.controller';
import { AttachmentsService } from './attachments.service';
import { Attachment } from '../../models/attachment.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Attachment]),
    /** Use in-memory storage so the service controls where files land on disk */
    MulterModule.register({ storage: memoryStorage() }),
  ],
  controllers: [AttachmentsController],
  providers: [AttachmentsService],
  exports: [AttachmentsService],
})
export class AttachmentsModule {}

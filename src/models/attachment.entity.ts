import { Entity, Column } from 'typeorm';
import { BaseEntity } from './base.entity';

/**
 * Stores file metadata only. Actual files are saved on local disk under
 * the UPLOAD_DIR environment variable (default: ./uploads).
 * File paths are NEVER exposed publicly — access always goes through the
 * secure /attachments/:id/download endpoint which validates JWT + permissions.
 */
@Entity('attachments')
export class Attachment extends BaseEntity {
  /** Module that owns this attachment, e.g. 'Job', 'RevenueEntry' */
  @Column({ name: 'module_name', length: 50 })
  moduleName: string;

  /** ID of the related entity record */
  @Column({ name: 'entity_id' })
  entityId: number;

  /** Original file name as uploaded by user */
  @Column({ name: 'original_name', length: 500 })
  originalName: string;

  /** Stored file name on disk (UUID-based to avoid collisions) */
  @Column({ name: 'file_name', length: 500 })
  fileName: string;

  /** Relative path inside UPLOAD_DIR */
  @Column({ name: 'file_path', length: 1000 })
  filePath: string;

  @Column({ name: 'mime_type', length: 200, nullable: true })
  mimeType: string;

  /** File size in bytes */
  @Column({ name: 'file_size', type: 'bigint', nullable: true })
  fileSize: number;

  @Column({ name: 'uploaded_by', nullable: true })
  uploadedBy: number;
}

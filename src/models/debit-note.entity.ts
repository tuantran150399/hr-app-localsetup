import { Entity, Column, OneToMany } from 'typeorm';
import { BaseEntity } from './base.entity';

export enum DebitNoteStatus {
  DRAFT = 'DRAFT',
  POSTED = 'POSTED',
  SENT = 'SENT',
  VOIDED = 'VOIDED',
}

@Entity('debit_notes')
export class DebitNote extends BaseEntity {
  @Column({ name: 'partner_id' })
  partnerId: number;

  @Column({ name: 'job_id', nullable: true })
  jobId: number;

  @Column({ length: 10, default: 'VND' })
  currency: string;

  @Column({ type: 'decimal', precision: 18, scale: 4, default: 0 })
  amount: number;

  @Column({ name: 'doc_date', type: 'date', nullable: true })
  docDate: Date;

  @Column({ name: 'due_date', type: 'date', nullable: true })
  dueDate: Date;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({
    type: 'enum',
    enum: DebitNoteStatus,
    default: DebitNoteStatus.DRAFT,
  })
  status: DebitNoteStatus;

  // ─── Post / Send / Void tracking ───────────────────────────────────────
  @Column({ name: 'posted_at', type: 'datetime', nullable: true })
  postedAt: Date;

  @Column({ name: 'posted_by', nullable: true })
  postedBy: number;

  @Column({ name: 'sent_at', type: 'datetime', nullable: true })
  sentAt: Date;

  @Column({ name: 'sent_by', nullable: true })
  sentBy: number;

  @Column({ name: 'voided_at', type: 'datetime', nullable: true })
  voidedAt: Date;

  @Column({ name: 'voided_by', nullable: true })
  voidedBy: number;

  @Column({ name: 'void_reason', type: 'text', nullable: true })
  voidReason: string;
}

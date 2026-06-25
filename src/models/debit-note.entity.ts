import { Entity, Column, OneToMany } from 'typeorm';
import { BaseEntity } from './base.entity';
import { PaymentMethod, PaymentStatus } from './revenue-entry.entity';

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

  @Column({ name: 'job_id' })
  jobId: number;

  @Column({ length: 10, default: 'VND' })
  currency: string;

  @Column({ type: 'decimal', precision: 18, scale: 4, default: 0 })
  amount: number;

  @Column({ name: 'doc_date', type: 'date', nullable: true })
  docDate: Date;

  @Column({ name: 'due_date', type: 'date', nullable: true })
  dueDate: Date;

  @Column({ name: 'reference_no', length: 100, nullable: true })
  referenceNo: string;

  @Column({ name: 'group_code', length: 100, nullable: true })
  groupCode: string;

  @Column({ name: 'payment_term', length: 100, nullable: true })
  paymentTerm: string;

  @Column({ name: 'moving_type', length: 100, nullable: true })
  movingType: string;

  @Column({ length: 100, nullable: true })
  direction: string;

  @Column({ name: 'mbl_no', length: 100, nullable: true })
  mblNo: string;

  @Column({ name: 'export_note', type: 'text', nullable: true })
  exportNote: string;

  @Column({ name: 'bank_name', length: 150, nullable: true })
  bankName: string;

  @Column({ name: 'bank_account_no', length: 100, nullable: true })
  bankAccountNo: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({
    name: 'payment_method',
    type: 'enum',
    enum: PaymentMethod,
    nullable: true,
  })
  paymentMethod: PaymentMethod;

  @Column({ name: 'payment_account_ref', length: 100, nullable: true })
  paymentAccountRef: string;

  @Column({
    name: 'payment_status',
    type: 'enum',
    enum: PaymentStatus,
    default: PaymentStatus.UNPAID,
  })
  paymentStatus: PaymentStatus;

  @Column({ name: 'paid_amount', type: 'decimal', precision: 18, scale: 4, default: 0 })
  paidAmount: number;

  @Column({ name: 'paid_at', type: 'datetime', nullable: true })
  paidAt: Date;

  @Column({ name: 'paid_by', nullable: true })
  paidBy: number;

  @Column({ name: 'receivable_entry_id', nullable: true })
  receivableEntryId: number;

  @Column({ name: 'locked_at', type: 'datetime', nullable: true })
  lockedAt: Date;

  @Column({ name: 'locked_by', nullable: true })
  lockedBy: number;

  @Column({ name: 'lock_reason', type: 'text', nullable: true })
  lockReason: string;

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

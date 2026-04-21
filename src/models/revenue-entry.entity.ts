import { Entity, Column } from 'typeorm';
import { BaseEntity } from './base.entity';

export enum AccountingStatus {
  DRAFT = 'DRAFT',
  POSTED = 'POSTED',
  VOIDED = 'VOIDED',
}

export enum PaymentStatus {
  UNPAID = 'UNPAID',
  PARTIAL = 'PARTIAL',
  PAID = 'PAID',
}

@Entity('revenue_entries')
export class RevenueEntry extends BaseEntity {
  @Column({ name: 'job_id' })
  jobId: number;

  @Column({ length: 200 })
  description: string;

  @Column({ length: 10, default: 'VND' })
  currency: string;

  @Column({ type: 'decimal', precision: 18, scale: 4 })
  amount: number;

  @Column({ name: 'exchange_rate', type: 'decimal', precision: 18, scale: 6, default: 1 })
  exchangeRate: number;

  @Column({ name: 'local_amount', type: 'decimal', precision: 18, scale: 4 })
  localAmount: number;

  @Column({
    type: 'enum',
    enum: AccountingStatus,
    default: AccountingStatus.DRAFT,
  })
  status: AccountingStatus;

  // ─── Payment tracking ───────────────────────────────────────────────────
  @Column({
    name: 'payment_status',
    type: 'enum',
    enum: PaymentStatus,
    default: PaymentStatus.UNPAID,
  })
  paymentStatus: PaymentStatus;

  @Column({ name: 'ref_number', length: 100, nullable: true })
  refNumber: string;

  @Column({ name: 'invoice_number', length: 100, nullable: true })
  invoiceNumber: string;

  @Column({ name: 'doc_date', type: 'date', nullable: true })
  docDate: Date;

  @Column({ name: 'due_date', type: 'date', nullable: true })
  dueDate: Date;

  // ─── Posting info ───────────────────────────────────────────────────────
  @Column({ name: 'posted_at', type: 'datetime', nullable: true })
  postedAt: Date;

  @Column({ name: 'posted_by', nullable: true })
  postedBy: number;

  // ─── Void / Reversal ────────────────────────────────────────────────────
  /**
   * If this entry reverses another, store original entry id here.
   * The original entry status is set to VOIDED.
   */
  @Column({ name: 'reversal_of', nullable: true })
  reversalOf: number;

  @Column({ name: 'voided_at', type: 'datetime', nullable: true })
  voidedAt: Date;

  @Column({ name: 'voided_by', nullable: true })
  voidedBy: number;

  @Column({ type: 'text', nullable: true })
  notes: string;
}
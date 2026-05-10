import { Entity, Column } from 'typeorm';
import { BaseEntity } from './base.entity';

export enum AdjustmentType {
  REVENUE_ADJUSTMENT = 'REVENUE_ADJUSTMENT',
  COST_ADJUSTMENT = 'COST_ADJUSTMENT',
  RECONCILIATION = 'RECONCILIATION',
  WRITE_OFF = 'WRITE_OFF',
}

@Entity('adjustment_entries')
export class AdjustmentEntry extends BaseEntity {
  @Column({ name: 'job_id', nullable: true })
  jobId: number;

  @Column({ type: 'enum', enum: AdjustmentType })
  type: AdjustmentType;

  /** The original entry being adjusted (revenue or cost) */
  @Column({ name: 'original_entry_id', nullable: true })
  originalEntryId: number;

  /** 'REVENUE' or 'COST' — indicates which ledger the original entry belongs to */
  @Column({ name: 'original_entry_type', length: 20, nullable: true })
  originalEntryType: string;

  @Column({ length: 300 })
  description: string;

  @Column({ length: 10, default: 'VND' })
  currency: string;

  /** Positive = increase, negative = decrease */
  @Column({ type: 'decimal', precision: 18, scale: 4 })
  amount: number;

  @Column({ name: 'exchange_rate', type: 'decimal', precision: 18, scale: 6, default: 1 })
  exchangeRate: number;

  @Column({ name: 'local_amount', type: 'decimal', precision: 18, scale: 4 })
  localAmount: number;

  @Column({ name: 'doc_date', type: 'date', nullable: true })
  docDate: Date;

  @Column({ name: 'approved_at', type: 'datetime', nullable: true })
  approvedAt: Date;

  @Column({ name: 'approved_by', nullable: true })
  approvedBy: number;

  @Column({ type: 'text', nullable: true })
  notes: string;
}

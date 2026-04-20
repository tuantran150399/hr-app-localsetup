import { Entity, Column } from 'typeorm';
import { BaseEntity } from './base.entity';

export enum AccountingStatus {
  DRAFT = 'DRAFT',
  POSTED = 'POSTED',
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

  @Column({ name: 'posted_at', type: 'datetime', nullable: true })
  postedAt: Date;

  @Column({ name: 'posted_by', nullable: true })
  postedBy: number;

  @Column({ type: 'text', nullable: true })
  notes: string;
}
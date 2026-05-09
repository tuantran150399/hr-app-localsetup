import { Entity, Column } from 'typeorm';
import { BaseEntity } from './base.entity';

export enum CashTransactionType {
  RECEIPT = 'RECEIPT',
  PAYMENT = 'PAYMENT',
  ADJUSTMENT = 'ADJUSTMENT',
}

@Entity('cash_transactions')
export class CashTransaction extends BaseEntity {
  @Column({ name: 'cash_account_id' })
  cashAccountId: number;

  @Column({ type: 'enum', enum: CashTransactionType })
  transactionType: CashTransactionType;

  @Column({ name: 'transaction_date', type: 'date' })
  transactionDate: Date;

  @Column({ length: 10, default: 'VND' })
  currency: string;

  @Column({ type: 'decimal', precision: 18, scale: 4 })
  amount: number;

  @Column({ length: 200 })
  description: string;

  @Column({ name: 'job_id', nullable: true })
  jobId: number;

  @Column({ name: 'partner_id', nullable: true })
  partnerId: number;

  @Column({ name: 'reference_type', length: 50, nullable: true })
  referenceType: string;

  @Column({ name: 'reference_id', nullable: true })
  referenceId: number;

  @Column({ type: 'text', nullable: true })
  notes: string;
}

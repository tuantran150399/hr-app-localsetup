import { Entity, Column } from 'typeorm';
import { BaseEntity } from './base.entity';

export enum CashAccountType {
  CASH = 'CASH',
  BANK = 'BANK',
}

@Entity('cash_accounts')
export class CashAccount extends BaseEntity {
  @Column({ unique: true, length: 50 })
  code: string;

  @Column({ length: 150 })
  name: string;

  @Column({ type: 'enum', enum: CashAccountType })
  type: CashAccountType;

  @Column({ length: 10, default: 'VND' })
  currency: string;

  @Column({ name: 'bank_name', length: 150, nullable: true })
  bankName: string;

  @Column({ name: 'account_number', length: 100, nullable: true })
  accountNumber: string;

  @Column({ type: 'decimal', precision: 18, scale: 4, default: 0 })
  balance: number;

  @Column({ default: true })
  isActive: boolean;
}

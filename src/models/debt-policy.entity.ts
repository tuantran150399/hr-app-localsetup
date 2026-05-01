import { Entity, Column, Unique } from 'typeorm';
import { BaseEntity } from './base.entity';

@Entity('debt_policies')
@Unique(['partnerId'])
export class DebtPolicy extends BaseEntity {
  @Column({ name: 'partner_id' })
  partnerId: number;

  @Column({ name: 'max_debt_amount', type: 'decimal', precision: 18, scale: 4, nullable: true })
  maxDebtAmount: number;

  @Column({ name: 'max_debt_age_days', nullable: true })
  maxDebtAgeDays: number;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;
}

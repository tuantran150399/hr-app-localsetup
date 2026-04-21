import { Entity, Column, Unique } from 'typeorm';
import { BaseEntity } from './base.entity';

/**
 * Represents a locked accounting period (year/month).
 * When a period is locked, no new postings or reversals are allowed within that period.
 */
@Entity('accounting_periods')
@Unique(['year', 'month'])
export class AccountingPeriod extends BaseEntity {
  @Column({ type: 'smallint' })
  year: number;

  /** 1–12 */
  @Column({ type: 'tinyint' })
  month: number;

  @Column({ name: 'is_locked', default: false })
  isLocked: boolean;

  @Column({ name: 'locked_at', type: 'datetime', nullable: true })
  lockedAt: Date;

  @Column({ name: 'locked_by', nullable: true })
  lockedBy: number;

  @Column({ name: 'unlocked_at', type: 'datetime', nullable: true })
  unlockedAt: Date;

  @Column({ name: 'unlocked_by', nullable: true })
  unlockedBy: number;
}

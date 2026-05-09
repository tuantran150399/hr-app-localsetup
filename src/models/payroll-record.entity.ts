import { Entity, Column, Unique } from 'typeorm';
import { BaseEntity } from './base.entity';

export enum PayrollStatus {
  DRAFT = 'DRAFT',
  POSTED = 'POSTED',
  VOIDED = 'VOIDED',
}

@Entity('payroll_records')
@Unique(['employeeId', 'year', 'month'])
export class PayrollRecord extends BaseEntity {
  @Column({ name: 'employee_id' })
  employeeId: number;

  @Column()
  year: number;

  @Column()
  month: number;

  @Column({ name: 'base_salary', type: 'decimal', precision: 18, scale: 4, default: 0 })
  baseSalary: number;

  @Column({ type: 'decimal', precision: 18, scale: 4, default: 0 })
  allowance: number;

  @Column({ type: 'decimal', precision: 18, scale: 4, default: 0 })
  deduction: number;

  @Column({ name: 'net_salary', type: 'decimal', precision: 18, scale: 4, default: 0 })
  netSalary: number;

  @Column({ type: 'enum', enum: PayrollStatus, default: PayrollStatus.DRAFT })
  status: PayrollStatus;

  @Column({ name: 'posted_at', type: 'datetime', nullable: true })
  postedAt: Date;

  @Column({ name: 'posted_by', nullable: true })
  postedBy: number;

  @Column({ type: 'text', nullable: true })
  notes: string;
}

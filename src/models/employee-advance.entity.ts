import { Entity, Column } from 'typeorm';
import { BaseEntity } from './base.entity';
import { PaymentMethod } from './revenue-entry.entity';

export enum AdvanceStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  SETTLED = 'SETTLED',
  CANCELLED = 'CANCELLED',
}

@Entity('employee_advances')
export class EmployeeAdvance extends BaseEntity {
  @Column({ name: 'employee_id' })
  employeeId: number;

  @Column({ name: 'job_id', nullable: true })
  jobId: number;

  @Column({ length: 10, default: 'VND' })
  currency: string;

  @Column({ type: 'decimal', precision: 18, scale: 4 })
  amount: number;

  @Column({ name: 'settled_amount', type: 'decimal', precision: 18, scale: 4, default: 0 })
  settledAmount: number;

  @Column({ name: 'due_date', type: 'date', nullable: true })
  dueDate: Date;

  @Column({ type: 'text', nullable: true })
  purpose: string;

  @Column({
    name: 'payment_method',
    type: 'enum',
    enum: PaymentMethod,
    nullable: true,
  })
  paymentMethod: PaymentMethod;

  @Column({ type: 'enum', enum: AdvanceStatus, default: AdvanceStatus.PENDING })
  status: AdvanceStatus;

  @Column({ name: 'approved_at', type: 'datetime', nullable: true })
  approvedAt: Date;

  @Column({ name: 'approved_by', nullable: true })
  approvedBy: number;

  @Column({ name: 'settled_at', type: 'datetime', nullable: true })
  settledAt: Date;

  @Column({ name: 'settled_by', nullable: true })
  settledBy: number;

  @Column({ name: 'reject_reason', type: 'text', nullable: true })
  rejectReason: string;
}

import { Entity, Column } from 'typeorm';
import { BaseEntity } from './base.entity';

export enum LeaveStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  CANCELLED = 'CANCELLED',
}

@Entity('leave_requests')
export class LeaveRequest extends BaseEntity {
  @Column({ name: 'employee_id' })
  employeeId: number;

  @Column({ name: 'leave_type', length: 50 })
  leaveType: string;

  @Column({ name: 'date_from', type: 'date' })
  dateFrom: Date;

  @Column({ name: 'date_to', type: 'date' })
  dateTo: Date;

  @Column({ type: 'decimal', precision: 8, scale: 2 })
  days: number;

  @Column({ type: 'text', nullable: true })
  reason: string;

  @Column({ type: 'enum', enum: LeaveStatus, default: LeaveStatus.PENDING })
  status: LeaveStatus;

  @Column({ name: 'approved_at', type: 'datetime', nullable: true })
  approvedAt: Date;

  @Column({ name: 'approved_by', nullable: true })
  approvedBy: number;

  @Column({ name: 'rejected_at', type: 'datetime', nullable: true })
  rejectedAt: Date;

  @Column({ name: 'rejected_by', nullable: true })
  rejectedBy: number;

  @Column({ name: 'reject_reason', type: 'text', nullable: true })
  rejectReason: string;
}

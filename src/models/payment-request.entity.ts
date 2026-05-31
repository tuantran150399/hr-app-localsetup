import { Entity, Column } from 'typeorm';
import { BaseEntity } from './base.entity';
import { PaymentMethod } from './revenue-entry.entity';

export enum PaymentRequestStatus {
  PENDING_DEPARTMENT_APPROVAL = 'PENDING_DEPARTMENT_APPROVAL',
  DEPARTMENT_APPROVED = 'DEPARTMENT_APPROVED',
  REJECTED = 'REJECTED',
  FINAL_APPROVED = 'FINAL_APPROVED',
}

@Entity('payment_requests')
export class PaymentRequest extends BaseEntity {
  @Column({ name: 'branch_id', nullable: true })
  branchId: number;

  @Column({ name: 'job_id', nullable: true })
  jobId: number;

  @Column({ name: 'vendor_id' })
  vendorId: number;

  @Column({ name: 'is_charge_on_behalf', default: false })
  isChargeOnBehalf: boolean;

  @Column({ name: 'charge_to_partner_id', nullable: true })
  chargeToPartnerId: number;

  @Column({ name: 'cob_entry_id', nullable: true })
  cobEntryId: number;

  @Column({ name: 'receivable_entry_id', nullable: true })
  receivableEntryId: number;

  @Column({ length: 10, default: 'VND' })
  currency: string;

  @Column({ type: 'decimal', precision: 18, scale: 4 })
  amount: number;

  @Column({ name: 'requested_payment_date', type: 'date', nullable: true })
  requestedPaymentDate: Date;

  @Column({ type: 'text', nullable: true })
  reason: string;

  @Column({
    name: 'payment_method',
    type: 'enum',
    enum: PaymentMethod,
    nullable: true,
  })
  paymentMethod: PaymentMethod;

  @Column({
    type: 'enum',
    enum: PaymentRequestStatus,
    default: PaymentRequestStatus.PENDING_DEPARTMENT_APPROVAL,
  })
  status: PaymentRequestStatus;

  @Column({ name: 'department_approved_at', type: 'datetime', nullable: true })
  departmentApprovedAt: Date;

  @Column({ name: 'department_approved_by', nullable: true })
  departmentApprovedBy: number;

  @Column({ name: 'final_approved_at', type: 'datetime', nullable: true })
  finalApprovedAt: Date;

  @Column({ name: 'final_approved_by', nullable: true })
  finalApprovedBy: number;

  @Column({ name: 'rejected_at', type: 'datetime', nullable: true })
  rejectedAt: Date;

  @Column({ name: 'rejected_by', nullable: true })
  rejectedBy: number;

  @Column({ name: 'reject_reason', type: 'text', nullable: true })
  rejectReason: string;
}

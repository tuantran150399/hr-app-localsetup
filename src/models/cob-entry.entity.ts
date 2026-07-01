import { Entity, Column } from 'typeorm';
import { BaseEntity } from './base.entity';
import { PaymentMethod } from './revenue-entry.entity';

export enum CobType {
  CHARGE_ON_BEHALF = 'CHARGE_ON_BEHALF',
  COLLECT_ON_BEHALF = 'COLLECT_ON_BEHALF',
}

export enum CobStatus {
  OPEN = 'OPEN',
  SETTLED = 'SETTLED',
  VOIDED = 'VOIDED',
}

@Entity('cob_entries')
export class CobEntry extends BaseEntity {
  @Column({ type: 'enum', enum: CobType })
  type: CobType;

  /** The partner we pay or collect from (vendor for COB, customer for collect) */
  @Column({ name: 'vendor_id', nullable: true })
  vendorId: number;

  /** The partner who should reimburse us (customer for COB) or receive money */
  @Column({ name: 'partner_id' })
  partnerId: number;

  @Column({ name: 'job_id', nullable: true })
  jobId: number;

  /** If created from an accounting cost entry */
  @Column({ name: 'cost_entry_id', nullable: true })
  costEntryId: number;

  /** Auto-created receivable entry id */
  @Column({ name: 'receivable_entry_id', nullable: true })
  receivableEntryId: number;

  /** Paired charge/collect-on-behalf entry id */
  @Column({ name: 'related_cob_entry_id', nullable: true })
  relatedCobEntryId: number;

  /** Debit Note that absorbed this standalone receivable. */
  @Column({ name: 'billed_debit_note_id', nullable: true })
  billedDebitNoteId: number;

  @Column({ length: 10, default: 'VND' })
  currency: string;

  @Column({ type: 'decimal', precision: 18, scale: 4 })
  amount: number;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({
    name: 'payment_method',
    type: 'enum',
    enum: PaymentMethod,
    nullable: true,
  })
  paymentMethod: PaymentMethod;

  @Column({ type: 'enum', enum: CobStatus, default: CobStatus.OPEN })
  status: CobStatus;

  @Column({ name: 'settled_at', type: 'datetime', nullable: true })
  settledAt: Date;

  @Column({ name: 'settled_by', nullable: true })
  settledBy: number;

  @Column({ name: 'voided_at', type: 'datetime', nullable: true })
  voidedAt: Date;

  @Column({ name: 'voided_by', nullable: true })
  voidedBy: number;
}

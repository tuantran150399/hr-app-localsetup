import { Entity, Column } from 'typeorm';
import { BaseEntity } from './base.entity';

@Entity('debit_note_lines')
export class DebitNoteLine extends BaseEntity {
  @Column({ name: 'debit_note_id' })
  debitNoteId: number;

  @Column({ name: 'service_type', length: 50, nullable: true })
  serviceType: string;

  @Column({ length: 300, nullable: true })
  description: string;

  @Column({ type: 'int', default: 1 })
  quantity: number;

  @Column({ name: 'unit_price', type: 'decimal', precision: 18, scale: 4, default: 0 })
  unitPrice: number;

  @Column({ type: 'decimal', precision: 18, scale: 4, default: 0 })
  amount: number;

  @Column({ length: 10, default: 'VND' })
  currency: string;

  /** Link back to pricing tariff used for auto-fill */
  @Column({ name: 'pricing_id', nullable: true })
  pricingId: number;
}

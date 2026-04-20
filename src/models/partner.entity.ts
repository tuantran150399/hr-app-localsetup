import { Entity, Column } from 'typeorm';
import { BaseEntity } from './base.entity';

export enum PartnerType {
  CUSTOMER = 'CUSTOMER',
  VENDOR = 'VENDOR',
  BOTH = 'BOTH',
}

@Entity('partners')
export class Partner extends BaseEntity {
  @Column({ unique: true, length: 50 })
  code: string;

  @Column({ length: 200 })
  name: string;

  @Column({
    type: 'enum',
    enum: PartnerType,
    default: PartnerType.CUSTOMER,
  })
  partnerType: PartnerType;

  @Column({ length: 150, nullable: true })
  contactPerson: string;

  @Column({ length: 50, nullable: true })
  phone: string;

  @Column({ length: 150, nullable: true })
  email: string;

  @Column({ length: 255, nullable: true })
  address: string;

  @Column({ length: 50, nullable: true })
  taxCode: string;

  @Column({ default: true })
  isActive: boolean;
}
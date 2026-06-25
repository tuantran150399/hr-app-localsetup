import { Entity, Column } from 'typeorm';
import { BaseEntity } from './base.entity';

export enum PricingServiceType {
  CUSTOMS = 'CUSTOMS',
  TRUCKING = 'TRUCKING',
  SEA_FREIGHT = 'SEA_FREIGHT',
  AIR_FREIGHT = 'AIR_FREIGHT',
  LOCAL_CHARGE = 'LOCAL_CHARGE',
  LCL = 'LCL',
  OTHER = 'OTHER',
}

@Entity('service_prices')
export class ServicePrice extends BaseEntity {
  @Column({ name: 'partner_id', nullable: true })
  partnerId: number;

  @Column({ name: 'pricing_category', length: 50, nullable: true })
  pricingCategory: string;

  @Column({ name: 'charge_name', length: 200, nullable: true })
  chargeName: string;

  @Column({ name: 'service_type', type: 'enum', enum: PricingServiceType })
  serviceType: PricingServiceType;

  @Column({ name: 'shipment_mode', length: 50, nullable: true })
  shipmentMode: string;

  @Column({ length: 20, nullable: true })
  direction: string;

  @Column({ name: 'container_size', length: 20, nullable: true })
  containerSize: string;

  @Column({ name: 'vehicle_type', length: 50, nullable: true })
  vehicleType: string;

  @Column({ name: 'route_from', length: 150, nullable: true })
  routeFrom: string;

  @Column({ name: 'route_to', length: 150, nullable: true })
  routeTo: string;

  @Column({ length: 50, nullable: true })
  unit: string;

  @Column({ name: 'min_quantity', type: 'decimal', precision: 18, scale: 4, nullable: true })
  minQuantity: number;

  @Column({ name: 'max_quantity', type: 'decimal', precision: 18, scale: 4, nullable: true })
  maxQuantity: number;

  @Column({ length: 10, default: 'VND' })
  currency: string;

  @Column({ name: 'calculation_type', length: 20, default: 'FIXED' })
  calculationType: string;

  @Column({ type: 'decimal', precision: 18, scale: 4 })
  amount: number;

  @Column({ name: 'effective_from', type: 'date', nullable: true })
  effectiveFrom: Date;

  @Column({ name: 'effective_to', type: 'date', nullable: true })
  effectiveTo: Date;

  @Column({ default: true })
  isActive: boolean;

  @Column({ type: 'text', nullable: true })
  notes: string;
}

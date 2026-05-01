import { Entity, Column } from 'typeorm';
import { BaseEntity } from './base.entity';

export enum JobStatus {
  DRAFT = 'DRAFT',
  IN_PROGRESS = 'IN_PROGRESS',
  CLOSED = 'CLOSED',
  CANCELLED = 'CANCELLED',
}

export enum JobType {
  IMPORT = 'IMPORT',
  EXPORT = 'EXPORT',
  DOMESTIC = 'DOMESTIC',
}

export enum ShipmentMode {
  SEA_FCL = 'SEA_FCL',
  SEA_LCL = 'SEA_LCL',
  AIR = 'AIR',
  ROAD = 'ROAD',
  RAIL = 'RAIL',
}

@Entity('jobs')
export class Job extends BaseEntity {
  @Column({ unique: true, length: 50 })
  jobCode: string;

  @Column({
    type: 'enum',
    enum: JobStatus,
    default: JobStatus.DRAFT,
  })
  status: JobStatus;

  @Column({
    type: 'enum',
    enum: JobType,
    nullable: true,
  })
  jobType: JobType;

  @Column({
    type: 'enum',
    enum: ShipmentMode,
    nullable: true,
  })
  shipmentMode: ShipmentMode;

  @Column({ name: 'partner_id', nullable: true })
  partnerId: number;

  @Column({ name: 'branch_id', nullable: true })
  branchId: number;

  @Column({ name: 'assigned_user_id', nullable: true })
  assignedUserId: number;

  @Column({ name: 'agent_id', nullable: true })
  agentId: number;

  @Column({ length: 255, nullable: true })
  shipper: string;

  @Column({ length: 255, nullable: true })
  consignee: string;

  @Column({ name: 'declaration_no', length: 100, nullable: true })
  declarationNo: string;

  @Column({ name: 'business_type', length: 100, nullable: true })
  businessType: string;

  @Column({ name: 'customs_lane', length: 50, nullable: true })
  customsLane: string;

  @Column({ name: 'cargo_type', length: 50, nullable: true })
  cargoType: string;

  // ─── Shipment / Transport detail fields ─────────────────────────────────
  @Column({ name: 'booking_ref', length: 100, nullable: true })
  bookingRef: string;

  @Column({ name: 'vessel_name', length: 200, nullable: true })
  vesselName: string;

  @Column({ name: 'voyage_no', length: 50, nullable: true })
  voyageNo: string;

  @Column({ length: 100, nullable: true })
  hbl: string;

  @Column({ length: 100, nullable: true })
  mbl: string;

  @Column({ name: 'container_no', length: 100, nullable: true })
  containerNo: string;

  @Column({ name: 'seal_no', length: 100, nullable: true })
  sealNo: string;

  @Column({ name: 'etd', type: 'date', nullable: true })
  etd: Date;

  @Column({ name: 'eta', type: 'date', nullable: true })
  eta: Date;

  /** Actual Time of Departure */
  @Column({ name: 'atd', type: 'date', nullable: true })
  atd: Date;

  /** Actual Time of Arrival */
  @Column({ name: 'ata', type: 'date', nullable: true })
  ata: Date;

  @Column({ name: 'actual_delivery_date', type: 'date', nullable: true })
  actualDeliveryDate: Date;

  @Column({ name: 'pol', length: 100, nullable: true })
  pol: string; // Port of Loading

  @Column({ name: 'pod', length: 100, nullable: true })
  pod: string; // Port of Discharge

  @Column({ length: 255, nullable: true })
  origin: string;

  @Column({ length: 255, nullable: true })
  destination: string;

  // ─── Notes ──────────────────────────────────────────────────────────────
  /** Public notes (visible to operations) */
  @Column({ type: 'text', nullable: true })
  notes: string;

  /** Internal notes (admin / ops only) */
  @Column({ name: 'internal_notes', type: 'text', nullable: true })
  internalNotes: string;

  // ─── Closure ────────────────────────────────────────────────────────────
  @Column({ name: 'closed_at', type: 'datetime', nullable: true })
  closedAt: Date;

  @Column({ name: 'closed_by', nullable: true })
  closedBy: number;

  @Column({ name: 'archived_at', type: 'datetime', nullable: true })
  archivedAt: Date;

  @Column({ name: 'archived_by', nullable: true })
  archivedBy: number;
}

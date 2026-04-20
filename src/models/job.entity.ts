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

  @Column({ name: 'etd', type: 'date', nullable: true })
  etd: Date;

  @Column({ name: 'eta', type: 'date', nullable: true })
  eta: Date;

  @Column({ length: 255, nullable: true })
  origin: string;

  @Column({ length: 255, nullable: true })
  destination: string;

  @Column({ type: 'text', nullable: true })
  notes: string;

  @Column({ name: 'closed_at', type: 'datetime', nullable: true })
  closedAt: Date;

  @Column({ name: 'closed_by', nullable: true })
  closedBy: number;
}
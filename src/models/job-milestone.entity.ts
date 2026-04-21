import { Entity, Column } from 'typeorm';
import { BaseEntity } from './base.entity';

/**
 * Tracks operational timeline events for a Job.
 * Examples: "Booking Confirmed", "Cargo Received", "Vessel Departed", "Cargo Delivered"
 */
@Entity('job_milestones')
export class JobMilestone extends BaseEntity {
  @Column({ name: 'job_id' })
  jobId: number;

  /** Short event title, e.g. "Cargo Received at Port" */
  @Column({ length: 200 })
  title: string;

  /** Optional detailed description of the milestone */
  @Column({ type: 'text', nullable: true })
  description: string;

  /** When the milestone occurred (event date/time) */
  @Column({ name: 'milestone_at', type: 'datetime', nullable: true })
  milestoneAt: Date;

  /** Order for display sorting */
  @Column({ name: 'sort_order', type: 'int', default: 0 })
  sortOrder: number;
}

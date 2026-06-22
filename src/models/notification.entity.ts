import { Entity, Column, Index } from 'typeorm';

@Entity('notifications')
@Index(['userId', 'isRead'])
export class Notification {
  @Column({ primary: true, generated: true })
  id: number;

  @Column({ name: 'user_id' })
  userId: number;

  @Column({ length: 80 })
  type: string;

  @Column({ length: 200 })
  title: string;

  @Column({ type: 'text', nullable: true })
  message: string;

  /** e.g. PAYMENT_REQUEST, ADVANCE, DEBIT_NOTE, JOB, COB */
  @Column({ name: 'entity_type', length: 50, nullable: true })
  entityType: string;

  @Column({ name: 'entity_id', nullable: true })
  entityId: number;

  @Column({ name: 'event_ref', length: 100, nullable: true })
  eventRef: string;

  @Column({ name: 'action_url', length: 255, nullable: true })
  actionUrl: string;

  @Column({ name: 'action_label', length: 100, nullable: true })
  actionLabel: string;

  @Column({ length: 20, default: 'normal' })
  priority: string;

  @Column({ name: 'is_read', default: false })
  isRead: boolean;

  @Column({ name: 'read_at', type: 'datetime', nullable: true })
  readAt: Date;

  @Column({ name: 'created_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP' })
  createdAt: Date;
}

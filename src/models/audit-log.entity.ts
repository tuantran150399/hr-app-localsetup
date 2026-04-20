import { Entity, Column, Index } from 'typeorm';
import { BaseEntity } from './base.entity';

@Entity('audit_logs')
@Index(['entityName', 'entityId'])
export class AuditLog {
  @Column({ primary: true, generated: true })
  id: number;

  @Column({ name: 'entity_name', length: 100 })
  entityName: string;

  @Column({ name: 'entity_id' })
  entityId: number;

  @Column({ length: 50 })
  action: string;

  @Column({ name: 'user_id', nullable: true })
  userId: number;

  @Column({ name: 'old_values', type: 'json', nullable: true })
  oldValues: Record<string, any>;

  @Column({ name: 'new_values', type: 'json', nullable: true })
  newValues: Record<string, any>;

  @Column({ name: 'ip_address', length: 50, nullable: true })
  ipAddress: string;

  @Column({ name: 'created_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP' })
  createdAt: Date;
}
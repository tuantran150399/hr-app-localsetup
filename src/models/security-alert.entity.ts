import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from './base.entity';

export enum SecurityAlertType {
  SUSPICIOUS_LOGIN = 'SUSPICIOUS_LOGIN',
  NEW_DEVICE = 'NEW_DEVICE',
  NEW_LOCATION = 'NEW_LOCATION',
  BLOCKED_IP_LOGIN = 'BLOCKED_IP_LOGIN',
}

export enum SecurityAlertStatus {
  OPEN = 'OPEN',
  ACKNOWLEDGED = 'ACKNOWLEDGED',
  RESOLVED = 'RESOLVED',
}

export enum SecurityAlertSeverity {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL',
}

@Entity('security_alerts')
@Index(['status', 'createdAt'])
@Index(['userId', 'createdAt'])
export class SecurityAlert extends BaseEntity {
  @Column({ name: 'user_id', nullable: true })
  userId: number;

  @Column({ length: 100, nullable: true })
  username: string;

  @Column({ type: 'enum', enum: SecurityAlertType })
  type: SecurityAlertType;

  @Column({ type: 'enum', enum: SecurityAlertSeverity, default: SecurityAlertSeverity.MEDIUM })
  severity: SecurityAlertSeverity;

  @Column({ type: 'enum', enum: SecurityAlertStatus, default: SecurityAlertStatus.OPEN })
  status: SecurityAlertStatus;

  @Column({ length: 255 })
  title: string;

  @Column({ type: 'text', nullable: true })
  message: string;

  @Column({ name: 'ip_address', length: 64, nullable: true })
  ipAddress: string;

  @Column({ name: 'user_agent', length: 500, nullable: true })
  userAgent: string;

  @Column({ name: 'country_code', length: 10, nullable: true })
  countryCode: string;

  @Column({ type: 'json', nullable: true })
  metadata: Record<string, unknown>;

  @Column({ name: 'resolved_at', type: 'datetime', nullable: true })
  resolvedAt: Date;

  @Column({ name: 'resolved_by', nullable: true })
  resolvedBy: number;
}

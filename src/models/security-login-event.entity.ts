import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from './base.entity';

export enum LoginEventStatus {
  SUCCESS = 'SUCCESS',
  FAILED = 'FAILED',
  BLOCKED = 'BLOCKED',
}

@Entity('security_login_events')
@Index(['userId', 'createdAt'])
@Index(['username', 'createdAt'])
export class SecurityLoginEvent extends BaseEntity {
  @Column({ name: 'user_id', nullable: true })
  userId: number;

  @Column({ length: 100 })
  username: string;

  @Column({ type: 'enum', enum: LoginEventStatus })
  status: LoginEventStatus;

  @Column({ name: 'ip_address', length: 64, nullable: true })
  ipAddress: string;

  @Column({ name: 'user_agent', length: 500, nullable: true })
  userAgent: string;

  @Column({ name: 'device_fingerprint', length: 128, nullable: true })
  deviceFingerprint: string;

  @Column({ name: 'country_code', length: 10, nullable: true })
  countryCode: string;

  @Column({ name: 'location_label', length: 150, nullable: true })
  locationLabel: string;

  @Column({ name: 'failure_reason', length: 255, nullable: true })
  failureReason: string;

  @Column({ name: 'risk_score', default: 0 })
  riskScore: number;

  @Column({ type: 'json', nullable: true })
  signals: Record<string, unknown>;
}

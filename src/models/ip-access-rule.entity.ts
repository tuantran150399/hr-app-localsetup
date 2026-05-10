import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from './base.entity';

export enum IpAccessRuleType {
  ALLOW = 'ALLOW',
  BLOCK = 'BLOCK',
}

@Entity('ip_access_rules')
@Index(['type', 'isActive'])
export class IpAccessRule extends BaseEntity {
  @Column({ type: 'enum', enum: IpAccessRuleType })
  type: IpAccessRuleType;

  @Column({ name: 'ip_pattern', length: 100 })
  ipPattern: string;

  @Column({ length: 150 })
  label: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;
}

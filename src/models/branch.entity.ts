import { Entity, Column } from 'typeorm';
import { BaseEntity } from './base.entity';

@Entity('branches')
export class Branch extends BaseEntity {
  @Column({ unique: true, length: 50 })
  code: string;

  @Column({ length: 150 })
  name: string;

  @Column({ length: 255, nullable: true })
  address: string;

  @Column({ default: true })
  isActive: boolean;
}
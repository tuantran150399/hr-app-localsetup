import { Entity, Column, ManyToMany } from 'typeorm';
import { BaseEntity } from './base.entity';
import { Role } from './role.entity';

@Entity('permissions')
export class Permission extends BaseEntity {
  /** e.g. "job:create", "accounting:post", "user:manage" */
  @Column({ unique: true, length: 100 })
  name: string;

  @Column({ length: 200, nullable: true })
  description: string;

  @ManyToMany(() => Role, (role) => role.permissions)
  roles: Role[];
}

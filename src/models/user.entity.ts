import { Entity, Column, ManyToMany, JoinTable } from 'typeorm';
import { BaseEntity } from './base.entity';
import { Role } from './role.entity';
import { Branch } from './branch.entity';

@Entity('users')
export class User extends BaseEntity {
  @Column({ unique: true, length: 100 })
  username: string;

  @Column({ unique: true, length: 150 })
  email: string;

  @Column({ length: 255 })
  password: string;

  @Column({ name: 'full_name', length: 150, nullable: true })
  fullName: string;

  @Column({ name: 'branch_id', nullable: true })
  branchId: number;

  @Column({ name: 'can_access_all_branches', default: false })
  canAccessAllBranches: boolean;

  @Column({ default: true })
  isActive: boolean;

  @Column({ name: 'blocked_at', type: 'datetime', nullable: true })
  blockedAt: Date | null;

  @Column({ name: 'blocked_until', type: 'datetime', nullable: true })
  blockedUntil: Date | null;

  @Column({ name: 'blocked_reason', type: 'text', nullable: true })
  blockedReason: string | null;

  @Column({ name: 'blocked_by', nullable: true })
  blockedBy: number | null;

  @Column({ name: 'unblocked_at', type: 'datetime', nullable: true })
  unblockedAt: Date | null;

  @Column({ name: 'unblocked_by', nullable: true })
  unblockedBy: number | null;

  @ManyToMany(() => Role, (role) => role.users, { eager: true })
  @JoinTable({
    name: 'user_roles',
    joinColumn: { name: 'user_id', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'role_id', referencedColumnName: 'id' },
  })
  roles: Role[];
}

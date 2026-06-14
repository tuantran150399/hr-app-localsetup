import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User } from '../../models/user.entity';
import { Role } from '../../models/role.entity';
import { Branch } from '../../models/branch.entity';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { BlockUserDto } from './dto/block-user.dto';
import { isUserBlocked } from '../../common/auth/user-access.util';

@Injectable()
export class UsersService {
  private static readonly MASTER_ACCOUNT_USERNAMES = new Set(['admin', 'api.tester']);

  constructor(
    @InjectRepository(User) private userRepo: Repository<User>,
    @InjectRepository(Role) private roleRepo: Repository<Role>,
    @InjectRepository(Branch) private branchRepo: Repository<Branch>,
    private auditLogs: AuditLogsService,
  ) {}

  private async validateBranch(branchId?: number) {
    if (branchId) {
      const b = await this.branchRepo.findOne({ where: { id: branchId } });
      if (!b) throw new BadRequestException(`Branch #${branchId} not found`);
    }
  }

  private normalizeBranchAccess<T extends { branchId?: number; canAccessAllBranches?: boolean }>(dto: T): T {
    if (!dto.canAccessAllBranches) return dto;
    return { ...dto, branchId: null } as T;
  }

  private isMasterAccount(user: User) {
    return UsersService.MASTER_ACCOUNT_USERNAMES.has(user.username);
  }

  private ensureMutableAccount(user: User, action: 'block' | 'deactivate') {
    if (!this.isMasterAccount(user)) return;
    throw new BadRequestException(
      action === 'block'
        ? 'Master accounts cannot be blocked'
        : 'Master accounts cannot be deactivated',
    );
  }

  async create(dto: CreateUserDto, actorId: number) {
    dto = this.normalizeBranchAccess(dto);
    const exists = await this.userRepo.findOne({
      where: [{ username: dto.username }, { email: dto.email }],
    });
    if (exists) throw new ConflictException('Username or email already taken');
    await this.validateBranch(dto.branchId);
    const hash = await bcrypt.hash(dto.password, 12);
    const user = this.userRepo.create({ ...dto, password: hash, createdBy: actorId, updatedBy: actorId });
    if (dto.roleIds?.length) {
      user.roles = await this.roleRepo.findByIds(dto.roleIds);
    }
    const saved = await this.userRepo.save(user);
    this.auditLogs.logAsync({
      entityName: 'User', entityId: saved.id, action: 'CREATE', userId: actorId,
      newValues: { username: saved.username, email: saved.email, branchId: saved.branchId, canAccessAllBranches: saved.canAccessAllBranches },
    });
    return this.findOne(saved.id);
  }

  findAll() {
    return this.userRepo.find({ relations: ['roles'] });
  }

  async findOne(id: number) {
    const user = await this.userRepo.findOne({ where: { id }, relations: ['roles', 'roles.permissions'] });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async update(id: number, dto: UpdateUserDto, actorId: number) {
    dto = this.normalizeBranchAccess(dto);
    const user = await this.findOne(id);
    if (dto.isActive === false) {
      this.ensureMutableAccount(user, 'deactivate');
    }
    await this.validateBranch(dto.branchId);
    const oldValues = {
      username: user.username,
      email: user.email,
      branchId: user.branchId,
      canAccessAllBranches: user.canAccessAllBranches,
      isActive: user.isActive,
    };
    Object.assign(user, dto, { updatedBy: actorId });
    if (dto.roleIds !== undefined) {
      user.roles = dto.roleIds.length ? await this.roleRepo.findByIds(dto.roleIds) : [];
    }
    const saved = await this.userRepo.save(user);
    this.auditLogs.logAsync({
      entityName: 'User', entityId: id, action: 'UPDATE', userId: actorId,
      oldValues,
      newValues: {
        username: saved.username,
        email: saved.email,
        branchId: saved.branchId,
        canAccessAllBranches: saved.canAccessAllBranches,
        isActive: saved.isActive,
      },
    });
    return saved;
  }

  async block(id: number, dto: BlockUserDto, actorId: number) {
    const user = await this.findOne(id);
    this.ensureMutableAccount(user, 'block');
    if (!user.isActive) {
      throw new BadRequestException('Deactivated users cannot be blocked');
    }
    if (isUserBlocked(user)) {
      throw new BadRequestException('User is already blocked');
    }

    const blockedUntil = dto.blockedUntil ? new Date(dto.blockedUntil) : null;
    if (blockedUntil && blockedUntil <= new Date()) {
      throw new BadRequestException('Block expiry must be in the future');
    }

    user.blockedAt = new Date();
    user.blockedUntil = blockedUntil;
    user.blockedReason = dto.reason.trim();
    user.blockedBy = actorId;
    user.unblockedAt = null;
    user.unblockedBy = null;
    user.updatedBy = actorId;

    const saved = await this.userRepo.save(user);
    this.auditLogs.logAsync({
      entityName: 'User',
      entityId: id,
      action: 'BLOCK',
      userId: actorId,
      newValues: {
        blockedAt: saved.blockedAt,
        blockedUntil: saved.blockedUntil,
        blockedReason: saved.blockedReason,
        blockedBy: saved.blockedBy,
      },
    });
    return saved;
  }

  async unblock(id: number, actorId: number) {
    const user = await this.findOne(id);
    this.ensureMutableAccount(user, 'block');
    if (!isUserBlocked(user)) {
      throw new BadRequestException('User is not currently blocked');
    }

    const oldValues = {
      blockedAt: user.blockedAt,
      blockedUntil: user.blockedUntil,
      blockedReason: user.blockedReason,
      blockedBy: user.blockedBy,
    };

    user.blockedAt = null;
    user.blockedUntil = null;
    user.blockedReason = null;
    user.blockedBy = null;
    user.unblockedAt = new Date();
    user.unblockedBy = actorId;
    user.updatedBy = actorId;

    const saved = await this.userRepo.save(user);
    this.auditLogs.logAsync({
      entityName: 'User',
      entityId: id,
      action: 'UNBLOCK',
      userId: actorId,
      oldValues,
      newValues: {
        unblockedAt: saved.unblockedAt,
        unblockedBy: saved.unblockedBy,
      },
    });
    return saved;
  }

  async changePassword(id: number, dto: ChangePasswordDto) {
    const user = await this.userRepo.findOne({ where: { id } });
    if (!user) throw new NotFoundException('User not found');
    const valid = await bcrypt.compare(dto.currentPassword, user.password);
    if (!valid) throw new BadRequestException('Current password is incorrect');
    user.password = await bcrypt.hash(dto.newPassword, 12);
    await this.userRepo.save(user);
    return { message: 'Password changed successfully' };
  }

  async remove(id: number, actorId: number) {
    const user = await this.findOne(id);
    this.ensureMutableAccount(user, 'deactivate');
    user.isActive = false;
    user.updatedBy = actorId;
    await this.userRepo.save(user);
    this.auditLogs.logAsync({
      entityName: 'User', entityId: id, action: 'DEACTIVATE', userId: actorId,
      newValues: { isActive: false },
    });
    return { message: 'User deactivated' };
  }
}

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
import { UpdateProfileDto } from './dto/update-profile.dto';

@Injectable()
export class UsersService {
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

  async create(dto: CreateUserDto, actorId: number) {
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
      newValues: { username: saved.username, email: saved.email },
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
    const user = await this.findOne(id);
    await this.validateBranch(dto.branchId);
    const oldValues = { username: user.username, email: user.email, branchId: user.branchId };
    Object.assign(user, dto, { updatedBy: actorId });
    if (dto.roleIds !== undefined) {
      user.roles = dto.roleIds.length ? await this.roleRepo.findByIds(dto.roleIds) : [];
    }
    const saved = await this.userRepo.save(user);
    this.auditLogs.logAsync({
      entityName: 'User', entityId: id, action: 'UPDATE', userId: actorId,
      oldValues,
      newValues: { username: saved.username, email: saved.email, branchId: saved.branchId },
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

  async updateProfile(id: number, dto: UpdateProfileDto) {
    const user = await this.userRepo.findOne({ where: { id } });
    if (!user) throw new NotFoundException('User not found');
    if (dto.email && dto.email !== user.email) {
      const emailTaken = await this.userRepo.findOne({ where: { email: dto.email } });
      if (emailTaken && emailTaken.id !== id) {
        throw new ConflictException('Email already taken');
      }
    }
    const oldValues = { fullName: user.fullName, email: user.email };
    Object.assign(user, dto, { updatedBy: id });
    const saved = await this.userRepo.save(user);
    this.auditLogs.logAsync({
      entityName: 'User', entityId: id, action: 'UPDATE_PROFILE', userId: id,
      oldValues,
      newValues: { fullName: saved.fullName, email: saved.email },
    });
    return { id: saved.id, fullName: saved.fullName, email: saved.email, message: 'Profile updated successfully' };
  }

  async remove(id: number, actorId: number) {
    const user = await this.findOne(id);
    user.isActive = false;
    await this.userRepo.save(user);
    this.auditLogs.logAsync({
      entityName: 'User', entityId: id, action: 'DEACTIVATE', userId: actorId,
      newValues: { isActive: false },
    });
    return { message: 'User deactivated' };
  }
}

const fs = require('fs');

// ─── jobs.service.ts ────────────────────────────────────────────────────────
fs.writeFileSync('src/business/jobs/jobs.service.ts', `\
import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Job, JobStatus } from '../../models/job.entity';
import { Partner } from '../../models/partner.entity';
import { Branch } from '../../models/branch.entity';
import { User } from '../../models/user.entity';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { CreateJobDto, UpdateJobDto } from './dto/job.dto';

@Injectable()
export class JobsService {
  constructor(
    @InjectRepository(Job) private repo: Repository<Job>,
    @InjectRepository(Partner) private partnerRepo: Repository<Partner>,
    @InjectRepository(Branch) private branchRepo: Repository<Branch>,
    @InjectRepository(User) private userRepo: Repository<User>,
    private auditLogs: AuditLogsService,
  ) {}

  private async validateRefs(dto: {
    partnerId?: number;
    branchId?: number;
    assignedUserId?: number;
  }) {
    if (dto.partnerId) {
      const p = await this.partnerRepo.findOne({ where: { id: dto.partnerId } });
      if (!p) throw new BadRequestException(\`Partner #\${dto.partnerId} not found\`);
    }
    if (dto.branchId) {
      const b = await this.branchRepo.findOne({ where: { id: dto.branchId } });
      if (!b) throw new BadRequestException(\`Branch #\${dto.branchId} not found\`);
    }
    if (dto.assignedUserId) {
      const u = await this.userRepo.findOne({ where: { id: dto.assignedUserId } });
      if (!u) throw new BadRequestException(\`User #\${dto.assignedUserId} not found\`);
      if (!u.isActive) throw new BadRequestException(\`User #\${dto.assignedUserId} is inactive\`);
    }
  }

  async create(dto: CreateJobDto, actorId: number) {
    const exists = await this.repo.findOne({ where: { jobCode: dto.jobCode } });
    if (exists) throw new ConflictException('Job code already exists');
    await this.validateRefs(dto);
    const job = await this.repo.save(
      this.repo.create({ ...dto, status: JobStatus.DRAFT, createdBy: actorId, updatedBy: actorId }),
    );
    await this.auditLogs.log({
      entityName: 'Job', entityId: job.id, action: 'CREATE', userId: actorId,
      newValues: { jobCode: job.jobCode, jobType: job.jobType, status: job.status },
    });
    return job;
  }

  findAll() { return this.repo.find({ order: { createdAt: 'DESC' } }); }

  async findOne(id: number) {
    const job = await this.repo.findOne({ where: { id } });
    if (!job) throw new NotFoundException('Job not found');
    return job;
  }

  async update(id: number, dto: UpdateJobDto, actorId: number) {
    const job = await this.findOne(id);
    if (job.status === JobStatus.CLOSED || job.status === JobStatus.CANCELLED) {
      throw new BadRequestException('Cannot edit a CLOSED or CANCELLED job');
    }
    await this.validateRefs(dto);
    const oldValues = { jobCode: job.jobCode, partnerId: job.partnerId, branchId: job.branchId };
    const updated = await this.repo.save({ ...job, ...dto, updatedBy: actorId });
    await this.auditLogs.log({
      entityName: 'Job', entityId: id, action: 'UPDATE', userId: actorId,
      oldValues,
      newValues: { jobCode: updated.jobCode, partnerId: updated.partnerId, branchId: updated.branchId },
    });
    return updated;
  }

  async updateStatus(id: number, status: JobStatus, actorId: number) {
    const job = await this.findOne(id);
    if (job.status === JobStatus.CLOSED || job.status === JobStatus.CANCELLED) {
      throw new BadRequestException('Job is already finalized');
    }
    const oldStatus = job.status;
    const update: Partial<Job> = { status, updatedBy: actorId };
    if (status === JobStatus.CLOSED) {
      update.closedAt = new Date();
      update.closedBy = actorId;
    }
    const updated = await this.repo.save({ ...job, ...update });
    await this.auditLogs.log({
      entityName: 'Job', entityId: id, action: 'STATUS_CHANGE', userId: actorId,
      oldValues: { status: oldStatus },
      newValues: { status },
    });
    return updated;
  }
}
`, 'utf8');
console.log('✓ jobs.service.ts');

// ─── jobs.module.ts ─────────────────────────────────────────────────────────
fs.writeFileSync('src/business/jobs/jobs.module.ts', `\
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JobsController } from './jobs.controller';
import { JobsService } from './jobs.service';
import { Job } from '../../models/job.entity';
import { Partner } from '../../models/partner.entity';
import { Branch } from '../../models/branch.entity';
import { User } from '../../models/user.entity';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';

@Module({
  imports: [TypeOrmModule.forFeature([Job, Partner, Branch, User]), AuditLogsModule],
  controllers: [JobsController],
  providers: [JobsService],
  exports: [JobsService],
})
export class JobsModule {}
`, 'utf8');
console.log('✓ jobs.module.ts');

// ─── users.service.ts ───────────────────────────────────────────────────────
fs.writeFileSync('src/business/users/users.service.ts', `\
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
      if (!b) throw new BadRequestException(\`Branch #\${branchId} not found\`);
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
    await this.auditLogs.log({
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
    await this.auditLogs.log({
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

  async remove(id: number, actorId: number) {
    const user = await this.findOne(id);
    user.isActive = false;
    await this.userRepo.save(user);
    await this.auditLogs.log({
      entityName: 'User', entityId: id, action: 'DEACTIVATE', userId: actorId,
      newValues: { isActive: false },
    });
    return { message: 'User deactivated' };
  }
}
`, 'utf8');
console.log('✓ users.service.ts');

// ─── users.module.ts ────────────────────────────────────────────────────────
fs.writeFileSync('src/business/users/users.module.ts', `\
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { User } from '../../models/user.entity';
import { Role } from '../../models/role.entity';
import { Branch } from '../../models/branch.entity';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';

@Module({
  imports: [TypeOrmModule.forFeature([User, Role, Branch]), AuditLogsModule],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
`, 'utf8');
console.log('✓ users.module.ts');

// ─── accounting.module.ts ───────────────────────────────────────────────────
fs.writeFileSync('src/business/accounting/accounting.module.ts', `\
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AccountingController } from './accounting.controller';
import { AccountingService } from './accounting.service';
import { RevenueEntry } from '../../models/revenue-entry.entity';
import { CostEntry } from '../../models/cost-entry.entity';
import { Job } from '../../models/job.entity';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';

@Module({
  imports: [TypeOrmModule.forFeature([RevenueEntry, CostEntry, Job]), AuditLogsModule],
  controllers: [AccountingController],
  providers: [AccountingService],
})
export class AccountingModule {}
`, 'utf8');
console.log('✓ accounting.module.ts');

console.log('\nAll files written successfully.');

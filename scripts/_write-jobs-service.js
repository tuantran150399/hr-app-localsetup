const fs = require('fs');
const path = require('path');

const content = `import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Job, JobStatus } from '../../models/job.entity';
import { JobMilestone } from '../../models/job-milestone.entity';
import { Partner } from '../../models/partner.entity';
import { Branch } from '../../models/branch.entity';
import { User } from '../../models/user.entity';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { CreateJobDto, UpdateJobDto, JobFilterDto, CreateMilestoneDto, UpdateMilestoneDto } from './dto/job.dto';
import { paginate, getSkip } from '../../common/utils/pagination.util';

@Injectable()
export class JobsService {
  constructor(
    @InjectRepository(Job) private repo: Repository<Job>,
    @InjectRepository(JobMilestone) private milestoneRepo: Repository<JobMilestone>,
    @InjectRepository(Partner) private partnerRepo: Repository<Partner>,
    @InjectRepository(Branch) private branchRepo: Repository<Branch>,
    @InjectRepository(User) private userRepo: Repository<User>,
    private auditLogs: AuditLogsService,
  ) {}

  private async validateRefs(dto: { partnerId?: number; branchId?: number; assignedUserId?: number }) {
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

  async findAll(filter: JobFilterDto) {
    const { page = 1, limit = 20, keyword, sortBy = 'createdAt', sortOrder = 'DESC',
      status, branchId, partnerId, assignedUserId, jobType, shipmentMode, dateFrom, dateTo } = filter;
    const qb = this.repo.createQueryBuilder('j');
    if (keyword) {
      qb.andWhere(
        '(j.jobCode LIKE :kw OR j.origin LIKE :kw OR j.destination LIKE :kw OR j.bookingRef LIKE :kw OR j.vesselName LIKE :kw OR j.hbl LIKE :kw OR j.mbl LIKE :kw)',
        { kw: \`%\${keyword}%\` },
      );
    }
    if (status) qb.andWhere('j.status = :status', { status });
    if (branchId) qb.andWhere('j.branchId = :branchId', { branchId });
    if (partnerId) qb.andWhere('j.partnerId = :partnerId', { partnerId });
    if (assignedUserId) qb.andWhere('j.assignedUserId = :assignedUserId', { assignedUserId });
    if (jobType) qb.andWhere('j.jobType = :jobType', { jobType });
    if (shipmentMode) qb.andWhere('j.shipmentMode = :shipmentMode', { shipmentMode });
    if (dateFrom) qb.andWhere('j.createdAt >= :dateFrom', { dateFrom });
    if (dateTo) qb.andWhere('j.createdAt <= :dateTo', { dateTo });
    const allowedSort = ['createdAt', 'etd', 'eta', 'jobCode', 'status'];
    const col = allowedSort.includes(sortBy) ? sortBy : 'createdAt';
    qb.orderBy(\`j.\${col}\`, sortOrder).skip(getSkip(page, limit)).take(limit);
    return paginate(await qb.getManyAndCount(), page, limit);
  }

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

  // --- Milestones ---

  async getMilestones(jobId: number) {
    await this.findOne(jobId);
    return this.milestoneRepo.find({ where: { jobId }, order: { sortOrder: 'ASC', createdAt: 'ASC' } });
  }

  async addMilestone(jobId: number, dto: CreateMilestoneDto, actorId: number) {
    await this.findOne(jobId);
    return this.milestoneRepo.save(
      this.milestoneRepo.create({ ...dto, jobId, createdBy: actorId, updatedBy: actorId }),
    );
  }

  async updateMilestone(jobId: number, milestoneId: number, dto: UpdateMilestoneDto, actorId: number) {
    const milestone = await this.milestoneRepo.findOne({ where: { id: milestoneId, jobId } });
    if (!milestone) throw new NotFoundException('Milestone not found');
    return this.milestoneRepo.save({ ...milestone, ...dto, updatedBy: actorId });
  }

  async deleteMilestone(jobId: number, milestoneId: number) {
    const milestone = await this.milestoneRepo.findOne({ where: { id: milestoneId, jobId } });
    if (!milestone) throw new NotFoundException('Milestone not found');
    await this.milestoneRepo.remove(milestone);
    return { message: 'Milestone deleted' };
  }
}
`;

fs.writeFileSync(path.join(__dirname, '../src/business/jobs/jobs.service.ts'), content, 'utf8');
console.log('jobs.service.ts written', content.length);

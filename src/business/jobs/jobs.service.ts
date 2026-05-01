import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Job, JobStatus } from '../../models/job.entity';
import { JobMilestone } from '../../models/job-milestone.entity';
import { Partner } from '../../models/partner.entity';
import { Branch } from '../../models/branch.entity';
import { User } from '../../models/user.entity';
import { RevenueEntry, AccountingStatus, PaymentStatus } from '../../models/revenue-entry.entity';
import { DebtPolicy } from '../../models/debt-policy.entity';
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
    @InjectRepository(RevenueEntry) private revenueRepo: Repository<RevenueEntry>,
    @InjectRepository(DebtPolicy) private debtPolicyRepo: Repository<DebtPolicy>,
    private auditLogs: AuditLogsService,
  ) {}

  private async validateRefs(dto: { partnerId?: number; branchId?: number; assignedUserId?: number; agentId?: number }) {
    if (dto.partnerId) {
      const p = await this.partnerRepo.findOne({ where: { id: dto.partnerId, isActive: true } });
      if (!p) throw new BadRequestException(`Partner #${dto.partnerId} not found`);
    }
    if (dto.agentId) {
      const p = await this.partnerRepo.findOne({ where: { id: dto.agentId, isActive: true } });
      if (!p) throw new BadRequestException(`Agent #${dto.agentId} not found`);
    }
    if (dto.branchId) {
      const b = await this.branchRepo.findOne({ where: { id: dto.branchId } });
      if (!b) throw new BadRequestException(`Branch #${dto.branchId} not found`);
    }
    if (dto.assignedUserId) {
      const u = await this.userRepo.findOne({ where: { id: dto.assignedUserId } });
      if (!u) throw new BadRequestException(`User #${dto.assignedUserId} not found`);
      if (!u.isActive) throw new BadRequestException(`User #${dto.assignedUserId} is inactive`);
    }
  }

  async create(dto: CreateJobDto, actorId: number) {
    const exists = await this.repo.findOne({ where: { jobCode: dto.jobCode } });
    if (exists) throw new ConflictException('Job code already exists');
    await this.validateRefs(dto);
    await this.assertDebtPolicyAllowsJob(dto.partnerId);
    const job = await this.repo.save(
      this.repo.create({ ...dto, status: JobStatus.DRAFT, createdBy: actorId, updatedBy: actorId }),
    );
    await this.auditLogs.log({
      entityName: 'Job',
      entityId: job.id,
      action: 'CREATE',
      userId: actorId,
      newValues: { jobCode: job.jobCode, jobType: job.jobType, status: job.status },
    });
    return job;
  }

  async copy(sourceId: number, dto: CreateJobDto, actorId: number) {
    const source = await this.findOne(sourceId);
    const exists = await this.repo.findOne({ where: { jobCode: dto.jobCode } });
    if (exists) throw new ConflictException('Job code already exists');
    await this.validateRefs({ ...source, ...dto });
    await this.assertDebtPolicyAllowsJob(dto.partnerId ?? source.partnerId);

    const { id, createdAt, updatedAt, closedAt, closedBy, archivedAt, archivedBy, ...sourceValues } = source;
    const job = await this.repo.save(
      this.repo.create({
        ...sourceValues,
        ...dto,
        status: JobStatus.DRAFT,
        closedAt: null,
        closedBy: null,
        archivedAt: null,
        archivedBy: null,
        createdBy: actorId,
        updatedBy: actorId,
      }),
    );
    await this.auditLogs.log({
      entityName: 'Job',
      entityId: job.id,
      action: 'COPY',
      userId: actorId,
      newValues: { sourceJobId: id, jobCode: job.jobCode },
    });
    return job;
  }

  async findAll(filter: JobFilterDto) {
    const {
      page = 1,
      limit = 20,
      keyword,
      sortBy = 'createdAt',
      sortOrder = 'DESC',
      status,
      branchId,
      partnerId,
      assignedUserId,
      jobType,
      shipmentMode,
      dateFrom,
      dateTo,
    } = filter;

    const qb = this.repo.createQueryBuilder('j')
      .leftJoin(Partner, 'partner', 'partner.id = j.partnerId')
      .leftJoin(Partner, 'agent', 'agent.id = j.agentId')
      .where('j.archivedAt IS NULL');

    if (keyword) {
      qb.andWhere(
        `(j.jobCode LIKE :kw
          OR j.origin LIKE :kw
          OR j.destination LIKE :kw
          OR j.bookingRef LIKE :kw
          OR j.vesselName LIKE :kw
          OR j.hbl LIKE :kw
          OR j.mbl LIKE :kw
          OR j.declarationNo LIKE :kw
          OR j.shipper LIKE :kw
          OR j.consignee LIKE :kw
          OR partner.name LIKE :kw
          OR partner.code LIKE :kw
          OR partner.taxCode LIKE :kw
          OR agent.name LIKE :kw)`,
        { kw: `%${keyword}%` },
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
    qb.orderBy(`j.${col}`, sortOrder).skip(getSkip(page, limit)).take(limit);
    return paginate(await qb.getManyAndCount(), page, limit);
  }

  async findOne(id: number) {
    const job = await this.repo.findOne({ where: { id } });
    if (!job || job.archivedAt) throw new NotFoundException('Job not found');
    return job;
  }

  async update(id: number, dto: UpdateJobDto, actorId: number) {
    const job = await this.findOne(id);
    if (job.status === JobStatus.CLOSED || job.status === JobStatus.CANCELLED) {
      throw new BadRequestException('Cannot edit a CLOSED or CANCELLED job');
    }
    await this.validateRefs(dto);
    const oldValues = { jobCode: job.jobCode, partnerId: job.partnerId, branchId: job.branchId, status: job.status };
    const updated = await this.repo.save({ ...job, ...dto, updatedBy: actorId });
    await this.auditLogs.log({
      entityName: 'Job',
      entityId: id,
      action: 'UPDATE',
      userId: actorId,
      oldValues,
      newValues: { jobCode: updated.jobCode, partnerId: updated.partnerId, branchId: updated.branchId, status: updated.status },
    });
    return updated;
  }

  async archive(id: number, actorId: number) {
    const job = await this.findOne(id);
    const updated = await this.repo.save({ ...job, archivedAt: new Date(), archivedBy: actorId, updatedBy: actorId });
    await this.auditLogs.log({
      entityName: 'Job',
      entityId: id,
      action: 'ARCHIVE',
      userId: actorId,
      oldValues: { archivedAt: job.archivedAt },
      newValues: { archivedAt: updated.archivedAt, archivedBy: actorId },
    });
    return { message: 'Job archived' };
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
      entityName: 'Job',
      entityId: id,
      action: 'STATUS_CHANGE',
      userId: actorId,
      oldValues: { status: oldStatus },
      newValues: { status },
    });
    return updated;
  }

  async getMilestones(jobId: number) {
    await this.findOne(jobId);
    return this.milestoneRepo.find({ where: { jobId }, order: { sortOrder: 'ASC', createdAt: 'ASC' } });
  }

  async addMilestone(jobId: number, dto: CreateMilestoneDto, actorId: number) {
    await this.findOne(jobId);
    const milestone = await this.milestoneRepo.save(
      this.milestoneRepo.create({ ...dto, jobId, createdBy: actorId, updatedBy: actorId }),
    );
    await this.auditLogs.log({
      entityName: 'JobMilestone',
      entityId: milestone.id,
      action: 'CREATE',
      userId: actorId,
      newValues: { jobId, title: milestone.title },
    });
    return milestone;
  }

  async updateMilestone(jobId: number, milestoneId: number, dto: UpdateMilestoneDto, actorId: number) {
    const milestone = await this.milestoneRepo.findOne({ where: { id: milestoneId, jobId } });
    if (!milestone) throw new NotFoundException('Milestone not found');
    const updated = await this.milestoneRepo.save({ ...milestone, ...dto, updatedBy: actorId });
    await this.auditLogs.log({
      entityName: 'JobMilestone',
      entityId: milestoneId,
      action: 'UPDATE',
      userId: actorId,
      oldValues: { title: milestone.title, milestoneAt: milestone.milestoneAt },
      newValues: { title: updated.title, milestoneAt: updated.milestoneAt },
    });
    return updated;
  }

  async deleteMilestone(jobId: number, milestoneId: number, actorId: number) {
    const milestone = await this.milestoneRepo.findOne({ where: { id: milestoneId, jobId } });
    if (!milestone) throw new NotFoundException('Milestone not found');
    await this.milestoneRepo.remove(milestone);
    await this.auditLogs.log({
      entityName: 'JobMilestone',
      entityId: milestoneId,
      action: 'DELETE',
      userId: actorId,
      oldValues: { jobId, title: milestone.title },
    });
    return { message: 'Milestone deleted' };
  }

  private async assertDebtPolicyAllowsJob(partnerId?: number): Promise<void> {
    if (!partnerId) return;
    const policy = await this.debtPolicyRepo.findOne({ where: { partnerId, isActive: true } });
    if (!policy) return;

    if (policy.maxDebtAmount !== null && policy.maxDebtAmount !== undefined) {
      const row = await this.revenueRepo
        .createQueryBuilder('r')
        .innerJoin(Job, 'j', 'j.id = r.jobId')
        .select('SUM(r.localAmount)', 'outstanding')
        .where('j.partnerId = :partnerId', { partnerId })
        .andWhere('r.status = :status', { status: AccountingStatus.POSTED })
        .andWhere('r.paymentStatus IN (:...paymentStatuses)', {
          paymentStatuses: [PaymentStatus.UNPAID, PaymentStatus.PARTIAL],
        })
        .getRawOne<{ outstanding: string | null }>();
      const outstanding = Number(row?.outstanding ?? 0);
      if (outstanding > Number(policy.maxDebtAmount)) {
        throw new BadRequestException('Customer exceeds configured debt limit');
      }
    }

    if (policy.maxDebtAgeDays) {
      const threshold = new Date();
      threshold.setDate(threshold.getDate() - Number(policy.maxDebtAgeDays));
      const overdue = await this.revenueRepo
        .createQueryBuilder('r')
        .innerJoin(Job, 'j', 'j.id = r.jobId')
        .where('j.partnerId = :partnerId', { partnerId })
        .andWhere('r.status = :status', { status: AccountingStatus.POSTED })
        .andWhere('r.paymentStatus != :paid', { paid: PaymentStatus.PAID })
        .andWhere('r.dueDate IS NOT NULL')
        .andWhere('r.dueDate < :threshold', { threshold: threshold.toISOString().split('T')[0] })
        .getOne();
      if (overdue) {
        throw new BadRequestException('Customer has overdue debt beyond configured policy');
      }
    }
  }
}

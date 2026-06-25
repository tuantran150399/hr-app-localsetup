import { Injectable, NotFoundException, ConflictException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Job, JobStatus } from '../../models/job.entity';
import { JobMilestone } from '../../models/job-milestone.entity';
import { Partner } from '../../models/partner.entity';
import { Branch } from '../../models/branch.entity';
import { User } from '../../models/user.entity';
import { RevenueEntry, AccountingStatus, PaymentStatus } from '../../models/revenue-entry.entity';
import { CostEntry } from '../../models/cost-entry.entity';
import { DebitNote } from '../../models/debit-note.entity';
import { DebitNoteLine } from '../../models/debit-note-line.entity';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { CreateJobDto, UpdateJobDto, JobFilterDto, CreateMilestoneDto, UpdateMilestoneDto, JobDebtPreviewDto } from './dto/job.dto';
import { paginate, getSkip } from '../../common/utils/pagination.util';
import { assertBranchAccess, AuthenticatedUser, getScopedBranchId } from '../../common/auth/branch-scope.util';
import { CustomerDebtService } from '../customer-debt/customer-debt.service';

@Injectable()
export class JobsService {
  constructor(
    @InjectRepository(Job) private repo: Repository<Job>,
    @InjectRepository(JobMilestone) private milestoneRepo: Repository<JobMilestone>,
    @InjectRepository(Partner) private partnerRepo: Repository<Partner>,
    @InjectRepository(Branch) private branchRepo: Repository<Branch>,
    @InjectRepository(User) private userRepo: Repository<User>,
    @InjectRepository(RevenueEntry) private revenueRepo: Repository<RevenueEntry>,
    @InjectRepository(CostEntry) private costRepo: Repository<CostEntry>,
    @InjectRepository(DebitNote) private debitNoteRepo: Repository<DebitNote>,
    @InjectRepository(DebitNoteLine) private debitNoteLineRepo: Repository<DebitNoteLine>,
    private auditLogs: AuditLogsService,
    private customerDebtService: CustomerDebtService,
  ) {}

  private enforceBranchAccess(user: AuthenticatedUser | undefined, branchId?: number | null) {
    try {
      assertBranchAccess(user, branchId);
    } catch {
      throw new ForbiddenException('You cannot access data from another branch');
    }
  }

  private async validateRefs(dto: { partnerId?: number; branchId?: number; assignedUserId?: number; agentId?: number }, existingJobBranchId?: number) {
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
      
      const targetBranchId = dto.branchId ?? existingJobBranchId;
      if (u.branchId && targetBranchId && u.branchId !== targetBranchId) {
        throw new BadRequestException('Assigned user does not belong to the job branch');
      }
    }
  }

  private isAdmin(user?: AuthenticatedUser) {
    return (user?.roles || []).some((role) => ['SUPER_ADMIN', 'ADMIN'].includes(role));
  }

  private hasValueChanged(current: unknown, next: unknown) {
    if (next === undefined) return false;
    if (current === null || current === undefined || current === '') return !(next === null || next === undefined || next === '');
    if (typeof current === 'number' || typeof next === 'number') {
      return Number(current) !== Number(next);
    }
    return String(current) !== String(next);
  }

  private async ensureRestrictedFieldsCanChange(job: Job & {
    revenueEntries?: RevenueEntry[];
    costEntries?: CostEntry[];
    debitNoteSummary?: { count?: number };
  }, dto: UpdateJobDto) {
    const hasFinancialDocuments =
      Number(job.debitNoteSummary?.count || 0) > 0 ||
      Number(job.debtAmount || 0) > 0 ||
      Boolean(job.revenueEntries?.length) ||
      Boolean(job.costEntries?.length);

    if (!hasFinancialDocuments) return;

    const restrictedFields: Array<keyof UpdateJobDto> = [
      'partnerId',
      'debtAmount',
      'cargoUnit',
      'cargoQuantity',
      'weightKg',
      'volumeCbm',
      'origin',
      'destination',
      'pol',
      'pod',
      'shipmentMode',
    ];

    const changedFields = restrictedFields.filter((field) => this.hasValueChanged((job as any)[field], dto[field]));
    if (changedFields.length) {
      throw new BadRequestException(`Cannot edit financial fields after this job has debit notes, debt, or accounting documents: ${changedFields.join(', ')}`);
    }
  }

  private async getJobDocumentSummary(jobId: number) {
    const [revenueCount, costCount, debitNoteCount, debitNoteLineCount] = await Promise.all([
      this.revenueRepo.count({ where: { jobId } }),
      this.costRepo.count({ where: { jobId } }),
      this.debitNoteRepo.count({ where: { jobId } }),
      this.debitNoteLineRepo.count({ where: { jobId } }),
    ]);

    return {
      revenueCount,
      costCount,
      debitNoteCount: debitNoteCount + debitNoteLineCount,
      hasAccountingDocuments: revenueCount + costCount > 0,
      hasDebitNotes: debitNoteCount + debitNoteLineCount > 0,
    };
  }

  private async lockDebitNotesForJob(jobId: number, actorId: number, reason: string) {
    const headerNotes = await this.debitNoteRepo.find({ where: { jobId } });
    const lines = await this.debitNoteLineRepo.find({ where: { jobId } });
    const lineNoteIds = [...new Set(lines.map((line) => line.debitNoteId).filter(Boolean))];
    const lineNotes = lineNoteIds.length ? await this.debitNoteRepo.findByIds(lineNoteIds) : [];
    const notes = [...headerNotes, ...lineNotes];
    const uniqueNotes = [...new Map(notes.map((note) => [note.id, note])).values()];
    const now = new Date();

    await Promise.all(uniqueNotes.map((note) => this.debitNoteRepo.update(note.id, {
      lockedAt: note.lockedAt || now,
      lockedBy: note.lockedBy || actorId,
      lockReason: note.lockReason || reason,
      updatedBy: actorId,
    })));
  }

  async create(dto: CreateJobDto, actorId: number, actor?: AuthenticatedUser) {
    this.enforceBranchAccess(actor, dto.branchId);
    const exists = await this.repo.findOne({ where: { jobCode: dto.jobCode } });
    if (exists) throw new ConflictException('Job code already exists');
    await this.validateRefs(dto);
    await this.ensureDebtLimit({
      partnerId: dto.partnerId,
      debtAmount: dto.debtAmount,
    });
    const job = await this.repo.save(
      this.repo.create({ ...dto, status: JobStatus.DRAFT, createdBy: actorId, updatedBy: actorId }),
    );
    await this.customerDebtService.refreshPartnerActualDebt(job.partnerId);
    this.auditLogs.logAsync({
      entityName: 'Job',
      entityId: job.id,
      action: 'CREATE',
      userId: actorId,
      newValues: { jobCode: job.jobCode, jobType: job.jobType, status: job.status },
    });
    return job;
  }

  async copy(sourceId: number, dto: CreateJobDto, actorId: number, actor?: AuthenticatedUser) {
    const source = await this.findOne(sourceId, actor);
    const exists = await this.repo.findOne({ where: { jobCode: dto.jobCode } });
    if (exists) throw new ConflictException('Job code already exists');
    this.enforceBranchAccess(actor, dto.branchId ?? source.branchId);
    await this.validateRefs({ ...source, ...dto });
    await this.ensureDebtLimit({
      partnerId: dto.partnerId ?? source.partnerId,
      debtAmount: dto.debtAmount ?? source.debtAmount,
      createdAt: source.createdAt,
    });

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
    await this.customerDebtService.refreshPartnerActualDebt(job.partnerId);
    this.auditLogs.logAsync({
      entityName: 'Job',
      entityId: job.id,
      action: 'COPY',
      userId: actorId,
      newValues: { sourceJobId: id, jobCode: job.jobCode },
    });
    return job;
  }

  async findAll(filter: JobFilterDto, actor?: AuthenticatedUser) {
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
    const scopedBranchId = getScopedBranchId(actor, branchId);
    if (scopedBranchId) qb.andWhere('j.branchId = :branchId', { branchId: scopedBranchId });
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

  async findOne(id: number, actor?: AuthenticatedUser) {
    const job = await this.repo.findOne({ where: { id } });
    if (!job || job.archivedAt) throw new NotFoundException('Job not found');
    this.enforceBranchAccess(actor, job.branchId);
    const [revenueEntries, costEntries, debitNoteCount, debitNoteLineCount] = await Promise.all([
      this.revenueRepo.find({ where: { jobId: id }, order: { createdAt: 'ASC' } }),
      this.costRepo.find({ where: { jobId: id }, order: { createdAt: 'ASC' } }),
      this.debitNoteRepo.count({ where: { jobId: id } }),
      this.debitNoteLineRepo.count({ where: { jobId: id } }),
    ]);

    const postedRevenue = revenueEntries.filter((entry) => entry.status === AccountingStatus.POSTED);
    const postedCost = costEntries.filter((entry) => entry.status === AccountingStatus.POSTED);
    const revenueTotal = postedRevenue.reduce((sum, entry) => sum + Number(entry.localAmount || entry.amount || 0), 0);
    const costTotal = postedCost.reduce((sum, entry) => sum + Number(entry.localAmount || entry.amount || 0), 0);
    const unpaidRevenueTotal = postedRevenue
      .filter((entry) => entry.paymentStatus !== PaymentStatus.PAID)
      .reduce((sum, entry) => sum + Number(entry.localAmount || entry.amount || 0), 0);
    const paymentStatus =
      postedRevenue.length === 0
        ? PaymentStatus.UNPAID
        : unpaidRevenueTotal <= 0
          ? PaymentStatus.PAID
          : unpaidRevenueTotal < revenueTotal
            ? PaymentStatus.PARTIAL
            : PaymentStatus.UNPAID;

    return {
      ...job,
      revenueEntries,
      costEntries,
      profitSummary: {
        revenue: revenueTotal,
        cost: costTotal,
        profit: revenueTotal - costTotal,
        status: revenueTotal - costTotal >= 0 ? 'PROFIT' : 'LOSS',
      },
      paymentSummary: {
        status: paymentStatus,
        revenueTotal,
        unpaidRevenueTotal,
      },
      debitNoteSummary: {
        count: debitNoteCount + debitNoteLineCount,
      },
    };
  }

  async update(id: number, dto: UpdateJobDto, actorId: number, actor?: AuthenticatedUser) {
    const job = await this.findOne(id, actor);
    if (job.status === JobStatus.CLOSED || job.status === JobStatus.CANCELLED) {
      throw new BadRequestException('Cannot edit a CLOSED or CANCELLED job');
    }
    const documentSummary = await this.getJobDocumentSummary(id);
    const admin = this.isAdmin(actor);

    if (documentSummary.hasAccountingDocuments) {
      throw new BadRequestException('This job already has receipt/payment documents and cannot be edited');
    }

    const willBeConfirmed = job.status === JobStatus.IN_PROGRESS || dto.status === JobStatus.IN_PROGRESS;

    if (job.status === JobStatus.IN_PROGRESS && !admin) {
      throw new ForbiddenException('Only admin can edit a confirmed job');
    }

    if (willBeConfirmed && documentSummary.hasDebitNotes) {
      if (!admin) {
        throw new ForbiddenException('Only admin can edit a confirmed job that already has debit notes');
      }
      if (!dto.confirmDebitNoteLock) {
        throw new BadRequestException('Editing this confirmed job will lock existing debit notes. Please confirm before saving');
      }
      await this.lockDebitNotesForJob(id, actorId, 'Locked because the confirmed job was edited after debit note creation');
    }

    this.enforceBranchAccess(actor, dto.branchId ?? job.branchId);
    await this.validateRefs(dto);
    await this.ensureDebtLimit({
      partnerId: dto.partnerId ?? job.partnerId,
      debtAmount: dto.debtAmount ?? job.debtAmount,
      jobId: id,
      createdAt: job.createdAt,
    });
    const oldValues = { jobCode: job.jobCode, partnerId: job.partnerId, branchId: job.branchId, status: job.status };
    const { confirmDebitNoteLock, ...updateValues } = dto;
    const updated = await this.repo.save({ ...job, ...updateValues, updatedBy: actorId });
    await this.refreshActualDebtForPartners([job.partnerId, updated.partnerId]);
    this.auditLogs.logAsync({
      entityName: 'Job',
      entityId: id,
      action: 'UPDATE',
      userId: actorId,
      oldValues,
      newValues: { jobCode: updated.jobCode, partnerId: updated.partnerId, branchId: updated.branchId, status: updated.status },
    });
    return updated;
  }

  async archive(id: number, actorId: number, actor?: AuthenticatedUser) {
    const job = await this.findOne(id, actor);
    const documentSummary = await this.getJobDocumentSummary(id);
    if (documentSummary.hasDebitNotes || documentSummary.hasAccountingDocuments || Number(job.debtAmount || 0) > 0) {
      throw new BadRequestException('Cannot delete/archive a job that already has debit notes, debt, or accounting documents');
    }
    const updated = await this.repo.save({ ...job, archivedAt: new Date(), archivedBy: actorId, updatedBy: actorId });
    await this.customerDebtService.refreshPartnerActualDebt(job.partnerId);
    this.auditLogs.logAsync({
      entityName: 'Job',
      entityId: id,
      action: 'ARCHIVE',
      userId: actorId,
      oldValues: { archivedAt: job.archivedAt },
      newValues: { archivedAt: updated.archivedAt, archivedBy: actorId },
    });
    return { message: 'Job archived' };
  }

  async updateStatus(id: number, status: JobStatus, actorId: number, actor?: AuthenticatedUser) {
    const job = await this.findOne(id, actor);
    if (job.status === JobStatus.CLOSED || job.status === JobStatus.CANCELLED) {
      throw new BadRequestException('Job is already finalized');
    }
    if (status === JobStatus.IN_PROGRESS && job.status !== JobStatus.DRAFT && !this.isAdmin(actor)) {
      throw new ForbiddenException('Only admin can update a confirmed job status');
    }
    const oldStatus = job.status;
    const update: Partial<Job> = { status, updatedBy: actorId };
    if (status === JobStatus.CLOSED) {
      update.closedAt = new Date();
      update.closedBy = actorId;
    }
    const updated = await this.repo.save({ ...job, ...update });
    await this.customerDebtService.refreshPartnerActualDebt(job.partnerId);
    this.auditLogs.logAsync({
      entityName: 'Job',
      entityId: id,
      action: 'STATUS_CHANGE',
      userId: actorId,
      oldValues: { status: oldStatus },
      newValues: { status },
    });
    return updated;
  }

  async getMilestones(jobId: number, actor?: AuthenticatedUser) {
    await this.findOne(jobId, actor);
    return this.milestoneRepo.find({ where: { jobId }, order: { sortOrder: 'ASC', createdAt: 'ASC' } });
  }

  async addMilestone(jobId: number, dto: CreateMilestoneDto, actorId: number, actor?: AuthenticatedUser) {
    await this.findOne(jobId, actor);
    const milestone = await this.milestoneRepo.save(
      this.milestoneRepo.create({ ...dto, jobId, createdBy: actorId, updatedBy: actorId }),
    );
    this.auditLogs.logAsync({
      entityName: 'JobMilestone',
      entityId: milestone.id,
      action: 'CREATE',
      userId: actorId,
      newValues: { jobId, title: milestone.title },
    });
    return milestone;
  }

  async updateMilestone(jobId: number, milestoneId: number, dto: UpdateMilestoneDto, actorId: number, actor?: AuthenticatedUser) {
    await this.findOne(jobId, actor);
    const milestone = await this.milestoneRepo.findOne({ where: { id: milestoneId, jobId } });
    if (!milestone) throw new NotFoundException('Milestone not found');
    const updated = await this.milestoneRepo.save({ ...milestone, ...dto, updatedBy: actorId });
    this.auditLogs.logAsync({
      entityName: 'JobMilestone',
      entityId: milestoneId,
      action: 'UPDATE',
      userId: actorId,
      oldValues: { title: milestone.title, milestoneAt: milestone.milestoneAt },
      newValues: { title: updated.title, milestoneAt: updated.milestoneAt },
    });
    return updated;
  }

  async deleteMilestone(jobId: number, milestoneId: number, actorId: number, actor?: AuthenticatedUser) {
    await this.findOne(jobId, actor);
    const milestone = await this.milestoneRepo.findOne({ where: { id: milestoneId, jobId } });
    if (!milestone) throw new NotFoundException('Milestone not found');
    await this.milestoneRepo.remove(milestone);
    this.auditLogs.logAsync({
      entityName: 'JobMilestone',
      entityId: milestoneId,
      action: 'DELETE',
      userId: actorId,
      oldValues: { jobId, title: milestone.title },
    });
    return { message: 'Milestone deleted' };
  }

  async previewDebt(dto: JobDebtPreviewDto) {
    return this.customerDebtService.previewActualDebt({
      partnerId: dto.partnerId,
      currentJobId: dto.jobId,
      currentJobDebtAmount: dto.debtAmount,
    });
  }

  private async ensureDebtLimit(params: {
    partnerId?: number;
    debtAmount?: number | null;
    jobId?: number;
    createdAt?: Date | string | null;
  }) {
    const preview = await this.customerDebtService.previewActualDebt({
      partnerId: params.partnerId,
      currentJobId: params.jobId,
      currentJobDebtAmount: params.debtAmount,
      currentJobCreatedAt: params.createdAt,
    });

    if (preview.exceedsLimit) {
      throw new BadRequestException('Customer exceeds configured debt limit');
    }
  }

  private async refreshActualDebtForPartners(partnerIds: Array<number | undefined | null>) {
    const uniquePartnerIds = [...new Set(partnerIds.filter(Boolean))] as number[];
    await Promise.all(uniquePartnerIds.map((partnerId) => this.customerDebtService.refreshPartnerActualDebt(partnerId)));
  }
}

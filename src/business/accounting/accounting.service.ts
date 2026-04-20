import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { RevenueEntry, AccountingStatus } from '../../models/revenue-entry.entity';
import { CostEntry } from '../../models/cost-entry.entity';
import { Job, JobStatus } from '../../models/job.entity';
import { CreateEntryDto, UpdateEntryDto } from './dto/entry.dto';
import { AuditLogsService } from '../audit-logs/audit-logs.service';

@Injectable()
export class AccountingService {
  constructor(
    @InjectRepository(RevenueEntry) private revRepo: Repository<RevenueEntry>,
    @InjectRepository(CostEntry) private costRepo: Repository<CostEntry>,
    @InjectRepository(Job) private jobRepo: Repository<Job>,
    private dataSource: DataSource,
    private auditLogs: AuditLogsService,
  ) {}

  // ─── helpers ───────────────────────────────────────────────────────────────

  private async assertJobExists(jobId: number): Promise<Job> {
    const job = await this.jobRepo.findOne({ where: { id: jobId } });
    if (!job) throw new NotFoundException(`Job #${jobId} not found`);
    return job;
  }

  private assertJobPostable(job: Job): void {
    if (job.status === JobStatus.CANCELLED) {
      throw new BadRequestException('Cannot post entries for a CANCELLED job');
    }
  }

  // ─── Revenue CRUD ──────────────────────────────────────────────────────────

  async createRevenue(dto: CreateEntryDto, actorId: number) {
    await this.assertJobExists(dto.jobId);
    return this.revRepo.save(
      this.revRepo.create({ ...dto, createdBy: actorId, updatedBy: actorId }),
    );
  }

  findRevenueByJob(jobId: number) {
    return this.revRepo.find({ where: { jobId }, order: { createdAt: 'ASC' } });
  }

  async updateRevenue(id: number, dto: UpdateEntryDto, actorId: number) {
    const entry = await this.revRepo.findOne({ where: { id } });
    if (!entry) throw new NotFoundException('Revenue entry not found');
    if (entry.status === AccountingStatus.POSTED)
      throw new BadRequestException('Cannot modify a POSTED entry');
    return this.revRepo.save({ ...entry, ...dto, updatedBy: actorId });
  }

  async deleteRevenue(id: number) {
    const entry = await this.revRepo.findOne({ where: { id } });
    if (!entry) throw new NotFoundException('Revenue entry not found');
    if (entry.status === AccountingStatus.POSTED)
      throw new BadRequestException('Cannot delete a POSTED entry');
    await this.revRepo.remove(entry);
    return { message: 'Revenue entry deleted' };
  }

  /**
   * Post a single revenue entry inside a DB transaction.
   * Validates that the parent job is not CANCELLED.
   */
  async postRevenue(id: number, actorId: number) {
    const posted = await this.dataSource.transaction(async (em) => {
      const entry = await em.findOne(RevenueEntry, { where: { id } });
      if (!entry) throw new NotFoundException('Revenue entry not found');
      if (entry.status === AccountingStatus.POSTED)
        throw new BadRequestException('Already posted');

      const job = await em.findOne(Job, { where: { id: entry.jobId } });
      if (!job) throw new NotFoundException(`Job #${entry.jobId} not found`);
      this.assertJobPostable(job);

      return em.save(RevenueEntry, {
        ...entry,
        status: AccountingStatus.POSTED,
        postedAt: new Date(),
        postedBy: actorId,
        updatedBy: actorId,
      });
    });
    await this.auditLogs.log({
      entityName: 'RevenueEntry', entityId: id, action: 'POST_REVENUE', userId: actorId,
      newValues: { status: AccountingStatus.POSTED, jobId: posted.jobId },
    });
    return posted;
  }

  // ─── Cost CRUD ─────────────────────────────────────────────────────────────

  async createCost(dto: CreateEntryDto, actorId: number) {
    await this.assertJobExists(dto.jobId);
    return this.costRepo.save(
      this.costRepo.create({ ...dto, createdBy: actorId, updatedBy: actorId }),
    );
  }

  findCostByJob(jobId: number) {
    return this.costRepo.find({ where: { jobId }, order: { createdAt: 'ASC' } });
  }

  async updateCost(id: number, dto: UpdateEntryDto, actorId: number) {
    const entry = await this.costRepo.findOne({ where: { id } });
    if (!entry) throw new NotFoundException('Cost entry not found');
    if (entry.status === AccountingStatus.POSTED)
      throw new BadRequestException('Cannot modify a POSTED entry');
    return this.costRepo.save({ ...entry, ...dto, updatedBy: actorId });
  }

  async deleteCost(id: number) {
    const entry = await this.costRepo.findOne({ where: { id } });
    if (!entry) throw new NotFoundException('Cost entry not found');
    if (entry.status === AccountingStatus.POSTED)
      throw new BadRequestException('Cannot delete a POSTED entry');
    await this.costRepo.remove(entry);
    return { message: 'Cost entry deleted' };
  }

  /**
   * Post a single cost entry inside a DB transaction.
   */
  async postCost(id: number, actorId: number) {
    const posted = await this.dataSource.transaction(async (em) => {
      const entry = await em.findOne(CostEntry, { where: { id } });
      if (!entry) throw new NotFoundException('Cost entry not found');
      if (entry.status === AccountingStatus.POSTED)
        throw new BadRequestException('Already posted');

      const job = await em.findOne(Job, { where: { id: entry.jobId } });
      if (!job) throw new NotFoundException(`Job #${entry.jobId} not found`);
      this.assertJobPostable(job);

      return em.save(CostEntry, {
        ...entry,
        status: AccountingStatus.POSTED,
        postedAt: new Date(),
        postedBy: actorId,
        updatedBy: actorId,
      });
    });
    await this.auditLogs.log({
      entityName: 'CostEntry', entityId: id, action: 'POST_COST', userId: actorId,
      newValues: { status: AccountingStatus.POSTED, jobId: posted.jobId },
    });
    return posted;
  }

  /**
   * Atomically post ALL draft revenue AND cost entries for a job in one transaction.
   * If any entry fails validation the entire batch is rolled back.
   */
  async postAllForJob(jobId: number, actorId: number) {
    const result = await this.dataSource.transaction(async (em) => {
      const job = await em.findOne(Job, { where: { id: jobId } });
      if (!job) throw new NotFoundException(`Job #${jobId} not found`);
      this.assertJobPostable(job);

      const now = new Date();
      const baseUpdate = {
        status: AccountingStatus.POSTED,
        postedAt: now,
        postedBy: actorId,
        updatedBy: actorId,
      };

      const [draftRevenue, draftCost] = await Promise.all([
        em.find(RevenueEntry, {
          where: { jobId, status: AccountingStatus.DRAFT },
        }),
        em.find(CostEntry, {
          where: { jobId, status: AccountingStatus.DRAFT },
        }),
      ]);

      if (draftRevenue.length === 0 && draftCost.length === 0) {
        throw new BadRequestException('No DRAFT entries found for this job');
      }

      await Promise.all([
        em.save(
          RevenueEntry,
          draftRevenue.map((e) => ({ ...e, ...baseUpdate })),
        ),
        em.save(
          CostEntry,
          draftCost.map((e) => ({ ...e, ...baseUpdate })),
        ),
      ]);

      return {
        jobId,
        postedRevenue: draftRevenue.length,
        postedCost: draftCost.length,
        message: `Posted ${draftRevenue.length} revenue and ${draftCost.length} cost entries`,
      };
    });
    await this.auditLogs.log({
      entityName: 'Job', entityId: jobId, action: 'POST_ALL', userId: actorId,
      newValues: { postedRevenue: result.postedRevenue, postedCost: result.postedCost },
    });
    return result;
  }

  // ─── Profit Summary ────────────────────────────────────────────────────────

  async getProfitSummary(jobId: number) {
    await this.assertJobExists(jobId);
    const [revEntries, costEntries] = await Promise.all([
      this.revRepo.find({ where: { jobId, status: AccountingStatus.POSTED } }),
      this.costRepo.find({ where: { jobId, status: AccountingStatus.POSTED } }),
    ]);
    const totalRevenue = revEntries.reduce(
      (sum, e) => sum + Number(e.localAmount),
      0,
    );
    const totalCost = costEntries.reduce(
      (sum, e) => sum + Number(e.localAmount),
      0,
    );
    return {
      jobId,
      totalRevenue,
      totalCost,
      profit: totalRevenue - totalCost,
      revenueEntries: revEntries.length,
      costEntries: costEntries.length,
    };
  }
}
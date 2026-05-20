import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { PaymentRequest, PaymentRequestStatus } from '../../models/payment-request.entity';
import { Partner, PartnerType } from '../../models/partner.entity';
import { Job } from '../../models/job.entity';
import { CobEntry, CobStatus, CobType } from '../../models/cob-entry.entity';
import { AccountingStatus, PaymentStatus, RevenueEntry } from '../../models/revenue-entry.entity';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { paginate, getSkip } from '../../common/utils/pagination.util';
import { CreatePaymentRequestDto, PaymentRequestFilterDto } from './dto/payment-request.dto';
import { assertBranchAccess, AuthenticatedUser, canAccessAllBranches, getScopedBranchId } from '../../common/auth/branch-scope.util';

@Injectable()
export class PaymentRequestsService {
  constructor(
    @InjectRepository(PaymentRequest) private repo: Repository<PaymentRequest>,
    @InjectRepository(Partner) private partnerRepo: Repository<Partner>,
    @InjectRepository(Job) private jobRepo: Repository<Job>,
    private dataSource: DataSource,
    private auditLogs: AuditLogsService,
  ) {}

  private enforceBranchAccess(user: AuthenticatedUser | undefined, branchId?: number | null) {
    try {
      assertBranchAccess(user, branchId);
    } catch {
      throw new ForbiddenException('You cannot access payment requests from another branch');
    }
  }

  private resolveRequestBranch(dto: CreatePaymentRequestDto, job: Job | null, actor: AuthenticatedUser) {
    if (job?.branchId) {
      this.enforceBranchAccess(actor, job.branchId);
      if (dto.branchId && dto.branchId !== job.branchId) {
        throw new BadRequestException('Payment request branch must match the selected job branch');
      }
      return job.branchId;
    }

    if (dto.branchId) {
      this.enforceBranchAccess(actor, dto.branchId);
      return dto.branchId;
    }

    return canAccessAllBranches(actor) ? null : actor.branchId ?? null;
  }

  async create(dto: CreatePaymentRequestDto, actor: AuthenticatedUser) {
    await this.assertVendor(dto.vendorId);
    const job = dto.jobId ? await this.assertJob(dto.jobId) : null;
    const branchId = this.resolveRequestBranch(dto, job, actor);
    if (dto.isChargeOnBehalf) {
      if (!job) throw new BadRequestException('Job is required when marking a payment request as charge-on-behalf');
      if (!dto.chargeToPartnerId) throw new BadRequestException('Customer is required for charge-on-behalf');
      await this.assertCustomer(dto.chargeToPartnerId);
    }

    const result = await this.dataSource.transaction(async (em) => {
      const request = await em.save(
        PaymentRequest,
        em.create(PaymentRequest, {
          ...dto,
          branchId,
          isChargeOnBehalf: Boolean(dto.isChargeOnBehalf),
          chargeToPartnerId: dto.isChargeOnBehalf ? dto.chargeToPartnerId : null,
          status: PaymentRequestStatus.PENDING_DEPARTMENT_APPROVAL,
          createdBy: actor.id,
          updatedBy: actor.id,
        }),
      );

      if (!dto.isChargeOnBehalf || !dto.jobId || !dto.chargeToPartnerId) {
        return { request };
      }

      const cobEntry = await em.save(
        CobEntry,
        em.create(CobEntry, {
          type: CobType.CHARGE_ON_BEHALF,
          partnerId: dto.chargeToPartnerId,
          vendorId: dto.vendorId,
          jobId: dto.jobId,
          currency: dto.currency || 'VND',
          amount: dto.amount,
          description: `Charge-on-behalf from payment request #${request.id}: ${dto.reason || ''}`,
          status: CobStatus.OPEN,
          createdBy: actor.id,
          updatedBy: actor.id,
        }),
      );

      const receivable = await em.save(
        RevenueEntry,
        em.create(RevenueEntry, {
          jobId: dto.jobId,
          description: `Receivable from COB #${cobEntry.id}: ${dto.reason || ''}`,
          currency: dto.currency || 'VND',
          amount: dto.amount,
          exchangeRate: 1,
          localAmount: dto.amount,
          status: AccountingStatus.POSTED,
          paymentStatus: PaymentStatus.UNPAID,
          postedAt: new Date(),
          postedBy: actor.id,
          createdBy: actor.id,
          updatedBy: actor.id,
        }),
      );

      cobEntry.receivableEntryId = receivable.id;
      await em.save(CobEntry, cobEntry);

      request.cobEntryId = cobEntry.id;
      request.receivableEntryId = receivable.id;
      await em.save(PaymentRequest, request);

      return { request, cobEntry, receivable };
    });

    const request = result.request;
    this.auditLogs.logAsync({
      entityName: 'PaymentRequest',
      entityId: request.id,
      action: 'CREATE',
      userId: actor.id,
      newValues: {
        branchId: request.branchId,
        vendorId: request.vendorId,
        amount: request.amount,
        status: request.status,
        isChargeOnBehalf: request.isChargeOnBehalf,
        cobEntryId: request.cobEntryId,
        receivableEntryId: request.receivableEntryId,
      },
    });
    if (result.cobEntry && result.receivable) {
      this.auditLogs.logAsync({
        entityName: 'CobEntry',
        entityId: result.cobEntry.id,
        action: 'CREATE_COB_FROM_PAYMENT_REQUEST',
        userId: actor.id,
        newValues: {
          paymentRequestId: request.id,
          jobId: request.jobId,
          partnerId: request.chargeToPartnerId,
          receivableId: result.receivable.id,
        },
      });
    }
    return request;
  }

  async findAll(filter: PaymentRequestFilterDto = {}, actor?: AuthenticatedUser) {
    const { page = 1, limit = 20, branchId, jobId, vendorId, status } = filter;
    const scopedBranchId = getScopedBranchId(actor, branchId);
    const qb = this.repo.createQueryBuilder('pr');
    if (scopedBranchId) qb.andWhere('pr.branchId = :branchId', { branchId: scopedBranchId });
    if (jobId) qb.andWhere('pr.jobId = :jobId', { jobId });
    if (vendorId) qb.andWhere('pr.vendorId = :vendorId', { vendorId });
    if (status) qb.andWhere('pr.status = :status', { status });
    qb.orderBy('pr.createdAt', 'DESC').skip(getSkip(page, limit)).take(limit);
    return paginate(await qb.getManyAndCount(), page, limit);
  }

  async findOne(id: number, actor?: AuthenticatedUser) {
    const request = await this.repo.findOne({ where: { id } });
    if (!request) throw new NotFoundException('Payment request not found');
    this.enforceBranchAccess(actor, request.branchId);
    return request;
  }

  async approve(id: number, actor: AuthenticatedUser) {
    const request = await this.transition(id, actor, PaymentRequestStatus.DEPARTMENT_APPROVED, (current) => {
      if (current.status !== PaymentRequestStatus.PENDING_DEPARTMENT_APPROVAL) {
        throw new BadRequestException('Only pending payment requests can be approved');
      }
      return {
        status: PaymentRequestStatus.DEPARTMENT_APPROVED,
        departmentApprovedAt: new Date(),
        departmentApprovedBy: actor.id,
      };
    });
    this.auditLogs.logAsync({
      entityName: 'PaymentRequest',
      entityId: id,
      action: 'DEPARTMENT_APPROVE',
      userId: actor.id,
      newValues: { branchId: request.branchId, status: request.status },
    });
    return request;
  }

  async finalApprove(id: number, actor: AuthenticatedUser) {
    const request = await this.transition(id, actor, PaymentRequestStatus.FINAL_APPROVED, (current) => {
      if (current.status !== PaymentRequestStatus.DEPARTMENT_APPROVED) {
        throw new BadRequestException('Payment request must be department-approved first');
      }
      return {
        status: PaymentRequestStatus.FINAL_APPROVED,
        finalApprovedAt: new Date(),
        finalApprovedBy: actor.id,
      };
    });
    this.auditLogs.logAsync({
      entityName: 'PaymentRequest',
      entityId: id,
      action: 'FINAL_APPROVE',
      userId: actor.id,
      newValues: { branchId: request.branchId, status: request.status },
    });
    return request;
  }

  async reject(id: number, reason: string, actor: AuthenticatedUser) {
    const request = await this.transition(id, actor, PaymentRequestStatus.REJECTED, (current) => {
      if ([PaymentRequestStatus.REJECTED, PaymentRequestStatus.FINAL_APPROVED].includes(current.status)) {
        throw new BadRequestException('Payment request is already finalized');
      }
      return {
        status: PaymentRequestStatus.REJECTED,
        rejectedAt: new Date(),
        rejectedBy: actor.id,
        rejectReason: reason,
      };
    });
    this.auditLogs.logAsync({
      entityName: 'PaymentRequest',
      entityId: id,
      action: 'REJECT',
      userId: actor.id,
      newValues: { branchId: request.branchId, status: request.status, reason },
    });
    return request;
  }

  private async transition(
    id: number,
    actor: AuthenticatedUser,
    expectedStatus: PaymentRequestStatus,
    patch: (request: PaymentRequest) => Partial<PaymentRequest>,
  ) {
    return this.dataSource.transaction(async (em) => {
      const current = await em.findOne(PaymentRequest, { where: { id } });
      if (!current) throw new NotFoundException('Payment request not found');
      this.enforceBranchAccess(actor, current.branchId);
      const next = await em.save(PaymentRequest, { ...current, ...patch(current), updatedBy: actor.id });
      if (next.status !== expectedStatus) throw new BadRequestException('Invalid payment request transition');
      return next;
    });
  }

  private async assertVendor(vendorId: number) {
    const vendor = await this.partnerRepo.findOne({ where: { id: vendorId, isActive: true } });
    if (!vendor || ![PartnerType.VENDOR, PartnerType.BOTH].includes(vendor.partnerType)) {
      throw new BadRequestException(`Vendor #${vendorId} not found`);
    }
  }

  private async assertCustomer(partnerId: number) {
    const partner = await this.partnerRepo.findOne({ where: { id: partnerId, isActive: true } });
    if (!partner || ![PartnerType.CUSTOMER, PartnerType.BOTH].includes(partner.partnerType)) {
      throw new BadRequestException(`Customer #${partnerId} not found`);
    }
  }

  private async assertJob(jobId: number): Promise<Job> {
    const job = await this.jobRepo.findOne({ where: { id: jobId } });
    if (!job || job.archivedAt) throw new BadRequestException(`Job #${jobId} not found`);
    return job;
  }
}

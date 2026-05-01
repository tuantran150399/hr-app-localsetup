import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { PaymentRequest, PaymentRequestStatus } from '../../models/payment-request.entity';
import { Partner, PartnerType } from '../../models/partner.entity';
import { Job } from '../../models/job.entity';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { paginate, getSkip } from '../../common/utils/pagination.util';
import { CreatePaymentRequestDto, PaymentRequestFilterDto } from './dto/payment-request.dto';

@Injectable()
export class PaymentRequestsService {
  constructor(
    @InjectRepository(PaymentRequest) private repo: Repository<PaymentRequest>,
    @InjectRepository(Partner) private partnerRepo: Repository<Partner>,
    @InjectRepository(Job) private jobRepo: Repository<Job>,
    private dataSource: DataSource,
    private auditLogs: AuditLogsService,
  ) {}

  async create(dto: CreatePaymentRequestDto, actorId: number) {
    await this.assertVendor(dto.vendorId);
    if (dto.jobId) await this.assertJob(dto.jobId);

    const request = await this.repo.save(
      this.repo.create({
        ...dto,
        status: PaymentRequestStatus.PENDING_DEPARTMENT_APPROVAL,
        createdBy: actorId,
        updatedBy: actorId,
      }),
    );
    await this.auditLogs.log({
      entityName: 'PaymentRequest',
      entityId: request.id,
      action: 'CREATE',
      userId: actorId,
      newValues: { vendorId: request.vendorId, amount: request.amount, status: request.status },
    });
    return request;
  }

  async findAll(filter: PaymentRequestFilterDto = {}) {
    const { page = 1, limit = 20, jobId, vendorId, status } = filter;
    const qb = this.repo.createQueryBuilder('pr');
    if (jobId) qb.andWhere('pr.jobId = :jobId', { jobId });
    if (vendorId) qb.andWhere('pr.vendorId = :vendorId', { vendorId });
    if (status) qb.andWhere('pr.status = :status', { status });
    qb.orderBy('pr.createdAt', 'DESC').skip(getSkip(page, limit)).take(limit);
    return paginate(await qb.getManyAndCount(), page, limit);
  }

  async findOne(id: number) {
    const request = await this.repo.findOne({ where: { id } });
    if (!request) throw new NotFoundException('Payment request not found');
    return request;
  }

  async approve(id: number, actorId: number) {
    const request = await this.transition(id, actorId, PaymentRequestStatus.DEPARTMENT_APPROVED, (current) => {
      if (current.status !== PaymentRequestStatus.PENDING_DEPARTMENT_APPROVAL) {
        throw new BadRequestException('Only pending payment requests can be approved');
      }
      return {
        status: PaymentRequestStatus.DEPARTMENT_APPROVED,
        departmentApprovedAt: new Date(),
        departmentApprovedBy: actorId,
      };
    });
    await this.auditLogs.log({
      entityName: 'PaymentRequest',
      entityId: id,
      action: 'DEPARTMENT_APPROVE',
      userId: actorId,
      newValues: { status: request.status },
    });
    return request;
  }

  async finalApprove(id: number, actorId: number) {
    const request = await this.transition(id, actorId, PaymentRequestStatus.FINAL_APPROVED, (current) => {
      if (current.status !== PaymentRequestStatus.DEPARTMENT_APPROVED) {
        throw new BadRequestException('Payment request must be department-approved first');
      }
      return {
        status: PaymentRequestStatus.FINAL_APPROVED,
        finalApprovedAt: new Date(),
        finalApprovedBy: actorId,
      };
    });
    await this.auditLogs.log({
      entityName: 'PaymentRequest',
      entityId: id,
      action: 'FINAL_APPROVE',
      userId: actorId,
      newValues: { status: request.status },
    });
    return request;
  }

  async reject(id: number, reason: string, actorId: number) {
    const request = await this.transition(id, actorId, PaymentRequestStatus.REJECTED, (current) => {
      if ([PaymentRequestStatus.REJECTED, PaymentRequestStatus.FINAL_APPROVED].includes(current.status)) {
        throw new BadRequestException('Payment request is already finalized');
      }
      return {
        status: PaymentRequestStatus.REJECTED,
        rejectedAt: new Date(),
        rejectedBy: actorId,
        rejectReason: reason,
      };
    });
    await this.auditLogs.log({
      entityName: 'PaymentRequest',
      entityId: id,
      action: 'REJECT',
      userId: actorId,
      newValues: { status: request.status, reason },
    });
    return request;
  }

  private async transition(
    id: number,
    actorId: number,
    expectedStatus: PaymentRequestStatus,
    patch: (request: PaymentRequest) => Partial<PaymentRequest>,
  ) {
    return this.dataSource.transaction(async (em) => {
      const current = await em.findOne(PaymentRequest, { where: { id } });
      if (!current) throw new NotFoundException('Payment request not found');
      const next = await em.save(PaymentRequest, { ...current, ...patch(current), updatedBy: actorId });
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

  private async assertJob(jobId: number) {
    const job = await this.jobRepo.findOne({ where: { id: jobId } });
    if (!job || job.archivedAt) throw new BadRequestException(`Job #${jobId} not found`);
  }
}

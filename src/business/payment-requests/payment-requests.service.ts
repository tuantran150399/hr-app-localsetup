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
import { NotificationsService } from '../notifications/notifications.service';
import { User } from '../../models/user.entity';
import { Employee, EmployeeStatus } from '../../models/employee.entity';

export interface WorkflowRequestContext {
  ipAddress?: string;
  userAgent?: string;
}

@Injectable()
export class PaymentRequestsService {
  constructor(
    @InjectRepository(PaymentRequest) private repo: Repository<PaymentRequest>,
    @InjectRepository(Partner) private partnerRepo: Repository<Partner>,
    @InjectRepository(Job) private jobRepo: Repository<Job>,
    @InjectRepository(User) private userRepo: Repository<User>,
    @InjectRepository(Employee) private employeeRepo: Repository<Employee>,
    private dataSource: DataSource,
    private auditLogs: AuditLogsService,
    private notifications: NotificationsService,
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

  async create(dto: CreatePaymentRequestDto, actor: AuthenticatedUser, context: WorkflowRequestContext = {}) {
    await this.assertVendor(dto.vendorId);
    const job = dto.jobId ? await this.assertJob(dto.jobId) : null;
    const branchId = this.resolveRequestBranch(dto, job, actor);
    const employee = await this.employeeRepo.findOne({
      where: { userId: actor.id, status: EmployeeStatus.ACTIVE },
    });
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
          requestDepartment: employee?.department ?? null,
          isChargeOnBehalf: Boolean(dto.isChargeOnBehalf),
          chargeToPartnerId: dto.isChargeOnBehalf ? dto.chargeToPartnerId : null,
          status: PaymentRequestStatus.PENDING_DEPARTMENT_APPROVAL,
          createdBy: actor.id,
          updatedBy: actor.id,
        }),
      );

      request.requestCode = `PR-${new Date().getFullYear()}-${String(request.id).padStart(5, '0')}`;
      await em.save(PaymentRequest, request);

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
    const audit = await this.auditLogs.log({
      entityName: 'PaymentRequest',
      entityId: request.id,
      action: 'PAYMENT_REQUEST_CREATED',
      userId: actor.id,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      oldValues: { status: null },
      newValues: {
        branchId: request.branchId,
        requestCode: request.requestCode,
        vendorId: request.vendorId,
        amount: request.amount,
        status: request.status,
        isChargeOnBehalf: request.isChargeOnBehalf,
        cobEntryId: request.cobEntryId,
        receivableEntryId: request.receivableEntryId,
        description: request.reason,
        actor: { username: actor.username, roles: actor.roles, department: request.requestDepartment },
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
    const departmentApprovers = await this.findApprovers(
      'payment-request:department-approve',
      request.branchId,
      request.requestDepartment,
    );
    await this.notifyUsers(departmentApprovers, {
      type: 'PAYMENT_REQUEST_PENDING_DEPARTMENT',
      title: 'Yêu cầu duyệt chi mới cần xem xét',
      message: `${actor.username || 'Nhân viên'} đã tạo đề nghị ${request.requestCode} trị giá ${request.amount} ${request.currency}. ${request.reason || ''}`,
      entityType: 'PAYMENT_REQUEST',
      entityId: request.id,
      eventRef: `LOG-${audit.id}`,
      actionUrl: `/payment-requests?requestId=${request.id}`,
      actionLabel: 'Xem & Duyệt',
      priority: 'normal',
    });
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

  async approve(id: number, comment: string | undefined, actor: AuthenticatedUser, context: WorkflowRequestContext = {}) {
    let durationMinutes = 0;
    const request = await this.transition(id, actor, PaymentRequestStatus.DEPARTMENT_APPROVED, (current) => {
      if (current.status !== PaymentRequestStatus.PENDING_DEPARTMENT_APPROVAL) {
        throw new BadRequestException('Only pending payment requests can be approved');
      }
      durationMinutes = this.durationMinutes(current.updatedAt || current.createdAt);
      return {
        status: PaymentRequestStatus.DEPARTMENT_APPROVED,
        departmentApprovedAt: new Date(),
        departmentApprovedBy: actor.id,
        departmentApprovalComment: comment,
      };
    });
    const audit = await this.auditLogs.log({
      entityName: 'PaymentRequest',
      entityId: id,
      action: 'DEPARTMENT_APPROVED',
      userId: actor.id,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      oldValues: { status: PaymentRequestStatus.PENDING_DEPARTMENT_APPROVAL },
      newValues: { branchId: request.branchId, status: request.status, comment, durationMinutes },
    });
    const finalApprovers = await this.findApprovers('payment-request:final-approve', request.branchId);
    await this.notifyUsers(finalApprovers, {
      type: 'PAYMENT_REQUEST_PENDING_FINAL',
      title: 'Yêu cầu duyệt chi chờ phê duyệt cuối',
      message: `${actor.username || 'Trưởng bộ phận'} đã duyệt đề nghị ${request.requestCode} — ${request.amount} ${request.currency}.`,
      entityType: 'PAYMENT_REQUEST', entityId: request.id,
      eventRef: `LOG-${audit.id}`,
      actionUrl: `/payment-requests?requestId=${request.id}`,
      actionLabel: 'Xem & Duyệt',
    });
    return request;
  }

  async finalApprove(id: number, comment: string | undefined, actor: AuthenticatedUser, context: WorkflowRequestContext = {}) {
    let durationMinutes = 0;
    const request = await this.transition(id, actor, PaymentRequestStatus.FINAL_APPROVED, (current) => {
      if (current.status !== PaymentRequestStatus.DEPARTMENT_APPROVED) {
        throw new BadRequestException('Payment request must be department-approved first');
      }
      durationMinutes = this.durationMinutes(current.updatedAt || current.createdAt);
      return {
        status: PaymentRequestStatus.FINAL_APPROVED,
        finalApprovedAt: new Date(),
        finalApprovedBy: actor.id,
        finalApprovalComment: comment,
      };
    });
    const audit = await this.auditLogs.log({
      entityName: 'PaymentRequest',
      entityId: id,
      action: 'DIRECTOR_APPROVED',
      userId: actor.id,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      oldValues: { status: PaymentRequestStatus.DEPARTMENT_APPROVED },
      newValues: { branchId: request.branchId, status: request.status, comment, durationMinutes, finalApproval: true },
    });
    const accountants = await this.findApprovers('payment-request:mark-paid', request.branchId);
    await this.notifyUsers([request.createdBy, ...accountants], {
      type: 'PAYMENT_REQUEST_FINAL_APPROVED',
      title: 'Đề nghị thanh toán đã được phê duyệt',
      message: `Đề nghị ${request.requestCode} — ${request.amount} ${request.currency} đã được Ban Giám đốc phê duyệt. Kế toán vui lòng tiến hành thanh toán.`,
      entityType: 'PAYMENT_REQUEST', entityId: request.id,
      eventRef: `LOG-${audit.id}`,
      actionUrl: `/payment-requests?requestId=${request.id}`,
      actionLabel: 'Xác nhận đã thanh toán',
      priority: 'high',
    });
    return request;
  }

  async reject(id: number, reason: string, actor: AuthenticatedUser, context: WorkflowRequestContext = {}) {
    let rejectedFromStatus: PaymentRequestStatus;
    let durationMinutes = 0;
    const request = await this.transition(id, actor, [PaymentRequestStatus.REJECTED_BY_DEPARTMENT, PaymentRequestStatus.REJECTED_BY_DIRECTOR], (current) => {
      if (![PaymentRequestStatus.PENDING_DEPARTMENT_APPROVAL, PaymentRequestStatus.DEPARTMENT_APPROVED].includes(current.status)) {
        throw new BadRequestException('Payment request is already finalized');
      }
      rejectedFromStatus = current.status;
      durationMinutes = this.durationMinutes(current.updatedAt || current.createdAt);
      const requiredPermission = current.status === PaymentRequestStatus.PENDING_DEPARTMENT_APPROVAL
        ? 'payment-request:department-approve'
        : 'payment-request:final-approve';
      this.assertPermission(actor, requiredPermission);
      return {
        status: current.status === PaymentRequestStatus.PENDING_DEPARTMENT_APPROVAL
          ? PaymentRequestStatus.REJECTED_BY_DEPARTMENT
          : PaymentRequestStatus.REJECTED_BY_DIRECTOR,
        rejectedAt: new Date(),
        rejectedBy: actor.id,
        rejectReason: reason,
      };
    });
    const audit = await this.auditLogs.log({
      entityName: 'PaymentRequest',
      entityId: id,
      action: rejectedFromStatus === PaymentRequestStatus.PENDING_DEPARTMENT_APPROVAL
        ? 'DEPARTMENT_REJECTED'
        : 'DIRECTOR_REJECTED',
      userId: actor.id,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      oldValues: { status: rejectedFromStatus },
      newValues: { branchId: request.branchId, status: request.status, rejectReason: reason, durationMinutes },
    });
    const recipients = rejectedFromStatus === PaymentRequestStatus.DEPARTMENT_APPROVED
      ? [request.createdBy, request.departmentApprovedBy]
      : [request.createdBy];
    await this.notifyUsers(recipients, {
      type: 'PAYMENT_REQUEST_REJECTED',
      title: rejectedFromStatus === PaymentRequestStatus.DEPARTMENT_APPROVED
        ? 'Đề nghị thanh toán không được phê duyệt'
        : 'Đề nghị thanh toán bị từ chối',
      message: `Đề nghị ${request.requestCode} bị ${rejectedFromStatus === PaymentRequestStatus.DEPARTMENT_APPROVED ? 'Ban Giám đốc' : 'Trưởng bộ phận'} từ chối. Lý do: ${reason}`,
      entityType: 'PAYMENT_REQUEST', entityId: request.id,
      eventRef: `LOG-${audit.id}`,
      actionUrl: `/payment-requests?requestId=${request.id}`,
      actionLabel: 'Xem chi tiết',
      priority: 'high',
    });
    return request;
  }

  async markPaid(id: number, actor: AuthenticatedUser, context: WorkflowRequestContext = {}) {
    const request = await this.transition(id, actor, PaymentRequestStatus.PAID, (current) => {
      if (current.status !== PaymentRequestStatus.FINAL_APPROVED) {
        throw new BadRequestException('Only finally-approved payment requests can be marked as paid');
      }
      return { status: PaymentRequestStatus.PAID, paidAt: new Date(), paidBy: actor.id };
    });
    const audit = await this.auditLogs.log({
      entityName: 'PaymentRequest', entityId: id, action: 'PAYMENT_REQUEST_PAID', userId: actor.id,
      ipAddress: context.ipAddress, userAgent: context.userAgent,
      oldValues: { status: PaymentRequestStatus.FINAL_APPROVED },
      newValues: { status: PaymentRequestStatus.PAID },
    });
    await this.notifyUsers([request.createdBy, request.departmentApprovedBy, request.finalApprovedBy], {
      type: 'PAYMENT_REQUEST_PAID', title: 'Đề nghị thanh toán đã được chi trả',
      message: `Kế toán đã xác nhận thanh toán đề nghị ${request.requestCode}.`,
      entityType: 'PAYMENT_REQUEST', entityId: request.id, eventRef: `LOG-${audit.id}`,
      actionUrl: `/payment-requests?requestId=${request.id}`, actionLabel: 'Xem chi tiết',
    });
    return request;
  }

  private durationMinutes(since?: Date | string | null) {
    if (!since) return 0;
    return Math.max(0, Math.round((Date.now() - new Date(since).getTime()) / 60000));
  }

  private assertPermission(actor: AuthenticatedUser, permission: string) {
    if (actor.permissions?.includes('*') || actor.permissions?.includes(permission)) return;
    throw new ForbiddenException('You are not allowed to perform this approval step');
  }

  private async findApprovers(permission: string, branchId?: number | null, department?: string | null) {
    const buildQuery = (strictDepartment: boolean) => {
      const qb = this.userRepo.createQueryBuilder('u')
        .innerJoin('u.roles', 'role')
        .innerJoin('role.permissions', 'permission')
        .where('u.isActive = :active', { active: true })
        .andWhere('permission.name = :permission', { permission });
      if (branchId) {
        qb.andWhere('(u.canAccessAllBranches = :global OR u.branchId IS NULL OR u.branchId = :branchId)', {
          global: true, branchId,
        });
      }
      if (strictDepartment && department) {
        qb.innerJoin(Employee, 'employee', 'employee.userId = u.id')
          .andWhere('employee.status = :employeeStatus', { employeeStatus: EmployeeStatus.ACTIVE })
          .andWhere('employee.department = :department', { department });
      }
      return qb.distinct(true).getMany();
    };

    let users = await buildQuery(Boolean(department));
    if (!users.length && department) users = await buildQuery(false);
    return users.map((user) => user.id);
  }

  private notifyUsers(userIds: Array<number | null | undefined>, data: Parameters<NotificationsService['notifyMany']>[1]) {
    const uniqueIds = [...new Set(userIds.filter((id): id is number => Boolean(id)))];
    return uniqueIds.length ? this.notifications.notifyMany(uniqueIds, data) : Promise.resolve([]);
  }

  private async transition(
    id: number,
    actor: AuthenticatedUser,
    expectedStatus: PaymentRequestStatus | PaymentRequestStatus[],
    patch: (request: PaymentRequest) => Partial<PaymentRequest>,
  ) {
    return this.dataSource.transaction(async (em) => {
      const current = await em.findOne(PaymentRequest, { where: { id } });
      if (!current) throw new NotFoundException('Payment request not found');
      this.enforceBranchAccess(actor, current.branchId);
      const next = await em.save(PaymentRequest, { ...current, ...patch(current), updatedBy: actor.id });
      const allowedStatuses = Array.isArray(expectedStatus) ? expectedStatus : [expectedStatus];
      if (!allowedStatuses.includes(next.status)) throw new BadRequestException('Invalid payment request transition');
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

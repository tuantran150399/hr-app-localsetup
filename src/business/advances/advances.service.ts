import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Employee, EmployeeStatus } from '../../models/employee.entity';
import { EmployeeAdvance, AdvanceStatus } from '../../models/employee-advance.entity';
import { Job } from '../../models/job.entity';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { paginate, getSkip } from '../../common/utils/pagination.util';
import { AdvanceFilterDto, CreateAdvanceDto, RejectAdvanceDto, SettleAdvanceDto } from './dto/advance.dto';

@Injectable()
export class AdvancesService {
  constructor(
    @InjectRepository(EmployeeAdvance) private repo: Repository<EmployeeAdvance>,
    @InjectRepository(Employee) private employeeRepo: Repository<Employee>,
    @InjectRepository(Job) private jobRepo: Repository<Job>,
    private auditLogs: AuditLogsService,
  ) {}

  async create(dto: CreateAdvanceDto, actorId: number) {
    await this.assertEmployee(dto.employeeId);
    if (dto.jobId) await this.assertJob(dto.jobId);
    await this.assertNoOverdueAdvance(dto.employeeId);
    const advance = await this.repo.save(this.repo.create({ ...dto, status: AdvanceStatus.PENDING, createdBy: actorId, updatedBy: actorId }));
    this.auditLogs.logAsync({ entityName: 'EmployeeAdvance', entityId: advance.id, action: 'CREATE', userId: actorId, newValues: advance });
    return advance;
  }

  async findAll(filter: AdvanceFilterDto = {}) {
    const { page = 1, limit = 20, employeeId, jobId, status, dueDateFrom, dueDateTo } = filter;
    const qb = this.repo.createQueryBuilder('a');
    if (employeeId) qb.andWhere('a.employeeId = :employeeId', { employeeId });
    if (jobId) qb.andWhere('a.jobId = :jobId', { jobId });
    if (status) qb.andWhere('a.status = :status', { status });
    if (dueDateFrom) qb.andWhere('a.dueDate >= :dueDateFrom', { dueDateFrom });
    if (dueDateTo) qb.andWhere('a.dueDate <= :dueDateTo', { dueDateTo });
    qb.orderBy('a.createdAt', 'DESC').skip(getSkip(page, limit)).take(limit);
    return paginate(await qb.getManyAndCount(), page, limit);
  }

  async findOne(id: number) {
    const advance = await this.repo.findOne({ where: { id } });
    if (!advance) throw new NotFoundException('Employee advance not found');
    return advance;
  }

  async approve(id: number, actorId: number) {
    const advance = await this.findOne(id);
    if (advance.status !== AdvanceStatus.PENDING) throw new BadRequestException('Only pending advances can be approved');
    const updated = await this.repo.save({ ...advance, status: AdvanceStatus.APPROVED, approvedAt: new Date(), approvedBy: actorId, updatedBy: actorId });
    this.auditLogs.logAsync({ entityName: 'EmployeeAdvance', entityId: id, action: 'APPROVE', userId: actorId });
    return updated;
  }

  async reject(id: number, dto: RejectAdvanceDto, actorId: number) {
    const advance = await this.findOne(id);
    if (advance.status !== AdvanceStatus.PENDING) throw new BadRequestException('Only pending advances can be rejected');
    const updated = await this.repo.save({ ...advance, status: AdvanceStatus.REJECTED, rejectReason: dto.reason, updatedBy: actorId });
    this.auditLogs.logAsync({ entityName: 'EmployeeAdvance', entityId: id, action: 'REJECT', userId: actorId, newValues: { reason: dto.reason } });
    return updated;
  }

  async settle(id: number, dto: SettleAdvanceDto, actorId: number) {
    const advance = await this.findOne(id);
    if (advance.status !== AdvanceStatus.APPROVED) throw new BadRequestException('Only approved advances can be settled');
    const nextSettled = Number(advance.settledAmount ?? 0) + Number(dto.amount);
    if (nextSettled > Number(advance.amount)) throw new BadRequestException('Settlement exceeds advance amount');
    const status = nextSettled >= Number(advance.amount) ? AdvanceStatus.SETTLED : AdvanceStatus.APPROVED;
    const updated = await this.repo.save({
      ...advance,
      settledAmount: nextSettled,
      status,
      settledAt: status === AdvanceStatus.SETTLED ? new Date() : advance.settledAt,
      settledBy: status === AdvanceStatus.SETTLED ? actorId : advance.settledBy,
      updatedBy: actorId,
    });
    this.auditLogs.logAsync({ entityName: 'EmployeeAdvance', entityId: id, action: 'SETTLE', userId: actorId, newValues: { amount: dto.amount, settledAmount: nextSettled } });
    return updated;
  }

  async overdue() {
    const today = new Date().toISOString().slice(0, 10);
    return this.repo.createQueryBuilder('a')
      .where('a.status = :status', { status: AdvanceStatus.APPROVED })
      .andWhere('a.dueDate IS NOT NULL')
      .andWhere('a.dueDate < :today', { today })
      .orderBy('a.dueDate', 'ASC')
      .getMany();
  }

  private async assertEmployee(employeeId: number) {
    const employee = await this.employeeRepo.findOne({ where: { id: employeeId } });
    if (!employee || employee.status !== EmployeeStatus.ACTIVE) throw new BadRequestException(`Active employee #${employeeId} not found`);
  }

  private async assertJob(jobId: number) {
    const job = await this.jobRepo.findOne({ where: { id: jobId } });
    if (!job || job.archivedAt) throw new BadRequestException(`Job #${jobId} not found`);
  }

  private async assertNoOverdueAdvance(employeeId: number) {
    const today = new Date().toISOString().slice(0, 10);
    const overdue = await this.repo.createQueryBuilder('a')
      .where('a.employeeId = :employeeId', { employeeId })
      .andWhere('a.status = :status', { status: AdvanceStatus.APPROVED })
      .andWhere('a.dueDate IS NOT NULL')
      .andWhere('a.dueDate < :today', { today })
      .getOne();
    if (overdue) throw new BadRequestException('Employee has overdue unsettled advance');
  }
}

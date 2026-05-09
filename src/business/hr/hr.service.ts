import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AttendanceRecord } from '../../models/attendance-record.entity';
import { Employee, EmployeeStatus } from '../../models/employee.entity';
import { LeaveRequest, LeaveStatus } from '../../models/leave-request.entity';
import { PayrollRecord, PayrollStatus } from '../../models/payroll-record.entity';
import { Branch } from '../../models/branch.entity';
import { User } from '../../models/user.entity';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { paginate, getSkip } from '../../common/utils/pagination.util';
import {
  AttendanceFilterDto,
  CreateEmployeeDto,
  CreateLeaveRequestDto,
  EmployeeFilterDto,
  LeaveFilterDto,
  PayrollFilterDto,
  RejectLeaveDto,
  UpdateEmployeeDto,
  UpsertAttendanceDto,
  UpsertPayrollDto,
} from './dto/hr.dto';

@Injectable()
export class HrService {
  constructor(
    @InjectRepository(Employee) private employeeRepo: Repository<Employee>,
    @InjectRepository(AttendanceRecord) private attendanceRepo: Repository<AttendanceRecord>,
    @InjectRepository(LeaveRequest) private leaveRepo: Repository<LeaveRequest>,
    @InjectRepository(PayrollRecord) private payrollRepo: Repository<PayrollRecord>,
    @InjectRepository(Branch) private branchRepo: Repository<Branch>,
    @InjectRepository(User) private userRepo: Repository<User>,
    private auditLogs: AuditLogsService,
  ) {}

  async createEmployee(dto: CreateEmployeeDto, actorId: number) {
    await this.assertRefs(dto.branchId, dto.userId);
    const exists = await this.employeeRepo.findOne({ where: { employeeCode: dto.employeeCode } });
    if (exists) throw new ConflictException('Employee code already exists');
    const employee = await this.employeeRepo.save(this.employeeRepo.create({ ...dto, createdBy: actorId, updatedBy: actorId }));
    await this.auditLogs.log({ entityName: 'Employee', entityId: employee.id, action: 'CREATE', userId: actorId, newValues: employee });
    return employee;
  }

  async findEmployees(filter: EmployeeFilterDto = {}) {
    const { page = 1, limit = 20, keyword, branchId, department, status } = filter;
    const qb = this.employeeRepo.createQueryBuilder('e');
    if (keyword) qb.andWhere('(e.employeeCode LIKE :kw OR e.fullName LIKE :kw OR e.email LIKE :kw OR e.phone LIKE :kw)', { kw: `%${keyword}%` });
    if (branchId) qb.andWhere('e.branchId = :branchId', { branchId });
    if (department) qb.andWhere('e.department = :department', { department });
    if (status) qb.andWhere('e.status = :status', { status });
    qb.orderBy('e.createdAt', 'DESC').skip(getSkip(page, limit)).take(limit);
    return paginate(await qb.getManyAndCount(), page, limit);
  }

  async findEmployee(id: number) {
    const employee = await this.employeeRepo.findOne({ where: { id } });
    if (!employee) throw new NotFoundException('Employee not found');
    return employee;
  }

  async updateEmployee(id: number, dto: UpdateEmployeeDto, actorId: number) {
    const current = await this.findEmployee(id);
    await this.assertRefs(dto.branchId, dto.userId);
    const updated = await this.employeeRepo.save({ ...current, ...dto, updatedBy: actorId });
    await this.auditLogs.log({ entityName: 'Employee', entityId: id, action: 'UPDATE', userId: actorId, oldValues: current, newValues: updated });
    return updated;
  }

  async deactivateEmployee(id: number, actorId: number) {
    const current = await this.findEmployee(id);
    const updated = await this.employeeRepo.save({ ...current, status: EmployeeStatus.INACTIVE, updatedBy: actorId });
    await this.auditLogs.log({ entityName: 'Employee', entityId: id, action: 'DEACTIVATE', userId: actorId });
    return updated;
  }

  async upsertAttendance(dto: UpsertAttendanceDto, actorId: number) {
    await this.assertEmployee(dto.employeeId);
    const current = await this.attendanceRepo.findOne({ where: { employeeId: dto.employeeId, workDate: new Date(dto.workDate) as any } });
    const record = await this.attendanceRepo.save(this.attendanceRepo.create({
      ...(current ?? {}),
      ...dto,
      createdBy: current?.createdBy ?? actorId,
      updatedBy: actorId,
    }));
    await this.auditLogs.log({ entityName: 'AttendanceRecord', entityId: record.id, action: current ? 'UPDATE' : 'CREATE', userId: actorId, newValues: record });
    return record;
  }

  async findAttendance(filter: AttendanceFilterDto = {}) {
    const { page = 1, limit = 20, employeeId, status, dateFrom, dateTo } = filter;
    const qb = this.attendanceRepo.createQueryBuilder('a');
    if (employeeId) qb.andWhere('a.employeeId = :employeeId', { employeeId });
    if (status) qb.andWhere('a.status = :status', { status });
    if (dateFrom) qb.andWhere('a.workDate >= :dateFrom', { dateFrom });
    if (dateTo) qb.andWhere('a.workDate <= :dateTo', { dateTo });
    qb.orderBy('a.workDate', 'DESC').skip(getSkip(page, limit)).take(limit);
    return paginate(await qb.getManyAndCount(), page, limit);
  }

  async createLeave(dto: CreateLeaveRequestDto, actorId: number) {
    await this.assertEmployee(dto.employeeId);
    const leave = await this.leaveRepo.save(this.leaveRepo.create({ ...dto, status: LeaveStatus.PENDING, createdBy: actorId, updatedBy: actorId }));
    await this.auditLogs.log({ entityName: 'LeaveRequest', entityId: leave.id, action: 'CREATE', userId: actorId, newValues: leave });
    return leave;
  }

  async findLeaves(filter: LeaveFilterDto = {}) {
    const { page = 1, limit = 20, employeeId, status, dateFrom, dateTo } = filter;
    const qb = this.leaveRepo.createQueryBuilder('l');
    if (employeeId) qb.andWhere('l.employeeId = :employeeId', { employeeId });
    if (status) qb.andWhere('l.status = :status', { status });
    if (dateFrom) qb.andWhere('l.dateFrom >= :dateFrom', { dateFrom });
    if (dateTo) qb.andWhere('l.dateTo <= :dateTo', { dateTo });
    qb.orderBy('l.createdAt', 'DESC').skip(getSkip(page, limit)).take(limit);
    return paginate(await qb.getManyAndCount(), page, limit);
  }

  async approveLeave(id: number, actorId: number) {
    const leave = await this.findLeave(id);
    if (leave.status !== LeaveStatus.PENDING) throw new BadRequestException('Only pending leave requests can be approved');
    const updated = await this.leaveRepo.save({ ...leave, status: LeaveStatus.APPROVED, approvedAt: new Date(), approvedBy: actorId, updatedBy: actorId });
    await this.auditLogs.log({ entityName: 'LeaveRequest', entityId: id, action: 'APPROVE', userId: actorId });
    return updated;
  }

  async rejectLeave(id: number, dto: RejectLeaveDto, actorId: number) {
    const leave = await this.findLeave(id);
    if (leave.status !== LeaveStatus.PENDING) throw new BadRequestException('Only pending leave requests can be rejected');
    const updated = await this.leaveRepo.save({ ...leave, status: LeaveStatus.REJECTED, rejectedAt: new Date(), rejectedBy: actorId, rejectReason: dto.reason, updatedBy: actorId });
    await this.auditLogs.log({ entityName: 'LeaveRequest', entityId: id, action: 'REJECT', userId: actorId, newValues: { reason: dto.reason } });
    return updated;
  }

  async upsertPayroll(dto: UpsertPayrollDto, actorId: number) {
    await this.assertEmployee(dto.employeeId);
    const current = await this.payrollRepo.findOne({ where: { employeeId: dto.employeeId, year: dto.year, month: dto.month } });
    if (current?.status === PayrollStatus.POSTED) throw new BadRequestException('Cannot modify a POSTED payroll record');
    const allowance = Number(dto.allowance ?? 0);
    const deduction = Number(dto.deduction ?? 0);
    const baseSalary = Number(dto.baseSalary);
    const record = await this.payrollRepo.save(this.payrollRepo.create({
      ...(current ?? {}),
      ...dto,
      allowance,
      deduction,
      netSalary: baseSalary + allowance - deduction,
      createdBy: current?.createdBy ?? actorId,
      updatedBy: actorId,
    }));
    await this.auditLogs.log({ entityName: 'PayrollRecord', entityId: record.id, action: current ? 'UPDATE' : 'CREATE', userId: actorId, newValues: record });
    return record;
  }

  async findPayroll(filter: PayrollFilterDto = {}) {
    const { page = 1, limit = 20, employeeId, year, month, status } = filter;
    const qb = this.payrollRepo.createQueryBuilder('p');
    if (employeeId) qb.andWhere('p.employeeId = :employeeId', { employeeId });
    if (year) qb.andWhere('p.year = :year', { year });
    if (month) qb.andWhere('p.month = :month', { month });
    if (status) qb.andWhere('p.status = :status', { status });
    qb.orderBy('p.year', 'DESC').addOrderBy('p.month', 'DESC').skip(getSkip(page, limit)).take(limit);
    return paginate(await qb.getManyAndCount(), page, limit);
  }

  async postPayroll(id: number, actorId: number) {
    const record = await this.payrollRepo.findOne({ where: { id } });
    if (!record) throw new NotFoundException('Payroll record not found');
    if (record.status === PayrollStatus.POSTED) throw new BadRequestException('Payroll is already posted');
    if (record.status === PayrollStatus.VOIDED) throw new BadRequestException('Payroll is voided');
    const updated = await this.payrollRepo.save({ ...record, status: PayrollStatus.POSTED, postedAt: new Date(), postedBy: actorId, updatedBy: actorId });
    await this.auditLogs.log({ entityName: 'PayrollRecord', entityId: id, action: 'POST', userId: actorId });
    return updated;
  }

  private async findLeave(id: number) {
    const leave = await this.leaveRepo.findOne({ where: { id } });
    if (!leave) throw new NotFoundException('Leave request not found');
    return leave;
  }

  private async assertEmployee(employeeId: number) {
    const employee = await this.employeeRepo.findOne({ where: { id: employeeId } });
    if (!employee || employee.status === EmployeeStatus.TERMINATED) throw new BadRequestException(`Employee #${employeeId} not found`);
  }

  private async assertRefs(branchId?: number, userId?: number) {
    if (branchId) {
      const branch = await this.branchRepo.findOne({ where: { id: branchId } });
      if (!branch) throw new BadRequestException(`Branch #${branchId} not found`);
    }
    if (userId) {
      const user = await this.userRepo.findOne({ where: { id: userId, isActive: true } });
      if (!user) throw new BadRequestException(`User #${userId} not found`);
    }
  }
}

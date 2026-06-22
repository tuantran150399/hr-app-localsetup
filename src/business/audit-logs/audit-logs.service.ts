import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { AuditLog } from '../../models/audit-log.entity';
import { paginate, getSkip } from '../../common/utils/pagination.util';

export interface AuditLogFilter {
  page?: number;
  limit?: number;
  entityName?: string;
  entityId?: number;
  userId?: number;
  action?: string;
  dateFrom?: string;
  dateTo?: string;
}

@Injectable()
export class AuditLogsService {
  private readonly logger = new Logger(AuditLogsService.name);

  constructor(
    @InjectRepository(AuditLog) private repo: Repository<AuditLog>,
    private dataSource: DataSource,
  ) {}

  async findAll(filter: AuditLogFilter = {}) {
    const { page = 1, limit = 50, entityName, entityId, userId, action, dateFrom, dateTo } = filter;
    const qb = this.repo.createQueryBuilder('a');
    if (entityName) qb.andWhere('a.entityName = :entityName', { entityName });
    if (entityId) qb.andWhere('a.entityId = :entityId', { entityId });
    if (userId) qb.andWhere('a.userId = :userId', { userId });
    if (action) qb.andWhere('a.action = :action', { action });
    if (dateFrom) qb.andWhere('a.createdAt >= :dateFrom', { dateFrom });
    if (dateTo) qb.andWhere('a.createdAt <= :dateTo', { dateTo });
    qb.orderBy('a.createdAt', 'DESC').skip(getSkip(page, limit)).take(limit);
    const [logs, total] = await qb.getManyAndCount();
    return paginate([await this.enrich(logs), total], page, limit);
  }

  async findOne(id: number) {
    const log = await this.repo.findOne({ where: { id } });
    if (!log) throw new NotFoundException('Audit log not found');
    return (await this.enrich([log]))[0];
  }

  async findByEntity(entityName: string, entityId: number) {
    const logs = await this.repo.find({ where: { entityName, entityId }, order: { createdAt: 'DESC' } });
    return this.enrich(logs);
  }

  private async enrich(logs: AuditLog[]) {
    if (!logs.length) return logs;
    const userIds = this.uniqueIds([
      ...logs.map((log) => log.userId),
      ...logs.filter((log) => log.entityName === 'User').map((log) => log.entityId),
    ]);
    const entityIds = (name: string) => this.uniqueIds(logs.filter((log) => log.entityName === name).map((log) => log.entityId));

    const [users, jobs, paymentRequests, partners, branches, cobEntries, debitNotes, accountingEntries] = await Promise.all([
      this.queryUsers(userIds),
      this.queryJobs(entityIds('Job')),
      this.queryPaymentRequests(entityIds('PaymentRequest')),
      this.queryPartners(entityIds('Partner')),
      this.queryBranches(entityIds('Branch')),
      this.queryCobEntries(entityIds('CobEntry')),
      this.queryDebitNotes(entityIds('DebitNote')),
      this.queryAccountingEntries(logs),
    ]);

    const userMap = new Map(users.map((item: any) => [Number(item.id), item]));
    const entityMap = new Map<string, any>();
    users.forEach((item: any) => entityMap.set(`User:${Number(item.id)}`, {
      ...item,
      entityName: 'User',
      code: item.employeeCode || item.username,
      displayName: item.fullName ? `${item.fullName} (${item.username})` : item.username,
    }));
    [jobs, paymentRequests, partners, branches, cobEntries, debitNotes, accountingEntries]
      .flat()
      .forEach((item: any) => entityMap.set(`${item.entityName}:${Number(item.id)}`, item));

    return logs.map((log) => Object.assign(log, {
      actor: userMap.get(Number(log.userId)) ?? null,
      entity: entityMap.get(`${log.entityName}:${Number(log.entityId)}`) ?? {
        id: log.entityId,
        entityName: log.entityName,
        displayName: `${log.entityName} #${log.entityId}`,
      },
    }));
  }

  private uniqueIds(values: Array<number | null | undefined>) {
    return [...new Set(values.filter((value): value is number => Number.isInteger(Number(value))).map(Number))];
  }

  private placeholders(ids: number[]) {
    return ids.map(() => '?').join(',');
  }

  private queryUsers(ids: number[]) {
    if (!ids.length) return Promise.resolve([]);
    return this.dataSource.query(`
      SELECT u.id, u.username, u.full_name AS fullName,
             e.employee_code AS employeeCode, e.department, e.position,
             b.code AS branchCode, b.name AS branchName
      FROM users u
      LEFT JOIN employees e ON e.user_id = u.id
      LEFT JOIN branches b ON b.id = u.branch_id
      WHERE u.id IN (${this.placeholders(ids)})
    `, ids);
  }

  private queryJobs(ids: number[]) {
    if (!ids.length) return Promise.resolve([]);
    return this.dataSource.query(`
      SELECT j.id, 'Job' AS entityName, j.job_code AS code, j.job_code AS displayName,
             j.booking_ref AS bookingRef, j.hbl, j.mbl, j.container_no AS containerNo,
             p.code AS partnerCode, p.name AS partnerName,
             b.code AS branchCode, b.name AS branchName
      FROM jobs j LEFT JOIN partners p ON p.id = j.partner_id
      LEFT JOIN branches b ON b.id = j.branch_id
      WHERE j.id IN (${this.placeholders(ids)})
    `, ids);
  }

  private queryPaymentRequests(ids: number[]) {
    if (!ids.length) return Promise.resolve([]);
    return this.dataSource.query(`
      SELECT pr.id, 'PaymentRequest' AS entityName, pr.request_code AS code,
             COALESCE(pr.request_code, CONCAT('Đề nghị #', pr.id)) AS displayName,
             pr.amount, pr.currency, pr.reason AS description,
             j.job_code AS jobCode, j.booking_ref AS bookingRef,
             v.code AS partnerCode, v.name AS partnerName,
             b.code AS branchCode, b.name AS branchName
      FROM payment_requests pr LEFT JOIN jobs j ON j.id = pr.job_id
      LEFT JOIN partners v ON v.id = pr.vendor_id
      LEFT JOIN branches b ON b.id = pr.branch_id
      WHERE pr.id IN (${this.placeholders(ids)})
    `, ids);
  }

  private queryPartners(ids: number[]) {
    if (!ids.length) return Promise.resolve([]);
    return this.dataSource.query(`
      SELECT p.id, 'Partner' AS entityName, p.code,
             CONCAT(p.code, ' - ', p.name) AS displayName, p.name AS partnerName,
             p.tax_code AS taxCode, p.address
      FROM partners p WHERE p.id IN (${this.placeholders(ids)})
    `, ids);
  }

  private queryBranches(ids: number[]) {
    if (!ids.length) return Promise.resolve([]);
    return this.dataSource.query(`
      SELECT b.id, 'Branch' AS entityName, b.code,
             CONCAT(b.code, ' - ', b.name) AS displayName,
             b.code AS branchCode, b.name AS branchName, b.address
      FROM branches b WHERE b.id IN (${this.placeholders(ids)})
    `, ids);
  }

  private queryCobEntries(ids: number[]) {
    if (!ids.length) return Promise.resolve([]);
    return this.dataSource.query(`
      SELECT c.id, 'CobEntry' AS entityName, CONCAT('Thu/Chi hộ #', c.id) AS displayName,
             c.description, c.amount, c.currency, j.job_code AS jobCode,
             p.code AS partnerCode, p.name AS partnerName
      FROM cob_entries c LEFT JOIN jobs j ON j.id = c.job_id
      LEFT JOIN partners p ON p.id = c.partner_id
      WHERE c.id IN (${this.placeholders(ids)})
    `, ids);
  }

  private queryDebitNotes(ids: number[]) {
    if (!ids.length) return Promise.resolve([]);
    return this.dataSource.query(`
      SELECT d.id, 'DebitNote' AS entityName, CONCAT('Debit Note #', d.id) AS displayName,
             d.description, d.amount, d.currency, j.job_code AS jobCode,
             p.code AS partnerCode, p.name AS partnerName
      FROM debit_notes d LEFT JOIN jobs j ON j.id = d.job_id
      LEFT JOIN partners p ON p.id = d.partner_id
      WHERE d.id IN (${this.placeholders(ids)})
    `, ids);
  }

  private async queryAccountingEntries(logs: AuditLog[]) {
    const result: any[] = [];
    for (const [entityName, table] of [['RevenueEntry', 'revenue_entries'], ['CostEntry', 'cost_entries']] as const) {
      const ids = this.uniqueIds(logs.filter((log) => log.entityName === entityName).map((log) => log.entityId));
      if (!ids.length) continue;
      const rows = await this.dataSource.query(`
        SELECT e.id, '${entityName}' AS entityName, CONCAT('${entityName} #', e.id) AS displayName,
               e.description, e.amount, e.currency, j.job_code AS jobCode,
               p.code AS partnerCode, p.name AS partnerName
        FROM ${table} e LEFT JOIN jobs j ON j.id = e.job_id
        LEFT JOIN partners p ON p.id = j.partner_id
        WHERE e.id IN (${this.placeholders(ids)})
      `, ids);
      result.push(...rows);
    }
    return result;
  }

  /**
   * Synchronous log — awaited by callers that need the record immediately.
   */
  log(data: Partial<AuditLog>) {
    return this.repo.save(this.repo.create(data));
  }

  /**
   * Fire-and-forget audit log — does NOT block the HTTP response.
   * Use this for all write operations (create/update/delete/post/void)
   * where the client doesn't need to wait for the audit record.
   */
  logAsync(data: Partial<AuditLog>): void {
    this.repo.save(this.repo.create(data)).catch((err) =>
      this.logger.error(`Audit log write failed: ${err?.message}`, err?.stack),
    );
  }
}


import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
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

  constructor(@InjectRepository(AuditLog) private repo: Repository<AuditLog>) {}

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
    return paginate(await qb.getManyAndCount(), page, limit);
  }

  async findOne(id: number) {
    const log = await this.repo.findOne({ where: { id } });
    if (!log) throw new NotFoundException('Audit log not found');
    return log;
  }

  findByEntity(entityName: string, entityId: number) {
    return this.repo.find({ where: { entityName, entityId }, order: { createdAt: 'DESC' } });
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


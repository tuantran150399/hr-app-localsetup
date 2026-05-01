import { Injectable, NotFoundException } from '@nestjs/common';
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

  log(data: Partial<AuditLog>) {
    return this.repo.save(this.repo.create(data));
  }
}

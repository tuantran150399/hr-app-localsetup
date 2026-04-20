import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditLog } from '../../models/audit-log.entity';

@Injectable()
export class AuditLogsService {
  constructor(@InjectRepository(AuditLog) private repo: Repository<AuditLog>) {}

  findAll(limit = 100) {
    return this.repo.find({ order: { createdAt: 'DESC' }, take: limit });
  }

  findByEntity(entityName: string, entityId: number) {
    return this.repo.find({ where: { entityName, entityId }, order: { createdAt: 'DESC' } });
  }

  log(data: Partial<AuditLog>) {
    return this.repo.save(this.repo.create(data));
  }
}
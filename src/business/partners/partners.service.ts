import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Partner } from '../../models/partner.entity';
import { CreatePartnerDto, UpdatePartnerDto, PartnerFilterDto } from './dto/partner.dto';
import { paginate, getSkip } from '../../common/utils/pagination.util';
import { AuditLogsService } from '../audit-logs/audit-logs.service';

@Injectable()
export class PartnersService {
  constructor(
    @InjectRepository(Partner) private repo: Repository<Partner>,
    private auditLogs: AuditLogsService,
  ) {}

  async create(dto: CreatePartnerDto, actorId: number) {
    const exists = await this.repo.findOne({ where: { code: dto.code } });
    if (exists) throw new ConflictException('Partner code already exists');
    const partner = await this.repo.save(this.repo.create({ ...dto, createdBy: actorId, updatedBy: actorId }));
    this.auditLogs.logAsync({
      entityName: 'Partner',
      entityId: partner.id,
      action: 'CREATE',
      userId: actorId,
      newValues: { code: partner.code, partnerType: partner.partnerType, isActive: partner.isActive },
    });
    return partner;
  }

  async findAll(filter: PartnerFilterDto = {}) {
    const { page, limit, keyword, type, partnerType, isActive } = filter;
    const shouldPaginate = page !== undefined || limit !== undefined || keyword !== undefined || isActive !== undefined;
    const qb = this.repo.createQueryBuilder('p');

    const effectiveType = partnerType ?? type;
    if (effectiveType) qb.andWhere('p.partnerType = :partnerType', { partnerType: effectiveType });
    if (isActive !== undefined) qb.andWhere('p.isActive = :isActive', { isActive });
    if (keyword) {
      qb.andWhere(
        '(p.code LIKE :kw OR p.name LIKE :kw OR p.taxCode LIKE :kw OR p.contactPerson LIKE :kw OR p.phone LIKE :kw OR p.email LIKE :kw)',
        { kw: `%${keyword}%` },
      );
    }

    qb.orderBy('p.name', 'ASC');

    if (!shouldPaginate) {
      return qb.getMany();
    }

    const safePage = page ?? 1;
    const safeLimit = limit ?? 100;
    qb.skip(getSkip(safePage, safeLimit)).take(safeLimit);
    return paginate(await qb.getManyAndCount(), safePage, safeLimit);
  }

  async findOne(id: number) {
    const p = await this.repo.findOne({ where: { id } });
    if (!p) throw new NotFoundException('Partner not found');
    return p;
  }

  async update(id: number, dto: UpdatePartnerDto, actorId: number) {
    const p = await this.findOne(id);
    const updated = await this.repo.save({ ...p, ...dto, updatedBy: actorId });
    this.auditLogs.logAsync({
      entityName: 'Partner',
      entityId: id,
      action: 'UPDATE',
      userId: actorId,
      oldValues: { name: p.name, partnerType: p.partnerType, isActive: p.isActive },
      newValues: { name: updated.name, partnerType: updated.partnerType, isActive: updated.isActive },
    });
    return updated;
  }

  async deactivate(id: number, actorId: number) {
    const p = await this.findOne(id);
    await this.repo.save({ ...p, isActive: false, updatedBy: actorId });
    this.auditLogs.logAsync({
      entityName: 'Partner',
      entityId: id,
      action: 'DEACTIVATE',
      userId: actorId,
      oldValues: { isActive: p.isActive },
      newValues: { isActive: false },
    });
    return { message: 'Partner deactivated' };
  }

  async lock(id: number, actorId: number) {
    const p = await this.findOne(id);
    await this.repo.save({ ...p, isActive: false, updatedBy: actorId });
    this.auditLogs.logAsync({
      entityName: 'Partner',
      entityId: id,
      action: 'LOCK',
      userId: actorId,
      oldValues: { isActive: p.isActive },
      newValues: { isActive: false },
    });
    return { message: 'Partner locked' };
  }
}

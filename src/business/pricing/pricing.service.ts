import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PricingServiceType, ServicePrice } from '../../models/service-price.entity';
import { Partner } from '../../models/partner.entity';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { paginate, getSkip } from '../../common/utils/pagination.util';
import { CreateServicePriceDto, PriceSuggestionDto, ServicePriceFilterDto, UpdateServicePriceDto } from './dto/pricing.dto';
import { parseWorkbookRows, pickCell, toBoolean, toDateString, toNumber } from '../../common/utils/excel.util';

@Injectable()
export class PricingService {
  constructor(
    @InjectRepository(ServicePrice) private repo: Repository<ServicePrice>,
    @InjectRepository(Partner) private partnerRepo: Repository<Partner>,
    private auditLogs: AuditLogsService,
  ) {}

  async create(dto: CreateServicePriceDto, actorId: number) {
    await this.assertPartner(dto.partnerId);
    const price = await this.repo.save(this.repo.create({ ...dto, createdBy: actorId, updatedBy: actorId }));
    await this.auditLogs.log({ entityName: 'ServicePrice', entityId: price.id, action: 'CREATE', userId: actorId, newValues: price });
    return price;
  }

  async findAll(filter: ServicePriceFilterDto = {}) {
    const { page = 1, limit = 20, keyword, partnerId, serviceType, shipmentMode, isActive } = filter;
    const qb = this.repo.createQueryBuilder('p');
    if (keyword) {
      qb.andWhere('(p.routeFrom LIKE :kw OR p.routeTo LIKE :kw OR p.unit LIKE :kw OR p.notes LIKE :kw)', { kw: `%${keyword}%` });
    }
    if (partnerId) qb.andWhere('p.partnerId = :partnerId', { partnerId });
    if (serviceType) qb.andWhere('p.serviceType = :serviceType', { serviceType });
    if (shipmentMode) qb.andWhere('p.shipmentMode = :shipmentMode', { shipmentMode });
    if (isActive !== undefined) qb.andWhere('p.isActive = :isActive', { isActive });
    qb.orderBy('p.createdAt', 'DESC').skip(getSkip(page, limit)).take(limit);
    return paginate(await qb.getManyAndCount(), page, limit);
  }

  async findOne(id: number) {
    const price = await this.repo.findOne({ where: { id } });
    if (!price) throw new NotFoundException('Service price not found');
    return price;
  }

  async update(id: number, dto: UpdateServicePriceDto, actorId: number) {
    const current = await this.findOne(id);
    await this.assertPartner(dto.partnerId);
    const updated = await this.repo.save({ ...current, ...dto, updatedBy: actorId });
    await this.auditLogs.log({ entityName: 'ServicePrice', entityId: id, action: 'UPDATE', userId: actorId, oldValues: current, newValues: updated });
    return updated;
  }

  async deactivate(id: number, actorId: number) {
    const current = await this.findOne(id);
    const updated = await this.repo.save({ ...current, isActive: false, updatedBy: actorId });
    await this.auditLogs.log({ entityName: 'ServicePrice', entityId: id, action: 'DEACTIVATE', userId: actorId });
    return updated;
  }

  async suggest(dto: PriceSuggestionDto) {
    const serviceDate = dto.serviceDate ?? new Date().toISOString().slice(0, 10);
    const qb = this.repo.createQueryBuilder('p')
      .where('p.serviceType = :serviceType', { serviceType: dto.serviceType })
      .andWhere('p.isActive = true')
      .andWhere('(p.partnerId = :partnerId OR p.partnerId IS NULL)', { partnerId: dto.partnerId ?? 0 })
      .andWhere('(p.effectiveFrom IS NULL OR p.effectiveFrom <= :serviceDate)', { serviceDate })
      .andWhere('(p.effectiveTo IS NULL OR p.effectiveTo >= :serviceDate)', { serviceDate });
    if (dto.shipmentMode) qb.andWhere('(p.shipmentMode = :shipmentMode OR p.shipmentMode IS NULL)', { shipmentMode: dto.shipmentMode });
    if (dto.routeFrom) qb.andWhere('(p.routeFrom = :routeFrom OR p.routeFrom IS NULL)', { routeFrom: dto.routeFrom });
    if (dto.routeTo) qb.andWhere('(p.routeTo = :routeTo OR p.routeTo IS NULL)', { routeTo: dto.routeTo });
    if (dto.quantity !== undefined) {
      qb.andWhere('(p.minQuantity IS NULL OR p.minQuantity <= :quantity)', { quantity: dto.quantity })
        .andWhere('(p.maxQuantity IS NULL OR p.maxQuantity >= :quantity)', { quantity: dto.quantity });
    }
    qb.orderBy('p.partnerId IS NULL', 'ASC')
      .addOrderBy('p.shipmentMode IS NULL', 'ASC')
      .addOrderBy('p.routeFrom IS NULL', 'ASC')
      .addOrderBy('p.routeTo IS NULL', 'ASC')
      .addOrderBy('p.effectiveFrom', 'DESC');
    return qb.getOne();
  }

  async importPrices(fileBuffer: Buffer, actorId: number) {
    const rows = await parseWorkbookRows(fileBuffer);
    if (!rows.length) {
      throw new BadRequestException('The uploaded file does not contain any data rows');
    }

    const summary = {
      totalRows: rows.length,
      createdCount: 0,
      updatedCount: 0,
      errorCount: 0,
      errors: [] as string[],
    };

    for (let index = 0; index < rows.length; index += 1) {
      const row = rows[index];
      const rowNumber = index + 2;

      try {
        const dto = await this.mapImportRow(row);
        const id = toNumber(pickCell(row, 'id'));

        if (id) {
          await this.update(id, dto, actorId);
          summary.updatedCount += 1;
        } else {
          await this.create(dto, actorId);
          summary.createdCount += 1;
        }
      } catch (error) {
        summary.errorCount += 1;
        summary.errors.push(`Row ${rowNumber}: ${error instanceof Error ? error.message : 'Import failed'}`);
      }
    }

    return {
      message: 'Pricing import completed',
      ...summary,
    };
  }

  private async assertPartner(partnerId?: number) {
    if (!partnerId) return;
    const partner = await this.partnerRepo.findOne({ where: { id: partnerId, isActive: true } });
    if (!partner) throw new BadRequestException(`Partner #${partnerId} not found`);
  }

  private async mapImportRow(row: Record<string, unknown>): Promise<CreateServicePriceDto> {
    const partnerId = await this.resolvePartnerId(row);
    const serviceType = String(pickCell(row, 'serviceType', 'service_type', 'type') ?? '').trim().toUpperCase();
    const amount = toNumber(pickCell(row, 'amount', 'rate', 'price'));

    if (!serviceType) throw new BadRequestException('serviceType is required');
    if (!amount && amount !== 0) throw new BadRequestException('amount is required');
    if (!Object.values(PricingServiceType).includes(serviceType as PricingServiceType)) {
      throw new BadRequestException(`Unsupported serviceType "${serviceType}"`);
    }

    const dto: CreateServicePriceDto = {
      partnerId,
      serviceType: serviceType as PricingServiceType,
      shipmentMode: this.readString(row, 'shipmentMode', 'shipment_mode', 'mode'),
      routeFrom: this.readString(row, 'routeFrom', 'route_from', 'origin'),
      routeTo: this.readString(row, 'routeTo', 'route_to', 'destination'),
      unit: this.readString(row, 'unit', 'uom', 'size'),
      minQuantity: toNumber(pickCell(row, 'minQuantity', 'min_quantity')),
      maxQuantity: toNumber(pickCell(row, 'maxQuantity', 'max_quantity')),
      currency: this.readString(row, 'currency'),
      amount,
      effectiveFrom: toDateString(pickCell(row, 'effectiveFrom', 'effective_from', 'validFrom', 'valid_from')),
      effectiveTo: toDateString(pickCell(row, 'effectiveTo', 'effective_to', 'validity', 'validTo', 'valid_to')),
      isActive: toBoolean(pickCell(row, 'isActive', 'is_active', 'status')),
      notes: this.readString(row, 'notes'),
    };

    return Object.fromEntries(Object.entries(dto).filter(([, value]) => value !== undefined)) as CreateServicePriceDto;
  }

  private async resolvePartnerId(row: Record<string, unknown>): Promise<number | undefined> {
    const directId = toNumber(pickCell(row, 'partnerId', 'partner_id'));
    if (directId) {
      await this.assertPartner(directId);
      return directId;
    }

    const partnerCode = this.readString(row, 'partnerCode', 'partner_code', 'carrier', 'vendorCode', 'vendor_code');
    if (!partnerCode) return undefined;

    const partner = await this.partnerRepo.findOne({ where: { code: partnerCode, isActive: true } });
    if (!partner) throw new BadRequestException(`Partner code "${partnerCode}" not found`);
    return partner.id;
  }

  private readString(row: Record<string, unknown>, ...aliases: string[]): string | undefined {
    const value = pickCell(row, ...aliases);
    const normalized = String(value ?? '').trim();
    return normalized ? normalized : undefined;
  }
}

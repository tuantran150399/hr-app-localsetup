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
    this.assertQuantityRange(dto);
    const price = await this.repo.save(this.repo.create({ ...this.normalizePriceDto(dto), createdBy: actorId, updatedBy: actorId }));
    this.auditLogs.logAsync({ entityName: 'ServicePrice', entityId: price.id, action: 'CREATE', userId: actorId, newValues: price });
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
    this.assertQuantityRange({ ...current, ...dto });
    const updated = await this.repo.save({ ...current, ...this.normalizePriceDto(dto), updatedBy: actorId });
    this.auditLogs.logAsync({ entityName: 'ServicePrice', entityId: id, action: 'UPDATE', userId: actorId, oldValues: current, newValues: updated });
    return updated;
  }

  async deactivate(id: number, actorId: number) {
    const current = await this.findOne(id);
    const updated = await this.repo.save({ ...current, isActive: false, updatedBy: actorId });
    this.auditLogs.logAsync({ entityName: 'ServicePrice', entityId: id, action: 'DEACTIVATE', userId: actorId });
    return updated;
  }

  async suggest(dto: PriceSuggestionDto) {
    const serviceDate = dto.serviceDate ?? new Date().toISOString().slice(0, 10);
    const baseQb = () => this.repo.createQueryBuilder('p')
      .where('p.serviceType = :serviceType', { serviceType: dto.serviceType })
      .andWhere('p.isActive = true')
      .andWhere('p.partnerId = :partnerId', { partnerId: dto.partnerId ?? 0 })
      .andWhere('(p.effectiveFrom IS NULL OR p.effectiveFrom <= :serviceDate)', { serviceDate })
      .andWhere('(p.effectiveTo IS NULL OR p.effectiveTo >= :serviceDate)', { serviceDate });
    const addQuantityFilter = (qb: ReturnType<typeof baseQb>) => {
      if (dto.quantity !== undefined) {
        qb.andWhere('(p.minQuantity IS NULL OR p.minQuantity <= :quantity)', { quantity: dto.quantity })
          .andWhere('(p.maxQuantity IS NULL OR p.maxQuantity >= :quantity)', { quantity: dto.quantity });
      }
      return qb;
    };

    const routeFrom = this.normalizeText(dto.routeFrom);
    const routeTo = this.normalizeText(dto.routeTo);
    if (routeFrom && routeTo) {
      const routePrice = await addQuantityFilter(baseQb())
        .andWhere('LOWER(TRIM(p.routeFrom)) = :routeFrom', { routeFrom })
        .andWhere('LOWER(TRIM(p.routeTo)) = :routeTo', { routeTo })
        .orderBy('p.effectiveFrom', 'DESC')
        .getOne();
      if (routePrice) return routePrice;
    }

    return addQuantityFilter(baseQb())
      .andWhere('(p.routeFrom IS NULL OR TRIM(p.routeFrom) = \'\')')
      .andWhere('(p.routeTo IS NULL OR TRIM(p.routeTo) = \'\')')
      .orderBy('p.effectiveFrom', 'DESC')
      .getOne();
  }

  async lookupBestMatches(filter: {
    partnerId?: number;
    routeFrom?: string;
    routeTo?: string;
    shipmentMode?: string;
    serviceDate?: string;
  }) {
    const serviceDate = filter.serviceDate ?? new Date().toISOString().slice(0, 10);
    const routeFrom = this.normalizeText(filter.routeFrom);
    const routeTo = this.normalizeText(filter.routeTo);
    const baseQb = () => this.repo.createQueryBuilder('p')
      .where('p.isActive = true')
      .andWhere('p.partnerId = :partnerId', { partnerId: filter.partnerId ?? 0 })
      .andWhere('(p.effectiveFrom IS NULL OR p.effectiveFrom <= :serviceDate)', { serviceDate })
      .andWhere('(p.effectiveTo IS NULL OR p.effectiveTo >= :serviceDate)', { serviceDate })
      .orderBy('p.serviceType', 'ASC')
      .addOrderBy('p.effectiveFrom', 'DESC');

    if (!filter.partnerId) {
      return { data: [], meta: { total: 0, page: 1, limit: 0, totalPages: 1 } };
    }

    let items: ServicePrice[] = [];
    if (routeFrom && routeTo) {
      items = await baseQb()
        .andWhere('LOWER(TRIM(p.routeFrom)) = :routeFrom', { routeFrom })
        .andWhere('LOWER(TRIM(p.routeTo)) = :routeTo', { routeTo })
        .getMany();
    }

    if (!items.length) {
      items = await baseQb()
        .andWhere('(p.routeFrom IS NULL OR TRIM(p.routeFrom) = \'\')')
        .andWhere('(p.routeTo IS NULL OR TRIM(p.routeTo) = \'\')')
        .getMany();
    }

    return { data: items, meta: { total: items.length, page: 1, limit: items.length, totalPages: 1 } };
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

  private normalizePriceDto<T extends CreateServicePriceDto | UpdateServicePriceDto>(dto: T): T {
    return {
      ...dto,
      routeFrom: this.normalizeNullableString(dto.routeFrom),
      routeTo: this.normalizeNullableString(dto.routeTo),
      shipmentMode: this.normalizeNullableString(dto.shipmentMode),
      unit: this.normalizeNullableString(dto.unit)?.toUpperCase(),
      currency: this.normalizeNullableString(dto.currency)?.toUpperCase(),
      effectiveFrom: this.normalizeNullableString(dto.effectiveFrom),
      effectiveTo: this.normalizeNullableString(dto.effectiveTo),
      notes: this.normalizeNullableString(dto.notes),
    };
  }

  private normalizeNullableString(value?: string): string | undefined {
    const normalized = String(value ?? '').trim();
    return normalized ? normalized : undefined;
  }

  private normalizeText(value?: string): string {
    return String(value ?? '').trim().toLowerCase();
  }

  private assertQuantityRange(dto: {
    minQuantity?: number | null;
    maxQuantity?: number | null;
  }) {
    const minQuantity = dto.minQuantity === undefined || dto.minQuantity === null ? null : Number(dto.minQuantity);
    const maxQuantity = dto.maxQuantity === undefined || dto.maxQuantity === null ? null : Number(dto.maxQuantity);
    if (minQuantity !== null && maxQuantity !== null && minQuantity > maxQuantity) {
      throw new BadRequestException('Min quantity cannot be greater than max quantity');
    }
  }

}

import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DebtPolicy } from '../../models/debt-policy.entity';
import { Partner, PartnerType } from '../../models/partner.entity';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { paginate, getSkip } from '../../common/utils/pagination.util';
import { DebtPolicyFilterDto, UpsertDebtPolicyDto } from './dto/debt-policy.dto';
import { CustomerDebtService } from '../customer-debt/customer-debt.service';

@Injectable()
export class DebtPoliciesService {
  constructor(
    @InjectRepository(DebtPolicy) private repo: Repository<DebtPolicy>,
    @InjectRepository(Partner) private partnerRepo: Repository<Partner>,
    private auditLogs: AuditLogsService,
    private customerDebtService: CustomerDebtService,
  ) {}

  async upsert(dto: UpsertDebtPolicyDto, actorId: number) {
    const partner = await this.partnerRepo.findOne({ where: { id: dto.partnerId } });
    if (!partner || ![PartnerType.CUSTOMER, PartnerType.BOTH].includes(partner.partnerType)) {
      throw new BadRequestException(`Customer #${dto.partnerId} not found`);
    }
    if (dto.endDate && dto.endDate < dto.startDate) {
      throw new BadRequestException('Debt policy end date must be on or after start date');
    }

    const existing = await this.repo.findOne({ where: { partnerId: dto.partnerId } });
    const policy = await this.repo.save(
      this.repo.create({
        ...(existing ?? {}),
        ...dto,
        isActive: dto.isActive ?? existing?.isActive ?? true,
        createdBy: existing?.createdBy ?? actorId,
        updatedBy: actorId,
      }),
    );
    this.auditLogs.logAsync({
      entityName: 'DebtPolicy',
      entityId: policy.id,
      action: existing ? 'UPDATE' : 'CREATE',
      userId: actorId,
      newValues: {
        partnerId: policy.partnerId,
        startDate: policy.startDate,
        endDate: policy.endDate,
        maxDebtAmount: policy.maxDebtAmount,
        maxDebtAgeDays: policy.maxDebtAgeDays,
        isActive: policy.isActive,
      },
    });
    await this.customerDebtService.refreshPartnerActualDebt(policy.partnerId);
    return policy;
  }

  async findAll(filter: DebtPolicyFilterDto = {}) {
    const { page = 1, limit = 20, partnerId } = filter;
    const qb = this.repo.createQueryBuilder('dp');
    if (partnerId) qb.andWhere('dp.partnerId = :partnerId', { partnerId });
    qb.orderBy('dp.createdAt', 'DESC').skip(getSkip(page, limit)).take(limit);
    return paginate(await qb.getManyAndCount(), page, limit);
  }

  async findOne(id: number) {
    const policy = await this.repo.findOne({ where: { id } });
    if (!policy) throw new NotFoundException('Debt policy not found');
    return policy;
  }
}

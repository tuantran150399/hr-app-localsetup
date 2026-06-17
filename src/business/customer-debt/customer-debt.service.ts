import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DebtPolicy } from '../../models/debt-policy.entity';
import { Job } from '../../models/job.entity';
import { Partner } from '../../models/partner.entity';

type PreviewParams = {
  partnerId?: number;
  currentJobId?: number;
  currentJobDebtAmount?: number | null;
  currentJobCreatedAt?: Date | string | null;
};

@Injectable()
export class CustomerDebtService {
  constructor(
    @InjectRepository(DebtPolicy) private debtPolicyRepo: Repository<DebtPolicy>,
    @InjectRepository(Job) private jobRepo: Repository<Job>,
    @InjectRepository(Partner) private partnerRepo: Repository<Partner>,
  ) {}

  async getActivePolicy(partnerId?: number): Promise<DebtPolicy | null> {
    if (!partnerId) return null;
    return this.debtPolicyRepo.findOne({ where: { partnerId, isActive: true } });
  }

  async previewActualDebt(params: PreviewParams) {
    const { partnerId, currentJobId, currentJobDebtAmount, currentJobCreatedAt } = params;
    const policy = await this.getActivePolicy(partnerId);

    if (!partnerId || !policy) {
      return {
        hasPolicy: false,
        policy: null,
        actualDebt: 0,
        exceedsLimit: false,
        currentJobIncluded: false,
      };
    }

    const row = await this.jobRepo
      .createQueryBuilder('j')
      .select('COALESCE(SUM(j.debtAmount), 0)', 'totalDebt')
      .where('j.partnerId = :partnerId', { partnerId })
      .andWhere('j.archivedAt IS NULL')
      .andWhere('j.debtAmount IS NOT NULL')
      .andWhere('j.debtAmount > 0')
      .andWhere('DATE(j.createdAt) >= :startDate', { startDate: this.toDateOnly(policy.startDate) })
      .andWhere(policy.endDate ? 'DATE(j.createdAt) <= :endDate' : '1 = 1', {
        endDate: policy.endDate ? this.toDateOnly(policy.endDate) : undefined,
      })
      .andWhere(currentJobId ? 'j.id != :currentJobId' : '1 = 1', { currentJobId })
      .getRawOne<{ totalDebt: string | null }>();

    const persistedDebt = Number(row?.totalDebt ?? 0);
    const resolvedCreatedAt = await this.resolveCurrentJobCreatedAt(currentJobId, currentJobCreatedAt);
    const previewDebtAmount = Number(currentJobDebtAmount ?? 0);
    const currentJobIncluded =
      previewDebtAmount > 0 &&
      this.isWithinPolicyWindow(resolvedCreatedAt, this.toDateOnly(policy.startDate), policy.endDate ? this.toDateOnly(policy.endDate) : null);
    const actualDebt = persistedDebt + (currentJobIncluded ? previewDebtAmount : 0);
    const maxDebtAmount = policy.maxDebtAmount === null || policy.maxDebtAmount === undefined ? null : Number(policy.maxDebtAmount);

    return {
      hasPolicy: true,
      policy: {
        id: policy.id,
        partnerId: policy.partnerId,
        startDate: policy.startDate,
        endDate: policy.endDate,
        maxDebtAmount,
        maxDebtAgeDays: policy.maxDebtAgeDays === null || policy.maxDebtAgeDays === undefined ? null : Number(policy.maxDebtAgeDays),
        isActive: policy.isActive,
      },
      actualDebt,
      exceedsLimit: maxDebtAmount !== null ? actualDebt > maxDebtAmount : false,
      currentJobIncluded,
    };
  }

  async refreshPartnerActualDebt(partnerId?: number) {
    if (!partnerId) return null;
    const preview = await this.previewActualDebt({ partnerId });
    await this.partnerRepo.update(partnerId, { actualDebt: preview.actualDebt });
    return preview;
  }

  private async resolveCurrentJobCreatedAt(currentJobId?: number, currentJobCreatedAt?: Date | string | null) {
    if (currentJobCreatedAt) return new Date(currentJobCreatedAt);
    if (currentJobId) {
      const job = await this.jobRepo.findOne({ where: { id: currentJobId } });
      if (job?.createdAt) return job.createdAt;
    }
    return new Date();
  }

  private isWithinPolicyWindow(dateValue: Date, startDate: string, endDate: string | null) {
    const dateOnly = this.toDateOnly(dateValue);
    if (dateOnly < startDate) return false;
    if (endDate && dateOnly > endDate) return false;
    return true;
  }

  private toDateOnly(value: Date | string) {
    const date = new Date(value);
    const year = date.getFullYear();
    const month = `${date.getMonth() + 1}`.padStart(2, '0');
    const day = `${date.getDate()}`.padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
}

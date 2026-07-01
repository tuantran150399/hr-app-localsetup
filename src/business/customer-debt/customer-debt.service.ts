import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, In, Repository } from 'typeorm';
import { DebtPolicy } from '../../models/debt-policy.entity';
import { Job } from '../../models/job.entity';
import { Partner, PartnerType } from '../../models/partner.entity';
import { RevenueEntry, AccountingStatus, PaymentStatus } from '../../models/revenue-entry.entity';
import { DebitNote } from '../../models/debit-note.entity';
import { CobEntry } from '../../models/cob-entry.entity';

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
    @InjectRepository(RevenueEntry) private revenueRepo: Repository<RevenueEntry>,
    @InjectRepository(DebitNote) private debitNoteRepo: Repository<DebitNote>,
    @InjectRepository(CobEntry) private cobRepo: Repository<CobEntry>,
  ) {}

  async getActivePolicy(partnerId?: number, manager?: EntityManager): Promise<DebtPolicy | null> {
    if (!partnerId) return null;
    const repo = manager?.getRepository(DebtPolicy) || this.debtPolicyRepo;
    const today = this.toDateOnly(new Date());
    return repo.createQueryBuilder('p')
      .where('p.partnerId = :partnerId', { partnerId })
      .andWhere('p.isActive = :active', { active: true })
      .andWhere('p.startDate <= :today', { today })
      .andWhere('(p.endDate IS NULL OR p.endDate >= :today)', { today })
      .getOne();
  }

  /** Outstanding posted receivables. Debit Notes use amount - paidAmount. */
  async getOutstandingDebt(partnerId?: number, manager?: EntityManager, excludedRevenueIds: number[] = []) {
    if (!partnerId) return 0;
    const repo = manager?.getRepository(RevenueEntry) || this.revenueRepo;
    const qb = repo.createQueryBuilder('r')
      .innerJoin(Job, 'j', 'j.id = r.jobId')
      .leftJoin(DebitNote, 'dn', 'dn.receivableEntryId = r.id')
      .select('COALESCE(SUM(CASE WHEN dn.id IS NOT NULL THEN GREATEST(dn.amount - dn.paidAmount, 0) ELSE r.localAmount END), 0)', 'totalDebt')
      .where('j.partnerId = :partnerId', { partnerId })
      .andWhere('r.status = :status', { status: AccountingStatus.POSTED })
      .andWhere('r.paymentStatus != :paid', { paid: PaymentStatus.PAID });
    if (excludedRevenueIds.length) qb.andWhere('r.id NOT IN (:...excludedRevenueIds)', { excludedRevenueIds });
    const row = await qb.getRawOne<{ totalDebt: string | null }>();
    return Number(row?.totalDebt || 0);
  }

  async previewActualDebt(params: PreviewParams) {
    const policy = await this.getActivePolicy(params.partnerId);
    const currentDebt = await this.getOutstandingDebt(params.partnerId);
    if (!params.partnerId || !policy) {
      return { hasPolicy: false, policy: null, actualDebt: currentDebt, exceedsLimit: false, currentJobIncluded: false };
    }

    const createdAt = await this.resolveCurrentJobCreatedAt(params.currentJobId, params.currentJobCreatedAt);
    const previewAmount = Number(params.currentJobDebtAmount || 0);
    const currentJobIncluded = previewAmount > 0 && this.isWithinPolicyWindow(
      createdAt,
      this.toDateOnly(policy.startDate),
      policy.endDate ? this.toDateOnly(policy.endDate) : null,
    );
    const actualDebt = currentDebt + (currentJobIncluded ? previewAmount : 0);
    const maxDebtAmount = policy.maxDebtAmount == null ? null : Number(policy.maxDebtAmount);
    return {
      hasPolicy: true,
      policy: this.serializePolicy(policy),
      actualDebt,
      exceedsLimit: maxDebtAmount !== null && actualDebt > maxDebtAmount,
      currentJobIncluded,
    };
  }

  async previewDebitDebt(params: {
    partnerId: number;
    amount: number;
    debitNoteId?: number;
    cobEntryIds?: number[];
    manager?: EntityManager;
  }) {
    const { partnerId, debitNoteId, manager } = params;
    const policy = await this.getActivePolicy(partnerId, manager);
    const revenueRepo = manager?.getRepository(RevenueEntry) || this.revenueRepo;
    const noteRepo = manager?.getRepository(DebitNote) || this.debitNoteRepo;
    const cobRepo = manager?.getRepository(CobEntry) || this.cobRepo;
    const excludedRevenueIds: number[] = [];
    let releasedCobDebt = 0;

    if (debitNoteId) {
      const current = await noteRepo.findOne({ where: { id: debitNoteId, partnerId } });
      if (current?.receivableEntryId) excludedRevenueIds.push(current.receivableEntryId);
      const linkedCobs = await cobRepo.find({ where: { billedDebitNoteId: debitNoteId, partnerId } });
      const selectedIds = new Set(params.cobEntryIds || []);
      releasedCobDebt = linkedCobs
        .filter((cob) => !selectedIds.has(cob.id))
        .reduce((sum, cob) => sum + Number(cob.amount || 0), 0);
    }
    if (params.cobEntryIds?.length) {
      const cobs = await cobRepo.find({ where: { id: In(params.cobEntryIds), partnerId } });
      excludedRevenueIds.push(...cobs.map((cob) => cob.receivableEntryId).filter(Boolean));
    }

    const uniqueExcluded = [...new Set(excludedRevenueIds)];
    const [currentDebt, baseDebt] = await Promise.all([
      this.getOutstandingDebt(partnerId, manager),
      this.getOutstandingDebt(partnerId, manager, uniqueExcluded),
    ]);
    const debitAmount = Number(params.amount || 0);
    const projectedDebt = baseDebt + debitAmount + releasedCobDebt;
    const maxDebtAmount = policy?.maxDebtAmount == null ? null : Number(policy.maxDebtAmount);
    return {
      hasPolicy: Boolean(policy),
      policy: policy ? this.serializePolicy(policy) : null,
      currentDebt,
      debitAmount,
      projectedDebt,
      availableLimit: maxDebtAmount === null ? null : maxDebtAmount - projectedDebt,
      exceedsLimit: maxDebtAmount !== null && projectedDebt > maxDebtAmount,
      exceededBy: maxDebtAmount !== null ? Math.max(projectedDebt - maxDebtAmount, 0) : 0,
    };
  }

  async refreshPartnerActualDebt(partnerId?: number, manager?: EntityManager) {
    if (!partnerId) return null;
    const actualDebt = await this.getOutstandingDebt(partnerId, manager);
    const repo = manager?.getRepository(Partner) || this.partnerRepo;
    await repo.update(partnerId, { actualDebt });
    return { actualDebt };
  }

  async getDebtSummary() {
    const customers = await this.getDebtCustomerRows();
    return customers.reduce(
      (summary, customer) => ({
        totalDebt: summary.totalDebt + customer.currentDebt,
        totalLimit: summary.totalLimit + (customer.creditLimit || 0),
        remainingLimit: summary.remainingLimit + Math.max((customer.creditLimit || 0) - customer.currentDebt, 0),
        overdueDebt: summary.overdueDebt + customer.overdueDebt,
      }),
      { totalDebt: 0, totalLimit: 0, remainingLimit: 0, overdueDebt: 0 },
    );
  }

  async getDebtCustomers(filter: { status?: string; page?: number; limit?: number }) {
    const allowedStatuses = new Set(['normal', 'near_limit', 'over_limit', 'overdue']);
    const page = Number.isFinite(filter.page) && Number(filter.page) > 0 ? Number(filter.page) : 1;
    const limit = Number.isFinite(filter.limit) && Number(filter.limit) > 0 ? Math.min(Number(filter.limit), 100) : 50;
    const rows = await this.getDebtCustomerRows();
    const filtered = filter.status && allowedStatuses.has(filter.status)
      ? rows.filter((row) => row.status === filter.status)
      : rows;
    const offset = (page - 1) * limit;
    return {
      data: filtered.slice(offset, offset + limit),
      meta: { total: filtered.length, page, limit, totalPages: Math.ceil(filtered.length / limit) },
    };
  }

  async getDebtItems(partnerId: number) {
    const today = this.toDateOnly(new Date());
    const rows = await this.revenueRepo.createQueryBuilder('r')
      .innerJoin(Job, 'j', 'j.id = r.jobId')
      .leftJoin(DebitNote, 'dn', 'dn.receivableEntryId = r.id')
      .select('r.id', 'id')
      .addSelect('COALESCE(dn.referenceNo, r.invoiceNumber, r.refNumber, j.jobCode)', 'invoiceCode')
      .addSelect("CASE WHEN dn.id IS NOT NULL THEN 'DEBIT_NOTE' ELSE 'RECEIVABLE' END", 'itemType')
      .addSelect('j.jobCode', 'jobCode')
      .addSelect('COALESCE(dn.description, r.description)', 'description')
      .addSelect('CASE WHEN dn.id IS NOT NULL THEN GREATEST(dn.amount - dn.paidAmount, 0) ELSE r.localAmount END', 'amount')
      .addSelect('COALESCE(dn.dueDate, r.dueDate)', 'dueDate')
      .addSelect('CASE WHEN COALESCE(dn.dueDate, r.dueDate) < :today THEN 1 ELSE 0 END', 'isOverdue')
      .where('j.partnerId = :partnerId', { partnerId })
      .andWhere('r.status = :status', { status: AccountingStatus.POSTED })
      .andWhere('r.paymentStatus != :paid', { paid: PaymentStatus.PAID })
      .setParameter('today', today)
      .orderBy('COALESCE(dn.dueDate, r.dueDate)', 'ASC')
      .addOrderBy('r.id', 'ASC')
      .getRawMany();

    return {
      data: rows.map((row) => ({
        ...row,
        id: Number(row.id),
        amount: Number(row.amount || 0),
        isOverdue: Boolean(Number(row.isOverdue)),
      })),
      meta: { total: rows.length, page: 1, limit: rows.length, totalPages: rows.length ? 1 : 0 },
    };
  }

  private async getDebtCustomerRows() {
    const today = this.toDateOnly(new Date());
    const rows = await this.partnerRepo.createQueryBuilder('p')
      .leftJoin(DebtPolicy, 'dp', 'dp.partnerId = p.id AND dp.isActive = :active AND dp.startDate <= :today AND (dp.endDate IS NULL OR dp.endDate >= :today)')
      .leftJoin(Job, 'j', 'j.partnerId = p.id')
      .leftJoin(RevenueEntry, 'r', 'r.jobId = j.id AND r.status = :posted AND r.paymentStatus != :paid')
      .leftJoin(DebitNote, 'dn', 'dn.receivableEntryId = r.id')
      .select('p.id', 'id')
      .addSelect('p.name', 'name')
      .addSelect('MAX(dp.maxDebtAmount)', 'creditLimit')
      .addSelect('COALESCE(SUM(CASE WHEN r.id IS NULL THEN 0 WHEN dn.id IS NOT NULL THEN GREATEST(dn.amount - dn.paidAmount, 0) ELSE r.localAmount END), 0)', 'currentDebt')
      .addSelect('COALESCE(SUM(CASE WHEN r.id IS NOT NULL AND COALESCE(dn.dueDate, r.dueDate) < :today THEN CASE WHEN dn.id IS NOT NULL THEN GREATEST(dn.amount - dn.paidAmount, 0) ELSE r.localAmount END ELSE 0 END), 0)', 'overdueDebt')
      .where('p.isActive = :active', { active: true })
      .andWhere('p.partnerType IN (:...partnerTypes)', { partnerTypes: [PartnerType.CUSTOMER, PartnerType.BOTH] })
      .setParameters({ today, posted: AccountingStatus.POSTED, paid: PaymentStatus.PAID })
      .groupBy('p.id')
      .addGroupBy('p.name')
      .orderBy('currentDebt', 'DESC')
      .addOrderBy('p.name', 'ASC')
      .getRawMany();

    return rows.map((row) => {
      const currentDebt = Number(row.currentDebt || 0);
      const creditLimit = row.creditLimit == null ? null : Number(row.creditLimit);
      const overdueDebt = Number(row.overdueDebt || 0);
      const usagePercent = creditLimit && creditLimit > 0 ? (currentDebt / creditLimit) * 100 : null;
      let status = 'normal';
      if (overdueDebt > 0) status = 'overdue';
      else if (usagePercent !== null && usagePercent >= 100) status = 'over_limit';
      else if (usagePercent !== null && usagePercent >= 80) status = 'near_limit';
      return { id: Number(row.id), name: row.name, currentDebt, creditLimit, usagePercent, overdueDebt, status };
    });
  }

  private serializePolicy(policy: DebtPolicy) {
    return {
      id: policy.id,
      partnerId: policy.partnerId,
      startDate: policy.startDate,
      endDate: policy.endDate,
      maxDebtAmount: policy.maxDebtAmount == null ? null : Number(policy.maxDebtAmount),
      maxDebtAgeDays: policy.maxDebtAgeDays == null ? null : Number(policy.maxDebtAgeDays),
      isActive: policy.isActive,
    };
  }

  private async resolveCurrentJobCreatedAt(currentJobId?: number, currentJobCreatedAt?: Date | string | null) {
    if (currentJobCreatedAt) return new Date(currentJobCreatedAt);
    if (currentJobId) return (await this.jobRepo.findOne({ where: { id: currentJobId } }))?.createdAt || new Date();
    return new Date();
  }

  private isWithinPolicyWindow(dateValue: Date, startDate: string, endDate: string | null) {
    const dateOnly = this.toDateOnly(dateValue);
    return dateOnly >= startDate && (!endDate || dateOnly <= endDate);
  }

  private toDateOnly(value: Date | string) {
    const date = new Date(value);
    const year = date.getFullYear();
    const month = `${date.getMonth() + 1}`.padStart(2, '0');
    const day = `${date.getDate()}`.padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
}

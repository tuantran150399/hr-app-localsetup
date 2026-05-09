import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { CashAccount } from '../../models/cash-account.entity';
import { CashTransaction, CashTransactionType } from '../../models/cash-transaction.entity';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { paginate, getSkip } from '../../common/utils/pagination.util';
import { CashAccountFilterDto, CashTransactionFilterDto, CreateCashAccountDto, CreateCashTransactionDto, UpdateCashAccountDto } from './dto/treasury.dto';

@Injectable()
export class TreasuryService {
  constructor(
    @InjectRepository(CashAccount) private accountRepo: Repository<CashAccount>,
    @InjectRepository(CashTransaction) private txRepo: Repository<CashTransaction>,
    private dataSource: DataSource,
    private auditLogs: AuditLogsService,
  ) {}

  async createAccount(dto: CreateCashAccountDto, actorId: number) {
    const exists = await this.accountRepo.findOne({ where: { code: dto.code } });
    if (exists) throw new ConflictException('Cash account code already exists');
    const account = await this.accountRepo.save(this.accountRepo.create({ ...dto, createdBy: actorId, updatedBy: actorId }));
    await this.auditLogs.log({ entityName: 'CashAccount', entityId: account.id, action: 'CREATE', userId: actorId, newValues: account });
    return account;
  }

  async findAccounts(filter: CashAccountFilterDto = {}) {
    const { page = 1, limit = 20, keyword, type, isActive } = filter;
    const qb = this.accountRepo.createQueryBuilder('a');
    if (keyword) qb.andWhere('(a.code LIKE :kw OR a.name LIKE :kw OR a.bankName LIKE :kw OR a.accountNumber LIKE :kw)', { kw: `%${keyword}%` });
    if (type) qb.andWhere('a.type = :type', { type });
    if (isActive !== undefined) qb.andWhere('a.isActive = :isActive', { isActive });
    qb.orderBy('a.createdAt', 'DESC').skip(getSkip(page, limit)).take(limit);
    return paginate(await qb.getManyAndCount(), page, limit);
  }

  async findAccount(id: number) {
    const account = await this.accountRepo.findOne({ where: { id } });
    if (!account) throw new NotFoundException('Cash account not found');
    return account;
  }

  async updateAccount(id: number, dto: UpdateCashAccountDto, actorId: number) {
    const current = await this.findAccount(id);
    const updated = await this.accountRepo.save({ ...current, ...dto, updatedBy: actorId });
    await this.auditLogs.log({ entityName: 'CashAccount', entityId: id, action: 'UPDATE', userId: actorId, oldValues: current, newValues: updated });
    return updated;
  }

  async createTransaction(dto: CreateCashTransactionDto, actorId: number) {
    const result = await this.dataSource.transaction(async (em) => {
      const account = await em.findOne(CashAccount, { where: { id: dto.cashAccountId } });
      if (!account || !account.isActive) throw new BadRequestException('Active cash account not found');
      const signedAmount = this.signedAmount(dto.transactionType, Number(dto.amount));
      const nextBalance = Number(account.balance ?? 0) + signedAmount;
      if (nextBalance < 0) throw new BadRequestException('Cash account balance cannot be negative');
      const tx = await em.save(CashTransaction, em.create(CashTransaction, { ...dto, currency: dto.currency ?? account.currency, createdBy: actorId, updatedBy: actorId }));
      await em.save(CashAccount, { ...account, balance: nextBalance, updatedBy: actorId });
      return tx;
    });
    await this.auditLogs.log({ entityName: 'CashTransaction', entityId: result.id, action: 'CREATE', userId: actorId, newValues: result });
    return result;
  }

  async findTransactions(filter: CashTransactionFilterDto = {}) {
    const { page = 1, limit = 20, keyword, cashAccountId, transactionType, dateFrom, dateTo } = filter;
    const qb = this.txRepo.createQueryBuilder('t');
    if (keyword) qb.andWhere('(t.description LIKE :kw OR t.referenceType LIKE :kw OR t.notes LIKE :kw)', { kw: `%${keyword}%` });
    if (cashAccountId) qb.andWhere('t.cashAccountId = :cashAccountId', { cashAccountId });
    if (transactionType) qb.andWhere('t.transactionType = :transactionType', { transactionType });
    if (dateFrom) qb.andWhere('t.transactionDate >= :dateFrom', { dateFrom });
    if (dateTo) qb.andWhere('t.transactionDate <= :dateTo', { dateTo });
    qb.orderBy('t.transactionDate', 'DESC').addOrderBy('t.createdAt', 'DESC').skip(getSkip(page, limit)).take(limit);
    return paginate(await qb.getManyAndCount(), page, limit);
  }

  async balances() {
    return this.accountRepo.find({ where: { isActive: true }, order: { code: 'ASC' } });
  }

  private signedAmount(type: CashTransactionType, amount: number) {
    if (type === CashTransactionType.RECEIPT) return amount;
    if (type === CashTransactionType.PAYMENT) return -amount;
    return amount;
  }
}

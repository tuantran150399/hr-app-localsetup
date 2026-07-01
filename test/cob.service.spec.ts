import { describe, expect, it, jest } from '@jest/globals';
import { BadRequestException } from '@nestjs/common';
import { CobService } from '../src/business/cob/cob.service';
import { CobStatus, CobType } from '../src/models/cob-entry.entity';
import { AccountingStatus, PaymentStatus } from '../src/models/revenue-entry.entity';

describe('CobService void operations', () => {
  function createService() {
    const service: any = Object.create(CobService.prototype);
    service.customerDebtService = { refreshPartnerActualDebt: jest.fn<() => Promise<void>>().mockResolvedValue(undefined) };
    service.auditSvc = { log: jest.fn<() => Promise<void>>().mockResolvedValue(undefined) };
    service.dataSource = {
      transaction: jest.fn(async (runner: (em: any) => Promise<any>) => runner(service.entityManager)),
    };
    service.entityManager = {
      findOne: jest.fn<() => Promise<any>>(),
      find: jest.fn<() => Promise<any[]>>(),
      save: jest.fn<() => Promise<any>>(),
    };
    return service;
  }

  it('voids charge-on-behalf together with paired collect and receivable', async () => {
    const service = createService();
    const charge = {
      id: 10,
      type: CobType.CHARGE_ON_BEHALF,
      status: CobStatus.OPEN,
      relatedCobEntryId: 20,
      receivableEntryId: 30,
      partnerId: 99,
      updatedBy: null,
    };
    const collect = {
      id: 20,
      type: CobType.COLLECT_ON_BEHALF,
      status: CobStatus.OPEN,
      relatedCobEntryId: 10,
      updatedBy: null,
    };
    const receivable = {
      id: 30,
      status: AccountingStatus.POSTED,
      paymentStatus: PaymentStatus.UNPAID,
      updatedBy: null,
    };

    service.entityManager.findOne
      .mockResolvedValueOnce(charge)
      .mockResolvedValueOnce(receivable);
    service.entityManager.find.mockResolvedValue([collect]);
    service.entityManager.save.mockImplementation(async (_entity: any, payload: any) => payload);

    const result = await service.voidCob(10, 'cleanup', 7);

    expect(result.status).toBe(CobStatus.VOIDED);
    expect(collect.status).toBe(CobStatus.VOIDED);
    expect(service.customerDebtService.refreshPartnerActualDebt).toHaveBeenCalledWith(99);
    expect(service.auditSvc.log).toHaveBeenCalled();
    expect(service.entityManager.save).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      id: 30,
      status: AccountingStatus.VOIDED,
    }));
  });

  it('rejects voiding a paired collect-on-behalf directly', async () => {
    const service = createService();
    service.entityManager.findOne.mockResolvedValue({
      id: 22,
      type: CobType.COLLECT_ON_BEHALF,
      status: CobStatus.OPEN,
      relatedCobEntryId: 10,
    });

    await expect(service.voidCollect(22, 'cleanup', 7)).rejects.toBeInstanceOf(BadRequestException);
  });
});

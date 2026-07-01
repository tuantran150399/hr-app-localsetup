import { describe, expect, it, jest } from '@jest/globals';
import { CustomerDebtService } from '../src/business/customer-debt/customer-debt.service';

describe('CustomerDebtService Debit preview', () => {
  function createService() {
    const service: any = Object.create(CustomerDebtService.prototype);
    service.getActivePolicy = jest.fn<() => Promise<any>>().mockResolvedValue({
      id: 1,
      partnerId: 10,
      startDate: new Date('2026-01-01'),
      endDate: null,
      maxDebtAmount: 300_000_000,
      maxDebtAgeDays: 30,
      isActive: true,
    });
    service.getOutstandingDebt = jest.fn<() => Promise<number>>();
    service.debitNoteRepo = { findOne: jest.fn<() => Promise<any>>() };
    service.cobRepo = { find: jest.fn<() => Promise<any[]>>() };
    service.revenueRepo = {};
    return service;
  }

  it('replaces a standalone COB receivable instead of counting it twice', async () => {
    const service = createService();
    service.getOutstandingDebt
      .mockResolvedValueOnce(10_000_000)
      .mockResolvedValueOnce(0);
    service.cobRepo.find.mockResolvedValue([{ id: 7, partnerId: 10, receivableEntryId: 70, amount: 10_000_000 }]);

    const result = await service.previewDebitDebt({
      partnerId: 10,
      amount: 160_000_000,
      cobEntryIds: [7],
    });

    expect(result.currentDebt).toBe(10_000_000);
    expect(result.projectedDebt).toBe(160_000_000);
    expect(result.exceedsLimit).toBe(false);
  });

  it('rejects a Debit whose projected debt exceeds the policy', async () => {
    const service = createService();
    service.getOutstandingDebt.mockResolvedValue(0);

    const result = await service.previewDebitDebt({ partnerId: 10, amount: 500_000_000 });

    expect(result.projectedDebt).toBe(500_000_000);
    expect(result.exceedsLimit).toBe(true);
    expect(result.exceededBy).toBe(200_000_000);
  });
});

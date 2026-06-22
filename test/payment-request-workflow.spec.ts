import { describe, expect, it, jest } from '@jest/globals';
import { ForbiddenException } from '@nestjs/common';
import { PaymentRequestsService } from '../src/business/payment-requests/payment-requests.service';
import { PaymentRequestStatus } from '../src/models/payment-request.entity';

function setup(currentStatus: PaymentRequestStatus) {
  const current = {
    id: 41,
    status: currentStatus,
    branchId: 1,
    createdBy: 10,
    departmentApprovedBy: currentStatus === PaymentRequestStatus.DEPARTMENT_APPROVED ? 20 : null,
    finalApprovedBy: currentStatus === PaymentRequestStatus.FINAL_APPROVED ? 30 : null,
    amount: 15000000,
    currency: 'VND',
    updatedAt: new Date(),
  };
  const entityManager = {
    findOne: jest.fn(async () => ({ ...current })),
    save: jest.fn(async (_entity: unknown, value: Record<string, unknown>) => value),
  };
  const dataSource = { transaction: jest.fn(async (callback: (em: any) => unknown) => callback(entityManager)) };
  const auditLogs = { log: jest.fn(async (value: any) => ({ ...value, id: 99 })), logAsync: jest.fn() };
  const notifications = { notifyMany: jest.fn(async (_ids: number[], _data: unknown) => []) };
  const service = new PaymentRequestsService(
    {} as any, {} as any, {} as any, {} as any, {} as any,
    dataSource as any, auditLogs as any, notifications as any,
  );
  jest.spyOn(service as any, 'findApprovers').mockResolvedValue([30]);
  return { service, auditLogs, notifications };
}

describe('payment request approval workflow', () => {
  it('moves a pending request to department-approved and notifies the next approver', async () => {
    const { service, auditLogs, notifications } = setup(PaymentRequestStatus.PENDING_DEPARTMENT_APPROVAL);
    const result = await service.approve(41, 'Hợp lệ', {
      id: 20, branchId: 1, permissions: ['payment-request:department-approve'],
    });

    expect(result.status).toBe(PaymentRequestStatus.DEPARTMENT_APPROVED);
    expect(auditLogs.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'DEPARTMENT_APPROVED' }));
    expect(notifications.notifyMany).toHaveBeenCalledTimes(1);
  });

  it('prevents final approval until department approval has completed', async () => {
    const { service } = setup(PaymentRequestStatus.PENDING_DEPARTMENT_APPROVAL);
    await expect(service.finalApprove(41, undefined, { id: 30, branchId: 1 })).rejects.toThrow(
      'Payment request must be department-approved first',
    );
  });

  it('requires the permission matching the current rejection stage', async () => {
    const { service } = setup(PaymentRequestStatus.DEPARTMENT_APPROVED);
    await expect(service.reject(41, 'Không hợp lệ', {
      id: 20, branchId: 1, permissions: ['payment-request:department-approve'],
    })).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('records final-stage rejection and notifies the requester', async () => {
    const { service, auditLogs, notifications } = setup(PaymentRequestStatus.DEPARTMENT_APPROVED);
    const result = await service.reject(41, 'Vượt ngân sách', {
      id: 30, branchId: 1, permissions: ['payment-request:final-approve'],
    });

    expect(result.status).toBe(PaymentRequestStatus.REJECTED_BY_DIRECTOR);
    expect(auditLogs.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'DIRECTOR_REJECTED' }));
    expect(notifications.notifyMany).toHaveBeenCalledWith([10, 20], expect.objectContaining({
      type: 'PAYMENT_REQUEST_REJECTED',
    }));
  });

  it('allows accounting to mark a finally-approved request as paid', async () => {
    const { service, auditLogs } = setup(PaymentRequestStatus.FINAL_APPROVED);
    const result = await service.markPaid(41, {
      id: 40, branchId: 1, permissions: ['payment-request:mark-paid'],
    });

    expect(result.status).toBe(PaymentRequestStatus.PAID);
    expect(auditLogs.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'PAYMENT_REQUEST_PAID' }));
  });
});

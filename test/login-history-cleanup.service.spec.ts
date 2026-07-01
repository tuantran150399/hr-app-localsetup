import { describe, expect, it, jest } from '@jest/globals';
import { LoginHistoryCleanupService } from '../src/business/security/login-history-cleanup.service';

describe('LoginHistoryCleanupService', () => {
  it('deletes only records older than 31 days in configured batches', async () => {
    const query = jest.fn<(sql: string, params: unknown[]) => Promise<{ affectedRows: number }>>()
      .mockResolvedValueOnce({ affectedRows: 2 });
    const config = { get: jest.fn((_name: string, fallback: number) => fallback) };
    const service = new LoginHistoryCleanupService({ query } as any, config as any);
    const before = Date.now() - 31 * 24 * 60 * 60 * 1000;

    await expect(service.cleanup()).resolves.toBe(2);

    expect(query).toHaveBeenCalledTimes(1);
    const [sql, params] = query.mock.calls[0];
    expect(sql).toContain('created_at < ?');
    expect(sql).toContain('LIMIT ?');
    expect(params[1]).toBe(1000);
    expect((params[0] as Date).getTime()).toBeGreaterThanOrEqual(before - 1000);
    expect((params[0] as Date).getTime()).toBeLessThanOrEqual(Date.now() - 31 * 24 * 60 * 60 * 1000);
  });

  it('continues until a partial batch is deleted', async () => {
    const query = jest.fn<(sql: string, params: unknown[]) => Promise<{ affectedRows: number }>>()
      .mockResolvedValueOnce({ affectedRows: 100 })
      .mockResolvedValueOnce({ affectedRows: 4 });
    const config = { get: jest.fn((name: string, fallback: number) => name === 'LOGIN_HISTORY_CLEANUP_BATCH_SIZE' ? 100 : fallback) };
    const service = new LoginHistoryCleanupService({ query } as any, config as any);

    await expect(service.cleanup()).resolves.toBe(104);
    expect(query).toHaveBeenCalledTimes(2);
  });
});

import { describe, expect, it, jest } from '@jest/globals';
import { AuthController } from '../src/business/auth/auth.controller';

describe('AuthController client IP capture', () => {
  it('passes the trusted client address from the Express proxy chain to login security', async () => {
    const login = jest.fn<(...args: any[]) => Promise<unknown>>().mockResolvedValue({});
    const controller = new AuthController({ login } as any);
    const request = {
      ips: ['203.0.113.42', '10.0.0.5'],
      ip: '10.0.0.5',
      socket: { remoteAddress: '127.0.0.1' },
      headers: { 'user-agent': 'Test Browser' },
    } as any;

    await controller.login({ username: 'admin', password: 'secret' }, request);

    expect(login).toHaveBeenCalledWith(
      { username: 'admin', password: 'secret' },
      expect.objectContaining({ ipAddress: '203.0.113.42' }),
    );
  });
});

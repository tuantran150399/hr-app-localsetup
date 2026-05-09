import { describe, expect, it, jest } from '@jest/globals';
import { AuthController } from '../src/business/auth/auth.controller';
import { AccountController } from '../src/business/users/account.controller';

describe('backend compatibility endpoints', () => {
  it('POST /auth/logout returns a successful stateless logout response', () => {
    const controller = new AuthController({} as any);

    expect(controller.logout()).toEqual({ message: 'Logged out successfully' });
  });

  it('POST /auth/refresh delegates to AuthService.refresh', () => {
    const authService = {
      refresh: jest.fn().mockReturnValue({ accessToken: 'next-token' }),
    };
    const controller = new AuthController(authService as any);

    expect(controller.refresh({ refreshToken: 'refresh-token' })).toEqual({ accessToken: 'next-token' });
    expect(authService.refresh).toHaveBeenCalledWith('refresh-token');
  });

  it('POST /change-password delegates to UsersService.changePassword', () => {
    const usersService = {
      changePassword: jest.fn().mockReturnValue({ message: 'Password changed successfully' }),
    };
    const controller = new AccountController(usersService as any);
    const dto = { currentPassword: 'old-secret', newPassword: 'new-secret' };

    expect(controller.changePassword({ id: 7 }, dto)).toEqual({ message: 'Password changed successfully' });
    expect(usersService.changePassword).toHaveBeenCalledWith(7, dto);
  });
});

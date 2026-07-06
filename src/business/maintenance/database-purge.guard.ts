import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, timingSafeEqual } from 'crypto';
import { Request } from 'express';

@Injectable()
export class DatabasePurgeGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    if (this.config.get<string>('ENABLE_DATABASE_PURGE_API') !== 'true') {
      throw new NotFoundException();
    }

    const request = context.switchToHttp().getRequest<Request>();

    if (
      this.config.get<string>('NODE_ENV') === 'production' &&
      !request.secure
    ) {
      throw new ForbiddenException('HTTPS is required');
    }

    const expectedSecret = this.config.get<string>('DATABASE_ADMIN_KEY', '');
    const suppliedSecret = this.getHeader(request, 'x-database-admin-key');
    if (expectedSecret.length < 32 || !this.secretsMatch(suppliedSecret, expectedSecret)) {
      throw new ForbiddenException('Invalid database admin key');
    }

    return true;
  }

  private getHeader(request: Request, name: string): string {
    const value = request.headers[name];
    return Array.isArray(value) ? value[0] : value ?? '';
  }

  private secretsMatch(supplied: string, expected: string): boolean {
    const suppliedHash = createHash('sha256').update(supplied).digest();
    const expectedHash = createHash('sha256').update(expected).digest();
    return timingSafeEqual(suppliedHash, expectedHash);
  }
}

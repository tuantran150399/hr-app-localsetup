import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSIONS_KEY } from '../decorators/require-permission.decorator';
import { ROLES_KEY } from '../decorators/require-role.decorator';

@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    if (process.env.DISABLE_AUTH === 'true') return true;

    const required = this.reflector.getAllAndOverride<string[]>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required?.length) return true;

    const request = context.switchToHttp().getRequest();
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (requiredRoles?.length) {
      const userRoles: string[] = request.user?.roles ?? [];
      const hasRole = requiredRoles.some((role) => userRoles.includes(role));
      if (!hasRole) throw new ForbiddenException('Highest role required');
    }

    const userPermissions: string[] = request.user?.permissions ?? [];
    if (userPermissions.includes('*')) return true;

    const allowed = required.every((permission) => userPermissions.includes(permission));
    if (!allowed) throw new ForbiddenException('Missing required permission');
    return true;
  }
}

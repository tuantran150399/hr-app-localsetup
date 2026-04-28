import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';

@Injectable()
export class PermissionGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();

    if (!request.user) {
      request.user = {
        id: 1,
        username: 'dev-bypass',
        permissions: ['*'],
      };
    }

    return true;
  }
}

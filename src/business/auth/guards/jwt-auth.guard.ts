import { ExecutionContext, Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  canActivate(context: ExecutionContext) {
    if (process.env.DISABLE_AUTH === 'true') {
      const request = context.switchToHttp().getRequest();
      request.user = {
        id: Number(process.env.DISABLE_AUTH_USER_ID ?? 1),
        sub: Number(process.env.DISABLE_AUTH_USER_ID ?? 1),
        username: 'auth-disabled',
        roles: ['TEST'],
        permissions: ['*'],
      };
      return true;
    }

    return super.canActivate(context);
  }
}

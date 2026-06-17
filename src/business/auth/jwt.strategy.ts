import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../../models/user.entity';
import { isUserBlocked } from '../../common/auth/user-access.util';

export interface JwtPayload {
  sub: number;
  username: string;
  roles: string[];
  permissions: string[];
  branchId?: number | null;
  canAccessAllBranches?: boolean;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private configService: ConfigService,
    @InjectRepository(User)
    private userRepo: Repository<User>,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_SECRET'),
    });
  }

  async validate(payload: JwtPayload) {
    const user = await this.userRepo.findOne({ where: { id: payload.sub, isActive: true } });
    if (!user) throw new UnauthorizedException();
    if (isUserBlocked(user)) throw new UnauthorizedException('Account is blocked');
    const roles = (user.roles || []).map((role) => role.name);
    return {
      id: user.id,
      username: user.username,
      branchId: user.branchId,
      canAccessAllBranches: user.canAccessAllBranches,
      roles,
      permissions: payload.permissions,
    };
  }
}

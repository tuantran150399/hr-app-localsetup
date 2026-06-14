import { ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User } from '../../models/user.entity';
import { LoginDto } from './dto/login.dto';
import { JwtPayload } from './jwt.strategy';
import { LoginSecurityContext, SecurityService } from '../security/security.service';
import { isUserBlocked } from '../../common/auth/user-access.util';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private userRepo: Repository<User>,
    private jwtService: JwtService,
    private config: ConfigService,
    private securityService: SecurityService,
  ) {}

  async login(dto: LoginDto, securityContext: LoginSecurityContext = {}) {
    await this.securityService.enforceIpAccess(securityContext, dto.username);

    const user = await this.userRepo.findOne({
      where: { username: dto.username, isActive: true },
      relations: ['roles', 'roles.permissions'],
    });
    if (!user) {
      await this.securityService.recordFailedLogin(dto.username, securityContext, 'Invalid credentials');
      throw new UnauthorizedException('Invalid credentials');
    }
    const valid = await bcrypt.compare(dto.password, user.password);
    if (!valid) {
      await this.securityService.recordFailedLogin(dto.username, securityContext, 'Invalid credentials');
      throw new UnauthorizedException('Invalid credentials');
    }
    if (isUserBlocked(user)) {
      await this.securityService.recordFailedLogin(dto.username, securityContext, 'Account blocked');
      throw new ForbiddenException('Account is blocked. Please contact your administrator.');
    }

    const payload = this.buildPayload(user);
    await this.securityService.recordSuccessfulLogin(user, securityContext);
    return {
      accessToken: this.signAccessToken(payload),
      refreshToken: this.signRefreshToken(payload),
      user: {
        id: user.id,
        username: user.username,
        fullName: user.fullName,
        email: user.email,
        branchId: user.branchId,
        canAccessAllBranches: user.canAccessAllBranches,
        roles: payload.roles,
        permissions: payload.permissions,
      },
    };
  }

  async refresh(refreshToken: string) {
    try {
      const decoded = await this.jwtService.verifyAsync<JwtPayload & { typ?: string }>(
        refreshToken,
        { secret: this.config.get<string>('JWT_SECRET') },
      );
      if (decoded.typ !== 'refresh') throw new UnauthorizedException('Invalid refresh token');

      const user = await this.userRepo.findOne({
        where: { id: decoded.sub, isActive: true },
        relations: ['roles', 'roles.permissions'],
      });
      if (!user) throw new UnauthorizedException('Invalid refresh token');
      if (isUserBlocked(user)) throw new UnauthorizedException('Account is blocked');

      const payload = this.buildPayload(user);
      return {
        accessToken: this.signAccessToken(payload),
        refreshToken: this.signRefreshToken(payload),
      };
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  async getMe(userId: number) {
    const user = await this.userRepo.findOne({
      where: { id: userId, isActive: true },
      relations: ['roles', 'roles.permissions'],
    });
    if (!user) throw new UnauthorizedException();
    if (isUserBlocked(user)) throw new UnauthorizedException('Account is blocked');
    const payload = this.buildPayload(user);
    return {
      id: user.id,
      username: user.username,
      fullName: user.fullName,
      email: user.email,
      branchId: user.branchId,
      canAccessAllBranches: user.canAccessAllBranches,
      roles: payload.roles,
      permissions: payload.permissions,
    };
  }

  private buildPayload(user: User): JwtPayload {
    const roles = user.roles.map((r) => r.name);
    const permissionSet = new Set<string>();
    user.roles.forEach((r) => r.permissions?.forEach((p) => permissionSet.add(p.name)));
    return {
      sub: user.id,
      username: user.username,
      branchId: user.branchId,
      canAccessAllBranches: user.canAccessAllBranches,
      roles,
      permissions: Array.from(permissionSet),
    };
  }

  private signAccessToken(payload: JwtPayload) {
    return this.jwtService.sign(payload);
  }

  private signRefreshToken(payload: JwtPayload) {
    return this.jwtService.sign(
      { ...payload, typ: 'refresh' },
      { expiresIn: this.config.get<string>('JWT_REFRESH_EXPIRES_IN', '7d') as any },
    );
  }
}

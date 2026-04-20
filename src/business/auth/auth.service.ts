import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User } from '../../models/user.entity';
import { LoginDto } from './dto/login.dto';
import { JwtPayload } from './jwt.strategy';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private userRepo: Repository<User>,
    private jwtService: JwtService,
  ) {}

  async login(dto: LoginDto) {
    const user = await this.userRepo.findOne({
      where: { username: dto.username, isActive: true },
      relations: ['roles', 'roles.permissions'],
    });
    if (!user) throw new UnauthorizedException('Invalid credentials');
    const valid = await bcrypt.compare(dto.password, user.password);
    if (!valid) throw new UnauthorizedException('Invalid credentials');

    const roles = user.roles.map((r) => r.name);
    const permissionSet = new Set<string>();
    user.roles.forEach((r) => r.permissions?.forEach((p) => permissionSet.add(p.name)));
    const permissions = Array.from(permissionSet);

    const payload: JwtPayload = { sub: user.id, username: user.username, roles, permissions };
    return {
      accessToken: this.jwtService.sign(payload),
      user: {
        id: user.id,
        username: user.username,
        fullName: user.fullName,
        email: user.email,
        roles,
        permissions,
      },
    };
  }

  async getMe(userId: number) {
    const user = await this.userRepo.findOne({
      where: { id: userId },
      relations: ['roles', 'roles.permissions'],
    });
    if (!user) throw new UnauthorizedException();
    const roles = user.roles.map((r) => r.name);
    const permissionSet = new Set<string>();
    user.roles.forEach((r) => r.permissions?.forEach((p) => permissionSet.add(p.name)));
    return {
      id: user.id,
      username: user.username,
      fullName: user.fullName,
      email: user.email,
      branchId: user.branchId,
      roles,
      permissions: Array.from(permissionSet),
    };
  }
}
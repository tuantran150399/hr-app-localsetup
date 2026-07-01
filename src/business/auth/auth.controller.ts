import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { CurrentUser } from './decorators/current-user.decorator';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('login')
  login(@Body() dto: LoginDto, @Req() req: Request) {
    return this.authService.login(dto, {
      ipAddress: this.getClientIp(req),
      userAgent: this.getHeader(req, 'user-agent'),
      countryCode: this.getHeader(req, 'cf-ipcountry') || this.getHeader(req, 'x-country-code'),
      locationLabel: this.getHeader(req, 'x-location-label'),
    });
  }

  @Post('refresh')
  refresh(@Body() dto: RefreshTokenDto) {
    return this.authService.refresh(dto.refreshToken);
  }

  @UseGuards(JwtAuthGuard)
  @Post('logout')
  logout() {
    return { message: 'Logged out successfully' };
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  getMe(@CurrentUser() user: { id: number }) {
    return this.authService.getMe(user.id);
  }

  private getClientIp(req: Request) {
    // Express derives req.ip from the socket and the centrally configured
    // TRUST_PROXY_HOPS value. Reading forwarding headers directly here would
    // let an untrusted client spoof its address and bypass an IP block.
    return req.ips?.[0] || req.ip || req.socket.remoteAddress;
  }

  private getHeader(req: Request, name: string) {
    const value = req.headers[name];
    return Array.isArray(value) ? value[0] : value;
  }
}

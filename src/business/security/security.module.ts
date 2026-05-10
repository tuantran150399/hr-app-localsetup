import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { IpAccessRule } from '../../models/ip-access-rule.entity';
import { SecurityAlert } from '../../models/security-alert.entity';
import { SecurityLoginEvent } from '../../models/security-login-event.entity';
import { SecurityController } from './security.controller';
import { SecurityService } from './security.service';

@Module({
  imports: [TypeOrmModule.forFeature([SecurityLoginEvent, SecurityAlert, IpAccessRule])],
  controllers: [SecurityController],
  providers: [SecurityService],
  exports: [SecurityService],
})
export class SecurityModule {}

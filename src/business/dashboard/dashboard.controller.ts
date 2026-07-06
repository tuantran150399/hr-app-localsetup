import { Controller, Get, UseGuards } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../common/auth/branch-scope.util';

@UseGuards(JwtAuthGuard)
@Controller('dashboard')
export class DashboardController {
  constructor(private svc: DashboardService) {}

  @Get('stats')
  getStats() {
    return this.svc.getStats();
  }

  @Get('completed-jobs-profit')
  getCompletedJobsProfit(@CurrentUser() user: AuthenticatedUser) {
    return this.svc.getCompletedJobsProfit(user);
  }
}

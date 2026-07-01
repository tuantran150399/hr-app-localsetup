import { Controller, Get, Param, ParseIntPipe, Query, UseGuards } from '@nestjs/common';
import { CustomerDebtService } from './customer-debt.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../auth/guards/permission.guard';
import { RequirePermission } from '../auth/decorators/require-permission.decorator';

@UseGuards(JwtAuthGuard, PermissionGuard)
@RequirePermission('partner:manage')
@Controller('debts')
export class CustomerDebtController {
  constructor(private readonly service: CustomerDebtService) {}

  @Get('summary')
  getSummary() {
    return this.service.getDebtSummary();
  }

  @Get('customers')
  getCustomers(
    @Query('status') status?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.service.getDebtCustomers({ status, page: Number(page), limit: Number(limit) });
  }

  @Get('customers/:partnerId/items')
  getCustomerItems(@Param('partnerId', ParseIntPipe) partnerId: number) {
    return this.service.getDebtItems(partnerId);
  }
}

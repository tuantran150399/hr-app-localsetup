import { Body, Controller, Get, Param, ParseIntPipe, Post, Query, UseGuards } from '@nestjs/common';
import { DebtPoliciesService } from './debt-policies.service';
import { DebtPolicyFilterDto, UpsertDebtPolicyDto } from './dto/debt-policy.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../auth/guards/permission.guard';
import { RequirePermission } from '../auth/decorators/require-permission.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@UseGuards(JwtAuthGuard, PermissionGuard)
@Controller('debt-policies')
export class DebtPoliciesController {
  constructor(private svc: DebtPoliciesService) {}

  @RequirePermission('partner:manage')
  @Post()
  upsert(@Body() dto: UpsertDebtPolicyDto, @CurrentUser() user: { id: number }) {
    return this.svc.upsert(dto, user.id);
  }

  @RequirePermission('partner:manage')
  @Get()
  findAll(@Query() filter: DebtPolicyFilterDto) {
    return this.svc.findAll(filter);
  }

  @RequirePermission('partner:manage')
  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.svc.findOne(id);
  }
}

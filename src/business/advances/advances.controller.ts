import { Body, Controller, Get, Param, ParseIntPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { AdvancesService } from './advances.service';
import { AdvanceFilterDto, CreateAdvanceDto, RejectAdvanceDto, SettleAdvanceDto } from './dto/advance.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../auth/guards/permission.guard';
import { RequirePermission } from '../auth/decorators/require-permission.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@UseGuards(JwtAuthGuard, PermissionGuard)
@Controller('advances')
export class AdvancesController {
  constructor(private svc: AdvancesService) {}

  @RequirePermission('advance:manage')
  @Post()
  create(@Body() dto: CreateAdvanceDto, @CurrentUser() user: { id: number }) {
    return this.svc.create(dto, user.id);
  }

  @RequirePermission('advance:view')
  @Get()
  findAll(@Query() filter: AdvanceFilterDto) {
    return this.svc.findAll(filter);
  }

  @RequirePermission('advance:view')
  @Get('overdue')
  overdue() {
    return this.svc.overdue();
  }

  @RequirePermission('advance:view')
  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.svc.findOne(id);
  }

  @RequirePermission('advance:manage')
  @Patch(':id/approve')
  approve(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: { id: number }) {
    return this.svc.approve(id, user.id);
  }

  @RequirePermission('advance:manage')
  @Patch(':id/reject')
  reject(@Param('id', ParseIntPipe) id: number, @Body() dto: RejectAdvanceDto, @CurrentUser() user: { id: number }) {
    return this.svc.reject(id, dto, user.id);
  }

  @RequirePermission('advance:manage')
  @Patch(':id/settle')
  settle(@Param('id', ParseIntPipe) id: number, @Body() dto: SettleAdvanceDto, @CurrentUser() user: { id: number }) {
    return this.svc.settle(id, dto, user.id);
  }
}

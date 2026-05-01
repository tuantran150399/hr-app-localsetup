import { Body, Controller, Get, Param, ParseIntPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { PaymentRequestsService } from './payment-requests.service';
import { CreatePaymentRequestDto, PaymentRequestFilterDto, RejectPaymentRequestDto } from './dto/payment-request.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../auth/guards/permission.guard';
import { RequirePermission } from '../auth/decorators/require-permission.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@UseGuards(JwtAuthGuard, PermissionGuard)
@Controller('payment-requests')
export class PaymentRequestsController {
  constructor(private svc: PaymentRequestsService) {}

  @RequirePermission('accounting:create')
  @Post()
  create(@Body() dto: CreatePaymentRequestDto, @CurrentUser() user: { id: number }) {
    return this.svc.create(dto, user.id);
  }

  @RequirePermission('accounting:view')
  @Get()
  findAll(@Query() filter: PaymentRequestFilterDto) {
    return this.svc.findAll(filter);
  }

  @RequirePermission('accounting:view')
  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.svc.findOne(id);
  }

  @RequirePermission('accounting:post')
  @Patch(':id/approve')
  approve(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: { id: number }) {
    return this.svc.approve(id, user.id);
  }

  @RequirePermission('accounting:post')
  @Patch(':id/reject')
  reject(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: RejectPaymentRequestDto,
    @CurrentUser() user: { id: number },
  ) {
    return this.svc.reject(id, dto.reason, user.id);
  }

  @RequirePermission('accounting:post')
  @Patch(':id/final-approve')
  finalApprove(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: { id: number }) {
    return this.svc.finalApprove(id, user.id);
  }
}

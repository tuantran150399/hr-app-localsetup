import { Body, Controller, Get, Param, ParseIntPipe, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { PaymentRequestsService } from './payment-requests.service';
import { ApprovePaymentRequestDto, CreatePaymentRequestDto, PaymentRequestFilterDto, RejectPaymentRequestDto } from './dto/payment-request.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../auth/guards/permission.guard';
import { RequirePermission } from '../auth/decorators/require-permission.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../common/auth/branch-scope.util';

@UseGuards(JwtAuthGuard, PermissionGuard)
@Controller('payment-requests')
export class PaymentRequestsController {
  constructor(private svc: PaymentRequestsService) {}

  @RequirePermission('payment-request:create')
  @Post()
  create(@Body() dto: CreatePaymentRequestDto, @CurrentUser() user: AuthenticatedUser, @Req() req: Request) {
    return this.svc.create(dto, user, this.requestContext(req));
  }

  @RequirePermission('payment-request:view')
  @Get()
  findAll(@Query() filter: PaymentRequestFilterDto, @CurrentUser() user: { id: number; branchId?: number; roles?: string[] }) {
    return this.svc.findAll(filter, user);
  }

  @RequirePermission('payment-request:view')
  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: { id: number; branchId?: number; roles?: string[] }) {
    return this.svc.findOne(id, user);
  }

  @RequirePermission('payment-request:department-approve')
  @Patch(':id/approve')
  approve(@Param('id', ParseIntPipe) id: number, @Body() dto: ApprovePaymentRequestDto, @CurrentUser() user: AuthenticatedUser, @Req() req: Request) {
    return this.svc.approve(id, dto.comment, user, this.requestContext(req));
  }

  @Patch(':id/reject')
  reject(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: RejectPaymentRequestDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    return this.svc.reject(id, dto.reason, user, this.requestContext(req));
  }

  @RequirePermission('payment-request:final-approve')
  @Patch(':id/final-approve')
  finalApprove(@Param('id', ParseIntPipe) id: number, @Body() dto: ApprovePaymentRequestDto, @CurrentUser() user: AuthenticatedUser, @Req() req: Request) {
    return this.svc.finalApprove(id, dto.comment, user, this.requestContext(req));
  }

  @RequirePermission('payment-request:mark-paid')
  @Patch(':id/mark-paid')
  markPaid(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: AuthenticatedUser, @Req() req: Request) {
    return this.svc.markPaid(id, user, this.requestContext(req));
  }

  private requestContext(req: Request) {
    const forwarded = req.headers['x-forwarded-for'];
    return {
      ipAddress: (Array.isArray(forwarded) ? forwarded[0] : forwarded?.split(',')[0]) || req.ip || req.socket.remoteAddress,
      userAgent: req.headers['user-agent'],
    };
  }
}

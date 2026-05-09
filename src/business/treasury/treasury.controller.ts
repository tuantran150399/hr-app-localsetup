import { Body, Controller, Get, Param, ParseIntPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { TreasuryService } from './treasury.service';
import { CashAccountFilterDto, CashTransactionFilterDto, CreateCashAccountDto, CreateCashTransactionDto, UpdateCashAccountDto } from './dto/treasury.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../auth/guards/permission.guard';
import { RequirePermission } from '../auth/decorators/require-permission.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@UseGuards(JwtAuthGuard, PermissionGuard)
@Controller('treasury')
export class TreasuryController {
  constructor(private svc: TreasuryService) {}

  @RequirePermission('treasury:manage')
  @Post('accounts')
  createAccount(@Body() dto: CreateCashAccountDto, @CurrentUser() user: { id: number }) {
    return this.svc.createAccount(dto, user.id);
  }

  @RequirePermission('treasury:view')
  @Get('accounts')
  findAccounts(@Query() filter: CashAccountFilterDto) {
    return this.svc.findAccounts(filter);
  }

  @RequirePermission('treasury:view')
  @Get('accounts/:id')
  findAccount(@Param('id', ParseIntPipe) id: number) {
    return this.svc.findAccount(id);
  }

  @RequirePermission('treasury:manage')
  @Patch('accounts/:id')
  updateAccount(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateCashAccountDto, @CurrentUser() user: { id: number }) {
    return this.svc.updateAccount(id, dto, user.id);
  }

  @RequirePermission('treasury:manage')
  @Post('transactions')
  createTransaction(@Body() dto: CreateCashTransactionDto, @CurrentUser() user: { id: number }) {
    return this.svc.createTransaction(dto, user.id);
  }

  @RequirePermission('treasury:view')
  @Get('transactions')
  findTransactions(@Query() filter: CashTransactionFilterDto) {
    return this.svc.findTransactions(filter);
  }

  @RequirePermission('treasury:view')
  @Get('balances')
  balances() {
    return this.svc.balances();
  }
}

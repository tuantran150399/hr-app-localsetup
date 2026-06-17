import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Put, Query, Res, UseGuards } from '@nestjs/common';
import { Response } from 'express';
import { DebitNotesService } from './debit-notes.service';
import { CreateDebitNoteDto, UpdateDebitNoteDto, VoidDebitNoteDto, DebitNoteFilterDto, RecordDebitNotePaymentDto } from './dto/debit-note.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../auth/guards/permission.guard';
import { RequirePermission } from '../auth/decorators/require-permission.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../common/auth/branch-scope.util';

@UseGuards(JwtAuthGuard, PermissionGuard)
@Controller('debit-notes')
export class DebitNotesController {
  constructor(private svc: DebitNotesService) {}

  @RequirePermission('accounting:create')
  @Post()
  create(@Body() dto: CreateDebitNoteDto, @CurrentUser() user: AuthenticatedUser) {
    return this.svc.create(dto, user);
  }

  @RequirePermission('accounting:view')
  @Get()
  findAll(@Query() filter: DebitNoteFilterDto, @CurrentUser() user: AuthenticatedUser) {
    return this.svc.findAll(filter, user);
  }

  @RequirePermission('accounting:view')
  @Get('lookup-pricing')
  lookupPricing(@Query('partnerId') partnerId?: number, @Query('jobId') jobId?: number, @CurrentUser() user?: AuthenticatedUser) {
    return this.svc.lookupPricing(partnerId ? +partnerId : undefined, jobId ? +jobId : undefined, user);
  }

  @RequirePermission('accounting:view')
  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: AuthenticatedUser) {
    return this.svc.findOne(id, user);
  }

  @RequirePermission('accounting:view')
  @Get(':id/export/excel')
  async exportExcel(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: AuthenticatedUser, @Res() res: Response) {
    const exported = await this.svc.exportExcel(id, user);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${exported.fileName}"`);
    res.send(exported.buffer);
  }

  @RequirePermission('accounting:view')
  @Get(':id/export/pdf')
  async exportPdf(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: AuthenticatedUser, @Res() res: Response) {
    const exported = await this.svc.exportPdf(id, user);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${exported.fileName}"`);
    res.send(exported.buffer);
  }

  @RequirePermission('accounting:create')
  @Put(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateDebitNoteDto, @CurrentUser() user: AuthenticatedUser) {
    return this.svc.update(id, dto, user);
  }

  @RequirePermission('accounting:post')
  @Patch(':id/record-payment')
  recordPayment(@Param('id', ParseIntPipe) id: number, @Body() dto: RecordDebitNotePaymentDto, @CurrentUser() user: AuthenticatedUser) {
    return this.svc.recordPayment(id, dto, user);
  }

  @RequirePermission('accounting:post')
  @Patch(':id/post')
  post(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: AuthenticatedUser) {
    return this.svc.post(id, user);
  }

  @RequirePermission('accounting:post')
  @Post(':id/send')
  send(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: AuthenticatedUser) {
    return this.svc.send(id, user);
  }

  @RequirePermission('accounting:post')
  @Post(':id/void')
  void(@Param('id', ParseIntPipe) id: number, @Body() dto: VoidDebitNoteDto, @CurrentUser() user: AuthenticatedUser) {
    return this.svc.void(id, dto.reason, user);
  }

  @RequirePermission('accounting:create')
  @Delete(':id')
  delete(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: AuthenticatedUser) {
    return this.svc.delete(id, user);
  }
}

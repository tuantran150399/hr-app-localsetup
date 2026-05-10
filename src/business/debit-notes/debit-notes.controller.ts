import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Put, Query, UseGuards } from '@nestjs/common';
import { DebitNotesService } from './debit-notes.service';
import { CreateDebitNoteDto, UpdateDebitNoteDto, VoidDebitNoteDto, DebitNoteFilterDto } from './dto/debit-note.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../auth/guards/permission.guard';
import { RequirePermission } from '../auth/decorators/require-permission.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@UseGuards(JwtAuthGuard, PermissionGuard)
@Controller('debit-notes')
export class DebitNotesController {
  constructor(private svc: DebitNotesService) {}

  @RequirePermission('accounting:create')
  @Post()
  create(@Body() dto: CreateDebitNoteDto, @CurrentUser() user: { id: number }) {
    return this.svc.create(dto, user.id);
  }

  @RequirePermission('accounting:view')
  @Get()
  findAll(@Query() filter: DebitNoteFilterDto) {
    return this.svc.findAll(filter);
  }

  @RequirePermission('accounting:view')
  @Get('lookup-pricing')
  lookupPricing(@Query('partnerId') partnerId?: number, @Query('jobId') jobId?: number) {
    return this.svc.lookupPricing(partnerId ? +partnerId : undefined, jobId ? +jobId : undefined);
  }

  @RequirePermission('accounting:view')
  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.svc.findOne(id);
  }

  @RequirePermission('accounting:create')
  @Put(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateDebitNoteDto, @CurrentUser() user: { id: number }) {
    return this.svc.update(id, dto, user.id);
  }

  @RequirePermission('accounting:post')
  @Patch(':id/post')
  post(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: { id: number }) {
    return this.svc.post(id, user.id);
  }

  @RequirePermission('accounting:post')
  @Post(':id/send')
  send(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: { id: number }) {
    return this.svc.send(id, user.id);
  }

  @RequirePermission('accounting:post')
  @Post(':id/void')
  void(@Param('id', ParseIntPipe) id: number, @Body() dto: VoidDebitNoteDto, @CurrentUser() user: { id: number }) {
    return this.svc.void(id, dto.reason, user.id);
  }

  @RequirePermission('accounting:create')
  @Delete(':id')
  delete(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: { id: number }) {
    return this.svc.delete(id, user.id);
  }
}

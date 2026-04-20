import { Controller, Get, Post, Patch, Body, Param, ParseIntPipe, UseGuards } from '@nestjs/common';
import { JobsService } from './jobs.service';
import { CreateJobDto, UpdateJobDto } from './dto/job.dto';
import { JobStatus } from '../../models/job.entity';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../auth/guards/permission.guard';
import { RequirePermission } from '../auth/decorators/require-permission.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@UseGuards(JwtAuthGuard, PermissionGuard)
@Controller('jobs')
export class JobsController {
  constructor(private svc: JobsService) {}

  @RequirePermission('job:create')
  @Post()
  create(@Body() dto: CreateJobDto, @CurrentUser() user: { id: number }) {
    return this.svc.create(dto, user.id);
  }

  @Get()
  findAll() { return this.svc.findAll(); }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) { return this.svc.findOne(id); }

  @RequirePermission('job:edit')
  @Patch(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateJobDto, @CurrentUser() user: { id: number }) {
    return this.svc.update(id, dto, user.id);
  }

  @RequirePermission('job:close')
  @Patch(':id/close')
  close(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: { id: number }) {
    return this.svc.updateStatus(id, JobStatus.CLOSED, user.id);
  }

  @RequirePermission('job:edit')
  @Patch(':id/cancel')
  cancel(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: { id: number }) {
    return this.svc.updateStatus(id, JobStatus.CANCELLED, user.id);
  }

  @RequirePermission('job:edit')
  @Patch(':id/start')
  start(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: { id: number }) {
    return this.svc.updateStatus(id, JobStatus.IN_PROGRESS, user.id);
  }
}
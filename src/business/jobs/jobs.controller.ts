import { Controller, Get, Post, Put, Patch, Delete, Body, Param, ParseIntPipe, UseGuards, Query } from '@nestjs/common';
import { JobsService } from './jobs.service';
import { CreateJobDto, UpdateJobDto, JobFilterDto, CreateMilestoneDto, UpdateMilestoneDto } from './dto/job.dto';
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
  create(@Body() dto: CreateJobDto, @CurrentUser() user: { id: number; branchId?: number; roles?: string[] }) {
    return this.svc.create(dto, user.id, user);
  }

  @Get()
  findAll(@Query() filter: JobFilterDto, @CurrentUser() user: { id: number; branchId?: number; roles?: string[] }) {
    return this.svc.findAll(filter, user);
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: { id: number; branchId?: number; roles?: string[] }) {
    return this.svc.findOne(id, user);
  }

  @RequirePermission('job:edit')
  @Patch(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateJobDto, @CurrentUser() user: { id: number; branchId?: number; roles?: string[] }) {
    return this.svc.update(id, dto, user.id, user);
  }

  @RequirePermission('job:edit')
  @Put(':id')
  replace(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateJobDto, @CurrentUser() user: { id: number; branchId?: number; roles?: string[] }) {
    return this.svc.update(id, dto, user.id, user);
  }

  @RequirePermission('job:create')
  @Post(':id/copy')
  copy(@Param('id', ParseIntPipe) id: number, @Body() dto: CreateJobDto, @CurrentUser() user: { id: number; branchId?: number; roles?: string[] }) {
    return this.svc.copy(id, dto, user.id, user);
  }

  @RequirePermission('job:edit')
  @Delete(':id')
  archive(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: { id: number; branchId?: number; roles?: string[] }) {
    return this.svc.archive(id, user.id, user);
  }

  @RequirePermission('job:close')
  @Patch(':id/close')
  close(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: { id: number; branchId?: number; roles?: string[] }) {
    return this.svc.updateStatus(id, JobStatus.CLOSED, user.id, user);
  }

  @RequirePermission('job:edit')
  @Patch(':id/cancel')
  cancel(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: { id: number; branchId?: number; roles?: string[] }) {
    return this.svc.updateStatus(id, JobStatus.CANCELLED, user.id, user);
  }

  @RequirePermission('job:edit')
  @Patch(':id/start')
  start(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: { id: number; branchId?: number; roles?: string[] }) {
    return this.svc.updateStatus(id, JobStatus.IN_PROGRESS, user.id, user);
  }

  @Get(':id/milestones')
  getMilestones(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: { id: number; branchId?: number; roles?: string[] }) {
    return this.svc.getMilestones(id, user);
  }

  @RequirePermission('job:edit')
  @Post(':id/milestones')
  addMilestone(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CreateMilestoneDto,
    @CurrentUser() user: { id: number; branchId?: number; roles?: string[] },
  ) {
    return this.svc.addMilestone(id, dto, user.id, user);
  }

  @RequirePermission('job:edit')
  @Patch(':id/milestones/:milestoneId')
  updateMilestone(
    @Param('id', ParseIntPipe) id: number,
    @Param('milestoneId', ParseIntPipe) milestoneId: number,
    @Body() dto: UpdateMilestoneDto,
    @CurrentUser() user: { id: number; branchId?: number; roles?: string[] },
  ) {
    return this.svc.updateMilestone(id, milestoneId, dto, user.id, user);
  }

  @RequirePermission('job:edit')
  @Delete(':id/milestones/:milestoneId')
  deleteMilestone(
    @Param('id', ParseIntPipe) id: number,
    @Param('milestoneId', ParseIntPipe) milestoneId: number,
    @CurrentUser() user: { id: number; branchId?: number; roles?: string[] },
  ) {
    return this.svc.deleteMilestone(id, milestoneId, user.id, user);
  }
}

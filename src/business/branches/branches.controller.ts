import { Controller, Get, Post, Patch, Body, Param, ParseIntPipe, UseGuards } from '@nestjs/common';
import { BranchesService } from './branches.service';
import { CreateBranchDto, UpdateBranchDto } from './dto/branch.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../auth/guards/permission.guard';
import { RequirePermission } from '../auth/decorators/require-permission.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@UseGuards(JwtAuthGuard, PermissionGuard)
@Controller('branches')
export class BranchesController {
  constructor(private svc: BranchesService) {}

  @RequirePermission('branch:manage')
  @Post()
  create(@Body() dto: CreateBranchDto, @CurrentUser() user: { id: number }) {
    return this.svc.create(dto, user.id);
  }

  @Get()
  findAll() { return this.svc.findAll(); }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) { return this.svc.findOne(id); }

  @RequirePermission('branch:manage')
  @Patch(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateBranchDto, @CurrentUser() user: { id: number }) {
    return this.svc.update(id, dto, user.id);
  }
}
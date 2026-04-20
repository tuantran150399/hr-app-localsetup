import { Controller, Get, Post, Patch, Body, Param, ParseIntPipe, UseGuards } from '@nestjs/common';
import { RolesService } from './roles.service';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../auth/guards/permission.guard';
import { RequirePermission } from '../auth/decorators/require-permission.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@UseGuards(JwtAuthGuard, PermissionGuard)
@Controller('roles')
export class RolesController {
  constructor(private rolesService: RolesService) {}

  @RequirePermission('role:manage')
  @Post()
  create(@Body() dto: CreateRoleDto, @CurrentUser() user: { id: number }) {
    return this.rolesService.create(dto, user.id);
  }

  @RequirePermission('role:manage')
  @Get()
  findAll() {
    return this.rolesService.findAll();
  }

  @RequirePermission('role:manage')
  @Get('permissions')
  findAllPermissions() {
    return this.rolesService.findAllPermissions();
  }

  @RequirePermission('role:manage')
  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.rolesService.findOne(id);
  }

  @RequirePermission('role:manage')
  @Patch(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateRoleDto, @CurrentUser() user: { id: number }) {
    return this.rolesService.update(id, dto, user.id);
  }
}
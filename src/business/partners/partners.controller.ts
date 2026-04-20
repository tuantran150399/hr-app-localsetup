import { Controller, Get, Post, Patch, Body, Param, ParseIntPipe, UseGuards, Query } from '@nestjs/common';
import { PartnersService } from './partners.service';
import { CreatePartnerDto, UpdatePartnerDto } from './dto/partner.dto';
import { PartnerType } from '../../models/partner.entity';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../auth/guards/permission.guard';
import { RequirePermission } from '../auth/decorators/require-permission.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@UseGuards(JwtAuthGuard, PermissionGuard)
@Controller('partners')
export class PartnersController {
  constructor(private svc: PartnersService) {}

  @RequirePermission('partner:manage')
  @Post()
  create(@Body() dto: CreatePartnerDto, @CurrentUser() user: { id: number }) {
    return this.svc.create(dto, user.id);
  }

  @Get()
  findAll(@Query('type') type?: PartnerType) { return this.svc.findAll(type); }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) { return this.svc.findOne(id); }

  @RequirePermission('partner:manage')
  @Patch(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdatePartnerDto, @CurrentUser() user: { id: number }) {
    return this.svc.update(id, dto, user.id);
  }
}
import { BadRequestException, Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Query, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { PricingService } from './pricing.service';
import { CreateServicePriceDto, PriceSuggestionDto, ServicePriceFilterDto, UpdateServicePriceDto } from './dto/pricing.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../auth/guards/permission.guard';
import { RequirePermission } from '../auth/decorators/require-permission.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

const MAX_IMPORT_FILE_SIZE = 10 * 1024 * 1024;

@UseGuards(JwtAuthGuard, PermissionGuard)
@Controller('pricing')
export class PricingController {
  constructor(private svc: PricingService) {}

  @RequirePermission('pricing:manage')
  @Post()
  create(@Body() dto: CreateServicePriceDto, @CurrentUser() user: { id: number }) {
    return this.svc.create(dto, user.id);
  }

  @RequirePermission('pricing:view')
  @Get()
  findAll(@Query() filter: ServicePriceFilterDto) {
    return this.svc.findAll(filter);
  }

  @RequirePermission('pricing:view')
  @Post('suggest')
  suggest(@Body() dto: PriceSuggestionDto) {
    return this.svc.suggest(dto);
  }

  @RequirePermission('pricing:view')
  @Get('lookup')
  lookup(@Query() query: { partnerId?: string; routeFrom?: string; routeTo?: string; shipmentMode?: string; serviceDate?: string }) {
    return this.svc.lookupBestMatches({
      partnerId: query.partnerId ? Number(query.partnerId) : undefined,
      routeFrom: query.routeFrom,
      routeTo: query.routeTo,
      shipmentMode: query.shipmentMode,
      serviceDate: query.serviceDate,
    });
  }

  @RequirePermission('pricing:manage')
  @Post('import')
  @UseInterceptors(FileInterceptor('file'))
  importPrices(@UploadedFile() file: Express.Multer.File, @CurrentUser() user: { id: number }) {
    if (!file) throw new BadRequestException('No file uploaded');
    if (file.size > MAX_IMPORT_FILE_SIZE) throw new BadRequestException('File exceeds 10 MB limit');
    return this.svc.importPrices(file.buffer, user.id);
  }

  @RequirePermission('pricing:view')
  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.svc.findOne(id);
  }

  @RequirePermission('pricing:manage')
  @Patch(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateServicePriceDto, @CurrentUser() user: { id: number }) {
    return this.svc.update(id, dto, user.id);
  }

  @RequirePermission('pricing:manage')
  @Delete(':id')
  deactivate(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: { id: number }) {
    return this.svc.deactivate(id, user.id);
  }
}

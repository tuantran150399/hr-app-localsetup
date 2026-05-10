import { Body, Controller, Get, Param, ParseIntPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { CobService } from './cob.service';
import { CreateCobDto, MarkCostAsCobDto, CobFilterDto } from './dto/cob.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../auth/guards/permission.guard';
import { RequirePermission } from '../auth/decorators/require-permission.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@UseGuards(JwtAuthGuard, PermissionGuard)
@Controller('accounting')
export class CobController {
  constructor(private svc: CobService) {}

  // ─── Charge-on-behalf ────────────────────────────────────────────────────

  @RequirePermission('accounting:view')
  @Get('cob')
  findCob(@Query() filter: CobFilterDto) {
    return this.svc.findCob(filter);
  }

  @RequirePermission('accounting:create')
  @Post('cob')
  createCob(@Body() dto: CreateCobDto, @CurrentUser() user: { id: number }) {
    return this.svc.createCob(dto, user.id);
  }

  @RequirePermission('accounting:post')
  @Post('cost/:costId/charge-on-behalf')
  markCostAsCob(
    @Param('costId', ParseIntPipe) costId: number,
    @Body() dto: MarkCostAsCobDto,
    @CurrentUser() user: { id: number },
  ) {
    return this.svc.markCostAsCob(costId, dto, user.id);
  }

  @RequirePermission('accounting:post')
  @Patch('cob/:id/settle')
  settleCob(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: { id: number }) {
    return this.svc.settleCob(id, user.id);
  }

  // ─── Collect-on-behalf ───────────────────────────────────────────────────

  @RequirePermission('accounting:view')
  @Get('collect-on-behalf')
  findCollect(@Query() filter: CobFilterDto) {
    return this.svc.findCollect(filter);
  }

  @RequirePermission('accounting:create')
  @Post('collect-on-behalf')
  createCollect(@Body() dto: CreateCobDto, @CurrentUser() user: { id: number }) {
    return this.svc.createCollect(dto, user.id);
  }

  @RequirePermission('accounting:post')
  @Patch('collect-on-behalf/:id/settle')
  settleCollect(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: { id: number }) {
    return this.svc.settleCollect(id, user.id);
  }
}

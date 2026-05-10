import { Controller, Delete, Get, Param, ParseIntPipe, Patch, Query, UseGuards } from '@nestjs/common';
import { NotificationsService, NotificationFilter } from './notifications.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@UseGuards(JwtAuthGuard)
@Controller('notifications')
export class NotificationsController {
  constructor(private svc: NotificationsService) {}

  @Get()
  findAll(@CurrentUser() user: { id: number }, @Query() filter: NotificationFilter) {
    return this.svc.findAll(user.id, filter);
  }

  @Get('unread-count')
  unreadCount(@CurrentUser() user: { id: number }) {
    return this.svc.getUnreadCount(user.id);
  }

  @Get('entity/:entityType/:entityId')
  entityHistory(
    @Param('entityType') entityType: string,
    @Param('entityId', ParseIntPipe) entityId: number,
  ) {
    return this.svc.getEntityHistory(entityType, entityId);
  }

  @Patch(':id/read')
  markAsRead(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: { id: number }) {
    return this.svc.markAsRead(id, user.id);
  }

  @Patch('read-all')
  markAllAsRead(@CurrentUser() user: { id: number }) {
    return this.svc.markAllAsRead(user.id);
  }

  @Delete(':id')
  delete(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: { id: number }) {
    return this.svc.delete(id, user.id);
  }
}

import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Notification } from '../../models/notification.entity';
import { paginate, getSkip } from '../../common/utils/pagination.util';

export interface NotificationFilter {
  page?: number;
  limit?: number;
  isRead?: boolean;
}

@Injectable()
export class NotificationsService {
  constructor(
    @InjectRepository(Notification) private repo: Repository<Notification>,
  ) {}

  async findAll(userId: number, filter: NotificationFilter = {}) {
    const { page = 1, limit = 30 } = filter;
    const qb = this.repo.createQueryBuilder('n')
      .where('n.userId = :userId', { userId });
    if (filter.isRead !== undefined) {
      qb.andWhere('n.isRead = :isRead', { isRead: filter.isRead });
    }
    qb.orderBy('n.createdAt', 'DESC').skip(getSkip(page, limit)).take(limit);
    return paginate(await qb.getManyAndCount(), page, limit);
  }

  async getUnreadCount(userId: number) {
    const count = await this.repo.count({ where: { userId, isRead: false } });
    return { count };
  }

  async markAsRead(id: number, userId: number) {
    const notif = await this.repo.findOne({ where: { id, userId } });
    if (!notif) throw new NotFoundException('Notification not found');
    notif.isRead = true;
    return this.repo.save(notif);
  }

  async markAllAsRead(userId: number) {
    await this.repo.update({ userId, isRead: false }, { isRead: true });
    return { success: true };
  }

  async delete(id: number, userId: number) {
    const notif = await this.repo.findOne({ where: { id, userId } });
    if (!notif) throw new NotFoundException('Notification not found');
    await this.repo.delete(id);
    return { deleted: true };
  }

  // ─── Create notifications (called by other services) ─────────────────────

  async notify(userId: number, data: {
    type: string;
    title: string;
    message?: string;
    entityType?: string;
    entityId?: number;
  }) {
    const notif = this.repo.create({
      userId,
      type: data.type,
      title: data.title,
      message: data.message,
      entityType: data.entityType,
      entityId: data.entityId,
      isRead: false,
    });
    return this.repo.save(notif);
  }

  /** Notify multiple users at once */
  async notifyMany(userIds: number[], data: {
    type: string;
    title: string;
    message?: string;
    entityType?: string;
    entityId?: number;
  }) {
    const notifications = userIds.map((userId) =>
      this.repo.create({
        userId,
        type: data.type,
        title: data.title,
        message: data.message,
        entityType: data.entityType,
        entityId: data.entityId,
        isRead: false,
      }),
    );
    return this.repo.save(notifications);
  }

  /** Get history of notifications for a specific entity (e.g. all notifs about a payment request) */
  async getEntityHistory(entityType: string, entityId: number) {
    return this.repo.find({
      where: { entityType, entityId },
      order: { createdAt: 'DESC' },
    });
  }
}

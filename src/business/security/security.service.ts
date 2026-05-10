import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { createHash } from 'crypto';
import { Repository } from 'typeorm';
import { paginate, getSkip } from '../../common/utils/pagination.util';
import { IpAccessRule, IpAccessRuleType } from '../../models/ip-access-rule.entity';
import {
  SecurityAlert,
  SecurityAlertSeverity,
  SecurityAlertStatus,
  SecurityAlertType,
} from '../../models/security-alert.entity';
import { LoginEventStatus, SecurityLoginEvent } from '../../models/security-login-event.entity';
import {
  CreateIpAccessRuleDto,
  IpAccessRuleFilterDto,
  SecurityAlertFilterDto,
  SecurityLoginEventFilterDto,
  UpdateIpAccessRuleDto,
} from './dto/security.dto';

export interface LoginSecurityContext {
  ipAddress?: string;
  userAgent?: string;
  countryCode?: string;
  locationLabel?: string;
}

@Injectable()
export class SecurityService {
  constructor(
    @InjectRepository(SecurityLoginEvent) private loginRepo: Repository<SecurityLoginEvent>,
    @InjectRepository(SecurityAlert) private alertRepo: Repository<SecurityAlert>,
    @InjectRepository(IpAccessRule) private ipRuleRepo: Repository<IpAccessRule>,
  ) {}

  async enforceIpAccess(ctx: LoginSecurityContext, username?: string) {
    const ipAddress = this.normalizeIp(ctx.ipAddress);
    if (!ipAddress) return;

    const rules = await this.ipRuleRepo.find({ where: { isActive: true } });
    const blockRule = rules.find((rule) => rule.type === IpAccessRuleType.BLOCK && this.matchesIpRule(ipAddress, rule.ipPattern));
    if (blockRule) {
      await this.recordLoginEvent({
        username: username || 'unknown',
        status: LoginEventStatus.BLOCKED,
        ctx,
        failureReason: `Blocked by IP rule: ${blockRule.label}`,
        riskScore: 100,
        signals: { ipRuleId: blockRule.id, ipRuleType: blockRule.type },
      });
      await this.createAlert({
        username,
        type: SecurityAlertType.BLOCKED_IP_LOGIN,
        severity: SecurityAlertSeverity.HIGH,
        title: 'Blocked login attempt',
        message: `Login attempt blocked by IP rule "${blockRule.label}".`,
        ctx,
        metadata: { ipRuleId: blockRule.id, ipPattern: blockRule.ipPattern },
      });
      throw new ForbiddenException('Access from this IP address is blocked');
    }

    const allowRules = rules.filter((rule) => rule.type === IpAccessRuleType.ALLOW);
    if (allowRules.length && !allowRules.some((rule) => this.matchesIpRule(ipAddress, rule.ipPattern))) {
      await this.recordLoginEvent({
        username: username || 'unknown',
        status: LoginEventStatus.BLOCKED,
        ctx,
        failureReason: 'IP address is outside the configured allowlist',
        riskScore: 100,
        signals: { allowlistEnabled: true },
      });
      await this.createAlert({
        username,
        type: SecurityAlertType.BLOCKED_IP_LOGIN,
        severity: SecurityAlertSeverity.HIGH,
        title: 'Login blocked by allowlist',
        message: 'Login attempt came from an IP address outside the configured allowlist.',
        ctx,
        metadata: { allowlistEnabled: true },
      });
      throw new ForbiddenException('Access from this IP address is not allowed');
    }
  }

  async recordFailedLogin(username: string, ctx: LoginSecurityContext, reason: string) {
    return this.recordLoginEvent({
      username,
      status: LoginEventStatus.FAILED,
      ctx,
      failureReason: reason,
      riskScore: 25,
    });
  }

  async recordSuccessfulLogin(user: { id: number; username: string }, ctx: LoginSecurityContext) {
    const deviceFingerprint = this.fingerprint(ctx.userAgent);
    const previous = await this.loginRepo.find({
      where: { userId: user.id, status: LoginEventStatus.SUCCESS },
      order: { createdAt: 'DESC' },
      take: 25,
    });

    const normalizedIp = this.normalizeIp(ctx.ipAddress);
    const isNewIp = Boolean(normalizedIp) && !previous.some((event) => event.ipAddress === normalizedIp);
    const isNewDevice = Boolean(deviceFingerprint) && !previous.some((event) => event.deviceFingerprint === deviceFingerprint);
    const isNewLocation = Boolean(ctx.countryCode) && !previous.some((event) => event.countryCode === ctx.countryCode);
    const riskScore = (isNewIp ? 25 : 0) + (isNewDevice ? 35 : 0) + (isNewLocation ? 30 : 0);
    const signals = { isNewIp, isNewDevice, isNewLocation };

    const event = await this.recordLoginEvent({
      userId: user.id,
      username: user.username,
      status: LoginEventStatus.SUCCESS,
      ctx,
      riskScore,
      signals,
    });

    if (isNewDevice) {
      await this.createAlert({
        userId: user.id,
        username: user.username,
        type: SecurityAlertType.NEW_DEVICE,
        severity: riskScore >= 60 ? SecurityAlertSeverity.HIGH : SecurityAlertSeverity.MEDIUM,
        title: 'New device login detected',
        message: 'The user logged in from a device fingerprint not seen before.',
        ctx,
        metadata: { loginEventId: event.id, ...signals },
      });
    }

    if (isNewLocation) {
      await this.createAlert({
        userId: user.id,
        username: user.username,
        type: SecurityAlertType.NEW_LOCATION,
        severity: SecurityAlertSeverity.MEDIUM,
        title: 'New login location detected',
        message: 'The user logged in from a country/location not seen before.',
        ctx,
        metadata: { loginEventId: event.id, ...signals },
      });
    }

    if (riskScore >= 60) {
      await this.createAlert({
        userId: user.id,
        username: user.username,
        type: SecurityAlertType.SUSPICIOUS_LOGIN,
        severity: SecurityAlertSeverity.HIGH,
        title: 'Suspicious login detected',
        message: 'The login matched multiple unusual access signals.',
        ctx,
        metadata: { loginEventId: event.id, riskScore, ...signals },
      });
    }

    return event;
  }

  async findLoginEvents(filter: SecurityLoginEventFilterDto) {
    const { page = 1, limit = 50, userId, username, status, ipAddress, dateFrom, dateTo } = filter;
    const qb = this.loginRepo.createQueryBuilder('event');
    if (userId) qb.andWhere('event.userId = :userId', { userId });
    if (username) qb.andWhere('event.username LIKE :username', { username: `%${username}%` });
    if (status) qb.andWhere('event.status = :status', { status });
    if (ipAddress) qb.andWhere('event.ipAddress = :ipAddress', { ipAddress: this.normalizeIp(ipAddress) });
    if (dateFrom) qb.andWhere('event.createdAt >= :dateFrom', { dateFrom });
    if (dateTo) qb.andWhere('event.createdAt <= :dateTo', { dateTo });
    qb.orderBy('event.createdAt', 'DESC').skip(getSkip(page, limit)).take(limit);
    return paginate(await qb.getManyAndCount(), page, limit);
  }

  async findAlerts(filter: SecurityAlertFilterDto) {
    const { page = 1, limit = 50, userId, status, type, dateFrom, dateTo } = filter;
    const qb = this.alertRepo.createQueryBuilder('alert');
    if (userId) qb.andWhere('alert.userId = :userId', { userId });
    if (status) qb.andWhere('alert.status = :status', { status });
    if (type) qb.andWhere('alert.type = :type', { type });
    if (dateFrom) qb.andWhere('alert.createdAt >= :dateFrom', { dateFrom });
    if (dateTo) qb.andWhere('alert.createdAt <= :dateTo', { dateTo });
    qb.orderBy('alert.createdAt', 'DESC').skip(getSkip(page, limit)).take(limit);
    return paginate(await qb.getManyAndCount(), page, limit);
  }

  async updateAlertStatus(id: number, status: SecurityAlertStatus, actorId: number) {
    const alert = await this.alertRepo.findOne({ where: { id } });
    if (!alert) throw new NotFoundException('Security alert not found');
    alert.status = status;
    alert.updatedBy = actorId;
    if (status === SecurityAlertStatus.RESOLVED) {
      alert.resolvedAt = new Date();
      alert.resolvedBy = actorId;
    }
    return this.alertRepo.save(alert);
  }

  async findIpRules(filter: IpAccessRuleFilterDto) {
    const { page = 1, limit = 50, type, isActive } = filter;
    const qb = this.ipRuleRepo.createQueryBuilder('rule');
    if (type) qb.andWhere('rule.type = :type', { type });
    if (isActive !== undefined) qb.andWhere('rule.isActive = :isActive', { isActive });
    qb.orderBy('rule.createdAt', 'DESC').skip(getSkip(page, limit)).take(limit);
    return paginate(await qb.getManyAndCount(), page, limit);
  }

  createIpRule(dto: CreateIpAccessRuleDto, actorId: number) {
    const rule = this.ipRuleRepo.create({ ...dto, isActive: dto.isActive ?? true, createdBy: actorId, updatedBy: actorId });
    return this.ipRuleRepo.save(rule);
  }

  async updateIpRule(id: number, dto: UpdateIpAccessRuleDto, actorId: number) {
    const rule = await this.ipRuleRepo.findOne({ where: { id } });
    if (!rule) throw new NotFoundException('IP access rule not found');
    return this.ipRuleRepo.save({ ...rule, ...dto, updatedBy: actorId });
  }

  async deleteIpRule(id: number) {
    const rule = await this.ipRuleRepo.findOne({ where: { id } });
    if (!rule) throw new NotFoundException('IP access rule not found');
    await this.ipRuleRepo.remove(rule);
    return { message: 'IP access rule deleted' };
  }

  private recordLoginEvent(data: {
    userId?: number;
    username: string;
    status: LoginEventStatus;
    ctx: LoginSecurityContext;
    failureReason?: string;
    riskScore?: number;
    signals?: Record<string, unknown>;
  }) {
    return this.loginRepo.save(this.loginRepo.create({
      userId: data.userId,
      username: data.username,
      status: data.status,
      ipAddress: this.normalizeIp(data.ctx.ipAddress),
      userAgent: data.ctx.userAgent?.slice(0, 500),
      deviceFingerprint: this.fingerprint(data.ctx.userAgent),
      countryCode: data.ctx.countryCode,
      locationLabel: data.ctx.locationLabel,
      failureReason: data.failureReason,
      riskScore: data.riskScore ?? 0,
      signals: data.signals,
    }));
  }

  private createAlert(data: {
    userId?: number;
    username?: string;
    type: SecurityAlertType;
    severity: SecurityAlertSeverity;
    title: string;
    message: string;
    ctx: LoginSecurityContext;
    metadata?: Record<string, unknown>;
  }) {
    return this.alertRepo.save(this.alertRepo.create({
      userId: data.userId,
      username: data.username,
      type: data.type,
      severity: data.severity,
      status: SecurityAlertStatus.OPEN,
      title: data.title,
      message: data.message,
      ipAddress: this.normalizeIp(data.ctx.ipAddress),
      userAgent: data.ctx.userAgent?.slice(0, 500),
      countryCode: data.ctx.countryCode,
      metadata: data.metadata,
    }));
  }

  private fingerprint(userAgent?: string) {
    if (!userAgent) return undefined;
    return createHash('sha256').update(userAgent).digest('hex');
  }

  private normalizeIp(ip?: string) {
    if (!ip) return undefined;
    const first = ip.split(',')[0]?.trim();
    if (!first) return undefined;
    return first.startsWith('::ffff:') ? first.replace('::ffff:', '') : first;
  }

  private matchesIpRule(ipAddress: string, pattern: string) {
    const normalizedPattern = pattern.trim();
    if (!normalizedPattern) return false;
    if (normalizedPattern === '*' || normalizedPattern === ipAddress) return true;
    if (normalizedPattern.endsWith('.*')) {
      return ipAddress.startsWith(normalizedPattern.slice(0, -1));
    }
    if (normalizedPattern.includes('/')) {
      return this.matchesCidr(ipAddress, normalizedPattern);
    }
    return false;
  }

  private matchesCidr(ipAddress: string, cidr: string) {
    const [range, bitsText] = cidr.split('/');
    const bits = Number(bitsText);
    if (!Number.isInteger(bits) || bits < 0 || bits > 32) return false;
    const ip = this.ipv4ToInt(ipAddress);
    const base = this.ipv4ToInt(range);
    if (ip === null || base === null) return false;
    const mask = bits === 0 ? 0 : (0xffffffff << (32 - bits)) >>> 0;
    return (ip & mask) === (base & mask);
  }

  private ipv4ToInt(value: string) {
    const parts = value.split('.').map((part) => Number(part));
    if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return null;
    return (((parts[0] << 24) >>> 0) + (parts[1] << 16) + (parts[2] << 8) + parts[3]) >>> 0;
  }
}

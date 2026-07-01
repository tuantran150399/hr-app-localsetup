import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SecurityLoginEvent } from '../../models/security-login-event.entity';

@Injectable()
export class LoginHistoryCleanupService implements OnApplicationBootstrap {
  private readonly logger = new Logger(LoginHistoryCleanupService.name);
  private static readonly RETENTION_DAYS = 31;

  constructor(
    @InjectRepository(SecurityLoginEvent) private readonly loginRepo: Repository<SecurityLoginEvent>,
    private readonly config: ConfigService,
  ) {}

  onApplicationBootstrap() {
    void this.cleanup().catch((error) => this.logger.error(`Initial cleanup failed: ${error.message}`));
  }

  @Cron(CronExpression.EVERY_HOUR)
  async cleanup() {
    const batchSize = this.readInteger('LOGIN_HISTORY_CLEANUP_BATCH_SIZE', 1000, 100, 10000);
    const cutoff = new Date(Date.now() - LoginHistoryCleanupService.RETENTION_DAYS * 24 * 60 * 60 * 1000);
    let total = 0;

    // MySQL DELETE ... LIMIT keeps transactions and row locks small. The
    // created_at index makes finding each expired batch inexpensive.
    for (;;) {
      const result = await this.loginRepo.query(
        'DELETE FROM security_login_events WHERE created_at < ? ORDER BY created_at ASC LIMIT ?',
        [cutoff, batchSize],
      );
      const affected = Number(result?.affectedRows ?? 0);
      total += affected;
      if (affected < batchSize) break;
    }

    if (total) this.logger.log(`Deleted ${total} login history records older than 31 days`);
    return total;
  }

  private readInteger(name: string, fallback: number, min: number, max: number) {
    const value = Number(this.config.get(name, fallback));
    return Number.isInteger(value) && value >= min && value <= max ? value : fallback;
  }
}

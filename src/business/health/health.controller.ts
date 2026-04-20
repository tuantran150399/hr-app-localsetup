import { Controller, Get } from '@nestjs/common';
import {
  HealthCheck,
  HealthCheckService,
  TypeOrmHealthIndicator,
  MemoryHealthIndicator,
  DiskHealthIndicator,
} from '@nestjs/terminus';

@Controller('health')
export class HealthController {
  constructor(
    private health: HealthCheckService,
    private db: TypeOrmHealthIndicator,
    private memory: MemoryHealthIndicator,
    private disk: DiskHealthIndicator,
  ) {}

  /**
   * GET /health
   * Full health check — database + memory + disk
   */
  @Get()
  @HealthCheck()
  check() {
    return this.health.check([
      // Database connectivity
      () => this.db.pingCheck('database', { timeout: 3000 }),

      // Heap must stay under 512 MB
      () => this.memory.checkHeap('memory_heap', 512 * 1024 * 1024),

      // RSS must stay under 768 MB
      () => this.memory.checkRSS('memory_rss', 768 * 1024 * 1024),

      // Disk: root drive must have >10% free space
      () =>
        this.disk.checkStorage('disk', {
          path: process.platform === 'win32' ? 'C:\\' : '/',
          thresholdPercent: 0.9,
        }),
    ]);
  }

  /**
   * GET /health/db
   * Database-only check (lightweight ping for load-balancer probes)
   */
  @Get('db')
  @HealthCheck()
  checkDb() {
    return this.health.check([
      () => this.db.pingCheck('database', { timeout: 3000 }),
    ]);
  }

  /**
   * GET /health/live
   * Liveness probe — just confirms the process is up (no external deps)
   */
  @Get('live')
  liveness() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: Math.floor(process.uptime()),
      pid: process.pid,
      nodeVersion: process.version,
      environment: process.env.NODE_ENV ?? 'unknown',
    };
  }
}

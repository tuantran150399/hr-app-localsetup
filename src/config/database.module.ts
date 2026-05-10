import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { join } from 'path';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'mysql',
        host: config.get<string>('DB_HOST', 'localhost'),
        port: config.get<number>('DB_PORT', 3306),
        username: config.get<string>('DB_USER', 'root'),
        password: config.get<string>('DB_PASSWORD', ''),
        database: config.get<string>('DB_NAME', 'hr_duongminh'),
        entities: [join(__dirname, '..', '**', '*.entity.{ts,js}')],
        migrations: [join(__dirname, '..', 'migrations', '*.{ts,js}')],
        // NEVER use synchronize: true in production
        synchronize: config.get<string>('NODE_ENV') === 'development',
        logging: config.get<string>('NODE_ENV') === 'development',
        charset: 'utf8mb4',
        timezone: '+07:00',
        ssl: false,
        extra: {
          ssl: false,
          // Connection pool — critical for a remote DB on Plesk
          connectionLimit: config.get<number>('DB_POOL_SIZE', 20),
          acquireTimeout: 30000,
          connectTimeout: 15000,
          waitForConnections: true,
          queueLimit: 0,
        },
        // TypeORM query-result cache (in-memory, 5 s TTL)
        cache: {
          duration: 5000,
        },
      }),
    }),
  ],
})
export class DatabaseModule {}

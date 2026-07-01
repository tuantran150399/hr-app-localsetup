import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';
import { join } from 'path';
import { getEnvFilePath } from './config/env-file-path';

for (const envFile of getEnvFilePath()) {
  dotenv.config({ path: envFile, override: false });
}

/**
 * Standalone DataSource used by TypeORM CLI for migrations.
 * NOT imported by the NestJS app module — the app uses TypeOrmModule.forRootAsync().
 */
export const AppDataSource = new DataSource({
  type: 'mysql',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT, 10) || 3306,
  username: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'hr_duongminh',
  entities: [join(__dirname, '**', '*.entity.{ts,js}')],
  migrations: [join(__dirname, 'migrations', '*.{ts,js}')],
  synchronize: false,
  logging: false,
});

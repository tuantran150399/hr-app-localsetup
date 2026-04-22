/**
 * Chạy TypeORM migration lên production DB.
 * Đọc config từ .env.prod (không ghi đè .env local).
 *
 * Cách chạy:
 *   npx ts-node -r tsconfig-paths/register scripts/migrate-prod.ts
 */
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';
import { DataSource } from 'typeorm';
import { join } from 'path';

// Load .env.prod nếu tồn tại, fallback về .env (khi chạy trên server)
const envPath = fs.existsSync(path.resolve(__dirname, '../.env.prod'))
  ? path.resolve(__dirname, '../.env.prod')
  : path.resolve(__dirname, '../.env');

dotenv.config({ path: envPath });
console.log(`📄 Đọc env từ: ${envPath}`);

const ProdDataSource = new DataSource({
  type: 'mysql',
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT ?? '3306', 10),
  username: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  entities: [join(__dirname, '../src/**/*.entity.{ts,js}')],
  migrations: [join(__dirname, '../src/migrations/*.{ts,js}')],
  synchronize: false,
  logging: true,
});

async function main() {
  console.log(`\n🔌 Connecting to prod DB: ${process.env.DB_HOST}:${process.env.DB_PORT} / ${process.env.DB_NAME} ...\n`);

  await ProdDataSource.initialize();
  console.log('✅ Connected.\n');

  const pending = await ProdDataSource.showMigrations();
  if (!pending) {
    console.log('✅ No pending migrations. DB is up to date.');
  } else {
    console.log('▶️  Running pending migrations...\n');
    await ProdDataSource.runMigrations({ transaction: 'each' });
    console.log('\n✅ All migrations applied.');
  }

  await ProdDataSource.destroy();
}

main().catch((err) => {
  console.error('❌ Migration failed:', err.message);
  process.exit(1);
});

'use strict';

const { existsSync } = require('fs');

function printUsage() {
  console.log(`
Delete all rows while keeping tables, columns, indexes, and relationships.

Usage:
  npm run db:clear -- <DB_NAME>

Options:
  Set DB_ENV_FILE to load another env file (default: .env or .env.prod).
  Add ALLOW_PRODUCTION after the database name when NODE_ENV=production.
  Add INCLUDE_MIGRATIONS to also empty TypeORM's migrations table.
`);
}

function loadEnvironment() {
  const defaultEnvFile =
    process.env.NODE_ENV === 'production' && existsSync('.env.prod')
      ? '.env.prod'
      : '.env';
  const envFile = process.env.DB_ENV_FILE || defaultEnvFile;

  if (existsSync(envFile)) {
    process.loadEnvFile(envFile);
  }
}

async function main() {
  if (process.argv.includes('--help') || process.argv.includes('-h')) {
    printUsage();
    return;
  }

  loadEnvironment();

  const database = process.env.DB_NAME || 'hr_duongminh';
  const confirmation = process.argv[2];
  const isProduction = process.env.NODE_ENV === 'production';

  if (confirmation !== database) {
    throw new Error(`Confirmation failed. Run again with: npm run db:clear -- ${database}`);
  }

  if (isProduction && !process.argv.includes('ALLOW_PRODUCTION')) {
    throw new Error(
      `Refusing to clear a production database. Run again with: npm run db:clear -- ${database} ALLOW_PRODUCTION`,
    );
  }

  const mysql = require('mysql2/promise');
  const config = {
    host: process.env.DB_HOST || 'localhost',
    port: Number.parseInt(process.env.DB_PORT, 10) || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database,
  };

  console.log(
    `Clearing data from ${config.user}@${config.host}:${config.port}/${database} ...`,
  );

  const connection = await mysql.createConnection(config);
  try {
    const includeMigrations = process.argv.includes('INCLUDE_MIGRATIONS');
    const [rows] = await connection.query(
      `SELECT TABLE_NAME AS name
       FROM information_schema.TABLES
       WHERE TABLE_SCHEMA = ? AND TABLE_TYPE = 'BASE TABLE'
       ORDER BY TABLE_NAME`,
      [database],
    );
    const tables = rows
      .map((row) => row.name)
      .filter((table) => includeMigrations || table !== 'migrations');

    await connection.query('SET FOREIGN_KEY_CHECKS = 0');
    try {
      for (const table of tables) {
        await connection.query(`TRUNCATE TABLE ${mysql.escapeId(table)}`);
      }
    } finally {
      await connection.query('SET FOREIGN_KEY_CHECKS = 1');
    }

    const migrationNote = includeMigrations
      ? ''
      : ' The migrations table was preserved.';
    console.log(
      `Database ${database} is empty (${tables.length} tables cleared).${migrationNote}`,
    );
  } finally {
    await connection.end();
  }
}

main().catch((error) => {
  console.error(`Database clear failed: ${error.message}`);
  process.exitCode = 1;
});

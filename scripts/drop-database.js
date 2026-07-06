'use strict';

const { existsSync } = require('fs');

function getArgument(name) {
  const prefix = `--${name}=`;
  return process.argv.find((argument) => argument.startsWith(prefix))?.slice(prefix.length);
}

function printUsage() {
  console.log(`
Delete every table, view, and all data from the configured database.

Usage:
  npm run db:drop -- <DB_NAME>

Options:
  Set DB_ENV_FILE to load another env file (default: .env or .env.prod).
  Add ALLOW_PRODUCTION after the database name when NODE_ENV=production.
`);
}

function loadEnvironment() {
  const requestedEnvFile = process.env.DB_ENV_FILE || getArgument('env');
  const defaultEnvFile =
    process.env.NODE_ENV === 'production' && existsSync('.env.prod')
      ? '.env.prod'
      : '.env';

  const envFile = requestedEnvFile || defaultEnvFile;
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
  const confirmation = getArgument('confirm') || process.argv[2];
  const isProduction = process.env.NODE_ENV === 'production';

  if (confirmation !== database) {
    throw new Error(`Confirmation failed. Run again with: npm run db:drop -- ${database}`);
  }

  const productionAllowed =
    process.argv.includes('--allow-production') ||
    process.argv.includes('ALLOW_PRODUCTION');
  if (isProduction && !productionAllowed) {
    throw new Error(
      `Refusing to delete a production database. Run again with: npm run db:drop -- ${database} ALLOW_PRODUCTION`,
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
    `Deleting all tables from ${config.user}@${config.host}:${config.port}/${database} ...`,
  );

  const connection = await mysql.createConnection(config);
  try {
    const [objects] = await connection.query(
      `SELECT TABLE_NAME AS name, TABLE_TYPE AS type
       FROM information_schema.TABLES
       WHERE TABLE_SCHEMA = ?`,
      [database],
    );

    const views = objects
      .filter((object) => object.type === 'VIEW')
      .map((object) => mysql.escapeId(object.name));
    const tables = objects
      .filter((object) => object.type === 'BASE TABLE')
      .map((object) => mysql.escapeId(object.name));

    await connection.query('SET FOREIGN_KEY_CHECKS = 0');
    try {
      if (views.length > 0) {
        await connection.query(`DROP VIEW IF EXISTS ${views.join(', ')}`);
      }
      if (tables.length > 0) {
        await connection.query(`DROP TABLE IF EXISTS ${tables.join(', ')}`);
      }
    } finally {
      await connection.query('SET FOREIGN_KEY_CHECKS = 1');
    }

    console.log(
      `Database ${database} is empty (${tables.length} tables and ${views.length} views deleted).`,
    );
  } finally {
    await connection.end();
  }
}

main().catch((error) => {
  console.error(`Database drop failed: ${error.message}`);
  process.exitCode = 1;
});

'use strict';

const { existsSync } = require('fs');

const ENV_FILE = '.env.remote-maintenance';

function required(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is missing from ${ENV_FILE}`);
  return value;
}

async function readJson(response) {
  const text = await response.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    return { message: text };
  }
}

async function main() {
  if (!existsSync(ENV_FILE)) {
    throw new Error(
      `Missing ${ENV_FILE}. Copy .env.remote-maintenance.example and fill in its values.`,
    );
  }
  process.loadEnvFile(ENV_FILE);

  const baseUrl = required('REMOTE_API_BASE_URL').replace(/\/$/, '');
  const adminKey = required('REMOTE_DATABASE_ADMIN_KEY');
  const confirmation = required('REMOTE_DATABASE_DROP_CONFIRM');

  if (confirmation !== 'DROP_ALL_TABLES') {
    throw new Error('REMOTE_DATABASE_DROP_CONFIRM must be exactly DROP_ALL_TABLES');
  }
  if (!baseUrl.startsWith('https://') && !baseUrl.startsWith('http://localhost')) {
    throw new Error('REMOTE_API_BASE_URL must use HTTPS');
  }

  console.log(`Dropping every table and view from the database at ${baseUrl} ...`);
  const dropResponse = await fetch(
    `${baseUrl}/api/v1/maintenance/database/drop-all-tables`,
    {
      method: 'POST',
      headers: {
        'x-database-admin-key': adminKey,
      },
    },
  );
  const result = await readJson(dropResponse);
  if (!dropResponse.ok) {
    throw new Error(
      `Remote drop failed (${dropResponse.status}): ${result.message || 'Unknown error'}`,
    );
  }

  console.log(
    `Done. Dropped ${result.droppedTables ?? 0} tables and ${result.droppedViews ?? 0} views.`,
  );
}

main().catch((error) => {
  console.error(`Remote database drop failed: ${error.message}`);
  process.exitCode = 1;
});

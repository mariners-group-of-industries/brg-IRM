#!/usr/bin/env node
/**
 * BRG1 IRM Database Backup Utility
 * Exports database contents, metadata, and SHA-256 verification checksum.
 */
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { createHash } from 'node:crypto';

const require = createRequire(resolve(process.cwd(), 'apps/api/package.json'));
const { Client } = require('pg');

const dbUrl = process.env.DATABASE_URL || 'postgresql://irm:irm_dev_password@127.0.0.1:5433/irm?schema=public';
const targetFile = process.argv[2] || resolve(process.cwd(), `.data/backups/backup-irm-${Date.now()}.json`);

mkdirSync(dirname(targetFile), { recursive: true });

const client = new Client({ connectionString: dbUrl });
await client.connect();

try {
  console.log(`[backup] Connected to database. Querying tables...`);
  const tablesRes = await client.query(`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
      AND table_type = 'BASE TABLE'
      AND table_name NOT LIKE '_prisma%'
    ORDER BY table_name;
  `);

  const tables = tablesRes.rows.map((r) => r.table_name);
  console.log(`[backup] Found ${tables.length} tables to backup.`);

  const dump = {};
  const manifest = {
    exportedAt: new Date().toISOString(),
    databaseUrl: dbUrl.replace(/:[^:@]+@/, ':***@'),
    tableCounts: {},
  };

  for (const table of tables) {
    const res = await client.query(`SELECT * FROM "${table}"`);
    dump[table] = res.rows;
    manifest.tableCounts[table] = res.rowCount;
    console.log(`  - ${table}: ${res.rowCount} row(s)`);
  }

  const payload = JSON.stringify({ manifest, dump }, (key, value) => {
    if (typeof value === 'bigint') return value.toString();
    return value;
  }, 2);

  const hash = createHash('sha256').update(payload).digest('hex');
  const finalBackup = {
    checksum: hash,
    ...JSON.parse(payload),
  };

  writeFileSync(targetFile, JSON.stringify(finalBackup, null, 2), 'utf-8');
  console.log(`[backup] Successfully written backup to: ${targetFile}`);
  console.log(`[backup] SHA-256 checksum: ${hash}`);
} finally {
  await client.end();
}

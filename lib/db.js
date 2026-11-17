import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const file = process.env.DB_PATH || resolve(import.meta.dirname, '../data/degg.db');
if (file !== ':memory:') mkdirSync(dirname(file), { recursive: true });

export const db = new DatabaseSync(file);
db.exec(`
  PRAGMA journal_mode = WAL;
  CREATE TABLE IF NOT EXISTS reports (
    id TEXT PRIMARY KEY, pubkey TEXT NOT NULL, created_at INTEGER NOT NULL,
    product TEXT NOT NULL, market TEXT NOT NULL, price INTEGER NOT NULL,
    note TEXT, lud16 TEXT, demo INTEGER NOT NULL DEFAULT 0,
    flag TEXT, event TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS reports_pm ON reports(product, market, created_at);
  CREATE TABLE IF NOT EXISTS confirms (
    report_id TEXT NOT NULL, pubkey TEXT NOT NULL, created_at INTEGER NOT NULL,
    PRIMARY KEY (report_id, pubkey)
  );
  CREATE TABLE IF NOT EXISTS deposits (
    payment_hash TEXT PRIMARY KEY, invoice TEXT NOT NULL, created_at INTEGER NOT NULL,
    used INTEGER NOT NULL DEFAULT 0
  );
  CREATE TABLE IF NOT EXISTS tips (
    payment_hash TEXT PRIMARY KEY, report_id TEXT NOT NULL, sats INTEGER NOT NULL,
    demo INTEGER NOT NULL DEFAULT 0, created_at INTEGER NOT NULL
  );
`);

import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const databasePath = process.env.SQLITE_DB_PATH
  ? path.resolve(process.env.SQLITE_DB_PATH)
  : path.join(__dirname, 'database', 'epros.sqlite');

fs.mkdirSync(path.dirname(databasePath), { recursive: true });

export const db = new Database(databasePath);

db.pragma('foreign_keys = ON');
db.pragma('journal_mode = WAL');

export function all(sql, params = []) {
  return db.prepare(sql).all(params);
}

export function get(sql, params = []) {
  return db.prepare(sql).get(params);
}

export function run(sql, params = []) {
  return db.prepare(sql).run(params);
}

export function transaction(callback) {
  return db.transaction(callback);
}

import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const backendDir = path.resolve(__dirname, '..');
const databaseDir = path.join(backendDir, 'database');
const databasePath = process.env.SQLITE_DB_PATH
  ? path.resolve(process.env.SQLITE_DB_PATH)
  : path.join(databaseDir, 'epros.sqlite');

const migrationsDir = path.join(backendDir, 'db', 'migrations');
const seedersDir = path.join(backendDir, 'db', 'seeders');

function execSqlFiles(db, directory, label) {
  const files = fs
    .readdirSync(directory)
    .filter((file) => file.endsWith('.sql'))
    .sort();

  for (const file of files) {
    const sql = fs.readFileSync(path.join(directory, file), 'utf8');
    db.exec(sql);
    console.log(`${label}: ${file}`);
  }
}

fs.mkdirSync(databaseDir, { recursive: true });

if (fs.existsSync(databasePath)) {
  fs.unlinkSync(databasePath);
}

const db = new Database(databasePath);
db.pragma('foreign_keys = ON');

try {
  execSqlFiles(db, migrationsDir, 'Migracion aplicada');
  execSqlFiles(db, seedersDir, 'Seeder aplicado');
  console.log(`Base de datos SQLite lista en ${databasePath}`);
} finally {
  db.close();
}

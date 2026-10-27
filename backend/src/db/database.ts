import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import { seedDatabase } from './seed';

function tableExists(db: Database.Database, table: string): boolean {
  return Boolean(db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?").get(table));
}

function columns(db: Database.Database, table: string): string[] {
  return (db.pragma(`table_info(${table})`) as { name: string }[]).map(column => column.name);
}

export function createDatabase(filename = process.env.DATABASE_PATH ?? path.resolve(process.cwd(), 'data', 'database.sqlite')): Database.Database {
  if (filename !== ':memory:') fs.mkdirSync(path.dirname(filename), { recursive: true });
  const db = new Database(filename);
  db.pragma('foreign_keys = ON');
  db.pragma('journal_mode = WAL');
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY, name TEXT NOT NULL UNIQUE, role TEXT NOT NULL DEFAULT 'STUDENT' CHECK(role IN ('STUDENT','ADMIN')));
    CREATE TABLE IF NOT EXISTS schema_migrations (id TEXT PRIMARY KEY);
    CREATE TABLE IF NOT EXISTS topics (id INTEGER PRIMARY KEY, title TEXT NOT NULL, theory TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS contents (id INTEGER PRIMARY KEY AUTOINCREMENT, topic_id INTEGER NOT NULL REFERENCES topics(id), type TEXT NOT NULL CHECK(type = 'THEORY'), body TEXT NOT NULL, UNIQUE(topic_id, type));
    CREATE TABLE IF NOT EXISTS activities (id TEXT PRIMARY KEY, topic_id INTEGER NOT NULL REFERENCES topics(id), type TEXT NOT NULL CHECK(type IN ('MAIN_ACTIVITY','REINFORCEMENT')), prompt TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS options (id TEXT PRIMARY KEY, activity_id TEXT NOT NULL REFERENCES activities(id), text TEXT NOT NULL, is_correct INTEGER NOT NULL CHECK(is_correct IN (0,1)));
    CREATE TABLE IF NOT EXISTS student_progress (user_id INTEGER PRIMARY KEY REFERENCES users(id), current_topic_id INTEGER NOT NULL REFERENCES topics(id), current_step TEXT NOT NULL CHECK(current_step IN ('MAIN_ACTIVITY','THEORY','REINFORCEMENT','COMPLETED')), theory_viewed INTEGER NOT NULL DEFAULT 0, completed_at TEXT);
    CREATE TABLE IF NOT EXISTS attempt_history (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL REFERENCES users(id), activity_id TEXT NOT NULL REFERENCES activities(id), selected_option_id TEXT NOT NULL REFERENCES options(id), is_correct INTEGER NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, timestamp TEXT);
    CREATE TABLE IF NOT EXISTS theory_consultations (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL REFERENCES users(id), topic_id INTEGER NOT NULL REFERENCES topics(id), timestamp TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS user_completed_topics (user_id INTEGER NOT NULL REFERENCES users(id), topic_id INTEGER NOT NULL REFERENCES topics(id), completed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY(user_id, topic_id));
  `);
  if (!columns(db, 'users').includes('role')) {
    db.exec("ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'STUDENT' CHECK(role IN ('STUDENT','ADMIN'))");
  }
  const progressColumns = columns(db, 'student_progress');
  if (!progressColumns.includes('completed_at')) db.exec('ALTER TABLE student_progress ADD COLUMN completed_at TEXT');
  const attemptColumns = columns(db, 'attempt_history');
  if (!attemptColumns.includes('timestamp')) db.exec('ALTER TABLE attempt_history ADD COLUMN timestamp TEXT');
  seedDatabase(db);

  for (const user of [
    { id: 1, name: 'Daniel', role: 'STUDENT' },
    { id: 2, name: 'Brandon', role: 'STUDENT' },
    { id: 3, name: 'Administrador', role: 'ADMIN' },
  ]) {
    db.prepare('INSERT INTO users (id, name, role) VALUES (?, ?, ?) ON CONFLICT(id) DO UPDATE SET name = excluded.name, role = excluded.role').run(user.id, user.name, user.role);
  }

  const migrateLegacyData = db.transaction(() => {
    if (db.prepare("SELECT 1 FROM schema_migrations WHERE id = 'multi_user_progress_v1'").get()) return;
    if (tableExists(db, 'progress') && columns(db, 'progress').includes('id')) {
      db.prepare(`INSERT OR IGNORE INTO student_progress (user_id, current_topic_id, current_step, theory_viewed)
        SELECT 1, current_topic_id, current_step, theory_viewed FROM progress WHERE id = 1`).run();
    }
    if (tableExists(db, 'attempts') && columns(db, 'attempts').includes('activity_id')) {
      const legacyColumns = columns(db, 'attempts');
      const timestamp = legacyColumns.includes('created_at') ? 'created_at' : 'CURRENT_TIMESTAMP';
      db.prepare(`INSERT OR IGNORE INTO attempt_history (user_id, activity_id, selected_option_id, is_correct, created_at)
        SELECT 1, activity_id, selected_option_id, is_correct, ${timestamp} FROM attempts`).run();
    }
    if (tableExists(db, 'completed_topics') && columns(db, 'completed_topics').includes('topic_id')) {
      db.prepare('INSERT OR IGNORE INTO user_completed_topics (user_id, topic_id) SELECT 1, topic_id FROM completed_topics').run();
    }
    db.prepare("INSERT INTO schema_migrations (id) VALUES ('multi_user_progress_v1')").run();
  });
  migrateLegacyData();

  db.prepare("UPDATE attempt_history SET timestamp = strftime('%Y-%m-%dT%H:%M:%fZ', created_at) WHERE timestamp IS NULL").run();
  db.prepare("UPDATE user_completed_topics SET completed_at = strftime('%Y-%m-%dT%H:%M:%fZ', completed_at) WHERE completed_at NOT LIKE '%T%'").run();
  db.prepare("INSERT OR IGNORE INTO contents (topic_id, type, body) SELECT id, 'THEORY', theory FROM topics").run();

  const initializeUsers = db.transaction(() => {
    for (const user of [{ id: 1, name: 'Daniel' }, { id: 2, name: 'Brandon' }]) {
      db.prepare("INSERT OR IGNORE INTO student_progress (user_id, current_topic_id, current_step) VALUES (?, 1, 'MAIN_ACTIVITY')").run(user.id);
    }
  });
  initializeUsers();
  return db;
}

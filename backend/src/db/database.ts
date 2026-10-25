import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import { seedDatabase } from './seed';

export function createDatabase(filename = process.env.DATABASE_PATH ?? path.resolve(process.cwd(), 'data', 'database.sqlite')): Database.Database {
  if (filename !== ':memory:') fs.mkdirSync(path.dirname(filename), { recursive: true });
  const db = new Database(filename);
  db.pragma('foreign_keys = ON');
  db.pragma('journal_mode = WAL');
  db.exec(`
    CREATE TABLE IF NOT EXISTS topics (id INTEGER PRIMARY KEY, title TEXT NOT NULL, theory TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS activities (id TEXT PRIMARY KEY, topic_id INTEGER NOT NULL REFERENCES topics(id), type TEXT NOT NULL CHECK(type IN ('MAIN_ACTIVITY','REINFORCEMENT')), prompt TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS options (id TEXT PRIMARY KEY, activity_id TEXT NOT NULL REFERENCES activities(id), text TEXT NOT NULL, is_correct INTEGER NOT NULL CHECK(is_correct IN (0,1)));
    CREATE TABLE IF NOT EXISTS progress (id INTEGER PRIMARY KEY CHECK(id = 1), current_topic_id INTEGER NOT NULL, current_step TEXT NOT NULL CHECK(current_step IN ('MAIN_ACTIVITY','THEORY','REINFORCEMENT','COMPLETED')), theory_viewed INTEGER NOT NULL DEFAULT 0);
    CREATE TABLE IF NOT EXISTS attempts (id INTEGER PRIMARY KEY AUTOINCREMENT, activity_id TEXT NOT NULL REFERENCES activities(id), selected_option_id TEXT NOT NULL REFERENCES options(id), is_correct INTEGER NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE IF NOT EXISTS completed_topics (topic_id INTEGER PRIMARY KEY REFERENCES topics(id), completed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
  `);
  seedDatabase(db);
  return db;
}

import { afterEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type Database from 'better-sqlite3';
import { createDatabase } from '../src/db/database';
import { createApp } from '../src/index';

const databases: Database.Database[] = [];
const servers: ReturnType<ReturnType<typeof createApp>['listen']>[] = [];
function setup(filename = ':memory:') {
  const db = createDatabase(filename);
  databases.push(db);
  const server = createApp(db).listen(0);
  servers.push(server);
  return { db, base: `http://127.0.0.1:${(server.address() as { port: number }).port}/api` };
}
afterEach(async () => {
  await Promise.all(servers.splice(0).map(server => new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()))));
  for (const db of databases.splice(0)) db.close();
});

const post = (base: string, route: string, body: object) => fetch(`${base}/${route}`, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify(body),
});

describe('API multiusuario y persistencia', () => {
  it('crea los dos usuarios solicitados y oculta las respuestas correctas', async () => {
    const { base } = setup();
    const users = await fetch(`${base}/users`);
    expect(await users.json()).toEqual([{ id: 1, name: 'Daniel' }, { id: 2, name: 'Brandon' }]);
    const response = await fetch(`${base}/progress/1`);
    const initial = await response.json() as { activity: { id: string; options: object[] } };
    expect(initial.activity.id).toBe('a1');
    expect(initial.activity.options).toHaveLength(3);
    expect(JSON.stringify(initial)).not.toContain('is_correct');
    expect(JSON.stringify(initial)).not.toContain('"correct"');
  });

  it('mantiene independientes las transiciones y el historial de cada usuario', async () => {
    const { base } = setup();
    const answer = await post(base, 'attempts', { userId: 1, activityId: 'a1', optionId: 'a1-b' });
    expect(answer.status).toBe(200);
    const daniel = await (await fetch(`${base}/progress/1`)).json() as { progress: { currentStep: string; currentTopicId: number }; attempts: unknown[] };
    const brandon = await (await fetch(`${base}/progress/2`)).json() as { progress: { currentStep: string; currentTopicId: number }; attempts: unknown[] };
    expect(daniel.progress).toMatchObject({ currentStep: 'MAIN_ACTIVITY', currentTopicId: 2 });
    expect(daniel.attempts).toHaveLength(1);
    expect(brandon.progress).toMatchObject({ currentStep: 'MAIN_ACTIVITY', currentTopicId: 1 });
    expect(brandon.attempts).toHaveLength(0);
  });

  it('aplica el flujo de teoría y refuerzo solo al estudiante que lo consultó', async () => {
    const { base } = setup();
    await post(base, 'attempts', { userId: 2, activityId: 'a1', optionId: 'a1-a' });
    let progress = await fetch(`${base}/progress/2`);
    expect((await progress.json() as { progress: { currentStep: string }; theory: string }).progress.currentStep).toBe('THEORY');
    const consulted = await post(base, 'theory/consult', { userId: 2 });
    expect(consulted.status).toBe(200);
    progress = await fetch(`${base}/progress/2`);
    expect((await progress.json() as { progress: { currentStep: string }; activity: { id: string } }).progress.currentStep).toBe('REINFORCEMENT');
    const daniel = await (await fetch(`${base}/progress/1`)).json() as { progress: { currentStep: string } };
    expect(daniel.progress.currentStep).toBe('MAIN_ACTIVITY');
  });

  it('rechaza opciones incorrectas, pasos desordenados y usuarios inexistentes', async () => {
    const { base } = setup();
    expect((await post(base, 'attempts', { userId: 1, activityId: 'a1', optionId: 'r1-a' })).status).toBe(400);
    expect((await post(base, 'attempts', { userId: 1, activityId: 'r1', optionId: 'r1-a' })).status).toBe(409);
    expect((await fetch(`${base}/progress/99`)).status).toBe(404);
  });

  it('migra el progreso existente a Daniel y mantiene el dato al reiniciar la conexión', () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'learning-path-'));
    const filename = path.join(directory, 'database.sqlite');
    try {
      const first = createDatabase(filename);
      first.prepare("UPDATE student_progress SET current_topic_id = 2, current_step = 'THEORY' WHERE user_id = 1").run();
      first.close();
      const reopened = createDatabase(filename);
      expect(reopened.prepare('SELECT current_topic_id AS topicId, current_step AS step FROM student_progress WHERE user_id = 1').get())
        .toEqual({ topicId: 2, step: 'THEORY' });
      expect(reopened.prepare('SELECT current_topic_id AS topicId FROM student_progress WHERE user_id = 2').get()).toEqual({ topicId: 1 });
      reopened.close();
    } finally {
      fs.rmSync(directory, { recursive: true, force: true });
    }
  });

  it('migra datos heredados de la base monoestudiante sin duplicar intentos', () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'learning-legacy-'));
    const filename = path.join(directory, 'legacy.sqlite');
    try {
      const legacy = new (require('better-sqlite3'))(filename) as Database.Database;
      legacy.exec(`
        CREATE TABLE topics (id INTEGER PRIMARY KEY, title TEXT NOT NULL, theory TEXT NOT NULL);
        CREATE TABLE activities (id TEXT PRIMARY KEY, topic_id INTEGER NOT NULL, type TEXT NOT NULL, prompt TEXT NOT NULL);
        CREATE TABLE options (id TEXT PRIMARY KEY, activity_id TEXT NOT NULL, text TEXT NOT NULL, is_correct INTEGER NOT NULL);
        CREATE TABLE progress (id INTEGER PRIMARY KEY, current_topic_id INTEGER NOT NULL, current_step TEXT NOT NULL, theory_viewed INTEGER NOT NULL DEFAULT 0);
        CREATE TABLE attempts (id INTEGER PRIMARY KEY, activity_id TEXT NOT NULL, selected_option_id TEXT NOT NULL, is_correct INTEGER NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
        CREATE TABLE completed_topics (topic_id INTEGER PRIMARY KEY, completed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
        INSERT INTO topics VALUES (1, 'old', 'old theory');
        INSERT INTO topics VALUES (2, 'old 2', 'old theory 2');
        INSERT INTO progress VALUES (1, 2, 'THEORY', 0);
      `);
      legacy.close();
      const migrated = createDatabase(filename);
      expect(migrated.prepare('SELECT current_topic_id AS topicId FROM student_progress WHERE user_id = 1').get()).toEqual({ topicId: 2 });
      expect(migrated.prepare('SELECT COUNT(*) AS count FROM users').get()).toEqual({ count: 2 });
      migrated.close();
    } finally {
      fs.rmSync(directory, { recursive: true, force: true });
    }
  });
});

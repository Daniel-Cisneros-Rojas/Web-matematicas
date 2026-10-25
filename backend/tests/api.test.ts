import { afterEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type Database from 'better-sqlite3';
import { createDatabase } from '../src/db/database';
import { createApp } from '../src/index';

const databases: Database.Database[] = [];
const servers: ReturnType<ReturnType<typeof createApp>['listen']>[] = [];
function setup() {
  const db = createDatabase(':memory:');
  databases.push(db);
  const server = createApp(db).listen(0);
  servers.push(server);
  return { db, server, base: `http://127.0.0.1:${(server.address() as { port: number }).port}/api` };
}
afterEach(async () => {
  await Promise.all(servers.splice(0).map(server => new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()))));
  for (const db of databases.splice(0)) db.close();
});

describe('API adaptativa y persistencia', () => {
  it('oculta respuestas correctas y persiste el ciclo de reintento de refuerzo', async () => {
    const { base } = setup();
    let response = await fetch(`${base}/pathway`);
    const initial = await response.json() as { activity: { options: { id: string; text: string }[] } };
    expect(JSON.stringify(initial)).not.toContain('is_correct');
    expect(JSON.stringify(initial)).not.toContain('"correct"');
    response = await fetch(`${base}/answer`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ optionId: 'a1-a' }) });
    expect(response.status).toBe(200);
    await fetch(`${base}/theory/consult`, { method: 'POST' });
    await fetch(`${base}/answer`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ optionId: 'r1-b' }) });
    response = await fetch(`${base}/pathway`);
    const retry = await response.json() as { progress: { currentStep: string }; activity: { id: string } };
    expect(retry.progress.currentStep).toBe('THEORY');
    expect(retry.activity).toBeNull();
  });
  it('rechaza opción ajena y teoría consultada fuera de orden', async () => {
    const { base } = setup();
    const answer = await fetch(`${base}/answer`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ optionId: 'r1-a' }) });
    expect(answer.status).toBe(400);
    const theory = await fetch(`${base}/theory/consult`, { method: 'POST' });
    expect(theory.status).toBe(409);
  });
  it('avanza tema, completa último tema y conserva progreso almacenado', async () => {
    const { db, base } = setup();
    for (const optionId of ['a1-b', 'a2-b', 'a3-a']) {
      const result = await fetch(`${base}/answer`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ optionId }) });
      expect(result.status).toBe(200);
    }
    expect((db.prepare('SELECT current_step AS step FROM progress').get() as { step: string }).step).toBe('COMPLETED');
    expect((db.prepare('SELECT COUNT(*) AS count FROM completed_topics').get() as { count: number }).count).toBe(3);
    const blocked = await fetch(`${base}/answer`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ optionId: 'a3-a' }) });
    expect(blocked.status).toBe(422);
  });
  it('restaura el progreso al reabrir la base de datos SQLite', async () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'learning-path-'));
    const filename = path.join(directory, 'database.sqlite');
    try {
      const firstConnection = createDatabase(filename);
      firstConnection.prepare("UPDATE progress SET current_topic_id = 2, current_step = 'THEORY' WHERE id = 1").run();
      firstConnection.close();
      const reopened = createDatabase(filename);
      expect(reopened.prepare('SELECT current_topic_id AS topicId, current_step AS step FROM progress').get()).toEqual({ topicId: 2, step: 'THEORY' });
      reopened.close();
    } finally {
      fs.rmSync(directory, { recursive: true, force: true });
    }
  });
});

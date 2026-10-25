import { Router } from 'express';
import type Database from 'better-sqlite3';
import { consultTheory, DomainError, submitAnswer } from '../engine/fsm';

export function createApi(db: Database.Database): Router {
  const router = Router();
  const readState = () => db.prepare('SELECT current_topic_id AS topicId, current_step AS step, theory_viewed AS theoryViewed FROM progress WHERE id = 1').get() as { topicId: number; step: 'MAIN_ACTIVITY' | 'THEORY' | 'REINFORCEMENT' | 'COMPLETED'; theoryViewed: number };

  router.get('/pathway', (_req, res, next) => {
    try {
      const state = readState();
      const topics = db.prepare(`
        SELECT t.id, t.title, CASE
          WHEN c.topic_id IS NOT NULL THEN 'COMPLETED'
          WHEN t.id = ? THEN 'IN_PROGRESS'
          ELSE 'LOCKED' END AS status
        FROM topics t LEFT JOIN completed_topics c ON c.topic_id = t.id ORDER BY t.id
      `).all(state.topicId) as { id: number; title: string; status: string }[];
      const attempts = db.prepare('SELECT activity_id AS activityId, selected_option_id AS selectedOptionId, is_correct AS isCorrect, created_at AS createdAt FROM attempts ORDER BY id').all();
      const current = state.step === 'MAIN_ACTIVITY' || state.step === 'REINFORCEMENT'
        ? db.prepare('SELECT id, type, prompt FROM activities WHERE topic_id = ? AND type = ?').get(state.topicId, state.step) as { id: string; type: string; prompt: string } | undefined
        : null;
      const options = current ? db.prepare('SELECT id, text FROM options WHERE activity_id = ? ORDER BY rowid').all(current.id) : [];
      const theory = state.step === 'THEORY' ? (db.prepare('SELECT theory FROM topics WHERE id = ?').get(state.topicId) as { theory: string }).theory : null;
      res.json({ topics, progress: { currentTopicId: state.topicId, currentStep: state.step, completed: state.step === 'COMPLETED', theoryViewed: Boolean(state.theoryViewed) }, activity: current ? { ...current, options } : null, theory, attempts });
    } catch (error) { next(error); }
  });

  router.post('/answer', (req, res, next) => {
    try {
      const optionId = req.body?.optionId;
      if (typeof optionId !== 'string' || !optionId.trim()) throw new DomainError(400, 'optionId es obligatorio.');
      const state = readState();
      if (state.step === 'COMPLETED') throw new DomainError(422, 'La ruta ya fue completada.');
      const activityType = state.step === 'REINFORCEMENT' ? 'REINFORCEMENT' : state.step === 'MAIN_ACTIVITY' ? 'MAIN_ACTIVITY' : null;
      if (!activityType) throw new DomainError(409, 'Primero debes consultar la teoría.');
      const activity = db.prepare('SELECT id FROM activities WHERE topic_id = ? AND type = ?').get(state.topicId, activityType) as { id: string } | undefined;
      if (!activity) throw new DomainError(409, 'No hay actividad disponible en este paso.');
      const option = db.prepare('SELECT is_correct FROM options WHERE id = ? AND activity_id = ?').get(optionId, activity.id) as { is_correct: number } | undefined;
      if (!option) throw new DomainError(400, 'La opción no pertenece a la actividad actual.');

      const totalTopics = (db.prepare('SELECT COUNT(*) AS count FROM topics').get() as { count: number }).count;
      const transition = submitAnswer({ topicId: state.topicId, step: state.step, theoryViewed: Boolean(state.theoryViewed) }, activityType, Boolean(option.is_correct), totalTopics);
      const save = db.transaction(() => {
        db.prepare('INSERT INTO attempts (activity_id, selected_option_id, is_correct) VALUES (?, ?, ?)').run(activity.id, optionId, Number(option.is_correct));
        if (transition.completedTopicId) db.prepare('INSERT OR IGNORE INTO completed_topics (topic_id) VALUES (?)').run(transition.completedTopicId);
        db.prepare('UPDATE progress SET current_topic_id = ?, current_step = ?, theory_viewed = ? WHERE id = 1').run(transition.next.topicId, transition.next.step, Number(transition.next.theoryViewed));
      });
      save();
      res.json({ feedback: transition.feedback, progress: { currentTopicId: transition.next.topicId, currentStep: transition.next.step, completed: transition.next.step === 'COMPLETED', theoryViewed: transition.next.theoryViewed } });
    } catch (error) { next(error); }
  });

  router.post('/theory/consult', (_req, res, next) => {
    try {
      const state = readState();
      const next = consultTheory({ topicId: state.topicId, step: state.step, theoryViewed: Boolean(state.theoryViewed) });
      db.prepare('UPDATE progress SET current_step = ?, theory_viewed = ? WHERE id = 1').run(next.step, Number(next.theoryViewed));
      res.json({ progress: { currentTopicId: next.topicId, currentStep: next.step, completed: false, theoryViewed: true } });
    } catch (error) { next(error); }
  });

  return router;
}

import { Router } from 'express';
import type Database from 'better-sqlite3';
import { consultTheory, DomainError, submitAnswer } from '../engine/fsm';

interface UserProgress {
  userId: number;
  topicId: number;
  step: 'MAIN_ACTIVITY' | 'THEORY' | 'REINFORCEMENT' | 'COMPLETED';
  theoryViewed: number;
}

export function createApi(db: Database.Database): Router {
  const router = Router();

  function getProgress(userId: number): UserProgress {
    if (!Number.isSafeInteger(userId) || userId < 1) throw new DomainError(400, 'userId debe ser un entero positivo.');
    const progress = db.prepare(`SELECT user_id AS userId, current_topic_id AS topicId, current_step AS step,
      theory_viewed AS theoryViewed FROM student_progress WHERE user_id = ?`).get(userId) as UserProgress | undefined;
    if (!progress) throw new DomainError(404, 'El usuario no existe.');
    return progress;
  }

  function getPathway(userId: number) {
    const state = getProgress(userId);
    const topics = db.prepare(`
      SELECT t.id, t.title, CASE
        WHEN c.topic_id IS NOT NULL THEN 'COMPLETED'
        WHEN t.id = ? THEN 'IN_PROGRESS'
        ELSE 'LOCKED' END AS status
      FROM topics t LEFT JOIN user_completed_topics c ON c.topic_id = t.id AND c.user_id = ?
      ORDER BY t.id
    `).all(state.topicId, userId);
    const attempts = db.prepare(`SELECT activity_id AS activityId, selected_option_id AS selectedOptionId,
      is_correct AS isCorrect, created_at AS createdAt FROM attempt_history WHERE user_id = ? ORDER BY id`).all(userId);
    const current = state.step === 'MAIN_ACTIVITY' || state.step === 'REINFORCEMENT'
      ? db.prepare('SELECT id, type, prompt FROM activities WHERE topic_id = ? AND type = ?').get(state.topicId, state.step) as { id: string; type: string; prompt: string } | undefined
      : null;
    const options = current ? db.prepare('SELECT id, text FROM options WHERE activity_id = ? ORDER BY rowid').all(current.id) : [];
    const theory = state.step === 'THEORY'
      ? (db.prepare("SELECT body AS theory FROM contents WHERE topic_id = ? AND type = 'THEORY'").get(state.topicId) as { theory: string } | undefined)?.theory ?? null
      : null;
    return {
      topics,
      progress: { userId, currentTopicId: state.topicId, currentStep: state.step, completed: state.step === 'COMPLETED', theoryViewed: Boolean(state.theoryViewed) },
      activity: current ? { ...current, options } : null,
      theory,
      attempts,
    };
  }

  router.get('/users', (_req, res) => {
    res.json(db.prepare('SELECT id, name FROM users ORDER BY id').all());
  });

  router.get('/progress/:userId', (req, res, next) => {
    try {
      const userId = Number(req.params.userId);
      res.json(getPathway(userId));
    } catch (error) { next(error); }
  });

  router.post('/attempts', (req, res, next) => {
    try {
      const userId = Number(req.body?.userId);
      const activityId = req.body?.activityId;
      const optionId = req.body?.optionId;
      const state = getProgress(userId);
      if (typeof activityId !== 'string' || typeof optionId !== 'string' || !optionId.trim()) {
        throw new DomainError(400, 'activityId y optionId son obligatorios.');
      }
      if (state.step === 'COMPLETED') throw new DomainError(422, 'La ruta ya fue completada.');
      const activityType = state.step === 'REINFORCEMENT' ? 'REINFORCEMENT' : state.step === 'MAIN_ACTIVITY' ? 'MAIN_ACTIVITY' : null;
      if (!activityType) throw new DomainError(409, 'Primero debes consultar la teoría.');
      const activity = db.prepare('SELECT id FROM activities WHERE topic_id = ? AND type = ?').get(state.topicId, activityType) as { id: string } | undefined;
      if (!activity || activity.id !== activityId) throw new DomainError(409, 'La actividad no corresponde al paso actual.');
      const option = db.prepare('SELECT is_correct FROM options WHERE id = ? AND activity_id = ?').get(optionId, activity.id) as { is_correct: number } | undefined;
      if (!option) throw new DomainError(400, 'La opción no pertenece a la actividad actual.');

      const totalTopics = (db.prepare('SELECT COUNT(*) AS count FROM topics').get() as { count: number }).count;
      const transition = submitAnswer({ topicId: state.topicId, step: state.step, theoryViewed: Boolean(state.theoryViewed) }, activityType, Boolean(option.is_correct), totalTopics);
      db.transaction(() => {
        db.prepare('INSERT INTO attempt_history (user_id, activity_id, selected_option_id, is_correct) VALUES (?, ?, ?, ?)')
          .run(userId, activity.id, optionId, Number(option.is_correct));
        if (transition.completedTopicId) {
          db.prepare('INSERT OR IGNORE INTO user_completed_topics (user_id, topic_id) VALUES (?, ?)').run(userId, transition.completedTopicId);
        }
        db.prepare('UPDATE student_progress SET current_topic_id = ?, current_step = ?, theory_viewed = ? WHERE user_id = ?')
          .run(transition.next.topicId, transition.next.step, Number(transition.next.theoryViewed), userId);
      })();
      res.json({ feedback: transition.feedback, ...getPathway(userId) });
    } catch (error) { next(error); }
  });

  router.post('/theory/consult', (req, res, next) => {
    try {
      const userId = Number(req.body?.userId);
      const state = getProgress(userId);
      const next = consultTheory({ topicId: state.topicId, step: state.step, theoryViewed: Boolean(state.theoryViewed) });
      db.prepare('UPDATE student_progress SET current_step = ?, theory_viewed = ? WHERE user_id = ?')
        .run(next.step, Number(next.theoryViewed), userId);
      res.json(getPathway(userId));
    } catch (error) { next(error); }
  });

  return router;
}

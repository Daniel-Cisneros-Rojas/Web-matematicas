import type Database from 'better-sqlite3';

export interface SeedOption {
  id: string;
  text: string;
  correct: boolean;
}

export interface SeedActivity {
  id: string;
  type: 'MAIN_ACTIVITY' | 'REINFORCEMENT';
  prompt: string;
  options: SeedOption[];
}

export interface SeedTopic {
  id: number;
  title: string;
  theory: string;
  main: SeedActivity;
  reinforcement: SeedActivity;
}

export const topics: SeedTopic[] = [
  {
    id: 1,
    title: 'Operaciones algebraicas',
    main: { id: 'a1', type: 'MAIN_ACTIVITY', prompt: 'Resuelve $x + 4 = 9$', options: [{ id: 'a1-a', text: '3', correct: false }, { id: 'a1-b', text: '5', correct: true }, { id: 'a1-c', text: '13', correct: false }] },
    theory: 'Despeje de incógnitas. Para resolver una ecuación, realizamos operaciones equivalentes en ambos lados: $x + 4 = 9 \\implies x = 5$.',
    reinforcement: { id: 'r1', type: 'REINFORCEMENT', prompt: 'Resuelve $3x = 12$', options: [{ id: 'r1-a', text: '4', correct: true }, { id: 'r1-b', text: '9', correct: false }, { id: 'r1-c', text: '36', correct: false }] },
  },
  {
    id: 2,
    title: 'Ecuaciones lineales',
    main: { id: 'a2', type: 'MAIN_ACTIVITY', prompt: 'Resuelve $2x + 3 = 11$', options: [{ id: 'a2-a', text: '7', correct: false }, { id: 'a2-b', text: '4', correct: true }, { id: 'a2-c', text: '5', correct: false }] },
    theory: 'Ecuaciones lineales de varios pasos. Eliminamos términos sumados/restados y despejamos el coeficiente: $2x + 3 = 11 \\implies 2x = 8 \\implies x = 4$.',
    reinforcement: { id: 'r2', type: 'REINFORCEMENT', prompt: 'Resuelve $5x - 7 = 8$', options: [{ id: 'r2-a', text: '1', correct: false }, { id: 'r2-b', text: '3', correct: true }, { id: 'r2-c', text: '5', correct: false }] },
  },
  {
    id: 3,
    title: 'Ecuaciones cuadráticas',
    main: { id: 'a3', type: 'MAIN_ACTIVITY', prompt: 'Resuelve $x^2 - 5x + 6 = 0$', options: [{ id: 'a3-a', text: '$x = 2, x = 3$', correct: true }, { id: 'a3-b', text: '$x = 1, x = 6$', correct: false }, { id: 'a3-c', text: '$x = -2, x = -3$', correct: false }] },
    theory: 'Resolución por factorización. $(x - 2)(x - 3) = 0 \\implies x = 2$ ó $x = 3$.',
    reinforcement: { id: 'r3', type: 'REINFORCEMENT', prompt: 'Resuelve $x^2 - 9 = 0$', options: [{ id: 'r3-a', text: '$x = 3$ únicamente', correct: false }, { id: 'r3-b', text: '$x = -3, x = 3$', correct: true }, { id: 'r3-c', text: '$x = -9, x = 9$', correct: false }] },
  },
];

export function seedDatabase(db: Database.Database): void {
  const seed = db.transaction(() => {
    const existing = db.prepare('SELECT COUNT(*) AS count FROM topics').get() as { count: number };
    if (existing.count > 0) return;

    const insertTopic = db.prepare('INSERT INTO topics (id, title, theory) VALUES (?, ?, ?)');
    const insertActivity = db.prepare('INSERT INTO activities (id, topic_id, type, prompt) VALUES (?, ?, ?, ?)');
    const insertOption = db.prepare('INSERT INTO options (id, activity_id, text, is_correct) VALUES (?, ?, ?, ?)');
    for (const topic of topics) {
      insertTopic.run(topic.id, topic.title, topic.theory);
      for (const activity of [topic.main, topic.reinforcement]) {
        insertActivity.run(activity.id, topic.id, activity.type, activity.prompt);
        for (const option of activity.options) insertOption.run(option.id, activity.id, option.text, Number(option.correct));
      }
    }
    db.prepare("INSERT INTO progress (id, current_topic_id, current_step) VALUES (1, 1, 'MAIN_ACTIVITY')").run();
  });
  seed();
}

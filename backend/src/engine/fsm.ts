export type Step = 'MAIN_ACTIVITY' | 'THEORY' | 'REINFORCEMENT' | 'COMPLETED';
export type ActivityType = 'MAIN_ACTIVITY' | 'REINFORCEMENT';
export interface ProgressState { topicId: number; step: Step; theoryViewed: boolean }
export interface TransitionResult { next: ProgressState; completedTopicId?: number; feedback: 'correct' | 'incorrect' | 'theory_required' }
export class DomainError extends Error {
  constructor(public readonly status: 400 | 403 | 404 | 409 | 422, message: string) { super(message); this.name = 'DomainError'; }
}

export function submitAnswer(state: ProgressState, activityType: ActivityType, isCorrect: boolean, totalTopics: number): TransitionResult {
  if (state.step === 'COMPLETED') throw new DomainError(422, 'La ruta ya fue completada.');
  if (activityType !== state.step) throw new DomainError(409, 'La actividad no corresponde al paso actual.');
  if (!isCorrect && activityType === 'MAIN_ACTIVITY') {
    return { next: { topicId: state.topicId, step: 'THEORY', theoryViewed: false }, feedback: 'incorrect' };
  }
  if (!isCorrect) return { next: { topicId: state.topicId, step: 'THEORY', theoryViewed: false }, feedback: 'theory_required' };
  const completedTopicId = state.topicId;
  if (state.topicId >= totalTopics) return { next: { topicId: state.topicId, step: 'COMPLETED', theoryViewed: false }, completedTopicId, feedback: 'correct' };
  return { next: { topicId: state.topicId + 1, step: 'MAIN_ACTIVITY', theoryViewed: false }, completedTopicId, feedback: 'correct' };
}

export function consultTheory(state: ProgressState): ProgressState {
  if (state.step !== 'THEORY') throw new DomainError(409, 'La teoría no corresponde al paso actual.');
  return { topicId: state.topicId, step: 'REINFORCEMENT', theoryViewed: true };
}

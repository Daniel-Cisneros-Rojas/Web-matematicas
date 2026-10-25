import { describe, expect, it } from 'vitest';
import { consultTheory, DomainError, submitAnswer } from '../src/engine/fsm';

describe('FSM: reglas de transición', () => {
  it('regla 1: acierto principal completa tema y avanza', () => expect(submitAnswer({ topicId: 1, step: 'MAIN_ACTIVITY', theoryViewed: false }, 'MAIN_ACTIVITY', true, 3).next).toEqual({ topicId: 2, step: 'MAIN_ACTIVITY', theoryViewed: false }));
  it('regla 2: error principal conduce a teoría', () => expect(submitAnswer({ topicId: 1, step: 'MAIN_ACTIVITY', theoryViewed: false }, 'MAIN_ACTIVITY', false, 3).next.step).toBe('THEORY'));
  it('regla 3: consultar teoría habilita refuerzo', () => expect(consultTheory({ topicId: 1, step: 'THEORY', theoryViewed: false })).toEqual({ topicId: 1, step: 'REINFORCEMENT', theoryViewed: true }));
  it('regla 4: acierto en refuerzo avanza al siguiente tema', () => expect(submitAnswer({ topicId: 1, step: 'REINFORCEMENT', theoryViewed: true }, 'REINFORCEMENT', true, 3).next.topicId).toBe(2));
  it('regla 5: error en refuerzo obliga a consultar teoría nuevamente', () => expect(submitAnswer({ topicId: 1, step: 'REINFORCEMENT', theoryViewed: true }, 'REINFORCEMENT', false, 3).next).toEqual({ topicId: 1, step: 'THEORY', theoryViewed: false }));
  it('regla 6: permite ciclos ilimitados teoría-refuerzo', () => {
    let state = { topicId: 1, step: 'REINFORCEMENT' as const, theoryViewed: true };
    for (let i = 0; i < 12; i++) { state = submitAnswer(state, 'REINFORCEMENT', false, 3).next as typeof state; state = consultTheory(state) as typeof state; }
    expect(state).toEqual({ topicId: 1, step: 'REINFORCEMENT', theoryViewed: true });
  });
  it('regla 7: bloquea respuestas después de completar la ruta', () => expect(() => submitAnswer({ topicId: 3, step: 'COMPLETED', theoryViewed: false }, 'MAIN_ACTIVITY', true, 3)).toThrow(DomainError));
  it('regla 8: rechaza actividades fuera de orden', () => expect(() => submitAnswer({ topicId: 1, step: 'THEORY', theoryViewed: false }, 'MAIN_ACTIVITY', true, 3)).toThrow(DomainError));
  it('regla 9: acertar el último tema completa la ruta', () => expect(submitAnswer({ topicId: 3, step: 'REINFORCEMENT', theoryViewed: true }, 'REINFORCEMENT', true, 3).next.step).toBe('COMPLETED'));
});

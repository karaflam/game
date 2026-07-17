import { describe, expect, it } from 'vitest';
import { getHintForAttempt, isCorrectGuess, normalizeGuess } from './twentyQuestionsLogic';

describe('normalizeGuess', () => {
  it('trims whitespace and lowercases the value', () => {
    expect(normalizeGuess('  Chat  ')).toBe('chat');
  });
});

describe('isCorrectGuess', () => {
  it('returns true for a case-insensitive, trimmed match', () => {
    expect(isCorrectGuess('  CHAT ', 'chat')).toBe(true);
  });

  it('returns false when the guess does not match', () => {
    expect(isCorrectGuess('chien', 'chat')).toBe(false);
  });
});

describe('getHintForAttempt', () => {
  const hints = ['indice 1', 'indice 2', 'indice 3'];

  it('returns the first hint for attempt 0', () => {
    expect(getHintForAttempt(hints, 0)).toBe('indice 1');
  });

  it('cycles back to the first hint once attempts exceed the hint count', () => {
    expect(getHintForAttempt(hints, 3)).toBe('indice 1');
  });
});

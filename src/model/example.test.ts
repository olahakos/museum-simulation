import { describe, it, expect } from 'vitest';
import { loadScenario } from './loader';
import example from '../../scenarios/example.json';

describe('example scenario', () => {
  it('passes validation', () => {
    expect(() => loadScenario(example)).not.toThrow();
  });

  it('has the expected name', () => {
    expect(loadScenario(example).name).toBe('Example Museum');
  });
});

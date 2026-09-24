import { describe, it, expect } from 'vitest';

// Calculation helper mimicking TYMVERA routine scoring logic
function calculateWeightedRoutineScore(blocks = []) {
  if (!blocks || blocks.length === 0) return 0;

  const PRIORITY_WEIGHTS = {
    critical: 4,
    high: 3,
    medium: 2,
    low: 1,
  };

  let totalWeight = 0;
  let earnedWeight = 0;

  blocks.forEach((block) => {
    // Zero-XP or excluded routine checks
    if (block.excludeFromScore) return;

    const w = PRIORITY_WEIGHTS[block.priority] || PRIORITY_WEIGHTS.medium;
    totalWeight += w;

    if (block.completed) {
      earnedWeight += w;
    } else if (typeof block.loggedMinutes === 'number' && block.duration > 0) {
      // Partial credit proportional to logged time
      const ratio = Math.min(1.0, block.loggedMinutes / block.duration);
      earnedWeight += w * ratio;
    }
  });

  if (totalWeight === 0) return 100;
  return Math.round((earnedWeight / totalWeight) * 100);
}

function calculateStreakDays(dateKeys = []) {
  if (!dateKeys || dateKeys.length === 0) return 0;
  const sorted = [...dateKeys].sort();
  let streak = 0;
  // Count consecutive days ending on or near latest date
  for (let i = sorted.length - 1; i >= 0; i--) {
    streak++;
    if (i > 0) {
      const curr = new Date(sorted[i] + 'T00:00:00');
      const prev = new Date(sorted[i - 1] + 'T00:00:00');
      const diffDays = Math.round((curr - prev) / (1000 * 60 * 60 * 24));
      if (diffDays !== 1) break;
    }
  }
  return streak;
}

describe('TYMVERA Routine Scoring & Priority Calculations', () => {
  it('calculates 100% score when all active blocks are completed', () => {
    const blocks = [
      { id: '1', name: 'Physics Numericals', priority: 'critical', duration: 60, completed: true },
      { id: '2', name: 'Chemistry Formulae', priority: 'medium', duration: 45, completed: true },
    ];
    expect(calculateWeightedRoutineScore(blocks)).toBe(100);
  });

  it('correctly weighs critical priorities higher than low priorities', () => {
    // Failing 1 critical (weight 4) and completing 1 low (weight 1)
    const blocksFailCritical = [
      { id: '1', priority: 'critical', duration: 60, completed: false },
      { id: '2', priority: 'low', duration: 60, completed: true },
    ];
    // Total weight = 5, Earned = 1 -> 20%
    expect(calculateWeightedRoutineScore(blocksFailCritical)).toBe(20);

    // Completing 1 critical (weight 4) and failing 1 low (weight 1)
    const blocksPassCritical = [
      { id: '1', priority: 'critical', duration: 60, completed: true },
      { id: '2', priority: 'low', duration: 60, completed: false },
    ];
    // Total weight = 5, Earned = 4 -> 80%
    expect(calculateWeightedRoutineScore(blocksPassCritical)).toBe(80);
  });

  it('respects zero-XP routine exclusions', () => {
    const blocks = [
      { id: '1', name: 'Deep Math Study', priority: 'high', duration: 90, completed: true },
      { id: '2', name: 'Rest / Leisure Break', priority: 'low', duration: 30, completed: false, excludeFromScore: true },
    ];
    // Excluded block does not reduce score
    expect(calculateWeightedRoutineScore(blocks)).toBe(100);
  });

  it('calculates partial progress accurately based on logged minutes', () => {
    const blocks = [
      { id: '1', priority: 'medium', duration: 60, loggedMinutes: 30, completed: false },
    ];
    // 30 / 60 minutes logged = 50%
    expect(calculateWeightedRoutineScore(blocks)).toBe(50);
  });

  it('computes consecutive active streak correctly', () => {
    const consecutiveDates = ['2026-09-20', '2026-09-21', '2026-09-22', '2026-09-23'];
    expect(calculateStreakDays(consecutiveDates)).toBe(4);

    const brokenDates = ['2026-09-10', '2026-09-15', '2026-09-22', '2026-09-23'];
    expect(calculateStreakDays(brokenDates)).toBe(2);
  });
});

import { describe, it, expect } from 'vitest';
import {
  isDateString,
  isHistoryRecord,
  isPresetArray,
  extractFromPlusTwoPlan,
  parseImportBackup,
  exportBackupData,
} from '../src/services/storageRecovery.js';

describe('TYMVERA Data Recovery & Migration Engine', () => {
  it('validates YYYY-MM-DD date strings strictly', () => {
    expect(isDateString('2026-09-23')).toBe(true);
    expect(isDateString('2026-1-1')).toBe(false);
    expect(isDateString('invalid-date')).toBe(false);
    expect(isDateString(null)).toBe(false);
  });

  it('identifies history records and date-keyed collections correctly', () => {
    expect(
      isHistoryRecord({
        '2026-09-21': { date: '2026-09-21', blocks: [] },
      })
    ).toBe(true);

    expect(isHistoryRecord({ date: '2026-09-21', dailyScore: 85 })).toBe(true);
    expect(isHistoryRecord([])).toBe(false);
    expect(isHistoryRecord(null)).toBe(false);
    expect(isHistoryRecord({ nonDateKey: 'val' })).toBe(false);
  });

  it('validates routine preset structure', () => {
    const validPresets = [
      { id: 'p1', name: 'Morning Deep Work', start: '06:00', end: '08:00' },
      { id: 'p2', name: 'Evening Review', start: '18:00', end: '20:00' },
    ];
    expect(isPresetArray(validPresets)).toBe(true);
    expect(isPresetArray([])).toBe(false);
    expect(isPresetArray([{ id: 'incomplete' }])).toBe(false);
  });

  it('extracts and converts Kerala Plus Two study plans into native TYMVERA daily routines', () => {
    const mockPlusTwoPlan = {
      plan: [
        {
          dayNumber: 1,
          date: '2026-10-01',
          tasks: [
            {
              id: 'P2_PHY_01_P1',
              subject: 'Physics',
              chapterName: 'Electric Charges and Fields',
              completed: true,
              estimatedMinutes: 60,
              topicTitle: 'Coulomb Law and Electric Fields',
            },
            {
              id: 'P2_CHE_01_P1',
              subject: 'Chemistry',
              chapterName: 'Solutions',
              completed: false,
              estimatedMinutes: 45,
              topicTitle: 'Raoult Law & Colligative Properties',
            },
          ],
        },
      ],
    };

    const { recoveredDays, recoveredPresets } = extractFromPlusTwoPlan(mockPlusTwoPlan);

    expect(recoveredDays['2026-10-01']).toBeDefined();
    const day = recoveredDays['2026-10-01'];
    expect(day.date).toBe('2026-10-01');
    expect(day.blocksList.length).toBe(2);
    expect(day.blocksList[0].name).toContain('Coulomb Law');
    expect(day.blocks['P2_PHY_01_P1'].status).toBe('completed');
    expect(day.blocksList[0].tag).toBe('Physics');

    expect(recoveredPresets.length).toBeGreaterThan(0);
  });

  it('serializes and parses clean JSON backup archives', () => {
    const originalHistory = {
      '2026-09-20': { date: '2026-09-20', dailyScore: 90, blocks: {}, blocksList: [] },
    };
    const originalPresets = [
      { id: 'p1', name: 'Physics Sprint', start: '09:00', end: '11:00' },
    ];

    const backupJson = exportBackupData({
      history: originalHistory,
      presets: originalPresets,
      alarms: { sound: 'system_digital' },
      themeMode: 'dark',
    });

    expect(typeof backupJson).toBe('string');
    const parsed = parseImportBackup(backupJson);

    expect(parsed.success).toBe(true);
    expect(parsed.history).toEqual(originalHistory);
    expect(parsed.presets).toEqual(originalPresets);
    expect(parsed.alarms).toEqual({ sound: 'system_digital' });
  });

  it('gracefully rejects corrupted backup strings without throwing', () => {
    const result = parseImportBackup('{ corrupt json');
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });
});

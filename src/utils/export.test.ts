import { describe, expect, it } from 'vitest';
import type { GroupItem, IndividualParticipation, ScheduleItem, Student } from '../types';
import { formatDateDDMMYYYY, formatScheduleTimeCalculation, getScheduleContestantNames } from './export';

describe('schedule report helpers', () => {
  it('formats generated dates as dd/mm/yyyy', () => {
    expect(formatDateDDMMYYYY(new Date(2026, 8, 19))).toBe('19/09/2026');
  });

  it('lists matching individual contestants and group members for an age-category schedule entry', () => {
    const students: Student[] = [
      { id: 's1', name: 'Anu', registerNumber: '101', rollNumber: '1', class: '8A', ageCategory: 'Junior', sex: 'Female', houseId: 'h1' },
      { id: 's2', name: 'Beena', registerNumber: '102', rollNumber: '2', class: '8A', ageCategory: 'Junior', sex: 'Female', houseId: 'h1' },
      { id: 's3', name: 'Ciya', registerNumber: '201', rollNumber: '3', class: '10A', ageCategory: 'Senior', sex: 'Female', houseId: 'h1' },
    ];
    const participations: IndividualParticipation[] = [
      { studentId: 's1', itemId: 'i1' },
      { studentId: 's3', itemId: 'i1' },
    ];
    const groups: GroupItem[] = [
      { id: 'g1', name: 'Red Team', itemId: 'i1', houseId: 'h1', leaderId: 's1', members: ['s1', 's2'] },
      { id: 'g2', name: 'Senior Team', itemId: 'i1', houseId: 'h1', leaderId: 's3', members: ['s3'] },
    ];
    const schedule: ScheduleItem = {
      day: 1, itemId: 'i1', stageId: 'stage-1', ageCategory: 'Junior', startTime: '09:00', endTime: '09:20',
      participantCount: 2, timePerPerformance: 5, bufferMinutes: 10, totalDuration: 20,
    };

    expect(getScheduleContestantNames(schedule, students, participations, groups)).toEqual([
      '101 - Anu',
      'Red Team: 101 - Anu, 102 - Beena',
    ]);
    expect(formatScheduleTimeCalculation(schedule)).toBe('5 min x 2 = 10 min + 10 min buffer = 20 min');
  });
});

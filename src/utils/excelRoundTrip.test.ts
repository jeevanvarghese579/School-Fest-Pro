import { describe, expect, it } from 'vitest';
import { fromArrayBuffer, loadWorkbook, workbookToBytes } from '@office-kit/xlsx/io';
import { getSheet } from '@office-kit/xlsx/workbook';
import { setCell } from '@office-kit/xlsx/worksheet';
import type { ExcelWorkspaceData } from './excelRoundTrip';
import { createEditableExcelWorkbook, importEditableExcelWorkbook } from './excelRoundTrip';

function sampleData(): ExcelWorkspaceData {
  return {
    houses: [
      { id: 'house-red', name: 'Red', color: '#ff0000' },
      { id: 'house-unused', name: 'Unused', color: '#999999' },
    ],
    students: [{ id: 'student-1', name: 'Anu', rollNumber: '4', class: '8A', ageCategory: 'Junior', sex: 'Female', registerNumber: '101', houseId: 'house-red' }],
    items: [{ id: 'item-1', name: 'Long Jump', classification: 'Off Stage', stageId: 'stage-1', duration: 15, timePerPerformance: 2 }],
    participations: [{ studentId: 'student-1', itemId: 'item-1' }],
    groupItems: [{ id: 'group-empty', itemId: 'item-1', name: 'Reserved Team', members: [], houseId: 'house-red' }],
    results: [{ itemId: 'item-1', studentId: 'student-1', marks: 8.5, position: 1 }],
    schedule: [],
    settings: {
      schoolName: 'Test School', programmeName: 'Sports Day', scoresheetsPdfUrl: '', maxIndividualItems: 3,
      stages: [{ id: 'stage-1', name: 'Ground' }], programmeDays: 1, dayStartTime: '09:00', dayEndTime: '16:00', scheduleBufferMinutes: 5,
      individualPoints: { first: 5, second: 3, third: 1 }, groupPoints: { first: 10, second: 6, third: 2 },
    },
  };
}

describe('editable Excel round trip', () => {
  it('updates existing records, adds blank-ID rows, explicitly deletes, and preserves empty groups', async () => {
    const original = sampleData();
    const bytes = await createEditableExcelWorkbook(original);
    const workbook = await loadWorkbook(fromArrayBuffer(bytes));

    const students = getSheet(workbook, 'Students');
    const houses = getSheet(workbook, 'Houses');
    const settings = getSheet(workbook, 'Settings');
    if (!students || !houses || !settings) throw new Error('Expected editable sheets were not generated.');

    setCell(students, 2, 4, 'Anu Updated');
    ['', '', '202', 'Beena', '5', '8B', 'Junior', 'Female', 'house-red', 'Red']
      .forEach((value, index) => setCell(students, 3, index + 1, value));
    setCell(houses, 3, 1, 'DELETE');
    setCell(settings, 2, 2, 'Updated Sports Day');

    const edited = await workbookToBytes(workbook);
    const imported = await importEditableExcelWorkbook(new Blob([edited]), original);

    expect(imported.data.students).toHaveLength(2);
    expect(imported.data.students.find((student) => student.id === 'student-1')?.name).toBe('Anu Updated');
    expect(imported.data.students.find((student) => student.registerNumber === '202')?.id).toBeTruthy();
    expect(imported.data.houses.map((house) => house.id)).toEqual(['house-red']);
    expect(imported.data.groupItems).toContainEqual({ id: 'group-empty', itemId: 'item-1', name: 'Reserved Team', members: [], houseId: 'house-red' });
    expect(imported.data.settings.programmeName).toBe('Updated Sports Day');
    expect(imported.summary.added).toBeGreaterThanOrEqual(1);
    expect(imported.summary.deleted).toBe(1);
  });

  it('does not delete records that were simply omitted from the workbook', async () => {
    const original = sampleData();
    const bytes = await createEditableExcelWorkbook(original);
    const workbook = await loadWorkbook(fromArrayBuffer(bytes));
    const houses = getSheet(workbook, 'Houses');
    if (!houses) throw new Error('Houses sheet was not generated.');
    setCell(houses, 3, 1, null);
    setCell(houses, 3, 2, null);
    setCell(houses, 3, 3, null);
    setCell(houses, 3, 4, null);

    const imported = await importEditableExcelWorkbook(new Blob([await workbookToBytes(workbook)]), original);
    expect(imported.data.houses.some((house) => house.id === 'house-unused')).toBe(true);
  });
});

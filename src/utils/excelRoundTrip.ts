import { fromBlob, loadWorkbook, workbookToBytes } from '@office-kit/xlsx/io';
import { addWorksheet, createWorkbook, getSheet } from '@office-kit/xlsx/workbook';
import {
  iterValues,
  setAutoFilter,
  setCell,
  setColumnWidths,
  setFreezePanes,
} from '@office-kit/xlsx/worksheet';
import { makeAlignment, makeFont, makePatternFill, rgbColor, setRangeStyle } from '@office-kit/xlsx/styles';
import type { CellValue } from '@office-kit/xlsx/cell';
import type {
  AgeCategory,
  GroupItem,
  House,
  IndividualParticipation,
  Item,
  ItemClassification,
  Result,
  Settings,
  Student,
  StudentSex,
} from '../types';
import { generateId } from './storage';

export interface ExcelWorkspaceData {
  students: Student[];
  houses: House[];
  items: Item[];
  participations: IndividualParticipation[];
  groupItems: GroupItem[];
  settings: Settings;
  results: Result[];
  schedule: ReturnType<typeof import('./storage').getAllLocalData>['schedule'];
}

export interface ExcelImportSummary {
  added: number;
  updated: number;
  deleted: number;
  skipped: number;
  warnings: string[];
}

const FORMAT_VERSION = '1';
const MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const ACTIONS = new Set(['', 'UPDATE', 'UPSERT', 'DELETE']);
const ageCategories: AgeCategory[] = ['LP Mini', 'LP Kiddies', 'Kiddies', 'Sub Junior', 'Junior', 'Senior', 'Super Senior'];
const sexes: StudentSex[] = ['Male', 'Female', 'Other'];
const classifications: ItemClassification[] = ['Stage', 'Off Stage'];

type Row = Record<string, string>;

const sheetColumns = {
  Houses: ['Action', 'ID', 'Name', 'Color'],
  Students: ['Action', 'ID', 'Register Number', 'Name', 'Roll Number', 'Class', 'Age Category', 'Gender', 'House ID', 'House Name'],
  Items: ['Action', 'ID', 'Name', 'Classification', 'Stage ID', 'Stage Name', 'Duration (minutes)', 'Time per Performance (minutes)'],
  Participations: ['Action', 'Student ID', 'Register Number', 'Student Name', 'Item ID', 'Item Name'],
  Groups: ['Action', 'ID', 'Group Name', 'House ID', 'House Name', 'Item ID', 'Item Name', 'Leader ID', 'Leader Register Number', 'Member IDs (semicolon separated)', 'Member Register Numbers (semicolon separated)'],
  Results: ['Action', 'Item ID', 'Item Name', 'Student ID', 'Register Number', 'Marks', 'Position', 'Is Group', 'Group ID'],
  Settings: ['School Name', 'Programme Name', 'Scoresheets PDF URL', 'Max Individual Items', 'Programme Days', 'Day Start Time', 'Day End Time', 'Schedule Buffer Minutes', 'Individual First Points', 'Individual Second Points', 'Individual Third Points', 'Group First Points', 'Group Second Points', 'Group Third Points'],
  Stages: ['Action', 'ID', 'Name'],
} as const;

function asText(value: CellValue | undefined): string {
  if (value === null || value === undefined) return '';
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return String(value).trim();
  return '';
}

function numberValue(value: string, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function boolValue(value: string): boolean {
  return ['TRUE', 'YES', '1'].includes(value.trim().toUpperCase());
}

function splitIds(value: string): string[] {
  return [...new Set(value.split(';').map((part) => part.trim()).filter(Boolean))];
}

function columnLetter(column: number): string {
  let result = '';
  for (let value = column; value > 0; value = Math.floor((value - 1) / 26)) {
    result = String.fromCharCode(65 + ((value - 1) % 26)) + result;
  }
  return result;
}

function addTable(wb: ReturnType<typeof createWorkbook>, name: keyof typeof sheetColumns, rows: Array<Array<string | number | boolean>>, widths: number[]) {
  const ws = addWorksheet(wb, name);
  const headers = sheetColumns[name];
  headers.forEach((header, index) => setCell(ws, 1, index + 1, header));
  rows.forEach((row, rowIndex) => row.forEach((value, columnIndex) => setCell(ws, rowIndex + 2, columnIndex + 1, value)));
  setFreezePanes(ws, { rows: 1, cols: 0 });
  setColumnWidths(ws, widths);
  const lastRow = Math.max(rows.length + 1, 2);
  setAutoFilter(ws, { ref: `A1:${columnLetter(headers.length)}${lastRow}`, filterColumns: [] });
  setRangeStyle(wb, ws, `A1:${columnLetter(headers.length)}1`, {
    font: makeFont({ bold: true, color: rgbColor('FFFFFF') }),
    fill: makePatternFill({ patternType: 'solid', fgColor: rgbColor('1F4E78') }),
    alignment: makeAlignment({ vertical: 'center', wrapText: true }),
  });
  if (rows.length) {
    setRangeStyle(wb, ws, `A2:${columnLetter(headers.length)}${lastRow}`, {
      alignment: makeAlignment({ vertical: 'top', wrapText: true }),
    });
  }
}

function action(row: Row, sheet: string, summary: ExcelImportSummary): string | null {
  const value = (row.Action || '').trim().toUpperCase();
  if (ACTIONS.has(value)) return value;
  summary.warnings.push(`${sheet}: skipped a row with unknown Action "${row.Action}".`);
  summary.skipped += 1;
  return null;
}

function readRows(workbook: Awaited<ReturnType<typeof loadWorkbook>>, name: keyof typeof sheetColumns): Row[] {
  const sheet = getSheet(workbook, name);
  if (!sheet) return [];
  const values = [...iterValues(sheet)];
  if (!values.length) return [];
  const headers = values[0].map(asText);
  return values.slice(1).map((valuesRow) => Object.fromEntries(headers.map((header, index) => [header, asText(valuesRow[index])]))).filter((row) => Object.values(row).some(Boolean));
}

export async function createEditableExcelWorkbook(data: ExcelWorkspaceData): Promise<Uint8Array> {
  const wb = createWorkbook();
  const instructions = addWorksheet(wb, 'Instructions');
  const notes: Array<[string, string]> = [
    ['SchoolFest Excel Format Version', FORMAT_VERSION],
    ['How to update', 'Edit values in any data sheet, keep the ID columns unchanged, save as .xlsx, then import it in Data Management.'],
    ['How to add', 'Add a row and leave its ID blank. SchoolFest will create an ID when importing.'],
    ['How to delete', 'Type DELETE in the Action column. Removing a row from Excel does not delete it from SchoolFest.'],
    ['Relationships', 'Use the ID columns for links. Name and register-number columns are included to make the workbook easier to read.'],
    ['Safety', 'Import updates only the currently signed-in or local workspace; other users are not changed.'],
  ];
  notes.forEach(([label, value], index) => {
    setCell(instructions, index + 1, 1, label);
    setCell(instructions, index + 1, 2, value);
  });
  setColumnWidths(instructions, [34, 100]);
  setRangeStyle(wb, instructions, 'A1:A6', { font: makeFont({ bold: true, color: rgbColor('FFFFFF') }), fill: makePatternFill({ patternType: 'solid', fgColor: rgbColor('1F4E78') }), alignment: makeAlignment({ vertical: 'top', wrapText: true }) });
  setRangeStyle(wb, instructions, 'B1:B6', { alignment: makeAlignment({ vertical: 'top', wrapText: true }) });

  const houseById = new Map(data.houses.map((house) => [house.id, house]));
  const studentById = new Map(data.students.map((student) => [student.id, student]));
  const itemById = new Map(data.items.map((item) => [item.id, item]));
  const stageById = new Map(data.settings.stages.map((stage) => [stage.id, stage]));

  addTable(wb, 'Houses', data.houses.map((h) => ['', h.id, h.name, h.color]), [12, 38, 24, 16]);
  addTable(wb, 'Students', data.students.map((s) => ['', s.id, s.registerNumber, s.name, s.rollNumber, s.class, s.ageCategory, s.sex, s.houseId, houseById.get(s.houseId)?.name || '']), [12, 38, 18, 28, 18, 16, 18, 14, 38, 22]);
  addTable(wb, 'Items', data.items.map((i) => ['', i.id, i.name, i.classification, i.stageId, stageById.get(i.stageId)?.name || '', i.duration, i.timePerPerformance ?? '']), [12, 38, 30, 18, 38, 22, 20, 28]);
  addTable(wb, 'Participations', data.participations.map((p) => ['', p.studentId, studentById.get(p.studentId)?.registerNumber || '', studentById.get(p.studentId)?.name || '', p.itemId, itemById.get(p.itemId)?.name || '']), [12, 38, 18, 28, 38, 30]);
  addTable(wb, 'Groups', data.groupItems.map((g) => ['', g.id, g.name, g.houseId, houseById.get(g.houseId)?.name || '', g.itemId, itemById.get(g.itemId)?.name || '', g.leaderId || '', g.leaderId ? studentById.get(g.leaderId)?.registerNumber || '' : '', g.members.join('; '), g.members.map((id) => studentById.get(id)?.registerNumber || '').filter(Boolean).join('; ')]), [12, 38, 28, 38, 22, 38, 30, 38, 22, 60, 60]);
  addTable(wb, 'Results', data.results.map((r) => ['', r.itemId, itemById.get(r.itemId)?.name || '', r.studentId, studentById.get(r.studentId)?.registerNumber || '', r.marks, r.position, Boolean(r.isGroup), r.groupId || '']), [12, 38, 30, 38, 18, 14, 14, 14, 38]);
  addTable(wb, 'Settings', [[data.settings.schoolName, data.settings.programmeName, data.settings.scoresheetsPdfUrl, data.settings.maxIndividualItems, data.settings.programmeDays, data.settings.dayStartTime, data.settings.dayEndTime, data.settings.scheduleBufferMinutes, data.settings.individualPoints.first, data.settings.individualPoints.second, data.settings.individualPoints.third, data.settings.groupPoints.first, data.settings.groupPoints.second, data.settings.groupPoints.third]], [30, 30, 50, 22, 18, 18, 18, 24, 22, 22, 22, 18, 18, 18]);
  addTable(wb, 'Stages', data.settings.stages.map((s) => ['', s.id, s.name]), [12, 38, 28]);
  return workbookToBytes(wb);
}

function resolveId(id: string, display: string, entries: Array<{ id: string }>, getDisplay: (entry: { id: string }) => string): string {
  if (id && entries.some((entry) => entry.id === id)) return id;
  const normalized = display.trim().toLowerCase();
  return entries.find((entry) => getDisplay(entry).trim().toLowerCase() === normalized)?.id || '';
}

export async function importEditableExcelWorkbook(file: Blob, existing: ExcelWorkspaceData): Promise<{ data: ExcelWorkspaceData; summary: ExcelImportSummary }> {
  const workbook = await loadWorkbook(fromBlob(file));
  const instructionRows = getSheet(workbook, 'Instructions');
  const version = instructionRows ? asText([...iterValues(instructionRows)][0]?.[1]) : '';
  if (version !== FORMAT_VERSION) throw new Error('This is not a supported SchoolFest editable Excel file. Export a fresh file and try again.');

  const data: ExcelWorkspaceData = structuredClone(existing);
  const summary: ExcelImportSummary = { added: 0, updated: 0, deleted: 0, skipped: 0, warnings: [] };

  for (const row of readRows(workbook, 'Houses')) {
    const mode = action(row, 'Houses', summary); if (mode === null) continue;
    const index = data.houses.findIndex((h) => h.id === row.ID || (!row.ID && h.name.toLowerCase() === row.Name.toLowerCase()));
    if (mode === 'DELETE') {
      if (index >= 0 && !data.students.some((s) => s.houseId === data.houses[index].id) && !data.groupItems.some((g) => g.houseId === data.houses[index].id)) { data.houses.splice(index, 1); summary.deleted++; }
      else { summary.skipped++; summary.warnings.push(`Houses: could not delete "${row.Name || row.ID}" because it was not found or is still in use.`); }
      continue;
    }
    if (!row.Name) { summary.skipped++; summary.warnings.push('Houses: skipped a row without a name.'); continue; }
    const next: House = { id: index >= 0 ? data.houses[index].id : row.ID || generateId(), name: row.Name, color: row.Color || (index >= 0 ? data.houses[index].color : '#6b7280') };
    if (index >= 0) { data.houses[index] = next; summary.updated++; } else { data.houses.push(next); summary.added++; }
  }

  for (const row of readRows(workbook, 'Stages')) {
    const mode = action(row, 'Stages', summary); if (mode === null) continue;
    const index = data.settings.stages.findIndex((s) => s.id === row.ID || (!row.ID && s.name.toLowerCase() === row.Name.toLowerCase()));
    if (mode === 'DELETE') {
      if (index >= 0 && !data.items.some((item) => item.stageId === data.settings.stages[index].id)) { data.settings.stages.splice(index, 1); summary.deleted++; }
      else { summary.skipped++; summary.warnings.push(`Stages: could not delete "${row.Name || row.ID}" because it was not found or is still in use.`); }
      continue;
    }
    if (!row.Name) { summary.skipped++; summary.warnings.push('Stages: skipped a row without a name.'); continue; }
    const next = { id: index >= 0 ? data.settings.stages[index].id : row.ID || generateId(), name: row.Name };
    if (index >= 0) { data.settings.stages[index] = next; summary.updated++; } else { data.settings.stages.push(next); summary.added++; }
  }

  for (const row of readRows(workbook, 'Students')) {
    const mode = action(row, 'Students', summary); if (mode === null) continue;
    const index = data.students.findIndex((s) => s.id === row.ID || (!row.ID && Boolean(row['Register Number']) && s.registerNumber === row['Register Number']));
    if (mode === 'DELETE') {
      if (index < 0) { summary.skipped++; continue; }
      const id = data.students[index].id;
      data.students.splice(index, 1);
      data.participations = data.participations.filter((p) => p.studentId !== id);
      data.results = data.results.filter((r) => r.studentId !== id);
      data.groupItems = data.groupItems.map((g) => ({ ...g, members: g.members.filter((member) => member !== id), leaderId: g.leaderId === id ? undefined : g.leaderId }));
      summary.deleted++; continue;
    }
    const current = index >= 0 ? data.students[index] : undefined;
    const houseId = resolveId(row['House ID'], row['House Name'], data.houses, (entry) => (entry as House).name);
    const ageCategory = ageCategories.includes(row['Age Category'] as AgeCategory) ? row['Age Category'] as AgeCategory : current?.ageCategory;
    const sex = sexes.includes(row.Gender as StudentSex) ? row.Gender as StudentSex : current?.sex;
    if (!row.Name || !row['Register Number'] || !houseId || !ageCategory || !sex) { summary.skipped++; summary.warnings.push(`Students: skipped "${row.Name || row['Register Number'] || 'unnamed row'}" because required data or a valid house/category/gender was missing.`); continue; }
    const next: Student = { id: current?.id || row.ID || generateId(), registerNumber: row['Register Number'], name: row.Name, rollNumber: row['Roll Number'], class: row.Class, ageCategory, sex, houseId };
    if (index >= 0) { data.students[index] = next; summary.updated++; } else { data.students.push(next); summary.added++; }
  }

  for (const row of readRows(workbook, 'Items')) {
    const mode = action(row, 'Items', summary); if (mode === null) continue;
    const index = data.items.findIndex((i) => i.id === row.ID || (!row.ID && i.name.toLowerCase() === row.Name.toLowerCase()));
    if (mode === 'DELETE') {
      if (index < 0) { summary.skipped++; continue; }
      const id = data.items[index].id; data.items.splice(index, 1);
      data.participations = data.participations.filter((p) => p.itemId !== id);
      data.groupItems = data.groupItems.filter((g) => g.itemId !== id);
      data.results = data.results.filter((r) => r.itemId !== id);
      data.schedule = data.schedule.filter((s) => s.itemId !== id);
      summary.deleted++; continue;
    }
    const current = index >= 0 ? data.items[index] : undefined;
    const classification = classifications.includes(row.Classification as ItemClassification) ? row.Classification as ItemClassification : current?.classification;
    const stageId = resolveId(row['Stage ID'], row['Stage Name'], data.settings.stages, (entry) => (entry as { id: string; name: string }).name);
    if (!row.Name || !classification || !stageId) { summary.skipped++; summary.warnings.push(`Items: skipped "${row.Name || 'unnamed row'}" because its name, classification, or stage was invalid.`); continue; }
    const next: Item = { id: current?.id || row.ID || generateId(), name: row.Name, classification, stageId, duration: numberValue(row['Duration (minutes)'], current?.duration ?? 0), timePerPerformance: row['Time per Performance (minutes)'] ? numberValue(row['Time per Performance (minutes)'], current?.timePerPerformance ?? 0) : undefined };
    if (index >= 0) { data.items[index] = next; summary.updated++; } else { data.items.push(next); summary.added++; }
  }

  for (const row of readRows(workbook, 'Participations')) {
    const mode = action(row, 'Participations', summary); if (mode === null) continue;
    const studentId = resolveId(row['Student ID'], row['Register Number'], data.students, (entry) => (entry as Student).registerNumber);
    const itemId = resolveId(row['Item ID'], row['Item Name'], data.items, (entry) => (entry as Item).name);
    if (!studentId || !itemId) { summary.skipped++; summary.warnings.push('Participations: skipped a row whose student or item could not be found.'); continue; }
    const index = data.participations.findIndex((p) => p.studentId === studentId && p.itemId === itemId);
    if (mode === 'DELETE') { if (index >= 0) { data.participations.splice(index, 1); summary.deleted++; } else summary.skipped++; }
    else if (index >= 0) summary.updated++;
    else { data.participations.push({ studentId, itemId }); summary.added++; }
  }

  for (const row of readRows(workbook, 'Groups')) {
    const mode = action(row, 'Groups', summary); if (mode === null) continue;
    const houseId = resolveId(row['House ID'], row['House Name'], data.houses, (entry) => (entry as House).name);
    const itemId = resolveId(row['Item ID'], row['Item Name'], data.items, (entry) => (entry as Item).name);
    const index = data.groupItems.findIndex((g) => g.id === row.ID || (!row.ID && g.name.toLowerCase() === row['Group Name'].toLowerCase() && g.itemId === itemId && g.houseId === houseId));
    if (mode === 'DELETE') { if (index >= 0) { const id = data.groupItems[index].id; data.groupItems.splice(index, 1); data.results = data.results.filter((r) => r.groupId !== id); summary.deleted++; } else summary.skipped++; continue; }
    if (!row['Group Name'] || !houseId || !itemId) { summary.skipped++; summary.warnings.push(`Groups: skipped "${row['Group Name'] || 'unnamed row'}" because its house or item could not be found.`); continue; }
    let members = splitIds(row['Member IDs (semicolon separated)']).filter((id) => data.students.some((student) => student.id === id));
    if (!members.length && row['Member Register Numbers (semicolon separated)']) members = splitIds(row['Member Register Numbers (semicolon separated)']).map((registerNumber) => data.students.find((student) => student.registerNumber === registerNumber)?.id || '').filter(Boolean);
    const leaderId = resolveId(row['Leader ID'], row['Leader Register Number'], data.students, (entry) => (entry as Student).registerNumber) || undefined;
    const next: GroupItem = { id: index >= 0 ? data.groupItems[index].id : row.ID || generateId(), name: row['Group Name'], houseId, itemId, members, ...(leaderId ? { leaderId } : {}) };
    if (index >= 0) { data.groupItems[index] = next; summary.updated++; } else { data.groupItems.push(next); summary.added++; }
  }

  for (const row of readRows(workbook, 'Results')) {
    const mode = action(row, 'Results', summary); if (mode === null) continue;
    const itemId = resolveId(row['Item ID'], row['Item Name'], data.items, (entry) => (entry as Item).name);
    const studentId = resolveId(row['Student ID'], row['Register Number'], data.students, (entry) => (entry as Student).registerNumber);
    if (!itemId || !studentId) { summary.skipped++; summary.warnings.push('Results: skipped a row whose student or item could not be found.'); continue; }
    const isGroup = boolValue(row['Is Group']); const groupId = row['Group ID'] || undefined;
    const index = data.results.findIndex((r) => r.itemId === itemId && r.studentId === studentId && Boolean(r.isGroup) === isGroup && (r.groupId || '') === (groupId || ''));
    if (mode === 'DELETE') { if (index >= 0) { data.results.splice(index, 1); summary.deleted++; } else summary.skipped++; continue; }
    const next: Result = { itemId, studentId, marks: numberValue(row.Marks, 0), position: numberValue(row.Position, 0), ...(isGroup ? { isGroup: true } : {}), ...(groupId ? { groupId } : {}) };
    if (index >= 0) { data.results[index] = next; summary.updated++; } else { data.results.push(next); summary.added++; }
  }

  const settingsRow = readRows(workbook, 'Settings')[0];
  if (settingsRow) {
    data.settings = {
      ...data.settings,
      schoolName: settingsRow['School Name'] || data.settings.schoolName,
      programmeName: settingsRow['Programme Name'] || data.settings.programmeName,
      scoresheetsPdfUrl: settingsRow['Scoresheets PDF URL'],
      maxIndividualItems: numberValue(settingsRow['Max Individual Items'], data.settings.maxIndividualItems),
      programmeDays: numberValue(settingsRow['Programme Days'], data.settings.programmeDays),
      dayStartTime: settingsRow['Day Start Time'] || data.settings.dayStartTime,
      dayEndTime: settingsRow['Day End Time'] || data.settings.dayEndTime,
      scheduleBufferMinutes: numberValue(settingsRow['Schedule Buffer Minutes'], data.settings.scheduleBufferMinutes),
      individualPoints: { first: numberValue(settingsRow['Individual First Points'], data.settings.individualPoints.first), second: numberValue(settingsRow['Individual Second Points'], data.settings.individualPoints.second), third: numberValue(settingsRow['Individual Third Points'], data.settings.individualPoints.third) },
      groupPoints: { first: numberValue(settingsRow['Group First Points'], data.settings.groupPoints.first), second: numberValue(settingsRow['Group Second Points'], data.settings.groupPoints.second), third: numberValue(settingsRow['Group Third Points'], data.settings.groupPoints.third) },
    };
    summary.updated++;
  }
  return { data, summary };
}

export function downloadExcelWorkbook(bytes: Uint8Array, filename: string) {
  const blob = new Blob([bytes], { type: MIME });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url; link.download = filename; link.click();
  URL.revokeObjectURL(url);
}

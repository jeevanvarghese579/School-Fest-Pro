import { doc, getDoc, setDoc, deleteDoc  } from 'firebase/firestore';
import { auth, db } from '../firebase';
import type { Student, House, Item, IndividualParticipation, GroupItem, Settings, Result, ScheduleItem } from '../types';

export const DEFAULT_SCORESHEETS_PDF_URL =
  'https://drive.google.com/drive/folders/1laKsydueJPWJ0f3ZE6CMGJdb4vGo-Kbm?usp=sharing';

const STORAGE_KEYS = {
  STUDENTS: 'schoolfest_students',
  HOUSES: 'schoolfest_houses',
  ITEMS: 'schoolfest_items',
  INDIVIDUAL_PARTICIPATIONS: 'schoolfest_individual_participations',
  GROUP_ITEMS: 'schoolfest_group_items',
  SETTINGS: 'schoolfest_settings',
  RESULTS: 'schoolfest_results',
  SCHEDULE: 'schoolfest_schedule',
};

const CLOUD_DOC_PATH = 'main';

export function getAllLocalData() {
  return {
    students: getStudents(),
    houses: getHouses(),
    items: getItems(),
    participations: getIndividualParticipations(),
    groupItems: getGroupItems(),
    settings: getSettings(),
    results: getResults(),
    schedule: getSchedule(),
  };
}

export async function syncLocalDataToCloud() {
  const user = auth.currentUser;
  if (!user) return;

  await setDoc(
    doc(db, 'users', user.uid, 'schoolFestData', CLOUD_DOC_PATH),
    getAllLocalData()
  );
}

export async function loadCloudDataToLocal() {
  const user = auth.currentUser;
  if (!user) return false;

  const snap = await getDoc(
    doc(db, 'users', user.uid, 'schoolFestData', CLOUD_DOC_PATH)
  );

  if (!snap.exists()) return false;

  const data = snap.data();

  if (data.students) setStudents(data.students);
  if (data.houses) setHouses(data.houses);
  if (data.items) setItems(data.items);
  if (data.participations) setIndividualParticipations(data.participations);
  if (data.groupItems) setGroupItems(data.groupItems);
  if (data.settings) setSettings(data.settings);
  if (data.results) setResults(data.results);
  if (data.schedule) setSchedule(data.schedule);

  return true;
}

export async function resetAllDataEverywhere() {
  const user = auth.currentUser;

  localStorage.removeItem('schoolfest_students');
  localStorage.removeItem('schoolfest_houses');
  localStorage.removeItem('schoolfest_items');
  localStorage.removeItem('schoolfest_individual_participations');
  localStorage.removeItem('schoolfest_group_items');
  localStorage.removeItem('schoolfest_settings');
  localStorage.removeItem('schoolfest_results');
  localStorage.removeItem('schoolfest_schedule');

  if (user) {
    await deleteDoc(doc(db, 'users', user.uid, 'schoolFestData', 'main'));
  }
}

export const DEFAULT_HOUSE: House = {
  id: 'default-red-house',
  name: 'Red House',
  color: '#EF4444',
};

const DEFAULT_SETTINGS: Settings = {
  schoolName: '',
  programmeName: 'Annual Arts & Sports Festival',
  scoresheetsPdfUrl: DEFAULT_SCORESHEETS_PDF_URL,
  maxIndividualItems: 5,
  stages: [
    { id: 'stage-1', name: 'Main Stage' },
    { id: 'stage-2', name: 'Indoor Stage' },
  ],
  programmeDays: 2,
  dayStartTime: '09:00',
  dayEndTime: '17:00',
  scheduleBufferMinutes: 0,
  individualPoints: { first: 10, second: 7, third: 5 },
  groupPoints: { first: 15, second: 10, third: 7 },
};

function getStorageItem<T>(key: string, defaultValue: T): T {
  try {
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : defaultValue;
  } catch {
    return defaultValue;
  }
}

function setStorageItem<T>(key: string, value: T): void {
  localStorage.setItem(key, JSON.stringify(value));

  if (auth.currentUser) {
    syncLocalDataToCloud().catch(console.error);
  }
}

export function getStudents(): Student[] {
  return getStorageItem<Student[]>(STORAGE_KEYS.STUDENTS, []);
}

export function setStudents(students: Student[]): void {
  setStorageItem(STORAGE_KEYS.STUDENTS, students);
}

export function addStudent(student: Student): void {
  const students = getStudents();
  students.push(student);
  setStudents(students);
}

export function updateStudent(id: string, student: Partial<Student>): void {
  const students = getStudents();
  const index = students.findIndex(s => s.id === id);
  if (index !== -1) {
    students[index] = { ...students[index], ...student };
    setStudents(students);
  }
}

export function deleteStudent(id: string): void {
  const students = getStudents().filter(s => s.id !== id);
  setStudents(students);
}

export function getHouses(): House[] {
  if (localStorage.getItem(STORAGE_KEYS.HOUSES) === null) {
    return [DEFAULT_HOUSE];
  }
  return getStorageItem<House[]>(STORAGE_KEYS.HOUSES, []);
}

export function setHouses(houses: House[]): void {
  setStorageItem(STORAGE_KEYS.HOUSES, houses);
}

export function addHouse(house: House): void {
  const houses = getHouses();
  houses.push(house);
  setHouses(houses);
}

export function updateHouse(id: string, house: Partial<House>): void {
  const houses = getHouses();
  const index = houses.findIndex(h => h.id === id);
  if (index !== -1) {
    houses[index] = { ...houses[index], ...house };
    setHouses(houses);
  }
}

export function deleteHouse(id: string): void {
  const houses = getHouses().filter(h => h.id !== id);
  setHouses(houses);
}

export function getItems(): Item[] {
  return getStorageItem<Item[]>(STORAGE_KEYS.ITEMS, []);
}

export function setItems(items: Item[]): void {
  setStorageItem(STORAGE_KEYS.ITEMS, items);
}

export function addItem(item: Item): void {
  const items = getItems();
  items.push(item);
  setItems(items);
}

export function updateItem(id: string, item: Partial<Item>): void {
  const items = getItems();
  const index = items.findIndex(i => i.id === id);
  if (index !== -1) {
    items[index] = { ...items[index], ...item };
    setItems(items);
  }
}

export function deleteItem(id: string): void {
  const items = getItems().filter(i => i.id !== id);
  setItems(items);
}

export function getIndividualParticipations(): IndividualParticipation[] {
  return getStorageItem<IndividualParticipation[]>(STORAGE_KEYS.INDIVIDUAL_PARTICIPATIONS, []);
}

export function setIndividualParticipations(participations: IndividualParticipation[]): void {
  setStorageItem(STORAGE_KEYS.INDIVIDUAL_PARTICIPATIONS, participations);
}

export function addIndividualParticipation(participation: IndividualParticipation): void {
  const participations = getIndividualParticipations();
  const exists = participations.some(
    p => p.studentId === participation.studentId && p.itemId === participation.itemId
  );
  if (!exists) {
    participations.push(participation);
    setIndividualParticipations(participations);
  }
}

export function removeIndividualParticipation(studentId: string, itemId: string): void {
  const participations = getIndividualParticipations().filter(
    p => !(p.studentId === studentId && p.itemId === itemId)
  );
  setIndividualParticipations(participations);
}

export function getGroupItems(): GroupItem[] {
  return getStorageItem<GroupItem[]>(STORAGE_KEYS.GROUP_ITEMS, []);
}

export function setGroupItems(groupItems: GroupItem[]): void {
  setStorageItem(STORAGE_KEYS.GROUP_ITEMS, groupItems);
}

export function addGroupItem(groupItem: GroupItem): void {
  const groupItems = getGroupItems();
  groupItems.push(groupItem);
  setGroupItems(groupItems);
}

export function updateGroupItem(id: string, groupItem: Partial<GroupItem>): void {
  const groupItems = getGroupItems();
  const index = groupItems.findIndex(g => g.id === id);
  if (index !== -1) {
    groupItems[index] = { ...groupItems[index], ...groupItem };
    setGroupItems(groupItems);
  }
}

export function deleteGroupItem(id: string): void {
  const groupItems = getGroupItems().filter(g => g.id !== id);
  setGroupItems(groupItems);
}

export function getSettings(): Settings {
  const storedSettings = getStorageItem<Partial<Settings>>(STORAGE_KEYS.SETTINGS, {});
  return {
    ...DEFAULT_SETTINGS,
    ...storedSettings,
    scoresheetsPdfUrl: storedSettings.scoresheetsPdfUrl?.trim() || DEFAULT_SCORESHEETS_PDF_URL,
    scheduleBufferMinutes: storedSettings.scheduleBufferMinutes ?? DEFAULT_SETTINGS.scheduleBufferMinutes,
  };
}

export function setSettings(settings: Settings): void {
  setStorageItem(STORAGE_KEYS.SETTINGS, settings);
}

export function getResults(): Result[] {
  return getStorageItem<Result[]>(STORAGE_KEYS.RESULTS, []);
}

export function setResults(results: Result[]): void {
  setStorageItem(STORAGE_KEYS.RESULTS, results);
}

export function addOrUpdateResult(result: Result): void {
  const results = getResults();
  const index = results.findIndex(
    r => r.itemId === result.itemId && r.studentId === result.studentId && r.isGroup === result.isGroup && r.groupId === result.groupId
  );
  if (index !== -1) {
    results[index] = result;
  } else {
    results.push(result);
  }
  setResults(results);
}

export function deleteResult(itemId: string, studentId: string, isGroup?: boolean, groupId?: string): void {
  const results = getResults().filter(
    r => !(r.itemId === itemId && r.studentId === studentId && r.isGroup === isGroup && r.groupId === groupId)
  );
  setResults(results);
}

export function getSchedule(): ScheduleItem[] {
  return getStorageItem<ScheduleItem[]>(STORAGE_KEYS.SCHEDULE, []);
}

export function setSchedule(schedule: ScheduleItem[]): void {
  setStorageItem(STORAGE_KEYS.SCHEDULE, schedule);
}

export function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substring(2);
}

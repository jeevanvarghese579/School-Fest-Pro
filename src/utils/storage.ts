import { deleteDoc, doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
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

type WorkspaceData = ReturnType<typeof getAllLocalData>;
type WorkspaceRecord = { scope: string; data: Partial<WorkspaceData>; updatedAt: string };

const LOCAL_DATABASE = 'schoolfest-pro-local';
const LOCAL_STORE = 'workspaces';
const LOCAL_PROFILE_KEY = 'schoolfest_local_profile_id';
const FALLBACK_PREFIX = 'schoolfest_workspace_fallback:';
const CLOUD_ROOT = 'schoolFestProUsers';
const CLOUD_DOC_PATH = 'main';

let activeScope = '';
let workspaceData: Partial<WorkspaceData> = {};
let cloudAccessApproved = false;
let cloudSyncTimer: ReturnType<typeof setTimeout> | null = null;
let persistenceQueue = Promise.resolve();

function openLocalDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(LOCAL_DATABASE, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(LOCAL_STORE)) {
        request.result.createObjectStore(LOCAL_STORE, { keyPath: 'scope' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function readWorkspace(scope: string): Promise<WorkspaceRecord | null> {
  try {
    const database = await openLocalDatabase();
    return await new Promise((resolve, reject) => {
      const transaction = database.transaction(LOCAL_STORE, 'readonly');
      const request = transaction.objectStore(LOCAL_STORE).get(scope);
      request.onsuccess = () => resolve((request.result as WorkspaceRecord | undefined) || null);
      request.onerror = () => reject(request.error);
      transaction.oncomplete = () => database.close();
    });
  } catch (error) {
    console.warn('IndexedDB read failed; using the scoped local fallback.', error);
    const fallback = localStorage.getItem(`${FALLBACK_PREFIX}${scope}`);
    return fallback ? JSON.parse(fallback) as WorkspaceRecord : null;
  }
}

function writeWorkspace(): Promise<void> {
  if (!activeScope) return Promise.resolve();
  const record: WorkspaceRecord = {
    scope: activeScope,
    data: getAllLocalData(),
    updatedAt: new Date().toISOString(),
  };
  persistenceQueue = persistenceQueue.then(async () => {
    try {
      const database = await openLocalDatabase();
      await new Promise<void>((resolve, reject) => {
        const transaction = database.transaction(LOCAL_STORE, 'readwrite');
        transaction.objectStore(LOCAL_STORE).put(record);
        transaction.oncomplete = () => { database.close(); resolve(); };
        transaction.onerror = () => reject(transaction.error);
      });
      localStorage.removeItem(`${FALLBACK_PREFIX}${record.scope}`);
    } catch (error) {
      console.warn('IndexedDB write failed; using the scoped local fallback.', error);
      localStorage.setItem(`${FALLBACK_PREFIX}${record.scope}`, JSON.stringify(record));
    }
  });
  return persistenceQueue;
}

function getOrCreateLocalUserId() {
  let id = localStorage.getItem(LOCAL_PROFILE_KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(LOCAL_PROFILE_KEY, id);
  }
  return id;
}

function legacyData(): Partial<WorkspaceData> | null {
  const values = Object.entries(STORAGE_KEYS)
    .map(([name, key]) => [name, localStorage.getItem(key)] as const)
    .filter(([, value]) => value !== null);
  if (!values.length) return null;
  const parsed: Record<string, unknown> = {};
  const names: Record<string, keyof WorkspaceData> = {
    STUDENTS: 'students', HOUSES: 'houses', ITEMS: 'items',
    INDIVIDUAL_PARTICIPATIONS: 'participations', GROUP_ITEMS: 'groupItems',
    SETTINGS: 'settings', RESULTS: 'results', SCHEDULE: 'schedule',
  };
  for (const [name, value] of values) {
    try { parsed[names[name]] = JSON.parse(value || 'null'); } catch { /* Ignore invalid legacy data. */ }
  }
  return parsed as Partial<WorkspaceData>;
}

export async function configureWorkspace(mode: 'local' | 'online', uid?: string) {
  activeScope = mode === 'local' ? `local:${getOrCreateLocalUserId()}` : `firebase:${uid || ''}`;
  cloudAccessApproved = mode === 'online' && Boolean(uid);
  const stored = await readWorkspace(activeScope);
  workspaceData = stored?.data || {};

  if (!stored) {
    const legacy = legacyData();
    if (legacy) {
      workspaceData = legacy;
      await writeWorkspace();
      Object.values(STORAGE_KEYS).forEach((key) => localStorage.removeItem(key));
    }
  }
  return activeScope;
}

export function setCloudAccessApproved(approved: boolean) {
  cloudAccessApproved = approved;
}

export function getWorkspaceLabel() {
  return activeScope.startsWith('local:') ? 'Local offline workspace' : 'Secure online workspace';
}

export function flushWorkspacePersistence() {
  return writeWorkspace();
}

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

export async function restoreAllLocalData(data: Partial<WorkspaceData>) {
  workspaceData = {
    students: data.students || [],
    houses: data.houses || [DEFAULT_HOUSE],
    items: data.items || [],
    participations: data.participations || [],
    groupItems: data.groupItems || [],
    settings: data.settings || DEFAULT_SETTINGS,
    results: data.results || [],
    schedule: data.schedule || [],
  };
  await writeWorkspace();
  if (cloudAccessApproved) await syncLocalDataToCloud();
}

export async function syncLocalDataToCloud() {
  const user = auth.currentUser;
  if (!user || !cloudAccessApproved || activeScope !== `firebase:${user.uid}`) return false;

  await setDoc(
    doc(db, CLOUD_ROOT, user.uid, 'data', CLOUD_DOC_PATH),
    { ...getAllLocalData(), schemaVersion: 2, updatedAt: serverTimestamp() },
    { merge: true },
  );
  return true;
}

export async function loadCloudDataToLocal() {
  const user = auth.currentUser;
  if (!user || !cloudAccessApproved || activeScope !== `firebase:${user.uid}`) return false;

  let snap = await getDoc(doc(db, CLOUD_ROOT, user.uid, 'data', CLOUD_DOC_PATH));
  if (!snap.exists()) {
    const legacy = await getDoc(doc(db, 'users', user.uid, 'schoolFestData', CLOUD_DOC_PATH));
    if (legacy.exists()) snap = legacy;
  }

  if (!snap.exists()) {
    const localId = localStorage.getItem(LOCAL_PROFILE_KEY);
    const local = localId ? await readWorkspace(`local:${localId}`) : null;
    if (local?.data && Object.keys(local.data).length) {
      workspaceData = local.data;
      await writeWorkspace();
      await syncLocalDataToCloud();
      return true;
    }
    if (Object.keys(workspaceData).length) {
      await syncLocalDataToCloud();
      return true;
    }
    return false;
  }

  const data = snap.data();
  workspaceData = {
    students: data.students || [], houses: data.houses,
    items: data.items || [], participations: data.participations || [],
    groupItems: data.groupItems || [], settings: data.settings || {},
    results: data.results || [], schedule: data.schedule || [],
  };
  await writeWorkspace();

  // Copy a successfully read legacy document into the new app-specific root.
  if (!snap.ref.path.startsWith(CLOUD_ROOT)) await syncLocalDataToCloud();

  return true;
}

export async function resetAllDataEverywhere() {
  const user = auth.currentUser;

  workspaceData = {};
  await writeWorkspace();

  if (user && cloudAccessApproved && activeScope === `firebase:${user.uid}`) {
    await deleteDoc(doc(db, CLOUD_ROOT, user.uid, 'data', CLOUD_DOC_PATH));
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
  const properties: Record<string, keyof WorkspaceData> = {
    [STORAGE_KEYS.STUDENTS]: 'students', [STORAGE_KEYS.HOUSES]: 'houses',
    [STORAGE_KEYS.ITEMS]: 'items', [STORAGE_KEYS.INDIVIDUAL_PARTICIPATIONS]: 'participations',
    [STORAGE_KEYS.GROUP_ITEMS]: 'groupItems', [STORAGE_KEYS.SETTINGS]: 'settings',
    [STORAGE_KEYS.RESULTS]: 'results', [STORAGE_KEYS.SCHEDULE]: 'schedule',
  };
  return (workspaceData[properties[key]] as T | undefined) ?? defaultValue;
}

function setStorageItem<T>(key: string, value: T): void {
  const properties: Record<string, keyof WorkspaceData> = {
    [STORAGE_KEYS.STUDENTS]: 'students', [STORAGE_KEYS.HOUSES]: 'houses',
    [STORAGE_KEYS.ITEMS]: 'items', [STORAGE_KEYS.INDIVIDUAL_PARTICIPATIONS]: 'participations',
    [STORAGE_KEYS.GROUP_ITEMS]: 'groupItems', [STORAGE_KEYS.SETTINGS]: 'settings',
    [STORAGE_KEYS.RESULTS]: 'results', [STORAGE_KEYS.SCHEDULE]: 'schedule',
  };
  (workspaceData as Record<string, unknown>)[properties[key]] = value;
  void writeWorkspace();
  if (cloudAccessApproved) {
    if (cloudSyncTimer) clearTimeout(cloudSyncTimer);
    cloudSyncTimer = setTimeout(() => { void syncLocalDataToCloud().catch(console.error); }, 250);
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
  if (workspaceData.houses === undefined) {
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

function normalizeGroupItem(groupItem: GroupItem): GroupItem {
  const { leaderId, ...groupWithoutLeader } = groupItem;
  const members = Array.isArray(groupItem.members) ? groupItem.members.filter(Boolean) : [];
  return leaderId
    ? { ...groupWithoutLeader, members, leaderId }
    : { ...groupWithoutLeader, members };
}

export function getGroupItems(): GroupItem[] {
  return getStorageItem<GroupItem[]>(STORAGE_KEYS.GROUP_ITEMS, []).map(normalizeGroupItem);
}

export function setGroupItems(groupItems: GroupItem[]): void {
  setStorageItem(STORAGE_KEYS.GROUP_ITEMS, groupItems.map(normalizeGroupItem));
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
    groupItems[index] = normalizeGroupItem({ ...groupItems[index], ...groupItem });
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

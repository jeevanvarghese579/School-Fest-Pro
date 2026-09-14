// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../firebase', () => ({ auth: { currentUser: null }, db: {} }));

import {
  configureWorkspace,
  flushWorkspacePersistence,
  getStudents,
  setStudents,
} from './storage';

const alice = { id: 'student-a', name: 'Alice' } as ReturnType<typeof getStudents>[number];
const bob = { id: 'student-b', name: 'Bob' } as ReturnType<typeof getStudents>[number];

describe('workspace isolation', () => {
  beforeEach(() => localStorage.clear());

  it('keeps Firebase users in separate IndexedDB workspaces', async () => {
    await configureWorkspace('online', 'user-a');
    setStudents([alice]);
    await flushWorkspacePersistence();

    await configureWorkspace('online', 'user-b');
    expect(getStudents()).toEqual([]);
    setStudents([bob]);
    await flushWorkspacePersistence();

    await configureWorkspace('online', 'user-a');
    expect(getStudents()).toEqual([alice]);
  });

  it('reuses the stable local profile without mixing in online data', async () => {
    await configureWorkspace('local');
    setStudents([alice]);
    await flushWorkspacePersistence();

    await configureWorkspace('online', 'separate-user');
    setStudents([bob]);
    await flushWorkspacePersistence();

    await configureWorkspace('local');
    expect(getStudents()).toEqual([alice]);
  });

  it('claims legacy unscoped data once and removes the unsafe shared key', async () => {
    localStorage.setItem('schoolfest_students', JSON.stringify([alice]));
    await configureWorkspace('online', 'legacy-owner');
    expect(getStudents()).toEqual([alice]);
    expect(localStorage.getItem('schoolfest_students')).toBeNull();
  });
});

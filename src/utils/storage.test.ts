// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../firebase', () => ({ auth: { currentUser: null }, db: {} }));

import {
  configureWorkspace,
  flushWorkspacePersistence,
  getAllLocalData,
  getGroupItems,
  getHouses,
  getStudents,
  setGroupItems,
  setHouses,
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

  it('preserves a house-only group without writing an undefined leader', async () => {
    await configureWorkspace('online', 'group-owner');
    setGroupItems([{
      id: 'empty-group',
      name: 'Blue House Team',
      itemId: 'group-item',
      houseId: 'blue-house',
      members: [],
      leaderId: undefined,
    }]);
    await flushWorkspacePersistence();

    const savedGroup = getAllLocalData().groupItems[0];
    expect(savedGroup.members).toEqual([]);
    expect(savedGroup).not.toHaveProperty('leaderId');

    await configureWorkspace('online', 'another-user');
    await configureWorkspace('online', 'group-owner');
    expect(getGroupItems()).toEqual([savedGroup]);
  });

  it('shows the built-in red house as Red for existing and new workspaces', async () => {
    await configureWorkspace('online', 'house-name-owner');
    setHouses([{ id: 'default-red-house', name: 'Red House', color: '#EF4444' }]);
    expect(getHouses()[0].name).toBe('Red');

    await configureWorkspace('online', 'new-house-name-owner');
    expect(getHouses()[0].name).toBe('Red');
  });
});

import type { AgeCategory, Item, ScheduleItem } from '../types';
import { getGroupItems, getItems, getIndividualParticipations, getSettings, getStudents } from './storage';

type ScheduleAgeCategory = AgeCategory | 'Unspecified';

export interface ScheduleExcludedItem {
  itemId: string;
  itemName: string;
  reason: string;
}

export interface ScheduleDiagnostics {
  totalItemsFound: number;
  itemsWithParticipants: number;
  individualItemsCount: number;
  groupItemsCount: number;
  stageItemsIncluded: number;
  offStageItemsIncluded: number;
  totalItemsScheduled: number;
  totalItemsConsidered: number;
  totalScheduleEntriesGenerated: number;
  itemsExcluded: ScheduleExcludedItem[];
}

export interface ScheduleGenerationResult {
  schedule: ScheduleItem[];
  diagnostics: ScheduleDiagnostics;
}

interface ScheduleEvent {
  item: Item;
  ageCategory?: ScheduleAgeCategory;
  participantCount: number;
  hasIndividualParticipants: boolean;
  hasGroupParticipants: boolean;
  remark?: string;
}

function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number);
  return (hours || 0) * 60 + (minutes || 0);
}

function minutesToTime(totalMinutes: number): string {
  const normalizedMinutes = Math.max(0, totalMinutes);
  const hours = Math.floor(normalizedMinutes / 60);
  const minutes = normalizedMinutes % 60;
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
}

function getItemTimePerPerformance(item: Item): number {
  return Math.max(1, Number(item.timePerPerformance || item.duration) || 1);
}

function getGroupAgeCategory(group: ReturnType<typeof getGroupItems>[number], students: ReturnType<typeof getStudents>): ScheduleAgeCategory {
  const referenceStudent = students.find((student) => student.id === (group.leaderId || group.members[0]));
  return referenceStudent?.ageCategory || 'Unspecified';
}

function buildScheduleEvents(considerAgeCategories: boolean, considerOffStageItems: boolean): {
  events: ScheduleEvent[];
  diagnostics: Omit<ScheduleDiagnostics, 'totalScheduleEntriesGenerated'>;
} {
  const items = getItems();
  const participations = getIndividualParticipations();
  const groupItems = getGroupItems();
  const students = getStudents();
  const settings = getSettings();
  const stageIds = new Set(settings.stages.map((stage) => stage.id));
  const events: ScheduleEvent[] = [];
  const itemsExcluded: ScheduleExcludedItem[] = [];
  let individualItemsCount = 0;
  let groupItemsCount = 0;
  let itemsWithParticipants = 0;
  let stageItemsIncluded = 0;
  let offStageItemsIncluded = 0;

  items.forEach((item) => {
    const itemParticipations = participations.filter((participation) => participation.itemId === item.id);
    const itemGroups = groupItems.filter((group) => group.itemId === item.id);
    const participantCount = itemParticipations.length + itemGroups.length;

    if (itemParticipations.length > 0) individualItemsCount++;
    if (itemGroups.length > 0) groupItemsCount++;

    if (participantCount === 0) {
      itemsExcluded.push({ itemId: item.id, itemName: item.name, reason: 'No participants or groups registered' });
      return;
    }

    itemsWithParticipants++;

    if (!considerOffStageItems && item.classification === 'Off Stage') {
      itemsExcluded.push({ itemId: item.id, itemName: item.name, reason: 'Off Stage item excluded from schedule generation' });
      return;
    }

    if (item.classification === 'Off Stage') {
      offStageItemsIncluded++;
    } else {
      stageItemsIncluded++;
    }

    const fallbackStageId = settings.stages[0]?.id || item.stageId;
    const itemForSchedule = !item.stageId || !stageIds.has(item.stageId)
      ? { ...item, stageId: fallbackStageId }
      : item;
    const stageRemark = itemForSchedule.stageId !== item.stageId
      ? 'No valid stage assigned; scheduled on first available stage'
      : '';

    if (!considerAgeCategories) {
      events.push({
        item: itemForSchedule,
        participantCount,
        hasIndividualParticipants: itemParticipations.length > 0,
        hasGroupParticipants: itemGroups.length > 0,
        remark: stageRemark,
      });
      return;
    }

    const countsByAge = new Map<ScheduleAgeCategory, {
      count: number;
      hasIndividualParticipants: boolean;
      hasGroupParticipants: boolean;
    }>();

    itemParticipations.forEach((participation) => {
      const student = students.find((candidate) => candidate.id === participation.studentId);
      const ageCategory = student?.ageCategory || 'Unspecified';
      const current = countsByAge.get(ageCategory) || {
        count: 0,
        hasIndividualParticipants: false,
        hasGroupParticipants: false,
      };
      countsByAge.set(ageCategory, {
        ...current,
        count: current.count + 1,
        hasIndividualParticipants: true,
      });
    });

    itemGroups.forEach((group) => {
      const ageCategory = getGroupAgeCategory(group, students);
      const current = countsByAge.get(ageCategory) || {
        count: 0,
        hasIndividualParticipants: false,
        hasGroupParticipants: false,
      };
      countsByAge.set(ageCategory, {
        ...current,
        count: current.count + 1,
        hasGroupParticipants: true,
      });
    });

    Array.from(countsByAge.entries()).forEach(([ageCategory, entry]) => {
      events.push({
        item: itemForSchedule,
        ageCategory,
        participantCount: entry.count,
        hasIndividualParticipants: entry.hasIndividualParticipants,
        hasGroupParticipants: entry.hasGroupParticipants,
        remark: stageRemark,
      });
    });
  });

  return {
    events,
    diagnostics: {
      totalItemsFound: items.length,
      itemsWithParticipants,
      individualItemsCount,
      groupItemsCount,
      stageItemsIncluded,
      offStageItemsIncluded,
      totalItemsScheduled: stageItemsIncluded + offStageItemsIncluded,
      totalItemsConsidered: events.length,
      itemsExcluded,
    },
  };
}

export function generateScheduleResult(considerAgeCategories = false, considerOffStageItems = true): ScheduleGenerationResult {
  const settings = getSettings();
  const { events, diagnostics } = buildScheduleEvents(considerAgeCategories, considerOffStageItems);
  const schedule: ScheduleItem[] = [];
  const dayStartMinutes = timeToMinutes(settings.dayStartTime);
  const dayEndMinutes = timeToMinutes(settings.dayEndTime);
  const bufferMinutes = Math.max(0, Number(settings.scheduleBufferMinutes) || 0);
  const stageNextStart = new Map<string, number>();

  for (let day = 1; day <= settings.programmeDays; day++) {
    settings.stages.forEach((stage) => {
      stageNextStart.set(`${stage.id}-${day}`, dayStartMinutes);
    });
  }

  events.forEach((event) => {
    const timePerPerformance = getItemTimePerPerformance(event.item);
    const totalDuration = Math.max(1, event.participantCount * timePerPerformance + bufferMinutes);
    let selectedDay = 1;
    let selectedStart = dayStartMinutes;
    let remark = event.remark || '';

    for (let day = 1; day <= settings.programmeDays; day++) {
      const key = `${event.item.stageId}-${day}`;
      const nextStart = stageNextStart.get(key) ?? dayStartMinutes;
      if (nextStart + totalDuration <= dayEndMinutes) {
        selectedDay = day;
        selectedStart = nextStart;
        stageNextStart.set(key, nextStart + totalDuration);
        remark = [remark, event.hasGroupParticipants && event.hasIndividualParticipants ? 'Includes individual participants and groups' : '']
          .filter(Boolean)
          .join('; ');
        break;
      }

      if (day === settings.programmeDays) {
        selectedDay = day;
        selectedStart = nextStart;
        stageNextStart.set(key, nextStart + totalDuration);
        remark = [remark, `Overflow: scheduled beyond configured day end time (${minutesToTime(dayEndMinutes)})`]
          .filter(Boolean)
          .join('; ');
      }
    }

    schedule.push({
      day: selectedDay,
      itemId: event.item.id,
      stageId: event.item.stageId,
      ageCategory: event.ageCategory,
      startTime: minutesToTime(selectedStart),
      endTime: minutesToTime(selectedStart + totalDuration),
      participantCount: event.participantCount,
      timePerPerformance,
      bufferMinutes,
      totalDuration,
      remark,
    });
  });

  schedule.sort((a, b) => {
    if (a.day !== b.day) return a.day - b.day;
    if (a.stageId !== b.stageId) return a.stageId.localeCompare(b.stageId);
    return a.startTime.localeCompare(b.startTime);
  });

  return {
    schedule,
    diagnostics: {
      ...diagnostics,
      totalScheduleEntriesGenerated: schedule.length,
    },
  };
}

export function generateSchedule(considerAgeCategories = false, considerOffStageItems = true): ScheduleItem[] {
  return generateScheduleResult(considerAgeCategories, considerOffStageItems).schedule;
}

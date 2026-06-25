export type AgeCategory = 'LP Mini' | 'LP Kiddies' | 'Kiddies' | 'Sub Junior' | 'Junior' | 'Senior' | 'Super Senior';

export type ItemClassification = 'Stage' | 'Off Stage';

export type StudentSex = 'Male' | 'Female' | 'Other';

export interface Student {
  id: string;
  name: string;
  rollNumber: string;
  class: string;
  ageCategory: AgeCategory;
  sex: StudentSex;
  registerNumber: string;
  houseId: string;
}

export interface House {
  id: string;
  name: string;
  color: string;
}

export interface Item {
  id: string;
  name: string;
  classification: ItemClassification;
  stageId: string;
  timePerPerformance?: number;
  duration: number;
}

export interface Stage {
  id: string;
  name: string;
}

export interface IndividualParticipation {
  studentId: string;
  itemId: string;
}

export interface GroupItem {
  id: string;
  itemId: string;
  name: string;
  members: string[];
  leaderId?: string;
  houseId: string;
}

export interface Settings {
  schoolName: string;
  programmeName: string;
  scoresheetsPdfUrl: string;
  maxIndividualItems: number;
  stages: Stage[];
  programmeDays: number;
  dayStartTime: string;
  dayEndTime: string;
  scheduleBufferMinutes: number;
  individualPoints: {
    first: number;
    second: number;
    third: number;
  };
  groupPoints: {
    first: number;
    second: number;
    third: number;
  };
}

export interface Result {
  itemId: string;
  studentId: string;
  marks: number;
  position: number;
  isGroup?: boolean;
  groupId?: string;
}

export interface ScheduleItem {
  day: number;
  itemId: string;
  stageId: string;
  ageCategory?: AgeCategory | 'Unspecified';
  startTime: string;
  endTime: string;
  participantCount: number;
  timePerPerformance: number;
  bufferMinutes: number;
  totalDuration: number;
  remark?: string;
}

export interface HousePoints {
  houseId: string;
  points: number;
}

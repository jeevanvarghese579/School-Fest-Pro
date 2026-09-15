import Papa from 'papaparse';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { AgeCategory, Item, ItemClassification, Settings } from '../types';
import { getStudents, getItems, getHouses, getSettings, getIndividualParticipations, getGroupItems, getResults } from './storage';

export type CSVRow = Record<string, string>;

export interface ScoreSheetOptions {
  itemCategory: 'All' | ItemClassification;
  ageCategory: 'All' | AgeCategory;
  itemIds: 'All' | string[];
  sheetsPerPage: 1 | 2 | 3 | 4;
  includeConsolidated: boolean;
}

export function exportToCSV(data: Record<string, unknown>[], filename: string): void {
  if (data.length === 0) return;

  const headers = Object.keys(data[0]);
  const csvContent = [
    headers.join(','),
    ...data.map(row =>
      headers.map(header => {
        const value = row[header];
        if (typeof value === 'string' && (value.includes(',') || value.includes('"') || value.includes('\n'))) {
          return `"${value.replace(/"/g, '""')}"`;
        }
        return value ?? '';
      }).join(',')
    )
  ].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `${filename}.csv`;
  link.click();
  URL.revokeObjectURL(link.href);
}


export function parseCSV(csvText: string): CSVRow[] {
  const result = Papa.parse<Record<string, string>>(csvText, {
    header: true,
    skipEmptyLines: true,
  });

  return result.data.map((row) => {
    const cleanedRow: CSVRow = {};

    Object.entries(row).forEach(([key, value]) => {
      cleanedRow[key.trim()] = String(value ?? '')
        .replace(/\r?\n|\r/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    });

    return cleanedRow;
  });
}


function getItemParticipants(itemId: string): Array<{ registerNumber: string; chestNumber: string; name: string; className: string; houseName: string; ageCategory?: AgeCategory; isGroup?: boolean }> {
  const students = getStudents();
  const houses = getHouses();
  const participations = getIndividualParticipations();
  const groupItems = getGroupItems();

  const individualRows = participations
    .filter(p => p.itemId === itemId)
    .map(p => {
      const student = students.find(s => s.id === p.studentId);
      if (!student) return null;
      return {
        registerNumber: student.registerNumber,
        chestNumber: student.registerNumber,
        name: student.name,
        className: student.class,
        houseName: houses.find((house) => house.id === student.houseId)?.name || '',
        ageCategory: student.ageCategory,
      };
    })
    .filter(Boolean) as Array<{ registerNumber: string; chestNumber: string; name: string; className: string; houseName: string; ageCategory: AgeCategory }>;

  const groupRows = groupItems
    .filter(group => group.itemId === itemId)
    .map(group => {
      const leader = students.find(s => s.id === (group.leaderId || group.members[0]));
      return {
        registerNumber: leader?.registerNumber || group.name,
        chestNumber: leader?.registerNumber || group.name,
        name: group.name,
        className: 'Group',
        houseName: houses.find((house) => house.id === group.houseId)?.name || '',
        ageCategory: leader?.ageCategory,
        isGroup: true,
      };
    });

  return [...individualRows, ...groupRows];
}

function calculatePositions(marksList: { marks: number; index: number }[]): number[] {
  const sorted = [...marksList].sort((a, b) => b.marks - a.marks);
  const positions: number[] = new Array(marksList.length).fill(0);
  let currentPosition = 1;
  let prevMarks: number | null = null;
  let skipCount = 0;

  sorted.forEach((entry) => {
    if (prevMarks !== null && entry.marks < prevMarks) {
      currentPosition += skipCount;
      skipCount = 1;
    } else if (prevMarks === null) {
      skipCount = 1;
    } else {
      skipCount++;
    }
    positions[entry.index] = currentPosition;
    prevMarks = entry.marks;
  });

  return positions;
}

function getResultPoints(settings: Settings, position: number, isGroup?: boolean): number {
  const pointsConfig = isGroup ? settings.groupPoints : settings.individualPoints;
  if (position === 1) return pointsConfig.first;
  if (position === 2) return pointsConfig.second;
  if (position === 3) return pointsConfig.third;
  return 0;
}

export function formatTime12Hour(time: string): string {
  const [hourPart, minutePart = '0'] = time.split(':');
  const hour = Number(hourPart);
  const minute = Number(minutePart);
  if (Number.isNaN(hour) || Number.isNaN(minute)) return time;
  const suffix = hour >= 12 ? 'PM' : 'AM';
  const displayHour = hour % 12 || 12;
  return `${displayHour}:${minute.toString().padStart(2, '0')} ${suffix}`;
}

export function generatePDF(
  title: string,
  headers: string[],
  data: string[][],
  settings: Settings,
  options: { compactGeneratedDate?: boolean } = {}
): jsPDF {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();

  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text(settings.schoolName || 'School Name', pageWidth / 2, 15, { align: 'center' });

  doc.setFontSize(14);
  doc.text(settings.programmeName, pageWidth / 2, 22, { align: 'center' });

  doc.setFontSize(12);
  doc.setFont('helvetica', 'normal');
  doc.text(title, pageWidth / 2, 30, { align: 'center' });

  const compactDate = options.compactGeneratedDate === true;
  doc.setFontSize(compactDate ? 6 : 10);
  doc.setTextColor(compactDate ? 100 : 0);
  doc.text(
    `${compactDate ? 'Generated' : 'Date'}: ${new Date().toLocaleDateString()}`,
    compactDate ? pageWidth - 10 : pageWidth / 2,
    37,
    { align: compactDate ? 'right' : 'center' }
  );
  doc.setTextColor(0);

  const tableTop = compactDate ? 40 : 45;

  autoTable(doc, {
    head: [headers],
    body: data,
    startY: tableTop,
    styles: { fontSize: 9, cellPadding: 2 },
    headStyles: { fillColor: [41, 128, 185], textColor: 255, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [245, 245, 245] },
    margin: { top: tableTop, left: 10, right: 10 },
  });

  // Add numbering only after the table is complete so every page gets the final total.
  addReportFooter(doc);

  return doc;
}

export function generateHouseWiseReport(houseId: string): void {
  const students = getStudents();
  const participations = getIndividualParticipations();
  const items = getItems();
  const houses = getHouses();
  const settings = getSettings();
  const groupItems = getGroupItems();

  const house = houses.find(h => h.id === houseId);
  const houseStudents = students.filter(s => s.houseId === houseId);

  const data = houseStudents.map(student => {
    const studentParticipations = participations.filter(p => p.studentId === student.id);
    const studentGroupItems = groupItems.filter(group => group.members.includes(student.id));
    const itemNames = studentParticipations.map(p => {
      const item = items.find(i => i.id === p.itemId);
      return item?.name || '';
    });
    const groupNames = studentGroupItems.map(group => {
      const item = items.find(i => i.id === group.itemId);
      return `${item?.name || group.name} (Group)`;
    });

    return [
      student.registerNumber,
      student.name,
      student.class,
      student.ageCategory,
      student.sex || '',
      [...itemNames, ...groupNames].join(', '),
      (studentParticipations.length + studentGroupItems.length).toString()
    ];
  });

  const doc = generatePDF(
    `House-wise Report - ${house?.name || ''}`,
    ['Reg No', 'Name', 'Class', 'Age Category', 'Sex', 'Items', 'Total'],
    data,
    settings
  );

  doc.save(`house-report-${house?.name?.replace(/\s+/g, '-') || 'unknown'}.pdf`);
}

export function generateClassWiseReport(classFilter: string): void {
  const students = getStudents();
  const participations = getIndividualParticipations();
  const items = getItems();
  const houses = getHouses();
  const settings = getSettings();

  const groupItems = getGroupItems();
  const classStudents = students.filter(s => s.class === classFilter);

  const data = classStudents.flatMap(student => {
    const studentParticipations = participations.filter(p => p.studentId === student.id);
    const studentGroupItems = groupItems.filter(group => group.members.includes(student.id));
    if (studentParticipations.length === 0 && studentGroupItems.length === 0) return [];

    const house = houses.find(h => h.id === student.houseId);
    const individualNames = studentParticipations.map(p => {
      const item = items.find(i => i.id === p.itemId);
      return item?.name || '';
    });
    const groupNames = studentGroupItems.map(group => {
      const item = items.find(i => i.id === group.itemId);
      return `${item?.name || group.name} (Group)`;
    });

    return [[
      student.registerNumber,
      student.name,
      house?.name || '',
      student.ageCategory,
      student.sex || '',
      [...individualNames, ...groupNames].join(', '),
      (studentParticipations.length + studentGroupItems.length).toString()
    ]];
  });

  const doc = generatePDF(
    `Class-wise Report - ${classFilter}`,
    ['Reg No', 'Name', 'House', 'Age Category', 'Sex', 'Items', 'Total'],
    data,
    settings
  );

  doc.save(`class-report-${classFilter.replace(/\s+/g, '-')}.pdf`);
}

export function generateStudentWiseReport(studentId: string): void {
  const students = getStudents();
  const participations = getIndividualParticipations();
  const items = getItems();
  const stages = getSettings().stages;
  const settings = getSettings();
  const groupItems = getGroupItems();

  const student = students.find(s => s.id === studentId);
  if (!student) return;

  const studentParticipations = participations.filter(p => p.studentId === studentId);
  const studentGroupItems = groupItems.filter(group => group.members.includes(studentId));

  const individualData = studentParticipations.map(p => {
    const item = items.find(i => i.id === p.itemId);
    const stage = stages.find(s => s.id === item?.stageId);
    return [
      item?.name || '',
      item?.classification || '',
      stage?.name || '',
      ''
    ];
  });
  const groupData = studentGroupItems.map(group => {
    const item = items.find(i => i.id === group.itemId);
    const stage = stages.find(s => s.id === item?.stageId);
    return [
      `${item?.name || group.name} (Group)`,
      item?.classification || '',
      stage?.name || '',
      ''
    ];
  });

  const doc = generatePDF(
    `Student Report - ${student.name}`,
    ['Item', 'Classification', 'Stage', 'Time'],
    [
      ['Register Number', student.registerNumber, '', ''],
      ['Class', student.class, '', ''],
      ['Age Category', student.ageCategory, '', ''],
      ['Sex', student.sex || '', '', ''],
      ['', '', '', ''],
      ...individualData,
      ...groupData,
    ],
    settings
  );

  doc.save(`student-report-${student.name.replace(/\s+/g, '-')}.pdf`);
}

export function generateParticipantCards(cardsPerPage: number): void {
  const students = getStudents();
  const participations = getIndividualParticipations();
  const items = getItems();
  const groupItems = getGroupItems();
  const houses = getHouses();
  const stages = getSettings().stages;
  const settings = getSettings();
  const cardsOnPage = [4, 6, 8, 16].includes(cardsPerPage) ? cardsPerPage : 8;
  const participatingStudents = students.filter(
    student =>
      participations.some(p => p.studentId === student.id) ||
      groupItems.some(group => group.members.includes(student.id))
  );

  const doc = new jsPDF('portrait', 'mm', 'a4');
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  const cols = cardsOnPage === 16 ? 4 : 2;
  const rows = cardsOnPage / cols;
  const margin = 8;
  const cardWidth = (pageWidth - margin * 2) / cols;
  const cardHeight = (pageHeight - margin * 2) / rows;
  const baseFont = cardsOnPage === 4 ? 10 : cardsOnPage === 6 ? 8 : cardsOnPage === 16 ? 5 : 7;
  const titleFont = cardsOnPage === 4 ? 12 : cardsOnPage === 6 ? 10 : cardsOnPage === 16 ? 6 : 8;
  const maxRegisterFont = cardsOnPage === 4 ? 280 : cardsOnPage === 6 ? 190 : cardsOnPage === 16 ? 90 : 130;

  let cardIndex = 0;

  participatingStudents.forEach((student) => {
    if (cardIndex > 0 && cardIndex % cardsOnPage === 0) {
      doc.addPage();
    }

    const cardOnPageIndex = cardIndex % cardsOnPage;
    const col = cardOnPageIndex % cols;
    const row = Math.floor(cardOnPageIndex / cols);

    const x = margin + col * cardWidth;
    const y = margin + row * cardHeight;
    const innerX = x + 3;
    const textWidth = cardWidth - 6;

    doc.setDrawColor(0);
    doc.setLineWidth(0.25);
    doc.rect(x + 1, y + 1, cardWidth - 2, cardHeight - 2);

    const registerNumber = student.registerNumber || '-';
    let registerFont = maxRegisterFont;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(registerFont);
    while (registerFont > baseFont + 2 && doc.getTextWidth(registerNumber) > textWidth - 2) {
      registerFont -= 1;
      doc.setFontSize(registerFont);
    }
    doc.setTextColor(0);
    doc.text(registerNumber, x + cardWidth / 2, y + cardHeight * 0.67, { align: 'center' });

    doc.setFontSize(titleFont);
    doc.setFont('helvetica', 'bold');
    const compactCard = cardsOnPage >= 8;
    doc.text('Participation Card', x + cardWidth / 2, y + (compactCard ? 5 : 6), { align: 'center' });
    doc.setFontSize(baseFont);
    doc.text(doc.splitTextToSize(settings.schoolName || 'School Name', textWidth), x + cardWidth / 2, y + (compactCard ? 9 : 11), { align: 'center' });
    doc.setFont('helvetica', 'bold');
    doc.text(doc.splitTextToSize(settings.programmeName, textWidth), x + cardWidth / 2, y + (compactCard ? 13 : 16), { align: 'center' });

    let cursorY = y + (cardsOnPage === 4 ? 54 : cardsOnPage === 6 ? 40 : cardsOnPage === 16 ? 28 : 31);

    doc.setFontSize(baseFont);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(255);
    doc.setDrawColor(0);
    doc.setLineWidth(cardsOnPage === 16 ? 0.15 : 0.25);
    const houseName = houses.find((house) => house.id === student.houseId)?.name || '-';
    [
      `Name: ${student.name} | House: ${houseName}`,
      `Class: ${student.class}`,
      `Category: ${student.ageCategory} | Gender: ${student.sex || '-'}`,
    ].forEach(line => {
      const wrapped = doc.splitTextToSize(line, textWidth);
      doc.text(wrapped, innerX, cursorY, { renderingMode: 'fillThenStroke' });
      cursorY += wrapped.length * (baseFont * 0.45) + (cardsOnPage >= 8 ? 1 : 2);
    });

    const studentIndividualItems = participations
      .filter(p => p.studentId === student.id)
      .map(p => {
        const item = items.find(it => it.id === p.itemId);
        const stage = stages.find(s => s.id === item?.stageId);
        return `${item?.name || ''}${stage ? ` (${stage.name})` : ''}`;
      });
    const studentGroupItems = groupItems
      .filter(group => group.members.includes(student.id))
      .map(group => {
        const item = items.find(it => it.id === group.itemId);
        return `${item?.name || group.name} (Group)`;
      });
    const studentItems = [...studentIndividualItems, ...studentGroupItems].filter(Boolean);
    const numberedStudentItems = studentItems.map((itemName, index) => `${index + 1}. ${itemName}`);

    doc.setFont('helvetica', 'bold');
    doc.text('Items:', innerX, cursorY, { renderingMode: 'fillThenStroke' });
    cursorY += cardsOnPage >= 8 ? 2.5 : 3;
    doc.setFont('helvetica', 'bold');

    const availableBottom = y + cardHeight - 4;
    const availableHeight = Math.max(1, availableBottom - cursorY);
    const buildItemColumns = (columnCount: number, fontSize: number) => {
      doc.setFontSize(fontSize);
      const gap = columnCount === 2 ? 2 : 0;
      const columnWidth = (textWidth - gap) / columnCount;
      const itemsPerColumn = Math.ceil(numberedStudentItems.length / columnCount);
      const columns = Array.from({ length: columnCount }, (_, columnIndex) =>
        numberedStudentItems
          .slice(columnIndex * itemsPerColumn, (columnIndex + 1) * itemsPerColumn)
          .flatMap((itemName) => doc.splitTextToSize(itemName, columnWidth))
      );
      return { columns, columnWidth, gap, maxLines: Math.max(0, ...columns.map((lines) => lines.length)) };
    };

    if (numberedStudentItems.length === 0) {
      doc.text('None', innerX, cursorY, { renderingMode: 'fillThenStroke' });
    } else {
      const singleColumn = buildItemColumns(1, baseFont);
      const twoColumns = numberedStudentItems.length > 1 ? buildItemColumns(2, baseFont) : singleColumn;
      const columnCount = twoColumns.maxLines < singleColumn.maxLines ? 2 : 1;
      let itemFont = baseFont;
      let itemLayout = buildItemColumns(columnCount, itemFont);
      let lineHeight = itemFont * 0.45 + 0.8;

      while (itemFont > 3 && itemLayout.maxLines * lineHeight > availableHeight) {
        itemFont -= 0.5;
        itemLayout = buildItemColumns(columnCount, itemFont);
        lineHeight = itemFont * 0.45 + 0.5;
      }
      if (itemLayout.maxLines > 1) {
        lineHeight = Math.min(lineHeight, availableHeight / (itemLayout.maxLines - 1));
      }

      doc.setFontSize(itemFont);
      itemLayout.columns.forEach((lines, columnIndex) => {
        const columnX = innerX + columnIndex * (itemLayout.columnWidth + itemLayout.gap);
        lines.forEach((line, lineIndex) => {
          doc.text(line, columnX, cursorY + lineIndex * lineHeight, { renderingMode: 'fillThenStroke' });
        });
      });
    }
    doc.setTextColor(0);

    cardIndex++;
  });

  doc.save('participant-cards.pdf');
}

export function generateStageWiseList(stageId: string): void {
  const items = getItems();
  const participations = getIndividualParticipations();
  const students = getStudents();
  const groupItems = getGroupItems();
  const stages = getSettings().stages;
  const settings = getSettings();

  const stage = stages.find(s => s.id === stageId);
  const stageItems = items.filter(i => i.stageId === stageId);

  const data: string[][] = [];

  stageItems.forEach(item => {
    const itemParticipations = participations.filter(p => p.itemId === item.id);
    const itemGroups = groupItems.filter(group => group.itemId === item.id);
    if (itemParticipations.length === 0 && itemGroups.length === 0) return;
    data.push([item.name, '', '', '']);
    itemParticipations.forEach(p => {
      const student = students.find(s => s.id === p.studentId);
      data.push([
        '',
        student?.registerNumber || '',
        student?.name || '',
        student?.class || ''
      ]);
    });
    itemGroups.forEach(group => {
      data.push([
        '',
        group.name,
        group.members
          .map(id => students.find(s => s.id === id)?.name || '')
          .filter(Boolean)
          .join(', '),
        'Group'
      ]);
    });
    data.push(['', '', '', '']);
  });

  const doc = generatePDF(
    `Stage-wise List - ${stage?.name || ''}`,
    ['Item', 'Reg No', 'Name', 'Class'],
    data,
    settings
  );

  doc.save(`stage-list-${stage?.name?.replace(/\s+/g, '-') || 'unknown'}.pdf`);
}

export function generateGroupList(): void {
  const groupItems = getGroupItems();
  const items = getItems();
  const students = getStudents();
  const houses = getHouses();
  const stages = getSettings().stages;
  const settings = getSettings();

  const data = groupItems.map(group => {
    const item = items.find(i => i.id === group.itemId);
    const stage = stages.find(s => s.id === item?.stageId);
    const house = houses.find(h => h.id === group.houseId);
    const memberOrder = group.leaderId
      ? [group.leaderId, ...group.members.filter(id => id !== group.leaderId)]
      : group.members;
    const memberNames = memberOrder.map(id => {
      const student = students.find(s => s.id === id);
      return student?.name || '';
    }).join(', ');

    return [
      group.name,
      item?.name || '',
      house?.name || '',
      stage?.name || '',
      memberNames,
      group.members.length.toString()
    ];
  });

  const doc = generatePDF(
    'Group Items List',
    ['Group Name', 'Item', 'House', 'Stage', 'Members', 'Count'],
    data,
    settings
  );

  doc.save('group-list.pdf');
}

export function generateResultsPDF(): void {
  const results = getResults();
  const items = getItems();
  const students = getStudents();
  const houses = getHouses();
  const groupItems = getGroupItems();
  const settings = getSettings();

  const data: string[][] = [];

  items.forEach(item => {
    const itemResults = results.filter(r => r.itemId === item.id);
    if (itemResults.length > 0) {
      data.push([item.name, '', '', '', '']);
      const positions = calculatePositions(itemResults.map((result, index) => ({ marks: result.marks, index })));
      const rankedResults = itemResults.map((result, index) => ({ ...result, position: positions[index] }));
      const sorted = rankedResults.sort((a, b) => a.position - b.position).filter(r => r.position >= 1 && r.position <= 3);
      sorted.forEach(result => {
        const group = result.isGroup ? groupItems.find(g => g.id === result.groupId) : undefined;
        const student = result.isGroup ? undefined : students.find(s => s.id === result.studentId);
        const house = houses.find(h => h.id === (group?.houseId || student?.houseId));
        data.push([
          getPositionSuffix(result.position),
          group?.name || student?.name || '',
          house?.name || '',
          result.marks.toString(),
          getResultPoints(settings, result.position, result.isGroup).toString()
        ]);
      });
      data.push(['', '', '', '', '']);
    }
  });

  const doc = generatePDF(
    'Results',
    ['Position', 'Name', 'House', 'Marks', 'Points'],
    data,
    settings
  );

  doc.save('results.pdf');
}

export function generateResultsCSV(): void {
  const results = getResults();
  const items = getItems();
  const students = getStudents();
  const houses = getHouses();
  const groupItems = getGroupItems();

  const csvData: Record<string, string>[] = [];

  // Get all results with their positions
  const allItemResults = items.flatMap(item => {
    const itemResults = results.filter(r => r.itemId === item.id);
    if (itemResults.length === 0) return [];
    
    const positions = calculatePositions(itemResults.map((result, index) => ({ marks: result.marks, index })));
    return itemResults.map((result, index) => ({
      ...result,
      position: positions[index],
      itemName: item.name,
    }));
  });

  // Sort by position
  const sortedResults = allItemResults.sort((a, b) => a.position - b.position);

  sortedResults.forEach(result => {
    if (result.isGroup) {
      // For group results, create a row for each member as an individual participant
      const group = groupItems.find(g => g.id === result.groupId);
      if (!group) return;
      
      const house = houses.find(h => h.id === group.houseId);
      const itemNameWithGroup = `${result.itemName} (Group)`;
      
      // Create a separate row for each group member
      group.members.forEach(memberId => {
        const member = students.find(s => s.id === memberId);
        if (!member) return;
        
        csvData.push({
          'Student Name': member.name,
          'Item': itemNameWithGroup,
          'Reg No': member.registerNumber,
          'Class': member.class,
          'Position': getPositionSuffix(result.position),
          'Grade': '',
          'Marks': result.marks.toString(),
          'House': house?.name || '',
        });
      });
    } else {
      // For individual results
      const student = students.find(s => s.id === result.studentId);
      if (!student) return;
      
      const house = houses.find(h => h.id === student.houseId);
      
      csvData.push({
        'Student Name': student.name,
        'Item': result.itemName,
        'Reg No': student.registerNumber,
        'Class': student.class,
        'Position': getPositionSuffix(result.position),
        'Grade': '',
        'Marks': result.marks.toString(),
        'House': house?.name || '',
      });
    }
  });

  exportToCSV(csvData, 'results');
}

export function generateItemWiseReport(considerAgeCategories = false): void {
  const items = getItems();
  const settings = getSettings();
  const data: string[][] = [];

  items.forEach(item => {
    const participants = getItemParticipants(item.id);
    if (participants.length === 0) return;
    const sections = considerAgeCategories
      ? Array.from(new Set(participants.map((participant) => participant.ageCategory || 'Unspecified')))
          .sort()
          .map((ageCategory) => ({
            heading: `${item.name} (${ageCategory})`,
            ageCategory,
            participants: participants.filter((participant) => (participant.ageCategory || 'Unspecified') === ageCategory),
          }))
      : [{ heading: item.name, ageCategory: '', participants }];

    sections.forEach((section) => {
      if (section.participants.length === 0) return;
      data.push([section.heading, section.ageCategory, '', '', '', '', '']);
      section.participants.forEach((participant, index) => {
        data.push([
          (index + 1).toString(),
          participant.registerNumber,
          participant.name,
          participant.className,
          participant.houseName,
          participant.ageCategory || '',
          participant.isGroup ? 'Group' : 'Individual',
        ]);
      });
      data.push(['', '', '', '', '', '', '']);
    });
  });

  const doc = generatePDF(
    'Item-wise Report',
    ['SL No', 'Reg No', 'Participant', 'Class', 'House Name', 'Age Category', 'Type'],
    data,
    settings,
    { compactGeneratedDate: true }
  );

  doc.save('item-wise-report.pdf');
}

function addReportFooter(doc: jsPDF): void {
  const pageCount = doc.getNumberOfPages();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  for (let page = 1; page <= pageCount; page++) {
    doc.setPage(page);
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.text(`${page} of ${pageCount}`, pageWidth / 2, pageHeight - 5, { align: 'center' });
  }
}

function drawScoreSheet(doc: jsPDF, item: Item, participants: ReturnType<typeof getItemParticipants>, x: number, y: number, width: number, height: number, settings: Settings): void {
  const blue: [number, number, number] = [20, 28, 150];
  const rowCount = Math.max(participants.length, 1);
  const tableTop = y + 28;
  const footerHeight = 16;
  const tableHeight = Math.max(38, height - 48 - footerHeight);
  const headerHeight = 10;
  const rowHeight = (tableHeight - headerHeight) / rowCount;
  const columns = [
    { label: 'SL.NO', width: width * 0.13 },
    { label: 'CHEST NO / REGISTER NO', width: width * 0.25 },
    { label: 'a', width: width * 0.075 },
    { label: 'b', width: width * 0.075 },
    { label: 'c', width: width * 0.075 },
    { label: 'd', width: width * 0.075 },
    { label: 'e', width: width * 0.075 },
    { label: 'f', width: width * 0.075 },
    { label: 'Total', width: width * 0.17 },
  ];

  doc.setTextColor(...blue);
  doc.setDrawColor(...blue);
  doc.setLineWidth(0.25);
  doc.setFont('helvetica', 'bolditalic');
  doc.setFontSize(9);
  doc.text('Score Sheet', x + width / 2, y + 8, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6);
  doc.text(doc.splitTextToSize(settings.schoolName || 'School Name', width - 4), x + width / 2, y + 13, { align: 'center' });
  doc.text(doc.splitTextToSize(settings.programmeName, width - 4), x + width / 2, y + 18, { align: 'center' });
  doc.setFontSize(8);
  doc.text(doc.splitTextToSize(item.name, width - 4), x + width / 2, y + 24, { align: 'center' });

  doc.setFont('helvetica', 'italic');
  doc.setFontSize(7);
  doc.text('Score out of: __________________', x, tableTop - 4);

  let cursorX = x;
  const scoreHeaderStart = x + columns[0].width + columns[1].width;
  const scoreHeaderWidth = columns.slice(2, 8).reduce((sum, col) => sum + col.width, 0);

  doc.rect(x, tableTop, width, tableHeight);
  doc.line(x, tableTop + headerHeight, x + width, tableTop + headerHeight);
  doc.text('Score', scoreHeaderStart + scoreHeaderWidth / 2, tableTop + 3.5, { align: 'center' });

  columns.forEach((column, index) => {
    if (index > 0) doc.line(cursorX, tableTop, cursorX, tableTop + tableHeight);
    const labelY = index >= 2 && index <= 7 ? tableTop + 8 : tableTop + 6;
    doc.setFontSize(index === 1 ? 5.5 : 6);
    doc.setFont('helvetica', index >= 2 && index <= 7 ? 'italic' : 'bolditalic');
    doc.text(column.label, cursorX + column.width / 2, labelY, { align: 'center' });
    cursorX += column.width;
  });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  participants.forEach((participant, index) => {
    const rowY = tableTop + headerHeight + rowHeight * index;
    doc.line(x, rowY, x + width, rowY);
    doc.text((index + 1).toString(), x + columns[0].width / 2, rowY + Math.min(7, rowHeight / 2 + 2), { align: 'center' });
    doc.text(doc.splitTextToSize(participant.chestNumber, columns[1].width - 2), x + columns[0].width + 1, rowY + 5);
  });

  doc.setFontSize(7);
  doc.setTextColor(...blue);
  doc.text('Name: __________________________', x + 1, y + height - 10);
  doc.text('Signature: ______________________', x + 1, y + height - 3);
  doc.setTextColor(0, 0, 0);
}

function drawConsolidatedScoreSheet(doc: jsPDF, item: Item, participants: ReturnType<typeof getItemParticipants>, settings: Settings): void {
  const pageWidth = doc.internal.pageSize.getWidth();
  const blue: [number, number, number] = [20, 28, 150];

  doc.setTextColor(...blue);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  doc.text(settings.programmeName, pageWidth / 2, 16, { align: 'center' });
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('Consolidated Score', pageWidth / 2, 25, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(item.name, pageWidth / 2, 33, { align: 'center' });
  doc.setTextColor(0, 0, 0);

  autoTable(doc, {
    head: [[
      'SL.NO',
      'ADMIN.NO / REGISTER NO',
      'CHEST.NO',
      'MAX MARK',
      'JUDGE 1',
      'JUDGE 2',
      'JUDGE 3',
      'JUDGE 4',
      'JUDGE 5',
      'TOTAL',
      'GRADE',
      'RANK',
    ]],
    body: participants.map((participant, index) => [
      (index + 1).toString(),
      participant.registerNumber,
      participant.chestNumber,
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
    ]),
    startY: 42,
    styles: { fontSize: 7, cellPadding: 1.4, lineColor: blue, lineWidth: 0.2, textColor: blue },
    headStyles: { fillColor: [255, 255, 255], textColor: blue, fontStyle: 'bolditalic', lineColor: blue, lineWidth: 0.2 },
    alternateRowStyles: { fillColor: [255, 255, 255] },
    margin: { left: 8, right: 8 },
  });
}

export function generateScoreSheetsPDF(options: ScoreSheetOptions): void {
  const settings = getSettings();
  const allItems = getItems();
  const selectedItemIds = options.itemIds === 'All' ? null : new Set(options.itemIds);
  const items = allItems.filter(item => {
    if (options.itemCategory !== 'All' && item.classification !== options.itemCategory) return false;
    if (selectedItemIds && !selectedItemIds.has(item.id)) return false;
    const participants = getItemParticipants(item.id).filter(participant => (
      options.ageCategory === 'All' || participant.ageCategory === options.ageCategory
    ));
    return participants.length > 0;
  });

  if (items.length === 0) {
    alert('No items with registered participants match the selected options.');
    return;
  }

  const scoreDoc = new jsPDF(options.sheetsPerPage === 3 ? 'landscape' : 'portrait', 'mm', 'a4');
  const pageWidth = scoreDoc.internal.pageSize.getWidth();
  const pageHeight = scoreDoc.internal.pageSize.getHeight();
  const margin = 7;
  const gap = 5;
  const cols = options.sheetsPerPage === 1 ? 1 : options.sheetsPerPage === 2 ? 2 : options.sheetsPerPage === 3 ? 3 : 2;
  const rows = options.sheetsPerPage === 4 ? 2 : 1;
  const sheetWidth = (pageWidth - margin * 2 - gap * (cols - 1)) / cols;
  const sheetHeight = (pageHeight - margin * 2 - gap * (rows - 1)) / rows;

  let sheetIndex = 0;
  items.forEach(item => {
    const participants = getItemParticipants(item.id).filter(participant => (
      options.ageCategory === 'All' || participant.ageCategory === options.ageCategory
    ));
    if (sheetIndex > 0 && sheetIndex % options.sheetsPerPage === 0) {
      scoreDoc.addPage();
    }
    const indexOnPage = sheetIndex % options.sheetsPerPage;
    const col = indexOnPage % cols;
    const row = Math.floor(indexOnPage / cols);
    const x = margin + col * (sheetWidth + gap);
    const y = margin + row * (sheetHeight + gap);
    drawScoreSheet(scoreDoc, item, participants, x, y, sheetWidth, sheetHeight, settings);
    sheetIndex++;
  });
  if (options.includeConsolidated) {
    items.forEach(item => {
      const participants = getItemParticipants(item.id).filter(participant => (
        options.ageCategory === 'All' || participant.ageCategory === options.ageCategory
      ));
      scoreDoc.addPage('a4', 'landscape');
      drawConsolidatedScoreSheet(scoreDoc, item, participants, settings);
    });
    addReportFooter(scoreDoc);
  }

  addReportFooter(scoreDoc);
  scoreDoc.save('score-sheets.pdf');
}

function getPositionSuffix(position: number): string {
  if (position === 1) return '1st';
  if (position === 2) return '2nd';
  if (position === 3) return '3rd';
  return `${position}th`;
}

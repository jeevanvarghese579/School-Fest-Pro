import { useState, useEffect } from 'react';
import {
  User,
  CreditCard,
  Layers,
  Calendar,
  Download,
  Building2,
  GraduationCap,
  MapPin,
  ClipboardList,
  FileText,
} from 'lucide-react';
import {
  generatePDF,
  generateHouseWiseReport,
  generateClassWiseReport,
  generateStudentWiseReport,
  generateParticipantCards,
  generateStageWiseList,
  generateGroupList,
  generateItemWiseReport,
  formatTime12Hour,
} from '../utils/export';
import { generateScheduleResult, type ScheduleDiagnostics } from '../utils/schedule';
import {
  getHouses,
  getStudents,
  getSettings,
  getItems,
  setSchedule,
  getSchedule,
  DEFAULT_SCORESHEETS_PDF_URL,
} from '../utils/storage';
import type { House, ScheduleItem, Student } from '../types';

function ReportsDashboard() {
  const [houses, setHouses] = useState<House[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [classes, setClasses] = useState<string[]>([]);
  const [settings, setSettings] = useState(getSettings());
  const [schedule, setScheduleState] = useState<ScheduleItem[]>([]);
  const [cardsPerPage, setCardsPerPage] = useState(8);
  const [itemWiseConsiderAgeCategories, setItemWiseConsiderAgeCategories] = useState(false);
  const [scheduleConsiderAgeCategories, setScheduleConsiderAgeCategories] = useState(false);
  const [scheduleConsiderOffStageItems, setScheduleConsiderOffStageItems] = useState(true);
  const [scheduleDiagnostics, setScheduleDiagnostics] = useState<ScheduleDiagnostics | null>(null);

  useEffect(() => {
    const loadedHouses = getHouses();
    const loadedStudents = getStudents();
    const loadedSettings = getSettings();
    const loadedSchedule = getSchedule();

    setHouses(loadedHouses);
    setStudents(loadedStudents);
    setSettings(loadedSettings);
    setScheduleState(loadedSchedule);

    const uniqueClasses = [...new Set(loadedStudents.map((s) => s.class))].sort();
    setClasses(uniqueClasses);
  }, []);

  const handleGenerateSchedule = () => {
    const result = generateScheduleResult(scheduleConsiderAgeCategories, scheduleConsiderOffStageItems);
    setSchedule(result.schedule);
    setScheduleState(result.schedule);
    setScheduleDiagnostics(result.diagnostics);
    alert(
      [
        `Total items found: ${result.diagnostics.totalItemsFound}`,
        `Items with participants: ${result.diagnostics.itemsWithParticipants}`,
        `Individual items count: ${result.diagnostics.individualItemsCount}`,
        `Group items count: ${result.diagnostics.groupItemsCount}`,
        `Stage items included: ${result.diagnostics.stageItemsIncluded}`,
        `Off Stage items included: ${result.diagnostics.offStageItemsIncluded}`,
        `Total items scheduled: ${result.diagnostics.totalItemsScheduled}`,
        `Schedule entries generated: ${result.diagnostics.totalScheduleEntriesGenerated}`,
      ].join('\n')
    );
  };

  const exportScheduleToPDF = () => {
    const items = getItems();
    const scheduleItems = getSchedule();

    const headers = [
      'Item Name',
      'Age Category',
      'Stage',
      'Day',
      'Start Time',
      'End Time',
      'Participants/Groups',
      'Time / Performance',
      'Buffer',
      'Total Duration',
      'Remarks',
    ];

    const data = scheduleItems.map((item) => {
      const itemInfo = items.find((i) => i.id === item.itemId);
      const stage = settings.stages.find((s) => s.id === item.stageId);
      const timePerPerformance = item.timePerPerformance || itemInfo?.timePerPerformance || itemInfo?.duration || 1;
      const bufferMinutes = item.bufferMinutes ?? settings.scheduleBufferMinutes ?? 0;
      const totalDuration = item.totalDuration || item.participantCount * timePerPerformance + bufferMinutes;
      return [
        itemInfo?.name || '',
        item.ageCategory || '',
        stage?.name || '',
        `Day ${item.day}`,
        formatTime12Hour(item.startTime),
        formatTime12Hour(item.endTime),
        item.participantCount.toString(),
        `${timePerPerformance} min`,
        `${bufferMinutes} min`,
        `${totalDuration} min`,
        item.remark || '',
      ];
    });

    const doc = generatePDF('Program Schedule', headers, data, settings);
    doc.save('program-schedule.pdf');
  };

  const handleDownloadScoresheetsPdf = () => {
    const url = settings.scoresheetsPdfUrl.trim() || DEFAULT_SCORESHEETS_PDF_URL;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const reportSections = [
    {
      title: 'House-wise Reports',
      description: 'Generate reports filtered by house',
      icon: Building2,
      color: 'from-blue-500 to-indigo-600',
      content: (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
          {houses.map((house) => (
            <button
              key={house.id}
              onClick={() => generateHouseWiseReport(house.id)}
              className="flex items-center gap-2 px-4 py-3 bg-white border border-gray-200 rounded-lg hover:bg-blue-50 hover:border-blue-300 transition-all text-sm"
            >
              <div
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: house.color }}
              />
              <span>{house.name}</span>
              <Download size={14} className="ml-auto text-gray-400" />
            </button>
          ))}
        </div>
      ),
    },
    {
      title: 'Class-wise Reports',
      description: 'Generate reports filtered by class',
      icon: GraduationCap,
      color: 'from-green-500 to-emerald-600',
      content: (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
          {classes.map((cls) => (
            <button
              key={cls}
              onClick={() => generateClassWiseReport(cls)}
              className="flex items-center gap-2 px-4 py-3 bg-white border border-gray-200 rounded-lg hover:bg-green-50 hover:border-green-300 transition-all text-sm"
            >
              <span>{cls}</span>
              <Download size={14} className="ml-auto text-gray-400" />
            </button>
          ))}
        </div>
      ),
    },
    {
      title: 'Student-wise Reports',
      description: 'Generate individual student reports',
      icon: User,
      color: 'from-purple-500 to-violet-600',
      content: (
        <div className="mt-4">
          <select
            className="w-full md:w-auto px-4 py-2 border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-purple-300"
            onChange={(e) => {
              if (e.target.value) {
                generateStudentWiseReport(e.target.value);
              }
            }}
            defaultValue=""
          >
            <option value="" disabled>
              Select a student...
            </option>
            {students.map((student) => (
              <option key={student.id} value={student.id}>
                {student.name} ({student.registerNumber}) - {student.class}
              </option>
            ))}
          </select>
        </div>
      ),
    },
    {
      title: 'Participant Cards',
      description: 'Generate printable participant cards for all students',
      icon: CreditCard,
      color: 'from-orange-500 to-amber-600',
      content: (
        <div className="mt-4 flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-600">Cards per page:</label>
            <select
              value={cardsPerPage}
              onChange={(e) => setCardsPerPage(Number(e.target.value))}
              className="px-3 py-2 border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-orange-300"
            >
              <option value={8}>8</option>
              <option value={16}>16</option>
            </select>
          </div>
          <button
            onClick={() => generateParticipantCards(cardsPerPage)}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-orange-500 to-amber-500 text-white rounded-lg hover:from-orange-600 hover:to-amber-600 transition-all shadow-md"
          >
            <Download size={16} />
            <span>Generate Cards</span>
          </button>
        </div>
      ),
    },
    {
      title: 'Stage-wise Lists',
      description: 'Generate participant lists by stage',
      icon: MapPin,
      color: 'from-cyan-500 to-teal-600',
      content: (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
          {settings.stages.map((stage) => (
            <button
              key={stage.id}
              onClick={() => generateStageWiseList(stage.id)}
              className="flex items-center gap-2 px-4 py-3 bg-white border border-gray-200 rounded-lg hover:bg-cyan-50 hover:border-cyan-300 transition-all text-sm"
            >
              <MapPin size={14} className="text-gray-400" />
              <span>{stage.name}</span>
              <Download size={14} className="ml-auto text-gray-400" />
            </button>
          ))}
        </div>
      ),
    },
    {
      title: 'Group List',
      description: 'Generate list of all group items and their members',
      icon: Layers,
      color: 'from-pink-500 to-rose-600',
      content: (
        <div className="mt-4">
          <button
            onClick={() => generateGroupList()}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-pink-500 to-rose-500 text-white rounded-lg hover:from-pink-600 hover:to-rose-600 transition-all shadow-md"
          >
            <Download size={16} />
            <span>Generate Group List</span>
          </button>
        </div>
      ),
    },
    {
      title: 'Item-wise Report',
      description: 'Generate all items with registered participants',
      icon: ClipboardList,
      color: 'from-sky-500 to-blue-600',
      content: (
        <div className="mt-4">
          <div className="flex flex-wrap items-center gap-4 mb-4">
            <span className="text-sm text-gray-600">Consider Age Categories</span>
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="radio"
                checked={itemWiseConsiderAgeCategories}
                onChange={() => setItemWiseConsiderAgeCategories(true)}
              />
              Yes
            </label>
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="radio"
                checked={!itemWiseConsiderAgeCategories}
                onChange={() => setItemWiseConsiderAgeCategories(false)}
              />
              No
            </label>
          </div>
          <button
            onClick={() => generateItemWiseReport(itemWiseConsiderAgeCategories)}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-sky-500 to-blue-500 text-white rounded-lg hover:from-sky-600 hover:to-blue-600 transition-all shadow-md"
          >
            <Download size={16} />
            <span>Generate Item-wise Report</span>
          </button>
        </div>
      ),
    },
    {
      title: 'Download Scoresheets PDF',
      description: 'Open the configured scoresheets PDF link in a new tab',
      icon: FileText,
      color: 'from-blue-600 to-cyan-600',
      content: (
        <div className="mt-4">
          <button
            onClick={handleDownloadScoresheetsPdf}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-cyan-600 text-white rounded-lg hover:from-blue-700 hover:to-cyan-700 transition-all shadow-md"
          >
            <Download size={16} />
            <span>Download Scoresheets PDF</span>
          </button>
        </div>
      ),
    },
    {
      title: 'Schedule Generation & Export',
      description: 'Auto-generate and export program schedule',
      icon: Calendar,
      color: 'from-indigo-500 to-purple-600',
      content: (
        <div className="mt-4 space-y-4">
          <div className="flex flex-wrap items-center gap-4">
            <span className="text-sm text-gray-600">Consider Age Categories</span>
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="radio"
                checked={scheduleConsiderAgeCategories}
                onChange={() => setScheduleConsiderAgeCategories(true)}
              />
              Yes
            </label>
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="radio"
                checked={!scheduleConsiderAgeCategories}
                onChange={() => setScheduleConsiderAgeCategories(false)}
              />
              No
            </label>
          </div>
          <div className="flex flex-wrap items-center gap-4">
            <span className="text-sm text-gray-600">Consider Off Stage Items for Schedule Generation</span>
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="radio"
                checked={scheduleConsiderOffStageItems}
                onChange={() => setScheduleConsiderOffStageItems(true)}
              />
              Yes
            </label>
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="radio"
                checked={!scheduleConsiderOffStageItems}
                onChange={() => setScheduleConsiderOffStageItems(false)}
              />
              No
            </label>
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              onClick={handleGenerateSchedule}
              className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-indigo-500 to-purple-500 text-white rounded-lg hover:from-indigo-600 hover:to-purple-600 transition-all shadow-md"
            >
              <Calendar size={16} />
              <span>Generate Schedule</span>
            </button>
            <button
              onClick={exportScheduleToPDF}
              disabled={schedule.length === 0}
              className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-gray-600 to-gray-700 text-white rounded-lg hover:from-gray-700 hover:to-gray-800 transition-all shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Download size={16} />
              <span>Export Schedule PDF</span>
            </button>
          </div>
          {schedule.length > 0 && (
            <div className="bg-gray-50 rounded-lg p-4">
              <h4 className="text-sm font-medium text-gray-700 mb-2">
                Schedule Summary
              </h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <span className="text-gray-500">Schedule Entries:</span>
                  <span className="ml-2 font-medium">{schedule.length}</span>
                </div>
                <div>
                  <span className="text-gray-500">Days:</span>
                  <span className="ml-2 font-medium">
                    {Math.max(...schedule.map((s) => s.day))}
                  </span>
                </div>
                <div>
                  <span className="text-gray-500">Stages:</span>
                  <span className="ml-2 font-medium">
                    {new Set(schedule.map((s) => s.stageId)).size}
                  </span>
                </div>
                <div>
                  <span className="text-gray-500">Day Time:</span>
                  <span className="ml-2 font-medium">
                    {formatTime12Hour(settings.dayStartTime)}-{formatTime12Hour(settings.dayEndTime)}
                  </span>
                </div>
                <div>
                  <span className="text-gray-500">Buffer:</span>
                  <span className="ml-2 font-medium">{settings.scheduleBufferMinutes} min</span>
                </div>
              </div>
              {scheduleDiagnostics && (
                <div className="mt-4 border border-gray-200 rounded-lg bg-white p-4">
                  <h5 className="text-sm font-semibold text-gray-800 mb-3">Schedule Preview</h5>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                    <div>
                      <span className="text-gray-500">Total Stage Items Included:</span>
                      <span className="ml-2 font-medium">{scheduleDiagnostics.stageItemsIncluded}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">Total Off Stage Items Included:</span>
                      <span className="ml-2 font-medium">{scheduleDiagnostics.offStageItemsIncluded}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">Total Items Scheduled:</span>
                      <span className="ml-2 font-medium">{scheduleDiagnostics.totalItemsScheduled}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">Total items considered:</span>
                      <span className="ml-2 font-medium">{scheduleDiagnostics.totalItemsConsidered}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">Entries generated:</span>
                      <span className="ml-2 font-medium">{scheduleDiagnostics.totalScheduleEntriesGenerated}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">Items with participants:</span>
                      <span className="ml-2 font-medium">{scheduleDiagnostics.itemsWithParticipants}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">Excluded:</span>
                      <span className="ml-2 font-medium">{scheduleDiagnostics.itemsExcluded.length}</span>
                    </div>
                  </div>
                  <div className="mt-3">
                    <h6 className="text-xs font-semibold uppercase text-gray-500 mb-2">Items Excluded</h6>
                    {scheduleDiagnostics.itemsExcluded.length === 0 ? (
                      <p className="text-sm text-gray-600">No eligible items were excluded.</p>
                    ) : (
                      <div className="max-h-40 overflow-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="text-left text-xs uppercase text-gray-500">
                              <th className="py-2 pr-4">Item</th>
                              <th className="py-2 pr-4">Reason</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100">
                            {scheduleDiagnostics.itemsExcluded.map((excluded) => (
                              <tr key={excluded.itemId}>
                                <td className="py-2 pr-4 text-gray-800">{excluded.itemName}</td>
                                <td className="py-2 pr-4 text-gray-600">{excluded.reason}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </div>
              )}
              <div className="mt-4 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs uppercase text-gray-500">
                      <th className="py-2 pr-4">Item Name</th>
                      <th className="py-2 pr-4">Age Category</th>
                      <th className="py-2 pr-4">Stage</th>
                      <th className="py-2 pr-4">Day</th>
                      <th className="py-2 pr-4">Start</th>
                      <th className="py-2 pr-4">End</th>
                      <th className="py-2 pr-4">Participants/Groups</th>
                      <th className="py-2 pr-4">Time / Performance</th>
                      <th className="py-2 pr-4">Buffer</th>
                      <th className="py-2 pr-4">Total</th>
                      <th className="py-2 pr-4">Remarks</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {schedule.map((scheduleItem, index) => {
                      const item = getItems().find((itemInfo) => itemInfo.id === scheduleItem.itemId);
                      const stage = settings.stages.find((stageInfo) => stageInfo.id === scheduleItem.stageId);
                      return (
                        <tr key={`${scheduleItem.itemId}-${scheduleItem.ageCategory || 'all'}-${index}`}>
                          <td className="py-2 pr-4 text-gray-800">{item?.name || ''}</td>
                          <td className="py-2 pr-4 text-gray-600">{scheduleItem.ageCategory || ''}</td>
                          <td className="py-2 pr-4 text-gray-600">{stage?.name || ''}</td>
                          <td className="py-2 pr-4 text-gray-600">Day {scheduleItem.day}</td>
                          <td className="py-2 pr-4 text-gray-600">
                            {formatTime12Hour(scheduleItem.startTime)}
                          </td>
                          <td className="py-2 pr-4 text-gray-600">{formatTime12Hour(scheduleItem.endTime)}</td>
                          <td className="py-2 pr-4 text-gray-600">{scheduleItem.participantCount}</td>
                          <td className="py-2 pr-4 text-gray-600">{scheduleItem.timePerPerformance} min</td>
                          <td className="py-2 pr-4 text-gray-600">{scheduleItem.bufferMinutes} min</td>
                          <td className="py-2 pr-4 text-gray-600">{scheduleItem.totalDuration} min</td>
                          <td className="py-2 pr-4 text-gray-600">{scheduleItem.remark || ''}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      ),
    },
  ];

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-800 mb-2">
          Reports Dashboard
        </h1>
        <p className="text-gray-600">
          Generate and export various reports for your school festival
        </p>
      </div>

      <div className="space-y-6">
        {reportSections.map((section) => {
          const Icon = section.icon;
          return (
            <div
              key={section.title}
              className="bg-white rounded-xl shadow-md overflow-hidden"
            >
              <div className="p-6">
                <div className="flex items-start gap-4">
                  <div
                    className={`w-12 h-12 bg-gradient-to-br ${section.color} rounded-xl flex items-center justify-center shadow-lg flex-shrink-0`}
                  >
                    <Icon size={24} className="text-white" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-gray-800 mb-1">
                      {section.title}
                    </h3>
                    <p className="text-sm text-gray-600">{section.description}</p>
                    {section.content}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {students.length === 0 && (
        <div className="mt-6 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <p className="text-sm text-yellow-800">
            <strong>Note:</strong> No students registered yet. Please add
            students through the Registration Portal to generate meaningful
            reports.
          </p>
        </div>
      )}
    </div>
  );
}

export default ReportsDashboard;

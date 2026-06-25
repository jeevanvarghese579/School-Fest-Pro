import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Trophy,
  Medal,
  Award,
  FileDown,
  FileText,
  Eye,
  Users,
  X,
  RefreshCw,
  Home,
  Search,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import {
  getResults,
  addOrUpdateResult,
  getItems,
  getStudents,
  getHouses,
  getGroupItems,
  getIndividualParticipations,
  getSettings,
} from '../utils/storage';
import { generatePDF, generateResultsCSV } from '../utils/export';
import type { Result, Item, Student, House, GroupItem, Settings, HousePoints } from '../types';

interface ItemResult {
  resultId: string;
  participantName: string;
  participantId: string;
  houseName: string;
  houseId: string;
  marks: number;
  points: number;
  position: number;
  isGroup: boolean;
  hasResult: boolean;
  groupId?: string;
}

interface ItemWithResults {
  item: Item;
  results: ItemResult[];
}

function ResultsConsole() {
  const [items, setItems] = useState<Item[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [houses, setHouses] = useState<House[]>([]);
  const [groupItems, setGroupItems] = useState<GroupItem[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [results, setResults] = useState<Result[]>([]);
  const [showResultsModal, setShowResultsModal] = useState(false);
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState('');

  const loadData = useCallback(() => {
    setItems(getItems());
    setStudents(getStudents());
    setHouses(getHouses());
    setGroupItems(getGroupItems());
    setSettings(getSettings());
    setResults(getResults());
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const calculatePositions = useCallback((marksList: { marks: number; index: number }[]): number[] => {
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
  }, []);

  const getResultPoints = useCallback((position: number, isGroup: boolean): number => {
    const pointsConfig = isGroup ? settings?.groupPoints : settings?.individualPoints;
    if (!pointsConfig) return 0;
    if (position === 1) return pointsConfig.first;
    if (position === 2) return pointsConfig.second;
    if (position === 3) return pointsConfig.third;
    return 0;
  }, [settings]);

  const itemsWithResults = useMemo((): ItemWithResults[] => {
    const individualParticipations = getIndividualParticipations();

    return items
      .map(item => {
        const participants: ItemResult[] = [];

        individualParticipations
          .filter(p => p.itemId === item.id)
          .forEach(p => {
            const student = students.find(s => s.id === p.studentId);
            if (!student) return;
            const result = results.find(r => r.itemId === item.id && !r.isGroup && r.studentId === student.id);
            const house = houses.find(h => h.id === student.houseId);
            participants.push({
              resultId: `${item.id}-${student.id}-false`,
              participantName: student.name,
              participantId: student.id,
              houseName: house?.name || '',
              houseId: student.houseId,
              marks: result?.marks || 0,
              points: 0,
              position: result?.position || 0,
              isGroup: false,
              hasResult: Boolean(result),
            });
          });

        groupItems
          .filter(group => group.itemId === item.id)
          .forEach(group => {
            const result = results.find(r => r.itemId === item.id && r.isGroup && r.groupId === group.id);
            const house = houses.find(h => h.id === group.houseId);
            participants.push({
              resultId: `${item.id}-${group.id}-true`,
              participantName: group.name,
              participantId: group.id,
              houseName: house?.name || '',
              houseId: group.houseId,
              marks: result?.marks || 0,
              points: 0,
              position: result?.position || 0,
              isGroup: true,
              hasResult: Boolean(result),
              groupId: group.id,
            });
          });

        if (participants.length > 0) {
          const marksList = participants.map((r, idx) => ({ marks: r.marks, index: idx }));
          const positions = calculatePositions(marksList);
          participants.forEach((r, idx) => {
            r.position = positions[idx];
            r.points = r.hasResult ? getResultPoints(r.position, r.isGroup) : 0;
          });
        }

        return { item, results: participants };
      })
      .filter(({ item, results }) => {
        if (results.length === 0) return false;
        const term = searchTerm.trim().toLowerCase();
        if (!term) return true;
        return (
          item.name.toLowerCase().includes(term) ||
          results.some(
            result =>
              result.participantName.toLowerCase().includes(term) ||
              result.houseName.toLowerCase().includes(term)
          )
        );
      });
  }, [items, results, students, houses, groupItems, calculatePositions, getResultPoints, searchTerm]);

  const housePoints = useMemo((): HousePoints[] => {
    const pointsMap = new Map<string, number>();

    houses.forEach(h => {
      pointsMap.set(h.id, 0);
    });

    itemsWithResults.forEach(({ results: itemResults }) => {
      itemResults.forEach(result => {
        if (!result.hasResult) return;
        const houseId = result.houseId;

        if (houseId && pointsMap.has(houseId)) {
          pointsMap.set(houseId, (pointsMap.get(houseId) || 0) + result.points);
        }
      });
    });

    return Array.from(pointsMap.entries())
      .map(([houseId, points]) => ({ houseId, points }))
      .sort((a, b) => b.points - a.points);
  }, [itemsWithResults, houses]);

  const handleMarksChange = (itemId: string, participantId: string, marks: number, isGroup: boolean, groupId?: string) => {
    const studentId = isGroup ? '' : participantId;
    addOrUpdateResult({
      itemId,
      studentId,
      marks,
      position: 0,
      isGroup,
      groupId: isGroup ? groupId || participantId : undefined,
    });
    loadData();
  };

  const toggleItemExpanded = (itemId: string) => {
    setExpandedItems(prev => {
      const next = new Set(prev);
      if (next.has(itemId)) {
        next.delete(itemId);
      } else {
        next.add(itemId);
      }
      return next;
    });
  };

  const getPositionColor = (position: number): string => {
    switch (position) {
      case 1:
        return 'text-yellow-500';
      case 2:
        return 'text-gray-400';
      case 3:
        return 'text-amber-600';
      default:
        return 'text-gray-600';
    }
  };

  const getPositionIcon = (position: number) => {
    switch (position) {
      case 1:
        return <Trophy className="w-5 h-5 text-yellow-500" />;
      case 2:
        return <Medal className="w-5 h-5 text-gray-400" />;
      case 3:
        return <Award className="w-5 h-5 text-amber-600" />;
      default:
        return <span className="text-gray-500 font-medium">{position}</span>;
    }
  };

  const exportResultsPDF = () => {
    if (!settings) return;

    const data: string[][] = [];

    itemsWithResults.forEach(({ item, results }) => {
      const enteredResults = results.filter(result => result.hasResult);
      if (enteredResults.length > 0) {
        data.push([item.name, '', '', '', '']);
        const sorted = [...enteredResults].sort((a, b) => a.position - b.position).filter(result => result.position <= 3);
        sorted.forEach(result => {
          data.push([
            getPositionSuffix(result.position),
            result.participantName,
            result.houseName,
            result.marks.toString(),
            result.points.toString()
          ]);
        });
        data.push(['', '', '', '', '']);
      }
    });

    const doc = generatePDF(
      'Results Report',
      ['Position', 'Name', 'House', 'Marks', 'Points'],
      data,
      settings
    );

    doc.save('results-report.pdf');
  };

  const getPositionSuffix = (position: number): string => {
    if (position === 1) return '1st';
    if (position === 2) return '2nd';
    if (position === 3) return '3rd';
    return `${position}th`;
  };

  const exportResultsCSV = () => {
    generateResultsCSV();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-800 mb-2">Results Console</h1>
          <p className="text-gray-600">Enter marks and manage competition results</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={loadData}
            className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
          >
            <RefreshCw size={18} />
            Refresh
          </button>
          <button
            onClick={exportResultsPDF}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <FileDown size={18} />
            Export PDF
          </button>
          <button
            onClick={exportResultsCSV}
            className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
          >
            <FileText size={18} />
            Export CSV
          </button>
          <button
            onClick={() => setShowResultsModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
          >
            <Eye size={18} />
            View Results
          </button>
        </div>
      </div>

      {/* House Points Display */}
      <div className="bg-white rounded-xl shadow-md p-6">
        <div className="flex items-center gap-2 mb-4">
          <Home className="w-5 h-5 text-indigo-600" />
          <h2 className="text-xl font-semibold text-gray-800">House Points</h2>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {housePoints.map((hp, index) => {
            const house = houses.find(h => h.id === hp.houseId);
            return (
              <div
                key={hp.houseId}
                className={`p-4 rounded-lg border-2 ${
                  index === 0
                    ? 'border-yellow-400 bg-yellow-50'
                    : 'border-gray-200 bg-gray-50'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="font-semibold text-gray-800">{house?.name || 'Unknown'}</span>
                  {index === 0 && <Trophy className="w-5 h-5 text-yellow-500" />}
                </div>
                <div className="text-2xl font-bold text-gray-900">{hp.points}</div>
                <div className="text-sm text-gray-500">points</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Items with Results Entry */}
      <div className="bg-white rounded-xl shadow-md overflow-hidden">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-800">Items & Marks Entry</h2>
          <p className="text-sm text-gray-600 mt-1">Click on an item to expand and enter marks for each participant</p>
          <div className="relative mt-4 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search item, participant, or house..."
              className="w-full rounded-lg border border-gray-300 py-2 pl-10 pr-3 focus:border-transparent focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
        <div className="divide-y divide-gray-200">
          {itemsWithResults.length === 0 ? (
            <div className="px-6 py-10 text-center text-gray-500">
              No registered participants found for marks entry
            </div>
          ) : itemsWithResults.map(({ item, results }) => {
            const isExpanded = expandedItems.has(item.id);
            const participantCount = results.length;

            return (
              <div key={item.id} className="border-b border-gray-100 last:border-b-0">
                <button
                  onClick={() => toggleItemExpanded(item.id)}
                  className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div className={`w-3 h-3 rounded-full ${item.classification === 'Stage' ? 'bg-blue-500' : 'bg-orange-500'}`} />
                    <div className="text-left">
                      <div className="font-medium text-gray-800">{item.name}</div>
                      <div className="text-sm text-gray-500">
                        {item.classification} | {participantCount} participant{participantCount !== 1 ? 's' : ''}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {results.some(result => result.hasResult) && (
                      <div className="flex gap-1">
                        {results
                          .filter(result => result.hasResult)
                          .sort((a, b) => a.position - b.position)
                          .slice(0, 3)
                          .map((r, idx) => (
                            <span
                              key={idx}
                              className={`text-xs px-2 py-1 rounded ${
                                r.position === 1
                                  ? 'bg-yellow-100 text-yellow-700'
                                  : r.position === 2
                                    ? 'bg-gray-200 text-gray-600'
                                    : 'bg-amber-100 text-amber-700'
                              }`}
                            >
                              {r.position}
                            </span>
                          ))}
                      </div>
                    )}
                    {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                  </div>
                </button>

                {isExpanded && (
                  <div className="px-6 pb-4 bg-gray-50">
                    <table className="w-full">
                      <thead>
                        <tr className="text-left text-sm text-gray-600">
                          <th className="py-2 px-2">Position</th>
                          <th className="py-2 px-2">Participant</th>
                          <th className="py-2 px-2">House</th>
                          <th className="py-2 px-2">Marks</th>
                          <th className="py-2 px-2 w-32">Enter Marks</th>
                        </tr>
                      </thead>
                      <tbody>
                        {results.length === 0 ? (
                          <tr>
                            <td colSpan={5} className="py-4 text-center text-gray-500">
                              No participants registered for this item
                            </td>
                          </tr>
                        ) : (
                          results
                            .sort((a, b) => a.position - b.position)
                            .map((result) => (
                              <tr key={result.resultId} className="border-t border-gray-200">
                                <td className="py-3 px-2">
                                  <div className="flex items-center gap-2">
                                    {getPositionIcon(result.position)}
                                  </div>
                                </td>
                                <td className="py-3 px-2">
                                  <div className="flex items-center gap-2">
                                    {result.isGroup && <Users size={16} className="text-purple-500" />}
                                    <span className="font-medium text-gray-800">{result.participantName}</span>
                                  </div>
                                </td>
                                <td className="py-3 px-2 text-gray-600">{result.houseName}</td>
                                <td className="py-3 px-2 font-mono text-gray-800">{result.marks}</td>
                                <td className="py-3 px-2">
                                  <input
                                    type="number"
                                    min="0"
                                    max="100"
                                    value={result.marks || ''}
                                    onChange={(e) =>
                                      handleMarksChange(
                                        item.id,
                                        result.participantId,
                                        parseInt(e.target.value) || 0,
                                        result.isGroup,
                                        result.groupId
                                      )
                                    }
                                    className="w-24 px-3 py-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                    placeholder="Marks"
                                  />
                                </td>
                              </tr>
                            ))
                        )}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Results Modal */}
      {showResultsModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h2 className="text-2xl font-bold text-gray-800">Final Results</h2>
              <button
                onClick={() => setShowResultsModal(false)}
                className="p-2 hover:bg-gray-100 rounded-full transition-colors"
              >
                <X size={24} />
              </button>
            </div>
            <div className="p-6 overflow-y-auto max-h-[calc(90vh-100px)]">
              {itemsWithResults.map(({ item, results }) => {
                const enteredResults = results.filter(result => result.hasResult);
                if (enteredResults.length === 0) return null;
                const sorted = [...enteredResults].sort((a, b) => a.position - b.position);

                return (
                  <div key={item.id} className="mb-6 last:mb-0">
                    <h3 className="text-lg font-semibold text-gray-800 mb-3 flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${item.classification === 'Stage' ? 'bg-blue-500' : 'bg-orange-500'}`} />
                      {item.name}
                    </h3>
                    <div className="bg-gray-50 rounded-lg overflow-hidden">
                      <table className="w-full">
                        <thead>
                          <tr className="bg-gray-100 text-sm text-gray-600">
                            <th className="py-2 px-4 text-left">Position</th>
                            <th className="py-2 px-4 text-left">Participant</th>
                            <th className="py-2 px-4 text-left">House</th>
                            <th className="py-2 px-4 text-right">Marks</th>
                            <th className="py-2 px-4 text-right">Points</th>
                          </tr>
                        </thead>
                        <tbody>
                          {sorted.map((result, idx) => (
                            <tr
                              key={result.resultId}
                              className={`border-t border-gray-200 ${
                                idx < 3 ? 'bg-white' : 'bg-gray-50'
                              }`}
                            >
                              <td className="py-3 px-4">
                                <div className="flex items-center gap-2">
                                  <span className={`font-bold ${getPositionColor(result.position)}`}>
                                    {getPositionSuffix(result.position)}
                                  </span>
                                  {result.position <= 3 && getPositionIcon(result.position)}
                                </div>
                              </td>
                              <td className="py-3 px-4 font-medium text-gray-800">
                                {result.participantName}
                              </td>
                              <td className="py-3 px-4 text-gray-600">{result.houseName}</td>
                              <td className="py-3 px-4 text-right font-mono text-gray-800">
                                {result.marks}
                              </td>
                              <td className="py-3 px-4 text-right font-mono font-semibold text-gray-900">
                                {result.points}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                );
              })}

              {/* House Standings in Modal */}
              <div className="mt-8 pt-6 border-t border-gray-200">
                <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                  <Trophy className="w-5 h-5 text-yellow-500" />
                  House Standings
                </h3>
                <div className="space-y-3">
                  {housePoints.map((hp, index) => {
                    const house = houses.find(h => h.id === hp.houseId);
                    const maxPoints = Math.max(...housePoints.map(h => h.points), 1);
                    const percentage = (hp.points / maxPoints) * 100;

                    return (
                      <div key={hp.houseId} className="flex items-center gap-4">
                        <span className="w-6 text-center font-bold text-gray-600">{index + 1}</span>
                        <span className="w-32 font-medium text-gray-800">{house?.name}</span>
                        <div className="flex-1 h-6 bg-gray-200 rounded-full overflow-hidden">
                          <div
                            className={`h-full ${
                              index === 0
                                ? 'bg-gradient-to-r from-yellow-400 to-yellow-500'
                                : index === 1
                                  ? 'bg-gradient-to-r from-gray-400 to-gray-500'
                                  : index === 2
                                    ? 'bg-gradient-to-r from-amber-500 to-amber-600'
                                    : 'bg-gradient-to-r from-gray-300 to-gray-400'
                            }`}
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                        <span className="w-16 text-right font-bold text-gray-800">{hp.points} pts</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ResultsConsole;
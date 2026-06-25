import { useState, useEffect } from 'react';
import {
  Download,
  Upload,
  Search,
  CheckSquare,
  Square,
  Filter,
  Users,
} from 'lucide-react';
import type { Student, Item, IndividualParticipation as IParticipation, House, AgeCategory } from '../../types';
import {
  getStudents,
  getItems,
  getIndividualParticipations,
  setIndividualParticipations,
  addIndividualParticipation,
  removeIndividualParticipation,
  getHouses,
  getSettings,
} from '../../utils/storage';
import { exportToCSV, parseCSV, type CSVRow } from '../../utils/export';

const AGE_CATEGORIES: AgeCategory[] = [
  'LP Mini',
  'LP Kiddies',
  'Kiddies',
  'Sub Junior',
  'Junior',
  'Senior',
  'Super Senior',
];

function IndividualParticipation() {
  const [students, setStudents] = useState<Student[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [participations, setParticipations] = useState<IParticipation[]>([]);
  const [houses, setHouses] = useState<House[]>([]);
  const [maxItems, setMaxItems] = useState(5);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterHouse, setFilterHouse] = useState<string>('all');
  const [filterAgeCategory, setFilterAgeCategory] = useState<string>('all');
  const [filterItemClass, setFilterItemClass] = useState<string>('all');

  useEffect(() => {
    setStudents(getStudents());
    setItems(getItems());
    setParticipations(getIndividualParticipations());
    setHouses(getHouses());
    const settings = getSettings();
    setMaxItems(settings.maxIndividualItems);
  }, []);

  const filteredStudents = students.filter((student) => {
    const matchesSearch =
      student.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      student.registerNumber.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesHouse = filterHouse === 'all' || student.houseId === filterHouse;
    const matchesAge = filterAgeCategory === 'all' || student.ageCategory === filterAgeCategory;
    return matchesSearch && matchesHouse && matchesAge;
  });

  const filteredItems = items.filter((item) => {
    return filterItemClass === 'all' || item.classification === filterItemClass;
  });

  const isParticipating = (studentId: string, itemId: string): boolean => {
    return participations.some((p) => p.studentId === studentId && p.itemId === itemId);
  };

  const getStudentItemCount = (studentId: string): number => {
    return participations.filter((p) => p.studentId === studentId).length;
  };

  const handleToggle = (studentId: string, itemId: string) => {
    if (isParticipating(studentId, itemId)) {
      removeIndividualParticipation(studentId, itemId);
    } else {
      const currentCount = getStudentItemCount(studentId);
      if (currentCount >= maxItems) {
        alert(`Student can only participate in maximum ${maxItems} items`);
        return;
      }
      addIndividualParticipation({ studentId, itemId });
    }
    setParticipations(getIndividualParticipations());
  };

  const handleExport = () => {
    const exportData = students.map((student) => {
      const studentParticipations = participations.filter((p) => p.studentId === student.id);
      const itemNames = studentParticipations
        .map((p) => {
          const item = items.find((i) => i.id === p.itemId);
          return item?.name || '';
        })
        .join('; ');
      const house = houses.find((h) => h.id === student.houseId);

      return {
        registerNumber: student.registerNumber,
        name: student.name,
        class: student.class,
        ageCategory: student.ageCategory,
        house: house?.name || '',
        items: itemNames,
        itemCount: studentParticipations.length,
      };
    });
    exportToCSV(exportData, 'individual-participations');
  };

  const handleImport = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.csv';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (event) => {
        const text = event.target?.result as string;
        const data = parseCSV(text);
        const imported: IParticipation[] = [];

        data.forEach((row: CSVRow) => {
          const student = students.find(
            (s) =>
              s.registerNumber === row.registerNumber ||
              s.name.toLowerCase() === (row.name || '').toLowerCase()
          );
          if (!student) return;

          (row.items || '')
            .split(';')
            .map((name: string) => name.trim())
            .filter(Boolean)
            .forEach((itemName: string) => {
              const item = items.find((i) => i.name.toLowerCase() === itemName.toLowerCase());
              if (item) {
                imported.push({ studentId: student.id, itemId: item.id });
              }
            });
        });

        if (window.confirm(`Import ${imported.length} individual participation entries?`)) {
          const existing = getIndividualParticipations();
          const merged = [...existing];
          imported.forEach((entry) => {
            if (!merged.some((p) => p.studentId === entry.studentId && p.itemId === entry.itemId)) {
              merged.push(entry);
            }
          });
          setIndividualParticipations(merged);
          setParticipations(getIndividualParticipations());
        }
      };
      reader.readAsText(file);
    };
    input.click();
  };

  const getHouseColor = (houseId: string): string => {
    const house = houses.find((h) => h.id === houseId);
    return house?.color || '#6B7280';
  };

  return (
    <div>
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Individual Participation Entry</h2>
          <p className="text-gray-600">
            Register students for individual events (Max {maxItems} items per student)
          </p>
        </div>
        <div className="flex gap-2 mt-4 md:mt-0">
          <button
            onClick={handleExport}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
          >
            <Download size={18} />
            Export CSV
          </button>
          <button
            onClick={handleImport}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Upload size={18} />
            Import CSV
          </button>
        </div>
      </div>

      {students.length === 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
          <p className="text-yellow-800">
            No students found. Please add students in Student Details first.
          </p>
        </div>
      )}

      {items.length === 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
          <p className="text-yellow-800">
            No items found. Please add items in Items Management first.
          </p>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-md p-6 mb-6">
        <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
          <div className="relative flex-1 w-full">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
            <input
              type="text"
              placeholder="Search students..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div className="flex flex-wrap gap-2 items-center">
            <Filter size={20} className="text-gray-400" />
            <select
              value={filterHouse}
              onChange={(e) => setFilterHouse(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
            >
              <option value="all">All Houses</option>
              {houses.map((house) => (
                <option key={house.id} value={house.id}>
                  {house.name}
                </option>
              ))}
            </select>
            <select
              value={filterAgeCategory}
              onChange={(e) => setFilterAgeCategory(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
            >
              <option value="all">All Categories</option>
              {AGE_CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
            <select
              value={filterItemClass}
              onChange={(e) => setFilterItemClass(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
            >
              <option value="all">All Item Types</option>
              <option value="Stage">Stage Items</option>
              <option value="Off Stage">Off Stage Items</option>
            </select>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-md overflow-hidden">
        <div className="max-h-[70vh] overflow-auto">
          <table className="w-full">
            <thead className="bg-gray-50 sticky top-0 z-20">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider sticky left-0 top-0 bg-gray-50 z-30">
                  Student
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider sticky top-0 bg-gray-50 z-20">
                  House
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider sticky top-0 bg-gray-50 z-20">
                  Count
                </th>
                {filteredItems.map((item) => (
                  <th
                    key={item.id}
                    className="px-2 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[64px] sticky top-0 bg-gray-50 z-20"
                  >
                    <div className="flex h-36 flex-col items-center justify-end gap-1">
                      <span
                        className="vertical-item-label"
                        title={item.name}
                      >
                        {item.name}
                      </span>
                      <span
                        className={`text-[10px] ${
                          item.classification === 'Stage'
                            ? 'text-purple-500'
                            : 'text-orange-500'
                        }`}
                      >
                        {item.classification}
                      </span>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredStudents.length === 0 ? (
                <tr>
                  <td
                    colSpan={filteredItems.length + 3}
                    className="px-6 py-12 text-center text-gray-500"
                  >
                    <Users size={40} className="mx-auto mb-2 text-gray-300" />
                    <p>No students found</p>
                  </td>
                </tr>
              ) : (
                filteredStudents.map((student) => {
                  const itemCount = getStudentItemCount(student.id);
                  const isOverLimit = itemCount > maxItems;

                  return (
                    <tr key={student.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 whitespace-nowrap text-sm sticky left-0 bg-white z-10">
                        <div className="font-medium text-gray-900">{student.name}</div>
                        <div className="text-xs text-gray-500">
                          {student.registerNumber} | {student.class}
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm">
                        <span
                          className="px-2 py-1 rounded-full text-xs font-medium"
                          style={{
                            backgroundColor: getHouseColor(student.houseId) + '20',
                            color: getHouseColor(student.houseId),
                          }}
                        >
                          {houses.find((h) => h.id === student.houseId)?.name || '-'}
                        </span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm">
                        <span
                          className={`font-medium ${
                            isOverLimit
                              ? 'text-red-600'
                              : itemCount >= maxItems
                              ? 'text-yellow-600'
                              : 'text-green-600'
                          }`}
                        >
                          {itemCount}/{maxItems}
                        </span>
                      </td>
                      {filteredItems.map((item) => {
                        const participating = isParticipating(student.id, item.id);
                        return (
                          <td
                            key={item.id}
                            className="px-3 py-3 text-center"
                          >
                            <button
                              onClick={() => handleToggle(student.id, item.id)}
                              className={`p-1 rounded transition-colors ${
                                participating
                                  ? 'text-green-600 hover:bg-green-100'
                                  : 'text-gray-300 hover:bg-gray-100'
                              }`}
                            >
                              {participating ? (
                                <CheckSquare size={20} />
                              ) : (
                                <Square size={20} />
                              )}
                            </button>
                          </td>
                        );
                      })}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="mt-4 text-sm text-gray-500">
        Showing {filteredStudents.length} students and {filteredItems.length} items
      </div>
    </div>
  );
}

export default IndividualParticipation;

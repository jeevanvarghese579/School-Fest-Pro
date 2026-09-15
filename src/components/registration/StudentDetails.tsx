import { useState, useEffect, useRef } from 'react';
import {
  Plus,
  Edit2,
  Trash2,
  Download,
  Upload,
  Search,
  Users,
  Save,
  X,
} from 'lucide-react';
import type { Student, House, AgeCategory, StudentSex } from '../../types';
import ConfirmDialog from '../ConfirmDialog';
import {
  getStudents,
  setStudents,
  addStudent,
  updateStudent,
  deleteStudent,
  getHouses,
  setHouses as saveHouses,
  generateId,
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

const SEX_OPTIONS: StudentSex[] = ['Male', 'Female', 'Other'];
const IMPORT_COLUMN_ALIASES = {
  registerNumber: ['registerNumber', 'register no', 'register number', 'reg no', 'reg number', 'admission no'],
  name: ['name', 'student name'],
  class: ['class', 'standard', 'grade'],
  ageCategory: ['ageCategory', 'age category', 'category'],
  sex: ['sex', 'gender'],
  houseName: ['houseName', 'house name', 'house', 'team', 'group'],
} as const;

const normalizeImportColumn = (value: string): string =>
  value.trim().toLowerCase().replace(/[\s_-]+/g, '');

const getImportValue = (
  row: CSVRow,
  aliases: readonly string[]
): string => {
  const normalizedAliases = aliases.map(normalizeImportColumn);
  const entry = Object.entries(row).find(([key]) =>
    normalizedAliases.includes(normalizeImportColumn(key))
  );
  return String(entry?.[1] || '').trim();
};

type Props = {
  openAddForm?: boolean;
  onAddFormOpened?: () => void;
};

function StudentDetails({ openAddForm = false, onAddFormOpened }: Props) {
  const [students, setStudentsState] = useState<Student[]>([]);
  const [houses, setHouses] = useState<House[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<Partial<Student>>({});
  const [newHouseName, setNewHouseName] = useState('');
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const formRef = useRef<HTMLDivElement>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setStudentsState(getStudents());
    setHouses(getHouses());
  }, []);

  useEffect(() => {
    if (!openAddForm) return;
    const loadedHouses = getHouses();
    setIsEditing(true);
    setEditingId(null);
    setFormData({
      name: '',
      rollNumber: '',
      class: '',
      ageCategory: 'Junior',
      sex: 'Male',
      registerNumber: '',
      houseId: loadedHouses[0]?.id || '',
    });
    setNewHouseName('');
    onAddFormOpened?.();
    setTimeout(() => {
      formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      nameInputRef.current?.focus();
    }, 0);
  }, [openAddForm, onAddFormOpened]);

  const filteredStudents = students.filter(
    (student) =>
      student.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      student.registerNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      student.class.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleAddNew = () => {
    setIsEditing(true);
    setEditingId(null);
    setFormData({
      name: '',
      rollNumber: '',
      class: '',
      ageCategory: 'Junior',
      sex: 'Male',
      registerNumber: '',
      houseId: houses[0]?.id || '',
    });
    setNewHouseName('');
    setTimeout(() => nameInputRef.current?.focus(), 0);
  };

  const handleEdit = (student: Student) => {
    setIsEditing(true);
    setEditingId(student.id);
    setFormData({ ...student, sex: student.sex || 'Male' });
    setTimeout(() => {
      formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      nameInputRef.current?.focus();
    }, 0);
  };

  const handleSave = () => {
    if (!formData.name || !formData.registerNumber || !formData.class) {
      alert('Please fill in all required fields');
      return;
    }

    let houseId = formData.houseId || '';
    if (houseId === '__new__') {
      if (!newHouseName.trim()) {
        alert('Please enter a house name');
        return;
      }
      const existingHouse = houses.find(
        (house) => house.name.toLowerCase() === newHouseName.trim().toLowerCase()
      );
      if (existingHouse) {
        houseId = existingHouse.id;
      } else {
        const newHouse: House = {
          id: generateId(),
          name: newHouseName.trim(),
          color: '#EF4444',
        };
        saveHouses([...getHouses(), newHouse]);
        houseId = newHouse.id;
      }
    }

    if (editingId) {
      updateStudent(editingId, { ...formData, houseId });
    } else {
      const newStudent: Student = {
        id: generateId(),
        name: formData.name || '',
        rollNumber: formData.rollNumber || '',
        class: formData.class || '',
        ageCategory: formData.ageCategory as AgeCategory || 'Junior',
        sex: formData.sex as StudentSex || 'Male',
        registerNumber: formData.registerNumber || '',
        houseId,
      };
      addStudent(newStudent);
    }

    setStudentsState(getStudents());
    setHouses(getHouses());
    setIsEditing(false);
    setEditingId(null);
    setFormData({});
    setNewHouseName('');
  };

  const handleDelete = (id: string) => {
    setDeleteId(id);
  };

  const confirmDelete = () => {
    if (!deleteId) return;
    deleteStudent(deleteId);
    setStudentsState(getStudents());
    setDeleteId(null);
  };

  const handleExport = () => {
    const exportData = students.map((s) => ({
      registerNumber: s.registerNumber,
      name: s.name,
      rollNumber: s.rollNumber,
      class: s.class,
      ageCategory: s.ageCategory,
      sex: s.sex || '',
      houseName: houses.find((h) => h.id === s.houseId)?.name || '',
    }));
    exportToCSV(exportData, 'students');
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
        const firstRow = data[0] as Record<string, string> | undefined;
        const importColumns = firstRow ? Object.keys(firstRow).map(normalizeImportColumn) : [];
        const missingColumns = Object.entries(IMPORT_COLUMN_ALIASES)
          .filter(([, aliases]) => !aliases.some((alias) => importColumns.includes(normalizeImportColumn(alias))))
          .map(([column]) => column);
        if (missingColumns.length > 0) {
          alert(`Import failed. Missing required columns: ${missingColumns.join(', ')}`);
          return;
        }

        const currentHouses = getHouses();
        const importedHouses = [...currentHouses];
        const ensureHouse = (houseName: string) => {
          const trimmedName = houseName.trim();
          if (!trimmedName) {
            return '';
          }
          const existing = importedHouses.find(
            (house) => house.name.toLowerCase() === trimmedName.toLowerCase()
          );
          if (existing) return existing.id;
          const newHouse: House = {
            id: generateId(),
            name: trimmedName,
            color: '#EF4444',
          };
          importedHouses.push(newHouse);
          return newHouse.id;
        };

        const errors: string[] = [];
        const existingRegisterNumbers = new Set(getStudents().map((student) => student.registerNumber.trim().toLowerCase()));
        const importedRegisterNumbers = new Set<string>();

        const newStudents: Student[] = data.map((row: CSVRow, index) => {
          const rowNumber = index + 2;
          const registerNumber = getImportValue(row, IMPORT_COLUMN_ALIASES.registerNumber);
          const name = getImportValue(row, IMPORT_COLUMN_ALIASES.name);
          const className = getImportValue(row, IMPORT_COLUMN_ALIASES.class);
          const ageCategory = getImportValue(row, IMPORT_COLUMN_ALIASES.ageCategory) as AgeCategory;
          const sex = getImportValue(row, IMPORT_COLUMN_ALIASES.sex) as StudentSex;
          const houseName = getImportValue(row, IMPORT_COLUMN_ALIASES.houseName);
          const registerKey = registerNumber.toLowerCase();

          if (!registerNumber || !name || !className || !ageCategory || !sex || !houseName) {
            errors.push(`Row ${rowNumber}: registerNumber, name, class, ageCategory, sex, and house/houseName are required.`);
          }
          if (registerKey && existingRegisterNumbers.has(registerKey)) {
            errors.push(`Row ${rowNumber}: duplicate register number already exists (${registerNumber}).`);
          }
          if (registerKey && importedRegisterNumbers.has(registerKey)) {
            errors.push(`Row ${rowNumber}: duplicate register number in import (${registerNumber}).`);
          }
          if (registerKey) importedRegisterNumbers.add(registerKey);
          if (ageCategory && !AGE_CATEGORIES.includes(ageCategory)) {
            errors.push(`Row ${rowNumber}: invalid age category (${ageCategory}).`);
          }
          if (sex && !SEX_OPTIONS.includes(sex)) {
            errors.push(`Row ${rowNumber}: invalid sex (${sex}).`);
          }

          return {
            id: generateId(),
            registerNumber,
            name,
            rollNumber: getImportValue(row, ['rollNumber', 'roll no', 'roll number']),
            class: className,
            ageCategory: AGE_CATEGORIES.includes(ageCategory) ? ageCategory : 'Junior',
            sex: SEX_OPTIONS.includes(sex) ? sex : 'Male',
            houseId: ensureHouse(houseName),
          };
        });

        if (errors.length > 0) {
          alert(`Import failed:\n${errors.slice(0, 20).join('\n')}${errors.length > 20 ? `\n...and ${errors.length - 20} more error(s).` : ''}`);
          return;
        }

        if (window.confirm(`Import ${newStudents.length} students? This will add to existing records.`)) {
          const existing = getStudents();
          saveHouses(importedHouses);
          setStudents([...existing, ...newStudents]);
          setStudentsState(getStudents());
          setHouses(getHouses());
        }
      };
      reader.readAsText(file);
    };
    input.click();
  };

  const handleCancel = () => {
    setIsEditing(false);
    setEditingId(null);
    setFormData({});
  };

  return (
    <div>
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Student Details</h2>
          <p className="text-gray-600">Manage student registrations and house assignments</p>
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

      {houses.length === 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
          <p className="text-yellow-800">
            No houses found. Please add houses in General Settings first.
          </p>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-md p-6 mb-6">
        <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
          <div className="relative flex-1 w-full">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
            <input
              type="text"
              placeholder="Search by name, register number, or class..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <button
            onClick={handleAddNew}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus size={18} />
            Add Student
          </button>
        </div>
      </div>

      {isEditing && (
        <div ref={formRef} className="bg-white rounded-xl shadow-md p-6 mb-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">
            {editingId ? 'Edit Student' : 'Add New Student'}
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
              <input
                ref={nameInputRef}
                type="text"
                value={formData.name || ''}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Register Number *</label>
              <input
                type="text"
                value={formData.registerNumber || ''}
                onChange={(e) => setFormData({ ...formData, registerNumber: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Roll Number</label>
              <input
                type="text"
                value={formData.rollNumber || ''}
                onChange={(e) => setFormData({ ...formData, rollNumber: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Class *</label>
              <input
                type="text"
                value={formData.class || ''}
                onChange={(e) => setFormData({ ...formData, class: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Age Category</label>
              <select
                value={formData.ageCategory || 'Junior'}
                onChange={(e) => setFormData({ ...formData, ageCategory: e.target.value as AgeCategory })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                {AGE_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Sex</label>
              <select
                value={formData.sex || 'Male'}
                onChange={(e) => setFormData({ ...formData, sex: e.target.value as StudentSex })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                {SEX_OPTIONS.map((sex) => (
                  <option key={sex} value={sex}>
                    {sex}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">House</label>
              <select
                value={formData.houseId || ''}
                onChange={(e) => setFormData({ ...formData, houseId: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select House</option>
                {houses.map((house) => (
                  <option key={house.id} value={house.id}>
                    {house.name}
                  </option>
                ))}
                <option value="__new__">Create new house...</option>
              </select>
            </div>
            {formData.houseId === '__new__' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">New House Name *</label>
                <input
                  type="text"
                  value={newHouseName}
                  onChange={(e) => setNewHouseName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g., Blue House"
                />
              </div>
            )}
          </div>
          <div className="flex gap-2 mt-4">
            <button
              onClick={handleSave}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Save size={18} />
              Save
            </button>
            <button
              onClick={handleCancel}
              className="flex items-center gap-2 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
            >
              <X size={18} />
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-md overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Reg No
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Name
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Class
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Age Category
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Sex
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  House
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredStudents.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-gray-500">
                    <Users size={40} className="mx-auto mb-2 text-gray-300" />
                    <p>No students found</p>
                  </td>
                </tr>
              ) : (
                filteredStudents.map((student) => {
                  const house = houses.find((h) => h.id === student.houseId);
                  return (
                    <tr key={student.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {student.registerNumber}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {student.name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {student.class}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {student.ageCategory}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {student.sex || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {house ? (
                          <span
                            className="px-2 py-1 rounded-full text-xs font-medium"
                            style={{
                              backgroundColor: house.color + '20',
                              color: house.color,
                            }}
                          >
                            {house.name}
                          </span>
                        ) : (
                          '-'
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleEdit(student)}
                            className="p-2 text-blue-600 hover:bg-blue-100 rounded-lg transition-colors"
                          >
                            <Edit2 size={16} />
                          </button>
                          <button
                            onClick={() => handleDelete(student.id)}
                            className="p-2 text-red-600 hover:bg-red-100 rounded-lg transition-colors"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="mt-4 text-sm text-gray-500">
        Total: {filteredStudents.length} of {students.length} students
      </div>
      <ConfirmDialog
        open={deleteId !== null}
        title="Delete student?"
        message="This removes the student from the student list. Existing participation entries for this student may no longer show their details."
        confirmLabel="Delete"
        onConfirm={confirmDelete}
        onCancel={() => setDeleteId(null)}
      />
    </div>
  );
}

export default StudentDetails;

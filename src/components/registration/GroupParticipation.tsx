import { useState, useEffect } from 'react';
import {
  Plus,
  Edit2,
  Trash2,
  Download,
  Upload,
  Search,
  UsersRound,
  Save,
  X,
  UserPlus,
  UserMinus,
} from 'lucide-react';
import type { GroupItem, Item, Student, House } from '../../types';
import ConfirmDialog from '../ConfirmDialog';
import {
  getGroupItems,
  setGroupItems,
  addGroupItem,
  updateGroupItem,
  deleteGroupItem,
  getItems,
  getStudents,
  getHouses,
  setHouses as saveHouses,
  generateId,
} from '../../utils/storage';
import { exportToCSV, parseCSV, type CSVRow } from '../../utils/export';

function GroupParticipation() {
  const [groupItems, setGroupItemsState] = useState<GroupItem[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [houses, setHouses] = useState<House[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<Partial<GroupItem> & { selectedMembers: string[] }>({
    selectedMembers: [],
  });
  const [deleteId, setDeleteId] = useState<string | null>(null);

  useEffect(() => {
    setGroupItemsState(getGroupItems());
    setItems(getItems());
    setStudents(getStudents());
    setHouses(getHouses());
  }, []);

  const filteredGroups = groupItems.filter((group) => {
    const itemName = items.find((i) => i.id === group.itemId)?.name || '';
    const houseName = houses.find((h) => h.id === group.houseId)?.name || '';
    return (
      group.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      itemName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      houseName.toLowerCase().includes(searchTerm.toLowerCase())
    );
  });

  const handleAddNew = () => {
    setIsEditing(true);
    setEditingId(null);
    setFormData({
      name: '',
      itemId: items[0]?.id || '',
      houseId: houses[0]?.id || '',
      selectedMembers: [],
      leaderId: '',
    });
  };

  const handleEdit = (group: GroupItem) => {
    setIsEditing(true);
    setEditingId(group.id);
    setFormData({
      ...group,
      selectedMembers: group.members,
      leaderId: group.leaderId || group.members[0] || '',
    });
  };

  const handleSave = () => {
    if (!formData.name || !formData.itemId || !formData.houseId) {
      alert('Please fill in all required fields');
      return;
    }

    const selectedMembers = formData.selectedMembers || [];
    const leaderId = formData.leaderId || selectedMembers[0] || '';
    const orderedMembers = leaderId
      ? [leaderId, ...selectedMembers.filter((id) => id !== leaderId)]
      : [];

    if (editingId) {
      updateGroupItem(editingId, {
        name: formData.name,
        itemId: formData.itemId,
        houseId: formData.houseId,
        members: orderedMembers,
        leaderId: leaderId || undefined,
      });
    } else {
      const newGroupItem: GroupItem = {
        id: generateId(),
        name: formData.name || '',
        itemId: formData.itemId,
        houseId: formData.houseId,
        members: orderedMembers,
        leaderId: leaderId || undefined,
      };
      addGroupItem(newGroupItem);
    }

    setGroupItemsState([...getGroupItems()]);
    setIsEditing(false);
    setEditingId(null);
    setFormData({ selectedMembers: [] });
  };

  const handleDelete = (id: string) => {
    setDeleteId(id);
  };

  const confirmDelete = () => {
    if (!deleteId) return;
    deleteGroupItem(deleteId);
    setGroupItemsState(getGroupItems());
    setDeleteId(null);
  };

  const handleExport = () => {
    const exportData = groupItems.map((g) => {
      const item = items.find((i) => i.id === g.itemId);
      const house = houses.find((h) => h.id === g.houseId);
      const memberNames = g.members
        .map((m) => {
          const student = students.find((s) => s.id === m);
          return student?.name || '';
        })
        .join('; ');

      return {
        groupName: g.name,
        item: item?.name || '',
        house: house?.name || '',
        leader: students.find((s) => s.id === (g.leaderId || g.members[0]))?.name || '',
        members: memberNames,
        memberCount: g.members.length,
      };
    });
    exportToCSV(exportData, 'group-participations');
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
        const importedHouses = [...getHouses()];
        const ensureHouse = (houseName: string) => {
          const trimmedName = houseName.trim();
          if (!trimmedName) return undefined;
          const existing = importedHouses.find((h) => h.name.toLowerCase() === trimmedName.toLowerCase());
          if (existing) return existing;
          const newHouse: House = {
            id: generateId(),
            name: trimmedName,
            color: '#EF4444',
          };
          importedHouses.push(newHouse);
          return newHouse;
        };
        const newGroups: GroupItem[] = data
          .map((row: CSVRow) => {
            const item = items.find((i) => i.name.toLowerCase() === (row.item || '').toLowerCase());
            const house = ensureHouse(row.house || row.houseName || '');
            const memberNames = (row.members || '').split(';').map((name: string) => name.trim()).filter(Boolean);
            const memberIds = memberNames
              .map((name: string) => students.find((s) => s.name.toLowerCase() === name.toLowerCase() && (!house || s.houseId === house.id))?.id)
              .filter(Boolean) as string[];
            const leaderId =
              students.find((s) => s.name.toLowerCase() === (row.leader || '').toLowerCase() && (!house || s.houseId === house.id))?.id ||
              memberIds[0] ||
              '';
            const orderedMembers = [leaderId, ...memberIds.filter((id) => id !== leaderId)].filter(Boolean);

            if (!row.groupName || !item || !house) return null;
            return {
              id: generateId(),
              name: row.groupName,
              itemId: item.id,
              houseId: house.id,
              members: orderedMembers,
              leaderId: leaderId || undefined,
            };
          })
          .filter(Boolean) as GroupItem[];

        if (window.confirm(`Import ${newGroups.length} groups? This will add to existing records.`)) {
          saveHouses(importedHouses);
          setGroupItems([...getGroupItems(), ...newGroups]);
          setGroupItemsState(getGroupItems());
          setHouses(getHouses());
        }
      };
      reader.readAsText(file);
    };
    input.click();
  };

  const handleToggleMember = (studentId: string) => {
    const currentMembers = formData.selectedMembers || [];
    if (currentMembers.includes(studentId)) {
      const nextMembers = currentMembers.filter((id) => id !== studentId);
      setFormData({
        ...formData,
        selectedMembers: nextMembers,
        leaderId: formData.leaderId === studentId ? nextMembers[0] || '' : formData.leaderId,
      });
    } else {
      setFormData({
        ...formData,
        selectedMembers: [...currentMembers, studentId],
        leaderId: formData.leaderId || studentId,
      });
    }
  };

  const handleCancel = () => {
    setIsEditing(false);
    setEditingId(null);
    setFormData({ selectedMembers: [] });
  };

  const getHouseStudents = () => {
    if (!formData.houseId) return students;
    return students.filter((s) => s.houseId === formData.houseId);
  };

  return (
    <div>
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Group Participation Entry</h2>
          <p className="text-gray-600">Create groups and register for group events</p>
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

      {items.length === 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
          <p className="text-yellow-800">
            No items found. Please add items in Items Management first.
          </p>
        </div>
      )}

      {students.length === 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
          <p className="text-yellow-800">
            No students found. Please add students in Student Details first.
          </p>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-md p-6 mb-6">
        <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
          <div className="relative flex-1 w-full">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
            <input
              type="text"
              placeholder="Search groups..."
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
            Add Group
          </button>
        </div>
      </div>

      {isEditing && (
        <div className="bg-white rounded-xl shadow-md p-6 mb-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">
            {editingId ? 'Edit Group' : 'Add New Group'}
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Group Name *</label>
              <input
                type="text"
                value={formData.name || ''}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="e.g., Red House Team A"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Item *</label>
              <select
                value={formData.itemId || ''}
                onChange={(e) => setFormData({ ...formData, itemId: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select Item</option>
                {items.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">House *</label>
              <select
                value={formData.houseId || ''}
                onChange={(e) => setFormData({ ...formData, houseId: e.target.value, selectedMembers: [], leaderId: '' })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select House</option>
                {houses.map((house) => (
                  <option key={house.id} value={house.id}>
                    {house.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {formData.houseId && (
            <div className="mb-6">
              <div className="flex items-center justify-between mb-3">
                <label className="block text-sm font-medium text-gray-700">
                  Select Members - optional ({formData.selectedMembers?.length || 0} selected)
                </label>
                <span className="text-sm text-gray-500">
                  {getHouseStudents().length} students in {houses.find((h) => h.id === formData.houseId)?.name}
                </span>
              </div>
              <p className="mb-3 text-sm text-gray-500">
                Leave members empty to register the item for the selected house only.
              </p>
              {formData.selectedMembers.length > 0 && (
                <div className="mb-3">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Group Leader</label>
                  <select
                    value={formData.leaderId || formData.selectedMembers[0] || ''}
                    onChange={(e) => setFormData({ ...formData, leaderId: e.target.value })}
                    className="w-full md:w-80 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    {formData.selectedMembers.map((id) => {
                      const student = students.find((s) => s.id === id);
                      return (
                        <option key={id} value={id}>
                          {student?.name || id}
                        </option>
                      );
                    })}
                  </select>
                </div>
              )}
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2 max-h-60 overflow-y-auto border border-gray-200 rounded-lg p-3">
                {getHouseStudents().map((student) => {
                  const isSelected = formData.selectedMembers?.includes(student.id);
                  return (
                    <button
                      key={student.id}
                      onClick={() => handleToggleMember(student.id)}
                      className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
                        isSelected
                          ? 'bg-blue-100 text-blue-700 border-2 border-blue-500'
                          : 'bg-gray-50 text-gray-700 border border-gray-200 hover:bg-gray-100'
                      }`}
                    >
                      {isSelected ? <UserMinus size={14} /> : <UserPlus size={14} />}
                      <span className="truncate">{student.name}</span>
                      {formData.leaderId === student.id && (
                        <span className="ml-auto text-[10px] font-semibold uppercase">Leader</span>
                      )}
                    </button>
                  );
                })}
                {getHouseStudents().length === 0 && (
                  <p className="col-span-full text-center text-gray-500 py-4">
                    No students in this house
                  </p>
                )}
              </div>
            </div>
          )}

          <div className="flex gap-2">
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
                  Group Name
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Item
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  House
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Members
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Count
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredGroups.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                    <UsersRound size={40} className="mx-auto mb-2 text-gray-300" />
                    <p>No groups found</p>
                  </td>
                </tr>
              ) : (
                filteredGroups.map((group) => {
                  const item = items.find((i) => i.id === group.itemId);
                  const house = houses.find((h) => h.id === group.houseId);
                  const memberNames = group.members
                    .slice(0, 3)
                    .map((m) => students.find((s) => s.id === m)?.name || '')
                    .filter(Boolean)
                    .join(', ');
                  const remaining = group.members.length - 3;

                  return (
                    <tr key={group.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {group.name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {item?.name || '-'}
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
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {memberNames || <span className="italic text-gray-400">House entry - no members</span>}
                        {remaining > 0 && (
                          <span className="text-gray-400"> +{remaining} more</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-blue-100 text-blue-700 font-medium">
                          {group.members.length}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleEdit(group)}
                            className="p-2 text-blue-600 hover:bg-blue-100 rounded-lg transition-colors"
                          >
                            <Edit2 size={16} />
                          </button>
                          <button
                            onClick={() => handleDelete(group.id)}
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
        Total: {filteredGroups.length} groups
      </div>
      <ConfirmDialog
        open={deleteId !== null}
        title="Delete group?"
        message="This removes the group participation entry and its member list."
        confirmLabel="Delete"
        onConfirm={confirmDelete}
        onCancel={() => setDeleteId(null)}
      />
    </div>
  );
}

export default GroupParticipation;

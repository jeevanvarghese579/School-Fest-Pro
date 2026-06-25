import { useState, useEffect } from 'react';
import {
  Plus,
  Edit2,
  Trash2,
  Download,
  Upload,
  Search,
  FileText,
  Save,
  X,
} from 'lucide-react';
import type { Item, ItemClassification, Stage } from '../../types';
import ConfirmDialog from '../ConfirmDialog';
import {
  getItems,
  setItems,
  addItem,
  updateItem,
  deleteItem,
  getSettings,
  generateId,
} from '../../utils/storage';
import { exportToCSV, parseCSV, type CSVRow } from '../../utils/export';

function ItemsManagement() {
  const [items, setItemsState] = useState<Item[]>([]);
  const [stages, setStages] = useState<Stage[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterClassification, setFilterClassification] = useState<string>('all');
  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<Partial<Item>>({});
  const [deleteId, setDeleteId] = useState<string | null>(null);

  useEffect(() => {
    setItemsState(getItems());
    setStages(getSettings().stages);
  }, []);

  const filteredItems = items.filter((item) => {
    const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesClassification =
      filterClassification === 'all' || item.classification === filterClassification;
    return matchesSearch && matchesClassification;
  });

  const handleAddNew = () => {
    setIsEditing(true);
    setEditingId(null);
    setFormData({
      name: '',
      classification: 'Stage',
      stageId: stages[0]?.id || '',
      timePerPerformance: 5,
      duration: 5,
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleEdit = (item: Item) => {
    setIsEditing(true);
    setEditingId(item.id);
    setFormData(item);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSave = () => {
    if (!formData.name) {
      alert('Please enter an item name');
      return;
    }

    if (editingId) {
      updateItem(editingId, formData);
    } else {
      const newItem: Item = {
        id: generateId(),
        name: formData.name || '',
        classification: formData.classification as ItemClassification || 'Stage',
        stageId: formData.stageId || '',
        timePerPerformance: formData.timePerPerformance || formData.duration || 5,
        duration: formData.timePerPerformance || formData.duration || 5,
      };
      addItem(newItem);
    }

    setItemsState(getItems());
    setIsEditing(false);
    setEditingId(null);
    setFormData({});
  };

  const handleDelete = (id: string) => {
    setDeleteId(id);
  };

  const confirmDelete = () => {
    if (!deleteId) return;
    deleteItem(deleteId);
    setItemsState(getItems());
    setDeleteId(null);
  };

  const handleExport = () => {
    const exportData = items.map((i) => ({
      name: i.name,
      classification: i.classification,
      stageId: i.stageId,
      stageName: stages.find((s) => s.id === i.stageId)?.name || '',
      timePerPerformance: i.timePerPerformance || i.duration,
    }));
    exportToCSV(exportData, 'items');
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

        const newItems: Item[] = data.map((row: CSVRow) => {
          const durationValue =
            row.duration ||
            row.timePerPerformance ||
            row['Time Per Performance'] ||
            row['Time Required Per Performance'] ||
            row.Duration ||
            row['Duration (minutes)'] ||
            row['durationMinutes'] ||
            row['durationInMinutes'] ||
            '';
          const parsedDuration = Number.parseFloat(String(durationValue).replace(/[^\d.]/g, ''));

          return {
            id: generateId(),
            name: row.name || row.item || row.itemName || '',
            classification: row.classification as ItemClassification || 'Stage',
            stageId: row.stageId || stages.find((s) => s.name.toLowerCase() === (row.stageName || row.stage || '').toLowerCase())?.id || '',
            timePerPerformance: Number.isFinite(parsedDuration) && parsedDuration > 0 ? Math.ceil(parsedDuration) : 5,
            duration: Number.isFinite(parsedDuration) && parsedDuration > 0 ? Math.ceil(parsedDuration) : 5,
          };
        });

        if (window.confirm(`Import ${newItems.length} items? This will add to existing records.`)) {
          const existing = getItems();
          setItems([...existing, ...newItems]);
          setItemsState(getItems());
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
          <h2 className="text-2xl font-bold text-gray-800">Items Management</h2>
          <p className="text-gray-600">Manage competition items for stage and off-stage events</p>
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

      {stages.length === 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
          <p className="text-yellow-800">
            No stages found. Please add stages in General Settings first.
          </p>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-md p-6 mb-6">
        <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
          <div className="relative flex-1 w-full">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
            <input
              type="text"
              placeholder="Search items..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div className="flex gap-2 items-center">
            <select
              value={filterClassification}
              onChange={(e) => setFilterClassification(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Classifications</option>
              <option value="Stage">Stage</option>
              <option value="Off Stage">Off Stage</option>
            </select>
            <button
              onClick={handleAddNew}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Plus size={18} />
              Add Item
            </button>
          </div>
        </div>
      </div>

      {isEditing && (
        <div className="bg-white rounded-xl shadow-md p-6 mb-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">
            {editingId ? 'Edit Item' : 'Add New Item'}
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Item Name *</label>
              <input
                type="text"
                value={formData.name || ''}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Classification</label>
              <select
                value={formData.classification || 'Stage'}
                onChange={(e) => setFormData({ ...formData, classification: e.target.value as ItemClassification })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="Stage">Stage</option>
                <option value="Off Stage">Off Stage</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Stage</label>
              <select
                value={formData.stageId || ''}
                onChange={(e) => setFormData({ ...formData, stageId: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select Stage</option>
                {stages.map((stage) => (
                  <option key={stage.id} value={stage.id}>
                    {stage.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Time Required Per Performance (minutes)</label>
              <input
                type="number"
                min="1"
                value={formData.timePerPerformance || formData.duration || 5}
                onChange={(e) => {
                  const value = parseInt(e.target.value) || 5;
                  setFormData({ ...formData, timePerPerformance: value, duration: value });
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
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
                  Item Name
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Classification
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Stage
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Time / Performance
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                    <FileText size={40} className="mx-auto mb-2 text-gray-300" />
                    <p>No items found</p>
                  </td>
                </tr>
              ) : (
                filteredItems.map((item) => {
                  const stage = stages.find((s) => s.id === item.stageId);
                  return (
                    <tr key={item.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {item.name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        <span
                          className={`px-2 py-1 rounded-full text-xs font-medium ${
                            item.classification === 'Stage'
                              ? 'bg-purple-100 text-purple-700'
                              : 'bg-orange-100 text-orange-700'
                          }`}
                        >
                          {item.classification}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {stage?.name || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {item.timePerPerformance || item.duration} min
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleEdit(item)}
                            className="p-2 text-blue-600 hover:bg-blue-100 rounded-lg transition-colors"
                          >
                            <Edit2 size={16} />
                          </button>
                          <button
                            onClick={() => handleDelete(item.id)}
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
        Total: {filteredItems.length} of {items.length} items
      </div>
      <ConfirmDialog
        open={deleteId !== null}
        title="Delete item?"
        message="This removes the item from item management. Related participation entries may no longer show a matching item."
        confirmLabel="Delete"
        onConfirm={confirmDelete}
        onCancel={() => setDeleteId(null)}
      />
    </div>
  );
}

export default ItemsManagement;

import { useState, useEffect } from 'react';
import {
  Plus,
  Trash2,
  Save,
  Building,
  Calendar,
  Award,
  MapPin,
  Home,
} from 'lucide-react';
import type { Settings, Stage, House } from '../../types';
import ConfirmDialog from '../ConfirmDialog';
import {
  getSettings,
  setSettings,
  getHouses,
  addHouse,
  updateHouse,
  deleteHouse,
  generateId,
} from '../../utils/storage';

const DEFAULT_COLORS = [
  '#EF4444', // red
  '#F97316', // orange
  '#EAB308', // yellow
  '#22C55E', // green
  '#3B82F6', // blue
  '#8B5CF6', // purple
  '#EC4899', // pink
  '#14B8A6', // teal
];

type SettingsTab = 'school' | 'stages' | 'houses' | 'points';

function GeneralSettings() {
  const [settings, setSettingsState] = useState<Settings | null>(null);
  const [houses, setHousesState] = useState<House[]>([]);
  const [activeTab, setActiveTab] = useState<SettingsTab>('school');
  const [newStageName, setNewStageName] = useState('');
  const [newHouseName, setNewHouseName] = useState('');
  const [newHouseColor, setNewHouseColor] = useState(DEFAULT_COLORS[0]);
  const [confirmAction, setConfirmAction] = useState<null | {
    title: string;
    message: string;
    onConfirm: () => void;
  }>(null);

  useEffect(() => {
    setSettingsState(getSettings());
    setHousesState(getHouses());
  }, []);

  const handleSaveSettings = () => {
    if (!settings) return;
    setSettings(settings);
    alert('Settings saved successfully!');
  };

  const handleAddStage = () => {
    if (!settings || !newStageName.trim()) return;
    const newStage: Stage = {
      id: generateId(),
      name: newStageName.trim(),
    };
    setSettingsState({
      ...settings,
      stages: [...settings.stages, newStage],
    });
    setNewStageName('');
  };

  const handleDeleteStage = (stageId: string) => {
    if (!settings) return;
    setConfirmAction({
      title: 'Delete stage?',
      message: 'This removes the stage from settings. Items assigned to it may need a new stage later.',
      onConfirm: () => {
      setSettingsState({
        ...settings,
        stages: settings.stages.filter((s) => s.id !== stageId),
      });
        setConfirmAction(null);
      },
    });
  };

  const handleAddHouse = () => {
    if (!newHouseName.trim()) return;
    const newHouse: House = {
      id: generateId(),
      name: newHouseName.trim(),
      color: newHouseColor,
    };
    addHouse(newHouse);
    setHousesState(getHouses());
    setNewHouseName('');
    setNewHouseColor(DEFAULT_COLORS[houses.length % DEFAULT_COLORS.length]);
  };

  const handleUpdateHouseName = (id: string, name: string) => {
    setHousesState(houses.map((house) => (house.id === id ? { ...house, name } : house)));
  };

  const handleCommitHouseName = (id: string, name: string) => {
    if (!name.trim()) {
      setHousesState(getHouses());
      return;
    }
    updateHouse(id, { name });
    setHousesState(getHouses());
  };

  const handleUpdateHouseColor = (id: string, color: string) => {
    updateHouse(id, { color });
    setHousesState(getHouses());
  };

  const handleDeleteHouse = (id: string) => {
    setConfirmAction({
      title: 'Delete house?',
      message: 'This removes the house. Students assigned to it will show no house until you assign another one.',
      onConfirm: () => {
      deleteHouse(id);
      setHousesState(getHouses());
        setConfirmAction(null);
      },
    });
  };

  const updatePoints = (
    category: 'individualPoints' | 'groupPoints',
    position: 'first' | 'second' | 'third',
    value: number
  ) => {
    if (!settings) return;
    setSettingsState({
      ...settings,
      [category]: {
        ...settings[category],
        [position]: value,
      },
    });
  };

  if (!settings) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const tabs: Array<{ id: SettingsTab; label: string; icon: typeof Building }> = [
    { id: 'school', label: 'School & Programme', icon: Building },
    { id: 'stages', label: 'Stages', icon: MapPin },
    { id: 'houses', label: 'Houses', icon: Home },
    { id: 'points', label: 'Points Configuration', icon: Award },
  ];

  return (
    <div>
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">General Settings</h2>
          <p className="text-gray-600">Configure school, programme, stages, houses, and points</p>
        </div>
        <button
          onClick={handleSaveSettings}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors mt-4 md:mt-0"
        >
          <Save size={18} />
          Save Settings
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-md overflow-hidden">
        <div className="border-b border-gray-200">
          <div className="flex overflow-x-auto">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-6 py-4 text-sm font-medium whitespace-nowrap transition-colors ${
                    activeTab === tab.id
                      ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50'
                      : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <Icon size={18} />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="p-6">
          {activeTab === 'school' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    School Name
                  </label>
                  <input
                    type="text"
                    value={settings.schoolName}
                    onChange={(e) =>
                      setSettingsState({ ...settings, schoolName: e.target.value })
                    }
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="Enter school name"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Programme Name
                  </label>
                  <input
                    type="text"
                    value={settings.programmeName}
                    onChange={(e) =>
                      setSettingsState({ ...settings, programmeName: e.target.value })
                    }
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="Enter programme name"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Scoresheets PDF URL
                  </label>
                  <input
                    type="url"
                    value={settings.scoresheetsPdfUrl}
                    onChange={(e) =>
                      setSettingsState({ ...settings, scoresheetsPdfUrl: e.target.value })
                    }
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="https://example.com/scoresheets.pdf"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    <Calendar size={16} className="inline mr-1" />
                    Programme Days
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={settings.programmeDays}
                    onChange={(e) =>
                      setSettingsState({ ...settings, programmeDays: parseInt(e.target.value) || 1 })
                    }
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Day Start Time
                  </label>
                  <input
                    type="time"
                    value={settings.dayStartTime}
                    onChange={(e) =>
                      setSettingsState({ ...settings, dayStartTime: e.target.value })
                    }
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Day End Time
                  </label>
                  <input
                    type="time"
                    value={settings.dayEndTime}
                    onChange={(e) =>
                      setSettingsState({ ...settings, dayEndTime: e.target.value })
                    }
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Schedule Buffer Per Item (minutes)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={settings.scheduleBufferMinutes}
                    onChange={(e) =>
                      setSettingsState({ ...settings, scheduleBufferMinutes: parseInt(e.target.value) || 0 })
                    }
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Max Individual Items per Student
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={settings.maxIndividualItems}
                    onChange={(e) =>
                      setSettingsState({
                        ...settings,
                        maxIndividualItems: parseInt(e.target.value) || 1,
                      })
                    }
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>
          )}

          {activeTab === 'stages' && (
            <div className="space-y-6">
              <div className="flex gap-4">
                <input
                  type="text"
                  value={newStageName}
                  onChange={(e) => setNewStageName(e.target.value)}
                  placeholder="Enter stage name"
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleAddStage();
                  }}
                />
                <button
                  onClick={handleAddStage}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <Plus size={18} />
                  Add Stage
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {settings.stages.length === 0 ? (
                  <div className="col-span-full text-center py-8 text-gray-500">
                    <MapPin size={40} className="mx-auto mb-2 text-gray-300" />
                    <p>No stages added yet</p>
                  </div>
                ) : (
                  settings.stages.map((stage) => (
                    <div
                      key={stage.id}
                      className="flex items-center justify-between p-4 bg-gray-50 rounded-lg"
                    >
                      <div className="flex items-center gap-3">
                        <MapPin size={20} className="text-blue-600" />
                        <span className="font-medium text-gray-800">{stage.name}</span>
                      </div>
                      <button
                        onClick={() => handleDeleteStage(stage.id)}
                        className="p-2 text-red-600 hover:bg-red-100 rounded-lg transition-colors"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {activeTab === 'houses' && (
            <div className="space-y-6">
              <div className="flex flex-col md:flex-row gap-4">
                <input
                  type="text"
                  value={newHouseName}
                  onChange={(e) => setNewHouseName(e.target.value)}
                  placeholder="Enter house name"
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleAddHouse();
                  }}
                />
                <div className="flex items-center gap-2">
                  <label className="text-sm text-gray-600">Color:</label>
                  <input
                    type="color"
                    value={newHouseColor}
                    onChange={(e) => setNewHouseColor(e.target.value)}
                    className="w-10 h-10 rounded cursor-pointer"
                  />
                  <div className="flex gap-1">
                    {DEFAULT_COLORS.slice(0, 4).map((color) => (
                      <button
                        key={color}
                        onClick={() => setNewHouseColor(color)}
                        className="w-6 h-6 rounded border-2 border-white shadow hover:scale-110 transition-transform"
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </div>
                </div>
                <button
                  onClick={handleAddHouse}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <Plus size={18} />
                  Add House
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {houses.length === 0 ? (
                  <div className="col-span-full text-center py-8 text-gray-500">
                    <Home size={40} className="mx-auto mb-2 text-gray-300" />
                    <p>No houses added yet</p>
                  </div>
                ) : (
                  houses.map((house) => (
                    <div
                      key={house.id}
                      className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg"
                    >
                      <input
                        type="color"
                        value={house.color}
                        onChange={(e) => handleUpdateHouseColor(house.id, e.target.value)}
                        className="w-10 h-10 rounded cursor-pointer"
                      />
                      <input
                        type="text"
                        value={house.name}
                        onChange={(e) => handleUpdateHouseName(house.id, e.target.value)}
                        onBlur={(e) => handleCommitHouseName(house.id, e.target.value)}
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      />
                      <button
                        onClick={() => handleDeleteHouse(house.id)}
                        className="p-2 text-red-600 hover:bg-red-100 rounded-lg transition-colors"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {activeTab === 'points' && (
            <div className="space-y-8">
              <div>
                <h3 className="text-lg font-semibold text-gray-800 mb-4">Individual Item Points</h3>
                <div className="grid grid-cols-3 gap-4">
                  {(['first', 'second', 'third'] as const).map((pos) => (
                    <div key={pos}>
                      <label className="block text-sm font-medium text-gray-700 mb-2 capitalize">
                        {pos === 'first' ? '1st' : pos === 'second' ? '2nd' : '3rd'} Place
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={settings.individualPoints[pos]}
                        onChange={(e) =>
                          updatePoints('individualPoints', pos, parseInt(e.target.value) || 0)
                        }
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-gray-800 mb-4">Group Item Points</h3>
                <div className="grid grid-cols-3 gap-4">
                  {(['first', 'second', 'third'] as const).map((pos) => (
                    <div key={pos}>
                      <label className="block text-sm font-medium text-gray-700 mb-2 capitalize">
                        {pos === 'first' ? '1st' : pos === 'second' ? '2nd' : '3rd'} Place
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={settings.groupPoints[pos]}
                        onChange={(e) =>
                          updatePoints('groupPoints', pos, parseInt(e.target.value) || 0)
                        }
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  ))}
                </div>
              </div>

            </div>
          )}
        </div>
      </div>
      <ConfirmDialog
        open={confirmAction !== null}
        title={confirmAction?.title || ''}
        message={confirmAction?.message || ''}
        confirmLabel="Delete"
        onConfirm={() => confirmAction?.onConfirm()}
        onCancel={() => setConfirmAction(null)}
      />
    </div>
  );
}

export default GeneralSettings;

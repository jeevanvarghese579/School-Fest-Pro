import { useRef, useState } from 'react';
import {
  Users,
  FileText,
  CheckSquare,
  UsersRound,
  Settings,
  ArrowLeft,
} from 'lucide-react';
import StudentDetails from './registration/StudentDetails';
import ItemsManagement from './registration/ItemsManagement';
import IndividualParticipation from './registration/IndividualParticipation';
import GroupParticipation from './registration/GroupParticipation';
import GeneralSettings, { type GeneralSettingsHandle } from './registration/GeneralSettings';

type SubPage = 'main' | 'students' | 'items' | 'individual' | 'group' | 'settings';

function RegistrationPortal() {
  const [currentSubPage, setCurrentSubPage] = useState<SubPage>('main');
  const [openStudentForm, setOpenStudentForm] = useState(false);
  const generalSettingsRef = useRef<GeneralSettingsHandle>(null);

  const handleBack = () => {
    if (currentSubPage === 'settings') generalSettingsRef.current?.save();
    setCurrentSubPage('main');
  };

  const menuItems = [
    {
      id: 'students',
      label: 'Student Details',
      description: 'Manage student information, houses, and registrations',
      icon: Users,
      color: 'from-blue-500 to-cyan-500',
    },
    {
      id: 'items',
      label: 'Items Management',
      description: 'Add and manage stage and off-stage competition items',
      icon: FileText,
      color: 'from-purple-500 to-pink-500',
    },
    {
      id: 'individual',
      label: 'Individual Participation Entry',
      description: 'Register students for individual events',
      icon: CheckSquare,
      color: 'from-green-500 to-emerald-500',
    },
    {
      id: 'group',
      label: 'Group Participation Entry',
      description: 'Create groups and register for group events',
      icon: UsersRound,
      color: 'from-orange-500 to-red-500',
    },
    {
      id: 'settings',
      label: 'General Settings',
      description: 'Configure school, programme, and point settings',
      icon: Settings,
      color: 'from-gray-600 to-gray-700',
    },
  ];

  if (currentSubPage !== 'main') {
    return (
      <div>
        <button
          onClick={handleBack}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-800 mb-6 transition-colors"
        >
          <ArrowLeft size={20} />
          <span>Back to Registration Portal</span>
        </button>
        {currentSubPage === 'students' && (
          <StudentDetails
            openAddForm={openStudentForm}
            onAddFormOpened={() => setOpenStudentForm(false)}
          />
        )}
        {currentSubPage === 'items' && <ItemsManagement />}
        {currentSubPage === 'individual' && (
          <IndividualParticipation
            onAddStudent={() => {
              setOpenStudentForm(true);
              setCurrentSubPage('students');
            }}
          />
        )}
        {currentSubPage === 'group' && <GroupParticipation />}
        {currentSubPage === 'settings' && <GeneralSettings ref={generalSettingsRef} />}
      </div>
    );
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-800 mb-2">Registration Portal</h1>
        <p className="text-gray-600">Manage all registration activities for your school festival</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {menuItems.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              onClick={() => setCurrentSubPage(item.id as SubPage)}
              className="bg-white rounded-xl shadow-md hover:shadow-xl transition-all duration-300 p-6 text-left group"
            >
              <div
                className={`w-14 h-14 bg-gradient-to-br ${item.color} rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform shadow-lg`}
              >
                <Icon size={28} className="text-white" />
              </div>
              <h3 className="text-lg font-semibold text-gray-800 mb-2">
                {item.label}
              </h3>
              <p className="text-sm text-gray-600">{item.description}</p>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default RegistrationPortal;

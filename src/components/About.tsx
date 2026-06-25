import { resetAllDataEverywhere } from '../utils/storage';
import { useState } from 'react';
import { Copy, Check, Trash2, Download, Upload, AlertCircle, ExternalLink, Mail, Globe } from 'lucide-react';
import { DEFAULT_HOUSE, DEFAULT_SCORESHEETS_PDF_URL } from '../utils/storage';
import appIcon from '../assets/app-icon.svg';

const DEVELOPER_EMAIL = 'jeevanvarghese579@gmail.com';
const DEVELOPER_WEBSITE = 'https://itsjeevanvarghese.web.app/';

function About() {
  const [copied, setCopied] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  const handleCopyEmail = () => {
    navigator.clipboard.writeText(DEVELOPER_EMAIL);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  
const handleReset = async () => {
  await resetAllDataEverywhere();

  localStorage.setItem('schoolfest_houses', JSON.stringify([DEFAULT_HOUSE]));
  localStorage.setItem(
    'schoolfest_settings',
    JSON.stringify({ scoresheetsPdfUrl: DEFAULT_SCORESHEETS_PDF_URL })
  );

  setShowResetConfirm(false);
  alert('All data has been reset. Please wait a while to sync with cloud');
  window.location.reload();
};


  const handleBackup = () => {
    const backup = {
      students: JSON.parse(localStorage.getItem('schoolfest_students') || '[]'),
      houses: JSON.parse(localStorage.getItem('schoolfest_houses') || '[]'),
      items: JSON.parse(localStorage.getItem('schoolfest_items') || '[]'),
      participations: JSON.parse(localStorage.getItem('schoolfest_individual_participations') || '[]'),
      groupItems: JSON.parse(localStorage.getItem('schoolfest_group_items') || '[]'),
      settings: JSON.parse(localStorage.getItem('schoolfest_settings') || '{}'),
      results: JSON.parse(localStorage.getItem('schoolfest_results') || '[]'),
      schedule: JSON.parse(localStorage.getItem('schoolfest_schedule') || '[]'),
      backupDate: new Date().toISOString(),
      version: '2.0.7',
    };

    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `schoolfest-backup-${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  const handleRestore = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const backup = JSON.parse(e.target?.result as string);

        if (!backup.version) {
          alert('Invalid backup file. Please select a valid SchoolFest backup.');
          return;
        }

        // Restore all data
        if (backup.students) localStorage.setItem('schoolfest_students', JSON.stringify(backup.students));
        if (backup.houses) localStorage.setItem('schoolfest_houses', JSON.stringify(backup.houses));
        if (backup.items) localStorage.setItem('schoolfest_items', JSON.stringify(backup.items));
        if (backup.participations) localStorage.setItem('schoolfest_individual_participations', JSON.stringify(backup.participations));
        if (backup.groupItems) localStorage.setItem('schoolfest_group_items', JSON.stringify(backup.groupItems));
        if (backup.settings) localStorage.setItem('schoolfest_settings', JSON.stringify(backup.settings));
        if (backup.results) localStorage.setItem('schoolfest_results', JSON.stringify(backup.results));
        if (backup.schedule) localStorage.setItem('schoolfest_schedule', JSON.stringify(backup.schedule));

        alert('Backup restored successfully! Please refresh the page.');
      } catch {
        alert('Error reading backup file. Please ensure it is a valid JSON file.');
      }
    };
    reader.readAsText(file);
    event.target.value = '';
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center">
      <div className="bg-white rounded-2xl shadow-xl p-8 max-w-lg w-full text-center">
        <div className="mb-8">
          <img src={appIcon} alt="SchoolFest Pro" className="w-24 h-24 rounded-2xl mx-auto shadow-lg mb-4" />
          <h1 className="text-3xl font-bold text-gray-800 mb-2">SchoolFest Pro</h1>
          <p className="text-gray-500">Version 2.0.7</p>
        </div>

        <div className="border-t border-gray-200 pt-6">
          <p className="text-gray-600 mb-2">
            A comprehensive solution for managing school arts and sports festivals.
          </p>
        </div>

        <div className="mt-8 pt-6 border-t border-gray-200">
          <div className="mb-5">
            <p className="text-gray-500 text-sm font-medium uppercase tracking-wide mb-2">Developed By</p>
            <p className="text-3xl font-bold text-gray-900">Jeevan Varghese</p>
          </div>

          <div className="mb-6">
            <p className="text-gray-600">St. Gemma's GHSS Malappuram</p>
          </div>

          <div className="space-y-5 text-left">
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-2">
                <Mail size={16} className="text-blue-600" />
                Email
              </div>
              <button
                type="button"
                onClick={handleCopyEmail}
                className="w-full flex items-center justify-between gap-3 text-left text-gray-700 hover:text-gray-900 transition-colors"
                title="Click to copy email"
              >
                <span className="break-all">{DEVELOPER_EMAIL}</span>
                {copied ? (
                  <Check size={18} className="text-green-600 flex-shrink-0" />
                ) : (
                  <Copy size={18} className="text-gray-400 flex-shrink-0" />
                )}
              </button>
              <p className="text-xs text-gray-500 mt-2">(Click to copy)</p>
            </div>

            <div className="rounded-lg border border-blue-100 bg-blue-50 p-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-2">
                <Globe size={16} className="text-blue-600" />
                Website
              </div>
              <a
                href={DEVELOPER_WEBSITE}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between gap-3 text-blue-700 hover:text-blue-900 font-medium transition-colors"
              >
                <span className="break-all">{DEVELOPER_WEBSITE}</span>
                <ExternalLink size={18} className="flex-shrink-0" />
              </a>
              <p className="text-xs text-gray-500 mt-2">(Open in new tab)</p>
            </div>

            <p className="text-sm text-gray-600 leading-relaxed text-center">
              For more school-related software and educational tools, please visit:{' '}
              <a
                href={DEVELOPER_WEBSITE}
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-blue-700 hover:text-blue-900"
              >
                {DEVELOPER_WEBSITE}
              </a>
            </p>
          </div>
          {copied && (
            <p className="text-green-600 text-sm mt-2">Email copied to clipboard!</p>
          )}
        </div>

        {/* Backup & Restore Section */}
        <div className="mt-8 pt-6 border-t border-gray-200">
          <h3 className="font-semibold text-gray-800 mb-4">Data Management</h3>

          <div className="space-y-3">
            <button
              onClick={handleBackup}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Download size={18} />
              Backup All Data
            </button>

            <label className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors cursor-pointer">
              <Upload size={18} />
              Restore from Backup
              <input
                type="file"
                accept=".json"
                onChange={handleRestore}
                className="hidden"
              />
            </label>
          </div>
        </div>

        {/* Reset Section */}
        <div className="mt-6 pt-6 border-t border-gray-200">
          <h3 className="font-semibold text-gray-800 mb-4 flex items-center justify-center gap-2">
            <AlertCircle size={18} className="text-red-500" />
            Danger Zone
          </h3>

          {!showResetConfirm ? (
            <button
              onClick={() => setShowResetConfirm(true)}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors border border-red-300"
            >
              <Trash2 size={18} />
              Reset All Data
            </button>
          ) : (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="text-red-800 text-sm mb-3">
                This will permanently delete ALL data including students, items, participations, results, and settings. This action cannot be undone.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowResetConfirm(false)}
                  className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleReset}
                  className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                >
                  Yes, Reset
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="mt-8 pt-6 border-t border-gray-200 text-left">
          <h3 className="font-semibold text-gray-800 mb-3">Features</h3>
          <ul className="text-sm text-gray-600 space-y-2">
            <li className="flex items-start gap-2">
              <span className="text-amber-500 mt-0.5">*</span>
              <span>Complete student registration and management</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-amber-500 mt-0.5">*</span>
              <span>Stage and off-stage item categorization</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-amber-500 mt-0.5">*</span>
              <span>Individual and group participation tracking</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-amber-500 mt-0.5">*</span>
              <span>Automated schedule generation</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-amber-500 mt-0.5">*</span>
              <span>Comprehensive PDF reports</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-amber-500 mt-0.5">*</span>
              <span>House-wise points calculation</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-amber-500 mt-0.5">*</span>
              <span>Import/Export data as CSV</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-amber-500 mt-0.5">*</span>
              <span>Backup and restore all data</span>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}

export default About;

import React, { useRef, useState } from 'react';
import { Check, Download, FileJson, FileSpreadsheet, FileText, Smartphone, Upload, X } from 'lucide-react';
import {
  exportFullBackupJson,
  exportLifeGoalsCsv,
  exportSummaryReportTxt,
  exportTradesCsv,
  normalizeState,
} from '../lib/domain';
import { DayLockState } from '../types';

interface Props {
  open: boolean;
  onClose: () => void;
  state: DayLockState;
  isInstallable: boolean;
  isInstalled: boolean;
  isIOS: boolean;
  onInstallApp: () => Promise<boolean>;
  onRestoreBackup: (restored: DayLockState) => void;
  onToast: (msg: string) => void;
}

export const DownloadCenterModal: React.FC<Props> = ({
  open,
  onClose,
  state,
  isInstallable,
  isInstalled,
  isIOS,
  onInstallApp,
  onRestoreBackup,
  onToast,
}) => {
  const fileRef = useRef<HTMLInputElement>(null);
  const [showGuide, setShowGuide] = useState(false);

  if (!open) return null;

  const handleInstallClick = async () => {
    if (isInstallable) {
      const ok = await onInstallApp();
      if (ok) {
        onToast('DayLock app installed on your device');
      }
      return;
    }
    setShowGuide((prev) => !prev);
  };

  const handleRestoreFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const restored = normalizeState(parsed);
      restored.updatedAt = Date.now();
      restored.demo = false;
      onRestoreBackup(restored);
      onToast(`Restored ${restored.trades.length} trades & ${restored.lifeGoals.length} life goals`);
      onClose();
    } catch {
      onToast('Invalid backup file. Please choose a DayLock JSON backup.');
    } finally {
      e.target.value = '';
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#03121e]/65 backdrop-blur-sm"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-3xl bg-[#eef7fc] border border-white p-6 shadow-2xl text-[#0a1c2e]"
        role="dialog"
        aria-modal="true"
        aria-label="Download App and Backups"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold">Download App & Data</h2>
            <p className="text-xs text-[#4d6a80] mt-0.5">
              Install DayLock as a standalone offline app or download your memory & reports.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="min-h-[44px] min-w-[44px] -mr-2 -mt-2 flex items-center justify-center rounded-xl text-[#4d6a80] hover:bg-white/70 hover:text-[#0a1c2e] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="mt-5 space-y-3">
          {/* App Download / Install Card */}
          <div className="rounded-2xl bg-[#0a1c2e] text-white p-4">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl bg-white/10 border border-white/20 flex items-center justify-center shrink-0">
                  <Smartphone className="w-5 h-5 text-[#5ee0ff]" />
                </div>
                <div>
                  <p className="font-semibold text-sm">DayLock App (Offline Ready)</p>
                  <p className="text-xs text-[#eaf6fb]/75">
                    {isInstalled
                      ? 'Already running as an installed app on this device'
                      : 'Install on Android, iPhone, Windows, or Mac'}
                  </p>
                </div>
              </div>
              {isInstalled ? (
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#35d6a1]">
                  <Check className="w-4 h-4" /> Installed
                </span>
              ) : (
                <button
                  type="button"
                  onClick={handleInstallClick}
                  className="h-10 px-4 rounded-xl bg-[#ff6a1a] hover:bg-[#e85a0d] text-white text-xs font-semibold inline-flex items-center gap-2 whitespace-nowrap transition-colors"
                >
                  <Download className="w-4 h-4" />
                  {isInstallable ? 'Install App Now' : 'How to Download App'}
                </button>
              )}
            </div>

            {!isInstalled && showGuide && (
              <div className="mt-3 pt-3 border-t border-white/15 text-xs text-[#eaf6fb]/90 space-y-1.5 leading-relaxed">
                {isIOS ? (
                  <>
                    <p className="font-semibold text-white">On iPhone / iPad (Safari):</p>
                    <p>1. Tap the Share button at the bottom of Safari.</p>
                    <p>2. Scroll down and tap &ldquo;Add to Home Screen&rdquo;.</p>
                    <p>3. Tap Add — DayLock launches fullscreen offline.</p>
                  </>
                ) : (
                  <>
                    <p className="font-semibold text-white">Install on Desktop or Android:</p>
                    <p>
                      • Chrome / Edge Desktop: Click the install icon in the right side of your address bar (or open
                      Browser Menu → Save and Share → Install DayLock).
                    </p>
                    <p>• Android Chrome: Open Menu (⋮) → &ldquo;Install app&rdquo; or &ldquo;Add to Home screen&rdquo;.</p>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Data Download Options */}
          <div className="pt-2">
            <p className="text-xs font-semibold text-[#4d6a80] mb-2">Export & Backup Files</p>
            <div className="grid gap-2.5 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => {
                  exportTradesCsv(state);
                  onToast('Trades CSV downloaded');
                }}
                className="flex items-center gap-3 p-3.5 rounded-2xl bg-white/80 hover:bg-white border border-white text-left transition-colors min-h-[56px]"
              >
                <FileSpreadsheet className="w-5 h-5 text-[#1590f0] shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm font-semibold truncate">Trades CSV</p>
                  <p className="text-xs text-[#4d6a80] truncate">{state.trades.length} logged trades</p>
                </div>
              </button>

              <button
                type="button"
                onClick={() => {
                  exportLifeGoalsCsv(state);
                  onToast('Life Goals CSV downloaded');
                }}
                className="flex items-center gap-3 p-3.5 rounded-2xl bg-white/80 hover:bg-white border border-white text-left transition-colors min-h-[56px]"
              >
                <FileSpreadsheet className="w-5 h-5 text-[#0fa578] shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm font-semibold truncate">Life Goals CSV</p>
                  <p className="text-xs text-[#4d6a80] truncate">{state.lifeGoals.length} goals & deadlines</p>
                </div>
              </button>

              <button
                type="button"
                onClick={() => {
                  exportFullBackupJson(state);
                  onToast('Full JSON memory backup downloaded');
                }}
                className="flex items-center gap-3 p-3.5 rounded-2xl bg-white/80 hover:bg-white border border-white text-left transition-colors min-h-[56px]"
              >
                <FileJson className="w-5 h-5 text-[#ff6a1a] shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm font-semibold truncate">Full Memory Backup</p>
                  <p className="text-xs text-[#4d6a80] truncate">JSON snapshot (all data)</p>
                </div>
              </button>

              <button
                type="button"
                onClick={() => {
                  exportSummaryReportTxt(state);
                  onToast('Summary report downloaded');
                }}
                className="flex items-center gap-3 p-3.5 rounded-2xl bg-white/80 hover:bg-white border border-white text-left transition-colors min-h-[56px]"
              >
                <FileText className="w-5 h-5 text-[#0a1c2e] shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm font-semibold truncate">Summary Report</p>
                  <p className="text-xs text-[#4d6a80] truncate">Readable .txt overview</p>
                </div>
              </button>
            </div>
          </div>

          {/* Restore Backup */}
          <div className="pt-2 border-t border-[#0a1c2e]/10 flex items-center justify-between gap-3 flex-wrap">
            <div>
              <p className="text-sm font-semibold">Restore from Backup</p>
              <p className="text-xs text-[#4d6a80]">Import a saved DayLock JSON backup file</p>
            </div>
            <input
              ref={fileRef}
              type="file"
              accept="application/json,.json"
              onChange={handleRestoreFile}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="h-10 px-4 rounded-xl bg-white hover:bg-white/90 border border-[#0a1c2e]/15 text-xs font-semibold inline-flex items-center gap-2 whitespace-nowrap transition-colors"
            >
              <Upload className="w-4 h-4" />
              Import JSON
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

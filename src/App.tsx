import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  BarChart3,
  Calendar as CalendarIcon,
  Cloud,
  CloudOff,
  Download,
  Flag,
  LayoutDashboard,
  ListChecks,
  Lock,
  LogIn,
  LogOut,
  Search,
  SlidersHorizontal,
} from 'lucide-react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { CalendarView } from './components/CalendarView';
import { DownloadCenterModal } from './components/DownloadCenterModal';
import { GoalsRulesView } from './components/GoalsRulesView';
import { InsightsView } from './components/InsightsView';
import { LifeGoalModal } from './components/LifeGoalModal';
import { LifeGoalsView } from './components/LifeGoalsView';
import { TodayView } from './components/TodayView';
import { TradeModal } from './components/TradeModal';
import { TradesView } from './components/TradesView';
import { useOnlineStatus } from './hooks/useOnlineStatus';
import { usePWAInstall } from './hooks/usePWAInstall';
import {
  blankState,
  createSampleState,
  getDayStatus,
  longDate,
  money,
  sumRange,
  targetFor,
  stopFor,
  todayKey,
  uid,
} from './lib/domain';
import {
  auth,
  deleteLifeGoalFromCloud,
  deleteTradeFromCloud,
  ensureCloudWorkspace,
  loadCloudState,
  pushAllLocalToCloud,
  signInWithGoogle,
  signOutFromCloud,
  syncWorkspaceSettingsToCloud,
  testFirestoreConnection,
  upsertDayToCloud,
  upsertLifeGoalToCloud,
  upsertTradeToCloud,
} from './lib/firebase';
import { loadBestLocalMemory, persistLocalMemory } from './lib/memory';
import { DayLockState, LifeGoal, Settings, Trade, TradeFilter, ViewTab } from './types';

const NAV_ITEMS: { id: ViewTab; label: string; shortLabel: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'today', label: 'Today', shortLabel: 'Today', icon: LayoutDashboard },
  { id: 'trades', label: 'Trades', shortLabel: 'Trades', icon: ListChecks },
  { id: 'calendar', label: 'Calendar', shortLabel: 'Calendar', icon: CalendarIcon },
  { id: 'insights', label: 'Insights', shortLabel: 'Insights', icon: BarChart3 },
  { id: 'lifegoals', label: 'Life Goals', shortLabel: 'Goals', icon: Flag },
  { id: 'rules', label: 'Rules & Plan', shortLabel: 'Rules', icon: SlidersHorizontal },
];

export default function App() {
  const [state, setState] = useState<DayLockState>(() => {
    // Load synchronously from localStorage first, then upgrade from IndexedDB
    try {
      const v2 = localStorage.getItem('daylock.v2');
      if (v2) return JSON.parse(v2) as DayLockState;
    } catch {
      // ignore
    }
    return blankState();
  });
  const [activeTab, setActiveTab] = useState<ViewTab>(() => {
    const hash = (window.location.hash || '#today').slice(1) as ViewTab;
    return NAV_ITEMS.some((n) => n.id === hash) ? hash : 'today';
  });

  const [user, setUser] = useState<User | null>(null);
  const [syncStatus, setSyncStatus] = useState<'local' | 'syncing' | 'synced' | 'error'>('local');
  const [searchText, setSearchText] = useState('');
  const [tradeFilter, setTradeFilter] = useState<TradeFilter>({ month: 'all', result: 'all', query: '' });

  // Modals
  const [tradeModalDate, setTradeModalDate] = useState<string | null>(null);
  const [goalModalOpen, setGoalModalOpen] = useState(false);
  const [editingGoal, setEditingGoal] = useState<LifeGoal | null>(null);
  const [downloadModalOpen, setDownloadModalOpen] = useState(false);

  // Toast
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const isOnline = useOnlineStatus();
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();

  const showToast = useCallback((msg: string) => {
    setToastMsg(msg);
  }, []);

  useEffect(() => {
    if (!toastMsg) return;
    const t = setTimeout(() => setToastMsg(null), 2800);
    return () => clearTimeout(t);
  }, [toastMsg]);

  // Hydrate best local memory (IndexedDB vs localStorage) on mount
  useEffect(() => {
    let mounted = true;
    loadBestLocalMemory().then((best) => {
      if (mounted) {
        setState(best);
      }
    });
    testFirestoreConnection();
    return () => {
      mounted = false;
    };
  }, []);

  // Sync hash navigation
  useEffect(() => {
    const onHash = () => {
      const h = (window.location.hash || '#today').slice(1) as ViewTab;
      if (NAV_ITEMS.some((n) => n.id === h)) {
        setActiveTab(h);
        window.scrollTo(0, 0);
      }
    };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const navigate = useCallback((tab: ViewTab) => {
    setActiveTab(tab);
    window.location.hash = `#${tab}`;
    window.scrollTo(0, 0);
  }, []);

  // Escape closes modals
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setTradeModalDate(null);
        setGoalModalOpen(false);
        setDownloadModalOpen(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Firebase Auth & Cloud Memory hydration
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (nextUser) => {
      setUser(nextUser);
      if (!nextUser) {
        setSyncStatus('local');
        return;
      }
      setSyncStatus('syncing');
      try {
        const cloud = await loadCloudState(nextUser);
        if (cloud) {
          // Merge if cloud has data, or push local if cloud is empty and local has data
          setState((local) => {
            const cloudHasData =
              cloud.trades.length > 0 ||
              cloud.lifeGoals.length > 0 ||
              Object.keys(cloud.days).length > 0;
            const localHasData =
              local.trades.length > 0 ||
              local.lifeGoals.length > 0 ||
              Object.keys(local.days).length > 0;

            if (!cloudHasData && localHasData) {
              pushAllLocalToCloud(nextUser, local).catch(() => setSyncStatus('error'));
              return local;
            }
            persistLocalMemory(cloud);
            return cloud;
          });
          setSyncStatus('synced');
        } else {
          // First-time cloud user: create workspace and push current local memory
          setState((local) => {
            pushAllLocalToCloud(nextUser, local)
              .then(() => setSyncStatus('synced'))
              .catch(() => setSyncStatus('error'));
            return local;
          });
        }
      } catch {
        setSyncStatus('error');
      }
    });
    return () => unsub();
  }, []);

  const updateLocal = useCallback((updater: (prev: DayLockState) => DayLockState) => {
    setState((prev) => {
      const next = { ...updater(prev), updatedAt: Date.now() };
      persistLocalMemory(next);
      return next;
    });
  }, []);

  // Cloud write helper
  const withCloud = useCallback(
    async (task: (u: User) => Promise<void>) => {
      if (!user) return;
      setSyncStatus('syncing');
      try {
        await ensureCloudWorkspace(user, state.settings);
        await task(user);
        setSyncStatus('synced');
      } catch {
        setSyncStatus('error');
      }
    },
    [user, state.settings]
  );

  // Handlers
  const handleSaveTrade = (tradeInput: Omit<Trade, 'id'>) => {
    const tk = todayKey();
    if (tradeInput.date === tk && getDayStatus(state, tk).locked) {
      showToast('Today is locked. Come back tomorrow.');
      setTradeModalDate(null);
      return;
    }

    const newTrade: Trade = { ...tradeInput, id: uid() };
    const existingDay = state.days[tradeInput.date] || {};
    const updatedDay = {
      ...existingDay,
      target: existingDay.target ?? targetFor(state, tradeInput.date),
      stop: existingDay.stop ?? stopFor(state, tradeInput.date),
      closed: !!existingDay.closed,
      reopened: !!existingDay.reopened,
      note: existingDay.note || '',
      checks: existingDay.checks || [],
    };

    const nextState: DayLockState = {
      ...state,
      updatedAt: Date.now(),
      days: { ...state.days, [tradeInput.date]: updatedDay },
      trades: [...state.trades, newTrade],
    };

    setState(nextState);
    persistLocalMemory(nextState);
    setTradeModalDate(null);

    if (tradeInput.date === tk) {
      const st = getDayStatus(nextState, tk);
      if (st.state === 'target') showToast('Target hit! Day locked.');
      else if (st.state === 'stop') showToast('Max loss reached. Day locked.');
      else if (st.state === 'limit') showToast('Trade limit reached. Day locked.');
      else showToast('Trade saved');
    } else {
      showToast('Trade saved');
    }

    withCloud(async (u) => {
      await upsertDayToCloud(u, tradeInput.date, updatedDay);
      await upsertTradeToCloud(u, newTrade, true);
    });
  };

  const handleDeleteTrade = (id: string) => {
    updateLocal((prev) => ({
      ...prev,
      trades: prev.trades.filter((t) => t.id !== id),
    }));
    showToast('Trade deleted');
    withCloud((u) => deleteTradeFromCloud(u, id));
  };

  const handleCloseDay = () => {
    const tk = todayKey();
    const existingDay = state.days[tk] || {};
    const updatedDay = {
      ...existingDay,
      target: existingDay.target ?? targetFor(state, tk),
      stop: existingDay.stop ?? stopFor(state, tk),
      closed: true,
      reopened: !!existingDay.reopened,
      note: existingDay.note || '',
      checks: existingDay.checks || [],
    };
    updateLocal((prev) => ({
      ...prev,
      days: { ...prev.days, [tk]: updatedDay },
    }));
    showToast('Day closed. See you tomorrow.');
    withCloud((u) => upsertDayToCloud(u, tk, updatedDay));
  };

  const handleReopenDay = () => {
    const tk = todayKey();
    const existingDay = state.days[tk] || {};
    const updatedDay = {
      ...existingDay,
      target: existingDay.target ?? targetFor(state, tk),
      stop: existingDay.stop ?? stopFor(state, tk),
      closed: false,
      reopened: true,
      note: existingDay.note || '',
      checks: existingDay.checks || [],
    };
    updateLocal((prev) => ({
      ...prev,
      days: { ...prev.days, [tk]: updatedDay },
    }));
    showToast('Day unlocked');
    withCloud((u) => upsertDayToCloud(u, tk, updatedDay));
  };

  const handleToggleCheck = (idx: number, checked: boolean) => {
    const tk = todayKey();
    const existingDay = state.days[tk] || {};
    const curChecks = existingDay.checks || [];
    const nextChecks = checked
      ? Array.from(new Set([...curChecks, idx]))
      : curChecks.filter((x) => x !== idx);
    const updatedDay = {
      ...existingDay,
      closed: !!existingDay.closed,
      reopened: !!existingDay.reopened,
      note: existingDay.note || '',
      checks: nextChecks,
    };
    updateLocal((prev) => ({
      ...prev,
      days: { ...prev.days, [tk]: updatedDay },
    }));
    withCloud((u) => upsertDayToCloud(u, tk, updatedDay));
  };

  const handleSaveDayNote = (date: string, note: string) => {
    const existingDay = state.days[date] || {};
    if ((existingDay.note || '') === note) return;
    const updatedDay = {
      ...existingDay,
      closed: !!existingDay.closed,
      reopened: !!existingDay.reopened,
      note,
      checks: existingDay.checks || [],
    };
    updateLocal((prev) => ({
      ...prev,
      days: { ...prev.days, [date]: updatedDay },
    }));
    showToast('Journal note saved');
    withCloud((u) => upsertDayToCloud(u, date, updatedDay));
  };

  const handleSaveSettings = (nextSettings: Settings) => {
    const tk = todayKey();
    const todayRecord = state.days[tk];
    const nextDays = { ...state.days };
    if (todayRecord) {
      nextDays[tk] = {
        ...todayRecord,
        target: null,
        stop: null,
      };
    }
    updateLocal((prev) => ({
      ...prev,
      settings: nextSettings,
      days: nextDays,
    }));
    withCloud(async (u) => {
      await syncWorkspaceSettingsToCloud(u, nextSettings);
      if (nextDays[tk]) await upsertDayToCloud(u, tk, nextDays[tk]);
    });
  };

  const handleSaveLifeGoal = (goalInput: Omit<LifeGoal, 'id' | 'createdAt'>, existingId?: string) => {
    const isNew = !existingId;
    const savedGoal: LifeGoal = existingId
      ? {
          ...goalInput,
          id: existingId,
          createdAt: state.lifeGoals.find((g) => g.id === existingId)?.createdAt || new Date().toISOString(),
        }
      : {
          ...goalInput,
          id: `goal_${uid()}`,
          createdAt: new Date().toISOString(),
        };

    updateLocal((prev) => ({
      ...prev,
      lifeGoals: isNew
        ? [savedGoal, ...prev.lifeGoals]
        : prev.lifeGoals.map((g) => (g.id === savedGoal.id ? savedGoal : g)),
    }));
    setGoalModalOpen(false);
    setEditingGoal(null);
    showToast(isNew ? 'Life goal added' : 'Life goal updated');
    withCloud((u) => upsertLifeGoalToCloud(u, savedGoal, isNew));
  };

  const handleUpdateLifeGoal = (updated: LifeGoal) => {
    updateLocal((prev) => ({
      ...prev,
      lifeGoals: prev.lifeGoals.map((g) => (g.id === updated.id ? updated : g)),
    }));
    withCloud((u) => upsertLifeGoalToCloud(u, updated, false));
  };

  const handleDeleteLifeGoal = (id: string) => {
    updateLocal((prev) => ({
      ...prev,
      lifeGoals: prev.lifeGoals.filter((g) => g.id !== id),
    }));
    showToast('Life goal removed');
    withCloud((u) => deleteLifeGoalFromCloud(u, id));
  };

  const handleLoadSample = () => {
    const sample = createSampleState(state.settings);
    setState(sample);
    persistLocalMemory(sample);
    showToast('Sample trades & life goals loaded');
    withCloud((u) => pushAllLocalToCloud(u, sample));
  };

  const handleClearDemo = () => {
    const cleared: DayLockState = {
      ...blankState(),
      settings: state.settings,
    };
    setState(cleared);
    persistLocalMemory(cleared);
    showToast('Sample data cleared. Ready for your real trades.');
  };

  const handleWipeAll = () => {
    const wiped: DayLockState = {
      ...blankState(),
      settings: state.settings,
    };
    setState(wiped);
    persistLocalMemory(wiped);
    showToast('All local trades and goals erased');
  };

  const handleRestoreBackup = (restored: DayLockState) => {
    setState(restored);
    persistLocalMemory(restored);
    withCloud((u) => pushAllLocalToCloud(u, restored));
  };

  const handleCloudAuth = async () => {
    if (user) {
      await signOutFromCloud();
      showToast('Signed out. Local memory remains active.');
      return;
    }
    try {
      await signInWithGoogle();
      showToast('Signed in — cloud memory synced');
    } catch {
      showToast('Google sign-in cancelled');
    }
  };

  // Sidebar monthly progress & initials
  const tk = todayKey();
  const c = state.settings.currency || '$';
  const monthNet = useMemo(() => sumRange(state, `${tk.slice(0, 8)}01`, `${tk.slice(0, 8)}31`), [state, tk]);
  const monthGoal = Number(state.settings.monthGoal) || 0;
  const monthPct = monthGoal > 0 ? Math.max(0, Math.min(1, monthNet / monthGoal)) : 0;
  const activeGoalsCount = state.lifeGoals.filter((g) => !g.completed).length;
  const todayTradesCount = state.trades.filter((t) => t.date === tk).length;
  const initials = (state.settings.displayName || 'AK')
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() || '')
    .join('');

  return (
    <div className="min-h-screen pb-[76px] md:pb-6">
      <div className="ocean-backdrop" aria-hidden="true" />
      <div className="max-w-[1380px] mx-auto px-2.5 sm:px-5 pt-2.5 sm:pt-4 grid grid-cols-1 md:grid-cols-[248px_minmax(0,1fr)] gap-3 sm:gap-4">
        {/* Desktop Sidebar */}
        <aside className="hidden md:flex flex-col sticky top-4 self-start h-[calc(100vh-32px)] min-h-[580px] rounded-[26px] p-4 glass-dark text-[#eaf6fb] shadow-2xl">
          <div className="flex items-center gap-3 px-1.5 pb-4">
            <div className="w-10 h-10 rounded-xl bg-white/15 border border-white/25 flex items-center justify-center shrink-0">
              <Lock className="w-5 h-5 text-white" />
            </div>
            <div className="min-w-0">
              <span className="font-display text-2xl font-semibold tracking-wide leading-none block">
                Day<span className="text-[#ff6a1a]">Lock</span>
              </span>
              <span className="text-[11px] text-[#eaf6fb]/70 truncate block mt-0.5">
                {state.settings.displayName}
              </span>
            </div>
          </div>

          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#eaf6fb]/55 px-2.5 pb-1.5">
            Workspace
          </p>
          <nav className="space-y-1 flex-1" aria-label="Main navigation">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const active = activeTab === item.id;
              const count = item.id === 'trades' ? todayTradesCount : item.id === 'lifegoals' ? activeGoalsCount : 0;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => navigate(item.id)}
                  aria-current={active ? 'page' : undefined}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] font-medium transition-colors whitespace-nowrap ${
                    active
                      ? 'bg-gradient-to-b from-[#1ea1ff] to-[#0f7fe0] text-white shadow-lg shadow-[#1590f0]/40 border border-white/30'
                      : 'text-[#eaf6fb]/90 hover:bg-white/10 border border-transparent'
                  }`}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  <span>{item.label}</span>
                  {count > 0 && (
                    <span className="ml-auto text-[11px] font-bold font-mono-num px-1.5 py-0.5 rounded-md bg-white/15">
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>

          {/* Install / Download App Action */}
          <div className="mt-3 space-y-2">
            <button
              type="button"
              onClick={() => {
                if (isInstallable) {
                  install().then((ok) => {
                    if (ok) showToast('DayLock app installed');
                  });
                } else {
                  setDownloadModalOpen(true);
                }
              }}
              className="w-full h-10 px-3 rounded-xl bg-[#ff6a1a] hover:bg-[#e85a0d] text-white text-xs font-semibold flex items-center justify-center gap-2 transition-colors whitespace-nowrap"
            >
              <Download className="w-4 h-4 shrink-0" />
              {isInstallable ? 'Install App' : 'Download App & Data'}
            </button>

            <div className="p-3 rounded-2xl bg-white/[0.07] border border-white/15">
              <div className="flex justify-between text-[11px] text-[#eaf6fb]/75">
                <span>Month goal</span>
                <strong className="text-white font-mono-num">{Math.round(monthPct * 100)}%</strong>
              </div>
              <div className="h-1.5 rounded-full bg-white/15 overflow-hidden mt-2">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-[#25b6f0] to-[#5ee0ff]"
                  style={{ width: `${monthPct * 100}%` }}
                />
              </div>
              <div className="flex justify-between text-[11px] text-[#eaf6fb]/70 mt-2 font-mono-num">
                <span>{money(monthNet, c, { sign: true, dec: 0 })}</span>
                <span>of {money(monthGoal, c, { dec: 0 })}</span>
              </div>
            </div>
          </div>
        </aside>

        {/* Main Column */}
        <div className="min-w-0 flex flex-col gap-3.5">
          {/* Top Bar */}
          <header className="rounded-2xl px-2.5 sm:px-3 py-2 glass-dark text-[#eaf6fb] flex items-center gap-2 sm:gap-2.5">
            <div className="md:hidden flex items-center gap-2 shrink-0 pr-1">
              <div className="w-9 h-9 rounded-xl bg-white/15 border border-white/25 flex items-center justify-center">
                <Lock className="w-4 h-4 text-white" />
              </div>
              <span className="font-display text-lg font-semibold tracking-wide leading-none text-white">
                Day<span className="text-[#ff6a1a]">Lock</span>
              </span>
            </div>

            <label className="flex-1 min-w-0 flex items-center gap-2 px-2.5 sm:px-3 h-10 rounded-xl bg-white/10 border border-white/15 focus-within:border-white/40">
              <Search className="w-4 h-4 text-[#eaf6fb]/70 shrink-0" />
              <span className="sr-only">Search trades</span>
              <input
                type="search"
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    setTradeFilter({ month: 'all', result: 'all', query: searchText });
                    navigate('trades');
                  }
                }}
                placeholder="Search trades..."
                className="w-full min-w-0 bg-transparent border-0 outline-0 text-xs sm:text-sm text-white placeholder:text-[#eaf6fb]/60"
              />
            </label>

            <span className="hidden lg:inline text-xs text-[#eaf6fb]/80 whitespace-nowrap px-2">
              {longDate(tk)}
            </span>

            {/* Download App / Exports quick button */}
            <button
              type="button"
              onClick={() => setDownloadModalOpen(true)}
              className="h-10 px-3 rounded-xl bg-white/10 hover:bg-white/20 border border-white/15 text-xs font-semibold text-white inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors"
            >
              <Download className="w-4 h-4" />
              <span className="hidden sm:inline">{isInstalled ? 'Backups' : 'Download'}</span>
            </button>

            {/* Memory / Cloud Sync Auth button */}
            <button
              type="button"
              onClick={handleCloudAuth}
              className="h-10 px-3 rounded-xl bg-white/10 hover:bg-white/20 border border-white/15 text-xs font-semibold text-white inline-flex items-center gap-2 whitespace-nowrap shrink-0 transition-colors"
              title={user ? `Synced as ${user.email}. Click to sign out.` : 'Sign in with Google to sync memory across devices'}
            >
              {!isOnline ? (
                <>
                  <CloudOff className="w-4 h-4 text-[#ff6a1a]" />
                  <span className="hidden sm:inline">Offline memory</span>
                </>
              ) : user ? (
                <>
                  <Cloud className={`w-4 h-4 ${syncStatus === 'error' ? 'text-[#ff6a1a]' : 'text-[#35d6a1]'}`} />
                  <span className="hidden sm:inline">
                    {syncStatus === 'syncing' ? 'Syncing…' : 'Cloud synced'}
                  </span>
                  <LogOut className="w-3.5 h-3.5 opacity-70" />
                </>
              ) : (
                <>
                  <LogIn className="w-4 h-4 text-[#5ee0ff]" />
                  <span className="hidden sm:inline">Sync Cloud</span>
                </>
              )}
            </button>

            <div className="hidden xl:flex items-center gap-2.5 pl-1 shrink-0">
              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#25b6f0] to-[#0b6f8a] border border-white/50 flex items-center justify-center text-xs font-bold text-white">
                {initials || 'DL'}
              </div>
              <div className="leading-tight">
                <p className="text-xs font-semibold text-white">{state.settings.displayName}</p>
                <p className="text-[10px] text-[#eaf6fb]/65">Day trader</p>
              </div>
            </div>
          </header>

          {/* Main Frosted Work Panel */}
          <main className="glass-panel rounded-[22px] sm:rounded-[26px] p-3.5 sm:p-6 min-w-0">
            <div key={activeTab} className="animate-view">
              {activeTab === 'today' && (
              <TodayView
                state={state}
                onOpenTrade={(d) => setTradeModalDate(d)}
                onDeleteTrade={handleDeleteTrade}
                onCloseDay={handleCloseDay}
                onReopenDay={handleReopenDay}
                onToggleCheck={handleToggleCheck}
                onLoadSample={handleLoadSample}
                onClearDemo={handleClearDemo}
                onNavigate={navigate}
                onOpenNewGoal={() => {
                  setEditingGoal(null);
                  setGoalModalOpen(true);
                }}
                onToast={showToast}
              />
            )}

            {activeTab === 'trades' && (
              <TradesView
                state={state}
                filter={tradeFilter}
                onChangeFilter={setTradeFilter}
                onOpenTrade={(d) => setTradeModalDate(d)}
                onDeleteTrade={handleDeleteTrade}
                onToast={showToast}
              />
            )}

            {activeTab === 'calendar' && (
              <CalendarView
                state={state}
                onOpenTrade={(d) => setTradeModalDate(d)}
                onDeleteTrade={handleDeleteTrade}
                onSaveDayNote={handleSaveDayNote}
              />
            )}

            {activeTab === 'insights' && <InsightsView state={state} />}

            {activeTab === 'lifegoals' && (
              <LifeGoalsView
                state={state}
                onAddGoal={() => {
                  setEditingGoal(null);
                  setGoalModalOpen(true);
                }}
                onEditGoal={(goal) => {
                  setEditingGoal(goal);
                  setGoalModalOpen(true);
                }}
                onUpdateGoal={handleUpdateLifeGoal}
                onDeleteGoal={handleDeleteLifeGoal}
                onToast={showToast}
              />
            )}

              {activeTab === 'rules' && (
                <GoalsRulesView
                  state={state}
                  onSaveSettings={handleSaveSettings}
                  onOpenDownloadCenter={() => setDownloadModalOpen(true)}
                  onWipeAll={handleWipeAll}
                  onToast={showToast}
                />
              )}
            </div>
          </main>
        </div>
      </div>

      {/* Mobile Bottom Tab Bar (<= 15% viewport height, 44px+ hitboxes) */}
      <nav
        className="md:hidden fixed bottom-0 left-0 right-0 z-40 glass-dark border-t border-white/15 px-1 pt-1 pb-[max(4px,env(safe-area-inset-bottom,0px))] grid grid-cols-6 items-center"
        aria-label="Mobile navigation"
      >
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const active = activeTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => navigate(item.id)}
              className={`min-h-[46px] flex flex-col items-center justify-center gap-0.5 rounded-xl text-[10px] font-medium tap-press ${
                active ? 'bg-[#1590f0] text-white' : 'text-[#eaf6fb]/80'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span className="truncate max-w-full px-0.5">{item.shortLabel}</span>
            </button>
          );
        })}
      </nav>

      {/* Modals */}
      <TradeModal
        open={tradeModalDate !== null}
        defaultDate={tradeModalDate || tk}
        currency={c}
        onClose={() => setTradeModalDate(null)}
        onSave={handleSaveTrade}
        onToast={showToast}
      />

      <LifeGoalModal
        key={editingGoal?.id || (goalModalOpen ? 'new' : 'closed')}
        open={goalModalOpen}
        editingGoal={editingGoal}
        defaultCurrency={c}
        onClose={() => {
          setGoalModalOpen(false);
          setEditingGoal(null);
        }}
        onSave={handleSaveLifeGoal}
      />

      <DownloadCenterModal
        open={downloadModalOpen}
        onClose={() => setDownloadModalOpen(false)}
        state={state}
        isInstallable={isInstallable}
        isInstalled={isInstalled}
        isIOS={isIOS}
        onInstallApp={install}
        onRestoreBackup={handleRestoreBackup}
        onToast={showToast}
      />

      {/* Offline Banner */}
      {!isOnline && (
        <div className="fixed bottom-20 md:bottom-5 left-4 z-40 px-3.5 py-2 rounded-xl bg-[#0a1c2e] text-white text-xs font-semibold shadow-lg border border-white/20">
          Offline mode — changes are saved in device memory
        </div>
      )}

      {/* Toast */}
      {toastMsg && (
        <div
          role="status"
          className="fixed left-1/2 bottom-20 md:bottom-6 z-50 px-5 py-2.5 rounded-full bg-[#0a1c2e] text-white text-xs font-semibold shadow-xl border border-white/15 whitespace-nowrap animate-toast"
        >
          {toastMsg}
        </div>
      )}
    </div>
  );
}

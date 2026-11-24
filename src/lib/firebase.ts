import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, type User } from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocFromServer,
  getDocs,
  getFirestore,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
import { DayLockState, DayRecord, LifeGoal, Settings, Trade } from '../types';
import { defaultSettings, normalizeState } from './domain';

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);
const googleProvider = new GoogleAuthProvider();

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error:', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export async function testFirestoreConnection(): Promise<boolean> {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    return true;
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Firestore connectivity check failed: client is offline.');
      return false;
    }
    return true;
  }
}

export async function signInWithGoogle(): Promise<User> {
  const res = await signInWithPopup(auth, googleProvider);
  return res.user;
}

export async function signOutFromCloud(): Promise<void> {
  await signOut(auth);
}

const safeId = (s: string) => s.replace(/[^a-zA-Z0-9_\-]/g, '_').slice(0, 64) || 'item';

function sanitizeSettings(s: Settings): Settings {
  const def = defaultSettings();
  return {
    displayName: (s.displayName || def.displayName).trim().slice(0, 80) || 'Trader',
    currency: (s.currency || '$').trim().slice(0, 4) || '$',
    balance: Number.isFinite(Number(s.balance)) && Number(s.balance) >= 0 ? Number(s.balance) : 0,
    unit: s.unit === 'pct' ? 'pct' : 'amount',
    target: Number.isFinite(Number(s.target)) && Number(s.target) >= 0 ? Number(s.target) : 0,
    stop: Number.isFinite(Number(s.stop)) && Number(s.stop) >= 0 ? Number(s.stop) : 0,
    maxTrades: Number.isFinite(Number(s.maxTrades)) ? Math.max(0, Math.min(500, Math.floor(Number(s.maxTrades)))) : 4,
    riskPct: Number.isFinite(Number(s.riskPct)) ? Math.max(0, Math.min(100, Number(s.riskPct))) : 1,
    pipValue: Number.isFinite(Number(s.pipValue)) && Number(s.pipValue) >= 0 ? Number(s.pipValue) : 10,
    weekGoal: Number.isFinite(Number(s.weekGoal)) && Number(s.weekGoal) >= 0 ? Number(s.weekGoal) : 0,
    monthGoal: Number.isFinite(Number(s.monthGoal)) && Number(s.monthGoal) >= 0 ? Number(s.monthGoal) : 0,
    rules: (s.rules || []).map((r) => r.trim().slice(0, 140)).filter(Boolean).slice(0, 20),
    why: (s.why || '').trim().slice(0, 500),
  };
}

function buildWorkspacePayload(user: User, settings: Settings, isCreate: boolean) {
  const clean = sanitizeSettings(settings);
  const firestoreSettings = {
    currency: clean.currency,
    balance: clean.balance,
    unit: clean.unit,
    target: clean.target,
    stop: clean.stop,
    maxTrades: clean.maxTrades,
    riskPct: clean.riskPct,
    pipValue: clean.pipValue,
    weekGoal: clean.weekGoal,
    monthGoal: clean.monthGoal,
    rules: clean.rules,
    why: clean.why,
  };
  if (isCreate) {
    return {
      userId: user.uid,
      displayName: clean.displayName,
      email: (user.email || '').slice(0, 160),
      settings: firestoreSettings,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
  }
  return {
    displayName: clean.displayName,
    email: (user.email || '').slice(0, 160),
    settings: firestoreSettings,
    updatedAt: serverTimestamp(),
  };
}

export async function ensureCloudWorkspace(user: User, settings: Settings): Promise<boolean> {
  const path = `users/${user.uid}`;
  const ref = doc(db, 'users', user.uid);
  try {
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      await setDoc(ref, buildWorkspacePayload(user, settings, true));
      return true;
    }
    return false;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function syncWorkspaceSettingsToCloud(user: User, settings: Settings): Promise<void> {
  const path = `users/${user.uid}`;
  const ref = doc(db, 'users', user.uid);
  try {
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      await setDoc(ref, buildWorkspacePayload(user, settings, true));
    } else {
      await updateDoc(ref, buildWorkspacePayload(user, settings, false));
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function upsertTradeToCloud(user: User, trade: Trade, isNew: boolean): Promise<void> {
  const id = safeId(trade.id);
  const path = `users/${user.uid}/trades/${id}`;
  const ref = doc(db, 'users', user.uid, 'trades', id);
  const baseFields = {
    date: trade.date.slice(0, 10),
    time: (trade.time || '').slice(0, 10),
    symbol: (trade.symbol || 'TRADE').trim().toUpperCase().slice(0, 20),
    side: trade.side === 'Sell' ? 'Sell' : 'Buy',
    lots: trade.lots != null && Number.isFinite(trade.lots) ? Math.max(0, trade.lots) : null,
    entry: trade.entry != null && Number.isFinite(trade.entry) ? trade.entry : null,
    exit: trade.exit != null && Number.isFinite(trade.exit) ? trade.exit : null,
    pnl: Number.isFinite(trade.pnl) ? trade.pnl : 0,
    setup: (trade.setup || 'Other').slice(0, 40),
    note: (trade.note || '').slice(0, 500),
    updatedAt: serverTimestamp(),
  };
  try {
    if (isNew) {
      await setDoc(ref, {
        userId: user.uid,
        id,
        ...baseFields,
        createdAt: serverTimestamp(),
      });
    } else {
      const snap = await getDoc(ref);
      if (!snap.exists()) {
        await setDoc(ref, { userId: user.uid, id, ...baseFields, createdAt: serverTimestamp() });
      } else {
        await updateDoc(ref, baseFields);
      }
    }
  } catch (error) {
    handleFirestoreError(error, isNew ? OperationType.CREATE : OperationType.UPDATE, path);
  }
}

export async function deleteTradeFromCloud(user: User, tradeId: string): Promise<void> {
  const id = safeId(tradeId);
  const path = `users/${user.uid}/trades/${id}`;
  try {
    await deleteDoc(doc(db, 'users', user.uid, 'trades', id));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function upsertDayToCloud(user: User, dayKey: string, record: DayRecord): Promise<void> {
  const path = `users/${user.uid}/days/${dayKey}`;
  const ref = doc(db, 'users', user.uid, 'days', dayKey);
  const baseFields = {
    target: record.target != null && Number.isFinite(record.target) ? Math.max(0, record.target) : null,
    stop: record.stop != null && Number.isFinite(record.stop) ? Math.max(0, record.stop) : null,
    closed: !!record.closed,
    reopened: !!record.reopened,
    note: (record.note || '').slice(0, 1000),
    checks: Array.isArray(record.checks) ? record.checks.filter((x) => typeof x === 'number').slice(0, 25) : [],
    updatedAt: serverTimestamp(),
  };
  try {
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      await setDoc(ref, {
        userId: user.uid,
        date: dayKey,
        ...baseFields,
        createdAt: serverTimestamp(),
      });
    } else {
      await updateDoc(ref, baseFields);
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function upsertLifeGoalToCloud(user: User, goal: LifeGoal, isNew: boolean): Promise<void> {
  const id = safeId(goal.id);
  const path = `users/${user.uid}/lifeGoals/${id}`;
  const ref = doc(db, 'users', user.uid, 'lifeGoals', id);
  const baseFields = {
    title: (goal.title || 'Untitled Goal').trim().slice(0, 120),
    category: (goal.category || 'Financial').trim().slice(0, 40),
    priority: goal.priority === 'High' || goal.priority === 'Low' ? goal.priority : 'Medium',
    deadline: goal.deadline.slice(0, 10),
    progressType: goal.progressType === 'milestones' ? 'milestones' : 'numeric',
    currentValue: Number.isFinite(goal.currentValue) ? goal.currentValue : 0,
    targetValue: Number.isFinite(goal.targetValue) ? goal.targetValue : 100,
    unit: (goal.unit || '').slice(0, 20),
    milestones: (goal.milestones || []).slice(0, 20).map((m) => ({
      id: safeId(m.id),
      label: String(m.label || '').slice(0, 140),
      done: !!m.done,
    })),
    completed: !!goal.completed,
    completedAt: goal.completedAt ? goal.completedAt.slice(0, 30) : null,
    note: (goal.note || '').slice(0, 600),
    updatedAt: serverTimestamp(),
  };
  try {
    if (isNew) {
      await setDoc(ref, {
        userId: user.uid,
        id,
        ...baseFields,
        createdAt: serverTimestamp(),
      });
    } else {
      const snap = await getDoc(ref);
      if (!snap.exists()) {
        await setDoc(ref, { userId: user.uid, id, ...baseFields, createdAt: serverTimestamp() });
      } else {
        await updateDoc(ref, baseFields);
      }
    }
  } catch (error) {
    handleFirestoreError(error, isNew ? OperationType.CREATE : OperationType.UPDATE, path);
  }
}

export async function deleteLifeGoalFromCloud(user: User, goalId: string): Promise<void> {
  const id = safeId(goalId);
  const path = `users/${user.uid}/lifeGoals/${id}`;
  try {
    await deleteDoc(doc(db, 'users', user.uid, 'lifeGoals', id));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function loadCloudState(user: User): Promise<DayLockState | null> {
  const userPath = `users/${user.uid}`;
  try {
    const userSnap = await getDoc(doc(db, 'users', user.uid));
    if (!userSnap.exists()) return null;

    const userData = userSnap.data();
    const [tradesSnap, daysSnap, goalsSnap] = await Promise.all([
      getDocs(collection(db, 'users', user.uid, 'trades')),
      getDocs(collection(db, 'users', user.uid, 'days')),
      getDocs(collection(db, 'users', user.uid, 'lifeGoals')),
    ]);

    const trades: Trade[] = tradesSnap.docs.map((d) => {
      const x = d.data();
      return {
        id: String(x.id || d.id),
        date: String(x.date),
        time: String(x.time || ''),
        symbol: String(x.symbol || 'TRADE'),
        side: x.side === 'Sell' ? 'Sell' : 'Buy',
        lots: typeof x.lots === 'number' ? x.lots : null,
        entry: typeof x.entry === 'number' ? x.entry : null,
        exit: typeof x.exit === 'number' ? x.exit : null,
        pnl: typeof x.pnl === 'number' ? x.pnl : 0,
        setup: String(x.setup || 'Other'),
        note: String(x.note || ''),
      };
    });

    const days: Record<string, DayRecord> = {};
    daysSnap.docs.forEach((d) => {
      const x = d.data();
      days[d.id] = {
        target: typeof x.target === 'number' ? x.target : null,
        stop: typeof x.stop === 'number' ? x.stop : null,
        closed: !!x.closed,
        reopened: !!x.reopened,
        note: typeof x.note === 'string' ? x.note : '',
        checks: Array.isArray(x.checks) ? x.checks : [],
      };
    });

    const lifeGoals: LifeGoal[] = goalsSnap.docs.map((d) => {
      const x = d.data();
      return {
        id: String(x.id || d.id),
        title: String(x.title || ''),
        category: String(x.category || 'Financial'),
        priority: x.priority === 'High' || x.priority === 'Low' ? x.priority : 'Medium',
        deadline: String(x.deadline),
        progressType: x.progressType === 'milestones' ? 'milestones' : 'numeric',
        currentValue: typeof x.currentValue === 'number' ? x.currentValue : 0,
        targetValue: typeof x.targetValue === 'number' ? x.targetValue : 100,
        unit: String(x.unit || ''),
        milestones: Array.isArray(x.milestones) ? x.milestones : [],
        completed: !!x.completed,
        completedAt: x.completedAt ? String(x.completedAt) : null,
        note: String(x.note || ''),
        createdAt: new Date().toISOString(),
      };
    });

    return normalizeState({
      v: 2,
      updatedAt: Date.now(),
      demo: false,
      settings: {
        ...(userData.settings || {}),
        displayName: userData.displayName || user.displayName || 'Trader',
      },
      days,
      trades,
      lifeGoals,
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, userPath);
  }
}

export async function pushAllLocalToCloud(user: User, state: DayLockState): Promise<void> {
  const path = `users/${user.uid}`;
  try {
    const batch = writeBatch(db);
    const userRef = doc(db, 'users', user.uid);
    const existingSnap = await getDoc(userRef);
    batch.set(userRef, buildWorkspacePayload(user, state.settings, !existingSnap.exists()), { merge: true });

    state.trades.forEach((t) => {
      const id = safeId(t.id);
      const ref = doc(db, 'users', user.uid, 'trades', id);
      batch.set(ref, {
        userId: user.uid,
        id,
        date: t.date.slice(0, 10),
        time: (t.time || '').slice(0, 10),
        symbol: (t.symbol || 'TRADE').trim().toUpperCase().slice(0, 20),
        side: t.side === 'Sell' ? 'Sell' : 'Buy',
        lots: t.lots ?? null,
        entry: t.entry ?? null,
        exit: t.exit ?? null,
        pnl: t.pnl,
        setup: (t.setup || 'Other').slice(0, 40),
        note: (t.note || '').slice(0, 500),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    });

    Object.entries(state.days).forEach(([dayKey, rec]) => {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(dayKey)) return;
      const ref = doc(db, 'users', user.uid, 'days', dayKey);
      batch.set(ref, {
        userId: user.uid,
        date: dayKey,
        target: rec.target ?? null,
        stop: rec.stop ?? null,
        closed: !!rec.closed,
        reopened: !!rec.reopened,
        note: (rec.note || '').slice(0, 1000),
        checks: Array.isArray(rec.checks) ? rec.checks.slice(0, 25) : [],
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    });

    state.lifeGoals.forEach((g) => {
      const id = safeId(g.id);
      const ref = doc(db, 'users', user.uid, 'lifeGoals', id);
      batch.set(ref, {
        userId: user.uid,
        id,
        title: (g.title || 'Goal').trim().slice(0, 120),
        category: (g.category || 'Financial').trim().slice(0, 40),
        priority: g.priority === 'High' || g.priority === 'Low' ? g.priority : 'Medium',
        deadline: g.deadline.slice(0, 10),
        progressType: g.progressType === 'milestones' ? 'milestones' : 'numeric',
        currentValue: g.currentValue,
        targetValue: g.targetValue,
        unit: (g.unit || '').slice(0, 20),
        milestones: (g.milestones || []).slice(0, 20),
        completed: !!g.completed,
        completedAt: g.completedAt ? g.completedAt.slice(0, 30) : null,
        note: (g.note || '').slice(0, 600),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    });

    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

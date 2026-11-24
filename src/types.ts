export type Side = 'Buy' | 'Sell';
export type TradeResult = 'win' | 'loss' | 'be';
export type TargetUnit = 'amount' | 'pct';
export type GoalPriority = 'High' | 'Medium' | 'Low';
export type GoalProgressType = 'numeric' | 'milestones';
export type ViewTab = 'today' | 'trades' | 'calendar' | 'insights' | 'lifegoals' | 'rules';

export interface Trade {
  id: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:MM
  symbol: string;
  side: Side;
  lots: number | null;
  entry: number | null;
  exit: number | null;
  pnl: number;
  setup: string;
  note: string;
}

export interface DayRecord {
  target?: number | null;
  stop?: number | null;
  closed?: boolean;
  reopened?: boolean;
  note?: string;
  checks?: number[];
}

export interface Settings {
  displayName: string;
  currency: string;
  balance: number;
  unit: TargetUnit;
  target: number;
  stop: number;
  maxTrades: number;
  riskPct: number;
  pipValue: number;
  weekGoal: number;
  monthGoal: number;
  rules: string[];
  why: string;
}

export interface GoalMilestone {
  id: string;
  label: string;
  done: boolean;
}

export interface LifeGoal {
  id: string;
  title: string;
  category: string;
  priority: GoalPriority;
  deadline: string; // YYYY-MM-DD
  progressType: GoalProgressType;
  currentValue: number;
  targetValue: number;
  unit: string;
  milestones: GoalMilestone[];
  completed: boolean;
  completedAt: string | null;
  note: string;
  createdAt: string;
}

export interface DayLockState {
  v: number;
  updatedAt: number;
  demo: boolean;
  settings: Settings;
  days: Record<string, DayRecord>;
  trades: Trade[];
  lifeGoals: LifeGoal[];
}

export interface TradeFilter {
  month: string;
  result: 'all' | 'win' | 'loss' | 'be';
  query: string;
}

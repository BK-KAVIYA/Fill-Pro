// ============================================================
// FILL PRO — Zustand Stores
// ============================================================

import { create } from 'zustand';
import type {
  ScanResult,
  FieldDescriptor,
  TestDataContext,
  ExecutionReport,
  AppSettings,
  FillResult,
  ExecutionProgressEvent,
} from '../types/index.js';
import { DEFAULT_SETTINGS } from '../constants/defaults.js';

// ---- Scan Store ----
interface ScanState {
  scanResult: ScanResult | null;
  isScanning: boolean;
  scanError: string | null;
  setScanResult: (result: ScanResult) => void;
  setIsScanning: (val: boolean) => void;
  setScanError: (err: string | null) => void;
  clearScan: () => void;
}

export const useScanStore = create<ScanState>((set) => ({
  scanResult: null,
  isScanning: false,
  scanError: null,
  setScanResult: (result) => set({ scanResult: result, scanError: null }),
  setIsScanning: (val) => set({ isScanning: val }),
  setScanError: (err) => set({ scanError: err }),
  clearScan: () => set({ scanResult: null, scanError: null }),
}));

// ---- Execution Store ----
interface ExecutionState {
  isExecuting: boolean;
  progress: ExecutionProgressEvent | null;
  report: ExecutionReport | null;
  fieldResults: FillResult[];
  setIsExecuting: (val: boolean) => void;
  setProgress: (p: ExecutionProgressEvent) => void;
  setReport: (r: ExecutionReport) => void;
  addFieldResult: (r: FillResult) => void;
  reset: () => void;
}

export const useExecutionStore = create<ExecutionState>((set) => ({
  isExecuting: false,
  progress: null,
  report: null,
  fieldResults: [],
  setIsExecuting: (val) => set({ isExecuting: val }),
  setProgress: (p) => set({ progress: p }),
  setReport: (r) => set({ report: r }),
  addFieldResult: (r) => set((s) => ({ fieldResults: [...s.fieldResults, r] })),
  reset: () => set({ isExecuting: false, progress: null, report: null, fieldResults: [] }),
}));

// ---- Settings Store ----
interface SettingsState {
  settings: AppSettings;
  updateSettings: (patch: Partial<AppSettings>) => void;
  loadSettings: (settings: AppSettings) => void;
}

export const useSettingsStore = create<SettingsState>((set) => ({
  settings: DEFAULT_SETTINGS,
  updateSettings: (patch) => set((s) => ({ settings: { ...s.settings, ...patch } })),
  loadSettings: (settings) => set({ settings }),
}));

// ---- AI Store ----
interface AIState {
  isAIEnabled: boolean;
  apiKey: string | null;
  model: string;
  isConnected: boolean | null;
  connectionError: string | null;
  requestCount: number;
  setApiKey: (key: string | null) => void;
  setModel: (model: string) => void;
  setIsAIEnabled: (val: boolean) => void;
  setConnectionStatus: (connected: boolean, error?: string) => void;
  incrementRequestCount: () => void;
  reset: () => void;
}

export const useAIStore = create<AIState>((set) => ({
  isAIEnabled: false,
  apiKey: null,
  model: 'gemini-1.5-flash',
  isConnected: null,
  connectionError: null,
  requestCount: 0,
  setApiKey: (key) => set({ apiKey: key }),
  setModel: (model) => set({ model }),
  setIsAIEnabled: (val) => set({ isAIEnabled: val }),
  setConnectionStatus: (connected, error) => set({ isConnected: connected, connectionError: error ?? null }),
  incrementRequestCount: () => set((s) => ({ requestCount: s.requestCount + 1 })),
  reset: () => set({ isConnected: null, connectionError: null, requestCount: 0 }),
}));

// ---- UI Store ----
interface UIState {
  theme: 'light' | 'dark';
  activeTab: string;
  selectedFieldId: string | null;
  highlightedFieldId: string | null;
  setTheme: (t: 'light' | 'dark') => void;
  setActiveTab: (tab: string) => void;
  setSelectedFieldId: (id: string | null) => void;
  setHighlightedFieldId: (id: string | null) => void;
}

export const useUIStore = create<UIState>((set) => ({
  theme: 'dark',
  activeTab: 'dashboard',
  selectedFieldId: null,
  highlightedFieldId: null,
  setTheme: (t) => set({ theme: t }),
  setActiveTab: (tab) => set({ activeTab: tab }),
  setSelectedFieldId: (id) => set({ selectedFieldId: id }),
  setHighlightedFieldId: (id) => set({ highlightedFieldId: id }),
}));

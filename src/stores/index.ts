// ============================================================
// FILL PRO — Zustand Stores
// ============================================================

import { create } from 'zustand';
import type {
  ScanResult,
  ExecutionReport,
  AppSettings,
  FillResult,
  ExecutionProgressEvent,
  GenerationMode,
  SmartFillStage,
  ResolutionStats,
  SemanticCategory,
} from '../types/index.js';
import type { ResolvedField } from '../ai/intelligenceRouter.js';
import type { SmartFillPlan } from '../ai/smartFillOrchestrator.js';
import { DEFAULT_SETTINGS } from '../constants/defaults.js';

// ---- Scan Store ----
interface ScanState {
  scanResult: ScanResult | null;
  resolvedFields: ResolvedField[];
  resolutionStats: ResolutionStats | null;
  formPurpose: string | null;
  businessDomain: string | null;
  suggestedLocale: string | null;
  formFingerprint: string | null;
  smartFillPlan: SmartFillPlan | null;
  proposedValues: Record<string, unknown>;
  excludedFieldIds: string[];
  isScanning: boolean;
  scanError: string | null;
  setScanResult: (result: ScanResult) => void;
  setSmartFillPlan: (plan: SmartFillPlan) => void;
  setProposedValue: (fieldId: string, value: unknown) => void;
  toggleExcludeField: (fieldId: string) => void;
  updateFieldSemanticType: (fieldId: string, semanticType: string, semanticCategory: SemanticCategory) => void;
  setIsScanning: (val: boolean) => void;
  setScanError: (err: string | null) => void;
  clearScan: () => void;
}

export const useScanStore = create<ScanState>((set) => ({
  scanResult: null,
  resolvedFields: [],
  resolutionStats: null,
  formPurpose: null,
  businessDomain: null,
  suggestedLocale: null,
  formFingerprint: null,
  smartFillPlan: null,
  proposedValues: {},
  excludedFieldIds: [],
  isScanning: false,
  scanError: null,
  setScanResult: (result) =>
    set({
      scanResult: result,
      resolvedFields: result.fields.map(f => ({
        ...f,
        resolutionSource: f.classificationSource === 'native' ? 'native' : 'heuristic',
      })),
      scanError: null,
    }),
  setSmartFillPlan: (plan) =>
    set({
      smartFillPlan: plan,
      resolvedFields: plan.resolvedFields,
      resolutionStats: plan.stats,
      formPurpose: plan.formPurpose,
      businessDomain: plan.businessDomain,
      suggestedLocale: plan.suggestedLocale ?? null,
      formFingerprint: plan.formFingerprint,
      proposedValues: { ...plan.proposedValues },
    }),
  setProposedValue: (fieldId, value) =>
    set((s) => ({
      proposedValues: { ...s.proposedValues, [fieldId]: value },
      smartFillPlan: s.smartFillPlan
        ? {
            ...s.smartFillPlan,
            proposedValues: { ...s.smartFillPlan.proposedValues, [fieldId]: value },
          }
        : null,
    })),
  toggleExcludeField: (fieldId) =>
    set((s) => ({
      excludedFieldIds: s.excludedFieldIds.includes(fieldId)
        ? s.excludedFieldIds.filter(id => id !== fieldId)
        : [...s.excludedFieldIds, fieldId],
    })),
  updateFieldSemanticType: (fieldId, semanticType, semanticCategory) =>
    set((s) => ({
      resolvedFields: s.resolvedFields.map(f =>
        f.id === fieldId
          ? {
              ...f,
              semanticType,
              semanticCategory,
              classificationSource: 'user_confirmed',
              resolutionSource: 'user_confirmed',
              confidence: 1,
              confidenceBand: 'high',
            }
          : f
      ),
    })),
  setIsScanning: (val) => set({ isScanning: val }),
  setScanError: (err) => set({ scanError: err }),
  clearScan: () =>
    set({
      scanResult: null,
      resolvedFields: [],
      resolutionStats: null,
      formPurpose: null,
      businessDomain: null,
      suggestedLocale: null,
      formFingerprint: null,
      smartFillPlan: null,
      proposedValues: {},
      excludedFieldIds: [],
      scanError: null,
    }),
}));

// ---- Execution Store ----
interface ExecutionState {
  isExecuting: boolean;
  smartFillStage: SmartFillStage | null;
  progress: ExecutionProgressEvent | null;
  report: ExecutionReport | null;
  fieldResults: FillResult[];
  setIsExecuting: (val: boolean) => void;
  setSmartFillStage: (stage: SmartFillStage | null) => void;
  setProgress: (p: ExecutionProgressEvent) => void;
  setReport: (r: ExecutionReport) => void;
  addFieldResult: (r: FillResult) => void;
  reset: () => void;
}

export const useExecutionStore = create<ExecutionState>((set) => ({
  isExecuting: false,
  smartFillStage: null,
  progress: null,
  report: null,
  fieldResults: [],
  setIsExecuting: (val) => set({ isExecuting: val }),
  setSmartFillStage: (stage) => set({ smartFillStage: stage }),
  setProgress: (p) => set({ progress: p, smartFillStage: p.stage ?? null }),
  setReport: (r) => set({ report: r, smartFillStage: 'complete' }),
  addFieldResult: (r) => set((s) => ({ fieldResults: [...s.fieldResults, r] })),
  reset: () =>
    set({
      isExecuting: false,
      smartFillStage: null,
      progress: null,
      report: null,
      fieldResults: [],
    }),
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
  model: 'gemini-3.5-flash',
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
  generationMode: GenerationMode;
  advancedOptionsOpen: boolean;
  selectedFieldId: string | null;
  highlightedFieldId: string | null;
  setTheme: (t: 'light' | 'dark') => void;
  setActiveTab: (tab: string) => void;
  setGenerationMode: (mode: GenerationMode) => void;
  setAdvancedOptionsOpen: (open: boolean) => void;
  setSelectedFieldId: (id: string | null) => void;
  setHighlightedFieldId: (id: string | null) => void;
}

export const useUIStore = create<UIState>((set) => ({
  theme: 'dark',
  activeTab: 'dashboard',
  generationMode: 'SMART_FILL',
  advancedOptionsOpen: false,
  selectedFieldId: null,
  highlightedFieldId: null,
  setTheme: (t) => set({ theme: t }),
  setActiveTab: (tab) => set({ activeTab: tab }),
  setGenerationMode: (mode) => set({ generationMode: mode }),
  setAdvancedOptionsOpen: (open) => set({ advancedOptionsOpen: open }),
  setSelectedFieldId: (id) => set({ selectedFieldId: id }),
  setHighlightedFieldId: (id) => set({ highlightedFieldId: id }),
}));

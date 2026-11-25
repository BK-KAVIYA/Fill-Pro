// ============================================================
// FILL PRO — Side Panel Entry Point
// ============================================================

import { useState, useEffect, useCallback } from 'react';
import { createRoot } from 'react-dom/client';
import {
  Zap, ScanSearch, Wand2, FileText, Settings, ChevronDown,
  ChevronRight, Sparkles, CheckCircle,
  Loader2, Download, Upload, List, BarChart2, BookOpen,
  Sun, Moon, ExternalLink, Play, Eye, Sliders,
} from 'lucide-react';
import {
  Button, Badge, StatCard, StatusDot, Toggle, Select, EmptyState,
  SectionHeader, ProgressBar, Card, cn,
} from '../../src/components/ui/index.js';
import { FieldsInspector } from '../../src/components/FieldsInspector.js';
import { useScanStore, useExecutionStore, useAIStore, useUIStore } from '../../src/stores/index.js';
import { sendMessage } from '../../src/messaging/index.js';
import type { GenerationMode, SmartFillStage, TestScenario } from '../../src/types/index.js';
import { LOCALE_PROFILES } from '../../src/constants/locales.js';
import { loadSettings, saveSettings } from '../../src/database/db.js';
import { toExecutionPlan } from '../../src/ai/smartFillOrchestrator.js';
import '../../src/styles/globals.css';

// ---- Tab definitions (Custom AI optional, Dashboard primary) ----
const TABS = [
  { id: 'dashboard', icon: BarChart2, label: 'Dashboard' },
  { id: 'fields', icon: List, label: 'Fields' },
  { id: 'documents', icon: FileText, label: 'Docs' },
  { id: 'custom-ai', icon: Wand2, label: 'Custom AI' },
  { id: 'report', icon: BookOpen, label: 'Report' },
];

const STAGE_STEPS: Array<{ id: SmartFillStage; label: string }> = [
  { id: 'scanning', label: 'Scanning form' },
  { id: 'understanding', label: 'Understanding form context' },
  { id: 'resolving_fields', label: 'Resolving known fields' },
  { id: 'ai_classification', label: 'Analyzing unfamiliar fields with AI' },
  { id: 'generating_data', label: 'Generating sample data' },
  { id: 'preparing_documents', label: 'Preparing documents' },
  { id: 'filling', label: 'Filling supported controls' },
  { id: 'validating', label: 'Checking validation' },
  { id: 'recovering', label: 'Resolving supported errors' },
  { id: 'complete', label: 'Finalizing report' },
];

function SmartFillProgressPanel({ currentStage }: { currentStage: SmartFillStage }) {
  const { progress } = useExecutionStore();
  const [elapsedSec, setElapsedSec] = useState(0);
  const currentIdx = STAGE_STEPS.findIndex(s => s.id === currentStage);

  useEffect(() => {
    setElapsedSec(0);
    const timer = setInterval(() => setElapsedSec(s => s + 1), 1000);
    return () => clearInterval(timer);
  }, []);

  const isWaitingForAI = currentStage === 'ai_classification' || currentStage === 'generating_data' || currentStage === 'resolving_fields';

  return (
    <Card className="border border-brand-indigo/30 bg-brand-indigo/10 space-y-2.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin text-brand-indigo" />
          <span className="text-xs font-semibold text-white">
            {isWaitingForAI ? 'Waiting for AI response...' : 'Smart Fill in Progress'}
          </span>
        </div>
        <span className="text-[11px] text-white/60 font-mono">
          {progress ? `${progress.percentage}% · ` : ''}{elapsedSec}s
        </span>
      </div>

      {progress ? (
        <ProgressBar value={progress.percentage} label={progress.status} />
      ) : (
        <ProgressBar value={15} label="Initializing..." />
      )}

      <div className="space-y-1 pt-1">
        {STAGE_STEPS.slice(0, 8).map((step, idx) => {
          const isDone = currentIdx > idx;
          const isActive = currentIdx === idx;
          return (
            <div key={step.id} className="flex items-center gap-2 text-[11px]">
              {isDone ? (
                <CheckCircle className="w-3 h-3 text-green-400 shrink-0" />
              ) : isActive ? (
                <Loader2 className="w-3 h-3 animate-spin text-brand-indigo shrink-0" />
              ) : (
                <div className="w-3 h-3 rounded-full border border-white/20 shrink-0" />
              )}
              <span className={cn(isDone ? 'text-white/60' : isActive ? 'text-white font-medium' : 'text-white/30')}>
                {step.label}
              </span>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

// ---- Dashboard Tab (Primary Workspace) ----
function DashboardTab({
  locale,
  setLocale,
  scenario,
  setScenario,
  preserveExisting,
  setPreserveExisting,
  generateDocuments,
  setGenerateDocuments,
  onRunSmartFill,
  onExecutePlan,
  isRunningSmartFill,
}: {
  locale: string;
  setLocale: (l: string) => void;
  scenario: TestScenario;
  setScenario: (s: TestScenario) => void;
  preserveExisting: boolean;
  setPreserveExisting: (v: boolean) => void;
  generateDocuments: boolean;
  setGenerateDocuments: (v: boolean) => void;
  onRunSmartFill: (autoExecute: boolean) => Promise<void>;
  onExecutePlan: () => Promise<void>;
  isRunningSmartFill: boolean;
}) {
  const {
    scanResult,
    resolutionStats,
    formPurpose,
    businessDomain,
    smartFillPlan,
    excludedFieldIds,
  } = useScanStore();
  const { isExecuting, smartFillStage, report } = useExecutionStore();
  const { isAIEnabled, isConnected } = useAIStore();
  const { generationMode, setGenerationMode, advancedOptionsOpen, setAdvancedOptionsOpen, setActiveTab } = useUIStore();

  const localeOptions = Object.values(LOCALE_PROFILES).map(l => ({ value: l.id, label: l.label }));

  const localRecognized =
    (resolutionStats?.userConfirmed ?? 0) +
    (resolutionStats?.knowledgeBase ?? 0) +
    (resolutionStats?.native ?? 0) +
    (resolutionStats?.heuristic ?? 0);
  const aiResolved = resolutionStats?.ai ?? 0;
  const unresolvedCount = resolutionStats?.unresolved ?? scanResult?.ambiguousFields ?? 0;

  return (
    <div className="space-y-3.5">
      {/* Website & Context Card */}
      <Card className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-wider text-white/40">Active Form Context</p>
            <p className="text-xs font-semibold text-white truncate">
              {formPurpose ?? scanResult?.formTitle ?? scanResult?.pageTitle ?? 'Ready to scan'}
            </p>
          </div>
          <StatusDot
            status={isAIEnabled ? (isConnected ? 'online' : 'offline') : 'offline'}
            label={isAIEnabled ? (isConnected ? 'AI Ready' : 'Key needed') : 'Local'}
          />
        </div>
        {scanResult && (
          <div className="flex items-center justify-between text-[11px] text-white/50 pt-1 border-t border-white/5">
            <span className="font-mono truncate max-w-[180px]">{scanResult.origin}</span>
            {businessDomain && <Badge variant="info" size="sm">{businessDomain}</Badge>}
          </div>
        )}
      </Card>

      {/* Generation Mode Selector */}
      <div className="space-y-1.5">
        <p className="text-[10px] uppercase tracking-wider text-white/40 font-medium">Generation Mode</p>
        <div className="grid grid-cols-3 gap-1.5">
          {[
            {
              id: 'SMART_FILL' as GenerationMode,
              label: 'Smart Fill',
              sub: 'AI + Local',
              icon: Sparkles,
            },
            {
              id: 'QUICK_FILL' as GenerationMode,
              label: 'Quick Fill',
              sub: 'Local Only',
              icon: Zap,
            },
            {
              id: 'CUSTOM_AI_FILL' as GenerationMode,
              label: 'Custom AI',
              sub: 'Prompted',
              icon: Wand2,
            },
          ].map(m => {
            const active = generationMode === m.id;
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => {
                  setGenerationMode(m.id);
                  if (m.id === 'CUSTOM_AI_FILL') {
                    setActiveTab('custom-ai');
                  }
                }}
                className={cn(
                  'flex flex-col items-center text-center p-2 rounded-xl border transition-all',
                  active
                    ? 'bg-brand-indigo/20 border-brand-indigo text-white shadow-sm'
                    : 'bg-white/[0.03] border-white/10 text-white/60 hover:text-white hover:bg-white/[0.06]'
                )}
              >
                <m.icon className={cn('w-4 h-4 mb-1', active ? 'text-brand-indigo' : 'text-white/50')} />
                <span className="text-[11px] font-semibold leading-tight">{m.label}</span>
                <span className="text-[9px] text-white/40">{m.sub}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Primary Smart Fill Action */}
      <div className="flex gap-2">
        <Button
          variant="primary"
          size="md"
          className="flex-1"
          onClick={() => onRunSmartFill(true)}
          loading={isRunningSmartFill || isExecuting}
          icon={<Sparkles className="w-4 h-4" />}
        >
          {isRunningSmartFill
            ? 'Waiting for AI...'
            : isExecuting
              ? 'Filling Form...'
              : generationMode === 'QUICK_FILL'
                ? 'Quick Fill Form'
                : 'Smart Fill Form'}
        </Button>
        <Button
          variant="secondary"
          size="md"
          onClick={() => onRunSmartFill(false)}
          loading={isRunningSmartFill}
          disabled={isRunningSmartFill || isExecuting}
          title="Scan and preview proposed values before filling"
          icon={<Eye className="w-4 h-4" />}
        >
          Preview
        </Button>
      </div>

      {/* Real-time Stage Progress */}
      {(isRunningSmartFill || isExecuting) && smartFillStage && (
        <SmartFillProgressPanel currentStage={smartFillStage} />
      )}

      {/* Field Statistics Grid */}
      {scanResult && (
        <div className="grid grid-cols-3 gap-2">
          <StatCard label="Total" value={scanResult.totalFields} />
          <StatCard label="Required" value={scanResult.requiredFields} variant="warning" />
          <StatCard label="Uploads" value={scanResult.uploadFields} />
          <StatCard label="Local / KB" value={resolutionStats ? localRecognized : scanResult.fillableFields} variant="success" />
          <StatCard label="AI Resolved" value={aiResolved} />
          <StatCard label="Unresolved" value={unresolvedCount} variant={unresolvedCount > 0 ? 'warning' : 'default'} />
        </div>
      )}

      {/* Proposed Plan Preview Bar */}
      {smartFillPlan && !isExecuting && !isRunningSmartFill && (
        <Card className="border border-brand-cyan/30 bg-brand-cyan/5 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-white">Fill Plan Ready</span>
            <Badge variant="info" size="sm">
              {Object.keys(smartFillPlan.proposedValues).length - excludedFieldIds.length} values
              {smartFillPlan.documentPlans.length > 0 ? ` + ${smartFillPlan.documentPlans.length} docs` : ''}
            </Badge>
          </div>
          {smartFillPlan.aiError && (
            <p className="text-[11px] text-yellow-300">
              AI note: {smartFillPlan.aiError} (local fallback applied)
            </p>
          )}
          <div className="flex gap-2">
            <Button
              variant="primary"
              size="sm"
              className="flex-1"
              onClick={onExecutePlan}
              icon={<Play className="w-3.5 h-3.5" />}
            >
              Execute Plan
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setActiveTab('fields')}
            >
              Review Fields
            </Button>
          </div>
        </Card>
      )}

      {/* Preferences Row */}
      <Card className="space-y-2.5">
        <Toggle
          checked={generateDocuments}
          onChange={setGenerateDocuments}
          label="Generate & prepare documents"
        />
        <Toggle
          checked={preserveExisting}
          onChange={setPreserveExisting}
          label="Preserve existing field values"
        />
      </Card>

      {/* Collapsible Advanced Options */}
      <div className="rounded-xl border border-white/10 bg-white/[0.02] overflow-hidden">
        <button
          type="button"
          onClick={() => setAdvancedOptionsOpen(!advancedOptionsOpen)}
          className="w-full flex items-center justify-between px-3 py-2.5 text-xs font-medium text-white/70 hover:text-white"
        >
          <span className="flex items-center gap-1.5">
            <Sliders className="w-3.5 h-3.5 text-brand-indigo" />
            Advanced Options (Locale & Scenario)
          </span>
          {advancedOptionsOpen ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
        </button>
        {advancedOptionsOpen && (
          <div className="px-3 pb-3 pt-1 space-y-2.5 border-t border-white/5">
            <Select
              label="Locale"
              value={locale}
              onChange={(e) => setLocale(e.target.value)}
              options={localeOptions}
            />
            <Select
              label="Test Scenario"
              value={scenario}
              onChange={(e) => setScenario(e.target.value as TestScenario)}
              options={[
                { value: 'valid_data', label: 'Valid Data' },
                { value: 'required_only', label: 'Required Fields Only' },
                { value: 'negative_test', label: 'Negative Testing' },
                { value: 'boundary_test', label: 'Boundary Testing' },
                { value: 'international', label: 'International' },
              ]}
            />
          </div>
        )}
      </div>

      {/* Last Execution Summary */}
      {report && !isExecuting && (
        <Card>
          <SectionHeader title="Last Execution" />
          <div className="grid grid-cols-3 gap-2 text-center">
            <div>
              <p className="text-green-400 font-bold">{report.filledVerified + report.correctedVerified}</p>
              <p className="text-xs text-white/40">Verified</p>
            </div>
            <div>
              <p className="text-yellow-400 font-bold">{report.validationFailed}</p>
              <p className="text-xs text-white/40">Failed</p>
            </div>
            <div>
              <p className="text-white/60 font-bold">{Math.round(report.durationMs / 1000)}s</p>
              <p className="text-xs text-white/40">Duration</p>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}

// ---- Custom AI Tab (Optional Advanced Workspace) ----
function CustomAITab({
  locale,
  setLocale,
  scenario,
  setScenario,
}: {
  locale: string;
  setLocale: (l: string) => void;
  scenario: TestScenario;
  setScenario: (s: TestScenario) => void;
}) {
  const { isAIEnabled, isConnected } = useAIStore();
  const { scanResult, formPurpose, businessDomain, setSmartFillPlan } = useScanStore();
  const { isExecuting } = useExecutionStore();

  const [instruction, setInstruction] = useState('');
  const [isRunning, setIsRunning] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const localeOptions = Object.values(LOCALE_PROFILES).map(l => ({ value: l.id, label: l.label }));

  // Context-aware suggestions (Section 5)
  const getContextualSuggestions = (): string[] => {
    const suggestions: string[] = [];
    const domain = (businessDomain ?? '').toUpperCase();
    const purpose = (formPurpose ?? '').toLowerCase();

    if (domain.includes('CORPORATE') || purpose.includes('company') || purpose.includes('registration')) {
      suggestions.push('Generate a realistic private limited company registration profile with 25 employees');
      suggestions.push('Populate director and shareholder details with consistent local addresses');
    }
    if (domain.includes('FINANCIAL') || purpose.includes('financial') || purpose.includes('balance')) {
      suggestions.push('Fill financial fields with balanced assets, liabilities, and equity figures');
      suggestions.push('Generate quarterly revenue and tax figures consistent with an SME');
    }
    if (domain.includes('HUMAN_RESOURCES') || purpose.includes('employee')) {
      suggestions.push('Generate a senior software engineer employee onboarding profile');
    }
    if ((scanResult?.uploadFields ?? 0) > 0) {
      suggestions.push('Prepare consistent supporting PDF/XLSX documents matching form entity details');
    }
    if (suggestions.length === 0) {
      suggestions.push('Fill all required fields with realistic, domain-appropriate test data');
      suggestions.push('Test boundary values for numeric and length-constrained fields');
      suggestions.push('Generate an international applicant profile');
    }
    return suggestions;
  };

  const handleCustomExecute = async (autoExecute: boolean) => {
    if (!scanResult) return;
    setIsRunning(true);
    setErrorMsg(null);
    try {
      const res: any = await chrome.runtime.sendMessage({
        type: 'SMART_FILL',
        payload: {
          mode: 'CUSTOM_AI_FILL',
          locale,
          scenario,
          preserveExisting: false,
          generateDocuments: true,
          instruction: instruction || 'Fill form with realistic test data',
          autoExecute,
        },
      });
      if (res?.error) {
        setErrorMsg(res.error);
      } else if (res?.plan) {
        setSmartFillPlan(res.plan);
      }
    } catch (err: any) {
      setErrorMsg(String(err?.message || err));
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div className="space-y-4">
      <SectionHeader
        title="Custom AI Instructions"
        subtitle="Optional advanced prompting for custom test scenarios"
      />

      {!isAIEnabled && (
        <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-xs text-white/60">
          <span>AI provider not enabled — local generator will be used.</span>
          <button
            onClick={() => chrome.runtime.openOptionsPage()}
            className="text-brand-indigo hover:text-white font-medium ml-2 shrink-0"
          >
            Configure
          </button>
        </div>
      )}

      {isAIEnabled && (
        <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-brand-indigo/10 border border-brand-indigo/20 text-xs">
          <span className="text-white/80">
            AI Ready {isConnected ? '(Connected)' : '(Check key in Settings)'}
          </span>
          <button
            onClick={() => chrome.runtime.openOptionsPage()}
            className="text-brand-indigo hover:text-white flex items-center gap-1"
          >
            <span>Settings</span>
            <ExternalLink className="w-3 h-3" />
          </button>
        </div>
      )}

      {isRunning && (
        <Card className="border border-brand-indigo/30 bg-brand-indigo/10 flex items-center gap-2.5">
          <Loader2 className="w-4 h-4 animate-spin text-brand-indigo shrink-0" />
          <div className="text-xs">
            <p className="font-medium text-white">Waiting for AI response...</p>
            <p className="text-[11px] text-white/50">Analyzing form fields and generating custom values.</p>
          </div>
        </Card>
      )}

      {errorMsg && (
        <div className="p-2.5 rounded-lg bg-red-500/10 border border-red-500/20 text-xs text-red-300">
          {errorMsg}
        </div>
      )}

      <div className="space-y-3">
        <div>
          <label className="block text-xs font-medium text-white/70 mb-1.5">Instruction</label>
          <textarea
            value={instruction}
            onChange={(e) => setInstruction(e.target.value)}
            placeholder="e.g. Populate as a Sri Lankan FinTech startup with LKR 50M capital and test boundary values..."
            className="w-full h-24 px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-xs placeholder:text-white/30 focus:outline-none focus:border-brand-indigo resize-none"
          />
        </div>

        <div className="grid grid-cols-2 gap-2">
          <Select
            label="Locale"
            value={locale}
            onChange={(e) => setLocale(e.target.value)}
            options={localeOptions}
          />
          <Select
            label="Scenario"
            value={scenario}
            onChange={(e) => setScenario(e.target.value as TestScenario)}
            options={[
              { value: 'valid_data', label: 'Valid Data' },
              { value: 'required_only', label: 'Required Only' },
              { value: 'negative_test', label: 'Negative' },
              { value: 'boundary_test', label: 'Boundary' },
              { value: 'international', label: 'International' },
            ]}
          />
        </div>
      </div>

      <div className="flex gap-2">
        <Button
          variant="secondary"
          size="sm"
          className="flex-1"
          onClick={() => handleCustomExecute(false)}
          loading={isRunning}
          disabled={!scanResult || isRunning}
          icon={<Eye className="w-3.5 h-3.5" />}
        >
          Preview Plan
        </Button>
        <Button
          variant="primary"
          size="sm"
          className="flex-1"
          onClick={() => handleCustomExecute(true)}
          loading={isRunning || isExecuting}
          disabled={!scanResult || isRunning || isExecuting}
          icon={<Zap className="w-3.5 h-3.5" />}
        >
          Generate & Fill
        </Button>
      </div>

      {/* Context-Aware Suggestions */}
      <div className="space-y-1.5">
        <p className="text-[10px] text-white/40 font-medium uppercase tracking-wider">
          Context-Aware Suggestions
        </p>
        {getContextualSuggestions().map(prompt => (
          <button
            key={prompt}
            className="w-full text-left px-3 py-2 rounded-lg text-xs text-white/70 hover:text-white bg-white/5 hover:bg-white/10 border border-white/5 transition-colors"
            onClick={() => setInstruction(prompt)}
          >
            {prompt}
          </button>
        ))}
      </div>
    </div>
  );
}

// ---- Documents Tab ----
function DocumentsTab() {
  const { scanResult, smartFillPlan } = useScanStore();
  const [generating, setGenerating] = useState<string | null>(null);
  const [generatedFiles, setGeneratedFiles] = useState<Record<string, { filename: string; format: string }>>({});

  const fileFields = scanResult?.fileFields ?? [];

  const handleGenerate = async (fieldId: string, format: string, docType?: string, label?: string) => {
    setGenerating(fieldId);
    try {
      const labelClean = (label || 'Document').replace(/[^a-zA-Z0-9]/g, '-').replace(/-+/g, '-');
      const res: any = await chrome.runtime.sendMessage({
        type: 'GENERATE_DOCUMENT',
        payload: {
          format,
          documentSemanticType: docType || 'general_document',
          dataContext: smartFillPlan?.dataContext,
          filename: `${labelClean}.${format}`,
        },
      });
      if (res?.base64) {
        setGeneratedFiles(prev => ({ ...prev, [fieldId]: { filename: res.filename, format: res.format } }));
      }
    } finally {
      setGenerating(null);
    }
  };

  return (
    <div className="space-y-4">
      <SectionHeader
        title="Documents"
        subtitle={`${fileFields.length} upload field(s) detected`}
      />

      {fileFields.length === 0 ? (
        <EmptyState
          icon={<Upload className="w-8 h-8" />}
          title="No upload fields detected"
          description="Scan a form with file upload controls to generate and attach test documents."
        />
      ) : (
        fileFields.map(field => {
          const gen = generatedFiles[field.id];
          return (
            <Card key={field.id}>
              <div className="space-y-2.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-white truncate">
                      {field.label ?? field.fieldName ?? 'File Upload'}
                    </p>
                    <p className="text-[11px] text-white/40 mt-0.5">
                      {field.acceptedExtensions.join(', ') || 'Any format'}
                      {field.maxFileSizeBytes && ` · Max ${Math.round(field.maxFileSizeBytes / 1024 / 1024)}MB`}
                    </p>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    {field.required && <Badge variant="error" size="sm">Req</Badge>}
                    <Badge
                      variant={field.autoUploadRisk === 'known' ? 'error' : field.autoUploadRisk === 'possible' ? 'warning' : 'default'}
                      size="sm"
                    >
                      {field.autoUploadRisk === 'known' ? 'Auto-upload' : field.autoUploadRisk === 'possible' ? '? Auto' : 'Manual'}
                    </Badge>
                  </div>
                </div>

                <div className="flex flex-wrap gap-1.5">
                  {['pdf', 'docx', 'xlsx', 'png', 'csv'].map(fmt => {
                    const accepted = field.acceptedExtensions.length === 0 || field.acceptedExtensions.includes(`.${fmt}`);
                    return (
                      <button
                        key={fmt}
                        disabled={!accepted || generating === field.id}
                        className={cn(
                          'px-2 py-1 rounded text-[11px] border transition-colors',
                          accepted
                            ? 'border-brand-indigo/50 text-brand-indigo hover:bg-brand-indigo/10'
                            : 'border-white/10 text-white/20 cursor-not-allowed'
                        )}
                        onClick={() => handleGenerate(field.id, fmt, field.documentSemanticType, field.label)}
                      >
                        {generating === field.id ? <Loader2 className="w-3 h-3 animate-spin inline" /> : fmt.toUpperCase()}
                      </button>
                    );
                  })}
                </div>

                {gen && (
                  <p className="text-[11px] text-green-400">
                    ✓ Generated {gen.filename}
                  </p>
                )}
              </div>
            </Card>
          );
        })
      )}
    </div>
  );
}

// ---- Report Tab ----
function ReportTab() {
  const { report } = useExecutionStore();

  if (!report) {
    return (
      <EmptyState
        icon={<BarChart2 className="w-8 h-8" />}
        title="No report yet"
        description="Run Smart Fill to generate a detailed verification report."
      />
    );
  }

  const statusConfig: Record<string, { label: string; color: string }> = {
    filled_verified: { label: 'Verified', color: 'text-green-400' },
    filled_validation_unknown: { label: 'Unverified', color: 'text-blue-400' },
    corrected_verified: { label: 'Recovered', color: 'text-cyan-400' },
    validation_failed: { label: 'Failed', color: 'text-red-400' },
    skipped_existing: { label: 'Existing', color: 'text-gray-400' },
    skipped_sensitive: { label: 'Sensitive', color: 'text-orange-400' },
    unsupported_component: { label: 'Unsupported', color: 'text-yellow-400' },
    requires_manual_review: { label: 'Review', color: 'text-yellow-400' },
    error: { label: 'Error', color: 'text-red-400' },
  };

  const handleExportJSON = () => {
    const json = JSON.stringify(report, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `fill-pro-report-${report.sessionId}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <SectionHeader
          title="Execution Report"
          subtitle={`${Math.round(report.durationMs / 1000)}s · ${report.totalFields} fields`}
        />
        <Button variant="ghost" size="sm" onClick={handleExportJSON} icon={<Download className="w-3 h-3" />}>
          Export
        </Button>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <StatCard label="Verified" value={report.filledVerified + report.correctedVerified} variant="success" />
        <StatCard label="Failed" value={report.validationFailed} variant={report.validationFailed > 0 ? 'error' : 'default'} />
        <StatCard label="Skipped" value={report.skippedSensitive + report.skippedExisting} />
      </div>

      <Card>
        <div className="space-y-1.5">
          {report.fieldResults.slice(0, 30).map(result => {
            const cfg = statusConfig[result.status] ?? { label: result.status, color: 'text-white/40' };
            return (
              <div key={result.fieldId} className="flex items-center justify-between text-xs gap-2">
                <span className="text-white/60 font-mono truncate max-w-[130px]">{result.fieldId}</span>
                <div className="flex items-center gap-2 min-w-0">
                  {result.generatedValue && (
                    <span className="text-white/30 truncate max-w-[80px]">{result.generatedValue.displayValue}</span>
                  )}
                  <span className={cn('shrink-0', cfg.color)}>{cfg.label}</span>
                </div>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}

// ---- Main Side Panel App ----
function SidePanelApp() {
  const { scanResult, smartFillPlan, excludedFieldIds, isScanning } = useScanStore();
  const { isExecuting } = useExecutionStore();
  const { activeTab, setActiveTab, theme, setTheme, generationMode, setGenerationMode } = useUIStore();

  const [currentTabId, setCurrentTabId] = useState<number | null>(null);
  const [locale, setLocale] = useState('en-LK');
  const [scenario, setScenario] = useState<TestScenario>('valid_data');
  const [preserveExisting, setPreserveExisting] = useState(true);
  const [generateDocuments, setGenerateDocuments] = useState(true);
  const [isRunningSmartFill, setIsRunningSmartFill] = useState(false);

  const syncSettings = useCallback(async () => {
    try {
      const s = await loadSettings();
      if (s) {
        if (s.general?.theme === 'light' || s.general?.theme === 'dark') {
          setTheme(s.general.theme);
        }
        if (s.general?.defaultLocale) setLocale(s.general.defaultLocale);
        if (s.general?.defaultScenario) setScenario(s.general.defaultScenario);
        setPreserveExisting(!!s.general?.preserveExistingValues);
        setGenerateDocuments(s.general?.autoPrepareDocuments ?? true);
        if (s.general?.defaultGenerationMode) {
          setGenerationMode(s.general.defaultGenerationMode);
        }

        const aiStore = useAIStore.getState();
        aiStore.setIsAIEnabled(!!s.ai?.enabled);
        if (s.ai?.model) aiStore.setModel(s.ai.model);

        let k = '';
        if (typeof chrome !== 'undefined' && chrome.storage) {
          const sRes = await chrome.storage.session?.get(['geminiApiKey', 'apiKey']);
          k = sRes?.geminiApiKey || sRes?.apiKey || '';
          if (!k) {
            const lRes = await chrome.storage.local?.get(['geminiApiKey', 'apiKey']);
            k = lRes?.geminiApiKey || lRes?.apiKey || '';
          }
        }
        if (k) {
          aiStore.setApiKey(k);
          aiStore.setConnectionStatus(true);
        } else {
          aiStore.setApiKey(null);
          aiStore.setConnectionStatus(false, 'API key required');
        }
      }
    } catch {
      // ignore
    }
  }, [setTheme, setGenerationMode]);

  useEffect(() => {
    syncSettings();
    window.addEventListener('focus', syncSettings);
    const onStorageChange = () => syncSettings();
    chrome.storage?.onChanged?.addListener(onStorageChange);

    chrome.tabs.query({ active: true, currentWindow: true }).then(tabs => {
      if (tabs[0]?.id) setCurrentTabId(tabs[0].id);
    });

    const msgHandler = (msg: any) => {
      if (msg.type === 'SETTINGS_UPDATED') syncSettings();
      const store = useScanStore.getState();
      const execStore = useExecutionStore.getState();
      if (msg.type === 'SCAN_RESULT') store.setScanResult(msg.payload);
      if (msg.type === 'EXECUTION_PROGRESS') execStore.setProgress(msg.payload);
      if (msg.type === 'EXECUTION_COMPLETE') {
        execStore.setReport(msg.payload);
        execStore.setIsExecuting(false);
        setActiveTab('report');
      }
    };

    chrome.runtime?.onMessage?.addListener(msgHandler);
    return () => {
      window.removeEventListener('focus', syncSettings);
      chrome.storage?.onChanged?.removeListener(onStorageChange);
      chrome.runtime?.onMessage?.removeListener(msgHandler);
    };
  }, [syncSettings, setActiveTab]);

  const handleScan = async () => {
    if (!currentTabId) return;
    const store = useScanStore.getState();
    store.setIsScanning(true);
    store.setScanError(null);
    try {
      const res = (await sendMessage({ type: 'SCAN_FORM', payload: { tabId: currentTabId } })) as any;
      if (res?.error) store.setScanError(res.error);
      else if (res?.fields) store.setScanResult(res);
    } catch {
      store.setScanError('Failed to scan page.');
    } finally {
      store.setIsScanning(false);
    }
  };

  const handleRunSmartFill = async (autoExecute: boolean) => {
    setIsRunningSmartFill(true);
    const execStore = useExecutionStore.getState();
    execStore.setSmartFillStage('scanning');
    if (autoExecute) execStore.setIsExecuting(true);

    try {
      const res: any = await chrome.runtime.sendMessage({
        type: 'SMART_FILL',
        payload: {
          tabId: currentTabId ?? undefined,
          mode: generationMode,
          locale,
          scenario,
          preserveExisting,
          generateDocuments,
          autoExecute,
        },
      });
      if (res?.scanResult) useScanStore.getState().setScanResult(res.scanResult);
      if (res?.plan) useScanStore.getState().setSmartFillPlan(res.plan);
      if (res?.error) {
        execStore.setIsExecuting(false);
        execStore.setSmartFillStage(null);
      }
    } catch {
      execStore.setIsExecuting(false);
      execStore.setSmartFillStage(null);
    } finally {
      setIsRunningSmartFill(false);
    }
  };

  const handleExecutePlan = async () => {
    if (!smartFillPlan) return;
    useExecutionStore.getState().setIsExecuting(true);
    const execPlan = toExecutionPlan(smartFillPlan, excludedFieldIds);
    await sendMessage({ type: 'EXECUTE_PLAN', payload: execPlan });
  };

  return (
    <div className={cn('flex flex-col h-screen bg-dark-900 text-white', theme)}>
      {/* Header */}
      <div className="px-3.5 py-2.5 border-b border-white/5 bg-gradient-to-r from-dark-900 to-dark-800 shrink-0">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <img src="/icons/icon-32.png" alt="Fill Pro" className="w-6 h-6 rounded-lg shrink-0" />
            <span className="text-sm font-bold text-white truncate">Fill Pro</span>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <Button
              size="sm"
              variant="secondary"
              onClick={handleScan}
              loading={isScanning}
              icon={<ScanSearch className="w-3.5 h-3.5" />}
            >
              Scan
            </Button>
            <button
              className="p-1.5 rounded-lg text-white/40 hover:text-white hover:bg-white/10 transition-colors"
              onClick={async () => {
                const newTheme = theme === 'dark' ? 'light' : 'dark';
                setTheme(newTheme);
                try {
                  const s = await loadSettings();
                  if (s) await saveSettings({ ...s, general: { ...s.general, theme: newTheme } });
                } catch { }
              }}
              aria-label="Toggle theme"
            >
              {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
            <button
              className="p-1.5 rounded-lg text-white/40 hover:text-white hover:bg-white/10 transition-colors"
              onClick={() => chrome.runtime.openOptionsPage()}
              aria-label="Settings"
            >
              <Settings className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Responsive Navigation Tabs (prevent horizontal clipping) */}
      <div className="grid grid-cols-5 border-b border-white/5 bg-dark-900 shrink-0">
        {TABS.map(tab => (
          <button
            key={tab.id}
            className={cn(
              'flex flex-col sm:flex-row items-center justify-center gap-1 px-1 py-2 text-[10px] sm:text-xs font-medium transition-colors border-b-2 min-w-0',
              activeTab === tab.id
                ? 'text-brand-indigo border-brand-indigo bg-brand-indigo/5'
                : 'text-white/40 border-transparent hover:text-white/70'
            )}
            onClick={() => setActiveTab(tab.id)}
          >
            <tab.icon className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-3.5 min-h-0">
        {activeTab === 'dashboard' && (
          <DashboardTab
            locale={locale}
            setLocale={setLocale}
            scenario={scenario}
            setScenario={setScenario}
            preserveExisting={preserveExisting}
            setPreserveExisting={setPreserveExisting}
            generateDocuments={generateDocuments}
            setGenerateDocuments={setGenerateDocuments}
            onRunSmartFill={handleRunSmartFill}
            onExecutePlan={handleExecutePlan}
            isRunningSmartFill={isRunningSmartFill}
          />
        )}
        {activeTab === 'fields' && <FieldsInspector locale={locale} scenario={scenario} />}
        {activeTab === 'documents' && <DocumentsTab />}
        {activeTab === 'custom-ai' && (
          <CustomAITab
            locale={locale}
            setLocale={setLocale}
            scenario={scenario}
            setScenario={setScenario}
          />
        )}
        {activeTab === 'report' && <ReportTab />}
      </div>
    </div>
  );
}

const container = document.getElementById('root');
if (container) {
  createRoot(container).render(<SidePanelApp />);
}

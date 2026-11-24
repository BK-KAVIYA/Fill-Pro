// ============================================================
// FILL PRO — Side Panel Entry Point
// ============================================================

import React, { useState, useEffect, useCallback } from 'react';
import { createRoot } from 'react-dom/client';
import {
  Zap, ScanSearch, Wand2, FileText, Settings, ChevronDown,
  ChevronRight, Sparkles, AlertTriangle, CheckCircle, XCircle,
  Loader2, Eye, Download, Trash2, RefreshCw, Upload, List,
  BarChart2, MessageSquare, BookOpen, Filter, Search,
  PanelLeft, Lightbulb, Shield, Clock, Hash, Sun, Moon, ExternalLink,
} from 'lucide-react';
import {
  Button, Badge, StatCard, StatusDot, Toggle, Select, EmptyState,
  SectionHeader, ConfidenceIndicator, ProgressBar, Card, Input, cn,
} from '../../src/components/ui/index.js';
import { useScanStore, useExecutionStore, useAIStore, useUIStore } from '../../src/stores/index.js';
import { sendMessage } from '../../src/messaging/index.js';
import type { FieldDescriptor, ExecutionReport, FillResult } from '../../src/types/index.js';
import { LOCALE_PROFILES } from '../../src/constants/locales.js';
import { loadSettings, saveSettings } from '../../src/database/db.js';
import '../../src/styles/globals.css';

// ---- Tab definitions ----
const TABS = [
  { id: 'dashboard', icon: BarChart2, label: 'Dashboard' },
  { id: 'ai', icon: Sparkles, label: 'AI Assistant' },
  { id: 'fields', icon: List, label: 'Fields' },
  { id: 'documents', icon: FileText, label: 'Documents' },
  { id: 'scenarios', icon: Lightbulb, label: 'Scenarios' },
  { id: 'report', icon: BookOpen, label: 'Report' },
];

// ---- Dashboard Tab ----
function DashboardTab() {
  const { scanResult, isScanning } = useScanStore();
  const { isExecuting, progress, report } = useExecutionStore();
  const { isAIEnabled, isConnected } = useAIStore();

  return (
    <div className="space-y-4">
      <SectionHeader
        title="Form Overview"
        subtitle={scanResult?.url ?? 'No page scanned'}
      />

      {!scanResult ? (
        <EmptyState
          icon={<ScanSearch className="w-10 h-10" />}
          title="No form scanned yet"
          description="Click Scan Form to discover input fields on the current page."
        />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2">
            <StatCard label="Total Fields" value={scanResult.totalFields} />
            <StatCard label="Fillable" value={scanResult.fillableFields} variant="success" />
            <StatCard label="Required" value={scanResult.requiredFields} variant="warning" />
            <StatCard label="Ambiguous" value={scanResult.ambiguousFields} variant={scanResult.ambiguousFields > 0 ? 'warning' : 'default'} />
            <StatCard label="Upload Fields" value={scanResult.uploadFields} />
            <StatCard label="Sensitive (skipped)" value={scanResult.sensitiveFields} variant="error" />
          </div>

          <Card>
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-white/60">AI Status</span>
                <StatusDot
                  status={isAIEnabled ? (isConnected ? 'online' : 'offline') : 'offline'}
                  label={isAIEnabled ? (isConnected ? 'Connected' : 'Not connected') : 'Local mode'}
                />
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-white/60">Page</span>
                <span className="text-white/80 font-mono text-xs truncate max-w-32">{scanResult.origin}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-white/60">Sections</span>
                <span className="text-white/80">{scanResult.formSections.length}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-white/60">Scan time</span>
                <span className="text-white/80">{Math.round(scanResult.scanDurationMs)}ms</span>
              </div>
            </div>
          </Card>

          {/* Form sections */}
          {scanResult.formSections.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs text-white/40 font-medium uppercase tracking-wider">Form Sections</p>
              {scanResult.formSections.map(section => (
                <Card key={section.id} className="flex items-center justify-between py-2">
                  <span className="text-sm text-white/80">{section.label ?? 'Default Section'}</span>
                  <Badge variant="info" size="sm">{section.fieldIds.length} fields</Badge>
                </Card>
              ))}
            </div>
          )}
        </>
      )}

      {/* Execution progress */}
      {isExecuting && progress && (
        <Card>
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin text-brand-indigo" />
              <span className="text-sm text-white">Filling form...</span>
            </div>
            <ProgressBar value={progress.percentage} label={progress.currentFieldLabel} />
            <p className="text-xs text-white/40">
              {progress.currentAction} / {progress.totalActions} fields processed
            </p>
          </div>
        </Card>
      )}

      {/* Last report summary */}
      {report && !isExecuting && (
        <Card>
          <SectionHeader title="Last Execution" />
          <div className="grid grid-cols-3 gap-2 text-center">
            <div>
              <p className="text-green-400 font-bold">{report.filledVerified}</p>
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

// ---- AI Assistant Tab ----
function AIAssistantTab() {
  const { isAIEnabled, isConnected } = useAIStore();
  const { scanResult } = useScanStore();
  const { isExecuting } = useExecutionStore();
  const [instruction, setInstruction] = useState('');
  const [locale, setLocale] = useState('en-LK');
  const [scenario, setScenario] = useState('valid_data');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<any>(null);
  const [analysisError, setAnalysisError] = useState<string | null>(null);

  const localeOptions = Object.values(LOCALE_PROFILES).map(l => ({ value: l.id, label: l.label }));

  const handleAnalyse = async () => {
    if (!scanResult) return;
    setIsAnalyzing(true);
    setAnalysisError(null);
    try {
      const fieldsSummary = scanResult.fields.map(f => ({
        id: f.id,
        label: f.label || f.fieldName,
        fieldName: f.fieldName,
        placeholder: f.placeholder,
        htmlType: f.htmlType,
        controlType: f.controlType,
        section: f.section,
        description: f.description,
      }));

      const res = await chrome.runtime.sendMessage({
        type: 'ANALYZE_FORM',
        payload: {
          fields: fieldsSummary,
          url: scanResult.origin,
          pageTitle: document.title,
        },
      });

      if (res && res.success && res.result) {
        setAnalysisResult(res.result);
      } else {
        setAnalysisError(res?.error || 'Analysis failed. Check your API key in Settings.');
      }
    } catch (err: any) {
      setAnalysisError(String(err?.message || err));
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleExecute = async () => {
    if (!scanResult) return;
    let actions: any[] = [];

    // If AI is enabled, generate context-aware field values using the LLM
    if (isAIEnabled) {
      try {
        const fieldsSummary = scanResult.fields.map(f => ({
          id: f.id,
          label: f.label || f.fieldName,
          fieldName: f.fieldName,
          placeholder: f.placeholder,
          htmlType: f.htmlType,
          controlType: f.controlType,
          options: (f as any).options,
        }));

        const aiRes = await chrome.runtime.sendMessage({
          type: 'GENERATE_AI_VALUES',
          payload: {
            fields: fieldsSummary,
            instruction: instruction || 'Fill form with realistic, valid test data',
            locale,
            scenario,
          },
        });

        if (aiRes && aiRes.success && aiRes.values) {
          actions = Object.entries(aiRes.values).map(([fieldId, value]) => ({
            fieldId,
            actionType: 'fill',
            value,
          }));
        }
      } catch (err) {
        console.warn('[FillPro] AI generation error, falling back to local engine:', err);
      }
    }

    await sendMessage({
      type: 'EXECUTE_PLAN',
      payload: {
        sessionId: scanResult.sessionId,
        origin: scanResult.origin,
        scenario: scenario as 'valid_data',
        locale,
        actions,
        submitForm: false,
        preserveExisting: false,
        scope: 'all',
        maxRetries: 3,
        timeoutMs: 60000,
      },
    });
  };

  return (
    <div className="space-y-4">
      <SectionHeader
        title="AI Assistant"
        subtitle="Describe what you want to generate"
      />

      {!isAIEnabled ? (
        <Card>
          <div className="flex items-start justify-between gap-3 text-sm">
            <div className="flex items-start gap-3 min-w-0">
              <Shield className="w-5 h-5 text-brand-indigo shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-white">AI Assistant is disabled</p>
                <p className="text-white/50 text-xs mt-1">
                  Enable Gemini, OpenAI, or Claude in Settings to use AI-powered field classification and natural language instructions. Fill Pro works fully in local mode.
                </p>
              </div>
            </div>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => chrome.runtime.openOptionsPage()}
              icon={<ExternalLink className="w-3.5 h-3.5" />}
              className="shrink-0"
            >
              Settings
            </Button>
          </div>
        </Card>
      ) : (
        <div className="flex items-center justify-between px-3.5 py-2.5 rounded-xl bg-brand-indigo/10 border border-brand-indigo/20 text-xs">
          <div className="flex items-center gap-2">
            <div className={cn("w-2 h-2 rounded-full", isConnected ? "bg-green-400 animate-pulse" : "bg-yellow-400")} />
            <span className="text-white font-medium">AI Assistant Active</span>
            <span className="text-white/50">{isConnected ? '(Connected)' : '(API Key required in Settings)'}</span>
          </div>
          <button
            onClick={() => chrome.runtime.openOptionsPage()}
            className="text-brand-indigo hover:text-white transition-colors text-xs font-medium flex items-center gap-1"
          >
            <span>Settings</span>
            <ExternalLink className="w-3 h-3" />
          </button>
        </div>
      )}

      {analysisResult && (
        <Card className="border border-brand-indigo/30 bg-brand-indigo/5 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-bold text-white flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-brand-indigo" />
              AI Form Analysis
            </span>
            {analysisResult.suggestedLocale && (
              <Badge variant="neutral">{analysisResult.suggestedLocale}</Badge>
            )}
          </div>
          {analysisResult.formPurpose && (
            <p className="text-xs text-white/80">
              <span className="font-medium text-white/50">Purpose: </span>
              {analysisResult.formPurpose}
            </p>
          )}
          {analysisResult.businessDomain && (
            <p className="text-xs text-white/80">
              <span className="font-medium text-white/50">Domain: </span>
              {analysisResult.businessDomain}
            </p>
          )}
          {analysisResult.fields && (
            <p className="text-[11px] text-white/40">
              {analysisResult.fields.length} fields classified with AI semantic metadata.
            </p>
          )}
        </Card>
      )}

      {analysisError && (
        <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-xs text-red-300 flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-red-400" />
          <span>{analysisError}</span>
        </div>
      )}

      <div className="space-y-3">
        <div>
          <label className="block text-xs font-medium text-white/70 mb-1.5">Natural Language Instruction</label>
          <textarea
            value={instruction}
            onChange={(e) => setInstruction(e.target.value)}
            placeholder="e.g. Fill this form with realistic data for a Sri Lankan software company with 50 employees and annual revenue of LKR 25 million."
            className="w-full h-28 px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm placeholder:text-white/30 focus:outline-none focus:border-brand-indigo resize-none"
          />
        </div>

        <Select
          label="Locale"
          value={locale}
          onChange={(e) => setLocale(e.target.value)}
          options={localeOptions}
        />

        <Select
          label="Scenario"
          value={scenario}
          onChange={(e) => setScenario(e.target.value)}
          options={[
            { value: 'valid_data', label: 'Valid Data' },
            { value: 'required_only', label: 'Required Fields Only' },
            { value: 'negative_test', label: 'Negative Testing' },
            { value: 'boundary_test', label: 'Boundary Testing' },
            { value: 'international', label: 'International' },
          ]}
        />
      </div>

      <div className="flex gap-2">
        <Button
          variant="secondary"
          size="sm"
          className="flex-1"
          onClick={handleAnalyse}
          icon={isAnalyzing ? <Loader2 className="w-4 h-4 animate-spin" /> : <ScanSearch className="w-4 h-4" />}
          disabled={!scanResult || isAnalyzing}
          loading={isAnalyzing}
        >
          {isAnalyzing ? 'Analyzing...' : 'Analyse Form'}
        </Button>
        <Button
          variant="primary"
          size="sm"
          className="flex-1"
          onClick={handleExecute}
          icon={isExecuting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
          disabled={!scanResult || isExecuting}
          loading={isExecuting}
        >
          Execute
        </Button>
      </div>

      {/* Quick prompts */}
      <div className="space-y-2">
        <p className="text-xs text-white/40 font-medium uppercase tracking-wider">Quick Prompts</p>
        {[
          'Fill all required fields with valid data',
          'Generate a Sri Lankan software company profile',
          'Fill financial fields with balance sheet data',
          'Test boundary values for numeric fields',
          'Generate an international applicant profile',
        ].map(prompt => (
          <button
            key={prompt}
            className="w-full text-left px-3 py-2 rounded-lg text-xs text-white/60 hover:text-white bg-white/5 hover:bg-white/10 border border-white/5 transition-colors"
            onClick={() => setInstruction(prompt)}
          >
            {prompt}
          </button>
        ))}
      </div>
    </div>
  );
}

// ---- Fields Inspector Tab ----
function FieldsTab() {
  const { scanResult } = useScanStore();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const fields = scanResult?.fields ?? [];
  const filtered = fields.filter(f => {
    const matchSearch = !search ||
      (f.label?.toLowerCase().includes(search.toLowerCase())) ||
      (f.fieldName?.toLowerCase().includes(search.toLowerCase())) ||
      f.semanticType.toLowerCase().includes(search.toLowerCase());
    const matchFilter =
      filter === 'all' ||
      (filter === 'required' && f.required) ||
      (filter === 'ambiguous' && f.confidenceBand === 'low') ||
      (filter === 'sensitive' && f.isSensitive) ||
      (filter === 'files' && f.controlType === 'file');
    return matchSearch && matchFilter;
  });

  const statusIcon = (f: FieldDescriptor) => {
    if (f.isSensitive) return <Shield className="w-3 h-3 text-red-400" />;
    if (f.confidenceBand === 'high') return <CheckCircle className="w-3 h-3 text-green-400" />;
    if (f.confidenceBand === 'medium') return <AlertTriangle className="w-3 h-3 text-yellow-400" />;
    return <XCircle className="w-3 h-3 text-red-400" />;
  };

  return (
    <div className="space-y-3">
      <SectionHeader
        title="Field Inspector"
        subtitle={`${filtered.length} of ${fields.length} fields`}
      />

      <div className="flex gap-2">
        <div className="flex-1">
          <input
            type="text"
            placeholder="Search fields..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-white text-xs placeholder:text-white/30 focus:outline-none focus:border-brand-indigo"
          />
        </div>
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="px-2 py-1.5 rounded-lg bg-white/5 border border-white/10 text-white text-xs focus:outline-none appearance-none"
        >
          <option value="all">All</option>
          <option value="required">Required</option>
          <option value="ambiguous">Ambiguous</option>
          <option value="sensitive">Sensitive</option>
          <option value="files">Files</option>
        </select>
      </div>

      {fields.length === 0 ? (
        <EmptyState
          icon={<List className="w-8 h-8" />}
          title="No fields scanned"
          description="Scan a form to see all discovered fields here."
        />
      ) : (
        <div className="space-y-1">
          {filtered.map(field => (
            <div key={field.id}>
              <Card
                className={cn('cursor-pointer', expandedId === field.id && 'border-brand-indigo/50')}
                onClick={() => setExpandedId(expandedId === field.id ? null : field.id)}
              >
                <div className="flex items-start gap-2">
                  <div className="mt-0.5">{statusIcon(field)}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-white truncate">
                        {field.label ?? field.fieldName ?? field.id}
                      </span>
                      {field.required && <Badge variant="error" size="sm">Req</Badge>}
                      {field.isSensitive && <Badge variant="error" size="sm">🔒</Badge>}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[10px] text-white/40 font-mono">{field.semanticType}</span>
                      <span className="text-[10px] text-white/20">·</span>
                      <span className="text-[10px] text-white/40">{field.controlType}</span>
                    </div>
                  </div>
                  <ConfidenceIndicator score={field.confidence} band={field.confidenceBand} showLabel={false} />
                  <ChevronRight className={cn('w-3 h-3 text-white/30 transition-transform shrink-0', expandedId === field.id && 'rotate-90')} />
                </div>
              </Card>

              {expandedId === field.id && (
                <div className="ml-4 mt-1 p-3 rounded-lg bg-white/3 border border-white/5 space-y-2">
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-white/40">Type:</span>
                      <span className="text-white/80 ml-1">{field.htmlType}</span>
                    </div>
                    <div>
                      <span className="text-white/40">Required:</span>
                      <span className="text-white/80 ml-1">{field.required ? 'Yes' : 'No'}</span>
                    </div>
                    <div>
                      <span className="text-white/40">Source:</span>
                      <span className="text-white/80 ml-1">{field.classificationSource}</span>
                    </div>
                    <div>
                      <span className="text-white/40">Section:</span>
                      <span className="text-white/80 ml-1 truncate">{field.section ?? '—'}</span>
                    </div>
                  </div>
                  <div>
                    <span className="text-[10px] text-white/40 block mb-1">Confidence</span>
                    <ConfidenceIndicator score={field.confidence} band={field.confidenceBand} />
                  </div>
                  {field.evidence.length > 0 && (
                    <div>
                      <span className="text-[10px] text-white/40 block mb-1">Evidence</span>
                      {field.evidence.slice(0, 3).map((ev, i) => (
                        <div key={i} className="text-[10px] text-white/50 font-mono">
                          {ev.signal}: {ev.value.substring(0, 40)}
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="flex gap-2 pt-1">
                    <button
                      className="text-[10px] text-brand-indigo hover:text-brand-violet"
                      onClick={() => sendMessage({ type: 'SCAN_FORM', payload: { tabId: 0 } })}
                    >
                      Highlight on page
                    </button>
                    {field.isSensitive && (
                      <span className="text-[10px] text-red-400">Sensitive — will be skipped</span>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ---- Documents Tab ----
function DocumentsTab() {
  const { scanResult } = useScanStore();
  const [generating, setGenerating] = useState<string | null>(null);

  const fileFields = scanResult?.fileFields ?? [];

  const handleGenerate = async (fieldId: string, format: string) => {
    setGenerating(fieldId);
    // Document generation is triggered via messaging
    setTimeout(() => setGenerating(null), 2000);
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
        fileFields.map(field => (
          <Card key={field.id}>
            <div className="space-y-3">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-medium text-white">{field.label ?? field.fieldName ?? 'File Upload'}</p>
                  <p className="text-xs text-white/40 mt-0.5">
                    {field.acceptedExtensions.join(', ') || 'Any format'}
                    {field.maxFileSizeBytes && ` · Max ${Math.round(field.maxFileSizeBytes / 1024 / 1024)}MB`}
                  </p>
                </div>
                <div className="flex gap-1">
                  {field.required && <Badge variant="error" size="sm">Required</Badge>}
                  <Badge
                    variant={field.autoUploadRisk === 'known' ? 'error' : field.autoUploadRisk === 'possible' ? 'warning' : 'default'}
                    size="sm"
                  >
                    {field.autoUploadRisk === 'known' ? '⚠ Auto-upload' : field.autoUploadRisk === 'possible' ? '? Auto-upload' : 'Manual'}
                  </Badge>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                {['pdf', 'docx', 'xlsx', 'png', 'csv'].map(fmt => {
                  const accepted = field.acceptedExtensions.length === 0 || field.acceptedExtensions.includes(`.${fmt}`);
                  return (
                    <button
                      key={fmt}
                      disabled={!accepted || generating === field.id}
                      className={cn(
                        'px-2 py-1 rounded text-xs border transition-colors',
                        accepted
                          ? 'border-brand-indigo/50 text-brand-indigo hover:bg-brand-indigo/10'
                          : 'border-white/10 text-white/20 cursor-not-allowed'
                      )}
                      onClick={() => handleGenerate(field.id, fmt)}
                    >
                      {generating === field.id ? <Loader2 className="w-3 h-3 animate-spin inline" /> : fmt.toUpperCase()}
                    </button>
                  );
                })}
              </div>

              {field.documentSemanticType && (
                <p className="text-xs text-white/40">
                  Document type: <span className="text-brand-cyan">{field.documentSemanticType}</span>
                </p>
              )}
            </div>
          </Card>
        ))
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
        description="Execute a form fill to generate a detailed report."
      />
    );
  }

  const statusConfig: Record<string, { label: string; color: string }> = {
    filled_verified: { label: 'Filled & Verified', color: 'text-green-400' },
    filled_validation_unknown: { label: 'Filled (Unverified)', color: 'text-blue-400' },
    corrected_verified: { label: 'Corrected & Verified', color: 'text-cyan-400' },
    validation_failed: { label: 'Validation Failed', color: 'text-red-400' },
    skipped_existing: { label: 'Skipped (Existing)', color: 'text-gray-400' },
    skipped_sensitive: { label: 'Skipped (Sensitive)', color: 'text-orange-400' },
    unsupported_component: { label: 'Unsupported Component', color: 'text-yellow-400' },
    requires_manual_review: { label: 'Requires Review', color: 'text-yellow-400' },
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
        <StatCard label="Verified" value={report.filledVerified} variant="success" />
        <StatCard label="Failed" value={report.validationFailed} variant={report.validationFailed > 0 ? 'error' : 'default'} />
        <StatCard label="Skipped" value={report.skippedSensitive + report.skippedExisting} />
      </div>

      <Card>
        <div className="space-y-1.5">
          {report.fieldResults.slice(0, 20).map(result => {
            const cfg = statusConfig[result.status] ?? { label: result.status, color: 'text-white/40' };
            return (
              <div key={result.fieldId} className="flex items-center justify-between text-xs">
                <span className="text-white/60 font-mono truncate max-w-36">{result.fieldId}</span>
                <div className="flex items-center gap-2">
                  {result.generatedValue && (
                    <span className="text-white/30 truncate max-w-20">{result.generatedValue.displayValue}</span>
                  )}
                  <span className={cfg.color}>{cfg.label}</span>
                </div>
              </div>
            );
          })}
          {report.fieldResults.length > 20 && (
            <p className="text-xs text-white/30 text-center pt-1">
              +{report.fieldResults.length - 20} more fields
            </p>
          )}
        </div>
      </Card>

      {report.warnings.length > 0 && (
        <Card>
          <SectionHeader title="Warnings" />
          {report.warnings.map((w, i) => (
            <div key={i} className="flex items-start gap-2 text-xs text-yellow-400">
              <AlertTriangle className="w-3 h-3 shrink-0 mt-0.5" />
              {w}
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}

// ---- Main Side Panel App ----
function SidePanelApp() {
  const { scanResult, isScanning } = useScanStore();
  const { isExecuting } = useExecutionStore();
  const { activeTab, setActiveTab, theme, setTheme } = useUIStore();
  const [currentTabId, setCurrentTabId] = useState<number | null>(null);

  useEffect(() => {
    const syncSettings = async () => {
      try {
        const s = await loadSettings();
        if (s) {
          if (s.general?.theme === 'light' || s.general?.theme === 'dark') {
            setTheme(s.general.theme);
          }
          const aiStore = useAIStore.getState();
          aiStore.setIsAIEnabled(!!s.ai?.enabled);
          if (s.ai?.model) aiStore.setModel(s.ai.model);

          // Check if API key exists in session or local storage
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
      } catch { }
    };

    syncSettings();

    window.addEventListener('focus', syncSettings);

    const onStorageChange = () => {
      syncSettings();
    };
    if (typeof chrome !== 'undefined' && chrome.storage?.onChanged) {
      chrome.storage.onChanged.addListener(onStorageChange);
    }

    chrome.tabs.query({ active: true, currentWindow: true }).then(tabs => {
      if (tabs[0]?.id) setCurrentTabId(tabs[0].id);
    });

    const msgHandler = (msg: any) => {
      if (msg.type === 'SETTINGS_UPDATED') {
        syncSettings();
      }
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
      if (typeof chrome !== 'undefined' && chrome.storage?.onChanged) {
        chrome.storage.onChanged.removeListener(onStorageChange);
      }
      chrome.runtime?.onMessage?.removeListener(msgHandler);
    };
  }, []);

  const handleScan = async () => {
    if (!currentTabId) return;
    const store = useScanStore.getState();
    store.setIsScanning(true);
    store.setScanError(null);
    try {
      const res = await sendMessage({ type: 'SCAN_FORM', payload: { tabId: currentTabId } }) as any;
      if (res && res.error) {
        store.setScanError(res.error);
      } else if (res && res.fields) {
        store.setScanResult(res);
      }
    } catch (err) {
      store.setScanError('Failed to scan page. Try refreshing the target tab.');
    } finally {
      store.setIsScanning(false);
    }
  };

  const handleQuickFill = async () => {
    if (!scanResult) return;
    useExecutionStore.getState().setIsExecuting(true);
    await sendMessage({
      type: 'EXECUTE_PLAN',
      payload: {
        sessionId: scanResult.sessionId,
        origin: scanResult.origin,
        scenario: 'valid_data',
        locale: 'en-LK',
        actions: [],
        submitForm: false,
        preserveExisting: false,
        scope: 'all',
        maxRetries: 3,
        timeoutMs: 60000,
      },
    });
  };

  const TAB_COMPONENTS: Record<string, React.ComponentType> = {
    dashboard: DashboardTab,
    ai: AIAssistantTab,
    fields: FieldsTab,
    documents: DocumentsTab,
    scenarios: () => (
      <EmptyState
        icon={<Lightbulb className="w-8 h-8" />}
        title="Test Scenarios"
        description="Configure valid, negative, boundary and international test scenarios."
      />
    ),
    report: ReportTab,
  };

  const ActiveComponent = TAB_COMPONENTS[activeTab] ?? DashboardTab;

  return (
    <div className={cn('flex flex-col h-screen bg-dark-900 text-white', theme)}>
      {/* Header */}
      <div className="px-4 py-3 border-b border-white/5 bg-gradient-to-r from-dark-900 to-dark-800">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <img
              src="/icons/icon-32.png"
              alt="Fill Pro"
              className="w-7 h-7 rounded-lg shadow-sm border border-white/10"
            />
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-bold text-white">Fill Pro</span>
                <span className="text-[9px] font-semibold uppercase px-1.5 py-0.5 rounded-full bg-brand-indigo/20 text-brand-indigo border border-brand-indigo/30">v1.0</span>
              </div>
              <span className="text-[9px] text-white/30 ml-0.5">by toolls.io</span>
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="secondary"
              onClick={handleScan}
              loading={isScanning}
              icon={<ScanSearch className="w-3.5 h-3.5" />}
            >
              Scan
            </Button>
            <Button
              size="sm"
              variant="primary"
              onClick={handleQuickFill}
              disabled={!scanResult || isExecuting || scanResult.fillableFields === 0}
              loading={isExecuting}
              icon={<Zap className="w-3.5 h-3.5" />}
            >
              Fill
            </Button>
            <button
              className="p-1.5 rounded-lg text-white/40 hover:text-white hover:bg-white/10 transition-colors"
              onClick={async () => {
                const newTheme = theme === 'dark' ? 'light' : 'dark';
                setTheme(newTheme);
                try {
                  const s = await loadSettings();
                  if (s) {
                    await saveSettings({
                      ...s,
                      general: { ...s.general, theme: newTheme }
                    });
                  }
                } catch { }
              }}
              aria-label="Toggle theme"
            >
              {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
            <button
              className="p-1.5 rounded-lg text-white/40 hover:text-white hover:bg-white/10 transition-colors"
              onClick={() => chrome.runtime.openOptionsPage()}
            >
              <Settings className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-white/5 overflow-x-auto scrollbar-none">
        {TABS.map(tab => (
          <button
            key={tab.id}
            className={cn(
              'flex items-center gap-1.5 px-3 py-2.5 text-xs font-medium whitespace-nowrap transition-colors border-b-2',
              activeTab === tab.id
                ? 'text-brand-indigo border-brand-indigo'
                : 'text-white/40 border-transparent hover:text-white/70'
            )}
            onClick={() => setActiveTab(tab.id)}
          >
            <tab.icon className="w-3.5 h-3.5" />
            {tab.label}
            {tab.id === 'fields' && scanResult && (
              <Badge variant="info" size="sm">{scanResult.totalFields}</Badge>
            )}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        <ActiveComponent />
      </div>
    </div>
  );
}

// Mount
const container = document.getElementById('root');
if (container) {
  createRoot(container).render(<SidePanelApp />);
}

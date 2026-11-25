// ============================================================
// FILL PRO — Settings / Options Page Entry Point
// ============================================================

import React, { useState, useEffect, useCallback } from 'react';
import { createRoot } from 'react-dom/client';
import {
  Settings, Sparkles, Sliders, FileText, Shield, Info,
  CheckCircle, AlertCircle, Loader2, Trash2, Download, Upload, Eye, EyeOff, ExternalLink, RefreshCw,
} from 'lucide-react';
import { Button, Badge, Card, Input, Select, Toggle, SectionHeader, cn } from '../../src/components/ui/index.js';
import { DEFAULT_SETTINGS, GEMINI_MODELS, OPENAI_MODELS, CLAUDE_MODELS, AI_PROVIDERS, EXTENSION_VERSION, PUBLISHER, REPO_URL } from '../../src/constants/defaults.js';
import type { AppSettings, ApplicationKnowledge } from '../../src/types/index.js';
import { loadSettings, saveSettings } from '../../src/database/db.js';
import { listAllKnowledge, removeKnowledgeMapping, clearAllKnowledge } from '../../src/database/knowledgeBase.js';
import { LOCALE_PROFILES } from '../../src/constants/locales.js';
import '../../src/styles/globals.css';

const SETTINGS_TABS = [
  { id: 'general', icon: Settings, label: 'General' },
  { id: 'ai', icon: Sparkles, label: 'AI Configuration' },
  { id: 'generation', icon: Sliders, label: 'Generation' },
  { id: 'files', icon: FileText, label: 'Files & Templates' },
  { id: 'privacy', icon: Shield, label: 'Privacy & Security' },
  { id: 'about', icon: Info, label: 'About' },
];

function SettingsApp() {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [activeTab, setActiveTab] = useState('general');
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSettings().then(s => {
      if (s) setSettings(s);
      setLoading(false);
    });
  }, []);

  const handleSave = async () => {
    await saveSettings(settings);
    if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
      chrome.runtime.sendMessage({ type: 'SETTINGS_UPDATED', payload: settings }).catch(() => {});
    }
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const update = (path: string[], value: unknown) => {
    setSettings(prev => {
      const next = { ...prev };
      let obj: Record<string, unknown> = next as Record<string, unknown>;
      for (let i = 0; i < path.length - 1; i++) {
        obj[path[i]!] = { ...(obj[path[i]!] as object) };
        obj = obj[path[i]!] as Record<string, unknown>;
      }
      obj[path[path.length - 1]!] = value;
      return next;
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-dark-900">
        <Loader2 className="w-8 h-8 animate-spin text-brand-indigo" />
      </div>
    );
  }

  return (
    <div className={cn('min-h-screen bg-dark-900 text-white flex flex-col', settings.general.theme === 'light' ? 'light' : 'dark')}>
      {/* Header */}
      <div className="sticky top-0 z-30 bg-dark-900/90 backdrop-blur-md border-b border-white/5 px-4 sm:px-8 py-3.5 sm:py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 shrink-0 bg-gradient-to-br from-brand-indigo to-brand-violet rounded-xl flex items-center justify-center shadow-brand">
              <Settings className="w-5 h-5 text-white" />
            </div>
            <div className="min-w-0">
              <h1 className="text-base sm:text-lg font-bold text-white truncate">Fill Pro Settings</h1>
              <p className="text-xs text-white/40 hidden sm:block truncate">Configure your intelligent form-filling experience</p>
            </div>
          </div>
          <Button
            variant={saved ? 'success' : 'primary'}
            size="sm"
            onClick={handleSave}
            icon={saved ? <CheckCircle className="w-4 h-4" /> : undefined}
          >
            {saved ? 'Saved!' : 'Save Changes'}
          </Button>
        </div>
      </div>

      <div className="max-w-5xl mx-auto w-full flex flex-col md:flex-row gap-5 p-4 sm:p-6 md:p-8 flex-1">
        {/* Navigation Sidebar / Horizontal Pills on mobile */}
        <div className="flex md:flex-col overflow-x-auto md:overflow-visible scrollbar-none gap-1.5 shrink-0 md:w-52 pb-2 md:pb-0 border-b md:border-b-0 border-white/5">
          {SETTINGS_TABS.map(tab => (
            <button
              key={tab.id}
              className={cn(
                'flex items-center gap-2 px-3 py-2 rounded-lg text-xs sm:text-sm font-medium whitespace-nowrap transition-colors shrink-0',
                activeTab === tab.id
                  ? 'bg-brand-indigo/20 text-brand-indigo border border-brand-indigo/30'
                  : 'text-white/50 hover:text-white hover:bg-white/5 border border-transparent'
              )}
              onClick={() => setActiveTab(tab.id)}
            >
              <tab.icon className="w-4 h-4 shrink-0" />
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0 space-y-6">
          {activeTab === 'general' && (
            <GeneralTab settings={settings} update={update} />
          )}
          {activeTab === 'ai' && (
            <AITab settings={settings} update={update} />
          )}
          {activeTab === 'generation' && (
            <GenerationTab settings={settings} update={update} />
          )}
          {activeTab === 'files' && (
            <FilesTab settings={settings} update={update} />
          )}
          {activeTab === 'privacy' && (
            <PrivacyTab settings={settings} update={update} />
          )}
          {activeTab === 'about' && (
            <AboutTab />
          )}
        </div>
      </div>
    </div>
  );
}

// ---- General Tab ----
function GeneralTab({ settings, update }: { settings: AppSettings; update: (path: string[], value: unknown) => void }) {
  const localeOptions = Object.values(LOCALE_PROFILES).map(l => ({ value: l.id, label: l.label }));

  return (
    <div className="space-y-6">
      <SectionHeader title="General Settings" subtitle="Default preferences for form filling" />

      <Card>
        <div className="space-y-4">
          <Select
            label="Default Locale"
            value={settings.general.defaultLocale}
            onChange={(e) => update(['general', 'defaultLocale'], e.target.value)}
            options={localeOptions}
          />

          <Select
            label="Default Test Scenario"
            value={settings.general.defaultScenario}
            onChange={(e) => update(['general', 'defaultScenario'], e.target.value)}
            options={[
              { value: 'valid_data', label: 'Valid Data' },
              { value: 'required_only', label: 'Required Fields Only' },
              { value: 'negative_test', label: 'Negative Testing' },
              { value: 'boundary_test', label: 'Boundary Testing' },
              { value: 'international', label: 'International' },
            ]}
          />

          <Select
            label="Default Generation Mode"
            value={settings.general.defaultGenerationMode || 'SMART_FILL'}
            onChange={(e) => update(['general', 'defaultGenerationMode'], e.target.value)}
            options={[
              { value: 'SMART_FILL', label: 'Smart Fill (AI + Local Intelligence)' },
              { value: 'QUICK_FILL', label: 'Quick Fill (Local Generation Only)' },
              { value: 'CUSTOM_AI_FILL', label: 'Custom AI Fill (Prompted)' },
            ]}
          />

          <Select
            label="Theme"
            value={settings.general.theme}
            onChange={(e) => update(['general', 'theme'], e.target.value)}
            options={[
              { value: 'dark', label: 'Dark' },
              { value: 'light', label: 'Light' },
              { value: 'system', label: 'System' },
            ]}
          />

          <div className="space-y-3 pt-2">
            <Toggle
              checked={settings.general.preserveExistingValues}
              onChange={(v) => update(['general', 'preserveExistingValues'], v)}
              label="Preserve existing values by default"
            />
            <Toggle
              checked={settings.general.rememberMappings}
              onChange={(v) => update(['general', 'rememberMappings'], v)}
              label="Remember confirmed field mappings"
            />
            <Toggle
              checked={settings.general.previewBeforeFilling}
              onChange={(v) => update(['general', 'previewBeforeFilling'], v)}
              label="Preview generated values before filling"
            />
          </div>
        </div>
      </Card>
    </div>
  );
}

// ---- AI Tab ----
function AITab({ settings, update }: { settings: AppSettings; update: (path: string[], value: unknown) => void }) {
  const [apiKey, setApiKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [fetchedModels, setFetchedModels] = useState<Array<{ id: string; label: string; recommended?: boolean }>>([]);
  const [fetchingModels, setFetchingModels] = useState(false);

  const fetchModels = useCallback(async (keyToUse?: string, provToUse?: string) => {
    const k = keyToUse ?? apiKey;
    const p = provToUse ?? (settings.ai.provider || 'gemini');
    if (!k) return;
    setFetchingModels(true);
    try {
      const res = await chrome.runtime.sendMessage({
        type: 'FETCH_AI_MODELS',
        payload: { provider: p, apiKey: k },
      });
      if (res?.success && res.models?.length > 0) {
        setFetchedModels(res.models);
      }
    } catch (err) {
      console.warn('[FillPro] Failed to fetch models:', err);
    } finally {
      setFetchingModels(false);
    }
  }, [apiKey, settings.ai.provider]);

  useEffect(() => {
    if (typeof chrome !== 'undefined' && chrome.storage) {
      chrome.storage.session?.get(['geminiApiKey', 'apiKey']).then(res => {
        const k = res?.geminiApiKey || res?.apiKey;
        if (k) {
          setApiKey(k);
          fetchModels(k);
        } else {
          chrome.storage.local?.get(['geminiApiKey', 'apiKey']).then(lres => {
            const lk = lres?.geminiApiKey || lres?.apiKey;
            if (lk) {
              setApiKey(lk);
              fetchModels(lk);
            }
          });
        }
      }).catch(() => {});
    }
  }, [fetchModels]);

  const handleTestConnection = async () => {
    if (!apiKey) return;
    setTesting(true);
    try {
      const result = await chrome.runtime.sendMessage({
        type: 'TEST_AI_CONNECTION',
        payload: { apiKey, model: settings.ai.model, provider: settings.ai.provider || 'gemini' },
      });
      setTestResult({
        success: result.success,
        message: result.success
          ? `Connected! Latency: ${result.latencyMs}ms`
          : result.error ?? 'Connection failed',
      });
      if (result.success) {
        // Store key in session and local storage
        await chrome.storage.session?.set({ geminiApiKey: apiKey, apiKey });
        await chrome.storage.local?.set({ geminiApiKey: apiKey, apiKey });
        update(['ai', 'enabled'], true);
        fetchModels(apiKey);
        if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
          chrome.runtime.sendMessage({ type: 'SETTINGS_UPDATED' }).catch(() => {});
        }
      }
    } catch (err) {
      setTestResult({ success: false, message: String(err) });
    } finally {
      setTesting(false);
    }
  };

  const handleRemoveKey = async () => {
    await chrome.storage.session?.remove(['geminiApiKey', 'apiKey']);
    await chrome.storage.local?.remove(['geminiApiKey', 'apiKey']);
    setApiKey('');
    setTestResult(null);
    setFetchedModels([]);
    update(['ai', 'enabled'], false);
    if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
      chrome.runtime.sendMessage({ type: 'SETTINGS_UPDATED' }).catch(() => {});
    }
  };

  const handleKeyChange = (val: string) => {
    const trimmed = val.trim();
    setApiKey(trimmed);
    if (typeof chrome !== 'undefined' && chrome.storage) {
      if (trimmed) {
        chrome.storage.session?.set({ geminiApiKey: trimmed, apiKey: trimmed }).catch(() => {});
        chrome.storage.local?.set({ geminiApiKey: trimmed, apiKey: trimmed }).catch(() => {});
        fetchModels(trimmed);
      } else {
        chrome.storage.session?.remove(['geminiApiKey', 'apiKey']).catch(() => {});
        chrome.storage.local?.remove(['geminiApiKey', 'apiKey']).catch(() => {});
        setFetchedModels([]);
      }
    }
  };

  const modelOptions = fetchedModels.length > 0
    ? fetchedModels.map(m => ({ value: m.id, label: m.label }))
    : settings.ai.provider === 'openai'
    ? OPENAI_MODELS.map(m => ({ value: m.id, label: m.label }))
    : settings.ai.provider === 'claude'
    ? CLAUDE_MODELS.map(m => ({ value: m.id, label: m.label }))
    : GEMINI_MODELS.map(m => ({ value: m.id, label: m.label }));

  return (
    <div className="space-y-6">
      <SectionHeader title="AI Configuration" subtitle="Configure Gemini, OpenAI, or Claude for intelligent form analysis" />

      <Card>
        <div className="space-y-4">
          <Toggle
            checked={settings.ai.enabled}
            onChange={(v) => {
              update(['ai', 'enabled'], v);
              if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
                chrome.runtime.sendMessage({ type: 'SETTINGS_UPDATED' }).catch(() => {});
              }
            }}
            label="Enable AI Assistance"
          />

          <Select
            label="AI Provider"
            value={settings.ai.provider || 'gemini'}
            onChange={(e) => {
              const prov = e.target.value;
              update(['ai', 'provider'], prov);
              if (prov === 'gemini') update(['ai', 'model'], 'gemini-3.5-flash');
              else if (prov === 'openai') update(['ai', 'model'], 'gpt-4o-mini');
              else if (prov === 'claude') update(['ai', 'model'], 'claude-3-5-haiku-20241022');
              fetchModels(apiKey, prov);
            }}
            options={AI_PROVIDERS.map(p => ({ value: p.id, label: p.label }))}
          />

          <div className="relative">
            <Input
              label={`${(settings.ai.provider === 'openai' ? 'OpenAI' : settings.ai.provider === 'claude' ? 'Claude' : 'Gemini')} API Key`}
              type={showKey ? 'text' : 'password'}
              value={apiKey}
              onChange={(e) => handleKeyChange(e.target.value)}
              placeholder={
                settings.ai.provider === 'openai'
                  ? 'sk-...'
                  : settings.ai.provider === 'claude'
                  ? 'sk-ant-...'
                  : 'AIzaSy... or AQ....'
              }
              hint="Your key is stored in session and local extension storage and never sent to third-party tracking servers."
            />
            <button
              className="absolute right-3 top-7 text-white/40 hover:text-white"
              onClick={() => setShowKey(!showKey)}
              type="button"
            >
              {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-medium text-white/70">Model</label>
              {apiKey && (
                <button
                  type="button"
                  onClick={() => fetchModels()}
                  disabled={fetchingModels}
                  className="text-[11px] text-brand-indigo hover:text-brand-violet flex items-center gap-1 transition-colors"
                >
                  <RefreshCw className={cn("w-3 h-3", fetchingModels && "animate-spin")} />
                  <span>{fetchingModels ? 'Fetching...' : 'Fetch Models from Key'}</span>
                </button>
              )}
            </div>
            <Select
              value={settings.ai.model}
              onChange={(e) => update(['ai', 'model'], e.target.value)}
              options={modelOptions}
            />
            {fetchedModels.length > 0 && (
              <p className="text-[11px] text-green-400/80">
                ✓ {fetchedModels.length} models fetched dynamically using your API key.
              </p>
            )}
          </div>

          <div className="flex gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={handleTestConnection}
              loading={testing}
              disabled={!apiKey}
              icon={<CheckCircle className="w-4 h-4" />}
            >
              Test Connection
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleRemoveKey}
              icon={<Trash2 className="w-4 h-4" />}
            >
              Remove Key
            </Button>
          </div>

          {testResult && (
            <div className={cn(
              'flex items-center gap-2 p-3 rounded-lg text-sm',
              testResult.success ? 'bg-success/20 text-green-400' : 'bg-error/20 text-red-400'
            )}>
              {testResult.success ? <CheckCircle className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
              {testResult.message}
            </div>
          )}

          <div className="pt-2 space-y-3">
            <Toggle
              checked={settings.ai.localOnlyMode}
              onChange={(v) => update(['ai', 'localOnlyMode'], v)}
              label="Local-only mode (no AI requests)"
            />
            <Toggle
              checked={settings.ai.screenshotAnalysis}
              onChange={(v) => update(['ai', 'screenshotAnalysis'], v)}
              label="Allow screenshot analysis (requires explicit consent per session)"
            />
          </div>

          <div className="text-xs text-white/30 p-3 rounded-lg bg-white/3 border border-white/5">
            <strong className="text-white/50">Privacy note:</strong> Fill Pro only sends sanitized field metadata to Gemini. No real form values, passwords, session tokens or complete page content are ever transmitted. See our Privacy Policy for details.
          </div>
        </div>
      </Card>
    </div>
  );
}

// ---- Generation Tab ----
function GenerationTab({ settings, update }: { settings: AppSettings; update: (path: string[], value: unknown) => void }) {
  return (
    <div className="space-y-6">
      <SectionHeader title="Data Generation" subtitle="Configure how synthetic data is generated" />

      <Card>
        <div className="space-y-4">
          <Input
            label="Synthetic Email Domain"
            value={settings.generation.emailDomain}
            onChange={(e) => update(['generation', 'emailDomain'], e.target.value)}
            hint="Used for all generated email addresses (e.g. example.com)"
          />

          <Select
            label="Preferred Date Format"
            value={settings.generation.preferredDateFormat}
            onChange={(e) => update(['generation', 'preferredDateFormat'], e.target.value)}
            options={[
              { value: 'dd/MM/yyyy', label: 'DD/MM/YYYY (e.g. 24/11/2026)' },
              { value: 'MM/dd/yyyy', label: 'MM/DD/YYYY (e.g. 11/24/2026)' },
              { value: 'yyyy-MM-dd', label: 'YYYY-MM-DD (ISO 8601)' },
              { value: 'dd.MM.yyyy', label: 'DD.MM.YYYY (European)' },
            ]}
          />

          <Select
            label="Default Currency"
            value={settings.generation.currency}
            onChange={(e) => update(['generation', 'currency'], e.target.value)}
            options={[
              { value: 'LKR', label: 'LKR — Sri Lankan Rupee' },
              { value: 'USD', label: 'USD — US Dollar' },
              { value: 'GBP', label: 'GBP — British Pound' },
              { value: 'EUR', label: 'EUR — Euro' },
              { value: 'AUD', label: 'AUD — Australian Dollar' },
              { value: 'AED', label: 'AED — UAE Dirham' },
              { value: 'INR', label: 'INR — Indian Rupee' },
              { value: 'SGD', label: 'SGD — Singapore Dollar' },
            ]}
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label="Number Min"
              type="number"
              value={settings.generation.defaultNumberMin}
              onChange={(e) => update(['generation', 'defaultNumberMin'], parseInt(e.target.value))}
            />
            <Input
              label="Number Max"
              type="number"
              value={settings.generation.defaultNumberMax}
              onChange={(e) => update(['generation', 'defaultNumberMax'], parseInt(e.target.value))}
            />
          </div>
        </div>
      </Card>
    </div>
  );
}

// ---- Files Tab ----
function FilesTab({ settings, update }: { settings: AppSettings; update: (path: string[], value: unknown) => void }) {
  return (
    <div className="space-y-6">
      <SectionHeader title="Files & Templates" subtitle="Configure document generation and file library" />

      <Card>
        <div className="space-y-4">
          <Select
            label="Default File Format"
            value={settings.files.defaultFileFormat}
            onChange={(e) => update(['files', 'defaultFileFormat'], e.target.value)}
            options={[
              { value: 'pdf', label: 'PDF Document' },
              { value: 'docx', label: 'Word Document' },
              { value: 'xlsx', label: 'Excel Spreadsheet' },
              { value: 'csv', label: 'CSV File' },
              { value: 'png', label: 'PNG Image' },
            ]}
          />

          <Select
            label="Default Generation Mode"
            value={settings.files.defaultGenerationMode}
            onChange={(e) => update(['files', 'defaultGenerationMode'], e.target.value)}
            options={[
              { value: 'generic', label: 'Generic (No AI required)' },
              { value: 'contextual', label: 'Context-Aware (Requires AI)' },
              { value: 'template', label: 'Template-Based' },
            ]}
          />

          <div>
            <label className="block text-xs font-medium text-white/70 mb-1.5">
              Max Generated File Size
            </label>
            <div className="text-sm text-white/80">
              {Math.round(settings.files.maxGeneratedFileSizeBytes / 1024 / 1024)} MB
            </div>
            <input
              type="range"
              min={1}
              max={50}
              value={Math.round(settings.files.maxGeneratedFileSizeBytes / 1024 / 1024)}
              onChange={(e) => update(['files', 'maxGeneratedFileSizeBytes'], parseInt(e.target.value) * 1024 * 1024)}
              className="w-full mt-1"
            />
          </div>
        </div>
      </Card>
    </div>
  );
}

// ---- Privacy Tab ----
function PrivacyTab({ settings, update }: { settings: AppSettings; update: (path: string[], value: unknown) => void }) {
  const [mappings, setMappings] = useState<ApplicationKnowledge[]>([]);

  const loadMappings = useCallback(() => {
    listAllKnowledge().then(setMappings).catch(() => {});
  }, []);

  useEffect(() => {
    loadMappings();
  }, [loadMappings]);

  return (
    <div className="space-y-6">
      <SectionHeader title="Privacy & Security" subtitle="Control website access, learned mappings, and data handling" />

      <Card>
        <div className="space-y-4">
          <Toggle
            checked={settings.privacy.developmentOnly}
            onChange={(v) => update(['privacy', 'developmentOnly'], v)}
            label="Development environments only (localhost & user-defined)"
          />

          <div>
            <label className="block text-xs font-medium text-white/70 mb-1.5">
              Allowed Origins (one per line)
            </label>
            <textarea
              value={settings.privacy.allowedOrigins.join('\n')}
              onChange={(e) => update(['privacy', 'allowedOrigins'], e.target.value.split('\n').filter(Boolean))}
              className="w-full h-24 px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm font-mono placeholder:text-white/30 focus:outline-none focus:border-brand-indigo resize-none"
              placeholder="localhost&#10;127.0.0.1&#10;app.example.com"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-white/70 mb-1.5">
              Sensitive Field Keywords (skip these)
            </label>
            <Input
              value={settings.privacy.sensitiveFieldExclusions.join(', ')}
              onChange={(e) => update(['privacy', 'sensitiveFieldExclusions'], e.target.value.split(',').map(s => s.trim()).filter(Boolean))}
              hint="Comma-separated keywords. Fields matching these will never be filled."
            />
          </div>

          <div className="pt-2 space-y-2">
            <Button
              variant="ghost"
              size="sm"
              icon={<Trash2 className="w-4 h-4" />}
              className="text-red-400 hover:text-red-300 w-full justify-start"
              onClick={async () => {
                await clearAllKnowledge();
                loadMappings();
              }}
            >
              Clear Application Learning Data
            </Button>
          </div>
        </div>
      </Card>

      {/* Learned Knowledge Base Mappings */}
      <Card>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-white">Learned Field Mappings</h3>
              <p className="text-xs text-white/40">
                Semantic classifications remembered per origin (no form values stored)
              </p>
            </div>
            <Badge variant="info" size="sm">{mappings.length} saved</Badge>
          </div>

          {mappings.length === 0 ? (
            <p className="text-xs text-white/30 py-3 text-center">No learned mappings yet.</p>
          ) : (
            <div className="space-y-1.5 max-h-60 overflow-y-auto">
              {mappings.map(m => (
                <div
                  key={m.id ?? `${m.origin}-${m.fieldFingerprint}`}
                  className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-white/5 border border-white/5 text-xs"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono text-white/80 truncate">{m.semanticType}</span>
                      <Badge variant={m.source === 'user_confirmed' ? 'success' : 'default'} size="sm">
                        {m.source}
                      </Badge>
                    </div>
                    <p className="text-[10px] text-white/40 truncate">{m.origin}</p>
                  </div>
                  {m.id !== undefined && (
                    <button
                      type="button"
                      onClick={async () => {
                        await removeKnowledgeMapping(m.id!);
                        loadMappings();
                      }}
                      className="p-1 text-white/40 hover:text-red-400 shrink-0"
                      aria-label="Remove mapping"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}

// ---- About Tab ----
function AboutTab() {
  return (
    <div className="space-y-6">
      <SectionHeader title="About Fill Pro" />

      <Card>
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-gradient-to-br from-brand-indigo to-brand-violet rounded-2xl flex items-center justify-center shadow-brand">
              <span className="text-2xl">⚡</span>
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Fill Pro</h2>
              <p className="text-sm text-white/50">Understand Forms. Generate Data. Test Faster.</p>
              <div className="flex items-center gap-2 mt-1">
                <Badge variant="info" size="sm">v{EXTENSION_VERSION}</Badge>
                <Badge variant="default" size="sm">MIT License</Badge>
              </div>
            </div>
          </div>

          <div className="text-xs text-white/50 space-y-1">
            <p>Publisher: <span className="text-white/80">{PUBLISHER}</span></p>
            <p>Category: AI-powered developer tool</p>
            <p>Manifest: Chrome MV3</p>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <a
              href={REPO_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-white/70 hover:text-white transition-colors"
            >
              <ExternalLink className="w-4 h-4" /> GitHub
            </a>
            <a
              href={`${REPO_URL}/blob/main/PRIVACY.md`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-white/70 hover:text-white transition-colors"
            >
              <Shield className="w-4 h-4" /> Privacy Policy
            </a>
          </div>

          <div className="text-xs text-white/30 p-3 rounded-lg bg-white/3 border border-white/5">
            Fill Pro is open-source software. It never automatically submits forms, makes purchases, or performs any irreversible actions without your explicit confirmation.
          </div>
        </div>
      </Card>
    </div>
  );
}

// Mount
const container = document.getElementById('root');
if (container) {
  createRoot(container).render(<SettingsApp />);
}

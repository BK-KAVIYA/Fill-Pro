// ============================================================
// FILL PRO — Popup Entry Point
// ============================================================

import React, { useState, useEffect, useCallback } from 'react';
import { createRoot } from 'react-dom/client';
import {
  Zap, Settings, Sun, Moon, ScanSearch, Wand2, FileText,
  Sparkles, AlertCircle, CheckCircle, Loader2, ChevronRight,
  Layers, Upload, Eye, EyeOff, RotateCcw, PanelRight, Info,
  ArrowLeft, ExternalLink, Save, Sliders, Shield
} from 'lucide-react';
import {
  Button, Badge, StatCard, StatusDot, Toggle, Select, Input, EmptyState, cn,
} from '../../src/components/ui/index.js';
import { useScanStore, useExecutionStore, useAIStore, useUIStore } from '../../src/stores/index.js';
import { sendMessage, getCurrentTab } from '../../src/messaging/index.js';
import { LOCALE_PROFILES } from '../../src/constants/locales.js';
import { GEMINI_MODELS, OPENAI_MODELS, CLAUDE_MODELS, AI_PROVIDERS } from '../../src/constants/defaults.js';
import { loadSettings, saveSettings } from '../../src/database/db.js';
import '../../src/styles/globals.css';

// ---- Logo ----
function FillProLogo() {
  return (
    <div className="flex items-center gap-2.5">
      <img
        src="/icons/icon-32.png"
        alt="Fill Pro"
        className="w-7 h-7 rounded-lg shadow-sm border border-white/10"
      />
      <div>
        <div className="flex items-center gap-1.5">
          <span className="text-sm font-bold tracking-tight text-white">Fill Pro</span>
          <span className="text-[9px] font-semibold uppercase px-1.5 py-0.5 rounded-full bg-brand-indigo/20 text-brand-indigo border border-brand-indigo/30">v1.0</span>
        </div>
        <span className="text-[9px] text-white/40 block leading-none mt-0.5">by toolls.io</span>
      </div>
    </div>
  );
}

// ---- Environment Badge ----
function EnvironmentBadge({ url }: { url?: string }) {
  if (!url) return null;
  const isLocal = url.includes('localhost') || url.includes('127.0.0.1');
  const isChrome = url.startsWith('chrome://') || url.startsWith('chrome-extension://');

  if (isChrome) return <Badge variant="error">Unsupported Page</Badge>;
  if (isLocal) return <Badge variant="success">Local Dev</Badge>;
  return <Badge variant="warning">External Site</Badge>;
}

// ---- Quick Action Button ----
interface QuickActionProps {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  loading?: boolean;
  disabled?: boolean;
  variant?: 'primary' | 'secondary' | 'ghost';
  badge?: string;
}

function QuickAction({ icon, label, onClick, loading, disabled, variant = 'secondary', badge }: QuickActionProps) {
  return (
    <button
      className={cn(
        'flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150 w-full',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-indigo',
        variant === 'primary' && 'bg-gradient-to-r from-brand-indigo to-brand-violet text-white hover:opacity-90 shadow-brand',
        variant === 'secondary' && 'bg-white/5 text-white/80 border border-white/10 hover:bg-white/10 hover:text-white',
        variant === 'ghost' && 'text-white/60 hover:bg-white/5 hover:text-white',
        (disabled || loading) && 'opacity-40 cursor-not-allowed',
      )}
      onClick={onClick}
      disabled={disabled || loading}
      aria-label={label}
      aria-busy={loading}
    >
      {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : icon}
      <span className="flex-1 text-left">{label}</span>
      {badge && <Badge variant="info" size="sm">{badge}</Badge>}
    </button>
  );
}

// ---- Main Popup App ----
function PopupApp() {
  const { scanResult, isScanning, scanError, setScanResult, setIsScanning, setScanError } = useScanStore();
  const { isExecuting, progress } = useExecutionStore();
  const { isAIEnabled, isConnected, setIsAIEnabled, setIsConnected } = useAIStore();
  const { theme, setTheme } = useUIStore();

  const [view, setView] = useState<'main' | 'settings'>('main');
  const [currentUrl, setCurrentUrl] = useState<string>('');
  const [currentTabId, setCurrentTabId] = useState<number | null>(null);
  const [locale, setLocale] = useState('en-LK');
  const [scenario, setScenario] = useState('valid_data');
  const [preserveExisting, setPreserveExisting] = useState(false);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Settings view state
  const [aiProvider, setAiProvider] = useState<'gemini' | 'openai' | 'claude'>('gemini');
  const [geminiKey, setGeminiKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [aiModel, setAiModel] = useState('gemini-3.5-flash');
  const [localOnlyMode, setLocalOnlyMode] = useState(false);
  const [testingAI, setTestingAI] = useState(false);
  const [aiTestResult, setAiTestResult] = useState<{ success: boolean; message: string } | null>(null);

  const isChromePage = currentUrl.startsWith('chrome://') || currentUrl.startsWith('chrome-extension://');

  useEffect(() => {
    getCurrentTab().then(tab => {
      if (tab?.url) setCurrentUrl(tab.url);
      if (tab?.id) setCurrentTabId(tab.id);
    }).catch(() => { });

    loadSettings().then(s => {
      if (s) {
        setLocale(s.general?.defaultLocale || 'en-LK');
        setScenario(s.general?.defaultScenario || 'valid_data');
        setPreserveExisting(!!s.general?.preserveExistingValues);
        setAiModel(s.ai?.model || 'gemini-3.5-flash');
        setLocalOnlyMode(!!s.ai?.localOnlyMode);
        if (s.ai?.provider && s.ai.provider !== 'local') {
          setAiProvider(s.ai.provider as any);
        }
        if (s.general?.theme === 'light' || s.general?.theme === 'dark') {
          setTheme(s.general.theme);
        }
      }
    }).catch(() => { });

    if (typeof chrome !== 'undefined' && chrome.storage?.session) {
      chrome.storage.session.get('geminiApiKey').then(res => {
        if (res?.geminiApiKey) {
          setGeminiKey(res.geminiApiKey);
          setIsConnected(true);
        }
      }).catch(() => { });
    }

    // Listen for messages from background
    if (typeof chrome !== 'undefined' && chrome.runtime?.onMessage) {
      chrome.runtime.onMessage.addListener((msg) => {
        if (msg.type === 'SCAN_RESULT') {
          setScanResult(msg.payload);
          setIsScanning(false);
        }
      });
    }
  }, []);

  const notify = useCallback((type: 'success' | 'error', text: string) => {
    setNotification({ type, text });
    setTimeout(() => setNotification(null), 3000);
  }, []);

  const handleScan = async () => {
    if (!currentTabId || isChromePage) return;
    setIsScanning(true);
    setScanError(null);
    try {
      const res = await sendMessage({ type: 'SCAN_FORM', payload: { tabId: currentTabId } }) as any;
      if (res && res.error) {
        setScanError(`Scan failed: ${res.error}`);
      } else if (res && res.fields) {
        setScanResult(res);
      }
    } catch (err) {
      setScanError('Failed to connect to the page. Please refresh the page and try again.');
    } finally {
      setIsScanning(false);
    }
  };

  const handleQuickFill = async () => {
    if (!scanResult || isExecuting) return;
    try {
      const res = await sendMessage({
        type: 'EXECUTE_PLAN',
        payload: {
          sessionId: scanResult.sessionId,
          origin: scanResult.origin,
          scenario: scenario as 'valid_data',
          locale,
          actions: [],
          submitForm: false,
          preserveExisting,
          scope: 'all',
          maxRetries: 3,
          timeoutMs: 60000,
        },
      }) as any;
      if (res && res.error) {
        notify('error', res.error);
      } else {
        notify('success', 'Fill operation started!');
      }
    } catch (err) {
      notify('error', 'Fill operation failed');
    }
  };

  const handleOpenSidePanel = async () => {
    if (!currentTabId) return;
    try {
      await chrome.sidePanel.open({ tabId: currentTabId });
      window.close();
    } catch {
      notify('error', 'Could not open side panel');
    }
  };

  const handleUndo = async () => {
    if (!scanResult) return;
    await sendMessage({ type: 'UNDO_SESSION', payload: { sessionId: scanResult.sessionId } });
    notify('success', 'Undo applied');
  };

  const handleTestAI = async () => {
    if (!geminiKey) return;
    setTestingAI(true);
    setAiTestResult(null);
    try {
      const res: any = await chrome.runtime.sendMessage({
        type: 'TEST_AI_CONNECTION',
        payload: { apiKey: geminiKey, model: aiModel, provider: aiProvider },
      });
      if (res?.success) {
        if (typeof chrome !== 'undefined' && chrome.storage?.session) {
          await chrome.storage.session.set({
            geminiApiKey: geminiKey,
            aiApiKey: geminiKey,
            aiProvider,
          }).catch(() => {});
        }
        setIsConnected(true);
        setIsAIEnabled(true);
        setAiTestResult({ success: true, message: `Connected! (${res.latencyMs || 100}ms)` });
      } else {
        setAiTestResult({ success: false, message: res?.error || 'Connection failed' });
      }
    } catch (err: any) {
      setAiTestResult({ success: false, message: String(err?.message || err) });
    } finally {
      setTestingAI(false);
    }
  };

  const handleSaveSettings = async () => {
    try {
      const current = await loadSettings();
      await saveSettings({
        ...current,
        general: {
          ...current?.general,
          defaultLocale: locale,
          defaultScenario: scenario,
          preserveExistingValues: preserveExisting,
          theme,
        },
        ai: {
          ...current?.ai,
          provider: aiProvider,
          model: aiModel,
          localOnlyMode,
          enabled: isAIEnabled,
        },
      });
      if (geminiKey && typeof chrome !== 'undefined' && chrome.storage?.session) {
        await chrome.storage.session.set({
          geminiApiKey: geminiKey,
          aiApiKey: geminiKey,
          aiProvider,
        }).catch(() => {});
      }
      notify('success', 'Settings saved');
      setView('main');
    } catch {
      notify('error', 'Could not save settings');
    }
  };

  const localeOptions = Object.values(LOCALE_PROFILES).map(l => ({ value: l.id, label: l.label }));
  const scenarioOptions = [
    { value: 'valid_data', label: 'Valid Data' },
    { value: 'required_only', label: 'Required Fields Only' },
    { value: 'negative_test', label: 'Negative Testing' },
    { value: 'boundary_test', label: 'Boundary Testing' },
    { value: 'international', label: 'International' },
  ];

  if (view === 'settings') {
    return (
      <div className={cn('w-full h-full bg-dark-900 text-white flex flex-col overflow-hidden', theme)}>
        {/* Settings Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/5 bg-gradient-to-r from-dark-900 to-dark-800 shrink-0">
          <div className="flex items-center gap-2">
            <button
              className="p-1 rounded-lg text-white/50 hover:text-white hover:bg-white/10 transition-colors"
              onClick={() => setView('main')}
              aria-label="Back"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <span className="text-sm font-bold text-white">Settings</span>
          </div>
          <button
            className="flex items-center gap-1 px-2 py-1 rounded text-xs text-brand-indigo hover:text-brand-violet hover:bg-brand-indigo/10 transition-colors"
            onClick={() => chrome.runtime.openOptionsPage()}
            title="Open full page settings tab"
          >
            <span>Full Page</span>
            <ExternalLink className="w-3 h-3" />
          </button>
        </div>

        {/* Scrollable Settings Form */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden p-4 space-y-4 min-h-0">
          <div className="space-y-3">
            <p className="text-xs text-white/40 font-medium uppercase tracking-wider">General</p>
            <Select
              label="Default Locale"
              value={locale}
              onChange={(e) => setLocale(e.target.value)}
              options={localeOptions}
            />
            <Select
              label="Default Scenario"
              value={scenario}
              onChange={(e) => setScenario(e.target.value)}
              options={scenarioOptions}
            />
            <Toggle
              checked={preserveExisting}
              onChange={setPreserveExisting}
              label="Preserve existing field values"
            />
          </div>

          <hr className="border-white/5" />

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs text-white/40 font-medium uppercase tracking-wider">AI Assistant</p>
              <Toggle
                checked={isAIEnabled}
                onChange={setIsAIEnabled}
                label=""
              />
            </div>

            <Select
              label="Provider"
              value={aiProvider}
              onChange={(e) => {
                const prov = e.target.value as 'gemini' | 'openai' | 'claude';
                setAiProvider(prov);
                if (prov === 'gemini') setAiModel('gemini-3.5-flash');
                else if (prov === 'openai') setAiModel('gpt-4o-mini');
                else if (prov === 'claude') setAiModel('claude-3-5-haiku-20241022');
              }}
              options={AI_PROVIDERS.map(p => ({ value: p.id, label: p.label }))}
            />

            <div className="relative">
              <Input
                label={`${aiProvider === 'gemini' ? 'Gemini' : aiProvider === 'openai' ? 'OpenAI' : 'Claude'} API Key`}
                type={showKey ? 'text' : 'password'}
                value={geminiKey}
                onChange={(e) => setGeminiKey(e.target.value)}
                placeholder={aiProvider === 'gemini' ? 'AIzaSy... or AQ....' : aiProvider === 'openai' ? 'sk-...' : 'sk-ant-...'}
                hint="Key stored in browser session memory only"
              />
              <button
                type="button"
                className="absolute right-3 top-7 text-white/40 hover:text-white"
                onClick={() => setShowKey(!showKey)}
              >
                {showKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              </button>
            </div>

            <Select
              label="Model"
              value={aiModel}
              onChange={(e) => setAiModel(e.target.value)}
              options={
                aiProvider === 'gemini'
                  ? GEMINI_MODELS.map(m => ({ value: m.id, label: m.label }))
                  : aiProvider === 'openai'
                  ? OPENAI_MODELS.map(m => ({ value: m.id, label: m.label }))
                  : CLAUDE_MODELS.map(m => ({ value: m.id, label: m.label }))
              }
            />

            <div className="flex gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={handleTestAI}
                loading={testingAI}
                disabled={!geminiKey}
                icon={<CheckCircle className="w-3.5 h-3.5" />}
              >
                Test Key
              </Button>
              {geminiKey && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={async () => {
                    await chrome.storage.session.remove('geminiApiKey');
                    setGeminiKey('');
                    setIsConnected(false);
                    setIsAIEnabled(false);
                    setAiTestResult(null);
                  }}
                  className="text-red-400 hover:text-red-300"
                >
                  Clear Key
                </Button>
              )}
            </div>

            {aiTestResult && (
              <div className={cn(
                'flex items-center gap-2 p-2.5 rounded-lg text-xs',
                aiTestResult.success ? 'bg-success/20 text-green-400' : 'bg-error/20 text-red-400'
              )}>
                {aiTestResult.success ? <CheckCircle className="w-3.5 h-3.5 shrink-0" /> : <AlertCircle className="w-3.5 h-3.5 shrink-0" />}
                {aiTestResult.message}
              </div>
            )}

            <Toggle
              checked={localOnlyMode}
              onChange={setLocalOnlyMode}
              label="Local-only mode (disable all AI requests)"
            />
          </div>
        </div>

        {/* Settings Footer */}
        <div className="p-3 border-t border-white/5 bg-dark-900 flex items-center justify-between shrink-0">
          <Button variant="ghost" size="sm" onClick={() => setView('main')}>
            Cancel
          </Button>
          <Button variant="primary" size="sm" onClick={handleSaveSettings} icon={<Save className="w-3.5 h-3.5" />}>
            Save Changes
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className={cn('w-full h-full bg-dark-900 text-white flex flex-col overflow-hidden', theme)}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/5 bg-gradient-to-r from-dark-900 to-dark-800 shrink-0">
        <FillProLogo />
        <div className="flex items-center gap-2">
          <StatusDot
            status={isAIEnabled ? (isConnected ? 'online' : 'offline') : 'offline'}
            label={isAIEnabled ? (isConnected ? 'AI' : 'AI off') : 'Local'}
          />
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
            onClick={() => {
              if (typeof chrome !== 'undefined' && chrome.runtime?.openOptionsPage) {
                chrome.runtime.openOptionsPage();
              } else {
                window.open(chrome.runtime?.getURL ? chrome.runtime.getURL('options.html') : 'options.html', '_blank');
              }
            }}
            aria-label="Settings"
            title="Open Settings (Full Page)"
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Notification */}
      {notification && (
        <div className={cn(
          'mx-4 mt-3 flex items-center gap-2 px-3 py-2 rounded-lg text-sm animate-slide-down shrink-0',
          notification.type === 'success' ? 'bg-success/20 text-green-400 border border-success/30' : 'bg-error/20 text-red-400 border border-error/30'
        )}>
          {notification.type === 'success' ? <CheckCircle className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
          {notification.text}
        </div>
      )}

      <div className="flex-1 overflow-y-auto overflow-x-hidden min-h-0">
        {/* Current Page */}
        <div className="px-4 pt-3 pb-2">
          <div className="glass rounded-lg p-3 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-brand-indigo" />
                <span className="text-xs text-white/50">Current Page</span>
              </div>
              <EnvironmentBadge url={currentUrl} />
            </div>
            <p className="text-xs text-white/70 font-mono truncate">
              {currentUrl || 'Loading...'}
            </p>
            {isChromePage && (
              <div className="flex items-center gap-1.5 text-xs text-yellow-400">
                <Info className="w-3 h-3" />
                Fill Pro cannot operate on Chrome internal pages
              </div>
            )}
          </div>
        </div>

        {/* Stats */}
        {scanResult && !isChromePage && (
          <div className="px-4 pb-3">
            <div className="grid grid-cols-4 gap-2">
              <StatCard label="Fields" value={scanResult.totalFields} />
              <StatCard label="Fillable" value={scanResult.fillableFields} variant="success" />
              <StatCard label="Uploads" value={scanResult.uploadFields} variant="info" />
              <StatCard
                label="Review"
                value={scanResult.ambiguousFields}
                variant={scanResult.ambiguousFields > 0 ? 'warning' : 'default'}
              />
            </div>
          </div>
        )}

        {/* Quick Actions */}
        <div className="px-4 pb-3 space-y-2">
          <p className="text-xs text-white/40 font-medium uppercase tracking-wider">Actions</p>

          {!scanResult ? (
            <div className="space-y-3">
              <button
                className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-brand-indigo via-indigo-500 to-brand-violet text-white font-medium text-sm shadow-brand hover:opacity-95 active:scale-[0.99] transition-all flex items-center justify-center gap-2 disabled:opacity-40"
                onClick={handleScan}
                disabled={isScanning || isChromePage}
              >
                {isScanning ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Scanning Form Elements...</span>
                  </>
                ) : (
                  <>
                    <ScanSearch className="w-4 h-4" />
                    <span>Scan Page Form</span>
                  </>
                )}
              </button>

              <div className="p-3 rounded-xl border border-white/5 bg-white/[0.02] flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-white/5 flex items-center justify-center">
                    <Sliders className="w-3.5 h-3.5 text-brand-indigo" />
                  </div>
                  <div>
                    <span className="text-xs font-medium text-white block">Shortcut</span>
                    <span className="text-[10px] text-white/40">Press Alt+Shift+F anytime</span>
                  </div>
                </div>
                <Button size="sm" variant="ghost" onClick={handleOpenSidePanel} icon={<PanelRight className="w-3.5 h-3.5" />}>
                  Side Panel
                </Button>
              </div>
            </div>
          ) : (
            <>
              <QuickAction
                icon={<ScanSearch className="w-4 h-4" />}
                label="Re-Scan Form"
                onClick={handleScan}
                loading={isScanning}
                variant="secondary"
              />
              <QuickAction
                icon={<Zap className="w-4 h-4" />}
                label="Quick Fill"
                onClick={handleQuickFill}
                loading={isExecuting}
                disabled={scanResult.fillableFields === 0}
                variant="primary"
                badge={scanResult.fillableFields > 0 ? String(scanResult.fillableFields) : undefined}
              />
              {isAIEnabled && (
                <QuickAction
                  icon={<Sparkles className="w-4 h-4" />}
                  label="AI Fill"
                  onClick={handleQuickFill}
                  loading={isExecuting}
                  variant="secondary"
                />
              )}
              <QuickAction
                icon={<Layers className="w-4 h-4" />}
                label="Fill Required Fields"
                onClick={handleQuickFill}
                loading={isExecuting}
                variant="secondary"
                badge={String(scanResult.requiredFields)}
              />
              {scanResult.uploadFields > 0 && (
                <QuickAction
                  icon={<Upload className="w-4 h-4" />}
                  label="Generate Attachments"
                  onClick={async () => notify('success', 'File generation started')}
                  variant="secondary"
                  badge={String(scanResult.uploadFields)}
                />
              )}
              <QuickAction
                icon={<RotateCcw className="w-4 h-4" />}
                label="Undo Last Fill"
                onClick={handleUndo}
                variant="ghost"
              />
            </>
          )}

          <QuickAction
            icon={<PanelRight className="w-4 h-4" />}
            label="Open Side Panel"
            onClick={handleOpenSidePanel}
            variant="ghost"
          />
        </div>

        {/* Execution Progress */}
        {isExecuting && progress && (
          <div className="px-4 pb-3">
            <div className="glass rounded-lg p-3 space-y-2">
              <div className="flex items-center gap-2">
                <Loader2 className="w-3 h-3 animate-spin text-brand-indigo" />
                <span className="text-xs text-white/70">
                  {progress.currentFieldLabel ?? 'Processing...'}
                </span>
              </div>
              <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-brand-indigo to-brand-violet rounded-full transition-all"
                  style={{ width: `${progress.percentage}%` }}
                />
              </div>
              <p className="text-xs text-white/40">
                {progress.currentAction} / {progress.totalActions} actions
              </p>
            </div>
          </div>
        )}

        {/* Preferences */}
        <div className="px-4 pb-4 space-y-3">
          <p className="text-xs text-white/40 font-medium uppercase tracking-wider">Preferences</p>

          <Select
            label="Locale"
            value={locale}
            onChange={(e) => setLocale(e.target.value)}
            options={localeOptions}
          />

          <Select
            label="Test Scenario"
            value={scenario}
            onChange={(e) => setScenario(e.target.value)}
            options={scenarioOptions}
          />

          <Toggle
            checked={preserveExisting}
            onChange={setPreserveExisting}
            label="Preserve existing values"
          />
        </div>
      </div>

      {/* Footer */}
      <div className="px-4 py-2 border-t border-white/5 flex items-center justify-between shrink-0 bg-dark-900">
        <span className="text-[10px] text-white/20">Fill Pro v1.0.0 — toolls.io</span>
        <span className="text-[10px] text-white/20">Open source • MIT</span>
      </div>
    </div>
  );
}

// Mount
const container = document.getElementById('root');
if (container) {
  createRoot(container).render(<PopupApp />);
}

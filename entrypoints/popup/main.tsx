// ============================================================
// FILL PRO — Popup Entry Point
// ============================================================

import React, { useState, useEffect, useCallback } from 'react';
import { createRoot } from 'react-dom/client';
import {
  Zap, Settings, Sun, Moon, ScanSearch, Wand2, FileText,
  Sparkles, AlertCircle, CheckCircle, Loader2, ChevronRight,
  Layers, Upload, Eye, RotateCcw, PanelRight, Info
} from 'lucide-react';
import {
  Button, Badge, StatCard, StatusDot, Toggle, Select, EmptyState, cn,
} from '../../src/components/ui/index.js';
import { useScanStore, useExecutionStore, useAIStore, useUIStore } from '../../src/stores/index.js';
import { sendMessage, getCurrentTab } from '../../src/messaging/index.js';
import { LOCALE_PROFILES } from '../../src/constants/locales.js';
import '../../src/styles/globals.css';

// ---- Logo ----
function FillProLogo() {
  return (
    <div className="flex items-center gap-2">
      <div className="relative w-7 h-7">
        <div className="absolute inset-0 bg-gradient-to-br from-brand-indigo to-brand-violet rounded-lg shadow-brand" />
        <div className="absolute inset-0 flex items-center justify-center">
          <Zap className="w-4 h-4 text-white" />
        </div>
      </div>
      <div>
        <span className="text-sm font-bold text-white">Fill Pro</span>
        <span className="text-[9px] text-white/30 block leading-none">by toolls.io</span>
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
  const { isAIEnabled, isConnected } = useAIStore();
  const { theme, setTheme } = useUIStore();

  const [currentUrl, setCurrentUrl] = useState<string>('');
  const [currentTabId, setCurrentTabId] = useState<number | null>(null);
  const [locale, setLocale] = useState('en-LK');
  const [scenario, setScenario] = useState('valid_data');
  const [preserveExisting, setPreserveExisting] = useState(false);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const isChromePage = currentUrl.startsWith('chrome://') || currentUrl.startsWith('chrome-extension://');

  useEffect(() => {
    getCurrentTab().then(tab => {
      if (tab?.url) setCurrentUrl(tab.url);
      if (tab?.id) setCurrentTabId(tab.id);
    });

    // Listen for messages from background
    chrome.runtime.onMessage.addListener((msg) => {
      if (msg.type === 'SCAN_RESULT') {
        setScanResult(msg.payload);
        setIsScanning(false);
      }
    });
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

  const localeOptions = Object.values(LOCALE_PROFILES).map(l => ({ value: l.id, label: l.label }));
  const scenarioOptions = [
    { value: 'valid_data', label: 'Valid Data' },
    { value: 'required_only', label: 'Required Fields Only' },
    { value: 'negative_test', label: 'Negative Testing' },
    { value: 'boundary_test', label: 'Boundary Testing' },
    { value: 'international', label: 'International' },
  ];

  return (
    <div className={cn('w-[400px] min-h-[500px] bg-dark-900 text-white flex flex-col', theme)}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/5 bg-gradient-to-r from-dark-900 to-dark-800">
        <FillProLogo />
        <div className="flex items-center gap-2">
          <StatusDot
            status={isAIEnabled ? (isConnected ? 'online' : 'offline') : 'offline'}
            label={isAIEnabled ? (isConnected ? 'AI' : 'AI off') : 'Local'}
          />
          <button
            className="p-1.5 rounded-lg text-white/40 hover:text-white hover:bg-white/10 transition-colors"
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
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

      {/* Notification */}
      {notification && (
        <div className={cn(
          'mx-4 mt-3 flex items-center gap-2 px-3 py-2 rounded-lg text-sm animate-slide-down',
          notification.type === 'success' ? 'bg-success/20 text-green-400 border border-success/30' : 'bg-error/20 text-red-400 border border-error/30'
        )}>
          {notification.type === 'success' ? <CheckCircle className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
          {notification.text}
        </div>
      )}

      <div className="flex-1 overflow-y-auto">
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
            <QuickAction
              icon={<ScanSearch className="w-4 h-4" />}
              label="Scan Form"
              onClick={handleScan}
              loading={isScanning}
              disabled={isChromePage}
              variant="primary"
            />
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
      <div className="px-4 py-2 border-t border-white/5 flex items-center justify-between">
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

// ============================================================
// FILL PRO — Background Service Worker
// ============================================================

import type {
  ExtensionMessage,
  ScanResult,
  ExecutionPlan,
  ExecutionProgressEvent,
  ExecutionReport,
} from '../src/types/index.js';
import { DEFAULT_SETTINGS, EXTENSION_VERSION } from '../src/constants/defaults.js';
import { loadSettings, saveSettings } from '../src/database/db.js';
import { createAIProvider, fetchAvailableModels } from '../src/ai/providers/gemini.js';
import { sessionGet, sessionSet, sessionRemove } from '../src/messaging/index.js';
import { generateDocument } from '../src/engines/documents/documentGenerator.js';
import { buildSmartFillPlan, regenerateSingleField, toExecutionPlan } from '../src/ai/smartFillOrchestrator.js';
import { recordFieldKnowledge } from '../src/database/knowledgeBase.js';
import type { SmartFillStage } from '../src/types/index.js';

async function getStoredApiKey(): Promise<string> {
  let apiKey = '';
  if (chrome.storage?.session) {
    const sRes = await chrome.storage.session.get(['geminiApiKey', 'apiKey']);
    apiKey = sRes?.geminiApiKey || sRes?.apiKey || '';
  }
  if (!apiKey && chrome.storage?.local) {
    const lRes = await chrome.storage.local.get(['geminiApiKey', 'apiKey']);
    apiKey = lRes?.geminiApiKey || lRes?.apiKey || '';
  }
  return apiKey;
}

function emitStageProgress(sessionId: string, stage: SmartFillStage, status: string, percentage: number) {
  chrome.runtime
    .sendMessage({
      type: 'EXECUTION_PROGRESS',
      payload: {
        sessionId,
        stage,
        currentAction: 0,
        totalActions: 0,
        status,
        percentage,
      },
    })
    .catch(() => {});
}

// ---- Scan cache ----
const scanCache = new Map<number, ScanResult>();

export default defineBackground(() => {
  // ---- Message handler ----
  chrome.runtime.onMessage.addListener((message: ExtensionMessage, sender, sendResponse) => {
    handleMessage(message, sender).then(sendResponse).catch((err) => {
      console.error('[FillPro] Background error:', err);
      sendResponse({ error: String(err) });
    });
    return true; // async
  });

  // ---- Side panel config ----
  chrome.runtime.onInstalled.addListener(() => {
    chrome.sidePanel.setOptions({
      enabled: true,
      path: 'sidepanel.html',
    });
    console.log(`[FillPro] v${EXTENSION_VERSION} installed`);
  });
});

async function handleMessage(
  message: ExtensionMessage,
  sender: chrome.runtime.MessageSender
): Promise<unknown> {
  const tabId = sender.tab?.id;

  switch (message.type) {
    case 'SCAN_FORM': {
      let tid = message.payload?.tabId;
      if (!tid || tid === 0) {
        tid = await getActiveTabId();
      }
      if (!tid) return { error: 'No active tab found' };

      await ensureContentScript(tid);
      try {
        let result = await chrome.tabs.sendMessage(tid, { type: 'DO_SCAN' });
        if (!result) {
          await new Promise(r => setTimeout(r, 250));
          result = await chrome.tabs.sendMessage(tid, { type: 'DO_SCAN' });
        }
        if (result && !(result as any).error) {
          scanCache.set(tid, result as ScanResult);
          chrome.runtime.sendMessage({ type: 'SCAN_RESULT', payload: result }).catch(() => {});
        }
        return result;
      } catch (err) {
        console.error('[FillPro] Error sending DO_SCAN to tab:', tid, err);
        return { error: 'Could not connect to page. Please refresh the page tab and try again.' };
      }
    }

    case 'EXECUTE_PLAN': {
      const plan = message.payload as ExecutionPlan;
      const tid = await getActiveTabId();
      if (!tid) return { error: 'No active tab' };

      await ensureContentScript(tid);
      await chrome.tabs.sendMessage(tid, { type: 'DO_EXECUTE', payload: plan });
      return { started: true };
    }

    case 'UNDO_SESSION': {
      const tid = await getActiveTabId();
      if (!tid) return { error: 'No active tab' };
      await chrome.tabs.sendMessage(tid, { type: 'DO_UNDO', payload: message.payload });
      return { done: true };
    }

    case 'GENERATE_FILE': {
      // File generation happens in side panel / options context
      return { error: 'File generation must run in side panel context' };
    }

    case 'GENERATE_DOCUMENT': {
      try {
        const { format, documentSemanticType, dataContext, filename } = (message as any).payload;
        const doc = await generateDocument(format, documentSemanticType, dataContext, filename);
        let binary = '';
        const bytes = new Uint8Array(doc.content);
        const len = bytes.byteLength;
        const chunkSize = 0x8000;
        for (let i = 0; i < len; i += chunkSize) {
          binary += String.fromCharCode.apply(null, bytes.subarray(i, Math.min(i + chunkSize, len)) as any);
        }
        const base64 = btoa(binary);
        return {
          format: doc.format,
          filename: doc.filename,
          mimeType: doc.mimeType,
          base64,
        };
      } catch (err) {
        console.error('[FillPro] Background generateDocument error:', err);
        return { error: String(err) };
      }
    }

    case 'TEST_AI_CONNECTION': {
      try {
        const { apiKey, model, provider: providerType = 'gemini' } = message.payload;
        const provider = createAIProvider(providerType as any, apiKey, model);
        const result = await provider.validateConnection();
        return { success: result.success, error: result.error, latencyMs: result.latencyMs };
      } catch (err) {
        return { success: false, error: String(err) };
      }
    }

    case 'ANALYZE_FORM': {
      try {
        const { fields, pageTitle, formTitle, url } = message.payload;
        const settings = await loadSettings();
        const providerType = settings?.ai?.provider || 'gemini';
        const modelId = settings?.ai?.model;
        let apiKey = '';
        if (chrome.storage?.session) {
          const sRes = await chrome.storage.session.get(['geminiApiKey', 'apiKey']);
          apiKey = sRes?.geminiApiKey || sRes?.apiKey || '';
        }
        if (!apiKey && chrome.storage?.local) {
          const lRes = await chrome.storage.local.get(['geminiApiKey', 'apiKey']);
          apiKey = lRes?.geminiApiKey || lRes?.apiKey || '';
        }
        const provider = createAIProvider(providerType as any, apiKey, modelId);
        const result = await provider.analyzeForm({
          formId: 'form-1',
          url: url || '',
          pageTitle,
          formTitle,
          fields: fields || [],
        });
        return { success: true, result };
      } catch (err: any) {
        return { success: false, error: String(err?.message || err) };
      }
    }

    case 'GENERATE_AI_VALUES': {
      try {
        const { fields, instruction, locale, scenario } = message.payload;
        const settings = await loadSettings();
        const providerType = settings?.ai?.provider || 'gemini';
        const modelId = settings?.ai?.model;
        let apiKey = '';
        if (chrome.storage?.session) {
          const sRes = await chrome.storage.session.get(['geminiApiKey', 'apiKey']);
          apiKey = sRes?.geminiApiKey || sRes?.apiKey || '';
        }
        if (!apiKey && chrome.storage?.local) {
          const lRes = await chrome.storage.local.get(['geminiApiKey', 'apiKey']);
          apiKey = lRes?.geminiApiKey || lRes?.apiKey || '';
        }
        const provider = createAIProvider(providerType as any, apiKey, modelId);
        if (provider.generateValues) {
          const values = await provider.generateValues({ fields, instruction, locale, scenario });
          return { success: true, values };
        }
        return { success: false, error: 'Provider does not support generateValues' };
      } catch (err: any) {
        return { success: false, error: String(err?.message || err) };
      }
    }

    case 'FETCH_AI_MODELS': {
      try {
        const { provider = 'gemini', apiKey } = message.payload || {};
        let key = apiKey;
        if (!key && chrome.storage?.session) {
          const sRes = await chrome.storage.session.get(['geminiApiKey', 'apiKey']);
          key = sRes?.geminiApiKey || sRes?.apiKey || '';
        }
        if (!key && chrome.storage?.local) {
          const lRes = await chrome.storage.local.get(['geminiApiKey', 'apiKey']);
          key = lRes?.geminiApiKey || lRes?.apiKey || '';
        }
        const models = await fetchAvailableModels(provider, key);
        return { success: true, models };
      } catch (err: any) {
        return { success: false, error: String(err?.message || err), models: [] };
      }
    }

    case 'GET_SETTINGS': {
      const settings = await loadSettings();
      return settings ?? DEFAULT_SETTINGS;
    }

    case 'SAVE_SETTINGS': {
      const current = await loadSettings() ?? DEFAULT_SETTINGS;
      const merged = { ...current, ...message.payload };
      await saveSettings(merged);
      return { saved: true };
    }

    case 'OPEN_SIDE_PANEL': {
      const tid = message.payload.tabId;
      await chrome.sidePanel.open({ tabId: tid });
      return { opened: true };
    }

    case 'SMART_FILL': {
      try {
        const {
          tabId: reqTabId,
          mode,
          locale,
          scenario,
          preserveExisting,
          generateDocuments,
          instruction,
          autoExecute,
        } = (message as any).payload;
        const tid = reqTabId && reqTabId !== 0 ? reqTabId : await getActiveTabId();
        if (!tid) return { error: 'No active tab found' };

        const tempSession = `sf-${Date.now()}`;
        emitStageProgress(tempSession, 'scanning', 'Scanning form...', 10);

        await ensureContentScript(tid);
        let scanResult = await chrome.tabs.sendMessage(tid, { type: 'DO_SCAN' }) as ScanResult & { error?: string };
        if (!scanResult) {
          await new Promise(r => setTimeout(r, 250));
          scanResult = await chrome.tabs.sendMessage(tid, { type: 'DO_SCAN' }) as ScanResult & { error?: string };
        }
        if (!scanResult || scanResult.error) {
          return { error: scanResult?.error || 'Could not scan page' };
        }

        scanCache.set(tid, scanResult);
        chrome.runtime.sendMessage({ type: 'SCAN_RESULT', payload: scanResult }).catch(() => {});

        emitStageProgress(scanResult.sessionId, 'understanding', 'Understanding form context...', 25);

        const settings = (await loadSettings()) ?? DEFAULT_SETTINGS;
        const apiKey = await getStoredApiKey();

        emitStageProgress(scanResult.sessionId, 'resolving_fields', 'Resolving fields...', 45);

        const plan = await buildSmartFillPlan({
          scanResult,
          mode: mode || settings.general.defaultGenerationMode || 'SMART_FILL',
          locale: locale || settings.general.defaultLocale || 'en-LK',
          scenario: scenario || settings.general.defaultScenario || 'valid_data',
          preserveExisting: preserveExisting ?? settings.general.preserveExistingValues,
          generateDocuments: generateDocuments ?? true,
          instruction,
          onStage: (stage, status, percentage) => emitStageProgress(scanResult.sessionId, stage, status, percentage),
          aiConfig: {
            enabled: !!settings.ai?.enabled,
            localOnlyMode: !!settings.ai?.localOnlyMode,
            provider: (settings.ai?.provider as any) || 'gemini',
            apiKey,
            modelId: settings.ai?.model,
          },
        });

        emitStageProgress(scanResult.sessionId, 'ready_for_review', 'Plan ready', 70);

        if (autoExecute) {
          const execPlan = toExecutionPlan(plan);
          await chrome.tabs.sendMessage(tid, { type: 'DO_EXECUTE', payload: execPlan });
        }

        return { success: true, scanResult, plan };
      } catch (err: any) {
        return { error: String(err?.message || err) };
      }
    }

    case 'REGENERATE_FIELD': {
      try {
        const { field, locale, scenario, instruction, formPurpose } = (message as any).payload;
        const settings = (await loadSettings()) ?? DEFAULT_SETTINGS;
        const apiKey = await getStoredApiKey();
        const result = await regenerateSingleField({
          field,
          locale: locale || settings.general.defaultLocale || 'en-LK',
          scenario: scenario || settings.general.defaultScenario || 'valid_data',
          instruction,
          formPurpose,
          aiConfig: {
            enabled: !!settings.ai?.enabled,
            localOnlyMode: !!settings.ai?.localOnlyMode,
            provider: (settings.ai?.provider as any) || 'gemini',
            apiKey,
            modelId: settings.ai?.model,
          },
        });
        return { success: true, ...result };
      } catch (err: any) {
        return { success: false, error: String(err?.message || err) };
      }
    }

    case 'CORRECT_FIELD_VALUE': {
      try {
        const { field, currentValue, validationError, locale } = (message as any).payload;
        const settings = (await loadSettings()) ?? DEFAULT_SETTINGS;
        const apiKey = await getStoredApiKey();
        if (!settings.ai?.enabled || settings.ai?.localOnlyMode || !apiKey || settings.ai?.provider === 'local') {
          return { success: false, error: 'AI not available for correction' };
        }
        const provider = createAIProvider(settings.ai.provider as any, apiKey, settings.ai.model);
        if (!provider.generateValues) {
          return { success: false, error: 'Provider does not support value correction' };
        }
        const values = await provider.generateValues({
          fields: [
            {
              id: field.id,
              label: field.label || field.fieldName,
              fieldName: field.fieldName,
              placeholder: field.placeholder,
              htmlType: field.htmlType,
              controlType: field.controlType,
              options: field.options,
            },
          ],
          instruction: `The previous value "${String(currentValue)}" failed validation with error: "${validationError}". Generate a corrected valid value that satisfies all constraints.`,
          locale: locale || settings.general.defaultLocale || 'en-US',
          scenario: 'valid_data',
        });
        const correctedValue = values?.[field.id] ?? (field.fieldName ? values?.[field.fieldName] : undefined);
        if (correctedValue !== undefined && correctedValue !== null && correctedValue !== '') {
          return { success: true, value: correctedValue };
        }
        return { success: false, error: 'No corrected value returned' };
      } catch (err: any) {
        return { success: false, error: String(err?.message || err) };
      }
    }

    case 'SAVE_FIELD_MAPPING': {
      try {
        const { origin, formFingerprint, field, semanticType, source } = (message as any).payload;
        const category = (semanticType.split('.')[0] || 'unknown') as any;
        await recordFieldKnowledge({
          origin,
          formFingerprint,
          field,
          semanticType,
          semanticCategory: category,
          source: source || 'user_confirmed',
          verified: source === 'user_confirmed',
        });
        return { success: true };
      } catch (err: any) {
        return { success: false, error: String(err?.message || err) };
      }
    }

    case 'HIGHLIGHT_FIELD': {
      const reqTabId = (message as any).payload?.tabId;
      const tid = reqTabId && reqTabId !== 0 ? reqTabId : await getActiveTabId();
      if (!tid) return { error: 'No active tab' };
      await ensureContentScript(tid);
      await chrome.tabs.sendMessage(tid, {
        type: 'HIGHLIGHT_FIELD',
        payload: { fieldId: (message as any).payload.fieldId },
      });
      return { done: true };
    }

    default:
      return { unhandled: true };
  }
}

async function ensureContentScript(tabId: number): Promise<void> {
  try {
    const res = await chrome.tabs.sendMessage(tabId, { type: 'PING' });
    if ((res as any)?.alive) return;
  } catch {
    // Content script not responding, proceed to inject
  }

  try {
    await chrome.scripting.executeScript({
      target: { tabId, allFrames: true },
      files: ['content-scripts/content.js'],
    });
    // Brief delay to allow content script listeners to attach
    await new Promise(r => setTimeout(r, 120));
  } catch (err) {
    console.warn('[FillPro] Could not inject content script:', err);
  }
}

async function getActiveTabId(): Promise<number | null> {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  return tabs[0]?.id ?? null;
}

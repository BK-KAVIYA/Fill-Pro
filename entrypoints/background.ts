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
import { createAIProvider } from '../src/ai/providers/gemini.js';
import { sessionGet, sessionSet, sessionRemove } from '../src/messaging/index.js';
import { generateDocument } from '../src/engines/documents/documentGenerator.js';

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

  // ---- Action click — open popup ----
  chrome.action.onClicked.addListener((tab) => {
    if (tab.id) {
      chrome.sidePanel.open({ tabId: tab.id }).catch(() => {});
    }
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

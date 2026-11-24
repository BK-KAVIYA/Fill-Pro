// ============================================================
// FILL PRO — Chrome Messaging Service
// ============================================================

import type { ExtensionMessage } from '../types/index.js';

export function sendMessage(message: ExtensionMessage): Promise<unknown> {
  return chrome.runtime.sendMessage(message);
}

export function sendTabMessage(tabId: number, message: ExtensionMessage): Promise<unknown> {
  return chrome.tabs.sendMessage(tabId, message);
}

export function onMessage(
  handler: (
    message: ExtensionMessage,
    sender: chrome.runtime.MessageSender
  ) => void | Promise<unknown>
): void {
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    const result = handler(message as ExtensionMessage, sender);
    if (result instanceof Promise) {
      result.then(sendResponse).catch(() => sendResponse({ error: 'Handler error' }));
      return true; // Keep channel open
    }
    return false;
  });
}

export async function getCurrentTab(): Promise<chrome.tabs.Tab | null> {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tabs[0]?.id) return tabs[0];
  const lastActive = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  return lastActive[0] ?? null;
}

export async function injectContentScript(tabId: number): Promise<void> {
  try {
    await chrome.scripting.executeScript({
      target: { tabId, allFrames: true },
      files: ['content-scripts/content.js'],
    });
  } catch {
    // Already injected or permission denied
  }
}

// ---- Storage helpers ----
export async function storageGet<T>(key: string): Promise<T | null> {
  const result = await chrome.storage.local.get(key);
  return (result[key] as T) ?? null;
}

export async function storageSet(key: string, value: unknown): Promise<void> {
  await chrome.storage.local.set({ [key]: value });
}

export async function storageRemove(key: string): Promise<void> {
  await chrome.storage.local.remove(key);
}

// ---- Session storage for sensitive keys ----
export async function sessionGet<T>(key: string): Promise<T | null> {
  const result = await chrome.storage.session.get(key);
  return (result[key] as T) ?? null;
}

export async function sessionSet(key: string, value: unknown): Promise<void> {
  await chrome.storage.session.set({ [key]: value });
}

export async function sessionRemove(key: string): Promise<void> {
  await chrome.storage.session.remove(key);
}

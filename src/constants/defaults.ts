// ============================================================
// FILL PRO — Default Settings
// ============================================================

import type { AppSettings } from '../types/index.js';

export const DEFAULT_SETTINGS: AppSettings = {
  general: {
    defaultLocale: 'en-LK',
    defaultScenario: 'valid_data',
    defaultGenerationMode: 'SMART_FILL',
    preserveExistingValues: true,
    rememberMappings: true,
    previewBeforeFilling: false,
    autoPrepareDocuments: true,
    theme: 'dark',
  },
  ai: {
    enabled: false,
    provider: 'gemini',
    model: 'gemini-3.5-flash',
    maxRequestsPerSession: 10,
    localOnlyMode: false,
    screenshotAnalysis: false,
  },
  generation: {
    emailDomain: 'example.com',
    preferredDateFormat: 'dd/MM/yyyy',
    currency: 'LKR',
    defaultNumberMin: 0,
    defaultNumberMax: 9999999,
    textLengthMin: 5,
    textLengthMax: 50,
  },
  files: {
    maxGeneratedFileSizeBytes: 5 * 1024 * 1024, // 5 MB
    defaultFileFormat: 'pdf',
    defaultGenerationMode: 'generic',
  },
  privacy: {
    allowedOrigins: ['localhost', '127.0.0.1'],
    blockedOrigins: [],
    developmentOnly: false,
    sensitiveFieldExclusions: ['password', 'otp', 'cvv', 'card'],
  },
};

export const GEMINI_MODELS = [
  { id: 'gemini-3.5-flash', label: 'Gemini 3.5 Flash (Recommended)', recommended: true },
  { id: 'gemini-3.8-flash', label: 'Gemini 3.8 Flash', recommended: false },
  { id: 'gemini-3.5-flash-lite', label: 'Gemini 3.5 Flash Lite (Fast)', recommended: false },
  { id: 'gemini-3.1-pro-preview', label: 'Gemini 3.1 Pro Preview', recommended: false },
];

export const OPENAI_MODELS = [
  { id: 'gpt-4o-mini', label: 'GPT-4o Mini (Fast & Cheap)', recommended: true },
  { id: 'gpt-4o', label: 'GPT-4o (Most Intelligent)', recommended: false },
  { id: 'gpt-3.5-turbo', label: 'GPT-3.5 Turbo', recommended: false },
];

export const CLAUDE_MODELS = [
  { id: 'claude-3-5-haiku-20241022', label: 'Claude 3.5 Haiku (Fast)', recommended: true },
  { id: 'claude-3-5-sonnet-20241022', label: 'Claude 3.5 Sonnet (Advanced)', recommended: false },
];

export const AI_PROVIDERS = [
  { id: 'gemini', label: 'Google Gemini', placeholder: 'AIzaSy... or AQ....' },
  { id: 'openai', label: 'OpenAI (GPT)', placeholder: 'sk-...' },
  { id: 'claude', label: 'Anthropic Claude', placeholder: 'sk-ant-...' },
];

export const EXTENSION_VERSION = '2.0.0';
export const PUBLISHER = 'toolls.io';
export const REPO_URL = 'https://github.com/toolls-io/fill-pro';

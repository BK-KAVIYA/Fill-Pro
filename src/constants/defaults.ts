// ============================================================
// FILL PRO — Default Settings
// ============================================================

import type { AppSettings } from '../types/index.js';

export const DEFAULT_SETTINGS: AppSettings = {
  general: {
    defaultLocale: 'en-LK',
    defaultScenario: 'valid_data',
    preserveExistingValues: true,
    rememberMappings: true,
    previewBeforeFilling: false,
    theme: 'dark',
  },
  ai: {
    enabled: false,
    provider: 'local',
    model: 'gemini-1.5-flash',
    maxRequestsPerSession: 10,
    localOnlyMode: true,
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
  { id: 'gemini-1.5-flash', label: 'Gemini 1.5 Flash (Recommended)', recommended: true },
  { id: 'gemini-1.5-pro', label: 'Gemini 1.5 Pro (Advanced)', recommended: false },
  { id: 'gemini-2.0-flash-exp', label: 'Gemini 2.0 Flash (Experimental)', recommended: false },
];

export const EXTENSION_VERSION = '1.0.0';
export const PUBLISHER = 'toolls.io';
export const REPO_URL = 'https://github.com/toolls-io/fill-pro';

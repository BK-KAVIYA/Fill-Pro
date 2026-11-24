// ============================================================
// FILL PRO — IndexedDB / Dexie Database
// ============================================================

import Dexie, { type Table } from 'dexie';
import type { ApplicationKnowledge, AppSettings, GeneratedDocument } from '../types/index.js';

export interface StoredProfile {
  id?: number;
  name: string;
  locale: string;
  scenario: string;
  personData?: unknown;
  companyData?: unknown;
  financialData?: unknown;
  customValues?: unknown;
  createdAt: number;
  updatedAt: number;
}

export interface StoredFileLibraryItem {
  id?: number;
  name: string;
  filename: string;
  mimeType: string;
  format: string;
  category: string;
  tags: string[];
  description?: string;
  dataBase64: string;
  sizeBytes: number;
  origin?: string;
  fieldAssignments: Array<{ origin: string; fieldFingerprint: string }>;
  createdAt: number;
}

export interface StoredExecutionReport {
  id?: number;
  sessionId: string;
  url: string;
  origin: string;
  reportData: unknown;
  createdAt: number;
}

export class FillProDatabase extends Dexie {
  knowledgeBase!: Table<ApplicationKnowledge>;
  profiles!: Table<StoredProfile>;
  fileLibrary!: Table<StoredFileLibraryItem>;
  executionReports!: Table<StoredExecutionReport>;
  settings!: Table<{ id: number; data: AppSettings }>;

  constructor() {
    super('FillProDB');

    this.version(1).stores({
      knowledgeBase: '++id, origin, formFingerprint, fieldFingerprint, semanticType, source',
      profiles: '++id, name, locale, createdAt',
      fileLibrary: '++id, name, format, category, origin, createdAt',
      executionReports: '++id, sessionId, origin, createdAt',
      settings: 'id',
    });
  }
}

export const db = new FillProDatabase();

// ---- Knowledge Base helpers ----
export async function getKnowledge(
  origin: string,
  fieldFingerprint: string
): Promise<ApplicationKnowledge | undefined> {
  return db.knowledgeBase
    .where({ origin, fieldFingerprint })
    .first();
}

export async function saveKnowledge(knowledge: Omit<ApplicationKnowledge, 'id'>): Promise<void> {
  const existing = await getKnowledge(knowledge.origin, knowledge.fieldFingerprint);
  if (existing?.id) {
    await db.knowledgeBase.update(existing.id, {
      ...knowledge,
      updatedAt: Date.now(),
      successCount: (existing.successCount ?? 0) + 1,
    });
  } else {
    await db.knowledgeBase.add({
      ...knowledge,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
  }
}

export async function deleteKnowledge(id: number): Promise<void> {
  await db.knowledgeBase.delete(id);
}

export async function getKnowledgeForOrigin(origin: string): Promise<ApplicationKnowledge[]> {
  return db.knowledgeBase.where({ origin }).toArray();
}

export async function clearOriginKnowledge(origin: string): Promise<void> {
  await db.knowledgeBase.where({ origin }).delete();
}

// ---- Settings helpers ----
export async function loadSettings(): Promise<AppSettings | null> {
  const record = await db.settings.get(1);
  return record?.data ?? null;
}

export async function saveSettings(settings: AppSettings): Promise<void> {
  await db.settings.put({ id: 1, data: settings });
}

// ---- Profile helpers ----
export async function loadProfiles(): Promise<StoredProfile[]> {
  return db.profiles.orderBy('createdAt').reverse().toArray();
}

export async function saveProfile(profile: Omit<StoredProfile, 'id'>): Promise<number> {
  return db.profiles.add(profile);
}

export async function deleteProfile(id: number): Promise<void> {
  await db.profiles.delete(id);
}

// ---- File library helpers ----
export async function getFileLibrary(): Promise<StoredFileLibraryItem[]> {
  return db.fileLibrary.orderBy('createdAt').reverse().toArray();
}

export async function addFileToLibrary(item: Omit<StoredFileLibraryItem, 'id'>): Promise<number> {
  // Enforce 50 MB per item
  if (item.sizeBytes > 50 * 1024 * 1024) {
    throw new Error('File exceeds maximum storage size of 50 MB');
  }
  return db.fileLibrary.add(item);
}

export async function deleteFileFromLibrary(id: number): Promise<void> {
  await db.fileLibrary.delete(id);
}

// ---- Report helpers ----
export async function saveReport(report: Omit<StoredExecutionReport, 'id'>): Promise<number> {
  return db.executionReports.add(report);
}

export async function getReports(origin?: string): Promise<StoredExecutionReport[]> {
  if (origin) {
    return db.executionReports.where({ origin }).reverse().sortBy('createdAt');
  }
  return db.executionReports.orderBy('createdAt').reverse().toArray();
}

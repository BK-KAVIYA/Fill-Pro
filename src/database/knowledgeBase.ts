// ============================================================
// FILL PRO — Application Knowledge Base Service
// ============================================================
// Remembers confirmed semantic classifications, constraints,
// adapter strategies, and document requirements per origin.
// NEVER stores actual sensitive form values.

import { db, getKnowledge, saveKnowledge, deleteKnowledge, getKnowledgeForOrigin, clearOriginKnowledge } from './db.js';
import type { ApplicationKnowledge, FieldDescriptor, SemanticCategory } from '../types/index.js';
import { isSensitiveSemanticType } from '../constants/semanticTypes.js';

const CURRENT_SCHEMA_VERSION = 1;

/**
 * Compute a stable form structure fingerprint from field fingerprints.
 */
export function computeFormStructureSignature(fields: FieldDescriptor[]): string {
  const sig = fields.map(f => f.fingerprint).sort().join(',');
  try {
    return btoa(sig).replace(/[^a-zA-Z0-9]/g, '').substring(0, 32);
  } catch {
    return String(sig.length) + '-' + fields.length;
  }
}

/**
 * Look up a learned mapping for a field, invalidating non-user-confirmed mappings
 * if the form structure has changed significantly.
 */
export async function lookupFieldKnowledge(
  origin: string,
  formFingerprint: string,
  field: FieldDescriptor
): Promise<ApplicationKnowledge | null> {
  if (field.isSensitive) return null;

  try {
    const entry = await getKnowledge(origin, field.fingerprint);
    if (!entry) return null;

    // Never return sensitive semantic types from auto-learned cache
    if (isSensitiveSemanticType(entry.semanticType)) return null;

    // User-confirmed mappings persist across minor form changes unless explicitly removed
    if (entry.source === 'user_confirmed') {
      return entry;
    }

    // For auto-learned/AI mappings, invalidate if form structure changed
    if (entry.formFingerprint && formFingerprint && entry.formFingerprint !== formFingerprint) {
      return null;
    }

    // Invalidate if failure count significantly exceeds success count
    if (entry.failureCount > entry.successCount + 2) {
      return null;
    }

    return entry;
  } catch (err) {
    console.warn('[FillPro KB] Lookup error:', err);
    return null;
  }
}

/**
 * Invalidate stale auto-learned mappings for an origin when form structure changes.
 */
export async function invalidateStaleMappings(
  origin: string,
  currentFormFingerprint: string
): Promise<number> {
  try {
    const entries = await getKnowledgeForOrigin(origin);
    let removed = 0;
    for (const entry of entries) {
      if (
        entry.source !== 'user_confirmed' &&
        entry.formFingerprint &&
        entry.formFingerprint !== currentFormFingerprint &&
        entry.id !== undefined
      ) {
        await deleteKnowledge(entry.id);
        removed++;
      }
    }
    return removed;
  } catch {
    return 0;
  }
}

/**
 * Save a confirmed or auto-learned semantic classification to the knowledge base.
 * Never stores actual field values.
 */
export async function recordFieldKnowledge(params: {
  origin: string;
  formFingerprint: string;
  field: FieldDescriptor;
  semanticType: string;
  semanticCategory: SemanticCategory;
  source: 'user_confirmed' | 'heuristic' | 'ai' | 'auto_learned';
  verified?: boolean;
  adapterId?: string;
}): Promise<void> {
  if (params.field.isSensitive || isSensitiveSemanticType(params.semanticType)) {
    return;
  }

  await saveKnowledge({
    origin: params.origin,
    formFingerprint: params.formFingerprint,
    fieldFingerprint: params.field.fingerprint,
    semanticType: params.semanticType,
    semanticCategory: params.semanticCategory,
    constraints: {
      required: params.field.constraints.required,
      maxLength: params.field.constraints.maxLength,
      minLength: params.field.constraints.minLength,
      pattern: params.field.constraints.pattern,
      accept: params.field.constraints.accept,
      multiple: params.field.constraints.multiple,
    },
    adapterId: params.adapterId ?? params.field.adapterId,
    source: params.source,
    verified: params.verified ?? params.source === 'user_confirmed',
    successCount: 1,
    failureCount: 0,
    schemaVersion: CURRENT_SCHEMA_VERSION,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  });
}

/**
 * Record a failure for a learned mapping so unreliable mappings are naturally phased out.
 */
export async function recordKnowledgeFailure(origin: string, fieldFingerprint: string): Promise<void> {
  try {
    const existing = await getKnowledge(origin, fieldFingerprint);
    if (existing?.id) {
      await db.knowledgeBase.update(existing.id, {
        failureCount: (existing.failureCount ?? 0) + 1,
        updatedAt: Date.now(),
      });
    }
  } catch {
    // ignore
  }
}

export async function listAllKnowledge(): Promise<ApplicationKnowledge[]> {
  try {
    return await db.knowledgeBase.orderBy('updatedAt').reverse().toArray();
  } catch {
    return [];
  }
}

export async function updateKnowledgeMapping(
  id: number,
  semanticType: string,
  semanticCategory: SemanticCategory
): Promise<void> {
  await db.knowledgeBase.update(id, {
    semanticType,
    semanticCategory,
    source: 'user_confirmed',
    verified: true,
    updatedAt: Date.now(),
  });
}

export async function removeKnowledgeMapping(id: number): Promise<void> {
  await deleteKnowledge(id);
}

export async function clearAllKnowledge(): Promise<void> {
  await db.knowledgeBase.clear();
}

export { getKnowledgeForOrigin, clearOriginKnowledge };

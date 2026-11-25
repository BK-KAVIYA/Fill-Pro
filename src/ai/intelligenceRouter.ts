// ============================================================
// FILL PRO — AI Intelligence Router
// ============================================================
// Priority chain:
// 1. User-confirmed field mappings
// 2. Application knowledge base
// 3. Native HTML semantics
// 4. Local semantic heuristics
// 5. Gemini/AI semantic reasoning (batched unresolved fields)
// 6. Optional visual analysis (explicit consent only)
// 7. Manual review (unresolved)

import type {
  FieldDescriptor,
  ScanResult,
  ResolutionSource,
  ResolutionStats,
} from '../types/index.js';
import { getConfidenceBand } from '../types/index.js';
import { lookupFieldKnowledge, computeFormStructureSignature } from '../database/knowledgeBase.js';
import { createAIProvider, type AIProvider } from './providers/gemini.js';
import { isSensitiveSemanticType } from '../constants/semanticTypes.js';

export interface ResolvedField extends FieldDescriptor {
  resolutionSource: ResolutionSource;
  aiReasoning?: string;
}

export interface IntelligenceResult {
  fields: ResolvedField[];
  stats: ResolutionStats;
  formPurpose: string;
  businessDomain: string;
  suggestedLocale?: string;
  formFingerprint: string;
  aiUsed: boolean;
  aiError?: string;
}

export interface RouterOptions {
  useAI: boolean;
  provider?: 'gemini' | 'openai' | 'claude' | 'local';
  apiKey?: string;
  modelId?: string;
  allowScreenshotAnalysis?: boolean;
}

const NATIVE_HTML_TYPES = new Set(['email', 'tel', 'url', 'password', 'date', 'datetime-local', 'month', 'week', 'time', 'color', 'file']);

/**
 * Infer form purpose & business domain locally from page title, form title, and field semantic types.
 */
export function inferFormContextLocally(scanResult: ScanResult): { formPurpose: string; businessDomain: string } {
  const titleText = `${scanResult.pageTitle ?? ''} ${scanResult.formTitle ?? ''} ${scanResult.url ?? ''}`.toLowerCase();
  const types = new Set(scanResult.fields.map(f => f.semanticType));
  const labels = scanResult.fields.map(f => (f.label ?? f.fieldName ?? '').toLowerCase()).join(' ');

  if (
    /financial|balance\s*sheet|income\s*statement|profit|audit|tax|revenue/i.test(titleText) ||
    types.has('financial.total_assets') ||
    types.has('financial.revenue') ||
    types.has('financial.profit_before_tax')
  ) {
    return { formPurpose: 'Financial Reporting & Disclosure', businessDomain: 'FINANCIAL_SERVICES' };
  }

  if (
    /company|corporate|business\s*reg|incorporation|director|shareholder|licence|license/i.test(titleText) ||
    types.has('business.company_name') ||
    types.has('business.registration_number')
  ) {
    return { formPurpose: 'Company Registration & Licensing', businessDomain: 'CORPORATE_REGISTRATION' };
  }

  if (
    /employee|staff|hr|onboard|applicant|candidate|job|career|cv|resume/i.test(titleText) ||
    /employee|department|designation|salary/i.test(labels)
  ) {
    return { formPurpose: 'Employee / HR Registration', businessDomain: 'HUMAN_RESOURCES' };
  }

  if (scanResult.uploadFields >= 2) {
    return { formPurpose: 'Document Submission & Verification', businessDomain: 'DOCUMENT_WORKFLOW' };
  }

  if (/contact|inquiry|support|feedback/i.test(titleText)) {
    return { formPurpose: 'Contact & Inquiry Form', businessDomain: 'CUSTOMER_SUPPORT' };
  }

  if (/register|signup|sign\s*up|account|profile/i.test(titleText)) {
    return { formPurpose: 'User Registration & Profile', businessDomain: 'USER_ONBOARDING' };
  }

  return {
    formPurpose: scanResult.formTitle || scanResult.pageTitle || 'General Web Form',
    businessDomain: 'GENERAL',
  };
}

export class AIIntelligenceRouter {
  /**
   * Resolve all fields in a ScanResult following the 7-tier priority chain.
   * Only batches unresolved/low-confidence fields to AI when AI is enabled.
   */
  async resolveFields(scanResult: ScanResult, options: RouterOptions): Promise<IntelligenceResult> {
    const formFingerprint = computeFormStructureSignature(scanResult.fields);
    const resolved: ResolvedField[] = [];
    const unresolvedForAI: ResolvedField[] = [];

    const stats: ResolutionStats = {
      userConfirmed: 0,
      knowledgeBase: 0,
      native: 0,
      heuristic: 0,
      ai: 0,
      unresolved: 0,
      total: scanResult.fields.length,
    };

    // Tiers 1–4: Knowledge Base -> Native HTML -> Local Heuristics
    for (const field of scanResult.fields) {
      if (field.isSensitive) {
        resolved.push({
          ...field,
          resolutionSource: 'native',
        });
        stats.native++;
        continue;
      }

      // Tier 1 & 2: Check Knowledge Base
      const kbEntry = await lookupFieldKnowledge(scanResult.origin, formFingerprint, field);
      if (kbEntry) {
        const isUserConfirmed = kbEntry.source === 'user_confirmed';
        const score = isUserConfirmed ? 1.0 : 0.9;
        const rf: ResolvedField = {
          ...field,
          semanticType: kbEntry.semanticType,
          semanticCategory: kbEntry.semanticCategory,
          confidence: score,
          confidenceBand: getConfidenceBand(score),
          classificationSource: isUserConfirmed ? 'user_confirmed' : 'knowledge_base',
          resolutionSource: isUserConfirmed ? 'user_confirmed' : 'knowledge_base',
        };
        resolved.push(rf);
        if (isUserConfirmed) stats.userConfirmed++;
        else stats.knowledgeBase++;
        continue;
      }

      // Tier 3: Native HTML semantics (e.g. type="email", autocomplete="given-name", high-confidence native signals)
      const hasNativeEvidence =
        NATIVE_HTML_TYPES.has(field.htmlType) ||
        field.evidence.some(e => e.source === 'native' && e.weight >= 0.7);
      if (hasNativeEvidence && field.semanticType !== 'unknown.unknown' && field.confidence >= 0.5) {
        resolved.push({
          ...field,
          classificationSource: 'native',
          resolutionSource: 'native',
        });
        stats.native++;
        continue;
      }

      // Tier 4: Local semantic heuristics (confidence >= 0.60 and not unknown)
      if (field.semanticType !== 'unknown.unknown' && field.confidence >= 0.60) {
        resolved.push({
          ...field,
          classificationSource: 'heuristic',
          resolutionSource: 'heuristic',
        });
        stats.heuristic++;
        continue;
      }

      // Needs AI or manual review
      const pending: ResolvedField = {
        ...field,
        resolutionSource: 'unresolved',
      };
      resolved.push(pending);
      unresolvedForAI.push(pending);
    }

    // Local context fallback
    const localCtx = inferFormContextLocally(scanResult);
    let formPurpose = localCtx.formPurpose;
    let businessDomain = localCtx.businessDomain;
    let suggestedLocale: string | undefined;
    let aiUsed = false;
    let aiError: string | undefined;

    // Tier 5: Batch unresolved fields to AI provider (only when enabled & key present)
    if (
      options.useAI &&
      options.apiKey &&
      options.provider !== 'local' &&
      unresolvedForAI.length > 0
    ) {
      try {
        const provider: AIProvider = createAIProvider(
          options.provider ?? 'gemini',
          options.apiKey,
          options.modelId
        );

        // Send ONLY sanitized metadata for unresolved fields
        const sanitizedFields = unresolvedForAI.map(f => ({
          id: f.id,
          label: f.label || f.fieldName,
          placeholder: f.placeholder,
          htmlType: f.htmlType,
          ariaLabel: f.ariaLabel,
          description: f.description,
          section: f.section,
          formContext: f.formContext,
          pageTitle: f.pageTitle,
        }));

        const aiResult = await provider.analyzeForm({
          fields: sanitizedFields,
          pageTitle: scanResult.pageTitle,
          formTitle: scanResult.formTitle,
          url: scanResult.origin,
        });

        aiUsed = true;
        if (aiResult.formPurpose) formPurpose = aiResult.formPurpose;
        if (aiResult.businessDomain) businessDomain = aiResult.businessDomain;
        if (aiResult.suggestedLocale) suggestedLocale = aiResult.suggestedLocale;

        const aiMap = new Map(aiResult.fields.map(f => [f.id, f]));

        for (const field of unresolvedForAI) {
          const match = aiMap.get(field.id);
          if (
            match &&
            match.semanticType &&
            match.semanticType !== 'unknown.unknown' &&
            match.confidence >= 0.45 &&
            !isSensitiveSemanticType(match.semanticType)
          ) {
            field.semanticType = match.semanticType;
            field.semanticCategory = match.semanticCategory;
            field.confidence = match.confidence;
            field.confidenceBand = getConfidenceBand(match.confidence);
            field.classificationSource = 'ai';
            field.resolutionSource = 'ai';
            field.aiReasoning = match.reasoning;
            stats.ai++;
          } else {
            stats.unresolved++;
          }
        }
      } catch (err: any) {
        aiError = String(err?.message || err);
        console.warn('[FillPro Router] AI classification failed, keeping local fallback:', aiError);
        stats.unresolved += unresolvedForAI.length;
      }
    } else {
      stats.unresolved += unresolvedForAI.length;
    }

    return {
      fields: resolved,
      stats,
      formPurpose,
      businessDomain,
      suggestedLocale,
      formFingerprint,
      aiUsed,
      aiError,
    };
  }
}

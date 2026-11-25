// ============================================================
// FILL PRO — Smart Fill Orchestrator
// ============================================================
// Coordinates the 18-step Smart Fill workflow:
// scan -> extract -> context -> KB -> local -> AI batch -> validate ->
// synthetic data context -> generate values -> document plans ->
// present plan -> execute -> verify -> recover -> save KB -> report.

import type {
  ExecutionAction,
  ExecutionPlan,
  FieldDescriptor,
  FileFieldDescriptor,
  GenerationMode,
  ResolutionStats,
  ScanResult,
  TestDataContext,
  TestScenario,
} from '../types/index.js';
import { AIIntelligenceRouter, type ResolvedField } from './intelligenceRouter.js';
import { createAIProvider } from './providers/gemini.js';
import {
  buildTestDataContext,
  generateValueForField,
  generateValueForRadioField,
  generateValueForSelectField,
} from '../engines/generation/localGenerator.js';

export interface DocumentPlanItem {
  fieldId: string;
  label: string;
  documentType: string;
  format: string;
  filename: string;
  maxFileSizeBytes?: number;
  multiple: boolean;
  autoUploadRisk: 'known' | 'possible' | 'unknown';
  approved: boolean;
}

export interface SmartFillPlan {
  sessionId: string;
  origin: string;
  mode: GenerationMode;
  locale: string;
  scenario: TestScenario;
  preserveExisting: boolean;
  generateDocuments: boolean;
  formPurpose: string;
  businessDomain: string;
  suggestedLocale?: string;
  formFingerprint: string;
  resolvedFields: ResolvedField[];
  stats: ResolutionStats;
  proposedValues: Record<string, unknown>;
  documentPlans: DocumentPlanItem[];
  actions: ExecutionAction[];
  dataContext: TestDataContext;
  aiUsed: boolean;
  aiError?: string;
}

export interface BuildSmartFillPlanParams {
  scanResult: ScanResult;
  mode: GenerationMode;
  locale: string;
  scenario: TestScenario;
  preserveExisting: boolean;
  generateDocuments: boolean;
  instruction?: string;
  onStage?: (stage: import('../types/index.js').SmartFillStage, status: string, percentage: number) => void;
  aiConfig: {
    enabled: boolean;
    localOnlyMode: boolean;
    provider: 'gemini' | 'openai' | 'claude' | 'local';
    apiKey?: string;
    modelId?: string;
  };
}

function inferDocumentFormat(fileField: FileFieldDescriptor): string {
  const extensions = fileField.acceptedExtensions ?? [];
  if (extensions.some(e => e.includes('pdf'))) return 'pdf';
  if (extensions.some(e => e.includes('png') || e.includes('jpg') || e.includes('jpeg'))) return 'png';
  if (extensions.some(e => e.includes('xlsx') || e.includes('xls'))) return 'xlsx';
  if (extensions.some(e => e.includes('docx') || e.includes('doc'))) return 'docx';
  if (extensions.some(e => e.includes('csv'))) return 'csv';
  return 'pdf';
}

export async function buildSmartFillPlan(params: BuildSmartFillPlanParams): Promise<SmartFillPlan> {
  const { scanResult, mode, locale, scenario, preserveExisting, generateDocuments, instruction, onStage, aiConfig } = params;

  const canUseAI =
    mode !== 'QUICK_FILL' &&
    aiConfig.enabled &&
    !aiConfig.localOnlyMode &&
    !!aiConfig.apiKey &&
    aiConfig.provider !== 'local';

  // Step 3–8: Intelligence routing (KB -> Native -> Heuristic -> Batched AI)
  onStage?.('ai_classification', canUseAI ? 'Waiting for AI field analysis...' : 'Classifying fields locally...', 38);
  const router = new AIIntelligenceRouter();
  const intel = await router.resolveFields(scanResult, {
    useAI: canUseAI,
    provider: aiConfig.provider,
    apiKey: aiConfig.apiKey,
    modelId: aiConfig.modelId,
  });

  // Step 9: Shared synthetic data context
  onStage?.('generating_data', canUseAI ? 'Generating sample data with AI...' : 'Generating local sample data...', 52);
  const dataContext = buildTestDataContext(locale, {
    sessionId: scanResult.sessionId,
    scenario,
  });

  const proposedValues: Record<string, unknown> = {};
  const fieldsForAIValues: ResolvedField[] = [];

  // Step 10: Generate values locally first, queue AI-resolved/custom fields for AI generation
  for (const field of intel.fields) {
    if (field.isSensitive || field.disabled || field.readonly) continue;
    if (preserveExisting && field.hasExistingValue) continue;
    if (scenario === 'required_only' && !field.required) continue;
    if (field.controlType === 'file') continue;

    if (mode === 'CUSTOM_AI_FILL' && canUseAI) {
      fieldsForAIValues.push(field);
      continue;
    }

    // For SMART_FILL: use AI value generation for AI-resolved or unresolved fields
    if (
      canUseAI &&
      (field.resolutionSource === 'ai' ||
        field.resolutionSource === 'unresolved' ||
        field.semanticType === 'unknown.unknown')
    ) {
      fieldsForAIValues.push(field);
      continue;
    }

    if (field.controlType === 'select' || field.controlType === 'multi-select') {
      const gen = generateValueForSelectField(field, dataContext);
      if (gen) proposedValues[field.id] = gen.value;
    } else if (field.controlType === 'radio') {
      const gen = generateValueForRadioField(field, dataContext) ?? generateValueForField(field, dataContext);
      proposedValues[field.id] = gen.value;
    } else {
      const gen = generateValueForField(field, dataContext);
      proposedValues[field.id] = gen.value;
    }
  }

  let aiUsed = intel.aiUsed;
  let aiError = intel.aiError;

  // Batch AI value generation for fields that need contextual AI values
  if (canUseAI && fieldsForAIValues.length > 0 && aiConfig.apiKey) {
    try {
      const provider = createAIProvider(aiConfig.provider, aiConfig.apiKey, aiConfig.modelId);
      if (provider.generateValues) {
        const aiValues = await provider.generateValues({
          fields: fieldsForAIValues.map(f => ({
            id: f.id,
            label: f.label || f.fieldName,
            fieldName: f.fieldName,
            placeholder: f.placeholder,
            htmlType: f.htmlType,
            controlType: f.controlType,
            options: f.options,
          })),
          instruction:
            instruction ||
            `Form purpose: ${intel.formPurpose} (${intel.businessDomain}). Generate realistic, consistent test data for each field.`,
          locale,
          scenario,
        });
        aiUsed = true;
        for (const f of fieldsForAIValues) {
          const val = aiValues?.[f.id] ?? (f.fieldName ? aiValues?.[f.fieldName] : undefined);
          if (val !== undefined && val !== null && val !== '') {
            proposedValues[f.id] = val;
          } else {
            // Graceful local fallback if AI omitted a field
            const fallback =
              f.controlType === 'select' || f.controlType === 'multi-select'
                ? generateValueForSelectField(f, dataContext)
                : f.controlType === 'radio'
                  ? generateValueForRadioField(f, dataContext) ?? generateValueForField(f, dataContext)
                  : generateValueForField(f, dataContext);
            if (fallback) proposedValues[f.id] = fallback.value;
          }
        }
      }
    } catch (err: any) {
      aiError = aiError || String(err?.message || err);
      // Graceful fallback to local generation
      for (const f of fieldsForAIValues) {
        const fallback =
          f.controlType === 'select' || f.controlType === 'multi-select'
            ? generateValueForSelectField(f, dataContext)
            : f.controlType === 'radio'
              ? generateValueForRadioField(f, dataContext) ?? generateValueForField(f, dataContext)
              : generateValueForField(f, dataContext);
        if (fallback) proposedValues[f.id] = fallback.value;
      }
    }
  } else {
    // Ensure any remaining unresolved fields have local fallback values
    for (const f of fieldsForAIValues) {
      const fallback =
        f.controlType === 'select' || f.controlType === 'multi-select'
          ? generateValueForSelectField(f, dataContext)
          : f.controlType === 'radio'
            ? generateValueForRadioField(f, dataContext) ?? generateValueForField(f, dataContext)
            : generateValueForField(f, dataContext);
      if (fallback) proposedValues[f.id] = fallback.value;
    }
  }

  // Step 11–12: Identify document upload requirements
  onStage?.('preparing_documents', 'Preparing document upload plans...', 64);
  const documentPlans: DocumentPlanItem[] = [];
  if (generateDocuments) {
    for (const fileField of scanResult.fileFields) {
      if (fileField.disabled || fileField.readonly) continue;
      const format = inferDocumentFormat(fileField);
      const labelClean = (fileField.label || fileField.fieldName || 'Document')
        .replace(/[^a-zA-Z0-9]/g, '-')
        .replace(/-+/g, '-');
      const docType = fileField.documentSemanticType || labelClean.toLowerCase().replace(/-/g, '_');
      documentPlans.push({
        fieldId: fileField.id,
        label: fileField.label || fileField.fieldName || 'File Upload',
        documentType: docType,
        format,
        filename: `${labelClean}.${format}`,
        maxFileSizeBytes: fileField.maxFileSizeBytes,
        multiple: fileField.multiple,
        autoUploadRisk: fileField.autoUploadRisk,
        // Require explicit user approval when auto-upload risk is known or possible
        approved: fileField.autoUploadRisk === 'unknown',
      });
    }
  }

  // Build declarative ExecutionActions
  const actions: ExecutionAction[] = Object.entries(proposedValues).map(([fieldId, value]) => ({
    type: 'SET_VALUE',
    fieldId,
    value,
  }));

  for (const doc of documentPlans) {
    if (doc.approved) {
      actions.push({
        type: 'UPLOAD_FILE',
        fieldId: doc.fieldId,
        format: doc.format,
        documentType: doc.documentType,
        metadata: { filename: doc.filename, maxFileSizeBytes: doc.maxFileSizeBytes },
      });
    }
  }

  return {
    sessionId: scanResult.sessionId,
    origin: scanResult.origin,
    mode,
    locale,
    scenario,
    preserveExisting,
    generateDocuments,
    formPurpose: intel.formPurpose,
    businessDomain: intel.businessDomain,
    suggestedLocale: intel.suggestedLocale,
    formFingerprint: intel.formFingerprint,
    resolvedFields: intel.fields,
    stats: intel.stats,
    proposedValues,
    documentPlans,
    actions,
    dataContext,
    aiUsed,
    aiError,
  };
}

/**
 * Convert a SmartFillPlan (with optional user overrides/exclusions) into an ExecutionPlan.
 */
export function toExecutionPlan(
  plan: SmartFillPlan,
  excludedFieldIds: string[] = [],
  approvedDocFieldIds?: Set<string>
): ExecutionPlan {
  const excludedSet = new Set(excludedFieldIds);
  const actions: ExecutionAction[] = [];

  for (const [fieldId, value] of Object.entries(plan.proposedValues)) {
    if (excludedSet.has(fieldId)) continue;
    actions.push({
      type: 'SET_VALUE',
      fieldId,
      value,
    });
  }

  if (plan.generateDocuments) {
    for (const doc of plan.documentPlans) {
      if (excludedSet.has(doc.fieldId)) continue;
      const isApproved = approvedDocFieldIds ? approvedDocFieldIds.has(doc.fieldId) : doc.approved;
      if (!isApproved) continue;
      actions.push({
        type: 'UPLOAD_FILE',
        fieldId: doc.fieldId,
        format: doc.format,
        documentType: doc.documentType,
        metadata: { filename: doc.filename, maxFileSizeBytes: doc.maxFileSizeBytes },
      });
    }
  }

  return {
    sessionId: plan.sessionId,
    origin: plan.origin,
    scenario: plan.scenario,
    locale: plan.locale,
    actions,
    submitForm: false,
    preserveExisting: plan.preserveExisting,
    scope: plan.scenario === 'required_only' ? 'required' : 'all',
    maxRetries: 3,
    timeoutMs: 60000,
  };
}

/**
 * Regenerate a single field's value using AI (if enabled) or local generator with a fresh seed.
 */
export async function regenerateSingleField(params: {
  field: FieldDescriptor;
  locale: string;
  scenario: TestScenario;
  instruction?: string;
  formPurpose?: string;
  aiConfig: {
    enabled: boolean;
    localOnlyMode: boolean;
    provider: 'gemini' | 'openai' | 'claude' | 'local';
    apiKey?: string;
    modelId?: string;
  };
}): Promise<{ value: unknown; source: 'ai' | 'local' }> {
  const { field, locale, scenario, instruction, formPurpose, aiConfig } = params;

  if (aiConfig.enabled && !aiConfig.localOnlyMode && aiConfig.apiKey && aiConfig.provider !== 'local') {
    try {
      const provider = createAIProvider(aiConfig.provider, aiConfig.apiKey, aiConfig.modelId);
      if (provider.generateValues) {
        const res = await provider.generateValues({
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
          instruction:
            instruction ||
            `Regenerate a fresh realistic value for "${field.label || field.fieldName}"${formPurpose ? ` in form "${formPurpose}"` : ''}.`,
          locale,
          scenario,
        });
        const val = res?.[field.id] ?? (field.fieldName ? res?.[field.fieldName] : undefined);
        if (val !== undefined && val !== null && val !== '') {
          return { value: val, source: 'ai' };
        }
      }
    } catch (err) {
      console.warn('[FillPro] AI single-field regeneration failed, using local:', err);
    }
  }

  const ctx = buildTestDataContext(locale, { seed: Date.now() + Math.floor(Math.random() * 10000), scenario });
  const gen =
    field.controlType === 'select' || field.controlType === 'multi-select'
      ? generateValueForSelectField(field, ctx)
      : field.controlType === 'radio'
        ? generateValueForRadioField(field, ctx) ?? generateValueForField(field, ctx)
        : generateValueForField(field, ctx);

  return { value: gen?.value ?? '', source: 'local' };
}

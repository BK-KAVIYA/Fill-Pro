// ============================================================
// FILL PRO — Validation and Self-Healing Engine
// ============================================================

import type {
  FieldDescriptor,
  GeneratedValue,
  FillResult,
  VerificationResult,
  FillStatus,
} from '../../types/index.js';
import type { ResolvedField, ComponentAdapter, ExecutionContext } from '../interaction/adapterRegistry.js';

export interface ValidationReport {
  fieldId: string;
  passed: boolean;
  nativeValid?: boolean;
  ariaInvalid?: boolean;
  visibleErrors: string[];
  status: FillStatus;
  requiresRecovery: boolean;
}

function collectVisibleValidationMessages(el: Element): string[] {
  const messages: string[] = [];
  const container = el.closest('form-field, .form-group, .field-wrapper, .field-container, .mb-3, .form-row') || el.parentElement;
  if (!container) return messages;

  const errorSelectors = [
    '[role="alert"]',
    '.invalid-feedback',
    '.error-message',
    '.validation-error',
    '.field-error',
    '.mat-error',
    '.p-error',
    '.ant-form-explain',
  ];

  for (const sel of errorSelectors) {
    const errorEls = container.querySelectorAll(sel);
    for (const errEl of errorEls) {
      if (errEl === el || errEl.contains(el)) continue;
      const text = errEl.textContent?.trim() || '';
      if (text.length > 1 && text !== '*') {
        messages.push(text);
      }
    }
  }

  // Also check for explicit text-danger error paragraphs (excluding label asterisks)
  const dangerEls = container.querySelectorAll('p.text-danger, div.text-danger, span.text-danger');
  for (const dangerEl of dangerEls) {
    if (dangerEl === el || dangerEl.contains(el)) continue;
    if (dangerEl.closest('label')) continue; // skip asterisk inside label
    const text = dangerEl.textContent?.trim() || '';
    if (text.length > 2 && text !== '*' && !text.includes('mandatory')) {
      messages.push(text);
    }
  }

  return [...new Set(messages)];
}

export function validateFieldAfterFill(el: Element, field: FieldDescriptor): ValidationReport {
  const nativeInput = el as HTMLInputElement;
  const nativeValid = nativeInput.validity ? nativeInput.validity.valid : true;
  const ariaInvalid = el.getAttribute('aria-invalid') === 'true';
  const visibleErrors = collectVisibleValidationMessages(el);

  // Check if element has value retained
  let hasValue = false;
  if ('files' in el && (el as HTMLInputElement).files && (el as HTMLInputElement).files!.length > 0) {
    hasValue = true;
  } else if ('value' in el) {
    hasValue = String((el as HTMLInputElement).value).trim().length > 0;
  } else if ('checked' in el) {
    hasValue = true;
  } else if ((el as HTMLElement).isContentEditable) {
    hasValue = ((el as HTMLElement).textContent?.trim().length ?? 0) > 0;
  }

  const failed = (!nativeValid || ariaInvalid || visibleErrors.length > 0) && !hasValue;
  const status: FillStatus = failed ? 'validation_failed' : 'filled_verified';

  return {
    fieldId: field.id,
    passed: !failed,
    nativeValid,
    ariaInvalid,
    visibleErrors,
    status,
    requiresRecovery: failed && !field.isSensitive,
  };
}

// ---- Self-Healing ----
export interface RecoveryStrategy {
  strategyId: string;
  description: string;
  apply(field: FieldDescriptor, error: string, currentValue: GeneratedValue): GeneratedValue | null;
}

const recoveryStrategies: RecoveryStrategy[] = [
  {
    strategyId: 'truncate',
    description: 'Truncate value to max length',
    apply(field, error, value) {
      if (!field.constraints.maxLength) return null;
      const str = String(value.value);
      if (str.length <= field.constraints.maxLength) return null;
      return { ...value, value: str.substring(0, field.constraints.maxLength), displayValue: str.substring(0, field.constraints.maxLength) };
    },
  },
  {
    strategyId: 'clamp-number',
    description: 'Clamp number to min/max range',
    apply(field, error, value) {
      if (field.controlType !== 'number') return null;
      const num = Number(value.value);
      if (isNaN(num)) return null;
      const min = field.constraints.min ? Number(field.constraints.min) : -Infinity;
      const max = field.constraints.max ? Number(field.constraints.max) : Infinity;
      const clamped = Math.min(Math.max(num, min), max);
      if (clamped === num) return null;
      return { ...value, value: clamped, displayValue: String(clamped) };
    },
  },
  {
    strategyId: 'format-date',
    description: 'Reformat date value',
    apply(field, error, value) {
      if (field.controlType !== 'date') return null;
      const str = String(value.value);
      if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return null;
      // Try to parse and reformat
      const d = new Date(str);
      if (isNaN(d.getTime())) return null;
      const formatted = d.toISOString().split('T')[0]!;
      return { ...value, value: formatted, displayValue: formatted };
    },
  },
];

export async function attemptRecovery(
  field: FieldDescriptor,
  errorMessage: string,
  currentValue: GeneratedValue,
  adapter: ComponentAdapter,
  resolved: ResolvedField,
  ctx: ExecutionContext,
  maxAttempts: number = 3
): Promise<FillResult> {
  let attempts = 0;
  let lastResult: FillResult = {
    fieldId: field.id,
    status: 'validation_failed',
    attempts: 0,
    durationMs: 0,
    validationMessage: errorMessage,
  };

  for (const strategy of recoveryStrategies) {
    if (attempts >= maxAttempts) break;
    if (ctx.abortSignal.aborted) break;

    const corrected = strategy.apply(field, errorMessage, currentValue);
    if (!corrected) continue;

    attempts++;
    const result = await adapter.fill(resolved, corrected, ctx);
    if (result.status !== 'validation_failed' && result.status !== 'error') {
      return { ...result, attempts, status: 'corrected_verified' };
    }
    lastResult = result;
  }

  return { ...lastResult, attempts };
}

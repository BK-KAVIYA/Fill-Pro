// ============================================================
// FILL PRO — Content Script
// ============================================================

import { scanForms } from '../src/engines/discovery/formScanner.js';
import { generateValueForField, generateValueForSelectField, generateValueForRadioField, buildTestDataContext } from '../src/engines/generation/localGenerator.js';
import { getAdapter, resolveElement, attachFiles } from '../src/engines/interaction/adapterRegistry.js';
import { validateFieldAfterFill, attemptRecovery } from '../src/engines/validation/validator.js';
import type {
  FieldDescriptor,
  FillResult,
  ExecutionPlan,
  ExecutionProgressEvent,
  ExecutionReport,
  TestDataContext,
} from '../src/types/index.js';

// ---- State ----
let currentScanResult: ReturnType<typeof scanForms> | null = null;
let sessionSnapshot: Map<string, unknown> = new Map();
let activeController: AbortController | null = null;
let isAlive = true;

export default defineContentScript({
  matches: ['<all_urls>'],
  main() {
    // ---- Message listener ----
    chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
      if (!isAlive) return;

      (async () => {
        switch (message.type) {
          case 'PING':
            return { alive: true };

          case 'DO_SCAN': {
            try {
              currentScanResult = scanForms();
              return currentScanResult;
            } catch (err: any) {
              console.error('[FillPro] DO_SCAN error stack:', err?.stack || err);
              return { error: String(err?.stack || err) };
            }
          }

          case 'DO_EXECUTE': {
            const plan = message.payload as ExecutionPlan;
            return await executeplan(plan);
          }

          case 'DO_UNDO': {
            return await performUndo();
          }

          case 'HIGHLIGHT_FIELD': {
            highlightField(message.payload.fieldId);
            return { done: true };
          }

          default:
            return { unhandled: true };
        }
      })().then(sendResponse).catch(err => sendResponse({ error: String(err) }));

      return true;
    });

    // Add highlight animation
    const style = document.createElement('style');
    style.textContent = `
      @keyframes fill-pro-pulse {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.5; }
      }
    `;
    document.head.appendChild(style);
  },
});

// ---- Highlight field ----
function highlightField(fieldId: string): void {
  if (!currentScanResult) return;
  const field = currentScanResult.fields.find(f => f.id === fieldId);
  if (!field) return;

  const el = resolveElement(field);
  if (!el) return;

  (el as HTMLElement).scrollIntoView({ behavior: 'smooth', block: 'center' });

  const existing = document.getElementById('fill-pro-highlight');
  existing?.remove();

  const rect = (el as HTMLElement).getBoundingClientRect();
  const highlight = document.createElement('div');
  highlight.id = 'fill-pro-highlight';
  highlight.className = 'fill-pro-injected';
  highlight.style.cssText = `
    position: fixed;
    top: ${rect.top - 4}px;
    left: ${rect.left - 4}px;
    width: ${rect.width + 8}px;
    height: ${rect.height + 8}px;
    border: 2px solid #6366F1;
    border-radius: 6px;
    background: rgba(99, 102, 241, 0.1);
    pointer-events: none;
    z-index: 999999;
    animation: fill-pro-pulse 2s ease-in-out;
  `;
  document.body.appendChild(highlight);
  setTimeout(() => highlight.remove(), 3000);
}

function dismissBlockingPopups(): boolean {
  const popups = document.querySelectorAll('.modal.show, .swal2-container, .modal-dialog, div[role="dialog"]');
  let dismissed = false;
  for (const popup of popups) {
    if ((popup as HTMLElement).offsetParent === null && !(popup as HTMLElement).classList.contains('show')) continue;
    // Don't close an input form modal if it has unfilled form fields
    const inputs = popup.querySelectorAll('input:not([type="hidden"]), select, textarea');
    if (inputs.length > 3) continue;

    const closeBtn = popup.querySelector<HTMLElement>('.btn-close, .close, [aria-label="Close"], button.close, button.btn-secondary, button.btn-light, .swal2-confirm, .swal2-close');
    if (closeBtn) {
      console.log('[FillPro] Dismissing blocking popup:', closeBtn);
      closeBtn.click();
      dismissed = true;
    }
  }
  return dismissed;
}

async function handleRequiredEmptyTables(): Promise<number> {
  let added = 0;
  const errorContainers = document.querySelectorAll('form-control-error, .error-container, .message-container.active-error, app-no-records-found');
  for (const container of errorContainers) {
    const text = (container.textContent ?? '').toLowerCase();
    const isRequiredEmpty = text.includes('must contain at least') ||
      text.includes('no records yet') ||
      container.tagName === 'APP-NO-RECORDS-FOUND';

    if (isRequiredEmpty) {
      const parent = container.closest('subsection, section, .section-card, form-field, table-entry-section-content, .card') || container.parentElement?.parentElement;
      if (parent) {
        const addBtn = parent.querySelector<HTMLButtonElement>('button.btn-light-bordered, button[class*="btn"]:not([type="submit"]):not([disabled])');
        if (addBtn && /\+\s*add\s*entry|add\s*entry|add\s*row|add\s*director|add\s*item/i.test(addBtn.textContent ?? '')) {
          console.log('[FillPro] Triggering dynamic table Add Entry:', addBtn.textContent?.trim());
          addBtn.click();
          added++;
          await sleep(350);
        }
      }
    }
  }
  return added;
}

// ---- Execute plan ----
async function executeplan(plan: ExecutionPlan): Promise<ExecutionReport> {
  dismissBlockingPopups();

  // If there are required tables with 0 records (e.g. Directors), trigger Add Entry
  const dynamicRowsAdded = await handleRequiredEmptyTables();
  if (dynamicRowsAdded > 0 || !currentScanResult) {
    currentScanResult = scanForms();
  }

  activeController = new AbortController();
  const ctx = { sessionId: plan.sessionId, locale: plan.locale, abortSignal: activeController.signal };

  // Build data context
  const dataCtx = buildTestDataContext(plan.locale, { sessionId: plan.sessionId, scenario: plan.scenario });

  const startTime = Date.now();
  const fieldResults: FillResult[] = [];
  const fields = currentScanResult.fields.filter(f => {
    if (f.disabled || f.readonly) return false;
    if (f.isSensitive) return false;
    if (plan.preserveExisting && f.hasExistingValue) return false;
    if (plan.scope === 'required' && !f.required) return false;
    return true;
  });

  for (let i = 0; i < fields.length; i++) {
    if (activeController.signal.aborted) break;

    const field = fields[i]!;

    // Send progress
    const progressEvent: ExecutionProgressEvent = {
      sessionId: plan.sessionId,
      stage: 'filling',
      currentAction: i + 1,
      totalActions: fields.length,
      currentFieldId: field.id,
      currentFieldLabel: field.label ?? field.fieldName,
      status: `Filling ${field.label ?? field.fieldName ?? 'field'}...`,
      percentage: Math.round(((i + 1) / fields.length) * 100),
    };
    chrome.runtime.sendMessage({ type: 'EXECUTION_PROGRESS', payload: progressEvent }).catch(() => {});

    // Check if an AI or custom value was provided in plan.actions
    const planAction = plan.actions?.find(a => a.fieldId === field.id || a.fieldId === field.fieldName);
    const customValue = planAction?.value;

    const result = await fillField(field, dataCtx, ctx, customValue, plan.scenario);
    fieldResults.push(result);

    // Dismiss any non-essential popups that might have appeared
    dismissBlockingPopups();

    // Small delay between fields
    await sleep(50);
  }

  const duration = Date.now() - startTime;

  const report: ExecutionReport = {
    sessionId: plan.sessionId,
    url: window.location.href,
    scenario: plan.scenario,
    startedAt: startTime,
    completedAt: Date.now(),
    durationMs: duration,
    totalFields: fields.length,
    filledVerified: fieldResults.filter(r => r.status === 'filled_verified').length,
    filledUnknown: fieldResults.filter(r => r.status === 'filled_validation_unknown').length,
    correctedVerified: fieldResults.filter(r => r.status === 'corrected_verified').length,
    validationFailed: fieldResults.filter(r => r.status === 'validation_failed').length,
    skippedExisting: fieldResults.filter(r => r.status === 'skipped_existing').length,
    skippedSensitive: fieldResults.filter(r => r.status === 'skipped_sensitive').length,
    unsupported: fieldResults.filter(r => r.status === 'unsupported_component').length,
    requiresManualReview: fieldResults.filter(r => r.status === 'requires_manual_review').length,
    errors: fieldResults.filter(r => r.status === 'error').length,
    documentsGenerated: fieldResults.filter(r => r.adapterId === 'native-file').length,
    filesAttached: fieldResults.filter(r => r.adapterId === 'native-file' && (r.status === 'filled_verified' || r.status === 'filled_validation_unknown')).length,
    filesRequiringManual: fieldResults.filter(r => r.adapterId === 'native-file' && (r.status === 'validation_failed' || r.status === 'error')).length,
    aiRequestCount: 0,
    aiErrors: 0,
    fieldResults,
    learnedMappings: 0,
    warnings: [],
    criticalErrors: [],
  };

  chrome.runtime.sendMessage({ type: 'EXECUTION_COMPLETE', payload: report }).catch(() => {});
  return report;
}

function getCurrentFieldValue(el: Element): string {
  if ('files' in el && (el as HTMLInputElement).files && (el as HTMLInputElement).files!.length > 0) {
    return (el as HTMLInputElement).files![0]?.name ?? '';
  }
  if ('value' in el) {
    return String((el as HTMLInputElement).value ?? '');
  }
  if ((el as HTMLElement).isContentEditable) {
    return (el as HTMLElement).textContent ?? '';
  }
  return '';
}

async function retryWithFrameworkEvents(el: Element, value: unknown): Promise<void> {
  const strVal = String(value ?? '');
  const proto =
    el.tagName === 'TEXTAREA'
      ? HTMLTextAreaElement.prototype
      : el.tagName === 'SELECT'
        ? HTMLSelectElement.prototype
        : HTMLInputElement.prototype;
  const nativeSetter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
  if (nativeSetter) {
    nativeSetter.call(el, strVal);
  } else if ('value' in el) {
    (el as HTMLInputElement).value = strVal;
  }
  el.dispatchEvent(new Event('focus', { bubbles: true }));
  el.dispatchEvent(new Event('input', { bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
  el.dispatchEvent(new Event('blur', { bubbles: true }));
  await sleep(60);
}

function applyLocalCorrection(field: FieldDescriptor, currentValue: any, errorMsg: string): any | null {
  const str = String(currentValue.value ?? '');
  if (field.constraints.maxLength && str.length > field.constraints.maxLength) {
    const trimmed = str.substring(0, field.constraints.maxLength);
    return { ...currentValue, value: trimmed, displayValue: trimmed };
  }
  if (field.controlType === 'number') {
    const num = Number(str.replace(/[^0-9.-]/g, ''));
    if (!isNaN(num)) {
      const min = field.constraints.min !== undefined ? Number(field.constraints.min) : -Infinity;
      const max = field.constraints.max !== undefined ? Number(field.constraints.max) : Infinity;
      const clamped = Math.min(Math.max(num, min), max);
      return { ...currentValue, value: clamped, displayValue: String(clamped) };
    }
  }
  if (field.controlType === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(str)) {
    const fixed = `${str.replace(/[^a-zA-Z0-9._-]/g, '') || 'user'}@example.com`;
    return { ...currentValue, value: fixed, displayValue: fixed };
  }
  if (field.controlType === 'url' && str && !/^https?:\/\//i.test(str)) {
    const fixed = `https://${str}`;
    return { ...currentValue, value: fixed, displayValue: fixed };
  }
  if (/required|empty|cannot be blank/i.test(errorMsg) && !str) {
    return { ...currentValue, value: 'Sample Value', displayValue: 'Sample Value' };
  }
  return null;
}

async function fillField(
  field: FieldDescriptor,
  dataCtx: TestDataContext,
  ctx: { sessionId: string; locale: string; abortSignal: AbortSignal },
  customValue?: any,
  scenario?: string
): Promise<FillResult> {
  const start = performance.now();

  const el = resolveElement(field);
  if (!el) {
    return { fieldId: field.id, status: 'field_missing', attempts: 0, durationMs: performance.now() - start };
  }

  // Record snapshot for undo
  const inputEl = el as HTMLInputElement;
  sessionSnapshot.set(field.id, inputEl.value ?? inputEl.checked ?? '');

  const adapter = getAdapter(field);
  if (!adapter) {
    return { fieldId: field.id, status: 'unsupported_component', attempts: 0, durationMs: performance.now() - start };
  }

  const resolved = { descriptor: field, element: el };
  const executionCtx = { ...ctx };

  // Generate value
  let generated;
  if (customValue !== undefined && customValue !== null && customValue !== '') {
    generated = {
      fieldId: field.id,
      value: customValue,
      displayValue: String(customValue),
      generatorId: 'ai-assistant',
      semanticType: field.semanticType,
      locale: dataCtx.locale,
    };
  } else if (field.controlType === 'file') {
    const fileField = field as any;
    const extensions: string[] = fileField.acceptedExtensions ?? [];
    let format = 'pdf';
    if (extensions.some((e: string) => e.includes('png') || e.includes('jpg') || e.includes('jpeg'))) {
      format = extensions.some((e: string) => e.includes('pdf')) ? 'pdf' : 'png';
    } else if (extensions.some((e: string) => e.includes('xlsx') || e.includes('xls'))) {
      format = 'xlsx';
    } else if (extensions.some((e: string) => e.includes('docx') || e.includes('doc'))) {
      format = 'docx';
    } else if (extensions.some((e: string) => e.includes('csv'))) {
      format = 'csv';
    }

    const labelClean = (field.label || field.fieldName || 'Document').replace(/[^a-zA-Z0-9]/g, '-').replace(/-+/g, '-');
    const filename = `${labelClean}.${format}`;
    const docType = fileField.documentSemanticType || labelClean.toLowerCase().replace(/-/g, '_');

    try {
      const resp: any = await chrome.runtime.sendMessage({
        type: 'GENERATE_DOCUMENT',
        payload: {
          format,
          documentSemanticType: docType,
          dataContext: dataCtx,
          filename,
        },
      });

      let file: File;
      if (resp && resp.base64) {
        const binStr = atob(resp.base64);
        const len = binStr.length;
        const bytes = new Uint8Array(len);
        for (let j = 0; j < len; j++) bytes[j] = binStr.charCodeAt(j);
        file = new File([bytes], resp.filename, { type: resp.mimeType });
      } else {
        const blob = new Blob([`Fill Pro Synthetic Test Document\nField: ${field.label ?? field.id}\nDate: ${new Date().toISOString()}`], { type: 'application/pdf' });
        file = new File([blob], `${labelClean}.pdf`, { type: 'application/pdf' });
      }

      generated = {
        fieldId: field.id,
        value: filename,
        displayValue: filename,
        generatorId: `file-${format}`,
        semanticType: field.semanticType,
        locale: dataCtx.locale,
        metadata: { files: [file] },
      };
    } catch (err) {
      console.warn('[FillPro] Document generation error, falling back to simple file:', err);
      const blob = new Blob([`Fill Pro Synthetic Test Document\nField: ${field.label ?? field.id}\nDate: ${new Date().toISOString()}`], { type: 'application/pdf' });
      const file = new File([blob], `${labelClean}.pdf`, { type: 'application/pdf' });
      generated = {
        fieldId: field.id,
        value: `${labelClean}.pdf`,
        displayValue: `${labelClean}.pdf`,
        generatorId: 'file-fallback',
        semanticType: field.semanticType,
        locale: dataCtx.locale,
        metadata: { files: [file] },
      };
    }
  } else if (field.controlType === 'select' || field.controlType === 'multi-select') {
    generated = generateValueForSelectField(field, dataCtx);
    if (!generated) {
      return { fieldId: field.id, status: 'validation_failed', attempts: 0, durationMs: performance.now() - start, validationMessage: 'No valid options available' };
    }
  } else if (field.controlType === 'radio') {
    generated = generateValueForRadioField(field, dataCtx);
    if (!generated) {
      generated = generateValueForField(field, dataCtx);
    }
  } else {
    generated = generateValueForField(field, dataCtx);
  }

  // Fill
  let result = await adapter.fill(resolved, generated, executionCtx);

  // Do not auto-correct intentionally invalid test data
  const isIntentionalInvalidScenario = scenario === 'negative_test' || scenario === 'boundary_test';

  // Self-healing verification & recovery (max 3 attempts)
  if (result.status !== 'error' && result.status !== 'unsupported_component' && field.controlType !== 'file') {
    let attempts = 0;
    let currentGen = generated;

    for (let attempt = 0; attempt < 3; attempt++) {
      await sleep(60);

      // 1. Check if framework cleared the value
      const retained = getCurrentFieldValue(el);
      if (!retained && currentGen.value !== undefined && String(currentGen.value).trim() !== '' && field.controlType !== 'checkbox' && field.controlType !== 'toggle') {
        attempts++;
        await retryWithFrameworkEvents(el, currentGen.value);
        continue;
      }

      // 2. Validate native validity & visible errors
      const validation = validateFieldAfterFill(el, field);
      if (!validation.requiresRecovery || isIntentionalInvalidScenario) {
        return {
          ...result,
          attempts: Math.max(result.attempts, attempts),
          status: attempts > 0 && validation.passed ? 'corrected_verified' : validation.status,
          generatedValue: currentGen,
        };
      }

      attempts++;
      const errorMsg = validation.visibleErrors[0] ?? 'Validation failed';

      // 3. Try local correction rules first
      const localFixed = applyLocalCorrection(field, currentGen, errorMsg);
      if (localFixed) {
        currentGen = localFixed;
        result = await adapter.fill(resolved, currentGen, executionCtx);
        continue;
      }

      // 4. Fallback to built-in validator recovery strategies
      const recovered = await attemptRecovery(field, errorMsg, currentGen, adapter, resolved, executionCtx, 1);
      if (recovered.status === 'corrected_verified' || recovered.status === 'filled_verified') {
        return { ...recovered, attempts };
      }

      // 5. Fallback to AI correction if available
      try {
        const aiResp: any = await chrome.runtime.sendMessage({
          type: 'CORRECT_FIELD_VALUE',
          payload: {
            field,
            currentValue: currentGen.value,
            validationError: errorMsg,
            locale: dataCtx.locale,
          },
        });
        if (aiResp?.success && aiResp.value !== undefined) {
          currentGen = {
            ...currentGen,
            value: aiResp.value,
            displayValue: String(aiResp.value),
            generatorId: 'ai-recovery',
          };
          result = await adapter.fill(resolved, currentGen, executionCtx);
          continue;
        }
      } catch {
        // AI unavailable
      }

      break;
    }

    const finalValidation = validateFieldAfterFill(el, field);
    return {
      ...result,
      attempts,
      status: finalValidation.passed ? (attempts > 0 ? 'corrected_verified' : 'filled_verified') : 'validation_failed',
      validationMessage: finalValidation.visibleErrors[0],
      generatedValue: currentGen,
    };
  }

  return result;
}

// ---- Undo ----
async function performUndo(): Promise<{ restored: number }> {
  if (!currentScanResult) return { restored: 0 };
  let restored = 0;

  for (const [fieldId, previousValue] of sessionSnapshot) {
    const field = currentScanResult.fields.find(f => f.id === fieldId);
    if (!field) continue;

    const el = resolveElement(field);
    if (!el) continue;

    const inputEl = el as HTMLInputElement;
    if ('checked' in inputEl && typeof previousValue === 'boolean') {
      inputEl.checked = previousValue;
    } else if ('value' in inputEl) {
      inputEl.value = String(previousValue ?? '');
    }
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    restored++;
  }

  sessionSnapshot.clear();
  return { restored };
}

function sleep(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms));
}

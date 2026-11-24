// ============================================================
// FILL PRO — Component Interaction Engine
// ============================================================

import type {
  FieldDescriptor,
  GeneratedValue,
  FillResult,
  VerificationResult,
  ControlType,
} from '../../types/index.js';

export interface ResolvedField {
  descriptor: FieldDescriptor;
  element: Element;
}

export interface ExecutionContext {
  sessionId: string;
  locale: string;
  abortSignal: AbortSignal;
}

export interface ComponentAdapter {
  id: string;
  priority: number;
  canHandle(field: FieldDescriptor): boolean;
  readValue(field: ResolvedField): Promise<unknown>;
  fill(field: ResolvedField, value: GeneratedValue, ctx: ExecutionContext): Promise<FillResult>;
  verify(field: ResolvedField, expected: GeneratedValue): Promise<VerificationResult>;
  clear?(field: ResolvedField): Promise<void>;
}

// ---- Registry ----
const registry: ComponentAdapter[] = [];

export function registerAdapter(adapter: ComponentAdapter): void {
  registry.push(adapter);
  registry.sort((a, b) => b.priority - a.priority);
}

export function getAdapter(field: FieldDescriptor): ComponentAdapter | undefined {
  return registry.find(a => a.canHandle(field));
}

// ---- DOM utilities ----
function querySelectorDeep(selector: string, root: Document | Element | ShadowRoot = document): Element | null {
  try {
    const el = root.querySelector(selector);
    if (el) return el;
  } catch {
    return null;
  }
  const allElements = root.querySelectorAll('*');
  for (const el of allElements) {
    if (el.shadowRoot) {
      const found = querySelectorDeep(selector, el.shadowRoot);
      if (found) return found;
    }
  }
  return null;
}

export function resolveElement(field: FieldDescriptor): Element | null {
  // 1. Check data-fp-id first
  try {
    const byFpId = document.querySelector(`[data-fp-id="${CSS.escape(field.id)}"]`);
    if (byFpId) return byFpId;
  } catch {}

  // 2. Try candidates in standard light DOM
  const candidates = [field.selector, ...(field.selectorCandidates || [])];
  for (const sel of candidates) {
    if (!sel) continue;
    try {
      const el = document.querySelector(sel);
      if (el) return el;
    } catch {
      continue;
    }
  }

  // 3. Fallback to deep shadow DOM search
  for (const sel of candidates) {
    if (!sel) continue;
    try {
      const el = querySelectorDeep(sel);
      if (el) return el;
    } catch {
      continue;
    }
  }

  return null;
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function setInputValue(el: HTMLInputElement | HTMLTextAreaElement, value: string): void {
  try {
    const proto = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(proto, 'value');
    if (nativeInputValueSetter?.set) {
      nativeInputValueSetter.set.call(el, value);
    } else {
      el.value = value;
    }
  } catch {
    el.value = value;
  }
  // Ensure property is set
  el.value = value;
}

function cleanPhoneNumberForInput(el: Element, val: string): string {
  let cleaned = val.trim();
  const parent = el.closest('.input-group, form-field, .form-group, div');
  const addonText = parent?.querySelector('.input-group-prepend, .input-group-text, .country-code, [class*="prefix"], [class*="addon"]')?.textContent?.trim();

  if (addonText && addonText.includes('+')) {
    const code = addonText.replace(/[^\d+]/g, '');
    if (code && cleaned.startsWith(code)) {
      cleaned = cleaned.slice(code.length).replace(/^0+/, '');
    } else if (cleaned.startsWith('+')) {
      cleaned = cleaned.replace(/^\+\d{1,4}/, '').replace(/^0+/, '');
    }
  } else if (cleaned.startsWith('+')) {
    const maxLen = (el as HTMLInputElement).maxLength;
    if (maxLen > 0 && maxLen <= 10) {
      cleaned = cleaned.replace(/^\+\d{1,4}/, '');
    }
  }
  return cleaned;
}

function cleanCurrencyOrNumeric(el: Element, val: string): string {
  if (el.hasAttribute('customcurrency') || el.getAttribute('type') === 'number') {
    const numOnly = val.replace(/[^0-9.]/g, '');
    if (numOnly) return numOnly;
  }
  return val;
}

function dispatchFullInputLifecycle(el: HTMLInputElement | HTMLTextAreaElement, value: string): void {
  // Focus
  try { el.focus(); } catch {}
  el.dispatchEvent(new FocusEvent('focus', { bubbles: true }));
  el.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));

  // Keydown
  const lastChar = value.slice(-1) || 'a';
  el.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, cancelable: true, key: lastChar }));

  // Assign value using prototype setter & direct property
  setInputValue(el, value);

  // BeforeInput
  try {
    el.dispatchEvent(new InputEvent('beforeinput', { bubbles: true, cancelable: true, composed: true, inputType: 'insertText', data: value }));
  } catch {
    el.dispatchEvent(new Event('beforeinput', { bubbles: true, cancelable: true }));
  }

  // Input event (notifies Angular Reactive Forms & React)
  try {
    el.dispatchEvent(new InputEvent('input', { bubbles: true, cancelable: false, composed: true, inputType: 'insertText', data: value }));
  } catch {
    el.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
  }

  // Keyup
  el.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true, cancelable: true, key: lastChar }));

  // Change event
  el.dispatchEvent(new Event('change', { bubbles: true, composed: true }));

  // Blur (triggers Angular onTouched and validation state update)
  el.dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
  el.dispatchEvent(new FocusEvent('blur', { bubbles: true, composed: true }));
}

function formatValueForInput(value: unknown, controlType: ControlType, htmlType: string): string {
  if (value === null || value === undefined) return '';
  if (controlType === 'date' || htmlType === 'date') {
    // Convert to YYYY-MM-DD if it looks like a date
    const str = String(value);
    const isoMatch = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (isoMatch) return str.substring(0, 10);
    // Try dd/MM/yyyy
    const ddmmMatch = str.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
    if (ddmmMatch) return `${ddmmMatch[3]}-${ddmmMatch[2]}-${ddmmMatch[1]}`;
  }
  if (controlType === 'number') {
    const num = Number(value);
    return isNaN(num) ? String(value) : String(num);
  }
  return String(value);
}

// ---- Native HTML Adapter ----
class NativeInputAdapter implements ComponentAdapter {
  id = 'native-input';
  priority = 10;

  canHandle(field: FieldDescriptor): boolean {
    return ['text', 'email', 'tel', 'url', 'search', 'number', 'password', 'textarea', 'contenteditable',
      'date', 'datetime-local', 'time', 'month', 'week', 'range', 'color', 'custom', 'autocomplete'].includes(field.controlType);
  }

  async readValue(field: ResolvedField): Promise<unknown> {
    const el = field.element;
    if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
      return el.value;
    }
    if ((el as HTMLElement).isContentEditable) {
      return (el as HTMLElement).textContent;
    }
    return null;
  }

  async fill(field: ResolvedField, value: GeneratedValue, ctx: ExecutionContext): Promise<FillResult> {
    const start = performance.now();
    const el = field.element;

    if (ctx.abortSignal.aborted) {
      return { fieldId: field.descriptor.id, status: 'error', attempts: 0, durationMs: 0, error: 'Cancelled' };
    }

    try {
      let formatted = formatValueForInput(value.value, field.descriptor.controlType, field.descriptor.htmlType);

      if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
        const previous = el.value;

        // Clean phone number if country prefix present in input-group or form-field
        if (field.descriptor.semanticType.includes('phone') || field.descriptor.semanticType.includes('mobile')) {
          formatted = cleanPhoneNumberForInput(el, formatted);
        }

        // Clean currency or numeric inputs
        formatted = cleanCurrencyOrNumeric(el, formatted);

        if (field.descriptor.controlType === 'color') {
          el.value = formatted;
          el.dispatchEvent(new Event('input', { bubbles: true }));
          el.dispatchEvent(new Event('change', { bubbles: true }));
        } else {
          dispatchFullInputLifecycle(el, formatted);
        }

        return {
          fieldId: field.descriptor.id,
          status: 'filled_validation_unknown',
          generatedValue: { ...value, value: formatted, displayValue: formatted },
          previousValue: previous,
          adapterId: this.id,
          attempts: 1,
          durationMs: performance.now() - start,
        };
      }

      if ((el as HTMLElement).isContentEditable) {
        const previous = (el as HTMLElement).textContent;
        (el as HTMLElement).textContent = String(value.value);
        el.dispatchEvent(new Event('focus', { bubbles: true }));
        el.dispatchEvent(new InputEvent('input', { bubbles: true, composed: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
        el.dispatchEvent(new Event('blur', { bubbles: true }));
        return {
          fieldId: field.descriptor.id,
          status: 'filled_validation_unknown',
          generatedValue: value,
          previousValue: previous,
          adapterId: this.id,
          attempts: 1,
          durationMs: performance.now() - start,
        };
      }

      return { fieldId: field.descriptor.id, status: 'unsupported_component', attempts: 1, durationMs: performance.now() - start };
    } catch (err) {
      return {
        fieldId: field.descriptor.id,
        status: 'error',
        attempts: 1,
        durationMs: performance.now() - start,
        error: String(err),
      };
    }
  }

  async verify(field: ResolvedField, expected: GeneratedValue): Promise<VerificationResult> {
    const el = field.element;
    const formatted = formatValueForInput(expected.value, field.descriptor.controlType, field.descriptor.htmlType);

    let currentValue = '';
    if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
      currentValue = el.value;
    } else if ((el as HTMLElement).isContentEditable) {
      currentValue = (el as HTMLElement).textContent ?? '';
    }

    const valueRetained = currentValue.trim() === formatted.trim() || currentValue.includes(String(expected.value));
    const nativeInput = el as HTMLInputElement;

    return {
      fieldId: field.descriptor.id,
      passed: valueRetained,
      valueRetained,
      nativeValidityValid: nativeInput.validity ? nativeInput.validity.valid : undefined,
      ariaInvalid: el.getAttribute('aria-invalid') === 'true',
    };
  }

  async clear(field: ResolvedField): Promise<void> {
    const el = field.element;
    if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
      dispatchFullInputLifecycle(el, '');
    }
  }
}

// ---- Native Select Adapter ----
class NativeSelectAdapter implements ComponentAdapter {
  id = 'native-select';
  priority = 10;

  canHandle(field: FieldDescriptor): boolean {
    return field.controlType === 'select' || field.controlType === 'multi-select';
  }

  async readValue(field: ResolvedField): Promise<unknown> {
    const el = field.element as HTMLSelectElement;
    return el.value;
  }

  async fill(field: ResolvedField, value: GeneratedValue, ctx: ExecutionContext): Promise<FillResult> {
    const start = performance.now();
    const el = field.element as HTMLSelectElement;

    if (ctx.abortSignal.aborted) {
      return { fieldId: field.descriptor.id, status: 'error', attempts: 0, durationMs: 0, error: 'Cancelled' };
    }

    const previous = el.value;
    const targetValue = String(value.value).trim();
    const targetDisplay = String(value.displayValue || value.value).trim();

    const options = Array.from(el.options);
    const selectableOptions = options.filter(o => !o.disabled && o.value !== '' && o.value !== '--');

    // 1. Exact value match
    let found = selectableOptions.find(o => o.value === targetValue);
    // 2. Case-insensitive value match
    if (!found) found = selectableOptions.find(o => o.value.toLowerCase() === targetValue.toLowerCase());
    // 3. Exact text match
    if (!found) found = selectableOptions.find(o => o.text.trim().toLowerCase() === targetValue.toLowerCase());
    if (!found) found = selectableOptions.find(o => o.text.trim().toLowerCase() === targetDisplay.toLowerCase());
    // 4. Partial text match
    if (!found) found = selectableOptions.find(o => o.text.toLowerCase().includes(targetValue.toLowerCase()) || targetValue.toLowerCase().includes(o.text.toLowerCase()));
    // 5. Country code fallbacks
    if (!found && field.descriptor.semanticType.includes('country')) {
      found = selectableOptions.find(o => o.value.toLowerCase() === 'lk' || o.text.toLowerCase().includes('sri lanka')) ||
              selectableOptions.find(o => o.value.toLowerCase() === 'us' || o.text.toLowerCase().includes('united states'));
    }
    // 6. First valid option
    if (!found && selectableOptions.length > 0) {
      found = selectableOptions[0];
    }

    if (found) {
      try { el.focus(); } catch {}
      el.selectedIndex = found.index;
      found.selected = true;

      try {
        const descriptor = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value');
        if (descriptor?.set) {
          descriptor.set.call(el, found.value);
        } else {
          el.value = found.value;
        }
      } catch {
        el.value = found.value;
      }
      el.value = found.value;

      el.dispatchEvent(new Event('focus', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true, composed: true }));
      el.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
      el.dispatchEvent(new Event('blur', { bubbles: true, composed: true }));

      return {
        fieldId: field.descriptor.id,
        status: 'filled_validation_unknown',
        generatedValue: { ...value, value: found.value, displayValue: found.text.trim() },
        previousValue: previous,
        adapterId: this.id,
        attempts: 1,
        durationMs: performance.now() - start,
      };
    }

    return {
      fieldId: field.descriptor.id,
      status: 'validation_failed',
      attempts: 1,
      durationMs: performance.now() - start,
      validationMessage: `Option "${targetValue}" not found in select`,
    };
  }

  async verify(field: ResolvedField, expected: GeneratedValue): Promise<VerificationResult> {
    const el = field.element as HTMLSelectElement;
    return {
      fieldId: field.descriptor.id,
      passed: el.value === String(expected.value),
      valueRetained: el.value !== '',
    };
  }
}

// ---- Native Checkbox Adapter ----
class NativeCheckboxAdapter implements ComponentAdapter {
  id = 'native-checkbox';
  priority = 10;

  canHandle(field: FieldDescriptor): boolean {
    return field.controlType === 'checkbox' || field.controlType === 'toggle';
  }

  async readValue(field: ResolvedField): Promise<unknown> {
    const el = field.element as HTMLInputElement;
    return el.checked ?? (el.getAttribute('aria-checked') === 'true');
  }

  async fill(field: ResolvedField, value: GeneratedValue, ctx: ExecutionContext): Promise<FillResult> {
    const start = performance.now();
    const el = field.element as HTMLInputElement;
    const checked = value.value === true || value.value === 'true' || value.value === 1;
    const previous = el.checked ?? (el.getAttribute('aria-checked') === 'true');

    if (previous !== checked) {
      const label = el.id ? document.querySelector<HTMLElement>(`label[for="${CSS.escape(el.id)}"]`) : el.closest('label');
      if (label) {
        label.click();
      } else {
        el.click();
      }
      el.checked = checked;
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    }

    return {
      fieldId: field.descriptor.id,
      status: 'filled_verified',
      generatedValue: value,
      previousValue: previous,
      adapterId: this.id,
      attempts: 1,
      durationMs: performance.now() - start,
    };
  }

  async verify(field: ResolvedField, expected: GeneratedValue): Promise<VerificationResult> {
    const el = field.element as HTMLInputElement;
    return { fieldId: field.descriptor.id, passed: true, valueRetained: true };
  }
}

// ---- Native Radio Adapter ----
function getRadiosForField(field: ResolvedField): HTMLInputElement[] {
  // 1. By data-fp-id
  if (field.descriptor.id) {
    const byId = Array.from(document.querySelectorAll<HTMLInputElement>(`input[type="radio"][data-fp-id="${CSS.escape(field.descriptor.id)}"]`));
    if (byId.length > 0) return byId;
  }

  // 2. By name
  const name = field.element.getAttribute('name');
  if (name) {
    const byName = Array.from(document.querySelectorAll<HTMLInputElement>(`input[type="radio"][name="${CSS.escape(name)}"]`));
    if (byName.length > 0) return byName;
  }

  // 3. By container
  const container = field.element.closest('.radio-group, [role="radiogroup"], form-field, .form-group, .form-control-container, fieldset, td, tr') || field.element.parentElement;
  if (container) {
    const byContainer = Array.from(container.querySelectorAll<HTMLInputElement>('input[type="radio"]'));
    if (byContainer.length > 0) return byContainer;
  }

  if (field.element.tagName === 'INPUT' && (field.element as HTMLInputElement).type === 'radio') {
    return [field.element as HTMLInputElement];
  }

  return [];
}

function selectRadio(radio: HTMLInputElement): void {
  const label = radio.id ? document.querySelector<HTMLElement>(`label[for="${CSS.escape(radio.id)}"]`) : radio.closest('label');
  try {
    radio.scrollIntoView({ behavior: 'auto', block: 'nearest' });
  } catch {}
  radio.focus();

  if (label) {
    label.click();
  }
  radio.checked = true;
  radio.click();

  radio.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));
  radio.dispatchEvent(new Event('change', { bubbles: true, cancelable: true }));
  radio.dispatchEvent(new Event('blur', { bubbles: true }));
}

class NativeRadioAdapter implements ComponentAdapter {
  id = 'native-radio';
  priority = 10;

  canHandle(field: FieldDescriptor): boolean {
    return field.controlType === 'radio';
  }

  async readValue(field: ResolvedField): Promise<unknown> {
    const radios = getRadiosForField(field);
    const checked = radios.find(r => r.checked);
    return checked?.value ?? null;
  }

  async fill(field: ResolvedField, value: GeneratedValue, ctx: ExecutionContext): Promise<FillResult> {
    const start = performance.now();
    const radios = getRadiosForField(field);
    if (radios.length === 0) {
      return { fieldId: field.descriptor.id, status: 'field_missing', attempts: 1, durationMs: performance.now() - start, error: 'No radio buttons found' };
    }

    const targetVal = String(value.value).toLowerCase().trim();
    const targetDisplay = String(value.displayValue ?? value.value).toLowerCase().trim();

    // 1. Try to find radio matching value or label
    let chosen: HTMLInputElement | undefined;

    for (const radio of radios) {
      if (radio.disabled) continue;
      const rVal = (radio.value ?? '').toLowerCase().trim();
      const rLabel = (radio.id ? document.querySelector(`label[for="${CSS.escape(radio.id)}"]`)?.textContent?.trim() : radio.closest('label')?.textContent?.trim())?.toLowerCase() ?? '';

      // Direct match
      if (rVal === targetVal || rLabel === targetDisplay || rLabel === targetVal) {
        chosen = radio;
        break;
      }

      // Boolean / semantic matches
      if (targetVal === 'no' || targetVal === 'false' || targetVal === '0') {
        if (rVal === 'false' || rVal === 'no' || rVal === '0' || rLabel === 'no' || rLabel.startsWith('no')) {
          chosen = radio;
          break;
        }
      } else if (targetVal === 'yes' || targetVal === 'true' || targetVal === '1') {
        if (rVal === 'true' || rVal === 'yes' || rVal === '1' || rLabel === 'yes' || rLabel.startsWith('yes')) {
          chosen = radio;
          break;
        }
      }
    }

    // Fallback: If not matched, prefer "No" if compliance/question, else first non-disabled
    if (!chosen) {
      const isCompliance = /convict|offen|fraud|dishonest|bankrupt|disqualif|sanction|whether|has been|have you/i.test(field.descriptor.label ?? '');
      if (isCompliance) {
        chosen = radios.find(r => {
          const l = (r.id ? document.querySelector(`label[for="${CSS.escape(r.id)}"]`)?.textContent?.trim() : '')?.toLowerCase() ?? '';
          return !r.disabled && (r.value === 'false' || r.value === 'no' || l.includes('no'));
        });
      }
      if (!chosen) {
        chosen = radios.find(r => !r.disabled) || radios[0];
      }
    }

    if (chosen) {
      selectRadio(chosen);
      return {
        fieldId: field.descriptor.id,
        status: 'filled_verified',
        generatedValue: { ...value, value: chosen.value || 'checked', displayValue: chosen.value || 'checked' },
        adapterId: this.id,
        attempts: 1,
        durationMs: performance.now() - start,
      };
    }

    return { fieldId: field.descriptor.id, status: 'validation_failed', attempts: 1, durationMs: performance.now() - start };
  }

  async verify(field: ResolvedField, expected: GeneratedValue): Promise<VerificationResult> {
    const radios = getRadiosForField(field);
    const checked = radios.some(r => r.checked);
    return { fieldId: field.descriptor.id, passed: checked, valueRetained: checked };
  }
}

// ---- Native File Adapter ----
class NativeFileAdapter implements ComponentAdapter {
  id = 'native-file';
  priority = 10;

  canHandle(field: FieldDescriptor): boolean {
    return field.controlType === 'file';
  }

  async readValue(field: ResolvedField): Promise<unknown> {
    const el = field.element as HTMLInputElement;
    return el.files ? Array.from(el.files).map(f => f.name) : [];
  }

  async fill(field: ResolvedField, value: GeneratedValue, ctx: ExecutionContext): Promise<FillResult> {
    const start = performance.now();
    const el = field.element as HTMLInputElement;

    if (ctx.abortSignal.aborted) {
      return { fieldId: field.descriptor.id, status: 'error', attempts: 0, durationMs: 0, error: 'Cancelled' };
    }

    try {
      const files: File[] = (value.metadata as any)?.files ?? [];
      if (files.length === 0) {
        return {
          fieldId: field.descriptor.id,
          status: 'validation_failed',
          attempts: 1,
          durationMs: performance.now() - start,
          validationMessage: 'No synthetic file available',
        };
      }

      attachFiles(el, files);

      return {
        fieldId: field.descriptor.id,
        status: 'filled_verified',
        generatedValue: value,
        adapterId: this.id,
        attempts: 1,
        durationMs: performance.now() - start,
      };
    } catch (err) {
      return {
        fieldId: field.descriptor.id,
        status: 'error',
        attempts: 1,
        durationMs: performance.now() - start,
        error: String(err),
      };
    }
  }

  async verify(field: ResolvedField, expected: GeneratedValue): Promise<VerificationResult> {
    const el = field.element as HTMLInputElement;
    const hasFiles = !!(el.files && el.files.length > 0);
    return {
      fieldId: field.descriptor.id,
      passed: hasFiles,
      valueRetained: hasFiles,
    };
  }

  async clear(field: ResolvedField): Promise<void> {
    const el = field.element as HTMLInputElement;
    try {
      el.value = '';
      el.dispatchEvent(new Event('change', { bubbles: true, composed: true }));
    } catch {}
  }
}

// ---- File attachment ----
export function attachFiles(input: HTMLInputElement, files: File[]): void {
  if (input.type !== 'file') throw new Error('Not a file input');
  if (input.disabled) throw new Error('File input is disabled');
  if (!input.multiple && files.length > 1) throw new Error('Input does not support multiple files');

  const transfer = new DataTransfer();
  for (const file of files) {
    transfer.items.add(file);
  }

  try {
    input.files = transfer.files;
  } catch (err) {
    console.warn('[FillPro] Could not set input.files directly, using property definition fallback:', err);
    try {
      Object.defineProperty(input, 'files', {
        value: transfer.files,
        writable: true,
      });
    } catch {}
  }

  // Dispatch full lifecycle on input element
  try { input.focus(); } catch {}
  input.dispatchEvent(new Event('focus', { bubbles: true }));
  input.dispatchEvent(new Event('change', { bubbles: true, composed: true }));
  input.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
  input.dispatchEvent(new Event('blur', { bubbles: true, composed: true }));

  // Also dispatch drop and change on surrounding upload area/container for Angular dropzones
  const container = input.closest('app-file-upload-area, .file-upload-container, .dropzone, form-field') || input.parentElement;
  if (container) {
    try {
      const dropEvent = new DragEvent('drop', {
        bubbles: true,
        composed: true,
        cancelable: true,
        dataTransfer: transfer,
      });
      container.dispatchEvent(dropEvent);
    } catch {}
    try {
      container.dispatchEvent(new Event('change', { bubbles: true, composed: true }));
    } catch {}
  }
}

// Register all native adapters at the bottom after all class declarations
registerAdapter(new NativeInputAdapter());
registerAdapter(new NativeSelectAdapter());
registerAdapter(new NativeCheckboxAdapter());
registerAdapter(new NativeRadioAdapter());
registerAdapter(new NativeFileAdapter());

// ============================================================
// FILL PRO — Form Discovery Engine
// ============================================================

import type {
  FieldDescriptor,
  FileFieldDescriptor,
  ScanResult,
  FormSection,
} from '../../types/index.js';
import {
  computeFieldFingerprint,
  detectControlType,
  extractLabel,
  extractSection,
  extractDescription,
  extractOptions,
  extractConstraints,
  buildSelector,
  classifyField,
  isSensitiveField,
  isOTPField,
} from '../semantic/classifier.js';
import { getConfidenceBand } from '../../types/index.js';

// Elements to scan
const NATIVE_SELECTORS = [
  'input:not([type="hidden"]):not([type="submit"]):not([type="button"]):not([type="reset"]):not([type="image"])',
  'textarea',
  'select',
  '[contenteditable="true"]',
  '[role="textbox"]',
  '[role="combobox"]',
  '[role="listbox"]',
  '[role="spinbutton"]',
  '[role="switch"]',
  '[role="slider"]',
].join(', ');

// Elements to exclude
const EXCLUDE_SELECTORS = [
  '[aria-hidden="true"]',
  '[hidden]',
  '.fill-pro-injected',
];

function isExcluded(el: Element): boolean {
  if (!el.isConnected) return true;
  if (el.matches('.fill-pro-injected, .fill-pro-injected *')) return true;

  const tag = el.tagName.toLowerCase();
  const isFormCtrl = tag === 'input' || tag === 'select' || tag === 'textarea';

  // For non-form controls (custom div/role controls), check bounding rect
  if (!isFormCtrl) {
    const rect = (el as HTMLElement).getBoundingClientRect?.();
    if (rect && rect.width === 0 && rect.height === 0) return true;
    try {
      const style = window.getComputedStyle(el as HTMLElement);
      if (style.display === 'none' || style.visibility === 'hidden') return true;
    } catch {
      // ignore
    }
  }

  return false;
}

function querySelectorAllDeep(selector: string, root: Document | Element | ShadowRoot = document): Element[] {
  let results: Element[] = Array.from(root.querySelectorAll(selector));
  const allElements = root.querySelectorAll('*');
  for (const el of allElements) {
    if (el.shadowRoot) {
      results = results.concat(querySelectorAllDeep(selector, el.shadowRoot));
    }
  }
  return results;
}

function generateFieldId(el: Element, index: number): string {
  return `fp-field-${index}-${computeFieldFingerprint(el).substring(0, 8)}`;
}

function getRadioGroupInfo(el: HTMLInputElement): {
  groupKey: string;
  groupRadios: HTMLInputElement[];
  groupLabel?: string;
  options: FieldOption[];
} {
  const name = el.getAttribute('name');
  let groupRadios: HTMLInputElement[] = [];
  let groupKey = '';
  let container: Element | null = null;

  if (name) {
    groupRadios = Array.from(document.querySelectorAll<HTMLInputElement>(`input[type="radio"][name="${CSS.escape(name)}"]`));
    groupKey = `name:${name}`;
  } else {
    container = el.closest('.radio-group, [role="radiogroup"], form-field, .form-group, .form-control-container, fieldset, td, tr') || el.parentElement;
    if (container) {
      groupRadios = Array.from(container.querySelectorAll<HTMLInputElement>('input[type="radio"]'));
      const containerId = container.id || container.getAttribute('formcontrolname') || container.getAttribute('ng-reflect-name');
      const containerClass = container.className ? String(container.className).split(' ').slice(0, 2).join('.') : '';
      groupKey = `container:${containerId || containerClass || 'group'}:${groupRadios[0]?.id || el.id || 'radio'}`;
    } else {
      groupRadios = [el];
      groupKey = `single:${el.id || Math.random().toString(36)}`;
    }
  }

  // Find the question/group label
  let groupLabel: string | undefined;
  const parentContainer = container || el.closest('form-field, .form-group, subsection, tr, fieldset');
  if (parentContainer) {
    const labels = Array.from(parentContainer.querySelectorAll('label, .label, legend, .form-label, h3, h4, h5'));
    for (const l of labels) {
      const forAttr = l.getAttribute('for');
      if (forAttr && groupRadios.some(r => r.id === forAttr)) continue;
      if (l.classList.contains('form-check-label')) continue;
      const text = l.textContent?.trim();
      if (text && text.length > 1 && !/^(yes|no|true|false)$/i.test(text)) {
        groupLabel = text;
        break;
      }
    }
  }

  // Extract options from radios
  const options: FieldOption[] = [];
  for (const radio of groupRadios) {
    let optLabel = '';
    if (radio.id) {
      const l = document.querySelector<HTMLElement>(`label[for="${CSS.escape(radio.id)}"]`);
      if (l) optLabel = l.textContent?.trim() ?? '';
    }
    if (!optLabel) {
      const parentLabel = radio.closest('label');
      if (parentLabel) {
        optLabel = parentLabel.textContent?.trim() ?? '';
      } else if (radio.nextElementSibling?.tagName === 'LABEL') {
        optLabel = radio.nextElementSibling.textContent?.trim() ?? '';
      } else if (radio.parentElement) {
        optLabel = radio.parentElement.textContent?.trim() ?? '';
      }
    }
    const optVal = radio.value && radio.value !== 'on' ? radio.value : (optLabel || 'option');
    options.push({
      label: optLabel || optVal,
      value: optVal,
      selected: radio.checked,
      disabled: radio.disabled,
    });
  }

  return { groupKey, groupRadios, groupLabel, options };
}

function extractFileConstraints(el: Element): {
  acceptedExtensions: string[];
  acceptedMimeTypes: string[];
  maxFileSizeBytes?: number;
  documentSemanticType?: string;
} {
  const accept = el.getAttribute('accept') ?? '';
  const parts = accept.split(',').map(p => p.trim()).filter(Boolean);
  const extensions = parts.filter(p => p.startsWith('.')).map(p => p.toLowerCase());
  const mimeTypes = parts.filter(p => !p.startsWith('.'));

  const container = el.closest('app-file-upload-area, .file-upload-container, form-field, .form-group') || el.parentElement;
  let documentSemanticType: string | undefined;

  if (container) {
    const text = container.textContent ?? '';
    if (extensions.length === 0) {
      if (/\bpdf\b/i.test(text)) extensions.push('.pdf');
      if (/\bpng\b/i.test(text)) extensions.push('.png');
      if (/\b(jpe?g)\b/i.test(text)) extensions.push('.jpg');
      if (/\b(docx?|word)\b/i.test(text)) extensions.push('.docx');
      if (/\b(xlsx?|excel)\b/i.test(text)) extensions.push('.xlsx');
      if (/\bcsv\b/i.test(text)) extensions.push('.csv');
    }

    const heading = container.closest('form-field, subsection, section-card, .field-wrapper')?.querySelector('h1, h2, h3, h4, .resource-card h3, .form-label');
    const headingText = heading?.textContent?.trim()?.toLowerCase();
    if (headingText) {
      if (headingText.includes('structure')) documentSemanticType = 'group_structure';
      else if (headingText.includes('chart') || headingText.includes('organi')) documentSemanticType = 'organizational_chart';
      else if (headingText.includes('financial') || headingText.includes('balance') || headingText.includes('audit')) documentSemanticType = 'financial_statement';
      else if (headingText.includes('profile')) documentSemanticType = 'company_profile';
      else if (headingText.includes('cv') || headingText.includes('resume')) documentSemanticType = 'curriculum_vitae';
      else if (headingText.includes('id') || headingText.includes('passport')) documentSemanticType = 'identity_document';
    }
  }

  // Ensure at least one accepted extension
  if (extensions.length === 0) {
    extensions.push('.pdf', '.png');
  }

  // Try to infer file size from nearby text
  const parent = el.parentElement;
  let maxFileSizeBytes: number | undefined;
  if (parent) {
    const text = parent.textContent ?? '';
    const sizeMatch = text.match(/(\d+(?:\.\d+)?)\s*(mb|kb|gb)/i);
    if (sizeMatch && sizeMatch[1] && sizeMatch[2]) {
      const num = parseFloat(sizeMatch[1]);
      const unit = sizeMatch[2].toLowerCase();
      if (unit === 'mb') maxFileSizeBytes = num * 1024 * 1024;
      else if (unit === 'kb') maxFileSizeBytes = num * 1024;
      else if (unit === 'gb') maxFileSizeBytes = num * 1024 * 1024 * 1024;
    }
  }

  return { acceptedExtensions: extensions, acceptedMimeTypes: mimeTypes, maxFileSizeBytes, documentSemanticType };
}

function detectAutoUploadRisk(el: Element): 'known' | 'possible' | 'unknown' {
  const name = el.getAttribute('name') ?? '';
  const id = el.getAttribute('id') ?? '';
  const parent = el.parentElement;

  // Known auto-upload patterns (PrimeNG FileUpload, etc.)
  if (parent?.classList.toString().includes('p-fileupload')) return 'known';
  if (parent?.querySelector('[class*="auto"]')) return 'possible';
  if (/auto.upload|immediate|instant/i.test(name + id)) return 'possible';

  return 'unknown';
}

function groupIntoSections(fields: FieldDescriptor[]): FormSection[] {
  const sectionMap = new Map<string, FormSection>();

  for (const field of fields) {
    const sectionKey = field.section ?? 'default';
    if (!sectionMap.has(sectionKey)) {
      sectionMap.set(sectionKey, {
        id: `section-${sectionMap.size}`,
        label: field.section,
        fieldIds: [],
        visible: true,
      });
    }
    sectionMap.get(sectionKey)!.fieldIds.push(field.id);
  }

  return Array.from(sectionMap.values());
}

export function scanForms(): ScanResult {
  const startTime = performance.now();
  const sessionId = `scan-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
  const fields: FieldDescriptor[] = [];
  const fileFields: FileFieldDescriptor[] = [];
  const seenRadioGroups = new Set<string>();

  // Get page context
  const pageTitle = document.title;
  const formTitle = document.querySelector('h1, h2, h3')?.textContent?.trim();

  // Find all candidate elements
  const candidates = querySelectorAllDeep(NATIVE_SELECTORS);
  let index = 0;

  for (const el of candidates) {
    try {
      if (isExcluded(el)) continue;

      const controlType = detectControlType(el);
      if (controlType === 'hidden') continue;

      let radioGroupInfo: ReturnType<typeof getRadioGroupInfo> | null = null;
      if (controlType === 'radio') {
        radioGroupInfo = getRadioGroupInfo(el as HTMLInputElement);
        if (seenRadioGroups.has(radioGroupInfo.groupKey)) {
          // Already created field descriptor for this radio group
          continue;
        }
        seenRadioGroups.add(radioGroupInfo.groupKey);
      }

      let label = extractLabel(el);
      if (radioGroupInfo?.groupLabel) {
        label = radioGroupInfo.groupLabel;
      }
      const section = extractSection(el);
      const description = extractDescription(el);
      let options = extractOptions(el);
      if (radioGroupInfo && radioGroupInfo.options.length > 0) {
        options = radioGroupInfo.options;
      }
      const constraints = extractConstraints(el);
      if (radioGroupInfo) {
        const anyRequired = radioGroupInfo.groupRadios.some(r => r.required) ||
          !!el.closest('form-field, .form-control-container, .radio-group')?.querySelector('.required, [class*="required"]');
        if (anyRequired) constraints.required = true;
      }
      const selector = buildSelector(el);
      const fingerprint = computeFieldFingerprint(el);
      const htmlType = el.getAttribute('type') ?? el.tagName.toLowerCase();

      const classification = classifyField(el, label, {
        placeholder: el.getAttribute('placeholder') ?? undefined,
        ariaLabel: el.getAttribute('aria-label') ?? undefined,
        description,
        section,
        formTitle,
        fieldName: el.getAttribute('name') ?? undefined,
      });

      const sensitive = isSensitiveField(el, label, classification.semanticType);
      const isOTP = isOTPField(el, label);

      const fieldId = generateFieldId(el, index++);
      try {
        el.setAttribute('data-fp-id', fieldId);
        if (radioGroupInfo) {
          for (const r of radioGroupInfo.groupRadios) {
            r.setAttribute('data-fp-id', fieldId);
          }
        }
      } catch {
        // ignore if read-only DOM
      }

      const selectorCandidates: string[] = [`[data-fp-id="${fieldId}"]`];
      if (el.id) selectorCandidates.push(`#${CSS.escape(el.id)}`);
      const fc = el.getAttribute('formcontrolname') || el.getAttribute('ng-reflect-name');
      if (fc) selectorCandidates.push(`${el.tagName.toLowerCase()}[formcontrolname="${CSS.escape(fc)}"]`);
      if (el.getAttribute('name')) selectorCandidates.push(`${el.tagName.toLowerCase()}[name="${CSS.escape(el.getAttribute('name')!)}"]`);
      const tid = el.getAttribute('data-testid') || el.getAttribute('data-test');
      if (tid) selectorCandidates.push(`${el.tagName.toLowerCase()}[data-testid="${CSS.escape(tid)}"]`);
      if (el.getAttribute('placeholder')) selectorCandidates.push(`${el.tagName.toLowerCase()}[placeholder="${CSS.escape(el.getAttribute('placeholder')!)}"]`);
      if (el.getAttribute('aria-label')) selectorCandidates.push(`${el.tagName.toLowerCase()}[aria-label="${CSS.escape(el.getAttribute('aria-label')!)}"]`);
      if (!selectorCandidates.includes(selector)) selectorCandidates.push(selector);

      if (controlType === 'file') {
        const { acceptedExtensions, acceptedMimeTypes, maxFileSizeBytes, documentSemanticType } =
          extractFileConstraints(el);

        const fileField: FileFieldDescriptor = {
          id: fieldId,
          fingerprint,
          selector,
          selectorCandidates,
          label,
          placeholder: el.getAttribute('placeholder') ?? undefined,
          description,
          ariaLabel: el.getAttribute('aria-label') ?? undefined,
          fieldName: el.getAttribute('name') ?? undefined,
          htmlType,
          controlType,
          semanticType: classification.semanticType,
          semanticCategory: classification.semanticCategory,
          section,
          formContext: formTitle,
          pageTitle,
          required: constraints.required,
          disabled: (el as HTMLInputElement).disabled ?? false,
          readonly: (el as HTMLInputElement).readOnly ?? false,
          visible: true,
          hasExistingValue: false,
          constraints,
          options: options.length > 0 ? options : undefined,
          dependencies: [],
          confidence: classification.confidence,
          confidenceBand: getConfidenceBand(classification.confidence),
          evidence: classification.evidence,
          classificationSource: 'heuristic',
          isSensitive: sensitive,
          acceptedExtensions,
          acceptedMimeTypes,
          multiple: el.hasAttribute('multiple'),
          maxFileSizeBytes,
          documentSemanticType,
          relatedDataFields: [],
          generationStrategy: 'generic',
          autoUploadRisk: detectAutoUploadRisk(el),
        };
        fileFields.push(fileField);
        fields.push(fileField);
      } else {
        const rawVal = (el as HTMLInputElement).value;
        const hasExistingValue = typeof rawVal === 'string' && rawVal.trim().length > 0;

        const field: FieldDescriptor = {
          id: fieldId,
          fingerprint,
          selector,
          selectorCandidates,
          label,
          placeholder: el.getAttribute('placeholder') ?? undefined,
          description,
          ariaLabel: el.getAttribute('aria-label') ?? undefined,
          fieldName: el.getAttribute('name') ?? undefined,
          htmlType,
          controlType,
          semanticType: classification.semanticType,
          semanticCategory: classification.semanticCategory,
          section,
          formContext: formTitle,
          pageTitle,
          formTitle,
          required: constraints.required,
          disabled: (el as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement).disabled ?? false,
          readonly: (el as HTMLInputElement | HTMLTextAreaElement).readOnly ?? false,
          visible: true,
          hasExistingValue,
          constraints: { ...constraints, options: options.length > 0 ? options : undefined },
          options: options.length > 0 ? options : undefined,
          dependencies: [],
          confidence: classification.confidence,
          confidenceBand: getConfidenceBand(classification.confidence),
          evidence: classification.evidence,
          classificationSource: 'heuristic',
          isSensitive: sensitive || isOTP,
          skipReason: isOTP ? 'OTP field — skipped for security' : undefined,
        };
        fields.push(field);
      }
    } catch (err) {
      console.warn('[FillPro] Error processing candidate element:', err);
    }
  }

  const formSections = groupIntoSections(fields);
  const scanDurationMs = performance.now() - startTime;

  return {
    sessionId,
    url: window.location.href,
    origin: window.location.origin,
    timestamp: Date.now(),
    fields,
    fileFields,
    totalFields: fields.length,
    fillableFields: fields.filter(f => !f.isSensitive && !f.disabled && !f.readonly).length,
    sensitiveFields: fields.filter(f => f.isSensitive).length,
    ambiguousFields: fields.filter(f => f.confidenceBand === 'low' && !f.isSensitive).length,
    requiredFields: fields.filter(f => f.required).length,
    uploadFields: fileFields.length,
    formSections,
    pageTitle,
    formTitle,
    scanDurationMs,
  };
}

// ============================================================
// FILL PRO — Semantic Field Intelligence Engine
// ============================================================
// Multi-signal field classification with confidence scoring

import type {
  FieldDescriptor,
  ClassificationEvidence,
  ControlType,
  SemanticCategory,
  ConfidenceBand,
  FieldOption,
  FieldConstraints,
} from '../../types/index.js';
import { KEYWORD_MAPPINGS, isSensitiveSemanticType } from '../../constants/semanticTypes.js';
import { getConfidenceBand } from '../../types/index.js';

// ---- Fingerprinting ----
export function computeFieldFingerprint(el: Element): string {
  const parts = [
    el.tagName,
    el.getAttribute('type') ?? '',
    el.getAttribute('name') ?? '',
    el.getAttribute('id') ?? '',
    el.getAttribute('placeholder') ?? '',
  ];
  return btoa(parts.join('|')).replace(/[^a-zA-Z0-9]/g, '').substring(0, 32);
}

export function computeFormFingerprint(fields: FieldDescriptor[]): string {
  const sig = fields.map(f => f.fingerprint).sort().join(',');
  return btoa(sig).replace(/[^a-zA-Z0-9]/g, '').substring(0, 32);
}

function isGenericUploadLabel(text: string): boolean {
  const t = text.toLowerCase().trim();
  return /^(upload|upload\s*document|upload\s*file|\+\s*upload.*|choose\s*file|browse|\(png.*\))$/i.test(t);
}

// ---- Label extraction ----
export function extractLabel(el: Element): string | undefined {
  let candidateLabel: string | undefined;

  const id = el.getAttribute('id');
  if (id) {
    const label = document.querySelector(`label[for="${CSS.escape(id)}"]`);
    if (label) candidateLabel = label.textContent?.trim();
  }
  if (!candidateLabel) {
    const parent = el.closest('label');
    if (parent) {
      const clone = parent.cloneNode(true) as Element;
      clone.querySelectorAll('input, select, textarea').forEach(c => c.remove());
      candidateLabel = clone.textContent?.trim();
    }
  }
  if (!candidateLabel) {
    const ariaLabel = el.getAttribute('aria-label');
    if (ariaLabel) candidateLabel = ariaLabel.trim();
  }
  if (!candidateLabel) {
    const ariaLabelledBy = el.getAttribute('aria-labelledby');
    if (ariaLabelledBy) {
      const labelEl = document.getElementById(ariaLabelledBy);
      if (labelEl) candidateLabel = labelEl.textContent?.trim();
    }
  }

  // Look for sibling/parent label text
  if (!candidateLabel) {
    const parentContainer = el.parentElement;
    if (parentContainer) {
      const textNodes = Array.from(parentContainer.childNodes)
        .filter(n => n.nodeType === Node.TEXT_NODE)
        .map(n => n.textContent?.trim())
        .filter(Boolean);
      if (textNodes.length > 0) candidateLabel = textNodes[0];

      if (!candidateLabel) {
        const spans = parentContainer.querySelectorAll('label, span, p, small');
        for (const span of spans) {
          const text = span.textContent?.trim();
          if (text && text.length > 0 && text.length < 100) {
            candidateLabel = text;
            break;
          }
        }
      }
    }
  }

  // For file inputs with generic labels like "+ Upload Document (PNG, JPG, PDF)", find the descriptive heading
  if (el.getAttribute('type') === 'file' || !candidateLabel || isGenericUploadLabel(candidateLabel)) {
    const container = el.closest('app-file-upload-area, form-field, .form-group, subsection, section-card, .resource-card') || el.parentElement;
    if (container) {
      const heading = container.closest('form-field, subsection, section-card, .field-wrapper')?.querySelector('h1, h2, h3, h4, .resource-card h3, .form-label');
      const headingText = heading?.textContent?.trim();
      if (headingText && headingText.length > 2 && !isGenericUploadLabel(headingText)) {
        return headingText;
      }
    }
  }

  return candidateLabel;
}

export function extractSection(el: Element): string | undefined {
  const fieldset = el.closest('fieldset');
  if (fieldset) {
    const legend = fieldset.querySelector('legend');
    if (legend) return legend.textContent?.trim();
  }
  // Walk up looking for section headings
  let parent = el.parentElement;
  let depth = 0;
  while (parent && depth < 10) {
    const heading = parent.querySelector('h1, h2, h3, h4, h5, h6');
    if (heading) return heading.textContent?.trim();
    const sectionLabel = parent.getAttribute('aria-label') || parent.getAttribute('data-section');
    if (sectionLabel) return sectionLabel;
    parent = parent.parentElement;
    depth++;
  }
  return undefined;
}

export function extractDescription(el: Element): string | undefined {
  const describedBy = el.getAttribute('aria-describedby');
  if (describedBy) {
    const descEl = document.getElementById(describedBy);
    if (descEl) return descEl.textContent?.trim();
  }
  // Look for sibling helper text
  const parent = el.parentElement;
  if (parent) {
    const helperCandidates = parent.querySelectorAll('small, .hint, .helper, .help-text, .field-hint, [class*="helper"], [class*="hint"]');
    for (const c of helperCandidates) {
      const text = c.textContent?.trim();
      if (text) return text;
    }
  }
  return undefined;
}

export function extractOptions(el: Element): FieldOption[] {
  if (el.tagName === 'SELECT') {
    const selectEl = el as HTMLSelectElement;
    return Array.from(selectEl.options).map(opt => ({
      value: opt.value,
      label: opt.text.trim(),
      disabled: opt.disabled,
      selected: opt.selected,
    }));
  }
  return [];
}

export function extractConstraints(el: Element): FieldConstraints {
  return {
    required: el.hasAttribute('required') || el.getAttribute('aria-required') === 'true',
    minLength: el.getAttribute('minlength') ? parseInt(el.getAttribute('minlength')!) : undefined,
    maxLength: el.getAttribute('maxlength') ? parseInt(el.getAttribute('maxlength')!) : undefined,
    min: el.getAttribute('min') ?? undefined,
    max: el.getAttribute('max') ?? undefined,
    step: el.getAttribute('step') ? parseFloat(el.getAttribute('step')!) : undefined,
    pattern: el.getAttribute('pattern') ?? undefined,
    accept: el.getAttribute('accept') ?? undefined,
    multiple: el.hasAttribute('multiple'),
  };
}

export function buildSelector(el: Element): string {
  if (el.id) return `#${CSS.escape(el.id)}`;
  
  const formControlName = el.getAttribute('formcontrolname') || el.getAttribute('ng-reflect-name');
  if (formControlName) {
    return `${el.tagName.toLowerCase()}[formcontrolname="${CSS.escape(formControlName)}"]`;
  }
  
  if (el.getAttribute('name')) {
    return `${el.tagName.toLowerCase()}[name="${CSS.escape(el.getAttribute('name')!)}"]`;
  }

  const testId = el.getAttribute('data-testid') || el.getAttribute('data-test');
  if (testId) {
    return `${el.tagName.toLowerCase()}[data-testid="${CSS.escape(testId)}"]`;
  }

  // Build a unique structural path
  const parts: string[] = [];
  let current: Element | null = el;
  while (current && current !== document.documentElement && parts.length < 8) {
    let selector = current.tagName.toLowerCase();
    if (current.id) {
      selector = `#${CSS.escape(current.id)}`;
      parts.unshift(selector);
      break;
    }
    const fc = current.getAttribute('formcontrolname');
    if (fc) {
      selector += `[formcontrolname="${CSS.escape(fc)}"]`;
      parts.unshift(selector);
      break;
    }
    if (current.parentElement) {
      const siblings = Array.from(current.parentElement.children).filter(c => c.tagName === current!.tagName);
      if (siblings.length > 1) {
        const idx = siblings.indexOf(current) + 1;
        selector += `:nth-of-type(${idx})`;
      }
    }
    parts.unshift(selector);
    current = current.parentElement;
  }
  return parts.join(' > ');
}

// ---- Control Type Detection ----
export function detectControlType(el: Element): ControlType {
  const tag = el.tagName.toLowerCase();
  if (tag === 'textarea') return 'textarea';
  if (tag === 'select') {
    return el.hasAttribute('multiple') ? 'multi-select' : 'select';
  }
  if (el.getAttribute('contenteditable') === 'true') return 'contenteditable';
  if (tag === 'input') {
    const type = (el.getAttribute('type') ?? 'text').toLowerCase();
    switch (type) {
      case 'email': return 'email';
      case 'password': return 'password';
      case 'number': return 'number';
      case 'tel': return 'tel';
      case 'url': return 'url';
      case 'search': return 'search';
      case 'date': return 'date';
      case 'datetime-local': return 'datetime-local';
      case 'time': return 'time';
      case 'month': return 'month';
      case 'week': return 'week';
      case 'range': return 'range';
      case 'color': return 'color';
      case 'checkbox': return 'checkbox';
      case 'radio': return 'radio';
      case 'file': return 'file';
      case 'hidden': return 'hidden';
      default: return 'text';
    }
  }
  // Check ARIA roles
  const role = el.getAttribute('role');
  if (role === 'combobox' || role === 'listbox') return 'autocomplete';
  if (role === 'switch') return 'toggle';
  if (role === 'textbox') return 'text';
  return 'custom';
}

// ---- Semantic Classification ----
function normalizeText(text: string): string {
  return text.toLowerCase()
    .replace(/[_\-.*:()[\]{}\/\\]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function scoreKeywordMatch(haystack: string, keyword: string): number {
  const normalized = normalizeText(haystack);
  const kw = normalizeText(keyword);
  if (normalized === kw) return 1.0;
  if (normalized.includes(kw)) return 0.8;
  // Word boundary match
  const words = normalized.split(' ');
  if (words.some(w => w === kw || w.startsWith(kw))) return 0.6;
  return 0;
}

export interface ClassificationResult {
  semanticType: string;
  semanticCategory: SemanticCategory;
  confidence: number;
  confidenceBand: ConfidenceBand;
  evidence: ClassificationEvidence[];
}

export function classifyField(el: Element, label?: string, options?: {
  placeholder?: string;
  ariaLabel?: string;
  description?: string;
  section?: string;
  formTitle?: string;
  fieldName?: string;
}): ClassificationResult {
  const evidence: ClassificationEvidence[] = [];
  const scores: Map<string, number> = new Map();

  const signals: Array<{ value: string; source: string; signalWeight: number }> = [];

  if (label) signals.push({ value: label, source: 'label', signalWeight: 1.0 });
  if (options?.ariaLabel) signals.push({ value: options.ariaLabel, source: 'aria-label', signalWeight: 1.0 });
  if (options?.placeholder) signals.push({ value: options.placeholder, source: 'placeholder', signalWeight: 0.7 });
  if (options?.description) signals.push({ value: options.description, source: 'description', signalWeight: 0.5 });
  if (options?.section) signals.push({ value: options.section, source: 'section', signalWeight: 0.3 });
  if (options?.formTitle) signals.push({ value: options.formTitle, source: 'formTitle', signalWeight: 0.2 });

  const id = el.getAttribute('id') ?? '';
  const name = el.getAttribute('name') ?? '';
  const formControlName = (el.getAttribute('formcontrolname') || el.getAttribute('ng-reflect-name')) ?? '';
  const testId = (el.getAttribute('data-testid') || el.getAttribute('data-test')) ?? '';

  if (id) signals.push({ value: id.replace(/[_-]/g, ' '), source: 'element-id', signalWeight: 0.6 });
  if (name) signals.push({ value: name.replace(/[_-]/g, ' '), source: 'element-name', signalWeight: 0.6 });
  if (formControlName) {
    // Convert camelCase to separated words: applicantName -> applicant name
    const spaced = formControlName.replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/[_-]/g, ' ').toLowerCase();
    signals.push({ value: spaced, source: 'formcontrolname', signalWeight: 0.95 });
  }
  if (testId) signals.push({ value: testId.replace(/[_-]/g, ' '), source: 'test-id', signalWeight: 0.8 });
  if (options?.fieldName) signals.push({ value: options.fieldName.replace(/[_-]/g, ' '), source: 'field-name', signalWeight: 0.6 });

  const htmlType = el.getAttribute('type') ?? el.tagName.toLowerCase();

  // Native type hints
  if (htmlType === 'email') {
    scores.set('contact.email', (scores.get('contact.email') ?? 0) + 0.8);
    evidence.push({ signal: 'html-type', value: 'email', weight: 0.8, source: 'native' });
  }
  if (htmlType === 'tel') {
    scores.set('contact.phone', (scores.get('contact.phone') ?? 0) + 0.7);
    evidence.push({ signal: 'html-type', value: 'tel', weight: 0.7, source: 'native' });
  }
  if (htmlType === 'url') {
    scores.set('contact.website', (scores.get('contact.website') ?? 0) + 0.7);
    evidence.push({ signal: 'html-type', value: 'url', weight: 0.7, source: 'native' });
  }
  if (htmlType === 'password') {
    scores.set('security.password', (scores.get('security.password') ?? 0) + 1.0);
    evidence.push({ signal: 'html-type', value: 'password', weight: 1.0, source: 'native' });
  }
  if (htmlType === 'date') {
    scores.set('generic.date', (scores.get('generic.date') ?? 0) + 0.5);
    evidence.push({ signal: 'html-type', value: 'date', weight: 0.5, source: 'native' });
  }

  // Autocomplete attribute
  const autocomplete = el.getAttribute('autocomplete') ?? '';
  const autocompleteMapping: Record<string, string> = {
    'given-name': 'personal.first_name',
    'additional-name': 'personal.middle_name',
    'family-name': 'personal.last_name',
    'name': 'personal.full_name',
    'bday': 'personal.date_of_birth',
    'sex': 'personal.gender',
    'nationality': 'personal.nationality',
    'organization': 'business.company_name',
    'organization-title': 'business.designation',
    'street-address': 'contact.street',
    'address-line1': 'contact.street',
    'address-level1': 'contact.state',
    'address-level2': 'contact.city',
    'postal-code': 'contact.postal_code',
    'country': 'contact.country',
    'country-name': 'contact.country',
    'email': 'contact.email',
    'tel': 'contact.phone',
    'tel-national': 'contact.phone',
    'url': 'contact.website',
    'username': 'technical.username',
    'current-password': 'security.password',
    'new-password': 'security.password',
    'one-time-code': 'security.otp',
    'cc-number': 'security.payment_card',
    'cc-csc': 'security.cvv',
  };
  if (autocomplete && autocompleteMapping[autocomplete]) {
    const st = autocompleteMapping[autocomplete]!;
    scores.set(st, (scores.get(st) ?? 0) + 0.9);
    evidence.push({ signal: 'autocomplete', value: autocomplete, weight: 0.9, source: 'native' });
  }

  // Keyword matching across signals
  for (const signal of signals) {
    for (const mapping of KEYWORD_MAPPINGS) {
      for (const keyword of mapping.keywords) {
        const score = scoreKeywordMatch(signal.value, keyword);
        if (score > 0) {
          const weighted = score * mapping.weight * signal.signalWeight;
          scores.set(mapping.semanticType, (scores.get(mapping.semanticType) ?? 0) + weighted);
          if (weighted > 0.4) {
            evidence.push({
              signal: signal.source,
              value: `"${keyword}" in "${signal.value}"`,
              weight: weighted,
              source: 'heuristic',
            });
          }
        }
      }
    }
  }

  // Find best match
  let bestType = 'unknown.unknown';
  let bestScore = 0;
  for (const [type, score] of scores) {
    if (score > bestScore) {
      bestScore = score;
      bestType = type;
    }
  }

  // Cap score
  const normalizedScore = Math.min(bestScore / 1.5, 1.0);
  const confidenceBand = getConfidenceBand(normalizedScore);
  const category = (bestType.split('.')[0] ?? 'unknown') as SemanticCategory;

  return {
    semanticType: bestType,
    semanticCategory: category,
    confidence: normalizedScore,
    confidenceBand,
    evidence: evidence.slice(0, 10), // Keep top 10 evidence items
  };
}

// ---- Sensitivity Detection ----
const SENSITIVE_PATTERNS = [
  /password/i, /passwd/i, /\bpwd\b/i,
  /\botp\b/i, /one.time/i, /verification.code/i,
  /cvv/i, /cvc/i, /security.code/i,
  /card.number/i, /credit.card/i, /debit.card/i,
  /\bpin\b/i, /auth.token/i, /secret/i,
  /ssn/i, /social.security/i,
];

export function isSensitiveField(el: Element, label?: string, semanticType?: string): boolean {
  if (semanticType && isSensitiveSemanticType(semanticType)) return true;
  if (el.getAttribute('type') === 'password') return true;

  const textToCheck = [
    label ?? '',
    el.getAttribute('id') ?? '',
    el.getAttribute('name') ?? '',
    el.getAttribute('placeholder') ?? '',
    el.getAttribute('aria-label') ?? '',
  ].join(' ');

  return SENSITIVE_PATTERNS.some(p => p.test(textToCheck));
}

export function isOTPField(el: Element, label?: string): boolean {
  const text = [label ?? '', el.getAttribute('id') ?? '', el.getAttribute('name') ?? '', el.getAttribute('autocomplete') ?? ''].join(' ');
  return /\botp\b|one.time|verification.code|confirm.code|sms.code/i.test(text)
    || el.getAttribute('autocomplete') === 'one-time-code'
    || el.getAttribute('inputmode') === 'numeric' && (el.getAttribute('maxlength') === '1' || el.getAttribute('maxlength') === '6');
}

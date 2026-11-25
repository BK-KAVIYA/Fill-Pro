import { describe, it, expect, vi } from 'vitest';
import { AIIntelligenceRouter, inferFormContextLocally } from '../../src/ai/intelligenceRouter.js';
import type { ScanResult } from '../../src/types/index.js';

vi.mock('../../src/database/knowledgeBase.js', () => ({
  lookupFieldKnowledge: vi.fn().mockResolvedValue(null),
  computeFormStructureSignature: vi.fn().mockReturnValue('sig-123'),
}));

function makeMockScanResult(): ScanResult {
  return {
    sessionId: 'test-session',
    url: 'http://localhost:8080/company-registration',
    origin: 'http://localhost:8080',
    timestamp: Date.now(),
    pageTitle: 'Company Registration Portal',
    formTitle: 'New Company Incorporation',
    scanDurationMs: 12,
    totalFields: 4,
    fillableFields: 3,
    sensitiveFields: 1,
    ambiguousFields: 1,
    requiredFields: 2,
    uploadFields: 0,
    formSections: [],
    fileFields: [],
    fields: [
      {
        id: 'f1',
        fingerprint: 'fp1',
        selector: '#email',
        selectorCandidates: ['#email'],
        label: 'Email',
        htmlType: 'email',
        controlType: 'email',
        semanticType: 'contact.email',
        semanticCategory: 'contact',
        required: true,
        disabled: false,
        readonly: false,
        visible: true,
        hasExistingValue: false,
        constraints: { required: true },
        dependencies: [],
        confidence: 0.9,
        confidenceBand: 'high',
        evidence: [{ signal: 'html-type', value: 'email', weight: 0.8, source: 'native' }],
        classificationSource: 'native',
        isSensitive: false,
      },
      {
        id: 'f2',
        fingerprint: 'fp2',
        selector: '#companyName',
        selectorCandidates: ['#companyName'],
        label: 'Company Name',
        htmlType: 'text',
        controlType: 'text',
        semanticType: 'business.company_name',
        semanticCategory: 'business',
        required: true,
        disabled: false,
        readonly: false,
        visible: true,
        hasExistingValue: false,
        constraints: { required: true },
        dependencies: [],
        confidence: 0.85,
        confidenceBand: 'high',
        evidence: [{ signal: 'label', value: 'company name', weight: 0.85, source: 'heuristic' }],
        classificationSource: 'heuristic',
        isSensitive: false,
      },
      {
        id: 'f3',
        fingerprint: 'fp3',
        selector: '#customCode',
        selectorCandidates: ['#customCode'],
        label: 'Entity Code X',
        htmlType: 'text',
        controlType: 'text',
        semanticType: 'unknown.unknown',
        semanticCategory: 'unknown',
        required: false,
        disabled: false,
        readonly: false,
        visible: true,
        hasExistingValue: false,
        constraints: { required: false },
        dependencies: [],
        confidence: 0.2,
        confidenceBand: 'low',
        evidence: [],
        classificationSource: 'heuristic',
        isSensitive: false,
      },
      {
        id: 'f4',
        fingerprint: 'fp4',
        selector: '#password',
        selectorCandidates: ['#password'],
        label: 'Password',
        htmlType: 'password',
        controlType: 'password',
        semanticType: 'security.password',
        semanticCategory: 'security',
        required: true,
        disabled: false,
        readonly: false,
        visible: true,
        hasExistingValue: false,
        constraints: { required: true },
        dependencies: [],
        confidence: 1.0,
        confidenceBand: 'high',
        evidence: [{ signal: 'html-type', value: 'password', weight: 1.0, source: 'native' }],
        classificationSource: 'native',
        isSensitive: true,
      },
    ],
  };
}

describe('AIIntelligenceRouter', () => {
  it('infers corporate registration form context locally', () => {
    const scan = makeMockScanResult();
    const ctx = inferFormContextLocally(scan);
    expect(ctx.businessDomain).toBe('CORPORATE_REGISTRATION');
    expect(ctx.formPurpose).toContain('Company Registration');
  });

  it('resolves native and heuristic fields locally and marks unknown fields as unresolved when AI is off', async () => {
    const router = new AIIntelligenceRouter();
    const scan = makeMockScanResult();
    const result = await router.resolveFields(scan, { useAI: false });

    expect(result.aiUsed).toBe(false);
    expect(result.stats.total).toBe(4);
    expect(result.stats.native).toBe(2); // email + sensitive password
    expect(result.stats.heuristic).toBe(1); // companyName
    expect(result.stats.unresolved).toBe(1); // customCode
    expect(result.fields.find(f => f.id === 'f3')?.resolutionSource).toBe('unresolved');
  });
});

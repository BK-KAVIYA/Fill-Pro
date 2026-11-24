import { describe, it, expect } from 'vitest';
import {
  generatePerson,
  generateCompany,
  generateFinancialProfile,
  buildTestDataContext,
  generateValueForField,
  generateValueForRadioField,
} from '../../src/engines/generation/localGenerator.js';
import type { FieldDescriptor } from '../../src/types/index.js';

describe('Local Data Generation Engine', () => {
  it('generates consistent synthetic person with valid age and matching full name', () => {
    const person = generatePerson('en-LK');
    expect(person.fullName).toContain(person.firstName);
    expect(person.fullName).toContain(person.lastName);
    expect(person.age).toBeGreaterThanOrEqual(18);
    expect(person.email).toContain('@example.com');
  });

  it('generates localized Sri Lankan company with valid PV registration and LKR currency', () => {
    const company = generateCompany('en-LK');
    expect(company.registrationNumber).toMatch(/^PV\d{5}$/);
    expect(company.name).toBeTruthy();
    expect(company.employeeCount).toBeGreaterThan(0);
  });

  it('maintains deterministic financial relationship: Total Assets = Total Liabilities + Equity', () => {
    const fin = generateFinancialProfile('en-LK', { revenue: 25000000 });
    expect(fin.totalAssets).toBe(fin.totalLiabilities + fin.shareholdersEquity);
    expect(fin.profitBeforeTax).toBe(fin.income - fin.expenses);
    expect(fin.profitAfterTax).toBe(fin.profitBeforeTax - fin.taxAmount);
  });

  it('generates coherent field values bound to the shared TestDataContext', () => {
    const ctx = buildTestDataContext('en-LK', { seed: 12345 });
    
    const field: FieldDescriptor = {
      id: 'f1',
      fingerprint: 'fp1',
      selector: '#comp_name',
      selectorCandidates: ['#comp_name'],
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
      confidence: 0.95,
      confidenceBand: 'high',
      evidence: [],
      classificationSource: 'heuristic',
      isSensitive: false,
    };

    const val = generateValueForField(field, ctx);
    expect(val.value).toBe(ctx.company?.name);
  });

  it('selects "No" for statutory compliance and disqualification questions', () => {
    const ctx = buildTestDataContext('en-LK');
    const radioField: FieldDescriptor = {
      id: 'statutory-1',
      fingerprint: 'fp-stat',
      selector: '#stat_fraud',
      selectorCandidates: ['#stat_fraud'],
      label: 'Has been convicted of any offence involving fraud or dishonesty',
      htmlType: 'radio',
      controlType: 'radio',
      semanticType: 'unknown.unknown',
      semanticCategory: 'unknown',
      required: true,
      disabled: false,
      readonly: false,
      visible: true,
      hasExistingValue: false,
      constraints: { required: true },
      options: [
        { label: 'Yes', value: 'true' },
        { label: 'No', value: 'false' },
      ],
      dependencies: [],
      confidence: 0.8,
      confidenceBand: 'high',
      evidence: [],
      classificationSource: 'heuristic',
      isSensitive: false,
    };

    const val = generateValueForRadioField(radioField, ctx);
    expect(val).not.toBeNull();
    expect(val?.value).toBe('false');
  });

  it('selects "Yes" for consent and agreement declaration questions', () => {
    const ctx = buildTestDataContext('en-LK');
    const radioField: FieldDescriptor = {
      id: 'agree-1',
      fingerprint: 'fp-agree',
      selector: '#agree_terms',
      selectorCandidates: ['#agree_terms'],
      label: 'I declare that the statements made above are true and correct',
      htmlType: 'radio',
      controlType: 'radio',
      semanticType: 'unknown.unknown',
      semanticCategory: 'unknown',
      required: true,
      disabled: false,
      readonly: false,
      visible: true,
      hasExistingValue: false,
      constraints: { required: true },
      options: [
        { label: 'Yes', value: 'true' },
        { label: 'No', value: 'false' },
      ],
      dependencies: [],
      confidence: 0.8,
      confidenceBand: 'high',
      evidence: [],
      classificationSource: 'heuristic',
      isSensitive: false,
    };

    const val = generateValueForRadioField(radioField, ctx);
    expect(val).not.toBeNull();
    expect(val?.value).toBe('true');
  });
});

import { describe, it, expect } from 'vitest';
import {
  classifyField,
  isSensitiveField,
  isOTPField,
} from '../../src/engines/semantic/classifier.js';

describe('Semantic Field Intelligence Classifier', () => {
  it('identifies standard first name from label with high confidence', () => {
    const input = document.createElement('input');
    input.setAttribute('type', 'text');
    input.setAttribute('name', 'fname');

    const result = classifyField(input, 'First Name');
    expect(result.semanticType).toBe('personal.first_name');
    expect(result.semanticCategory).toBe('personal');
    expect(result.confidence).toBeGreaterThanOrEqual(0.6);
  });

  it('identifies ambiguous input with id txt_001 when nearby label specifies Registration Number', () => {
    const input = document.createElement('input');
    input.setAttribute('type', 'text');
    input.setAttribute('id', 'txt_001');

    const result = classifyField(input, 'Business Registration Number');
    expect(result.semanticType).toBe('business.registration_number');
    expect(result.semanticCategory).toBe('business');
    expect(result.confidence).toBeGreaterThan(0.7);
  });

  it('classifies email from input type and autocomplete attribute', () => {
    const input = document.createElement('input');
    input.setAttribute('type', 'email');
    input.setAttribute('autocomplete', 'email');

    const result = classifyField(input, 'Work Email');
    expect(result.semanticType).toBe('contact.email');
    expect(result.confidenceBand).toBe('high');
  });

  it('detects sensitive password fields and enforces security skipping', () => {
    const pwdInput = document.createElement('input');
    pwdInput.setAttribute('type', 'password');
    pwdInput.setAttribute('name', 'user_password');

    expect(isSensitiveField(pwdInput, 'Password')).toBe(true);
  });

  it('identifies and skips OTP / 2FA code inputs', () => {
    const otpInput = document.createElement('input');
    otpInput.setAttribute('type', 'text');
    otpInput.setAttribute('name', 'otpCode');
    otpInput.setAttribute('autocomplete', 'one-time-code');

    expect(isOTPField(otpInput, 'Enter verification code')).toBe(true);
  });

  it('correctly categorizes balance sheet and financial turnover fields', () => {
    const assetInput = document.createElement('input');
    assetInput.setAttribute('type', 'number');
    assetInput.setAttribute('name', 'assets');

    const result = classifyField(assetInput, 'Total Balance Sheet Assets');
    expect(result.semanticType).toBe('financial.total_assets');
    expect(result.semanticCategory).toBe('financial');
  });
});

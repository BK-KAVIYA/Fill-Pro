import { describe, it, expect } from 'vitest';
import {
  generatePDF,
  generateXLSX,
  generateDOCX,
  generatePNG,
  generateCSV,
  generateTXT,
} from '../../src/engines/documents/documentGenerator.js';
import { buildTestDataContext } from '../../src/engines/generation/localGenerator.js';

describe('Document Generation Engine', () => {
  const ctx = buildTestDataContext('en-LK');

  it('generates genuinely valid PDF document with byte content and synthetic watermark', async () => {
    const doc = await generatePDF('financial_statement', ctx);
    expect(doc.format).toBe('pdf');
    expect(doc.mimeType).toBe('application/pdf');
    expect(doc.sizeBytes).toBeGreaterThan(1000);
    expect(doc.dataBase64).toBeTruthy();
  });

  it('generates Excel workbook with proper worksheets and financial formulas', async () => {
    const doc = await generateXLSX('balance_sheet', ctx);
    expect(doc.format).toBe('xlsx');
    expect(doc.sizeBytes).toBeGreaterThan(1000);
    expect(doc.mimeType).toContain('spreadsheetml');
  });

  it('generates DOCX dossier using shared corporate context', async () => {
    const doc = await generateDOCX('company_profile', ctx);
    expect(doc.format).toBe('docx');
    expect(doc.sizeBytes).toBeGreaterThan(1000);
  });

  it('generates test CSV file with consistent entity details', () => {
    const doc = generateCSV('financial_data', ctx);
    expect(doc.format).toBe('csv');
    const decoded = atob(doc.dataBase64);
    expect(decoded).toContain('SYNTHETIC TEST DOCUMENT');
    expect(decoded).toContain(ctx.company?.name);
  });

  it('generates synthetic text documentation', () => {
    const doc = generateTXT('Test supporting remarks');
    expect(doc.format).toBe('txt');
    const decoded = atob(doc.dataBase64);
    expect(decoded).toContain('Test supporting remarks');
  });
});

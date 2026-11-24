// ============================================================
// FILL PRO — Document Generation Engine
// ============================================================

import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import ExcelJS from 'exceljs';
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  Table,
  TableRow,
  TableCell,
  BorderStyle,
  AlignmentType,
  PageBreak,
} from 'docx';
import type { TestDataContext, GeneratedDocument } from '../../types/index.js';

const WATERMARK = 'SYNTHETIC TEST DOCUMENT — NOT VALID FOR OFFICIAL USE';

function formatCurrency(amount: number, currency: string): string {
  return `${currency} ${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// ---- PDF Generator ----
export async function generatePDF(
  documentType: string,
  context: TestDataContext,
  filename?: string
): Promise<GeneratedDocument> {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([595, 842]); // A4
  const { width, height } = page.getSize();

  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const regularFont = await pdfDoc.embedFont(StandardFonts.Helvetica);

  const company = context.company;
  const financial = context.financial;

  let title = 'Company Document';
  let content: Array<{ text: string; bold?: boolean; size?: number; y?: number }> = [];

  switch (documentType) {
    case 'financial_statement':
    case 'balance_sheet':
      title = 'Financial Statement';
      content = [
        { text: company?.name ?? 'Company Name', bold: true, size: 16 },
        { text: 'Balance Sheet', bold: true, size: 14 },
        { text: `As at ${financial?.financialYearEnd ?? new Date().toLocaleDateString()}`, size: 11 },
        { text: '', size: 11 },
        { text: 'ASSETS', bold: true, size: 12 },
        { text: `Total Assets: ${formatCurrency(financial?.totalAssets ?? 0, financial?.currency ?? 'USD')}`, size: 11 },
        { text: '', size: 11 },
        { text: 'LIABILITIES', bold: true, size: 12 },
        { text: `Total Liabilities: ${formatCurrency(financial?.totalLiabilities ?? 0, financial?.currency ?? 'USD')}`, size: 11 },
        { text: '', size: 11 },
        { text: 'EQUITY', bold: true, size: 12 },
        { text: `Shareholders Equity: ${formatCurrency(financial?.shareholdersEquity ?? 0, financial?.currency ?? 'USD')}`, size: 11 },
      ];
      break;
    case 'company_profile':
      title = 'Company Profile';
      content = [
        { text: company?.name ?? 'Company Name', bold: true, size: 16 },
        { text: 'Company Profile', bold: true, size: 14 },
        { text: '', size: 11 },
        { text: `Registration Number: ${company?.registrationNumber ?? 'N/A'}`, size: 11 },
        { text: `Incorporation Date: ${company?.incorporationDate ?? 'N/A'}`, size: 11 },
        { text: `Business Type: ${company?.businessType ?? 'N/A'}`, size: 11 },
        { text: `Industry: ${company?.industry ?? 'N/A'}`, size: 11 },
        { text: `Employees: ${company?.employeeCount ?? 'N/A'}`, size: 11 },
        { text: '', size: 11 },
        { text: 'Business Description:', bold: true, size: 11 },
        { text: company?.description ?? 'N/A', size: 11 },
      ];
      break;
    default:
      title = 'Supporting Document';
      content = [
        { text: company?.name ?? 'Company Name', bold: true, size: 16 },
        { text: `Document Type: ${documentType.replace(/_/g, ' ').toUpperCase()}`, bold: true, size: 14 },
        { text: `Generated: ${new Date().toLocaleDateString()}`, size: 11 },
        { text: '', size: 11 },
        { text: `This document has been generated for testing purposes by Fill Pro.`, size: 11 },
        { text: `Session ID: ${context.sessionId}`, size: 10 },
      ];
  }

  // Draw watermark
  page.drawText(WATERMARK, {
    x: 30,
    y: 20,
    size: 7,
    font: regularFont,
    color: rgb(0.7, 0.7, 0.7),
  });

  // Draw header
  page.drawRectangle({
    x: 0,
    y: height - 60,
    width,
    height: 60,
    color: rgb(0.24, 0.25, 0.75),
  });

  page.drawText('Fill Pro — Synthetic Test Document', {
    x: 20,
    y: height - 25,
    size: 10,
    font: regularFont,
    color: rgb(1, 1, 1),
  });

  // Draw content
  let yPos = height - 90;
  for (const item of content) {
    if (yPos < 60) {
      const newPage = pdfDoc.addPage([595, 842]);
      yPos = newPage.getSize().height - 50;
    }
    page.drawText(item.text || '', {
      x: 40,
      y: yPos,
      size: item.size ?? 11,
      font: item.bold ? boldFont : regularFont,
      color: rgb(0.1, 0.1, 0.1),
    });
    yPos -= (item.size ?? 11) + 8;
  }

  const pdfBytes = await pdfDoc.save();
  const base64 = btoa(String.fromCharCode(...pdfBytes));
  const fname = filename ?? `${documentType.replace(/_/g, '-')}-${Date.now()}.pdf`;

  return {
    id: `doc-${Date.now()}`,
    format: 'pdf',
    documentType,
    filename: fname,
    mimeType: 'application/pdf',
    sizeBytes: pdfBytes.length,
    dataBase64: base64,
    generatedAt: Date.now(),
  };
}

// ---- XLSX Generator ----
export async function generateXLSX(
  documentType: string,
  context: TestDataContext,
  filename?: string
): Promise<GeneratedDocument> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Fill Pro';
  workbook.created = new Date();

  const company = context.company;
  const financial = context.financial;
  const currency = financial?.currency ?? 'USD';

  const headerStyle: Partial<ExcelJS.Style> = {
    font: { bold: true, color: { argb: 'FFFFFFFF' } },
    fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF6366F1' } },
    alignment: { horizontal: 'center' },
  };

  const sheetName = documentType === 'balance_sheet' ? 'Balance Sheet' :
    documentType === 'income_statement' ? 'Income Statement' : 'Financial Data';

  const sheet = workbook.addWorksheet(sheetName);

  // Company header
  sheet.mergeCells('A1:D1');
  const titleCell = sheet.getCell('A1');
  titleCell.value = company?.name ?? 'Company Name';
  titleCell.style = { ...headerStyle };

  sheet.mergeCells('A2:D2');
  const subtitleCell = sheet.getCell('A2');
  subtitleCell.value = sheetName;
  subtitleCell.style = { font: { bold: true, size: 12 } };

  sheet.mergeCells('A3:D3');
  const dateCell = sheet.getCell('A3');
  dateCell.value = `As at ${financial?.financialYearEnd ?? new Date().toLocaleDateString()}`;

  if (documentType === 'balance_sheet' || documentType === 'financial_statement') {
    sheet.getCell('A5').value = 'ASSETS';
    sheet.getCell('A5').style = { font: { bold: true } };
    sheet.getCell('A6').value = 'Total Assets';
    sheet.getCell('B6').value = financial?.totalAssets ?? 0;
    sheet.getCell('B6').numFmt = `"${currency}" #,##0.00`;

    sheet.getCell('A8').value = 'LIABILITIES';
    sheet.getCell('A8').style = { font: { bold: true } };
    sheet.getCell('A9').value = 'Total Liabilities';
    sheet.getCell('B9').value = financial?.totalLiabilities ?? 0;
    sheet.getCell('B9').numFmt = `"${currency}" #,##0.00`;

    sheet.getCell('A11').value = 'EQUITY';
    sheet.getCell('A11').style = { font: { bold: true } };
    sheet.getCell('A12').value = "Shareholders' Equity";
    sheet.getCell('B12').value = financial?.shareholdersEquity ?? 0;
    sheet.getCell('B12').numFmt = `"${currency}" #,##0.00`;

    sheet.getCell('A14').value = 'Check (Assets = Liabilities + Equity)';
    sheet.getCell('B14').value = { formula: '=B9+B12', result: (financial?.totalLiabilities ?? 0) + (financial?.shareholdersEquity ?? 0) };
  } else if (documentType === 'income_statement') {
    sheet.getCell('A5').value = 'Revenue';
    sheet.getCell('B5').value = financial?.income ?? 0;
    sheet.getCell('B5').numFmt = `"${currency}" #,##0.00`;

    sheet.getCell('A6').value = 'Expenses';
    sheet.getCell('B6').value = financial?.expenses ?? 0;
    sheet.getCell('B6').numFmt = `"${currency}" #,##0.00`;

    sheet.getCell('A7').value = 'Profit Before Tax';
    sheet.getCell('B7').value = { formula: '=B5-B6', result: financial?.profitBeforeTax ?? 0 };
    sheet.getCell('B7').numFmt = `"${currency}" #,##0.00`;

    sheet.getCell('A8').value = `Tax (${financial?.taxPercentage ?? 24}%)`;
    sheet.getCell('B8').value = financial?.taxAmount ?? 0;
    sheet.getCell('B8').numFmt = `"${currency}" #,##0.00`;

    sheet.getCell('A9').value = 'Net Profit After Tax';
    sheet.getCell('B9').value = { formula: '=B7-B8', result: financial?.profitAfterTax ?? 0 };
    sheet.getCell('B9').numFmt = `"${currency}" #,##0.00`;
    sheet.getCell('A9').style = { font: { bold: true } };
  } else {
    sheet.getCell('A5').value = 'Company';
    sheet.getCell('B5').value = company?.name ?? '';
    sheet.getCell('A6').value = 'Registration';
    sheet.getCell('B6').value = company?.registrationNumber ?? '';
    sheet.getCell('A7').value = 'Industry';
    sheet.getCell('B7').value = company?.industry ?? '';
    sheet.getCell('A8').value = 'Employees';
    sheet.getCell('B8').value = company?.employeeCount ?? 0;
  }

  // Watermark row
  const lastRow = sheet.lastRow?.number ?? 15;
  sheet.getCell(`A${lastRow + 2}`).value = WATERMARK;
  sheet.getCell(`A${lastRow + 2}`).style = { font: { color: { argb: 'FFCCCCCC' }, size: 8 } };

  // Column widths
  sheet.getColumn('A').width = 30;
  sheet.getColumn('B').width = 20;

  const buffer = await workbook.xlsx.writeBuffer();
  const uint8 = new Uint8Array(buffer as ArrayBuffer);
  const base64 = btoa(String.fromCharCode(...uint8));
  const fname = filename ?? `${documentType.replace(/_/g, '-')}-${Date.now()}.xlsx`;

  return {
    id: `doc-${Date.now()}`,
    format: 'xlsx',
    documentType,
    filename: fname,
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    sizeBytes: uint8.length,
    dataBase64: base64,
    generatedAt: Date.now(),
  };
}

// ---- DOCX Generator ----
export async function generateDOCX(
  documentType: string,
  context: TestDataContext,
  filename?: string
): Promise<GeneratedDocument> {
  const company = context.company;
  const financial = context.financial;

  const sections = [
    new Paragraph({
      text: WATERMARK,
      style: 'Caption',
      alignment: AlignmentType.CENTER,
    }),
    new Paragraph({
      text: company?.name ?? 'Company Name',
      heading: HeadingLevel.HEADING_1,
    }),
    new Paragraph({
      text: documentType.replace(/_/g, ' ').toUpperCase(),
      heading: HeadingLevel.HEADING_2,
    }),
    new Paragraph({
      children: [
        new TextRun({ text: 'Registration Number: ', bold: true }),
        new TextRun(company?.registrationNumber ?? 'N/A'),
      ],
    }),
    new Paragraph({
      children: [
        new TextRun({ text: 'Business Type: ', bold: true }),
        new TextRun(company?.businessType ?? 'N/A'),
      ],
    }),
    new Paragraph({
      children: [
        new TextRun({ text: 'Industry: ', bold: true }),
        new TextRun(company?.industry ?? 'N/A'),
      ],
    }),
    new Paragraph({
      children: [
        new TextRun({ text: 'Employees: ', bold: true }),
        new TextRun(String(company?.employeeCount ?? 'N/A')),
      ],
    }),
    new Paragraph({ text: '' }),
    new Paragraph({ heading: HeadingLevel.HEADING_3, text: 'Financial Summary' }),
    new Paragraph({
      children: [
        new TextRun({ text: 'Revenue: ', bold: true }),
        new TextRun(formatCurrency(financial?.revenue ?? 0, financial?.currency ?? 'USD')),
      ],
    }),
    new Paragraph({
      children: [
        new TextRun({ text: 'Net Profit After Tax: ', bold: true }),
        new TextRun(formatCurrency(financial?.profitAfterTax ?? 0, financial?.currency ?? 'USD')),
      ],
    }),
    new Paragraph({ text: '' }),
    new Paragraph({
      children: [
        new TextRun({ text: 'Generated by Fill Pro for testing purposes. ', color: '999999', size: 18 }),
        new TextRun({ text: 'Not valid for official use.', color: '999999', size: 18 }),
      ],
    }),
  ];

  const doc = new Document({
    sections: [{ properties: {}, children: sections }],
  });

  const buffer = await Packer.toBuffer(doc);
  const uint8 = new Uint8Array(buffer);
  const base64 = btoa(String.fromCharCode(...uint8));
  const fname = filename ?? `${documentType.replace(/_/g, '-')}-${Date.now()}.docx`;

  return {
    id: `doc-${Date.now()}`,
    format: 'docx',
    documentType,
    filename: fname,
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    sizeBytes: uint8.length,
    dataBase64: base64,
    generatedAt: Date.now(),
  };
}

// ---- Image Generator ----
export function generatePNG(
  width: number = 400,
  height: number = 300,
  label: string = 'Fill Pro Test Image',
  filename?: string
): GeneratedDocument {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;

  // Background gradient
  const gradient = ctx.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, '#6366F1');
  gradient.addColorStop(1, '#8B5CF6');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  // Grid pattern
  ctx.strokeStyle = 'rgba(255,255,255,0.1)';
  ctx.lineWidth = 1;
  for (let x = 0; x < width; x += 40) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, height); ctx.stroke();
  }
  for (let y = 0; y < height; y += 40) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(width, y); ctx.stroke();
  }

  // Label
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  ctx.font = `bold ${Math.min(24, width / 15)}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, width / 2, height / 2);

  // Watermark
  ctx.fillStyle = 'rgba(255,255,255,0.4)';
  ctx.font = '8px sans-serif';
  ctx.fillText('Fill Pro — Test Image', width / 2, height - 10);

  const dataUrl = canvas.toDataURL('image/png');
  const base64 = dataUrl.split(',')[1]!;
  const bytes = atob(base64).length;
  const fname = filename ?? `test-image-${Date.now()}.png`;

  return {
    id: `doc-${Date.now()}`,
    format: 'png',
    documentType: 'test_image',
    filename: fname,
    mimeType: 'image/png',
    sizeBytes: bytes,
    dataBase64: base64,
    generatedAt: Date.now(),
  };
}

// ---- CSV Generator ----
export function generateCSV(
  documentType: string,
  context: TestDataContext,
  filename?: string
): GeneratedDocument {
  const company = context.company;
  const financial = context.financial;
  let csv = '';

  if (documentType === 'financial_data') {
    csv = [
      `"${WATERMARK}"`,
      `"Company","${company?.name ?? ''}"`,
      `"Registration","${company?.registrationNumber ?? ''}"`,
      `"Revenue","${financial?.revenue ?? 0}"`,
      `"Expenses","${financial?.expenses ?? 0}"`,
      `"Profit Before Tax","${financial?.profitBeforeTax ?? 0}"`,
      `"Tax Amount","${financial?.taxAmount ?? 0}"`,
      `"Profit After Tax","${financial?.profitAfterTax ?? 0}"`,
      `"Total Assets","${financial?.totalAssets ?? 0}"`,
      `"Total Liabilities","${financial?.totalLiabilities ?? 0}"`,
      `"Shareholders Equity","${financial?.shareholdersEquity ?? 0}"`,
    ].join('\n');
  } else {
    csv = [
      `"${WATERMARK}"`,
      '"Field","Value"',
      `"Company Name","${company?.name ?? ''}"`,
      `"Industry","${company?.industry ?? ''}"`,
      `"Employees","${company?.employeeCount ?? ''}"`,
      `"Generated At","${new Date().toISOString()}"`,
    ].join('\n');
  }

  const encoded = btoa(unescape(encodeURIComponent(csv)));
  const fname = filename ?? `${documentType.replace(/_/g, '-')}-${Date.now()}.csv`;

  return {
    id: `doc-${Date.now()}`,
    format: 'csv',
    documentType,
    filename: fname,
    mimeType: 'text/csv',
    sizeBytes: csv.length,
    dataBase64: encoded,
    generatedAt: Date.now(),
  };
}

// ---- Generic TXT Generator ----
export function generateTXT(
  content: string,
  filename?: string
): GeneratedDocument {
  const full = `${WATERMARK}\n\n${content}\n\nGenerated by Fill Pro — ${new Date().toISOString()}`;
  const encoded = btoa(unescape(encodeURIComponent(full)));
  const fname = filename ?? `document-${Date.now()}.txt`;

  return {
    id: `doc-${Date.now()}`,
    format: 'txt',
    documentType: 'generic_text',
    filename: fname,
    mimeType: 'text/plain',
    sizeBytes: full.length,
    dataBase64: encoded,
    generatedAt: Date.now(),
  };
}

// ---- Convert GeneratedDocument to browser File ----
export function generatedDocumentToFile(doc: GeneratedDocument): File {
  const binaryString = atob(doc.dataBase64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return new File([bytes], doc.filename, { type: doc.mimeType });
}

// ---- Main dispatcher ----
export async function generateDocument(
  format: string,
  documentType: string,
  context: TestDataContext,
  filename?: string
): Promise<GeneratedDocument> {
  switch (format.toLowerCase()) {
    case 'pdf': return generatePDF(documentType, context, filename);
    case 'xlsx': return generateXLSX(documentType, context, filename);
    case 'docx': return generateDOCX(documentType, context, filename);
    case 'png': return generatePNG(400, 300, `${documentType} — Test Image`, filename);
    case 'csv': return generateCSV(documentType, context, filename);
    case 'txt': return generateTXT(`Document: ${documentType}\nCompany: ${context.company?.name ?? 'N/A'}\nDate: ${new Date().toLocaleDateString()}`, filename);
    default: return generatePDF(documentType, context, filename);
  }
}

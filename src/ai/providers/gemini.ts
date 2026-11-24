// ============================================================
// FILL PRO — Gemini AI Provider
// ============================================================

import { GoogleGenerativeAI, type GenerativeModel } from '@google/generative-ai';
import { z } from 'zod';
import type {
  FormAnalysisRequest,
  FormAnalysisResult,
  ConnectionResult,
  SemanticCategory,
} from '../../types/index.js';

// ---- Zod Schemas for validation ----
const FieldAnalysisSchema = z.object({
  id: z.string(),
  semanticType: z.string(),
  semanticCategory: z.enum(['personal', 'contact', 'business', 'financial', 'technical', 'geographic', 'temporal', 'document', 'security', 'generic', 'unknown']),
  confidence: z.number().min(0).max(1),
  reasoning: z.string().optional(),
  generatorId: z.string().optional(),
});

const FormAnalysisResultSchema = z.object({
  fields: z.array(FieldAnalysisSchema),
  formPurpose: z.string().optional(),
  suggestedLocale: z.string().optional(),
  businessDomain: z.string().optional(),
});

// ---- Provider ----
export interface AIProvider {
  id: string;
  validateConnection(): Promise<ConnectionResult>;
  analyzeForm(request: FormAnalysisRequest): Promise<FormAnalysisResult>;
}

export class GeminiProvider implements AIProvider {
  id = 'gemini';
  private model: GenerativeModel;
  private modelId: string;

  constructor(apiKey: string, modelId: string = 'gemini-1.5-flash') {
    if (!apiKey) throw new Error('Gemini API key is required');
    const client = new GoogleGenerativeAI(apiKey);
    this.modelId = modelId;
    this.model = client.getGenerativeModel({ model: modelId });
  }

  async validateConnection(): Promise<ConnectionResult> {
    const start = Date.now();
    try {
      const result = await this.model.generateContent('Reply with only the word "connected"');
      const text = result.response.text().toLowerCase().trim();
      return {
        success: text.includes('connected'),
        model: this.modelId,
        latencyMs: Date.now() - start,
      };
    } catch (err) {
      return {
        success: false,
        error: String(err),
        latencyMs: Date.now() - start,
      };
    }
  }

  async analyzeForm(request: FormAnalysisRequest): Promise<FormAnalysisResult> {
    // Sanitize — do not include real values, only metadata
    const sanitizedFields = request.fields.map(f => ({
      id: f.id,
      label: f.label,
      placeholder: f.placeholder,
      htmlType: f.htmlType,
      ariaLabel: f.ariaLabel,
      description: f.description,
      section: f.section,
    }));

    const prompt = `You are a form analysis expert. Analyze the following web form fields and classify each one's semantic meaning.

Page title: ${request.pageTitle ?? 'Unknown'}
Form title: ${request.formTitle ?? 'Unknown'}
URL hint: ${request.url.replace(/\/\d+/g, '/[id]').replace(/\?.*/, '')}

Fields to classify:
${JSON.stringify(sanitizedFields, null, 2)}

Respond with ONLY valid JSON matching this structure:
{
  "fields": [
    {
      "id": "field-id",
      "semanticType": "category.type (e.g. personal.first_name, financial.total_assets)",
      "semanticCategory": "one of: personal|contact|business|financial|technical|geographic|temporal|document|security|generic|unknown",
      "confidence": 0.0 to 1.0,
      "reasoning": "brief explanation",
      "generatorId": "generator function name"
    }
  ],
  "formPurpose": "brief description of what this form is for",
  "suggestedLocale": "locale code e.g. en-LK",
  "businessDomain": "e.g. FINANCIAL_SERVICES, REGISTRATION, etc."
}

Rules:
- Use security.password for any password field
- Use security.otp for OTP/PIN fields
- Do not assign high confidence without clear evidence
- For unknown fields, use unknown.unknown with low confidence
- Never return executable code`;

    try {
      const result = await this.model.generateContent({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
          responseMimeType: 'application/json',
          temperature: 0.1,
          maxOutputTokens: 2048,
        },
      });

      const text = result.response.text();
      const parsed = JSON.parse(text);
      const validated = FormAnalysisResultSchema.parse(parsed);
      return validated;
    } catch (err) {
      throw new Error(`Gemini analysis failed: ${String(err)}`);
    }
  }
}

// ---- Local (no-AI) Provider ----
export class LocalProvider implements AIProvider {
  id = 'local';

  async validateConnection(): Promise<ConnectionResult> {
    return { success: true, model: 'local', latencyMs: 0 };
  }

  async analyzeForm(_request: FormAnalysisRequest): Promise<FormAnalysisResult> {
    // Local provider returns no AI classification
    return { fields: [] };
  }
}

// ---- Factory ----
export function createAIProvider(
  type: 'gemini' | 'local',
  apiKey?: string,
  modelId?: string
): AIProvider {
  if (type === 'gemini' && apiKey) {
    return new GeminiProvider(apiKey, modelId);
  }
  return new LocalProvider();
}

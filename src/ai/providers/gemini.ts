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
export interface GenerateValuesRequest {
  fields: Array<{
    id: string;
    label?: string;
    fieldName?: string;
    placeholder?: string;
    htmlType?: string;
    controlType?: string;
    options?: any;
  }>;
  instruction?: string;
  locale?: string;
  scenario?: string;
}

export interface AIProvider {
  id: string;
  validateConnection(): Promise<ConnectionResult>;
  analyzeForm(request: FormAnalysisRequest): Promise<FormAnalysisResult>;
  generateValues?(request: GenerateValuesRequest): Promise<Record<string, any>>;
}

export class GeminiProvider implements AIProvider {
  id = 'gemini';
  private client: GoogleGenerativeAI;
  private model: GenerativeModel;
  private modelId: string;

  constructor(apiKey: string, modelId: string = 'gemini-3.5-flash') {
    if (!apiKey) throw new Error('Gemini API key is required');
    this.client = new GoogleGenerativeAI(apiKey);
    let resolvedModel = modelId || 'gemini-3.5-flash';
    if (resolvedModel.includes('1.5') || resolvedModel === 'gemini-2.0-flash') {
      resolvedModel = 'gemini-3.5-flash';
    }
    this.modelId = resolvedModel;
    this.model = this.client.getGenerativeModel({ model: resolvedModel });
  }

  private getFallbackModels(): string[] {
    const list = [this.modelId, 'gemini-3.5-flash', 'gemini-2.5-flash', 'gemini-3.8-flash', 'gemini-flash-latest'];
    return list.filter((m, i, arr) => arr.indexOf(m) === i);
  }

  private async generateWithFallback(
    params: { contents: any[]; generationConfig?: any } | string,
    errorPrefix: string
  ): Promise<any> {
    const models = this.getFallbackModels();
    let lastError: any = null;

    for (const mId of models) {
      try {
        const modelInstance = this.client.getGenerativeModel({ model: mId });
        const result = await modelInstance.generateContent(params as any);
        return result;
      } catch (err: any) {
        lastError = err;
        const msg = String(err?.message || err);
        // If it's a 503 (high demand) or 429 (rate limit) or 404 (not found), try next fallback
        if (msg.includes('503') || msg.includes('429') || msg.includes('404') || msg.includes('high demand') || msg.includes('RESOURCE_EXHAUSTED')) {
          console.warn(`[FillPro Gemini] Model ${mId} failed (${msg}), automatically trying fallback model...`);
          continue;
        }
        throw new Error(`${errorPrefix}: ${msg}`);
      }
    }
    throw new Error(`${errorPrefix}: All fallback models exhausted. Last error: ${String(lastError?.message || lastError)}`);
  }

  async validateConnection(): Promise<ConnectionResult> {
    const start = Date.now();
    try {
      const result = await this.generateWithFallback('Reply with only the word "connected"', 'Validation');
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
      const result = await this.generateWithFallback({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
          responseMimeType: 'application/json',
          temperature: 0.1,
          maxOutputTokens: 2048,
        },
      }, 'Gemini analysis failed');

      const text = result.response.text();
      const parsed = JSON.parse(text);
      const validated = FormAnalysisResultSchema.parse(parsed);
      return validated;
    } catch (err: any) {
      throw new Error(`Gemini analysis failed: ${String(err?.message || err)}`);
    }
  }

  async generateValues(request: GenerateValuesRequest): Promise<Record<string, any>> {
    const prompt = `You are an intelligent form filling engine. Generate realistic form values matching the user's instructions.
Instruction: ${request.instruction || 'Fill all fields with realistic and valid test data'}
Locale: ${request.locale || 'en-US'}
Scenario: ${request.scenario || 'valid_data'}

Form fields to fill:
${JSON.stringify(request.fields, null, 2)}

Respond with ONLY valid JSON with this exact structure:
{
  "values": {
    "fieldId": "generated value"
  }
}
Rules:
- Generate values for each field that match its label, type, and the user instruction.
- If a field has options, choose one of the available option values.
- Do NOT generate passwords or real sensitive financial data.
- Return ONLY the JSON object.`;

    try {
      const result = await this.generateWithFallback({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
          responseMimeType: 'application/json',
          temperature: 0.2,
          maxOutputTokens: 2048,
        },
      }, 'Gemini generateValues failed');
      const text = result.response.text();
      const parsed = JSON.parse(text);
      return parsed.values || parsed;
    } catch (err: any) {
      throw new Error(`Gemini generateValues failed: ${String(err?.message || err)}`);
    }
  }
}

// ---- OpenAI Provider ----
export class OpenAIProvider implements AIProvider {
  id = 'openai';
  private apiKey: string;
  private modelId: string;

  constructor(apiKey: string, modelId: string = 'gpt-4o-mini') {
    if (!apiKey) throw new Error('OpenAI API key is required');
    this.apiKey = apiKey;
    this.modelId = modelId;
  }

  async validateConnection(): Promise<ConnectionResult> {
    const start = Date.now();
    try {
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: this.modelId,
          messages: [{ role: 'user', content: 'Reply with only the word "connected"' }],
          max_tokens: 10,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        return { success: false, error: data.error?.message || `HTTP ${res.status}`, latencyMs: Date.now() - start };
      }
      const text = data.choices?.[0]?.message?.content?.toLowerCase() ?? '';
      return {
        success: text.includes('connected'),
        model: this.modelId,
        latencyMs: Date.now() - start,
      };
    } catch (err: any) {
      return { success: false, error: String(err?.message || err), latencyMs: Date.now() - start };
    }
  }

  async analyzeForm(request: FormAnalysisRequest): Promise<FormAnalysisResult> {
    const sanitizedFields = request.fields.map(f => ({
      id: f.id,
      label: f.label,
      placeholder: f.placeholder,
      htmlType: f.htmlType,
      ariaLabel: f.ariaLabel,
      description: f.description,
      section: f.section,
    }));

    const prompt = `Analyze web form fields and classify semantic meaning. Return valid JSON only.\nFields: ${JSON.stringify(sanitizedFields)}`;
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.modelId,
        response_format: { type: 'json_object' },
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.1,
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error?.message || 'OpenAI request failed');
    const parsed = JSON.parse(data.choices[0].message.content);
    return FormAnalysisResultSchema.parse(parsed);
  }

  async generateValues(request: GenerateValuesRequest): Promise<Record<string, any>> {
    const prompt = `You are an intelligent form filling engine. Generate realistic form values matching the user's instructions.
Instruction: ${request.instruction || 'Fill all fields with realistic and valid test data'}
Locale: ${request.locale || 'en-US'}
Scenario: ${request.scenario || 'valid_data'}

Form fields to fill:
${JSON.stringify(request.fields, null, 2)}

Respond with ONLY valid JSON with this exact structure:
{
  "values": {
    "fieldId": "generated value"
  }
}
Rules:
- Generate values for each field that match its label, type, and the user instruction.
- If a field has options, choose one of the available option values.
- Do NOT generate passwords or real sensitive data.`;

    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.modelId,
        response_format: { type: 'json_object' },
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.2,
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error?.message || 'OpenAI generation failed');
    const parsed = JSON.parse(data.choices[0].message.content);
    return parsed.values || parsed;
  }
}

// ---- Claude (Anthropic) Provider ----
export class ClaudeProvider implements AIProvider {
  id = 'claude';
  private apiKey: string;
  private modelId: string;

  constructor(apiKey: string, modelId: string = 'claude-3-5-haiku-20241022') {
    if (!apiKey) throw new Error('Anthropic API key is required');
    this.apiKey = apiKey;
    this.modelId = modelId;
  }

  async validateConnection(): Promise<ConnectionResult> {
    const start = Date.now();
    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.apiKey,
          'anthropic-version': '2023-06-01',
          'dangerously-allow-browser': 'true',
        },
        body: JSON.stringify({
          model: this.modelId,
          messages: [{ role: 'user', content: 'Reply with only the word "connected"' }],
          max_tokens: 10,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        return { success: false, error: data.error?.message || `HTTP ${res.status}`, latencyMs: Date.now() - start };
      }
      const text = data.content?.[0]?.text?.toLowerCase() ?? '';
      return {
        success: text.includes('connected'),
        model: this.modelId,
        latencyMs: Date.now() - start,
      };
    } catch (err: any) {
      return { success: false, error: String(err?.message || err), latencyMs: Date.now() - start };
    }
  }

  async analyzeForm(request: FormAnalysisRequest): Promise<FormAnalysisResult> {
    const sanitizedFields = request.fields.map(f => ({
      id: f.id,
      label: f.label,
      placeholder: f.placeholder,
      htmlType: f.htmlType,
      ariaLabel: f.ariaLabel,
      description: f.description,
      section: f.section,
    }));

    const prompt = `Analyze web form fields and classify semantic meaning. Return valid JSON only with keys fields, formPurpose, suggestedLocale.\nFields: ${JSON.stringify(sanitizedFields)}`;
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01',
        'dangerously-allow-browser': 'true',
      },
      body: JSON.stringify({
        model: this.modelId,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 2048,
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error?.message || 'Claude request failed');
    const parsed = JSON.parse(data.content[0].text);
    return FormAnalysisResultSchema.parse(parsed);
  }

  async generateValues(request: GenerateValuesRequest): Promise<Record<string, any>> {
    const prompt = `You are an intelligent form filling engine. Generate realistic form values matching the user's instructions.
Instruction: ${request.instruction || 'Fill all fields with realistic and valid test data'}
Locale: ${request.locale || 'en-US'}
Scenario: ${request.scenario || 'valid_data'}

Form fields to fill:
${JSON.stringify(request.fields, null, 2)}

Respond with ONLY valid JSON with this exact structure (no markdown, no extra text):
{
  "values": {
    "fieldId": "generated value"
  }
}
Rules:
- Generate values for each field that match its label, type, and the user instruction.
- If a field has options, choose one of the available option values.
- Do NOT generate passwords or real sensitive data.`;

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01',
        'dangerously-allow-browser': 'true',
      },
      body: JSON.stringify({
        model: this.modelId,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 2048,
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error?.message || 'Claude generation failed');
    let text = data.content[0].text.trim();
    if (text.startsWith('```')) {
      text = text.replace(/^```[a-z]*\n?/i, '').replace(/```$/, '').trim();
    }
    const parsed = JSON.parse(text);
    return parsed.values || parsed;
  }
}

// ---- Local (no-AI) Provider ----
export class LocalProvider implements AIProvider {
  id = 'local';

  async validateConnection(): Promise<ConnectionResult> {
    return { success: true, model: 'local', latencyMs: 0 };
  }

  async analyzeForm(_request: FormAnalysisRequest): Promise<FormAnalysisResult> {
    return { fields: [] };
  }

  async generateValues(_request: GenerateValuesRequest): Promise<Record<string, any>> {
    return {};
  }
}

// ---- Factory ----
export function createAIProvider(
  type: 'gemini' | 'openai' | 'claude' | 'local',
  apiKey?: string,
  modelId?: string
): AIProvider {
  if (type === 'gemini' && apiKey) {
    return new GeminiProvider(apiKey, modelId || 'gemini-3.5-flash');
  }
  if (type === 'openai' && apiKey) {
    return new OpenAIProvider(apiKey, modelId || 'gpt-4o-mini');
  }
  if (type === 'claude' && apiKey) {
    return new ClaudeProvider(apiKey, modelId || 'claude-3-5-haiku-20241022');
  }
  return new LocalProvider();
}

// ---- Dynamic Model Fetcher ----
export async function fetchAvailableModels(
  provider: 'gemini' | 'openai' | 'claude',
  apiKey: string
): Promise<Array<{ id: string; label: string; recommended?: boolean }>> {
  if (!apiKey) return [];

  if (provider === 'gemini') {
    try {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error?.message || `HTTP ${res.status}`);
      }
      const data = await res.json();
      const models: Array<{ id: string; label: string; recommended?: boolean }> = [];
      const excluded = ['tts', 'image', 'clip', 'robotics', 'transcribe', 'computer-use'];
      for (const m of (data.models || [])) {
        const id = m.name?.replace('models/', '') || '';
        const methods = m.supportedGenerationMethods || [];
        if (methods.includes('generateContent') && !excluded.some(ex => id.includes(ex))) {
          const name = m.displayName && m.displayName !== id ? `${m.displayName} (${id})` : id;
          models.push({
            id,
            label: name,
            recommended: id === 'gemini-3.5-flash' || id === 'gemini-2.5-flash',
          });
        }
      }
      return models.sort((a, b) => {
        if (a.recommended && !b.recommended) return -1;
        if (!a.recommended && b.recommended) return 1;
        return a.id.localeCompare(b.id);
      });
    } catch (err) {
      console.warn('[FillPro] Failed to fetch Gemini models:', err);
      return [];
    }
  }

  if (provider === 'openai') {
    try {
      const res = await fetch('https://api.openai.com/v1/models', {
        headers: { Authorization: `Bearer ${apiKey}` },
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error?.message || `HTTP ${res.status}`);
      }
      const data = await res.json();
      const models = (data.data || [])
        .filter((m: any) => m.id?.startsWith('gpt-'))
        .map((m: any) => ({
          id: m.id,
          label: m.id,
          recommended: m.id === 'gpt-4o-mini' || m.id === 'gpt-4o',
        }))
        .sort((a: any, b: any) => {
          if (a.recommended && !b.recommended) return -1;
          if (!a.recommended && b.recommended) return 1;
          return a.id.localeCompare(b.id);
        });
      return models;
    } catch (err) {
      console.warn('[FillPro] Failed to fetch OpenAI models:', err);
      return [];
    }
  }

  if (provider === 'claude') {
    return [
      { id: 'claude-3-5-haiku-20241022', label: 'Claude 3.5 Haiku (Fast)', recommended: true },
      { id: 'claude-3-5-sonnet-20241022', label: 'Claude 3.5 Sonnet (Most Intelligent)', recommended: false },
      { id: 'claude-3-opus-20240229', label: 'Claude 3 Opus', recommended: false },
    ];
  }

  return [];
}

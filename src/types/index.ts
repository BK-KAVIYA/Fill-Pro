// ============================================================
// FILL PRO — Core Type Definitions
// ============================================================

// ---- Control Types ----
export type ControlType =
  | 'text'
  | 'email'
  | 'password'
  | 'number'
  | 'tel'
  | 'url'
  | 'search'
  | 'date'
  | 'datetime-local'
  | 'time'
  | 'month'
  | 'week'
  | 'range'
  | 'color'
  | 'textarea'
  | 'select'
  | 'multi-select'
  | 'radio'
  | 'checkbox'
  | 'toggle'
  | 'file'
  | 'contenteditable'
  | 'rich-text'
  | 'autocomplete'
  | 'date-range'
  | 'otp'
  | 'tag-input'
  | 'chip-input'
  | 'table-cell'
  | 'hidden'
  | 'custom';

// ---- Semantic Type Registry ----
export type SemanticCategory =
  | 'personal'
  | 'contact'
  | 'business'
  | 'financial'
  | 'technical'
  | 'geographic'
  | 'temporal'
  | 'document'
  | 'security'
  | 'generic'
  | 'unknown';

export interface SemanticType {
  id: string;
  category: SemanticCategory;
  label: string;
  description?: string;
  generatorId: string;
  validationPattern?: RegExp;
  examples?: string[];
}

// ---- Field Constraints ----
export interface FieldConstraints {
  required: boolean;
  minLength?: number;
  maxLength?: number;
  min?: number | string;
  max?: number | string;
  step?: number;
  pattern?: string;
  accept?: string;
  multiple?: boolean;
  options?: FieldOption[];
  decimalPlaces?: number;
  currency?: string;
}

export interface FieldOption {
  value: string;
  label: string;
  disabled?: boolean;
  selected?: boolean;
}

// ---- Classification Evidence ----
export interface ClassificationEvidence {
  signal: string;
  value: string;
  weight: number;
  source: string;
}

// ---- Confidence Bands ----
export type ConfidenceBand = 'high' | 'medium' | 'low';

export function getConfidenceBand(score: number): ConfidenceBand {
  if (score >= 0.85) return 'high';
  if (score >= 0.60) return 'medium';
  return 'low';
}

// ---- Field Descriptor ----
export interface FieldDescriptor {
  id: string;
  fingerprint: string;
  frameId?: number;
  documentId?: string;
  selector: string;
  selectorCandidates: string[];

  fieldName?: string;
  label?: string;
  placeholder?: string;
  description?: string;
  ariaLabel?: string;
  ariaDescribedBy?: string;

  htmlType: string;
  controlType: ControlType;
  semanticType: string;
  semanticCategory: SemanticCategory;

  section?: string;
  formContext?: string;
  pageTitle?: string;
  formTitle?: string;
  fieldsetLegend?: string;

  required: boolean;
  disabled: boolean;
  readonly: boolean;
  visible: boolean;
  hasExistingValue: boolean;

  constraints: FieldConstraints;
  options?: FieldOption[];

  dependencies: string[];

  confidence: number;
  confidenceBand: ConfidenceBand;
  evidence: ClassificationEvidence[];

  classificationSource:
    | 'native'
    | 'heuristic'
    | 'knowledge_base'
    | 'ai'
    | 'user_confirmed';

  adapterId?: string;
  isSensitive: boolean;
  skipReason?: string;
}

// ---- File Field Descriptor ----
export interface FileFieldDescriptor extends FieldDescriptor {
  acceptedExtensions: string[];
  acceptedMimeTypes: string[];
  multiple: boolean;
  maxFiles?: number;
  minFileSizeBytes?: number;
  maxFileSizeBytes?: number;
  documentSemanticType?: string;
  relatedDataFields: string[];
  generationStrategy:
    | 'generic'
    | 'contextual'
    | 'template'
    | 'library'
    | 'manual';
  uploadAdapterId?: string;
  autoUploadRisk: 'known' | 'possible' | 'unknown';
}

// ---- Generated Value ----
export interface GeneratedValue {
  fieldId: string;
  value: unknown;
  displayValue: string;
  generatorId: string;
  semanticType: string;
  locale: string;
  seed?: number;
  metadata?: Record<string, unknown>;
}

// ---- Fill Result ----
export type FillStatus =
  | 'filled_verified'
  | 'filled_validation_unknown'
  | 'corrected_verified'
  | 'validation_failed'
  | 'skipped_existing'
  | 'skipped_sensitive'
  | 'unsupported_component'
  | 'requires_manual_review'
  | 'skipped_disabled'
  | 'skipped_readonly'
  | 'field_missing'
  | 'error';

export interface FillResult {
  fieldId: string;
  status: FillStatus;
  generatedValue?: GeneratedValue;
  previousValue?: unknown;
  validationMessage?: string;
  adapterId?: string;
  attempts: number;
  durationMs: number;
  error?: string;
}

// ---- Verification Result ----
export interface VerificationResult {
  fieldId: string;
  passed: boolean;
  valueRetained: boolean;
  nativeValidityValid?: boolean;
  ariaInvalid?: boolean;
  visibleValidationMessage?: string;
  requiredFieldFilled?: boolean;
}

// ---- Scan Result ----
export interface ScanResult {
  sessionId: string;
  url: string;
  origin: string;
  timestamp: number;
  fields: FieldDescriptor[];
  fileFields: FileFieldDescriptor[];
  totalFields: number;
  fillableFields: number;
  sensitiveFields: number;
  ambiguousFields: number;
  requiredFields: number;
  uploadFields: number;
  formSections: FormSection[];
  pageTitle: string;
  formTitle?: string;
  scanDurationMs: number;
}

export interface FormSection {
  id: string;
  label?: string;
  fieldIds: string[];
  visible: boolean;
}

// ---- Test Scenarios ----
export type TestScenario =
  | 'valid_data'
  | 'required_only'
  | 'negative_test'
  | 'boundary_test'
  | 'international'
  | 'duplicate_record'
  | 'custom';

// ---- Synthetic Data Context ----
export interface SyntheticPerson {
  firstName: string;
  middleName?: string;
  lastName: string;
  fullName: string;
  dateOfBirth: string;
  age: number;
  gender: string;
  nationality: string;
  occupation: string;
  email: string;
  phone: string;
  mobile: string;
  address: SyntheticAddress;
}

export interface SyntheticAddress {
  street: string;
  city: string;
  district?: string;
  province?: string;
  state?: string;
  postalCode: string;
  country: string;
  countryCode: string;
}

export interface SyntheticCompany {
  name: string;
  tradingName?: string;
  registrationNumber: string;
  incorporationDate: string;
  businessType: string;
  industry: string;
  description: string;
  employeeCount: number;
  department?: string;
  website: string;
  email: string;
  phone: string;
  address: SyntheticAddress;
  licenceType?: string;
  licenceReference?: string;
}

export interface SyntheticFinancialProfile {
  currency: string;
  revenue: number;
  turnover: number;
  totalAssets: number;
  totalLiabilities: number;
  shareholdersEquity: number;
  netCapital: number;
  income: number;
  expenses: number;
  profitBeforeTax: number;
  taxAmount: number;
  taxPercentage: number;
  profitAfterTax: number;
  financialYear: string;
  financialYearEnd: string;
  reportingPeriod: string;
}

export interface SyntheticShareholder {
  person: SyntheticPerson;
  ownershipPercentage: number;
  shareType: string;
  shareCount: number;
}

export interface TestDataContext {
  sessionId: string;
  seed: number;
  locale: string;
  scenario: TestScenario;

  person?: SyntheticPerson;
  company?: SyntheticCompany;
  financial?: SyntheticFinancialProfile;
  directors?: SyntheticPerson[];
  shareholders?: SyntheticShareholder[];

  customValues: Record<string, unknown>;
  generatedDocuments: GeneratedDocumentReference[];
}

export interface GeneratedDocumentReference {
  id: string;
  fieldId: string;
  documentType: string;
  format: string;
  filename: string;
  sizeBytes: number;
  generationMode: 'generic' | 'contextual' | 'template' | 'library';
  createdAt: number;
}

// ---- Execution Plan ----
export type ActionType =
  | 'SET_VALUE'
  | 'SELECT_OPTION'
  | 'CHECK_CHECKBOX'
  | 'TOGGLE_SWITCH'
  | 'UPLOAD_FILE'
  | 'WAIT_FOR_DEPENDENCIES'
  | 'GENERATE_DOCUMENT'
  | 'ATTACH_FILES'
  | 'VERIFY_FIELD'
  | 'SCROLL_TO_FIELD';

export interface ExecutionAction {
  type: ActionType;
  fieldId: string;
  value?: unknown;
  format?: string;
  documentType?: string;
  metadata?: Record<string, unknown>;
}

export interface ExecutionPlan {
  sessionId: string;
  origin: string;
  scenario: TestScenario;
  locale: string;
  actions: ExecutionAction[];
  submitForm: false;
  preserveExisting: boolean;
  scope: 'all' | 'required' | 'section' | 'selected';
  maxRetries: number;
  timeoutMs: number;
}

// ---- Messages ----
export type ExtensionMessage =
  | { type: 'SCAN_FORM'; payload: { tabId: number } }
  | { type: 'SCAN_RESULT'; payload: ScanResult }
  | { type: 'ANALYZE_FORM'; payload: { tabId: number; sessionId: string } }
  | { type: 'GENERATE_DATA'; payload: { sessionId: string; locale: string; scenario: TestScenario } }
  | { type: 'EXECUTE_PLAN'; payload: ExecutionPlan }
  | { type: 'EXECUTION_PROGRESS'; payload: ExecutionProgressEvent }
  | { type: 'EXECUTION_COMPLETE'; payload: ExecutionReport }
  | { type: 'CANCEL_EXECUTION'; payload: { sessionId: string } }
  | { type: 'GENERATE_FILE'; payload: FileGenerationRequest }
  | { type: 'FILE_GENERATED'; payload: { fieldId: string; filename: string; sizeBytes: number } }
  | { type: 'ATTACH_FILE'; payload: AttachmentRequest }
  | { type: 'UNDO_SESSION'; payload: { sessionId: string } }
  | { type: 'OPEN_SIDE_PANEL'; payload: { tabId: number } }
  | { type: 'GET_SETTINGS'; payload: Record<string, never> }
  | { type: 'SAVE_SETTINGS'; payload: Partial<AppSettings> }
  | { type: 'TEST_AI_CONNECTION'; payload: { apiKey: string; model: string } }
  | { type: 'AI_CONNECTION_RESULT'; payload: { success: boolean; error?: string } };

export interface ExecutionProgressEvent {
  sessionId: string;
  currentAction: number;
  totalActions: number;
  currentFieldId?: string;
  currentFieldLabel?: string;
  status: string;
  percentage: number;
}

export interface ExecutionReport {
  sessionId: string;
  url: string;
  scenario: TestScenario;
  startedAt: number;
  completedAt: number;
  durationMs: number;

  totalFields: number;
  filledVerified: number;
  filledUnknown: number;
  correctedVerified: number;
  validationFailed: number;
  skippedExisting: number;
  skippedSensitive: number;
  unsupported: number;
  requiresManualReview: number;
  errors: number;

  documentsGenerated: number;
  filesAttached: number;
  filesRequiringManual: number;

  aiRequestCount: number;
  aiErrors: number;

  fieldResults: FillResult[];
  learnedMappings: number;

  warnings: string[];
  criticalErrors: string[];
}

// ---- File Generation ----
export interface FileGenerationRequest {
  fieldId: string;
  format: string;
  documentType?: string;
  mode: 'generic' | 'contextual' | 'template';
  context?: Partial<TestDataContext>;
  constraints?: {
    maxSizeBytes?: number;
    filename?: string;
  };
}

export interface AttachmentRequest {
  fieldId: string;
  tabId: number;
  filename: string;
  mimeType: string;
  dataBase64: string;
}

export interface GeneratedDocument {
  id: string;
  fieldId?: string;
  format: string;
  documentType: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  dataBase64: string;
  generatedAt: number;
}

// ---- App Settings ----
export interface AppSettings {
  general: {
    defaultLocale: string;
    defaultScenario: TestScenario;
    preserveExistingValues: boolean;
    rememberMappings: boolean;
    previewBeforeFilling: boolean;
    theme: 'light' | 'dark' | 'system';
  };
  ai: {
    enabled: boolean;
    provider: 'gemini' | 'local';
    model: string;
    maxRequestsPerSession: number;
    localOnlyMode: boolean;
    screenshotAnalysis: boolean;
  };
  generation: {
    seed?: number;
    emailDomain: string;
    preferredDateFormat: string;
    currency: string;
    defaultNumberMin: number;
    defaultNumberMax: number;
    textLengthMin: number;
    textLengthMax: number;
  };
  files: {
    maxGeneratedFileSizeBytes: number;
    defaultFileFormat: string;
    defaultGenerationMode: 'generic' | 'contextual' | 'template';
  };
  privacy: {
    allowedOrigins: string[];
    blockedOrigins: string[];
    developmentOnly: boolean;
    sensitiveFieldExclusions: string[];
  };
}

// ---- AI Types ----
export interface FormAnalysisRequest {
  fields: Array<{
    id: string;
    label?: string;
    placeholder?: string;
    htmlType: string;
    ariaLabel?: string;
    description?: string;
    section?: string;
    formContext?: string;
    pageTitle?: string;
  }>;
  pageTitle?: string;
  formTitle?: string;
  url: string;
}

export interface FormAnalysisResult {
  fields: Array<{
    id: string;
    semanticType: string;
    semanticCategory: SemanticCategory;
    confidence: number;
    reasoning?: string;
    generatorId?: string;
  }>;
  formPurpose?: string;
  suggestedLocale?: string;
  businessDomain?: string;
}

export interface ConnectionResult {
  success: boolean;
  model?: string;
  error?: string;
  latencyMs?: number;
}

// ---- Business Rules ----
export type RuleOperator =
  | 'EQUALS_SUM'
  | 'EQUALS_DIFFERENCE'
  | 'EQUALS_PRODUCT'
  | 'PERCENTAGE_OF'
  | 'MUST_EQUAL'
  | 'MUST_PRECEDE'
  | 'MUST_FOLLOW'
  | 'PERCENTAGE_TOTAL_100'
  | 'CORRESPONDS_TO_DOB'
  | 'FULLNAME_CONCAT';

export interface BusinessRule {
  ruleId: string;
  operator: RuleOperator;
  target: string;
  operands: string[];
  tolerance?: number;
  description?: string;
}

// ---- Knowledge Base ----
export interface ApplicationKnowledge {
  id?: number;
  origin: string;
  formFingerprint: string;
  fieldFingerprint: string;
  semanticType: string;
  semanticCategory: SemanticCategory;
  constraints?: Partial<FieldConstraints>;
  adapterId?: string;
  source: 'user_confirmed' | 'heuristic' | 'ai' | 'auto_learned';
  verified: boolean;
  successCount: number;
  failureCount: number;
  schemaVersion: number;
  createdAt: number;
  updatedAt: number;
}

// ---- Locale ----
export interface LocaleProfile {
  id: string;
  label: string;
  country: string;
  countryCode: string;
  language: string;
  currency: string;
  currencyCode: string;
  dateFormat: string;
  phonePrefix: string;
  postalCodePattern?: string;
  cities: string[];
  provinces?: string[];
  states?: string[];
}

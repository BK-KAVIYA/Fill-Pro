// ============================================================
// FILL PRO — Semantic Type Registry
// ============================================================

import type { SemanticType } from '../types/index.js';

export const SEMANTIC_TYPES: Record<string, SemanticType> = {
  // Personal
  'personal.first_name': { id: 'personal.first_name', category: 'personal', label: 'First Name', generatorId: 'firstName' },
  'personal.middle_name': { id: 'personal.middle_name', category: 'personal', label: 'Middle Name', generatorId: 'middleName' },
  'personal.last_name': { id: 'personal.last_name', category: 'personal', label: 'Last Name', generatorId: 'lastName' },
  'personal.full_name': { id: 'personal.full_name', category: 'personal', label: 'Full Name', generatorId: 'fullName' },
  'personal.date_of_birth': { id: 'personal.date_of_birth', category: 'personal', label: 'Date of Birth', generatorId: 'dateOfBirth' },
  'personal.age': { id: 'personal.age', category: 'personal', label: 'Age', generatorId: 'age' },
  'personal.gender': { id: 'personal.gender', category: 'personal', label: 'Gender', generatorId: 'gender' },
  'personal.nationality': { id: 'personal.nationality', category: 'personal', label: 'Nationality', generatorId: 'nationality' },
  'personal.occupation': { id: 'personal.occupation', category: 'personal', label: 'Occupation', generatorId: 'occupation' },
  'personal.biography': { id: 'personal.biography', category: 'personal', label: 'Biography', generatorId: 'biography' },
  'personal.marital_status': { id: 'personal.marital_status', category: 'personal', label: 'Marital Status', generatorId: 'maritalStatus' },
  'personal.national_id': { id: 'personal.national_id', category: 'personal', label: 'National ID', generatorId: 'nationalId' },
  'personal.passport': { id: 'personal.passport', category: 'personal', label: 'Passport Number', generatorId: 'passportNumber' },

  // Contact
  'contact.email': { id: 'contact.email', category: 'contact', label: 'Email Address', generatorId: 'email', validationPattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/ },
  'contact.phone': { id: 'contact.phone', category: 'contact', label: 'Phone Number', generatorId: 'phone' },
  'contact.mobile': { id: 'contact.mobile', category: 'contact', label: 'Mobile Number', generatorId: 'mobile' },
  'contact.country_code': { id: 'contact.country_code', category: 'contact', label: 'Country Code', generatorId: 'countryCode' },
  'contact.address': { id: 'contact.address', category: 'contact', label: 'Address', generatorId: 'fullAddress' },
  'contact.street': { id: 'contact.street', category: 'contact', label: 'Street Address', generatorId: 'streetAddress' },
  'contact.city': { id: 'contact.city', category: 'contact', label: 'City', generatorId: 'city' },
  'contact.district': { id: 'contact.district', category: 'contact', label: 'District', generatorId: 'district' },
  'contact.province': { id: 'contact.province', category: 'contact', label: 'Province', generatorId: 'province' },
  'contact.state': { id: 'contact.state', category: 'contact', label: 'State', generatorId: 'state' },
  'contact.postal_code': { id: 'contact.postal_code', category: 'contact', label: 'Postal Code', generatorId: 'postalCode' },
  'contact.country': { id: 'contact.country', category: 'contact', label: 'Country', generatorId: 'country' },
  'contact.website': { id: 'contact.website', category: 'contact', label: 'Website', generatorId: 'website' },
  'contact.fax': { id: 'contact.fax', category: 'contact', label: 'Fax Number', generatorId: 'fax' },

  // Business
  'business.company_name': { id: 'business.company_name', category: 'business', label: 'Company Name', generatorId: 'companyName' },
  'business.trading_name': { id: 'business.trading_name', category: 'business', label: 'Trading Name', generatorId: 'tradingName' },
  'business.registration_number': { id: 'business.registration_number', category: 'business', label: 'Business Registration Number', generatorId: 'businessRegistrationNumber' },
  'business.incorporation_date': { id: 'business.incorporation_date', category: 'business', label: 'Incorporation Date', generatorId: 'incorporationDate' },
  'business.business_type': { id: 'business.business_type', category: 'business', label: 'Business Type', generatorId: 'businessType' },
  'business.industry': { id: 'business.industry', category: 'business', label: 'Industry', generatorId: 'industry' },
  'business.description': { id: 'business.description', category: 'business', label: 'Business Description', generatorId: 'businessDescription' },
  'business.employee_count': { id: 'business.employee_count', category: 'business', label: 'Number of Employees', generatorId: 'employeeCount' },
  'business.department': { id: 'business.department', category: 'business', label: 'Department', generatorId: 'department' },
  'business.designation': { id: 'business.designation', category: 'business', label: 'Designation / Job Title', generatorId: 'designation' },
  'business.director_name': { id: 'business.director_name', category: 'business', label: 'Director Name', generatorId: 'fullName' },
  'business.ownership_percentage': { id: 'business.ownership_percentage', category: 'business', label: 'Ownership Percentage', generatorId: 'ownershipPercentage' },
  'business.licence_type': { id: 'business.licence_type', category: 'business', label: 'Licence Type', generatorId: 'licenceType' },
  'business.licence_reference': { id: 'business.licence_reference', category: 'business', label: 'Licence Reference', generatorId: 'licenceReference' },
  'business.application_reason': { id: 'business.application_reason', category: 'business', label: 'Application Reason', generatorId: 'applicationReason' },

  // Financial
  'financial.currency': { id: 'financial.currency', category: 'financial', label: 'Currency', generatorId: 'currency' },
  'financial.revenue': { id: 'financial.revenue', category: 'financial', label: 'Revenue', generatorId: 'revenue' },
  'financial.turnover': { id: 'financial.turnover', category: 'financial', label: 'Turnover', generatorId: 'turnover' },
  'financial.total_assets': { id: 'financial.total_assets', category: 'financial', label: 'Total Assets', generatorId: 'totalAssets' },
  'financial.total_liabilities': { id: 'financial.total_liabilities', category: 'financial', label: 'Total Liabilities', generatorId: 'totalLiabilities' },
  'financial.shareholders_equity': { id: 'financial.shareholders_equity', category: 'financial', label: 'Shareholders Equity', generatorId: 'shareholdersEquity' },
  'financial.net_capital': { id: 'financial.net_capital', category: 'financial', label: 'Net Capital', generatorId: 'netCapital' },
  'financial.income': { id: 'financial.income', category: 'financial', label: 'Income', generatorId: 'income' },
  'financial.expenses': { id: 'financial.expenses', category: 'financial', label: 'Expenses', generatorId: 'expenses' },
  'financial.profit': { id: 'financial.profit', category: 'financial', label: 'Profit', generatorId: 'profit' },
  'financial.profit_before_tax': { id: 'financial.profit_before_tax', category: 'financial', label: 'Profit Before Tax', generatorId: 'profitBeforeTax' },
  'financial.profit_after_tax': { id: 'financial.profit_after_tax', category: 'financial', label: 'Profit After Tax', generatorId: 'profitAfterTax' },
  'financial.tax_amount': { id: 'financial.tax_amount', category: 'financial', label: 'Tax Amount', generatorId: 'taxAmount' },
  'financial.tax_percentage': { id: 'financial.tax_percentage', category: 'financial', label: 'Tax Percentage', generatorId: 'taxPercentage' },
  'financial.interest_rate': { id: 'financial.interest_rate', category: 'financial', label: 'Interest Rate', generatorId: 'interestRate' },
  'financial.financial_year': { id: 'financial.financial_year', category: 'financial', label: 'Financial Year', generatorId: 'financialYear' },
  'financial.financial_year_end': { id: 'financial.financial_year_end', category: 'financial', label: 'Financial Year End', generatorId: 'financialYearEnd' },
  'financial.reporting_period': { id: 'financial.reporting_period', category: 'financial', label: 'Reporting Period', generatorId: 'reportingPeriod' },
  'financial.capital_amount': { id: 'financial.capital_amount', category: 'financial', label: 'Capital Amount', generatorId: 'capitalAmount' },
  'financial.annual_revenue': { id: 'financial.annual_revenue', category: 'financial', label: 'Annual Revenue', generatorId: 'annualRevenue' },
  'financial.bank_account': { id: 'financial.bank_account', category: 'financial', label: 'Bank Account Number', generatorId: 'bankAccount' },
  'financial.iban': { id: 'financial.iban', category: 'financial', label: 'IBAN', generatorId: 'iban' },
  'financial.swift_code': { id: 'financial.swift_code', category: 'financial', label: 'SWIFT/BIC Code', generatorId: 'swiftCode' },

  // Technical
  'technical.uuid': { id: 'technical.uuid', category: 'technical', label: 'UUID', generatorId: 'uuid' },
  'technical.ipv4': { id: 'technical.ipv4', category: 'technical', label: 'IPv4 Address', generatorId: 'ipv4' },
  'technical.ipv6': { id: 'technical.ipv6', category: 'technical', label: 'IPv6 Address', generatorId: 'ipv6' },
  'technical.mac_address': { id: 'technical.mac_address', category: 'technical', label: 'MAC Address', generatorId: 'macAddress' },
  'technical.url': { id: 'technical.url', category: 'technical', label: 'URL', generatorId: 'url' },
  'technical.domain': { id: 'technical.domain', category: 'technical', label: 'Domain Name', generatorId: 'domain' },
  'technical.username': { id: 'technical.username', category: 'technical', label: 'Username', generatorId: 'username' },
  'technical.version': { id: 'technical.version', category: 'technical', label: 'Version Number', generatorId: 'version' },
  'technical.product_id': { id: 'technical.product_id', category: 'technical', label: 'Product Identifier', generatorId: 'productId' },
  'technical.serial_number': { id: 'technical.serial_number', category: 'technical', label: 'Serial Number', generatorId: 'serialNumber' },
  'technical.reference_number': { id: 'technical.reference_number', category: 'technical', label: 'Reference Number', generatorId: 'referenceNumber' },

  // Generic
  'generic.text': { id: 'generic.text', category: 'generic', label: 'Generic Text', generatorId: 'genericText' },
  'generic.number': { id: 'generic.number', category: 'generic', label: 'Generic Number', generatorId: 'genericNumber' },
  'generic.date': { id: 'generic.date', category: 'generic', label: 'Generic Date', generatorId: 'genericDate' },
  'generic.description': { id: 'generic.description', category: 'generic', label: 'Description', generatorId: 'description' },
  'generic.notes': { id: 'generic.notes', category: 'generic', label: 'Notes', generatorId: 'notes' },
  'generic.search': { id: 'generic.search', category: 'generic', label: 'Search Query', generatorId: 'searchQuery' },
  'generic.quantity': { id: 'generic.quantity', category: 'generic', label: 'Quantity', generatorId: 'quantity' },
  'generic.percentage': { id: 'generic.percentage', category: 'generic', label: 'Percentage', generatorId: 'percentage' },
  'generic.color': { id: 'generic.color', category: 'generic', label: 'Color', generatorId: 'colorHex' },
  'generic.range': { id: 'generic.range', category: 'generic', label: 'Range', generatorId: 'rangeValue' },

  // Security (detected, not filled)
  'security.password': { id: 'security.password', category: 'security', label: 'Password', generatorId: 'password' },
  'security.otp': { id: 'security.otp', category: 'security', label: 'OTP / Verification Code', generatorId: 'otp' },
  'security.security_answer': { id: 'security.security_answer', category: 'security', label: 'Security Answer', generatorId: 'securityAnswer' },
  'security.payment_card': { id: 'security.payment_card', category: 'security', label: 'Payment Card Number', generatorId: 'paymentCard' },
  'security.cvv': { id: 'security.cvv', category: 'security', label: 'CVV', generatorId: 'cvv' },
  'security.auth_token': { id: 'security.auth_token', category: 'security', label: 'Authentication Token', generatorId: 'authToken' },

  // Unknown
  'unknown.unknown': { id: 'unknown.unknown', category: 'unknown', label: 'Unknown', generatorId: 'genericText' },
};

export function getSemanticType(id: string): SemanticType {
  return SEMANTIC_TYPES[id] ?? SEMANTIC_TYPES['unknown.unknown']!;
}

export function isSensitiveSemanticType(id: string): boolean {
  return id.startsWith('security.');
}

// Keyword-to-semantic-type mappings for heuristic classification
export const KEYWORD_MAPPINGS: Array<{
  keywords: string[];
  semanticType: string;
  weight: number;
}> = [
  // Personal
  { keywords: ['first name', 'firstname', 'given name', 'forename'], semanticType: 'personal.first_name', weight: 0.9 },
  { keywords: ['middle name', 'middlename'], semanticType: 'personal.middle_name', weight: 0.9 },
  { keywords: ['last name', 'lastname', 'surname', 'family name'], semanticType: 'personal.last_name', weight: 0.9 },
  { keywords: ['full name', 'fullname', 'name', 'applicant name', 'customer name'], semanticType: 'personal.full_name', weight: 0.7 },
  { keywords: ['date of birth', 'dob', 'birth date', 'birthday', 'd.o.b', 'born on'], semanticType: 'personal.date_of_birth', weight: 0.95 },
  { keywords: ['age'], semanticType: 'personal.age', weight: 0.8 },
  { keywords: ['gender', 'sex'], semanticType: 'personal.gender', weight: 0.9 },
  { keywords: ['nationality', 'citizenship', 'citizen'], semanticType: 'personal.nationality', weight: 0.9 },
  { keywords: ['occupation', 'profession', 'job title', 'position', 'role'], semanticType: 'personal.occupation', weight: 0.75 },
  { keywords: ['biography', 'bio', 'about me', 'about you', 'profile'], semanticType: 'personal.biography', weight: 0.7 },
  { keywords: ['marital status', 'marital', 'married'], semanticType: 'personal.marital_status', weight: 0.9 },
  { keywords: ['nic', 'national id', 'national identity', 'identity number', 'id number'], semanticType: 'personal.national_id', weight: 0.85 },
  { keywords: ['passport', 'passport number'], semanticType: 'personal.passport', weight: 0.9 },

  // Contact
  { keywords: ['email', 'e-mail', 'email address', 'electronic mail'], semanticType: 'contact.email', weight: 0.95 },
  { keywords: ['phone', 'telephone', 'phone number', 'tel', 'contact number'], semanticType: 'contact.phone', weight: 0.85 },
  { keywords: ['mobile', 'cell', 'mobile number', 'cell phone'], semanticType: 'contact.mobile', weight: 0.9 },
  { keywords: ['country code', 'dialling code', 'dial code'], semanticType: 'contact.country_code', weight: 0.9 },
  { keywords: ['address', 'street address', 'mailing address', 'postal address'], semanticType: 'contact.address', weight: 0.75 },
  { keywords: ['street', 'road', 'lane', 'avenue', 'boulevard'], semanticType: 'contact.street', weight: 0.7 },
  { keywords: ['city', 'town'], semanticType: 'contact.city', weight: 0.8 },
  { keywords: ['district'], semanticType: 'contact.district', weight: 0.85 },
  { keywords: ['province'], semanticType: 'contact.province', weight: 0.85 },
  { keywords: ['state'], semanticType: 'contact.state', weight: 0.75 },
  { keywords: ['postal code', 'postcode', 'zip', 'zip code', 'pin code', 'pincode'], semanticType: 'contact.postal_code', weight: 0.9 },
  { keywords: ['country'], semanticType: 'contact.country', weight: 0.85 },
  { keywords: ['website', 'web address', 'homepage', 'url'], semanticType: 'contact.website', weight: 0.8 },
  { keywords: ['fax', 'fax number'], semanticType: 'contact.fax', weight: 0.9 },

  // Business
  { keywords: ['company name', 'business name', 'organisation name', 'organization name', 'corporate name', 'entity name'], semanticType: 'business.company_name', weight: 0.95 },
  { keywords: ['trading name', 'trade name', 'brand name', 'doing business as', 'dba'], semanticType: 'business.trading_name', weight: 0.9 },
  { keywords: ['registration number', 'reg number', 'company number', 'business registration', 'crn', 'br number'], semanticType: 'business.registration_number', weight: 0.95 },
  { keywords: ['incorporation date', 'date of incorporation', 'registered date', 'established date'], semanticType: 'business.incorporation_date', weight: 0.9 },
  { keywords: ['business type', 'company type', 'entity type', 'structure'], semanticType: 'business.business_type', weight: 0.85 },
  { keywords: ['industry', 'sector', 'business sector', 'industry type'], semanticType: 'business.industry', weight: 0.8 },
  { keywords: ['business description', 'company description', 'nature of business', 'business activity', 'business overview'], semanticType: 'business.description', weight: 0.85 },
  { keywords: ['employee count', 'number of employees', 'employees', 'staff count', 'headcount', 'no. of employees'], semanticType: 'business.employee_count', weight: 0.9 },
  { keywords: ['department'], semanticType: 'business.department', weight: 0.75 },
  { keywords: ['designation', 'job title', 'title', 'position'], semanticType: 'business.designation', weight: 0.65 },
  { keywords: ['director', 'director name'], semanticType: 'business.director_name', weight: 0.85 },
  { keywords: ['ownership', 'shareholding', 'ownership percentage', 'equity stake'], semanticType: 'business.ownership_percentage', weight: 0.9 },
  { keywords: ['licence type', 'license type', 'licence category'], semanticType: 'business.licence_type', weight: 0.9 },
  { keywords: ['licence reference', 'license reference', 'licence number', 'license number'], semanticType: 'business.licence_reference', weight: 0.9 },
  { keywords: ['application reason', 'purpose', 'reason for application', 'purpose of application'], semanticType: 'business.application_reason', weight: 0.75 },

  // Financial
  { keywords: ['currency'], semanticType: 'financial.currency', weight: 0.9 },
  { keywords: ['revenue', 'total revenue', 'gross revenue'], semanticType: 'financial.revenue', weight: 0.85 },
  { keywords: ['turnover', 'annual turnover', 'gross turnover'], semanticType: 'financial.turnover', weight: 0.9 },
  { keywords: ['total assets', 'assets'], semanticType: 'financial.total_assets', weight: 0.9 },
  { keywords: ['total liabilities', 'liabilities'], semanticType: 'financial.total_liabilities', weight: 0.9 },
  { keywords: ['equity', 'shareholders equity', "shareholder's equity", 'stockholders equity', 'net assets'], semanticType: 'financial.shareholders_equity', weight: 0.85 },
  { keywords: ['net capital', 'capital'], semanticType: 'financial.net_capital', weight: 0.8 },
  { keywords: ['income', 'total income', 'gross income'], semanticType: 'financial.income', weight: 0.8 },
  { keywords: ['expenses', 'total expenses', 'operating expenses'], semanticType: 'financial.expenses', weight: 0.8 },
  { keywords: ['profit before tax', 'pbt', 'earnings before tax', 'ebt'], semanticType: 'financial.profit_before_tax', weight: 0.95 },
  { keywords: ['profit after tax', 'pat', 'net profit', 'net income', 'net earnings'], semanticType: 'financial.profit_after_tax', weight: 0.9 },
  { keywords: ['profit', 'gross profit'], semanticType: 'financial.profit', weight: 0.7 },
  { keywords: ['tax amount', 'tax payable', 'income tax'], semanticType: 'financial.tax_amount', weight: 0.85 },
  { keywords: ['tax percentage', 'tax rate', 'tax %'], semanticType: 'financial.tax_percentage', weight: 0.9 },
  { keywords: ['interest rate', 'rate of interest'], semanticType: 'financial.interest_rate', weight: 0.9 },
  { keywords: ['financial year', 'fiscal year', 'fy'], semanticType: 'financial.financial_year', weight: 0.85 },
  { keywords: ['financial year end', 'fiscal year end', 'year end date'], semanticType: 'financial.financial_year_end', weight: 0.9 },
  { keywords: ['reporting period', 'period', 'accounting period'], semanticType: 'financial.reporting_period', weight: 0.8 },
  { keywords: ['annual revenue', 'yearly revenue'], semanticType: 'financial.annual_revenue', weight: 0.9 },
  { keywords: ['capital amount', 'paid up capital', 'registered capital'], semanticType: 'financial.capital_amount', weight: 0.9 },
  { keywords: ['bank account', 'account number', 'bank account number'], semanticType: 'financial.bank_account', weight: 0.85 },
  { keywords: ['iban'], semanticType: 'financial.iban', weight: 0.95 },
  { keywords: ['swift', 'bic', 'swift code', 'bic code'], semanticType: 'financial.swift_code', weight: 0.95 },

  // Technical
  { keywords: ['uuid', 'unique id', 'unique identifier', 'guid'], semanticType: 'technical.uuid', weight: 0.9 },
  { keywords: ['ip address', 'ipv4', 'ip'], semanticType: 'technical.ipv4', weight: 0.85 },
  { keywords: ['ipv6'], semanticType: 'technical.ipv6', weight: 0.95 },
  { keywords: ['mac address', 'mac'], semanticType: 'technical.mac_address', weight: 0.9 },
  { keywords: ['url', 'web url', 'link'], semanticType: 'technical.url', weight: 0.75 },
  { keywords: ['domain', 'domain name'], semanticType: 'technical.domain', weight: 0.8 },
  { keywords: ['username', 'user name', 'login', 'login name', 'user id'], semanticType: 'technical.username', weight: 0.8 },
  { keywords: ['version', 'version number', 'build number'], semanticType: 'technical.version', weight: 0.8 },
  { keywords: ['product id', 'product identifier', 'sku', 'product code'], semanticType: 'technical.product_id', weight: 0.85 },
  { keywords: ['serial number', 'serial', 'serial no'], semanticType: 'technical.serial_number', weight: 0.85 },
  { keywords: ['reference number', 'reference', 'ref number', 'ref no', 'case number', 'ticket number'], semanticType: 'technical.reference_number', weight: 0.75 },

  // Security
  { keywords: ['password', 'pass', 'passphrase', 'pwd'], semanticType: 'security.password', weight: 0.95 },
  { keywords: ['otp', 'one time password', 'verification code', 'confirm code', 'sms code', 'pin'], semanticType: 'security.otp', weight: 0.95 },
  { keywords: ['security question', 'security answer', 'secret answer'], semanticType: 'security.security_answer', weight: 0.9 },
  { keywords: ['card number', 'credit card', 'debit card', 'payment card', 'card no'], semanticType: 'security.payment_card', weight: 0.95 },
  { keywords: ['cvv', 'cvc', 'security code', 'card security'], semanticType: 'security.cvv', weight: 0.95 },
];

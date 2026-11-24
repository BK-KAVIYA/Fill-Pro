// ============================================================
// FILL PRO — Local Data Generation Engine
// ============================================================

import { faker } from '@faker-js/faker';
import type {
  FieldDescriptor,
  GeneratedValue,
  TestDataContext,
  SyntheticPerson,
  SyntheticCompany,
  SyntheticFinancialProfile,
  SyntheticAddress,
  SyntheticShareholder,
  LocaleProfile,
} from '../../types/index.js';
import { getLocaleProfile } from '../../constants/locales.js';
import { SEMANTIC_TYPES } from '../../constants/semanticTypes.js';

// ---- Seed management ----
let currentSeed = Date.now();
export function setSeed(seed: number): void { currentSeed = seed; faker.seed(seed); }
export function resetSeed(): void { faker.seed(currentSeed); }

// ---- Address generator ----
function generateAddress(locale: LocaleProfile): SyntheticAddress {
  const city = faker.helpers.arrayElement(locale.cities);
  const province = locale.provinces ? faker.helpers.arrayElement(locale.provinces) : undefined;
  const state = locale.states ? faker.helpers.arrayElement(locale.states) : undefined;

  return {
    street: `${faker.number.int({ min: 1, max: 999 })} ${faker.location.street()}`,
    city,
    district: province ?? undefined,
    province,
    state,
    postalCode: locale.postalCodePattern ? generatePostalCode(locale) : faker.location.zipCode(),
    country: locale.country,
    countryCode: locale.countryCode,
  };
}

function generatePostalCode(locale: LocaleProfile): string {
  if (locale.id === 'en-LK') return faker.number.int({ min: 10000, max: 99999 }).toString();
  if (locale.id === 'en-US') return faker.number.int({ min: 10000, max: 99999 }).toString();
  if (locale.id === 'en-AU') return faker.number.int({ min: 1000, max: 9999 }).toString();
  if (locale.id === 'en-IN') return faker.number.int({ min: 100000, max: 999999 }).toString();
  if (locale.id === 'en-SG') return faker.number.int({ min: 100000, max: 999999 }).toString();
  if (locale.id === 'en-CA') {
    const letters = 'ABCEGHJKLMNPRSTVXY';
    const digits = '0123456789';
    return `${faker.helpers.arrayElement(letters.split(''))}${faker.helpers.arrayElement(digits.split(''))}${faker.helpers.arrayElement(letters.split(''))} ${faker.helpers.arrayElement(digits.split(''))}${faker.helpers.arrayElement(letters.split(''))}${faker.helpers.arrayElement(digits.split(''))}`;
  }
  return faker.number.int({ min: 10000, max: 99999 }).toString();
}

// ---- Person generator ----
export function generatePerson(localeId: string): SyntheticPerson {
  const locale = getLocaleProfile(localeId);
  const gender = faker.person.sex() as 'male' | 'female';
  const firstName = faker.person.firstName(gender);
  const lastName = faker.person.lastName();
  const fullName = `${firstName} ${lastName}`;
  const dob = faker.date.birthdate({ min: 22, max: 65, mode: 'age' });
  const age = new Date().getFullYear() - dob.getFullYear();

  return {
    firstName,
    middleName: Math.random() > 0.5 ? faker.person.middleName(gender) : undefined,
    lastName,
    fullName,
    dateOfBirth: dob.toISOString().split('T')[0]!,
    age,
    gender: gender === 'male' ? 'Male' : 'Female',
    nationality: locale.country,
    occupation: faker.person.jobTitle(),
    email: `${firstName.toLowerCase()}.${lastName.toLowerCase()}@example.com`,
    phone: `${locale.phonePrefix}${faker.number.int({ min: 100000000, max: 999999999 })}`,
    mobile: `${locale.phonePrefix}${faker.number.int({ min: 700000000, max: 799999999 })}`,
    address: generateAddress(locale),
  };
}

// ---- Company generator ----
export function generateCompany(localeId: string, overrides?: Partial<SyntheticCompany>): SyntheticCompany {
  const locale = getLocaleProfile(localeId);
  const companyName = overrides?.name ?? `${faker.company.name()} ${faker.helpers.arrayElement(['Ltd', 'PLC', 'Corp', 'Inc', 'Pvt Ltd'])}`;
  const incDate = faker.date.past({ years: 15 });

  return {
    name: companyName,
    tradingName: overrides?.tradingName,
    registrationNumber: generateBusinessRegNumber(locale),
    incorporationDate: incDate.toISOString().split('T')[0]!,
    businessType: faker.helpers.arrayElement(['Private Limited Company', 'Public Limited Company', 'Partnership', 'Sole Proprietorship', 'Registered Business']),
    industry: faker.helpers.arrayElement([
      'Information Technology', 'Financial Services', 'Manufacturing', 'Retail',
      'Healthcare', 'Education', 'Construction', 'Telecommunications',
      'Professional Services', 'Hospitality',
    ]),
    description: `${companyName} is a leading ${faker.company.buzzPhrase()} company providing ${faker.company.catchPhrase()}.`,
    employeeCount: overrides?.employeeCount ?? faker.number.int({ min: 5, max: 500 }),
    website: `https://www.${companyName.toLowerCase().replace(/[^a-z0-9]/g, '').substring(0, 15)}.example.com`,
    email: `info@${companyName.toLowerCase().replace(/[^a-z0-9]/g, '').substring(0, 10)}.example.com`,
    phone: `${locale.phonePrefix}${faker.number.int({ min: 100000000, max: 999999999 })}`,
    address: generateAddress(locale),
    licenceType: overrides?.licenceType,
    licenceReference: overrides?.licenceReference ?? `LIC-${faker.number.int({ min: 100000, max: 999999 })}`,
    ...overrides,
  };
}

function generateBusinessRegNumber(locale: LocaleProfile): string {
  switch (locale.countryCode) {
    case 'LK': return `PV${faker.number.int({ min: 10000, max: 99999 })}`;
    case 'GB': return `${faker.helpers.arrayElement(['SC', ''])  }${faker.number.int({ min: 1000000, max: 9999999 })}`;
    case 'AU': return faker.number.int({ min: 100000000, max: 999999999 }).toString();
    case 'US': return `${faker.location.state({ abbreviated: true })}-${faker.number.int({ min: 1000000, max: 9999999 })}`;
    case 'IN': return `U${faker.number.int({ min: 10000, max: 99999 })}${faker.location.state({ abbreviated: true })}${new Date().getFullYear()}${faker.helpers.arrayElement(['PTC', 'PVT', 'LTD'])}${faker.number.int({ min: 100000, max: 999999 })}`;
    default: return `REG-${faker.number.int({ min: 100000, max: 999999 })}`;
  }
}

// ---- Financial profile generator ----
export function generateFinancialProfile(
  localeId: string,
  overrides?: Partial<SyntheticFinancialProfile>
): SyntheticFinancialProfile {
  const locale = getLocaleProfile(localeId);
  const baseRevenue = overrides?.revenue ?? faker.number.int({ min: 1000000, max: 100000000 });
  const expenses = Math.round(baseRevenue * faker.number.float({ min: 0.5, max: 0.85 }));
  const profitBeforeTax = baseRevenue - expenses;
  const taxPercentage = overrides?.taxPercentage ?? 24;
  const taxAmount = Math.round(profitBeforeTax * (taxPercentage / 100));
  const profitAfterTax = profitBeforeTax - taxAmount;

  const totalLiabilities = overrides?.totalLiabilities ?? Math.round(baseRevenue * faker.number.float({ min: 0.3, max: 0.7 }));
  const shareholdersEquity = overrides?.shareholdersEquity ?? Math.round(baseRevenue * faker.number.float({ min: 0.5, max: 1.2 }));
  const totalAssets = totalLiabilities + shareholdersEquity;

  const currentYear = new Date().getFullYear();
  const fyEnd = overrides?.financialYearEnd ?? `31/03/${currentYear}`;

  return {
    currency: overrides?.currency ?? locale.currencyCode,
    revenue: baseRevenue,
    turnover: baseRevenue,
    totalAssets,
    totalLiabilities,
    shareholdersEquity,
    netCapital: shareholdersEquity,
    income: baseRevenue,
    expenses,
    profitBeforeTax,
    taxAmount,
    taxPercentage,
    profitAfterTax,
    financialYear: `${currentYear - 1}/${currentYear}`,
    financialYearEnd: fyEnd,
    reportingPeriod: `01/04/${currentYear - 1} - 31/03/${currentYear}`,
    ...overrides,
  };
}

// ---- Shareholders generator ----
export function generateShareholders(
  localeId: string,
  count: number = 2
): SyntheticShareholder[] {
  const shareholders: SyntheticShareholder[] = [];
  let remainingPercentage = 100;

  for (let i = 0; i < count; i++) {
    const person = generatePerson(localeId);
    const isLast = i === count - 1;
    const percentage = isLast
      ? remainingPercentage
      : Math.round(remainingPercentage / (count - i) * faker.number.float({ min: 0.3, max: 0.7 }));
    remainingPercentage -= percentage;

    shareholders.push({
      person,
      ownershipPercentage: percentage,
      shareType: faker.helpers.arrayElement(['Ordinary', 'Preference', 'Class A', 'Class B']),
      shareCount: faker.number.int({ min: 100, max: 10000 }),
    });
  }

  return shareholders;
}

// ---- Test Data Context builder ----
export function buildTestDataContext(
  localeId: string,
  overrides?: Partial<TestDataContext>
): TestDataContext {
  const seed = overrides?.seed ?? Date.now();
  faker.seed(seed);

  const person = generatePerson(localeId);
  const company = generateCompany(localeId);
  const financial = generateFinancialProfile(localeId, { currency: getLocaleProfile(localeId).currencyCode });
  const directors = [generatePerson(localeId), generatePerson(localeId)];
  const shareholders = generateShareholders(localeId, 3);

  return {
    sessionId: overrides?.sessionId ?? `ctx-${Date.now()}`,
    seed,
    locale: localeId,
    scenario: overrides?.scenario ?? 'valid_data',
    person,
    company,
    financial,
    directors,
    shareholders,
    customValues: overrides?.customValues ?? {},
    generatedDocuments: overrides?.generatedDocuments ?? [],
    ...overrides,
  };
}

// ---- Value generators per semantic type ----
export type ValueGenerator = (
  field: FieldDescriptor,
  context: TestDataContext
) => GeneratedValue;

function makeValue(field: FieldDescriptor, value: unknown, generatorId: string, locale: string): GeneratedValue {
  return {
    fieldId: field.id,
    value,
    displayValue: String(value),
    generatorId,
    semanticType: field.semanticType,
    locale,
  };
}

const generators: Record<string, ValueGenerator> = {
  // Personal
  firstName: (f, ctx) => makeValue(f, ctx.person?.firstName ?? faker.person.firstName(), 'firstName', ctx.locale),
  middleName: (f, ctx) => makeValue(f, ctx.person?.middleName ?? faker.person.middleName(), 'middleName', ctx.locale),
  lastName: (f, ctx) => makeValue(f, ctx.person?.lastName ?? faker.person.lastName(), 'lastName', ctx.locale),
  fullName: (f, ctx) => makeValue(f, ctx.person?.fullName ?? faker.person.fullName(), 'fullName', ctx.locale),
  dateOfBirth: (f, ctx) => makeValue(f, ctx.person?.dateOfBirth ?? faker.date.birthdate({ min: 22, max: 65, mode: 'age' }).toISOString().split('T')[0], 'dateOfBirth', ctx.locale),
  age: (f, ctx) => makeValue(f, ctx.person?.age ?? faker.number.int({ min: 22, max: 65 }), 'age', ctx.locale),
  gender: (f, ctx) => makeValue(f, ctx.person?.gender ?? faker.person.sex(), 'gender', ctx.locale),
  nationality: (f, ctx) => makeValue(f, ctx.person?.nationality ?? getLocaleProfile(ctx.locale).country, 'nationality', ctx.locale),
  occupation: (f, ctx) => makeValue(f, ctx.person?.occupation ?? faker.person.jobTitle(), 'occupation', ctx.locale),
  biography: (f, ctx) => makeValue(f, `${ctx.person?.fullName ?? faker.person.fullName()} is a ${faker.person.jobTitle()} with over ${faker.number.int({ min: 2, max: 20 })} years of experience in ${faker.commerce.department()}.`, 'biography', ctx.locale),
  maritalStatus: (f, ctx) => makeValue(f, faker.helpers.arrayElement(['Single', 'Married', 'Divorced', 'Widowed']), 'maritalStatus', ctx.locale),
  nationalId: (f, ctx) => {
    const locale = getLocaleProfile(ctx.locale);
    let id: string;
    if (locale.countryCode === 'LK') {
      id = `${faker.number.int({ min: 100000000, max: 999999999 })}V`;
    } else {
      id = faker.string.alphanumeric({ length: 10, casing: 'upper' });
    }
    return makeValue(f, id, 'nationalId', ctx.locale);
  },
  passportNumber: (f, ctx) => makeValue(f, `${faker.string.alpha({ length: 1, casing: 'upper' })}${faker.number.int({ min: 1000000, max: 9999999 })}`, 'passportNumber', ctx.locale),

  // Contact
  email: (f, ctx) => makeValue(f, ctx.person?.email ?? `${faker.internet.username()}@example.com`, 'email', ctx.locale),
  phone: (f, ctx) => {
    const locale = getLocaleProfile(ctx.locale);
    return makeValue(f, ctx.person?.phone ?? `${locale.phonePrefix}${faker.number.int({ min: 100000000, max: 999999999 })}`, 'phone', ctx.locale);
  },
  mobile: (f, ctx) => {
    const locale = getLocaleProfile(ctx.locale);
    return makeValue(f, ctx.person?.mobile ?? `${locale.phonePrefix}${faker.number.int({ min: 700000000, max: 799999999 })}`, 'mobile', ctx.locale);
  },
  countryCode: (f, ctx) => makeValue(f, getLocaleProfile(ctx.locale).phonePrefix, 'countryCode', ctx.locale),
  fullAddress: (f, ctx) => {
    const addr = ctx.person?.address;
    return makeValue(f, addr ? `${addr.street}, ${addr.city}, ${addr.country}` : faker.location.streetAddress(true), 'fullAddress', ctx.locale);
  },
  streetAddress: (f, ctx) => makeValue(f, ctx.person?.address.street ?? faker.location.streetAddress(), 'streetAddress', ctx.locale),
  city: (f, ctx) => makeValue(f, ctx.person?.address.city ?? faker.helpers.arrayElement(getLocaleProfile(ctx.locale).cities), 'city', ctx.locale),
  district: (f, ctx) => makeValue(f, ctx.person?.address.district ?? (getLocaleProfile(ctx.locale).provinces?.[0]) ?? faker.location.county(), 'district', ctx.locale),
  province: (f, ctx) => makeValue(f, ctx.person?.address.province ?? faker.helpers.arrayElement(getLocaleProfile(ctx.locale).provinces ?? ['Central']), 'province', ctx.locale),
  state: (f, ctx) => makeValue(f, ctx.person?.address.state ?? faker.helpers.arrayElement(getLocaleProfile(ctx.locale).states ?? ['State']), 'state', ctx.locale),
  postalCode: (f, ctx) => makeValue(f, ctx.person?.address.postalCode ?? '10100', 'postalCode', ctx.locale),
  country: (f, ctx) => makeValue(f, ctx.person?.address.country ?? getLocaleProfile(ctx.locale).country, 'country', ctx.locale),
  website: (f, ctx) => makeValue(f, ctx.company?.website ?? ctx.person?.email.replace(/^[^@]+@/, 'https://www.') ?? 'https://www.example.com', 'website', ctx.locale),
  fax: (f, ctx) => {
    const locale = getLocaleProfile(ctx.locale);
    return makeValue(f, `${locale.phonePrefix}${faker.number.int({ min: 100000000, max: 199999999 })}`, 'fax', ctx.locale);
  },

  // Business
  companyName: (f, ctx) => makeValue(f, ctx.company?.name ?? faker.company.name(), 'companyName', ctx.locale),
  tradingName: (f, ctx) => makeValue(f, ctx.company?.tradingName ?? ctx.company?.name ?? faker.company.name(), 'tradingName', ctx.locale),
  businessRegistrationNumber: (f, ctx) => makeValue(f, ctx.company?.registrationNumber ?? `REG-${faker.number.int({ min: 100000, max: 999999 })}`, 'businessRegistrationNumber', ctx.locale),
  incorporationDate: (f, ctx) => makeValue(f, ctx.company?.incorporationDate ?? faker.date.past({ years: 10 }).toISOString().split('T')[0], 'incorporationDate', ctx.locale),
  businessType: (f, ctx) => makeValue(f, ctx.company?.businessType ?? 'Private Limited Company', 'businessType', ctx.locale),
  industry: (f, ctx) => makeValue(f, ctx.company?.industry ?? 'Information Technology', 'industry', ctx.locale),
  businessDescription: (f, ctx) => makeValue(f, ctx.company?.description ?? faker.company.catchPhrase(), 'businessDescription', ctx.locale),
  employeeCount: (f, ctx) => makeValue(f, ctx.company?.employeeCount ?? faker.number.int({ min: 5, max: 500 }), 'employeeCount', ctx.locale),
  department: (f, ctx) => makeValue(f, faker.commerce.department(), 'department', ctx.locale),
  designation: (f, ctx) => makeValue(f, faker.person.jobTitle(), 'designation', ctx.locale),
  ownershipPercentage: (f, ctx) => makeValue(f, faker.number.int({ min: 10, max: 100 }), 'ownershipPercentage', ctx.locale),
  licenceType: (f, ctx) => makeValue(f, ctx.company?.licenceType ?? 'Class A Operating Licence', 'licenceType', ctx.locale),
  licenceReference: (f, ctx) => makeValue(f, ctx.company?.licenceReference ?? `LIC-${faker.number.int({ min: 100000, max: 999999 })}`, 'licenceReference', ctx.locale),
  applicationReason: (f, ctx) => makeValue(f, `To ${faker.company.buzzPhrase()} and expand our ${ctx.company?.industry ?? 'technology'} business operations.`, 'applicationReason', ctx.locale),

  // Financial
  currency: (f, ctx) => makeValue(f, getLocaleProfile(ctx.locale).currencyCode, 'currency', ctx.locale),
  revenue: (f, ctx) => makeValue(f, ctx.financial?.revenue ?? faker.number.int({ min: 1000000, max: 100000000 }), 'revenue', ctx.locale),
  turnover: (f, ctx) => makeValue(f, ctx.financial?.turnover ?? faker.number.int({ min: 1000000, max: 100000000 }), 'turnover', ctx.locale),
  totalAssets: (f, ctx) => makeValue(f, ctx.financial?.totalAssets ?? faker.number.int({ min: 2000000, max: 200000000 }), 'totalAssets', ctx.locale),
  totalLiabilities: (f, ctx) => makeValue(f, ctx.financial?.totalLiabilities ?? faker.number.int({ min: 500000, max: 100000000 }), 'totalLiabilities', ctx.locale),
  shareholdersEquity: (f, ctx) => makeValue(f, ctx.financial?.shareholdersEquity ?? faker.number.int({ min: 500000, max: 100000000 }), 'shareholdersEquity', ctx.locale),
  netCapital: (f, ctx) => makeValue(f, ctx.financial?.netCapital ?? faker.number.int({ min: 500000, max: 50000000 }), 'netCapital', ctx.locale),
  income: (f, ctx) => makeValue(f, ctx.financial?.income ?? faker.number.int({ min: 1000000, max: 100000000 }), 'income', ctx.locale),
  expenses: (f, ctx) => makeValue(f, ctx.financial?.expenses ?? faker.number.int({ min: 500000, max: 80000000 }), 'expenses', ctx.locale),
  profit: (f, ctx) => makeValue(f, ctx.financial?.profitBeforeTax ?? faker.number.int({ min: 100000, max: 20000000 }), 'profit', ctx.locale),
  profitBeforeTax: (f, ctx) => makeValue(f, ctx.financial?.profitBeforeTax ?? faker.number.int({ min: 100000, max: 20000000 }), 'profitBeforeTax', ctx.locale),
  profitAfterTax: (f, ctx) => makeValue(f, ctx.financial?.profitAfterTax ?? faker.number.int({ min: 80000, max: 16000000 }), 'profitAfterTax', ctx.locale),
  taxAmount: (f, ctx) => makeValue(f, ctx.financial?.taxAmount ?? faker.number.int({ min: 20000, max: 4000000 }), 'taxAmount', ctx.locale),
  taxPercentage: (f, ctx) => makeValue(f, ctx.financial?.taxPercentage ?? 24, 'taxPercentage', ctx.locale),
  interestRate: (f, ctx) => makeValue(f, faker.number.float({ min: 1, max: 20, fractionDigits: 2 }), 'interestRate', ctx.locale),
  financialYear: (f, ctx) => makeValue(f, ctx.financial?.financialYear ?? `${new Date().getFullYear() - 1}/${new Date().getFullYear()}`, 'financialYear', ctx.locale),
  financialYearEnd: (f, ctx) => makeValue(f, ctx.financial?.financialYearEnd ?? `31/03/${new Date().getFullYear()}`, 'financialYearEnd', ctx.locale),
  reportingPeriod: (f, ctx) => makeValue(f, ctx.financial?.reportingPeriod ?? `01/04/${new Date().getFullYear() - 1} - 31/03/${new Date().getFullYear()}`, 'reportingPeriod', ctx.locale),
  annualRevenue: (f, ctx) => makeValue(f, ctx.financial?.revenue ?? faker.number.int({ min: 1000000, max: 100000000 }), 'annualRevenue', ctx.locale),
  capitalAmount: (f, ctx) => makeValue(f, ctx.financial?.netCapital ?? faker.number.int({ min: 500000, max: 50000000 }), 'capitalAmount', ctx.locale),
  bankAccount: (f, ctx) => makeValue(f, `${faker.number.int({ min: 1000, max: 9999 })} ${faker.number.int({ min: 1000, max: 9999 })} ${faker.number.int({ min: 1000, max: 9999 })} ${faker.number.int({ min: 1000, max: 9999 })}`, 'bankAccount', ctx.locale),
  iban: (f, ctx) => {
    const locale = getLocaleProfile(ctx.locale);
    return makeValue(f, `${locale.countryCode}${faker.number.int({ min: 10, max: 99 })} ${faker.number.int({ min: 1000, max: 9999 })} ${faker.number.int({ min: 1000, max: 9999 })} ${faker.number.int({ min: 1000, max: 9999 })} ${faker.number.int({ min: 1000, max: 9999 })} ${faker.number.int({ min: 10, max: 99 })}`, 'iban', ctx.locale);
  },
  swiftCode: (f, ctx) => makeValue(f, `${faker.string.alpha({ length: 4, casing: 'upper' })}${getLocaleProfile(ctx.locale).countryCode}${faker.string.alphanumeric({ length: 4, casing: 'upper' })}`, 'swiftCode', ctx.locale),

  // Technical
  uuid: (f, ctx) => makeValue(f, faker.string.uuid(), 'uuid', ctx.locale),
  ipv4: (f, ctx) => makeValue(f, faker.internet.ipv4(), 'ipv4', ctx.locale),
  ipv6: (f, ctx) => makeValue(f, faker.internet.ipv6(), 'ipv6', ctx.locale),
  macAddress: (f, ctx) => makeValue(f, faker.internet.mac(), 'macAddress', ctx.locale),
  url: (f, ctx) => makeValue(f, faker.internet.url(), 'url', ctx.locale),
  domain: (f, ctx) => makeValue(f, faker.internet.domainName(), 'domain', ctx.locale),
  username: (f, ctx) => makeValue(f, faker.internet.username(), 'username', ctx.locale),
  version: (f, ctx) => makeValue(f, `${faker.number.int({ min: 1, max: 9 })}.${faker.number.int({ min: 0, max: 99 })}.${faker.number.int({ min: 0, max: 999 })}`, 'version', ctx.locale),
  productId: (f, ctx) => makeValue(f, `PROD-${faker.string.alphanumeric({ length: 8, casing: 'upper' })}`, 'productId', ctx.locale),
  serialNumber: (f, ctx) => makeValue(f, `SN-${faker.string.alphanumeric({ length: 12, casing: 'upper' })}`, 'serialNumber', ctx.locale),
  referenceNumber: (f, ctx) => makeValue(f, `REF-${faker.number.int({ min: 100000, max: 999999 })}`, 'referenceNumber', ctx.locale),

  // Generic
  genericText: (f, ctx) => makeValue(f, faker.lorem.words(3), 'genericText', ctx.locale),
  genericNumber: (f, ctx) => {
    const { min, max } = f.constraints;
    const minNum = typeof min === 'number' ? min : 0;
    const maxNum = typeof max === 'number' ? max : 9999;
    return makeValue(f, faker.number.int({ min: minNum, max: maxNum }), 'genericNumber', ctx.locale);
  },
  genericDate: (f, ctx) => makeValue(f, faker.date.past({ years: 1 }).toISOString().split('T')[0], 'genericDate', ctx.locale),
  description: (f, ctx) => makeValue(f, faker.lorem.sentence(), 'description', ctx.locale),
  notes: (f, ctx) => makeValue(f, faker.lorem.sentences(2), 'notes', ctx.locale),
  searchQuery: (f, ctx) => makeValue(f, faker.lorem.words(2), 'searchQuery', ctx.locale),
  quantity: (f, ctx) => makeValue(f, faker.number.int({ min: 1, max: 100 }), 'quantity', ctx.locale),
  percentage: (f, ctx) => makeValue(f, faker.number.int({ min: 1, max: 100 }), 'percentage', ctx.locale),
  colorHex: (f, ctx) => makeValue(f, faker.color.rgb({ format: 'hex' }), 'colorHex', ctx.locale),
  rangeValue: (f, ctx) => {
    const minNum = Number(f.constraints.min ?? 0);
    const maxNum = Number(f.constraints.max ?? 100);
    return makeValue(f, faker.number.int({ min: minNum, max: maxNum }), 'rangeValue', ctx.locale);
  },

  // Password (only when explicitly allowed in test mode)
  password: (f, ctx) => makeValue(f, `TestPass@${faker.number.int({ min: 100, max: 999 })}`, 'password', ctx.locale),
};

export function generateValueForField(
  field: FieldDescriptor,
  context: TestDataContext
): GeneratedValue {
  const semanticType = field.semanticType;
  const rawId = semanticType.includes('.')
    ? semanticType.split('.')[1]!
    : semanticType;
  const camelId = rawId.replace(/_([a-z])/g, (_, g) => g.toUpperCase());
  const generatorId = SEMANTIC_TYPES[semanticType]?.generatorId ?? camelId;

  // Try specific generator first
  if (generators[generatorId]) {
    return generators[generatorId]!(field, context);
  }

  // Fallback by control type
  switch (field.controlType) {
    case 'email': return generators.email!(field, context);
    case 'tel': return generators.phone!(field, context);
    case 'url': return generators.website!(field, context);
    case 'number': return generators.genericNumber!(field, context);
    case 'date': return generators.genericDate!(field, context);
    case 'textarea': return generators.description!(field, context);
    case 'radio': {
      const radioVal = generateValueForRadioField(field, context);
      return radioVal ?? generators.genericText!(field, context);
    }
    default: return generators.genericText!(field, context);
  }
}

export function generateValueForRadioField(
  field: FieldDescriptor,
  context: TestDataContext
): GeneratedValue | null {
  const options = field.options ?? field.constraints.options ?? [];
  const availableOptions = options.filter(o => !o.disabled);
  if (availableOptions.length === 0) return null;

  const labelText = (field.label ?? field.fieldName ?? '').toLowerCase();
  const descText = (field.description ?? '').toLowerCase();
  const allText = `${labelText} ${descText}`;

  // Statutory, disqualification, criminal, compliance questions should default to "No"
  const isNegativeCompliance = /convict|offen[sc]e|fraud|dishonest|contraven|bankrupt|disqualif|penal|sanction|suspend|revok|refus|investig|misconduct|felony|crime|court|charge|proceeding|whether.*(director|applicant|officer)|has been|have you/i.test(allText);

  // Positive declarations, consent, agreement terms should default to "Yes"
  const isPositiveAgreement = /agree|consent|terms|declar|confirm|acknowledg|certif/i.test(allText);

  let selectedOption = availableOptions[0]!;

  if (isNegativeCompliance) {
    const noOption = availableOptions.find(o =>
      /^(no|false|0)$/i.test(o.label.trim()) ||
      /^(no|false|0)$/i.test(String(o.value).trim()) ||
      o.label.toLowerCase().includes('no')
    );
    if (noOption) selectedOption = noOption;
  } else if (isPositiveAgreement) {
    const yesOption = availableOptions.find(o =>
      /^(yes|true|1)$/i.test(o.label.trim()) ||
      /^(yes|true|1)$/i.test(String(o.value).trim()) ||
      o.label.toLowerCase().includes('yes')
    );
    if (yesOption) selectedOption = yesOption;
  } else {
    // If it looks like a standard yes/no question, prefer "No" to avoid triggering disclosure workflows
    const noOption = availableOptions.find(o =>
      /^(no|false|0)$/i.test(o.label.trim()) ||
      /^(no|false|0)$/i.test(String(o.value).trim())
    );
    if (noOption && /^(is|has|have|was|were|do|does|did|whether|can|could|would)\b/i.test(labelText)) {
      selectedOption = noOption;
    } else {
      selectedOption = availableOptions[0]!;
    }
  }

  return makeValue(field, selectedOption.value, 'radioOption', context.locale);
}

export function generateValueForSelectField(
  field: FieldDescriptor,
  context: TestDataContext
): GeneratedValue | null {
  const options = field.options ?? field.constraints.options ?? [];
  const availableOptions = options.filter(o => !o.disabled && o.value !== '' && o.value !== '--');
  if (availableOptions.length === 0) return null;

  // Try to pick a contextually relevant option
  const semantic = field.semanticType;
  let selectedOption = availableOptions[0]!;

  if (semantic.includes('country')) {
    const locale = getLocaleProfile(context.locale);
    const match = availableOptions.find(o =>
      o.label.toLowerCase().includes(locale.country.toLowerCase()) ||
      o.value.toLowerCase() === locale.countryCode.toLowerCase()
    );
    if (match) selectedOption = match;
  } else if (semantic.includes('currency')) {
    const currCode = getLocaleProfile(context.locale).currencyCode;
    const match = availableOptions.find(o => o.value === currCode || o.label.includes(currCode));
    if (match) selectedOption = match;
  } else if (semantic.includes('gender')) {
    const gender = context.person?.gender ?? 'Male';
    const match = availableOptions.find(o => o.label.toLowerCase() === gender.toLowerCase());
    if (match) selectedOption = match;
  } else {
    // Pick a random non-empty option
    selectedOption = faker.helpers.arrayElement(availableOptions);
  }

  return makeValue(field, selectedOption.value, 'selectOption', context.locale);
}

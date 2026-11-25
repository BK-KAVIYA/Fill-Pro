// ============================================================
// FILL PRO — Enhanced Fields Inspector Component
// ============================================================

import { useState } from 'react';
import {
  CheckCircle,
  AlertTriangle,
  XCircle,
  Shield,
  ChevronRight,
  List,
  Sparkles,
  BookmarkCheck,
  Eye,
  Ban,
  Loader2,
  Edit3,
} from 'lucide-react';
import {
  Badge,
  Card,
  ConfidenceIndicator,
  EmptyState,
  SectionHeader,
  cn,
} from './ui/index.js';
import { useScanStore, useExecutionStore } from '../stores/index.js';
import { SEMANTIC_TYPES } from '../constants/semanticTypes.js';
import type { ResolvedField } from '../ai/intelligenceRouter.js';
import type { SemanticCategory } from '../types/index.js';

interface FieldsInspectorProps {
  locale: string;
  scenario: string;
}

const SOURCE_BADGE: Record<string, { label: string; variant: 'success' | 'info' | 'warning' | 'default' }> = {
  user_confirmed: { label: 'Confirmed', variant: 'success' },
  knowledge_base: { label: 'KB', variant: 'info' },
  native: { label: 'Native', variant: 'default' },
  heuristic: { label: 'Local', variant: 'default' },
  ai: { label: 'AI', variant: 'info' },
  unresolved: { label: 'Unresolved', variant: 'warning' },
};

export function FieldsInspector({ locale, scenario }: FieldsInspectorProps) {
  const {
    scanResult,
    resolvedFields,
    proposedValues,
    excludedFieldIds,
    formFingerprint,
    formPurpose,
    setProposedValue,
    toggleExcludeField,
    updateFieldSemanticType,
  } = useScanStore();
  const { report } = useExecutionStore();

  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [regeneratingId, setRegeneratingId] = useState<string | null>(null);
  const [savedMappingId, setSavedMappingId] = useState<string | null>(null);

  const fields: ResolvedField[] =
    resolvedFields.length > 0
      ? resolvedFields
      : (scanResult?.fields ?? []).map(f => ({
          ...f,
          resolutionSource: f.classificationSource === 'native' ? 'native' : 'heuristic',
        }));

  const resultByFieldId = new Map(report?.fieldResults.map(r => [r.fieldId, r]) ?? []);

  const filtered = fields.filter(f => {
    const matchSearch =
      !search ||
      f.label?.toLowerCase().includes(search.toLowerCase()) ||
      f.fieldName?.toLowerCase().includes(search.toLowerCase()) ||
      f.semanticType.toLowerCase().includes(search.toLowerCase());
    const matchFilter =
      filter === 'all' ||
      (filter === 'required' && f.required) ||
      (filter === 'unresolved' && (f.resolutionSource === 'unresolved' || f.confidenceBand === 'low')) ||
      (filter === 'ai' && f.resolutionSource === 'ai') ||
      (filter === 'sensitive' && f.isSensitive) ||
      (filter === 'files' && f.controlType === 'file') ||
      (filter === 'excluded' && excludedFieldIds.includes(f.id));
    return matchSearch && matchFilter;
  });

  const statusIcon = (f: ResolvedField) => {
    if (excludedFieldIds.includes(f.id)) return <Ban className="w-3.5 h-3.5 text-white/30" />;
    if (f.isSensitive) return <Shield className="w-3.5 h-3.5 text-red-400" />;
    const execRes = resultByFieldId.get(f.id);
    if (execRes) {
      if (execRes.status === 'filled_verified' || execRes.status === 'corrected_verified') {
        return <CheckCircle className="w-3.5 h-3.5 text-green-400" />;
      }
      if (execRes.status === 'validation_failed' || execRes.status === 'error') {
        return <XCircle className="w-3.5 h-3.5 text-red-400" />;
      }
    }
    if (f.confidenceBand === 'high') return <CheckCircle className="w-3.5 h-3.5 text-green-400" />;
    if (f.confidenceBand === 'medium') return <AlertTriangle className="w-3.5 h-3.5 text-yellow-400" />;
    return <XCircle className="w-3.5 h-3.5 text-red-400" />;
  };

  const handleRegenerate = async (field: ResolvedField) => {
    setRegeneratingId(field.id);
    try {
      const res: any = await chrome.runtime.sendMessage({
        type: 'REGENERATE_FIELD',
        payload: { field, locale, scenario, formPurpose: formPurpose ?? undefined },
      });
      if (res?.success && res.value !== undefined) {
        setProposedValue(field.id, res.value);
      }
    } catch {
      // ignore
    } finally {
      setRegeneratingId(null);
    }
  };

  const handleRememberMapping = async (field: ResolvedField) => {
    if (!scanResult) return;
    try {
      await chrome.runtime.sendMessage({
        type: 'SAVE_FIELD_MAPPING',
        payload: {
          origin: scanResult.origin,
          formFingerprint: formFingerprint || '',
          field,
          semanticType: field.semanticType,
          source: 'user_confirmed',
        },
      });
      updateFieldSemanticType(field.id, field.semanticType, field.semanticCategory);
      setSavedMappingId(field.id);
      setTimeout(() => setSavedMappingId(null), 2000);
    } catch {
      // ignore
    }
  };

  const handleHighlight = async (fieldId: string) => {
    try {
      await chrome.runtime.sendMessage({
        type: 'HIGHLIGHT_FIELD',
        payload: { fieldId },
      });
    } catch {
      // ignore
    }
  };

  const semanticOptions = Object.values(SEMANTIC_TYPES).map(t => ({
    value: t.id,
    label: `${t.label} (${t.id})`,
  }));

  return (
    <div className="space-y-3">
      <SectionHeader
        title="Field Inspector"
        subtitle={`${filtered.length} of ${fields.length} fields`}
      />

      <div className="flex gap-2">
        <input
          type="text"
          placeholder="Search fields or semantic types..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 min-w-0 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-white text-xs placeholder:text-white/30 focus:outline-none focus:border-brand-indigo"
        />
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="px-2 py-1.5 rounded-lg bg-white/5 border border-white/10 text-white text-xs focus:outline-none"
        >
          <option value="all" className="bg-dark-800">All</option>
          <option value="required" className="bg-dark-800">Required</option>
          <option value="unresolved" className="bg-dark-800">Unresolved</option>
          <option value="ai" className="bg-dark-800">AI Resolved</option>
          <option value="sensitive" className="bg-dark-800">Sensitive</option>
          <option value="files" className="bg-dark-800">Files</option>
          <option value="excluded" className="bg-dark-800">Excluded</option>
        </select>
      </div>

      {fields.length === 0 ? (
        <EmptyState
          icon={<List className="w-8 h-8" />}
          title="No fields scanned"
          description="Run Smart Fill or Scan Form on the Dashboard to inspect fields."
        />
      ) : (
        <div className="space-y-1.5">
          {filtered.map(field => {
            const isExcluded = excludedFieldIds.includes(field.id);
            const proposedVal = proposedValues[field.id];
            const execRes = resultByFieldId.get(field.id);
            const srcBadge = SOURCE_BADGE[field.resolutionSource] ?? SOURCE_BADGE.heuristic;

            return (
              <div key={field.id}>
                <Card
                  className={cn(
                    'cursor-pointer transition-opacity',
                    expandedId === field.id && 'border-brand-indigo/50',
                    isExcluded && 'opacity-50'
                  )}
                  onClick={() => setExpandedId(expandedId === field.id ? null : field.id)}
                >
                  <div className="flex items-start gap-2">
                    <div className="mt-0.5 shrink-0">{statusIcon(field)}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-xs font-medium text-white truncate max-w-[160px]">
                          {field.label ?? field.fieldName ?? field.id}
                        </span>
                        {field.required && <Badge variant="error" size="sm">Req</Badge>}
                        {field.isSensitive && <Badge variant="error" size="sm">Sensitive</Badge>}
                        <Badge variant={srcBadge.variant} size="sm">{srcBadge.label}</Badge>
                      </div>
                      <div className="flex items-center gap-1.5 mt-0.5 text-[10px] text-white/40">
                        <span className="font-mono truncate">{field.semanticType}</span>
                        <span>·</span>
                        <span>{field.controlType}</span>
                      </div>
                      {proposedVal !== undefined && proposedVal !== '' && (
                        <div className="mt-1 text-[11px] text-brand-cyan/90 font-mono truncate">
                          → {String(proposedVal)}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <ConfidenceIndicator score={field.confidence} band={field.confidenceBand} showLabel={false} />
                      <ChevronRight
                        className={cn(
                          'w-3.5 h-3.5 text-white/30 transition-transform',
                          expandedId === field.id && 'rotate-90'
                        )}
                      />
                    </div>
                  </div>
                </Card>

                {expandedId === field.id && (
                  <div className="ml-2 mt-1 p-3 rounded-lg bg-white/[0.03] border border-white/10 space-y-3">
                    {/* Proposed Value Inline Edit */}
                    {!field.isSensitive && field.controlType !== 'file' && (
                      <div className="space-y-1">
                        <div className="flex items-center justify-between">
                          <label className="text-[10px] uppercase tracking-wider text-white/40 flex items-center gap-1">
                            <Edit3 className="w-3 h-3" /> Proposed Value
                          </label>
                          <button
                            type="button"
                            onClick={() => handleRegenerate(field)}
                            disabled={regeneratingId === field.id}
                            className="text-[11px] text-brand-indigo hover:text-brand-violet flex items-center gap-1"
                          >
                            {regeneratingId === field.id ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : (
                              <Sparkles className="w-3 h-3" />
                            )}
                            <span>AI Regenerate</span>
                          </button>
                        </div>
                        <input
                          type="text"
                          value={proposedVal !== undefined ? String(proposedVal) : ''}
                          onChange={(e) => setProposedValue(field.id, e.target.value)}
                          placeholder="Enter or regenerate value..."
                          className="w-full px-2.5 py-1.5 rounded-md bg-white/5 border border-white/10 text-white text-xs font-mono focus:outline-none focus:border-brand-indigo"
                        />
                      </div>
                    )}

                    {/* Semantic Type Correction */}
                    {!field.isSensitive && (
                      <div className="space-y-1">
                        <label className="text-[10px] uppercase tracking-wider text-white/40 block">
                          Semantic Type
                        </label>
                        <select
                          value={field.semanticType}
                          onChange={(e) => {
                            const newType = e.target.value;
                            const cat = (newType.split('.')[0] || 'unknown') as SemanticCategory;
                            updateFieldSemanticType(field.id, newType, cat);
                          }}
                          className="w-full px-2.5 py-1.5 rounded-md bg-white/5 border border-white/10 text-white text-xs focus:outline-none focus:border-brand-indigo"
                        >
                          {!SEMANTIC_TYPES[field.semanticType] && (
                            <option value={field.semanticType} className="bg-dark-800">
                              {field.semanticType}
                            </option>
                          )}
                          {semanticOptions.map(opt => (
                            <option key={opt.value} value={opt.value} className="bg-dark-800">
                              {opt.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}

                    {/* Validation & Metadata */}
                    <div className="grid grid-cols-2 gap-2 text-[11px]">
                      <div>
                        <span className="text-white/40">Source:</span>{' '}
                        <span className="text-white/80">{field.resolutionSource}</span>
                      </div>
                      <div>
                        <span className="text-white/40">Confidence:</span>{' '}
                        <span className="text-white/80">{Math.round(field.confidence * 100)}%</span>
                      </div>
                      {execRes && (
                        <div className="col-span-2">
                          <span className="text-white/40">Execution Status:</span>{' '}
                          <span className={execRes.status.includes('verified') ? 'text-green-400' : 'text-yellow-400'}>
                            {execRes.status} {execRes.validationMessage ? `(${execRes.validationMessage})` : ''}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Action Buttons */}
                    <div className="flex flex-wrap gap-1.5 pt-1 border-t border-white/5">
                      <button
                        type="button"
                        onClick={() => handleHighlight(field.id)}
                        className="px-2 py-1 rounded bg-white/5 hover:bg-white/10 text-[11px] text-white/70 hover:text-white flex items-center gap-1"
                      >
                        <Eye className="w-3 h-3" /> Highlight
                      </button>

                      {!field.isSensitive && (
                        <button
                          type="button"
                          onClick={() => handleRememberMapping(field)}
                          className="px-2 py-1 rounded bg-brand-indigo/15 hover:bg-brand-indigo/25 text-[11px] text-brand-indigo flex items-center gap-1"
                        >
                          <BookmarkCheck className="w-3 h-3" />
                          {savedMappingId === field.id ? 'Saved!' : 'Remember Mapping'}
                        </button>
                      )}

                      {!field.isSensitive && (
                        <button
                          type="button"
                          onClick={() => toggleExcludeField(field.id)}
                          className={cn(
                            'px-2 py-1 rounded text-[11px] flex items-center gap-1',
                            isExcluded
                              ? 'bg-yellow-500/20 text-yellow-300'
                              : 'bg-white/5 hover:bg-red-500/15 text-white/60 hover:text-red-300'
                          )}
                        >
                          <Ban className="w-3 h-3" />
                          {isExcluded ? 'Include' : 'Exclude'}
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

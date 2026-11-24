// ============================================================
// FILL PRO — UI Component Library
// ============================================================

import React from 'react';
import { clsx } from 'clsx';
import type { ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

// ---- Button ----
interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'success';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  icon?: React.ReactNode;
}

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  icon,
  children,
  className,
  disabled,
  ...props
}: ButtonProps) {
  const base = 'inline-flex items-center justify-center gap-2 font-medium rounded-lg transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 disabled:opacity-50 disabled:cursor-not-allowed';

  const variants = {
    primary: 'bg-gradient-to-r from-brand-indigo to-brand-violet text-white hover:opacity-90 shadow-brand focus-visible:ring-brand-indigo',
    secondary: 'bg-white/10 text-white border border-white/20 hover:bg-white/20 focus-visible:ring-white/30',
    ghost: 'bg-transparent text-white/70 hover:bg-white/10 hover:text-white focus-visible:ring-white/30',
    danger: 'bg-error text-white hover:bg-red-600 focus-visible:ring-error',
    success: 'bg-success text-white hover:bg-emerald-600 focus-visible:ring-success',
  };

  const sizes = {
    sm: 'px-2.5 py-1.5 text-xs',
    md: 'px-3.5 py-2 text-sm',
    lg: 'px-5 py-2.5 text-base',
  };

  return (
    <button
      className={cn(base, variants[variant], sizes[size], className)}
      disabled={disabled || loading}
      aria-busy={loading}
      {...props}
    >
      {loading ? (
        <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      ) : icon}
      {children}
    </button>
  );
}

// ---- Badge ----
interface BadgeProps {
  variant?: 'default' | 'success' | 'warning' | 'error' | 'info';
  size?: 'sm' | 'md';
  children: React.ReactNode;
  className?: string;
}

export function Badge({ variant = 'default', size = 'sm', children, className }: BadgeProps) {
  const variants = {
    default: 'bg-white/10 text-white/70 border-white/10',
    success: 'bg-success/20 text-green-400 border-success/30',
    warning: 'bg-warning/20 text-yellow-400 border-warning/30',
    error: 'bg-error/20 text-red-400 border-error/30',
    info: 'bg-brand-cyan/20 text-cyan-400 border-brand-cyan/30',
  };
  const sizes = {
    sm: 'px-1.5 py-0.5 text-xs',
    md: 'px-2 py-1 text-sm',
  };
  return (
    <span className={cn('inline-flex items-center rounded-full border font-medium', variants[variant], sizes[size], className)}>
      {children}
    </span>
  );
}

// ---- Card ----
interface CardProps {
  children: React.ReactNode;
  className?: string;
  glass?: boolean;
  onClick?: () => void;
}

export function Card({ children, className, glass = true, onClick }: CardProps) {
  return (
    <div
      className={cn(
        'rounded-xl p-3',
        glass ? 'glass' : 'bg-dark-700 border border-white/5',
        onClick && 'cursor-pointer hover:bg-white/10 transition-colors',
        className
      )}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
    >
      {children}
    </div>
  );
}

// ---- Confidence Indicator ----
interface ConfidenceProps {
  score: number;
  band: 'high' | 'medium' | 'low';
  showLabel?: boolean;
}

export function ConfidenceIndicator({ score, band, showLabel = true }: ConfidenceProps) {
  const colors = {
    high: 'bg-green-400',
    medium: 'bg-yellow-400',
    low: 'bg-red-400',
  };
  const labels = { high: 'High', medium: 'Medium', low: 'Low' };

  return (
    <div className="flex items-center gap-1.5">
      <div className="relative w-16 h-1.5 bg-white/10 rounded-full overflow-hidden">
        <div
          className={cn('absolute left-0 top-0 h-full rounded-full transition-all', colors[band])}
          style={{ width: `${score * 100}%` }}
        />
      </div>
      {showLabel && (
        <span className={cn(
          'text-xs font-medium',
          band === 'high' && 'text-green-400',
          band === 'medium' && 'text-yellow-400',
          band === 'low' && 'text-red-400',
        )}>
          {labels[band]} ({Math.round(score * 100)}%)
        </span>
      )}
    </div>
  );
}

// ---- Status Dot ----
interface StatusDotProps {
  status: 'online' | 'offline' | 'loading' | 'error';
  label?: string;
}

export function StatusDot({ status, label }: StatusDotProps) {
  const colors = {
    online: 'bg-green-400',
    offline: 'bg-gray-500',
    loading: 'bg-yellow-400 animate-pulse',
    error: 'bg-red-400',
  };
  return (
    <div className="flex items-center gap-1.5">
      <div className={cn('w-2 h-2 rounded-full', colors[status])} />
      {label && <span className="text-xs text-white/60">{label}</span>}
    </div>
  );
}

// ---- Section Header ----
interface SectionHeaderProps {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}

export function SectionHeader({ title, subtitle, action }: SectionHeaderProps) {
  return (
    <div className="flex items-start justify-between mb-3">
      <div>
        <h3 className="text-sm font-semibold text-white">{title}</h3>
        {subtitle && <p className="text-xs text-white/50 mt-0.5">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

// ---- Stat Card ----
interface StatCardProps {
  label: string;
  value: number | string;
  icon?: React.ReactNode;
  variant?: 'default' | 'success' | 'warning' | 'error';
}

export function StatCard({ label, value, icon, variant = 'default' }: StatCardProps) {
  const variants = {
    default: 'text-white',
    success: 'text-green-400',
    warning: 'text-yellow-400',
    error: 'text-red-400',
  };
  return (
    <div className="glass rounded-lg p-3 flex flex-col gap-1">
      <div className="flex items-center gap-1.5 text-white/40">
        {icon}
        <span className="text-xs">{label}</span>
      </div>
      <span className={cn('text-xl font-bold', variants[variant])}>{value}</span>
    </div>
  );
}

// ---- Progress Bar ----
interface ProgressBarProps {
  value: number; // 0-100
  label?: string;
  className?: string;
}

export function ProgressBar({ value, label, className }: ProgressBarProps) {
  const clamped = Math.min(100, Math.max(0, value));
  return (
    <div className={cn('space-y-1', className)}>
      {label && <div className="flex justify-between text-xs text-white/60"><span>{label}</span><span>{clamped}%</span></div>}
      <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-brand-indigo to-brand-violet rounded-full transition-all duration-300"
          style={{ width: `${clamped}%` }}
        />
      </div>
    </div>
  );
}

// ---- Input ----
interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
  icon?: React.ReactNode;
}

export function Input({ label, error, hint, icon, className, id, ...props }: InputProps) {
  const inputId = id ?? label?.toLowerCase().replace(/\s/g, '-');
  return (
    <div className="space-y-1">
      {label && (
        <label htmlFor={inputId} className="block text-xs font-medium text-white/70">
          {label}
        </label>
      )}
      <div className="relative">
        {icon && (
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40">
            {icon}
          </div>
        )}
        <input
          id={inputId}
          className={cn(
            'w-full rounded-lg bg-white/5 border border-white/10 text-white placeholder:text-white/30',
            'px-3 py-2 text-sm transition-colors',
            'focus:outline-none focus:border-brand-indigo focus:bg-white/10',
            'disabled:opacity-50 disabled:cursor-not-allowed',
            error && 'border-error',
            icon && 'pl-9',
            className
          )}
          {...props}
        />
      </div>
      {hint && !error && <p className="text-xs text-white/40">{hint}</p>}
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  );
}

// ---- Select ----
interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  options: Array<{ value: string; label: string }>;
}

export function Select({ label, error, options, className, id, ...props }: SelectProps) {
  const inputId = id ?? label?.toLowerCase().replace(/\s/g, '-');
  return (
    <div className="space-y-1">
      {label && (
        <label htmlFor={inputId} className="block text-xs font-medium text-white/70">
          {label}
        </label>
      )}
      <select
        id={inputId}
        className={cn(
          'w-full rounded-lg bg-white/5 border border-white/10 text-white',
          'px-3 py-2 text-sm transition-colors appearance-none',
          'focus:outline-none focus:border-brand-indigo focus:bg-white/10',
          'disabled:opacity-50 disabled:cursor-not-allowed',
          error && 'border-error',
          className
        )}
        {...props}
      >
        {options.map(opt => (
          <option key={opt.value} value={opt.value} className="bg-dark-800 text-white">
            {opt.label}
          </option>
        ))}
      </select>
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  );
}

// ---- Toggle ----
interface ToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  disabled?: boolean;
}

export function Toggle({ checked, onChange, label, disabled }: ToggleProps) {
  return (
    <label className="flex items-center gap-2 cursor-pointer select-none">
      <div
        className={cn(
          'relative w-9 h-5 rounded-full transition-colors duration-200',
          checked ? 'bg-brand-indigo' : 'bg-white/20',
          disabled && 'opacity-50 cursor-not-allowed'
        )}
        role="switch"
        aria-checked={checked}
        tabIndex={0}
        onClick={() => !disabled && onChange(!checked)}
        onKeyDown={(e) => { if ((e.key === 'Enter' || e.key === ' ') && !disabled) onChange(!checked); }}
      >
        <div
          className={cn(
            'absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform duration-200',
            checked && 'translate-x-4'
          )}
        />
      </div>
      {label && <span className="text-sm text-white/70">{label}</span>}
    </label>
  );
}

// ---- Tooltip ----
interface TooltipProps {
  content: string;
  children: React.ReactNode;
}

export function Tooltip({ content, children }: TooltipProps) {
  return (
    <div className="relative group inline-flex">
      {children}
      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-dark-700 border border-white/10 text-white text-xs rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50">
        {content}
        <div className="absolute top-full left-1/2 -translate-x-1/2 w-2 h-2 border-l border-b border-white/10 bg-dark-700 rotate-45 -mt-1" />
      </div>
    </div>
  );
}

// ---- Empty State ----
interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-10 text-center">
      {icon && <div className="text-white/20 mb-1">{icon}</div>}
      <div>
        <p className="text-sm font-medium text-white/60">{title}</p>
        {description && <p className="text-xs text-white/30 mt-1 max-w-48">{description}</p>}
      </div>
      {action}
    </div>
  );
}

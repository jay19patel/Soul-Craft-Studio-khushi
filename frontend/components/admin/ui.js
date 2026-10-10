"use client";

import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { X, Loader2, CheckCircle2, AlertTriangle, Inbox } from 'lucide-react';

// ── Toasts ──

const ToastContext = createContext({ toast: () => {} });

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const toast = useCallback((message, type = 'success') => {
    const id = Math.random().toString(36).slice(2);
    setToasts((t) => [...t, { id, message, type }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), type === 'error' ? 6000 : 3500);
  }, []);
  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className="fixed z-[200] bottom-20 md:bottom-6 left-1/2 -translate-x-1/2 md:left-auto md:right-6 md:translate-x-0 flex flex-col gap-2 w-[calc(100%-2rem)] max-w-sm pointer-events-none">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`pointer-events-auto flex items-start gap-3 rounded-2xl px-4 py-3 shadow-2xl text-sm font-semibold ${t.type === 'error' ? 'bg-red-600 text-white' : 'bg-slate-900 text-white'}`}
          >
            {t.type === 'error' ? <AlertTriangle className="w-5 h-5 shrink-0" /> : <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-400" />}
            <span>{t.message}</span>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext).toast;

// ── Layout pieces ──

export function PageHeader({ title, subtitle, actions }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 mb-5 md:mb-8">
      <div className="min-w-0">
        <h1 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight">{title}</h1>
        {subtitle && <p className="text-sm text-slate-500 mt-1">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2 shrink-0">{actions}</div>}
    </div>
  );
}

export function Card({ children, className = '', title, actions, padded = true }) {
  return (
    <section className={`bg-white rounded-2xl md:rounded-3xl border border-slate-200/70 shadow-sm ${className}`}>
      {(title || actions) && (
        <div className="flex items-center justify-between gap-3 px-4 md:px-6 pt-4 md:pt-5">
          {title && <h2 className="text-sm font-black uppercase tracking-wider text-slate-700">{title}</h2>}
          {actions}
        </div>
      )}
      <div className={padded ? 'p-4 md:p-6' : ''}>{children}</div>
    </section>
  );
}

const BUTTON_VARIANTS = {
  primary: 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm',
  secondary: 'bg-white hover:bg-slate-50 text-slate-700 border border-slate-200',
  danger: 'bg-red-600 hover:bg-red-700 text-white',
  ghost: 'text-slate-600 hover:bg-slate-100',
  success: 'bg-emerald-600 hover:bg-emerald-700 text-white',
};

export function Button({ variant = 'primary', loading = false, className = '', children, size = 'md', ...props }) {
  const sizes = { sm: 'px-3 py-2 text-xs', md: 'px-4 py-2.5 text-sm', lg: 'px-5 py-3.5 text-sm' };
  return (
    <button
      {...props}
      disabled={loading || props.disabled}
      className={`inline-flex items-center justify-center gap-2 rounded-xl font-bold transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed ${sizes[size]} ${BUTTON_VARIANTS[variant]} ${className}`}
    >
      {loading && <Loader2 className="w-4 h-4 animate-spin" />}
      {children}
    </button>
  );
}

export const inputClass =
  'w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all disabled:bg-slate-50';

export function Field({ label, hint, children, className = '' }) {
  return (
    <label className={`flex flex-col gap-1.5 ${className}`}>
      {label && <span className="text-xs font-bold text-slate-600">{label}</span>}
      {children}
      {hint && <span className="text-[11px] text-slate-400 leading-snug">{hint}</span>}
    </label>
  );
}

export function Toggle({ checked, onChange, label, description, disabled = false }) {
  return (
    <label className={`flex items-start justify-between gap-4 py-2 ${disabled ? 'opacity-50' : 'cursor-pointer'}`}>
      <span className="flex flex-col">
        <span className="text-sm font-semibold text-slate-800">{label}</span>
        {description && <span className="text-xs text-slate-500 mt-0.5 leading-snug">{description}</span>}
      </span>
      <span className="relative shrink-0 mt-0.5">
        <input type="checkbox" className="sr-only peer" checked={!!checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
        <span className="block w-11 h-6 rounded-full bg-slate-200 peer-checked:bg-emerald-500 transition-colors" />
        <span className="absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform peer-checked:translate-x-5" />
      </span>
    </label>
  );
}

/** Inline switch without label (for table rows). */
export function Switch({ checked, onChange, disabled = false, title }) {
  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative w-10 h-6 rounded-full transition-colors shrink-0 disabled:opacity-50 ${checked ? 'bg-emerald-500' : 'bg-slate-300'}`}
      aria-pressed={!!checked}
    >
      <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-4' : ''}`} />
    </button>
  );
}

const PILL_TONES = {
  slate: 'bg-slate-100 text-slate-600',
  green: 'bg-emerald-50 text-emerald-700',
  red: 'bg-red-50 text-red-600',
  amber: 'bg-amber-50 text-amber-700',
  blue: 'bg-blue-50 text-blue-700',
  indigo: 'bg-indigo-50 text-indigo-700',
  violet: 'bg-violet-50 text-violet-700',
};

export function Pill({ tone = 'slate', children, className = '' }) {
  return <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold whitespace-nowrap ${PILL_TONES[tone]} ${className}`}>{children}</span>;
}

export function EmptyState({ title = 'Nothing here yet', text, action }) {
  return (
    <div className="flex flex-col items-center justify-center text-center gap-3 py-14 px-4">
      <Inbox className="w-10 h-10 text-slate-300" />
      <p className="font-bold text-slate-700">{title}</p>
      {text && <p className="text-sm text-slate-500 max-w-sm">{text}</p>}
      {action}
    </div>
  );
}

export function Spinner({ className = '' }) {
  return (
    <div className={`flex items-center justify-center py-16 ${className}`}>
      <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
    </div>
  );
}

/** Centered dialog on desktop, bottom sheet on phones. */
export function Modal({ open, onClose, title, children, footer, size = 'md' }) {
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e) => e.key === 'Escape' && onClose?.();
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);

  if (!open) return null;
  const widths = { sm: 'md:max-w-md', md: 'md:max-w-xl', lg: 'md:max-w-3xl' };
  return (
    <div className="fixed inset-0 z-[150] flex items-end md:items-center justify-center">
      <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={onClose} />
      <div className={`relative w-full ${widths[size]} bg-white rounded-t-3xl md:rounded-3xl shadow-2xl flex flex-col max-h-[92dvh]`}>
        <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-slate-100">
          <h3 className="font-black text-slate-900">{title}</h3>
          <button onClick={onClose} className="p-2 -mr-2 rounded-full hover:bg-slate-100 text-slate-400" aria-label="Close">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="overflow-y-auto px-5 py-5 flex-1">{children}</div>
        {footer && <div className="px-5 py-4 border-t border-slate-100 flex gap-2 justify-end pb-safe">{footer}</div>}
      </div>
    </div>
  );
}

export function Pagination({ page, pageSize, total, onChange }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (pages <= 1) return null;
  return (
    <div className="flex items-center justify-between gap-3 pt-4">
      <span className="text-xs text-slate-500">
        {(page - 1) * pageSize + 1}–{Math.min(total, page * pageSize)} of {total}
      </span>
      <div className="flex gap-2">
        <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => onChange(page - 1)}>Prev</Button>
        <Button variant="secondary" size="sm" disabled={page >= pages} onClick={() => onChange(page + 1)}>Next</Button>
      </div>
    </div>
  );
}

export const formatDateTime = (d) => (d ? new Date(d).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : '—');
export const formatMoney = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`;

export function timeAgo(d) {
  if (!d) return '';
  const s = Math.floor((Date.now() - new Date(d).getTime()) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  if (s < 86400 * 7) return `${Math.floor(s / 86400)}d ago`;
  return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

import React from 'react';

interface EmptyStateProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
}

export default function EmptyState({ icon, title, description, actionLabel, onAction }: EmptyStateProps) {
  return (
    <div className="flex min-h-[220px] flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 px-6 py-10 text-center">
      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-slate-300 shadow-sm">{icon}</div>
      <h3 className="text-sm font-extrabold text-slate-700">{title}</h3>
      <p className="mt-1.5 max-w-md text-xs leading-relaxed text-slate-500">{description}</p>
      {actionLabel && onAction && (
        <button type="button" onClick={onAction} className="mt-4 rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-bold text-white shadow-sm shadow-blue-500/20 transition hover:bg-blue-700 active:scale-95">
          {actionLabel}
        </button>
      )}
    </div>
  );
}

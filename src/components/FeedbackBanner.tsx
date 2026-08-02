import React from 'react';
import { CheckCircle2, Info, X, XCircle } from 'lucide-react';

interface FeedbackBannerProps {
  message: string;
  tone?: 'success' | 'error' | 'info';
  onDismiss?: () => void;
}

export default function FeedbackBanner({ message, tone = 'info', onDismiss }: FeedbackBannerProps) {
  const styles = {
    success: 'border-emerald-200 bg-emerald-50 text-emerald-800',
    error: 'border-rose-200 bg-rose-50 text-rose-800',
    info: 'border-blue-200 bg-blue-50 text-blue-800',
  }[tone];
  const Icon = tone === 'success' ? CheckCircle2 : tone === 'error' ? XCircle : Info;

  return (
    <div
      role={tone === 'error' ? 'alert' : 'status'}
      aria-live={tone === 'error' ? 'assertive' : 'polite'}
      className={`flex items-start gap-2 rounded-xl border px-3 py-2.5 text-xs font-semibold shadow-lg ${styles}`}
    >
      <Icon size={15} className="mt-0.5 shrink-0" />
      <span className="min-w-0 flex-1 leading-relaxed">{message}</span>
      {onDismiss && (
        <button type="button" aria-label="关闭提示" onClick={onDismiss} className="shrink-0 rounded-md p-0.5 opacity-70 hover:bg-black/5 hover:opacity-100">
          <X size={14} />
        </button>
      )}
    </div>
  );
}

import React from 'react';
import { ORDER_STATUS_META, PAYMENT_STATUS_META, TONE_CLASSES } from '../lib/constants';

export function StatusBadge({ status, className = '' }) {
  const meta = ORDER_STATUS_META[status] || { label: status, tone: 'slate' };
  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-full border text-[10px] font-black uppercase tracking-widest whitespace-nowrap ${TONE_CLASSES[meta.tone]} ${className}`}>
      {meta.label}
    </span>
  );
}

export function PaymentBadge({ status, method, className = '' }) {
  let meta = PAYMENT_STATUS_META[status] || { label: status, tone: 'slate' };
  if (method === 'COD' && status === 'PENDING') meta = { label: 'Pay on delivery', tone: 'slate' };
  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-full border text-[10px] font-black uppercase tracking-widest whitespace-nowrap ${TONE_CLASSES[meta.tone]} ${className}`}>
      {meta.label}
    </span>
  );
}

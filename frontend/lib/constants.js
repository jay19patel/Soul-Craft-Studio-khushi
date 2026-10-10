export const INDIAN_STATES = [
  'Andaman and Nicobar Islands', 'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chandigarh',
  'Chhattisgarh', 'Dadra and Nagar Haveli and Daman and Diu', 'Delhi', 'Goa', 'Gujarat', 'Haryana',
  'Himachal Pradesh', 'Jammu and Kashmir', 'Jharkhand', 'Karnataka', 'Kerala', 'Ladakh', 'Lakshadweep',
  'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram', 'Nagaland', 'Odisha', 'Puducherry',
  'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand',
  'West Bengal',
];

export const ORDER_STATUS_META = {
  PENDING: { label: 'Order placed', tone: 'amber' },
  CONFIRMED: { label: 'Confirmed', tone: 'blue' },
  PROCESSING: { label: 'Being crafted', tone: 'indigo' },
  SHIPPED: { label: 'Shipped', tone: 'violet' },
  DELIVERED: { label: 'Delivered', tone: 'emerald' },
  CANCELLED: { label: 'Cancelled', tone: 'red' },
};

export const PAYMENT_STATUS_META = {
  PENDING: { label: 'Awaiting payment', tone: 'amber' },
  RECEIVED: { label: 'Verifying payment', tone: 'blue' },
  VERIFIED: { label: 'Paid', tone: 'emerald' },
  FAILED: { label: 'Payment failed', tone: 'red' },
  REFUNDED: { label: 'Refunded', tone: 'slate' },
};

export const PAYMENT_METHOD_LABEL = {
  UPI: 'UPI (manual)',
  COD: 'Cash on delivery',
};

export const TONE_CLASSES = {
  amber: 'bg-amber-50 text-amber-700 border-amber-200',
  blue: 'bg-blue-50 text-blue-700 border-blue-200',
  indigo: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  violet: 'bg-violet-50 text-violet-700 border-violet-200',
  emerald: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  red: 'bg-red-50 text-red-600 border-red-200',
  slate: 'bg-slate-100 text-slate-600 border-slate-200',
};

/** Safe in-app redirect target (blocks //evil.com and absolute URLs). */
export function safeRedirect(path, fallback = '/') {
  const p = String(path || '');
  return p.startsWith('/') && !p.startsWith('//') && !p.startsWith('/\\') ? p : fallback;
}

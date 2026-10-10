"use client";

import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { Copy, Check, Smartphone } from 'lucide-react';

/**
 * Dynamic UPI QR for the exact order amount. Any UPI app (GPay, PhonePe,
 * Paytm, BHIM) can scan it; on phones the button opens the UPI app directly.
 */
export default function UpiQrPayment({ upiId, payeeName, amount, note }) {
  const [qr, setQr] = useState(null);
  const [copied, setCopied] = useState(false);

  const params = new URLSearchParams({ pa: upiId, pn: payeeName || 'Store', am: Number(amount).toFixed(2), cu: 'INR' });
  if (note) params.set('tn', note.slice(0, 50));
  const upiLink = `upi://pay?${params.toString()}`;

  useEffect(() => {
    let cancelled = false;
    QRCode.toDataURL(upiLink, { width: 480, margin: 1, errorCorrectionLevel: 'M' })
      .then((url) => !cancelled && setQr(url))
      .catch(() => !cancelled && setQr(null));
    return () => {
      cancelled = true;
    };
  }, [upiLink]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(upiId);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {}
  };

  return (
    <div className="flex flex-col items-center gap-4 text-center">
      <div className="w-56 h-56 bg-white rounded-3xl shadow-md border border-slate-200 p-3 flex items-center justify-center">
        {qr ? <img src={qr} alt={`UPI QR to pay ₹${amount}`} className="w-full h-full" /> : <div className="w-full h-full animate-pulse bg-slate-100 rounded-2xl" />}
      </div>
      <div className="flex flex-col gap-1">
        <span className="text-2xl font-black text-blue-950">₹{Number(amount).toLocaleString('en-IN')}</span>
        <span className="text-xs text-slate-500">Scan with GPay, PhonePe, Paytm or any UPI app</span>
      </div>
      <a
        href={upiLink}
        className="md:hidden w-full inline-flex items-center justify-center gap-2 py-3.5 rounded-full bg-blue-950 text-white text-sm font-black uppercase tracking-widest"
      >
        <Smartphone className="w-4 h-4" /> Pay in UPI app
      </a>
      <button type="button" onClick={copy} className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-slate-100 text-xs font-bold text-slate-600">
        {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
        {upiId}
      </button>
    </div>
  );
}

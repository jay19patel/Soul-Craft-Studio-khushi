"use client";

import React, { Suspense, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Search, Send, AlertTriangle } from 'lucide-react';
import { getAdminEmailLogs, resendAdminEmail, sendAdminTestEmail } from '../../../lib/api';
import { Card, PageHeader, Spinner, EmptyState, Pill, Button, Pagination, inputClass, useToast, formatDateTime } from '../../../components/admin/ui';

const PAGE_SIZE = 25;
const STATUS = {
  SENT: { tone: 'green', label: 'Sent' },
  FAILED: { tone: 'red', label: 'Failed' },
  SIMULATED: { tone: 'amber', label: 'Not sent (no SMTP)' },
  SKIPPED: { tone: 'slate', label: 'Skipped (disabled)' },
};

function EmailLog() {
  const toast = useToast();
  const params = useSearchParams();
  const [status, setStatus] = useState(params.get('status') || '');
  const [type, setType] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [data, setData] = useState(null);
  const [openId, setOpenId] = useState(null);
  const [busy, setBusy] = useState('');

  const load = useCallback(async () => {
    try {
      setData(await getAdminEmailLogs({ status, type, search, page, page_size: PAGE_SIZE }));
    } catch (err) {
      toast(err.message, 'error');
    }
  }, [status, type, search, page, toast]);

  useEffect(() => {
    const t = setTimeout(load, search ? 350 : 0);
    return () => clearTimeout(t);
  }, [load, search]);

  const resend = async (log) => {
    setBusy(log.id);
    try {
      await resendAdminEmail(log.id);
      toast('Email sent');
      load();
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setBusy('');
    }
  };

  const test = async () => {
    const to = window.prompt('Send a test email to:');
    if (!to) return;
    setBusy('test');
    try {
      const r = await sendAdminTestEmail(to);
      toast(r.status === 'SENT' ? 'Test email sent — check the inbox' : `Not sent: ${r.error || r.status}`, r.status === 'SENT' ? 'success' : 'error');
      load();
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setBusy('');
    }
  };

  if (!data) return <Spinner />;
  const counts = data.counts || {};

  return (
    <>
      <PageHeader
        title="Email log"
        subtitle="Every email the store tried to send, and what happened"
        actions={<Button variant="secondary" onClick={test} loading={busy === 'test'}><Send className="w-4 h-4" /> Send test email</Button>}
      />

      {!data.smtp_configured && (
        <div className="mb-4 rounded-2xl bg-amber-50 border border-amber-200 p-4 text-sm text-amber-900 flex gap-3">
          <AlertTriangle className="w-5 h-5 shrink-0" />
          <span>SMTP is not configured, so emails are only logged (status “Not sent”). Add SMTP_HOST, SMTP_USER, SMTP_PASS (e.g. a Gmail App Password) in your hosting environment. Turn individual emails on/off in <Link href="/admin/settings" className="underline font-bold">Settings → Notifications</Link>.</span>
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
        {Object.entries(STATUS).map(([k, v]) => (
          <button key={k} onClick={() => { setStatus(status === k ? '' : k); setPage(1); }} className={`rounded-2xl border p-3 text-left ${status === k ? 'border-slate-900 bg-white shadow' : 'border-slate-200 bg-white'}`}>
            <p className="text-xl font-black text-slate-900">{counts[k] || 0}</p>
            <p className="text-xs font-semibold text-slate-500">{v.label}</p>
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-4">
        <div className="relative sm:col-span-2">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Search recipient or subject" className={`${inputClass} pl-9`} />
        </div>
        <select value={type} onChange={(e) => { setType(e.target.value); setPage(1); }} className={inputClass}>
          <option value="">All email types</option>
          {data.types.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
        </select>
      </div>

      <Card padded={false}>
        {data.results.length === 0 ? <EmptyState title="No emails" /> : (
          <ul className="divide-y divide-slate-100">
            {data.results.map((log) => (
              <li key={log.id} className="px-4 md:px-6 py-3">
                <div className="flex items-start gap-3">
                  <button onClick={() => setOpenId(openId === log.id ? null : log.id)} className="flex-1 min-w-0 text-left">
                    <p className="text-sm font-semibold text-slate-900 truncate">{log.subject}</p>
                    <p className="text-xs text-slate-500 truncate">{log.type_label} → {log.to_email}</p>
                    <p className="text-[11px] text-slate-400">{formatDateTime(log.sent_at || log.failed_at || log.queued_at)}{log.attempts > 1 ? ` · ${log.attempts} attempts` : ''}{log.attachment_name ? ' · 📎 invoice' : ''}</p>
                  </button>
                  <div className="flex flex-col items-end gap-1.5 shrink-0">
                    <Pill tone={STATUS[log.status]?.tone || 'slate'}>{STATUS[log.status]?.label || log.status}</Pill>
                    {log.status !== 'SENT' && (
                      <button onClick={() => resend(log)} disabled={busy === log.id} className="text-[11px] font-bold text-indigo-600 disabled:opacity-50">
                        {busy === log.id ? 'Sending…' : 'Send now'}
                      </button>
                    )}
                  </div>
                </div>
                {openId === log.id && (
                  <div className="mt-2 text-xs bg-slate-50 rounded-xl p-3 text-slate-600 flex flex-col gap-1">
                    {log.error_message && <p className="text-red-600 font-semibold">{log.error_message}</p>}
                    <p className="whitespace-pre-wrap">{log.body_text}</p>
                    {log.order_id && <Link href={`/admin/orders/${log.order_id}`} className="text-indigo-600 font-bold">Open order →</Link>}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
        <div className="px-4 md:px-6 pb-4">
          <Pagination page={page} pageSize={PAGE_SIZE} total={data.total} onChange={setPage} />
        </div>
      </Card>
    </>
  );
}

export default function AdminEmailsPage() {
  return (
    <Suspense fallback={<Spinner />}>
      <EmailLog />
    </Suspense>
  );
}

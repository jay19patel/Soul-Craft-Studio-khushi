"use client";

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import {
  ChevronLeft, Download, Phone, MessageCircle, Copy, AlertTriangle, Image as ImageIcon, Trash2, Send, CheckCircle2, XCircle,
} from 'lucide-react';
import {
  getAdminOrder, updateAdminOrderStatus, updateAdminPaymentStatus, updateAdminOrderNote,
  resolveAdminOrderAttention, deleteAdminOrder, resendAdminEmail,
} from '../../../../lib/api';
import {
  Card, Button, Field, Modal, Pill, Spinner, inputClass, useToast, formatMoney, formatDateTime,
} from '../../../../components/admin/ui';
import { StatusBadge, PaymentBadge } from '../../../../components/OrderStatusBadges';
import { PAYMENT_METHOD_LABEL } from '../../../../lib/constants';

const NEXT_ACTIONS = {
  PENDING: [{ status: 'CONFIRMED', label: 'Confirm order' }],
  CONFIRMED: [{ status: 'PROCESSING', label: 'Start crafting' }, { status: 'SHIPPED', label: 'Mark shipped' }],
  PROCESSING: [{ status: 'SHIPPED', label: 'Mark shipped' }],
  SHIPPED: [{ status: 'DELIVERED', label: 'Mark delivered' }],
  DELIVERED: [],
  CANCELLED: [],
};

const EMAIL_TONE = { SENT: 'green', FAILED: 'red', SIMULATED: 'amber', SKIPPED: 'slate' };

export default function AdminOrderDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const toast = useToast();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');
  const [notify, setNotify] = useState(true);
  const [shipOpen, setShipOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [tracking, setTracking] = useState({ courier: '', tracking_number: '', tracking_url: '' });
  const [cancelReason, setCancelReason] = useState('');
  const [adminNote, setAdminNote] = useState('');

  const load = useCallback(async () => {
    try {
      const d = await getAdminOrder(id);
      setData(d);
      setAdminNote(d.order.admin_note || '');
      setTracking({
        courier: d.order.tracking?.courier || '',
        tracking_number: d.order.tracking?.tracking_number || '',
        tracking_url: d.order.tracking?.tracking_url || '',
      });
      setError('');
    } catch (err) {
      setError(err.message);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const run = async (key, fn, successMsg) => {
    setBusy(key);
    try {
      await fn();
      if (successMsg) toast(successMsg);
      await load();
      return true;
    } catch (err) {
      toast(err.message, 'error');
      return false;
    } finally {
      setBusy('');
    }
  };

  if (error) {
    return (
      <div className="flex flex-col items-center gap-4 py-20 text-center">
        <p className="text-slate-600">{error}</p>
        <Link href="/admin/orders" className="text-indigo-600 font-bold text-sm">Back to orders</Link>
      </div>
    );
  }
  if (!data) return <Spinner />;

  const { order, emails, activity } = data;
  const actions = NEXT_ACTIONS[order.status] || [];
  const isCancelled = order.status === 'CANCELLED';
  const phone = order.customer_phone;

  const setStatus = (status, extra = {}) =>
    run(`status-${status}`, () => updateAdminOrderStatus(order.id, { status, notify, ...extra }), `Order marked ${status.toLowerCase()}`);

  const setPayment = (payment_status, note) =>
    run(`pay-${payment_status}`, () => updateAdminPaymentStatus(order.id, { payment_status, notify, note }), `Payment marked ${payment_status.toLowerCase()}`);

  const copy = (text) => navigator.clipboard?.writeText(text).then(() => toast('Copied'));

  return (
    <>
      <button onClick={() => router.back()} className="inline-flex items-center gap-1 text-sm font-semibold text-slate-500 hover:text-slate-900 mb-4">
        <ChevronLeft className="w-4 h-4" /> Orders
      </button>

      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3 mb-5">
        <div>
          <h1 className="text-2xl md:text-3xl font-black text-slate-900">{order.order_number}</h1>
          <p className="text-sm text-slate-500">{formatDateTime(order.created_at)} · {PAYMENT_METHOD_LABEL[order.payment_method]}</p>
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          <StatusBadge status={order.status} />
          <PaymentBadge status={order.payment_status} method={order.payment_method} />
          <a href={`/orders/${order.id}/invoice`} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs font-bold text-slate-700">
            <Download className="w-4 h-4" /> Invoice
          </a>
        </div>
      </div>

      {order.needs_attention && (
        <div className="mb-5 rounded-2xl bg-red-50 border border-red-200 p-4 flex flex-col sm:flex-row sm:items-center gap-3">
          <AlertTriangle className="w-6 h-6 text-red-600 shrink-0" />
          <p className="flex-1 text-sm font-semibold text-red-800">{order.needs_attention}</p>
          <Button variant="secondary" size="sm" loading={busy === 'resolve'} onClick={() => run('resolve', () => resolveAdminOrderAttention(order.id), 'Marked as resolved')}>
            Mark resolved
          </Button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 flex flex-col gap-5">
          {/* Fulfilment */}
          <Card title="Order status">
            {isCancelled ? (
              <p className="text-sm text-slate-600">
                Cancelled on {formatDateTime(order.cancelled_at)} — <strong>{order.cancel_reason}</strong>.
                {order.payment_status === 'VERIFIED' && ' This order was paid: refund the customer from your UPI app, then mark the payment as refunded below.'}
              </p>
            ) : (
              <div className="flex flex-col gap-4">
                <div className="flex flex-wrap gap-2">
                  {actions.map((a) =>
                    a.status === 'SHIPPED' ? (
                      <Button key={a.status} onClick={() => setShipOpen(true)}>{a.label}</Button>
                    ) : (
                      <Button key={a.status} loading={busy === `status-${a.status}`} onClick={() => setStatus(a.status)}>
                        {a.label}
                      </Button>
                    )
                  )}
                  {order.status === 'SHIPPED' && (
                    <Button variant="secondary" onClick={() => setShipOpen(true)}>Edit tracking</Button>
                  )}
                  {order.status !== 'DELIVERED' && (
                    <Button variant="secondary" className="!text-red-600" onClick={() => setCancelOpen(true)}>Cancel order</Button>
                  )}
                </div>
                {order.status !== 'PENDING' && order.payment_method !== 'COD' && order.payment_status !== 'VERIFIED' && (
                  <p className="text-xs text-amber-700 bg-amber-50 rounded-xl px-3 py-2">⚠ Payment for this order is not verified yet.</p>
                )}
                <label className="flex items-center gap-2 text-sm text-slate-600">
                  <input type="checkbox" checked={notify} onChange={(e) => setNotify(e.target.checked)} className="w-4 h-4 accent-indigo-600" />
                  Email the customer about changes
                </label>
              </div>
            )}
            {order.tracking && (order.tracking.courier || order.tracking.tracking_number) && (
              <div className="mt-4 text-sm bg-violet-50 rounded-xl px-4 py-3 text-violet-900">
                <strong>{order.tracking.courier}</strong> {order.tracking.tracking_number}
                {order.tracking.tracking_url && (
                  <a href={order.tracking.tracking_url} target="_blank" rel="noopener noreferrer" className="block text-xs underline mt-1 break-all">{order.tracking.tracking_url}</a>
                )}
              </div>
            )}
          </Card>

          {/* Items */}
          <Card title={`Items (${order.items.length})`}>
            <ul className="flex flex-col gap-3">
              {order.items.map((item) => (
                <li key={item.id} className="flex items-center gap-3">
                  <div className="w-14 h-14 rounded-xl bg-slate-100 overflow-hidden shrink-0">
                    {item.image && <img src={item.image} alt="" className="w-full h-full object-cover" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    {item.product_id ? (
                      <Link href={`/admin/products/${item.product_id}`} className="text-sm font-bold text-slate-900 hover:text-indigo-600 line-clamp-2">{item.name}</Link>
                    ) : (
                      <p className="text-sm font-bold text-slate-900">{item.name}</p>
                    )}
                    <p className="text-xs text-slate-500">{item.quantity} × {formatMoney(item.price)}</p>
                  </div>
                  <span className="text-sm font-black">{formatMoney(item.line_total)}</span>
                </li>
              ))}
            </ul>
            <div className="border-t border-slate-100 mt-4 pt-3 text-sm flex flex-col gap-1.5">
              <Row label="Subtotal" value={formatMoney(order.subtotal)} />
              <Row label="Shipping" value={order.shipping_fee ? formatMoney(order.shipping_fee) : 'Free'} />
              {order.cod_fee > 0 && <Row label="COD charge" value={formatMoney(order.cod_fee)} />}
              <Row label={<strong>Total</strong>} value={<strong className="text-base">{formatMoney(order.total_amount)}</strong>} />
            </div>
          </Card>

          {/* Timeline */}
          <Card title="Timeline">
            <ol className="flex flex-col gap-3">
              {[...(order.timeline || [])].reverse().map((t, i) => (
                <li key={i} className="flex gap-3 text-sm">
                  <span className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${t.type === 'payment' ? 'bg-emerald-500' : t.type === 'note' ? 'bg-slate-400' : 'bg-indigo-500'}`} />
                  <div>
                    <p className="font-semibold text-slate-800">{t.label}</p>
                    <p className="text-xs text-slate-400">{formatDateTime(t.at)}{t.by ? ` · ${t.by}` : ''}</p>
                  </div>
                </li>
              ))}
              {!order.timeline?.length && <li className="text-sm text-slate-500">No history recorded for this (older) order.</li>}
            </ol>
          </Card>

          {/* Emails */}
          <Card title="Emails for this order" padded={false}>
            <ul className="divide-y divide-slate-100">
              {emails.map((e) => (
                <li key={e.id} className="px-4 md:px-6 py-3 flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-800 truncate">{e.subject}</p>
                    <p className="text-xs text-slate-400 truncate">{e.type_label} → {e.to_email} · {formatDateTime(e.sent_at || e.failed_at || e.queued_at)}</p>
                    {e.error_message && e.status !== 'SENT' && <p className="text-xs text-red-500 mt-0.5">{e.error_message}</p>}
                  </div>
                  <div className="flex flex-col items-end gap-1.5">
                    <Pill tone={EMAIL_TONE[e.status]}>{e.status}</Pill>
                    {e.status !== 'SENT' && (
                      <button
                        onClick={() => run(`email-${e.id}`, () => resendAdminEmail(e.id), 'Email sent')}
                        disabled={busy === `email-${e.id}`}
                        className="text-[11px] font-bold text-indigo-600 inline-flex items-center gap-1 disabled:opacity-50"
                      >
                        <Send className="w-3 h-3" /> {busy === `email-${e.id}` ? 'Sending…' : 'Send now'}
                      </button>
                    )}
                  </div>
                </li>
              ))}
              {!emails.length && <li className="px-6 py-6 text-sm text-slate-500">No emails logged for this order.</li>}
            </ul>
          </Card>
        </div>

        <div className="flex flex-col gap-5">
          {/* Payment */}
          <Card title="Payment">
            <div className="flex flex-col gap-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-slate-500">{PAYMENT_METHOD_LABEL[order.payment_method]}</span>
                <PaymentBadge status={order.payment_status} method={order.payment_method} />
              </div>
              {order.upi_transaction_id && (
                <div className="bg-slate-50 rounded-xl px-3 py-2.5">
                  <p className="text-[11px] font-bold text-slate-400 uppercase">UTR / UPI reference</p>
                  <button onClick={() => copy(order.upi_transaction_id)} className="font-mono font-bold text-slate-900 inline-flex items-center gap-2 break-all">
                    {order.upi_transaction_id} <Copy className="w-3.5 h-3.5 text-slate-400" />
                  </button>
                  <p className="text-[11px] text-slate-500 mt-1">Match this UTR and {formatMoney(order.total_amount)} in your UPI app / bank statement before verifying.</p>
                </div>
              )}
              {order.screenshot_id && (
                <a href={order.screenshot_id} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 text-indigo-600 font-bold text-xs">
                  <ImageIcon className="w-4 h-4" /> View payment screenshot
                </a>
              )}
              {order.payment_verified_at && <p className="text-xs text-slate-500">Verified {formatDateTime(order.payment_verified_at)}</p>}

              <div className="flex flex-wrap gap-2 pt-1">
                {!isCancelled && order.payment_status !== 'VERIFIED' && order.payment_status !== 'REFUNDED' && (
                  <Button variant="success" size="sm" loading={busy === 'pay-VERIFIED'} onClick={() => setPayment('VERIFIED')}>
                    <CheckCircle2 className="w-4 h-4" /> {order.payment_method === 'COD' ? 'Mark cash received' : 'Verify payment'}
                  </Button>
                )}
                {!isCancelled && order.payment_method === 'UPI' && ['RECEIVED', 'PENDING'].includes(order.payment_status) && (
                  <Button variant="secondary" size="sm" loading={busy === 'pay-FAILED'} onClick={() => window.confirm('Mark this payment as not received? The customer will be emailed.') && setPayment('FAILED', 'UTR not found')}>
                    <XCircle className="w-4 h-4" /> Not received
                  </Button>
                )}
                {order.payment_status === 'VERIFIED' && (
                  <Button variant="secondary" size="sm" loading={busy === 'pay-REFUNDED'} onClick={() => window.confirm('Only do this after you have actually refunded the money. Continue?') && setPayment('REFUNDED')}>
                    Mark refunded
                  </Button>
                )}
              </div>
            </div>
          </Card>

          {/* Customer */}
          <Card title="Customer">
            <div className="flex flex-col gap-2 text-sm">
              <p className="font-bold text-slate-900">{order.customer_name}</p>
              <a href={`mailto:${order.customer_email}`} className="text-indigo-600 break-all">{order.customer_email}</a>
              {phone && (
                <div className="flex gap-2">
                  <a href={`tel:+91${phone}`} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 text-xs font-bold"><Phone className="w-3.5 h-3.5" /> {phone}</a>
                  <a href={`https://wa.me/91${phone}?text=${encodeURIComponent(`Hi ${order.customer_name}, regarding your order ${order.order_number}`)}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-50 text-emerald-700 text-xs font-bold">
                    <MessageCircle className="w-3.5 h-3.5" /> WhatsApp
                  </a>
                </div>
              )}
              <div className="mt-2 bg-slate-50 rounded-xl px-3 py-2.5">
                <p className="text-[11px] font-bold text-slate-400 uppercase mb-1">Ship to</p>
                <p className="text-slate-700 leading-relaxed">{order.shipping_address}</p>
                <button onClick={() => copy(`${order.customer_name}\n${order.shipping_address}\n${phone}`)} className="text-[11px] font-bold text-indigo-600 mt-1 inline-flex items-center gap-1">
                  <Copy className="w-3 h-3" /> Copy shipping label
                </button>
              </div>
              {order.customer_note && (
                <div className="bg-amber-50 rounded-xl px-3 py-2.5 text-amber-900">
                  <p className="text-[11px] font-bold uppercase mb-1">Customer note</p>
                  {order.customer_note}
                </div>
              )}
            </div>
          </Card>

          {/* Private note */}
          <Card title="Private note">
            <textarea value={adminNote} onChange={(e) => setAdminNote(e.target.value)} rows={3} className={`${inputClass} resize-none`} placeholder="Only admins can see this" />
            <Button className="mt-2 w-full" variant="secondary" size="sm" loading={busy === 'note'} onClick={() => run('note', () => updateAdminOrderNote(order.id, adminNote), 'Note saved')}>
              Save note
            </Button>
          </Card>

          {/* Activity */}
          {activity.length > 0 && (
            <Card title="Activity">
              <ul className="flex flex-col gap-2.5">
                {activity.map((a) => (
                  <li key={a.id} className="text-xs">
                    <p className="text-slate-700">{a.message}</p>
                    <p className="text-slate-400">{formatDateTime(a.created_at)} · {a.actor?.email || a.actor?.type}</p>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          {isCancelled && (
            <Button
              variant="secondary"
              className="!text-red-600"
              loading={busy === 'delete'}
              onClick={async () => {
                if (!window.confirm('Permanently delete this cancelled order? This cannot be undone.')) return;
                const ok = await run('delete', () => deleteAdminOrder(order.id), 'Order deleted');
                if (ok) router.replace('/admin/orders');
              }}
            >
              <Trash2 className="w-4 h-4" /> Delete order
            </Button>
          )}
        </div>
      </div>

      <Modal
        open={shipOpen}
        onClose={() => setShipOpen(false)}
        title={order.status === 'SHIPPED' ? 'Update tracking' : 'Mark as shipped'}
        footer={
          <>
            <Button variant="secondary" onClick={() => setShipOpen(false)}>Cancel</Button>
            <Button
              loading={busy === 'status-SHIPPED'}
              onClick={async () => {
                const ok = await setStatus('SHIPPED', { tracking });
                if (ok) setShipOpen(false);
              }}
            >
              Save & notify
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <Field label="Courier"><input className={inputClass} value={tracking.courier} onChange={(e) => setTracking({ ...tracking, courier: e.target.value })} placeholder="India Post, Delhivery, DTDC…" /></Field>
          <Field label="Tracking number"><input className={inputClass} value={tracking.tracking_number} onChange={(e) => setTracking({ ...tracking, tracking_number: e.target.value })} /></Field>
          <Field label="Tracking link (optional)"><input className={inputClass} value={tracking.tracking_url} onChange={(e) => setTracking({ ...tracking, tracking_url: e.target.value })} placeholder="https://…" /></Field>
        </div>
      </Modal>

      <Modal
        open={cancelOpen}
        onClose={() => setCancelOpen(false)}
        title="Cancel order"
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setCancelOpen(false)}>Keep order</Button>
            <Button
              variant="danger"
              loading={busy === 'status-CANCELLED'}
              onClick={async () => {
                const ok = await setStatus('CANCELLED', { cancel_reason: cancelReason || 'Cancelled by store' });
                if (ok) setCancelOpen(false);
              }}
            >
              Cancel order
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-3">
          <p className="text-sm text-slate-600">Items go back into stock. {order.payment_status === 'VERIFIED' && <strong>This order is paid — remember to refund the customer.</strong>}</p>
          <Field label="Reason (shown to customer)">
            <input className={inputClass} value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} placeholder="e.g. Item out of stock" />
          </Field>
        </div>
      </Modal>
    </>
  );
}

function Row({ label, value }) {
  return (
    <div className="flex justify-between items-center">
      <span className="text-slate-500">{label}</span>
      <span>{value}</span>
    </div>
  );
}

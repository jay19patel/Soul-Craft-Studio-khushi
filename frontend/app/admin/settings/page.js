"use client";

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { getAdminSettings, saveAdminSettings } from '../../../lib/api';
import { Card, PageHeader, Button, Field, Toggle, Spinner, inputClass, useToast } from '../../../components/admin/ui';

const TABS = [
  ['payments', 'Payments'],
  ['shipping', 'Shipping'],
  ['notifications', 'Emails'],
  ['store', 'Store info'],
  ['other', 'Reviews & stock'],
];

export default function AdminSettingsPage() {
  const toast = useToast();
  const [data, setData] = useState(null);
  const [tab, setTab] = useState('payments');
  const [draft, setDraft] = useState(null);
  const [saving, setSaving] = useState('');

  useEffect(() => {
    getAdminSettings()
      .then((d) => {
        setData(d);
        setDraft(structuredClone(d.settings));
      })
      .catch((err) => toast(err.message, 'error'));
  }, [toast]);

  if (!data || !draft) return <Spinner />;
  const { integrations, email_types: emailTypes } = data;

  const set = (section, key, value) => setDraft((d) => ({ ...d, [section]: { ...d[section], [key]: value } }));

  const save = async (section) => {
    setSaving(section);
    try {
      const saved = await saveAdminSettings(section, draft[section]);
      setDraft((d) => ({ ...d, [section]: saved[section] }));
      toast('Settings saved');
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setSaving('');
    }
  };

  const SaveBtn = ({ section }) => (
    <div className="flex justify-end mt-5">
      <Button onClick={() => save(section)} loading={saving === section}>Save</Button>
    </div>
  );


  return (
    <>
      <PageHeader title="Settings" subtitle="Configure how your store works" />
      <div className="flex gap-2 overflow-x-auto scrollbar-hide -mx-4 px-4 md:mx-0 md:px-0 mb-5">
        {TABS.map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)} className={`px-4 py-2 rounded-full text-sm font-bold whitespace-nowrap border ${tab === k ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-600 border-slate-200'}`}>{l}</button>
        ))}
      </div>

      {tab === 'payments' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <Card title="UPI payments">
            <Toggle
              checked={draft.payments.upi_enabled}
              onChange={(v) => set('payments', 'upi_enabled', v)}
              label="Accept UPI payments"
              description="Free — money comes straight to your UPI ID. No gateway, no fees."
            />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-2">
              <Field label="Your UPI ID *" hint="From GPay / PhonePe / Paytm / BHIM profile">
                <input className={inputClass} value={draft.payments.upi_id} onChange={(e) => set('payments', 'upi_id', e.target.value)} placeholder="yourname@okaxis" />
              </Field>
              <Field label="Name shown in the UPI app">
                <input className={inputClass} value={draft.payments.upi_payee_name} onChange={(e) => set('payments', 'upi_payee_name', e.target.value)} placeholder="Soul Craft Studio" />
              </Field>
            </div>
            <div className="mt-4 rounded-2xl bg-slate-50 p-4 text-[13px] text-slate-600">
              <p className="font-bold text-slate-800 mb-2">How it works</p>
              <ol className="list-decimal pl-5 flex flex-col gap-1">
                <li>At checkout the customer sees a QR with the <strong>exact order amount</strong> (on phones, a “Pay in UPI app” button opens GPay/PhonePe directly).</li>
                <li>After paying, they enter the 12-digit UTR / transaction ID (screenshot optional) and place the order.</li>
                <li>You get an email + a “UPI payments to verify” alert on the dashboard.</li>
                <li>Check the UTR and amount in your UPI app or bank statement, then press <strong>Verify payment</strong> on the order. The order is confirmed and the customer is emailed.</li>
              </ol>
              <p className="mt-2">If the money never arrived, press <strong>Not received</strong> — the customer is told to contact you.</p>
            </div>
            <SaveBtn section="payments" />
          </Card>

          <Card title="Cash on delivery">
            <Toggle
              checked={draft.payments.cod_enabled}
              onChange={(v) => set('payments', 'cod_enabled', v)}
              label="Accept cash on delivery"
              description="The customer pays the courier. Tip: call or WhatsApp new COD customers to confirm before shipping — it avoids fake orders and returns."
            />
            {draft.payments.cod_enabled && (
              <Field label="Extra COD charge (₹)" hint="0 = no extra charge. Shown to the customer at checkout." className="mt-2">
                <input type="number" min={0} className={inputClass} value={draft.payments.cod_fee} onChange={(e) => set('payments', 'cod_fee', e.target.value)} />
              </Field>
            )}
            <p className="mt-4 text-[13px] text-slate-600 rounded-2xl bg-slate-50 p-4">
              COD orders arrive as <strong>Order placed</strong>. Confirm → craft → ship as usual. When you mark the order <strong>Delivered</strong>, the payment is automatically recorded as received.
            </p>
            <SaveBtn section="payments" />
          </Card>
        </div>
      )}

      {tab === 'shipping' && (
        <Card title="Shipping" className="max-w-xl">
          <div className="flex flex-col gap-4">
            <Field label="Shipping charge per order (₹)" hint="0 = free shipping on every order.">
              <input type="number" min={0} className={inputClass} value={draft.shipping.flat_fee} onChange={(e) => set('shipping', 'flat_fee', e.target.value)} />
            </Field>
            <Field label="Free shipping above (₹)" hint="0 = no free-shipping threshold.">
              <input type="number" min={0} className={inputClass} value={draft.shipping.free_shipping_threshold} onChange={(e) => set('shipping', 'free_shipping_threshold', e.target.value)} />
            </Field>
            <Field label="Delivery time shown to customers">
              <input className={inputClass} value={draft.shipping.estimated_delivery} onChange={(e) => set('shipping', 'estimated_delivery', e.target.value)} placeholder="5-7 business days" />
            </Field>
          </div>
          <SaveBtn section="shipping" />
        </Card>
      )}

      {tab === 'notifications' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <Card title="Emails to customers">
            {emailTypes.filter((t) => t.audience === 'customer').map((t) => (
              <Toggle key={t.key} checked={draft.notifications[t.setting]} onChange={(v) => set('notifications', t.setting, v)} label={t.label} />
            ))}
          </Card>
          <Card title="Alerts to you (admin)">
            {emailTypes.filter((t) => t.audience === 'admin').map((t) => (
              <Toggle key={t.key} checked={draft.notifications[t.setting]} onChange={(v) => set('notifications', t.setting, v)} label={t.label} />
            ))}
            <Field label="Send admin alerts to" hint="Up to 5 emails, comma separated. Empty = store email." className="mt-3">
              <input
                className={inputClass}
                value={Array.isArray(draft.notifications.admin_recipients) ? draft.notifications.admin_recipients.join(', ') : draft.notifications.admin_recipients}
                onChange={(e) => set('notifications', 'admin_recipients', e.target.value)}
                placeholder={draft.store.email}
              />
            </Field>
          </Card>
          <div className="lg:col-span-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <p className="text-sm text-slate-500">
              {integrations.smtp ? '✅ SMTP connected — emails are being sent.' : '⚠ SMTP not configured — emails are only logged.'}{' '}
              <Link href="/admin/emails" className="text-indigo-600 font-bold">See email log →</Link>
            </p>
            <Button onClick={() => save('notifications')} loading={saving === 'notifications'}>Save</Button>
          </div>
        </div>
      )}

      {tab === 'store' && (
        <Card title="Store information" className="max-w-2xl">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Store name *" className="sm:col-span-2"><input className={inputClass} value={draft.store.name} onChange={(e) => set('store', 'name', e.target.value)} /></Field>
            <Field label="Tagline" className="sm:col-span-2"><textarea rows={2} className={`${inputClass} resize-none`} value={draft.store.tagline} onChange={(e) => set('store', 'tagline', e.target.value)} /></Field>
            <Field label="Contact email *"><input type="email" className={inputClass} value={draft.store.email} onChange={(e) => set('store', 'email', e.target.value)} /></Field>
            <Field label="Phone"><input className={inputClass} value={draft.store.phone} onChange={(e) => set('store', 'phone', e.target.value)} /></Field>
            <Field label="WhatsApp number" hint="With country code, e.g. 919023896348"><input className={inputClass} value={draft.store.whatsapp} onChange={(e) => set('store', 'whatsapp', e.target.value)} /></Field>
            <Field label="Location"><input className={inputClass} value={draft.store.location} onChange={(e) => set('store', 'location', e.target.value)} /></Field>
            <Field label="Instagram URL"><input className={inputClass} value={draft.store.instagram} onChange={(e) => set('store', 'instagram', e.target.value)} /></Field>
            <Field label="YouTube channel URL"><input className={inputClass} value={draft.store.youtube} onChange={(e) => set('store', 'youtube', e.target.value)} /></Field>
            <Field label="GSTIN (optional)"><input className={inputClass} value={draft.store.gstin} onChange={(e) => set('store', 'gstin', e.target.value)} /></Field>
          </div>
          <SaveBtn section="store" />
        </Card>
      )}

      {tab === 'other' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <Card title="Customer reviews">
            <Toggle
              checked={draft.reviews.auto_approve}
              onChange={(v) => set('reviews', 'auto_approve', v)}
              label="Publish customer reviews automatically"
              description="Off (recommended): new reviews wait for your approval under Reviews."
            />
            <SaveBtn section="reviews" />
          </Card>
          <Card title="Inventory">
            <Field label="Low-stock alert at" hint="Dashboard warns when a live product has this many or fewer left.">
              <input type="number" min={0} className={inputClass} value={draft.inventory.low_stock_threshold} onChange={(e) => set('inventory', 'low_stock_threshold', e.target.value)} />
            </Field>
            <SaveBtn section="inventory" />
          </Card>
        </div>
      )}
    </>
  );
}

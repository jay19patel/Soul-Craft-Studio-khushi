"use client";

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ChevronLeft, MapPin, CreditCard, ShieldCheck, Loader2, Image as ImageIcon, X, Check, QrCode, Banknote, ChevronDown, Plus,
} from 'lucide-react';
import Navbar from '../../components/Navbar';
import Footer from '../../components/Footer';
import UpiQrPayment from '../../components/UpiQrPayment';
import { useCart } from '../../context/CartContext';
import { useAuth } from '../../context/AuthContext';
import { useSettings } from '../../context/SettingsContext';
import { createOrder, uploadScreenshot, getAddresses, getContacts, addAddress } from '../../lib/api';
import { INDIAN_STATES } from '../../lib/constants';

const inputCls =
  'w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all';
const labelCls = 'text-[11px] font-black uppercase tracking-widest text-slate-500 px-1';

const newClientRef = () =>
  typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

export default function CheckoutPage() {
  const router = useRouter();
  const { cart, cartTotal, clearCart, isReady: cartReady, syncing } = useCart();
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  const { settings, loaded: settingsLoaded } = useSettings();

  const [step, setStep] = useState('address');
  const [addresses, setAddresses] = useState([]);
  const [selectedAddressId, setSelectedAddressId] = useState('new');
  const [saveAddress, setSaveAddress] = useState(true);
  const [form, setForm] = useState({ fullName: '', email: '', phone: '', address: '', city: '', state: '', pincode: '', note: '' });
  const [method, setMethod] = useState(null);
  const [utr, setUtr] = useState('');
  const [screenshot, setScreenshot] = useState(null);
  const [screenshotPreview, setScreenshotPreview] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [placed, setPlaced] = useState(false);
  const [clientRef, setClientRef] = useState(newClientRef);

  const payments = settings.payments || {};
  const availableMethods = useMemo(
    () => [
      payments.upi && 'UPI',
      payments.cod && 'COD',
    ].filter(Boolean),
    [payments.upi, payments.cod]
  );

  useEffect(() => {
    if (!method && availableMethods.length) setMethod(availableMethods[0]);
  }, [availableMethods, method]);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) router.replace('/login?redirect=/checkout');
  }, [authLoading, isAuthenticated, router]);

  useEffect(() => {
    if (!isAuthenticated) return;
    Promise.all([getAddresses().catch(() => []), getContacts().catch(() => [])]).then(([addrs, contacts]) => {
      setAddresses(addrs);
      const def = addrs.find((a) => a.is_default) || addrs[0];
      const phone = (contacts.find((c) => c.is_default) || contacts[0])?.phone_number || '';
      setForm((prev) => ({ ...prev, email: user?.email || '', fullName: prev.fullName || user?.full_name || '', phone: prev.phone || phone }));
      if (def) {
        setSelectedAddressId(def.id);
        applyAddress(def);
        setSaveAddress(false);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, user?.id]);

  const applyAddress = (a) =>
    setForm((prev) => ({ ...prev, fullName: a.full_name || prev.fullName, address: a.address_line, city: a.city, state: a.state, pincode: a.pincode }));

  // Display-only totals; the server recalculates everything from live prices.
  const shippingCfg = settings.shipping || {};
  const threshold = Number(shippingCfg.free_shipping_threshold || 0);
  const shippingFee = threshold > 0 && cartTotal >= threshold ? 0 : Number(shippingCfg.flat_fee || 0);
  const codFee = method === 'COD' ? Number(payments.cod_fee || 0) : 0;
  const total = cartTotal + shippingFee + codFee;

  const set = (e) => setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));

  const validateAddress = () => {
    if (!/^[6-9]\d{9}$/.test(form.phone.replace(/\D/g, '').slice(-10))) return 'Please enter a valid 10-digit mobile number.';
    if (!/^[1-9]\d{5}$/.test(form.pincode.trim())) return 'Please enter a valid 6-digit pincode.';
    if (!form.state) return 'Please select your state.';
    return '';
  };

  const continueToPayment = async (e) => {
    e.preventDefault();
    const msg = validateAddress();
    if (msg) return setError(msg);
    setError('');
    if (selectedAddressId === 'new' && saveAddress) {
      addAddress({ full_name: form.fullName, address_line: form.address, city: form.city, state: form.state, pincode: form.pincode, is_default: addresses.length === 0 })
        .then((a) => {
          setAddresses((prev) => [a, ...prev]);
          setSelectedAddressId(a.id);
        })
        .catch(() => {});
    }
    setStep('payment');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const onScreenshot = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) return setError('Screenshot must be under 5 MB.');
    setScreenshot(file);
    const reader = new FileReader();
    reader.onloadend = () => setScreenshotPreview(reader.result);
    reader.readAsDataURL(file);
  };

  const placeOrder = async (e) => {
    e?.preventDefault();
    if (submitting) return;
    setError('');
    if (!method) return setError('Please choose a payment method.');
    if (method === 'UPI' && !/^[A-Za-z0-9]{10,22}$/.test(utr.replace(/\s/g, ''))) {
      return setError('Enter the 12-digit UPI transaction ID / UTR from your UPI app after paying.');
    }

    setSubmitting(true);
    try {
      let screenshotId = null;
      if (method === 'UPI' && screenshot) {
        try {
          screenshotId = (await uploadScreenshot(screenshot)).id;
        } catch (err) {
          console.error('Screenshot upload failed:', err);
        }
      }

      const { order } = await createOrder({
        client_ref: clientRef,
        payment_method: method,
        customer_name: form.fullName,
        customer_email: form.email,
        customer_phone: form.phone,
        address: form.address,
        city: form.city,
        state: form.state,
        pincode: form.pincode,
        customer_note: form.note,
        upi_transaction_id: method === 'UPI' ? utr : undefined,
        screenshot_id: screenshotId,
        items: cart.map((i) => ({ product_id: i.id, quantity: i.quantity })),
      });

      setPlaced(true);
      clearCart();
      router.replace(`/order-success?id=${order.id}`);
    } catch (err) {
      setError(err.message || 'Could not place your order. Please try again.');
      setClientRef(newClientRef());
      setSubmitting(false);
    }
  };

  if (authLoading || !cartReady || !isAuthenticated) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col">
        <Navbar />
        <main className="flex-grow flex items-center justify-center">
          <Loader2 className="w-10 h-10 text-orange-500 animate-spin" />
        </main>
      </div>
    );
  }

  if (cart.length === 0 && !placed) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col">
        <Navbar />
        <main className="flex-grow flex flex-col items-center justify-center p-6 text-center gap-6">
          <h1 className="text-3xl font-[family-name:var(--font-climate-crisis)] uppercase text-blue-950">Your cart is empty</h1>
          <p className="text-slate-500 max-w-sm">Add some handcrafted pieces to your cart first.</p>
          <Link href="/shop" className="bg-orange-500 text-white px-8 py-3 rounded-full font-black uppercase tracking-widest text-sm">Browse shop</Link>
        </main>
        <Footer />
      </div>
    );
  }

  const primaryLabel =
    step === 'address'
      ? 'Continue to payment'
      : method === 'UPI'
        ? 'I have paid — place order'
        : 'Place order (COD)';

  const summary = (
    <div className="flex flex-col gap-5">
      <ul className="flex flex-col gap-4 max-h-[320px] overflow-y-auto pr-1">
        {cart.map((item) => (
          <li key={item.id} className="flex gap-3 items-center">
            <div className="relative w-14 h-14 rounded-xl bg-slate-50 border border-slate-100 overflow-hidden shrink-0">
              {item.image && <img src={item.image} alt="" className="w-full h-full object-cover" />}
              <span className="absolute -top-0 -right-0 bg-blue-950 text-white text-[10px] font-black rounded-bl-lg px-1.5">{item.quantity}</span>
            </div>
            <span className="flex-1 text-sm font-bold text-blue-950 line-clamp-2">{item.name}</span>
            <span className="text-sm font-black text-slate-700">₹{(item.price * item.quantity).toLocaleString('en-IN')}</span>
          </li>
        ))}
      </ul>
      <div className="flex flex-col gap-2.5 pt-4 border-t border-slate-100 text-sm">
        <Row label="Subtotal" value={`₹${cartTotal.toLocaleString('en-IN')}`} />
        <Row label="Shipping" value={shippingFee === 0 ? 'Free' : `₹${shippingFee.toLocaleString('en-IN')}`} valueClass={shippingFee === 0 ? 'text-emerald-600' : ''} />
        {codFee > 0 && <Row label="COD charge" value={`₹${codFee.toLocaleString('en-IN')}`} />}
        <div className="flex justify-between items-center pt-3 border-t border-slate-100 mt-1">
          <span className="font-black text-blue-950 uppercase tracking-tight">Total</span>
          <span className="font-black text-xl text-orange-600">₹{total.toLocaleString('en-IN')}</span>
        </div>
        {threshold > 0 && shippingFee > 0 && (
          <p className="text-xs text-emerald-700 bg-emerald-50 rounded-xl px-3 py-2">Add ₹{(threshold - cartTotal).toLocaleString('en-IN')} more for free shipping.</p>
        )}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans text-slate-900">
      <Navbar />

      <main className="flex-grow w-full max-w-6xl mx-auto px-4 pt-6 pb-32 md:py-14">
        <button
          onClick={() => (step === 'payment' ? setStep('address') : router.push('/shop'))}
          className="flex items-center gap-1 text-xs font-black uppercase tracking-widest text-slate-400 hover:text-orange-500 mb-4"
        >
          <ChevronLeft className="w-4 h-4" />
          {step === 'payment' ? 'Back to address' : 'Continue shopping'}
        </button>

        {/* Steps */}
        <div className="flex items-center gap-3 mb-6 md:mb-10">
          <StepDot n={1} label="Address" active={step === 'address'} done={step === 'payment'} />
          <div className="w-10 h-px bg-slate-300" />
          <StepDot n={2} label="Payment" active={step === 'payment'} />
        </div>

        {/* Mobile summary toggle */}
        <button
          onClick={() => setSummaryOpen((o) => !o)}
          className="lg:hidden w-full flex items-center justify-between bg-white border border-slate-200 rounded-2xl px-4 py-3.5 mb-4"
        >
          <span className="text-sm font-bold text-blue-950 flex items-center gap-2">
            Order summary ({cart.length} item{cart.length > 1 ? 's' : ''})
            <ChevronDown className={`w-4 h-4 transition-transform ${summaryOpen ? 'rotate-180' : ''}`} />
          </span>
          <span className="font-black text-orange-600">₹{total.toLocaleString('en-IN')}</span>
        </button>
        {summaryOpen && <div className="lg:hidden bg-white border border-slate-200 rounded-2xl p-4 mb-4">{summary}</div>}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-10 items-start">
          <div className="lg:col-span-7 flex flex-col gap-5">
            {step === 'address' ? (
              <form id="checkout-form" onSubmit={continueToPayment} className="bg-white rounded-3xl p-5 md:p-8 border border-slate-100 shadow-sm flex flex-col gap-6">
                <SectionTitle icon={MapPin} title="Delivery address" />

                {addresses.length > 0 && (
                  <div className="flex flex-col gap-3">
                    {addresses.map((a) => (
                      <label key={a.id} className={`flex gap-3 p-4 rounded-2xl border-2 cursor-pointer transition-all ${selectedAddressId === a.id ? 'border-orange-500 bg-orange-50/40' : 'border-slate-100 hover:border-slate-200'}`}>
                        <input
                          type="radio"
                          name="addr"
                          className="mt-1 accent-orange-500"
                          checked={selectedAddressId === a.id}
                          onChange={() => {
                            setSelectedAddressId(a.id);
                            applyAddress(a);
                          }}
                        />
                        <span className="text-sm leading-relaxed">
                          <span className="font-bold text-blue-950 block">{a.full_name}</span>
                          <span className="text-slate-600">{a.address_line}, {a.city}, {a.state} - {a.pincode}</span>
                        </span>
                      </label>
                    ))}
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedAddressId('new');
                        setSaveAddress(true);
                        setForm((p) => ({ ...p, address: '', city: '', state: '', pincode: '' }));
                      }}
                      className={`flex items-center gap-2 p-4 rounded-2xl border-2 border-dashed text-sm font-bold ${selectedAddressId === 'new' ? 'border-orange-500 text-orange-600' : 'border-slate-200 text-slate-500'}`}
                    >
                      <Plus className="w-4 h-4" /> Deliver to a new address
                    </button>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Field label="Full name">
                    <input required name="fullName" value={form.fullName} onChange={set} autoComplete="name" className={inputCls} />
                  </Field>
                  <Field label="Mobile number">
                    <input required name="phone" type="tel" inputMode="numeric" value={form.phone} onChange={set} autoComplete="tel" placeholder="10-digit mobile" className={inputCls} />
                  </Field>
                  <Field label="Email (for order updates)" className="md:col-span-2">
                    <input required name="email" type="email" value={form.email} onChange={set} autoComplete="email" className={inputCls} />
                  </Field>
                  {selectedAddressId === 'new' && (
                    <>
                      <Field label="House / street / landmark" className="md:col-span-2">
                        <textarea required name="address" value={form.address} onChange={set} rows={2} autoComplete="street-address" className={`${inputCls} resize-none`} />
                      </Field>
                      <Field label="Pincode">
                        <input required name="pincode" inputMode="numeric" maxLength={6} value={form.pincode} onChange={set} autoComplete="postal-code" className={inputCls} />
                      </Field>
                      <Field label="City">
                        <input required name="city" value={form.city} onChange={set} autoComplete="address-level2" className={inputCls} />
                      </Field>
                      <Field label="State" className="md:col-span-2">
                        <select required name="state" value={form.state} onChange={set} className={inputCls}>
                          <option value="">Select state</option>
                          {INDIAN_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
                        </select>
                      </Field>
                      <label className="md:col-span-2 flex items-center gap-2 text-sm text-slate-600">
                        <input type="checkbox" checked={saveAddress} onChange={(e) => setSaveAddress(e.target.checked)} className="accent-orange-500 w-4 h-4" />
                        Save this address for next time
                      </label>
                    </>
                  )}
                  <Field label="Order note (optional)" className="md:col-span-2">
                    <input name="note" value={form.note} onChange={set} maxLength={500} placeholder="Gift message, preferred colour, etc." className={inputCls} />
                  </Field>
                </div>
              </form>
            ) : (
              <form id="checkout-form" onSubmit={placeOrder} className="flex flex-col gap-5">
                <div className="bg-white rounded-3xl p-5 border border-slate-100 shadow-sm text-sm flex justify-between gap-4">
                  <div className="leading-relaxed">
                    <span className="text-[11px] font-black uppercase tracking-widest text-slate-400 block mb-1">Delivering to</span>
                    <span className="font-bold text-blue-950">{form.fullName}</span> · {form.phone}
                    <br />
                    <span className="text-slate-600">{form.address}, {form.city}, {form.state} - {form.pincode}</span>
                  </div>
                  <button type="button" onClick={() => setStep('address')} className="text-orange-600 font-bold text-xs shrink-0">Change</button>
                </div>

                <div className="bg-white rounded-3xl p-5 md:p-8 border border-slate-100 shadow-sm flex flex-col gap-5">
                  <SectionTitle icon={CreditCard} title="Payment method" />

                  {settingsLoaded && availableMethods.length === 0 && (
                    <p className="text-sm text-red-600 bg-red-50 rounded-2xl p-4">Online ordering is paused right now. Please contact us to order.</p>
                  )}

                  <div className="flex flex-col gap-3">
                    {payments.upi && (
                      <MethodCard
                        selected={method === 'UPI'}
                        onSelect={() => setMethod('UPI')}
                        icon={QrCode}
                        title="Pay by UPI"
                        badge="No extra charges"
                        text="Scan the QR or tap Pay in UPI app (GPay, PhonePe, Paytm, BHIM), then enter the 12-digit transaction ID. We confirm your order after checking the payment."
                      />
                    )}
                    {payments.cod && (
                      <MethodCard
                        selected={method === 'COD'}
                        onSelect={() => setMethod('COD')}
                        icon={Banknote}
                        title="Cash on delivery"
                        text={Number(payments.cod_fee) > 0 ? `Pay when it arrives. ₹${payments.cod_fee} COD charge applies.` : 'Pay when your order arrives.'}
                      />
                    )}
                  </div>

                  {method === 'UPI' && payments.upi_id && (
                    <div className="flex flex-col md:flex-row gap-6 md:gap-8 bg-slate-50 rounded-3xl p-5 md:p-6 border border-slate-100">
                      <div className="md:w-1/2">
                        <UpiQrPayment upiId={payments.upi_id} payeeName={payments.upi_payee_name} amount={total} note={`${settings.store?.name || 'Order'} order`} />
                      </div>
                      <div className="md:w-1/2 flex flex-col gap-4 justify-center">
                        <Field label="UPI transaction ID / UTR *">
                          <input value={utr} onChange={(e) => setUtr(e.target.value)} inputMode="numeric" placeholder="e.g. 412345678901" className={`${inputCls} bg-white font-bold`} />
                          <span className="text-[11px] text-slate-500 px-1">Find it in your UPI app under the payment details (12 digits).</span>
                        </Field>
                        <div className="flex flex-col gap-2">
                          <span className={labelCls}>Payment screenshot (optional)</span>
                          {screenshotPreview ? (
                            <div className="flex items-center gap-3 bg-white border border-slate-200 rounded-2xl p-2.5">
                              <img src={screenshotPreview} alt="" className="w-12 h-12 rounded-xl object-cover" />
                              <span className="flex-1 text-xs text-slate-600 truncate">{screenshot?.name}</span>
                              <button type="button" onClick={() => { setScreenshot(null); setScreenshotPreview(null); }} className="p-2 text-slate-400 hover:text-red-500">
                                <X className="w-4 h-4" />
                              </button>
                            </div>
                          ) : (
                            <label className="flex items-center justify-center gap-2 bg-white border border-dashed border-slate-300 rounded-2xl py-4 text-xs font-bold text-slate-500 cursor-pointer hover:border-orange-400">
                              <ImageIcon className="w-4 h-4" /> Attach screenshot
                              <input type="file" accept="image/png,image/jpeg,image/webp" onChange={onScreenshot} className="hidden" />
                            </label>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-3 text-xs text-slate-500 px-1">
                  <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0" />
                  Prices and stock are confirmed on our server when you place the order. We never ask for your UPI PIN, card or bank details.
                </div>
              </form>
            )}

            {error && <div className="bg-red-50 border border-red-100 rounded-2xl p-4 text-sm font-bold text-red-600">{error}</div>}

            <button
              type="submit"
              form="checkout-form"
              disabled={submitting || syncing || (step === 'payment' && !method)}
              className="hidden lg:flex w-full bg-orange-500 hover:bg-orange-600 text-white py-5 rounded-2xl font-black uppercase tracking-[0.15em] text-sm shadow-xl shadow-orange-200 transition-all disabled:opacity-50 items-center justify-center gap-3"
            >
              {submitting && <Loader2 className="w-5 h-5 animate-spin" />}
              {submitting ? 'Placing order…' : primaryLabel}
            </button>
          </div>

          <aside className="hidden lg:block lg:col-span-5 bg-white rounded-3xl p-6 md:p-8 border border-slate-100 shadow-sm lg:sticky lg:top-28">
            <h3 className="text-sm font-black uppercase tracking-[0.2em] text-blue-950 mb-6">Order summary</h3>
            {summary}
          </aside>
        </div>
      </main>

      {/* Mobile sticky action bar */}
      <div className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-white border-t border-slate-200 px-4 pt-3 pb-safe">
        <div className="flex items-center gap-3">
          <div className="flex flex-col">
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Total</span>
            <span className="text-lg font-black text-blue-950">₹{total.toLocaleString('en-IN')}</span>
          </div>
          <button
            type="submit"
            form="checkout-form"
            disabled={submitting || syncing || (step === 'payment' && !method)}
            className="flex-1 bg-orange-500 text-white py-4 rounded-full font-black uppercase tracking-wider text-xs shadow-lg shadow-orange-200 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
            {submitting ? 'Placing…' : primaryLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, valueClass = '' }) {
  return (
    <div className="flex justify-between">
      <span className="text-slate-500">{label}</span>
      <span className={`font-bold text-blue-950 ${valueClass}`}>{value}</span>
    </div>
  );
}

function Field({ label, children, className = '' }) {
  return (
    <label className={`flex flex-col gap-1.5 ${className}`}>
      <span className={labelCls}>{label}</span>
      {children}
    </label>
  );
}

function SectionTitle({ icon: Icon, title }) {
  return (
    <div className="flex items-center gap-3">
      <span className="w-10 h-10 bg-orange-100 text-orange-600 rounded-2xl flex items-center justify-center">
        <Icon className="w-5 h-5" />
      </span>
      <h2 className="text-lg font-black uppercase tracking-tight text-blue-950">{title}</h2>
    </div>
  );
}

function StepDot({ n, label, active, done }) {
  return (
    <div className={`flex items-center gap-2 text-[11px] font-black uppercase tracking-widest ${active ? 'text-orange-600' : done ? 'text-emerald-600' : 'text-slate-400'}`}>
      <span className={`w-7 h-7 rounded-full flex items-center justify-center text-white text-xs ${active ? 'bg-orange-500' : done ? 'bg-emerald-500' : 'bg-slate-300'}`}>
        {done ? <Check className="w-4 h-4" /> : n}
      </span>
      {label}
    </div>
  );
}

function MethodCard({ selected, onSelect, icon: Icon, title, text, badge }) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`text-left flex gap-4 p-4 md:p-5 rounded-2xl border-2 transition-all ${selected ? 'border-orange-500 bg-orange-50/40' : 'border-slate-100 hover:border-slate-200'}`}
    >
      <span className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${selected ? 'bg-orange-500 text-white' : 'bg-slate-100 text-slate-500'}`}>
        <Icon className="w-5 h-5" />
      </span>
      <span className="flex flex-col gap-1">
        <span className="font-black text-blue-950 flex items-center gap-2 flex-wrap">
          {title}
          {badge && <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 uppercase tracking-wider">{badge}</span>}
        </span>
        <span className="text-xs md:text-sm text-slate-500 leading-relaxed">{text}</span>
      </span>
    </button>
  );
}

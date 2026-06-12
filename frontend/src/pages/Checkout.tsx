import React, { useEffect, useState, Fragment } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  CheckIcon, BanknoteIcon, CreditCardIcon,
  LockIcon, PlusIcon, Loader2Icon, Trash2Icon,
  ChevronDownIcon,
} from 'lucide-react';
import { useCartStore } from '../store/cartStore';
import { useAuthStore } from '../store/authStore';
import { useAddressStore } from '../store/addressStore';
import { useToastStore } from '../store/toastStore';
import { useSettingsStore } from '../store/settingsStore';
import { formatINR, calcGstBreakdown } from '../utils/formatPrice';
import { Button } from '../components/ui/Button';
import { AddressForm } from '../components/checkout/AddressForm';
import { ordersApi, OnlineOrderResponse, AddressPayload } from '../utils/ordersApi';
import { openCashfreeCheckout } from '../utils/cashfree';
import { getImageUrl } from '../utils/getImageUrl';
import { getDeliveryCache, isGujaratPincode } from '../utils/gujaratData';
import { api } from '../utils/api';

const steps = ['Login', 'Address', 'Payment'];

export function Checkout() {
  const navigate = useNavigate();
  const { items, subtotal, clearCart, allCodEligible } = useCartStore();
  const { isAuthenticated } = useAuthStore();
  const { addresses, fetchAddresses, addAddress, deleteAddress } = useAddressStore();
  const showToast = useToastStore((s) => s.showToast);
  const calcShipping = useSettingsStore((s) => s.calcShipping);
  const fetchSettings = useSettingsStore((s) => s.fetchSettings);
  const gstRate = useSettingsStore((s) => s.gstRate);

  const [step, setStep] = useState<1 | 2 | 3>(isAuthenticated ? 2 : 1);
  const [selectedAddressId, setSelectedAddressId] = useState<number | null>(null);
  const [showAddressForm, setShowAddressForm] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'cod' | 'online' | ''>('');
  const [placing, setPlacing] = useState(false);
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [pincodeService, setPincodeService] = useState<{ cod: boolean; prepaid: boolean; deliverable: boolean } | null>(null);
  const [pincodeLoading, setPincodeLoading] = useState(false);
  const [pincodeRateLimitSeconds, setPincodeRateLimitSeconds] = useState<number>(0);
  const [pincodeError, setPincodeError] = useState<string | null>(null);

  const parseRetrySeconds = (err: any): number => {
    const retryAfterRaw = err?.response?.headers?.['retry-after'];
    const retryAfter = Number(retryAfterRaw);
    if (Number.isFinite(retryAfter) && retryAfter > 0) return retryAfter;

    const detail = String(err?.response?.data?.detail ?? '');
    const match = detail.match(/(\d+)\s*s/i);
    if (match) {
      const parsed = Number(match[1]);
      if (Number.isFinite(parsed) && parsed > 0) return parsed;
    }
    return 60;
  };

  useEffect(() => {
    if (pincodeRateLimitSeconds <= 0) return;
    const timer = window.setInterval(() => {
      setPincodeRateLimitSeconds((prev) => (prev > 1 ? prev - 1 : 0));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [pincodeRateLimitSeconds]);

  useEffect(() => {
    if (items.length === 0 && !placing) navigate('/cart');
  }, [items.length, placing]);

  useEffect(() => {
    if (isAuthenticated && step === 1) setStep(2);
  }, [isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated) return;
    fetchAddresses().then(() => {
      const addrs = useAddressStore.getState().addresses;
      if (addrs.length === 0) {
        setShowAddressForm(true);
      } else {
        const def = addrs.find((a) => a.is_default) ?? addrs[0];
        setSelectedAddressId(def.id);
      }
    });
  }, [isAuthenticated]);

  useEffect(() => { fetchSettings(); }, [fetchSettings]);

  // Check pincode serviceability when selected address changes
  useEffect(() => {
    // Reset payment method when address changes — avoid stale selection
    setPaymentMethod('');
    setPincodeError(null);

    const addr = addresses.find(a => a.id === selectedAddressId);
    if (!addr?.pincode) { setPincodeService(null); return; }

    const pincode = addr.pincode;

    // Gujarat-only — non-Gujarat pincodes shouldn't reach checkout but handle gracefully
    if (!isGujaratPincode(pincode)) {
      setPincodeService({ cod: false, prepaid: false, deliverable: false });
      return;
    }

    // Check in-memory cache first
    const cached = getDeliveryCache(pincode);
    if (cached) { setPincodeService(cached); return; }

    // Call API
    setPincodeLoading(true);
    api.get(`/pincode/check?pincode=${pincode}`)
      .then(res => {
        const { deliverable, cod, prepaid } = res.data;
        setPincodeRateLimitSeconds(0);
        setPincodeError(null);
        setPincodeService({ deliverable, cod, prepaid });
      })
      .catch((err: any) => {
        if (err?.response?.status === 429) {
          const retrySeconds = parseRetrySeconds(err);
          setPincodeRateLimitSeconds(retrySeconds);
          setPincodeError(`Too many pincode checks. Please retry in ${retrySeconds} seconds.`);
          setPincodeService(null);
          return;
        }

        // Unknown status must not unlock payment methods.
        setPincodeError('Unable to verify delivery right now. Please retry in a moment.');
        setPincodeService(null);
      })
      .finally(() => setPincodeLoading(false));
  }, [selectedAddressId, addresses]);

  const sub = subtotal();
  const shippingFee = calcShipping(sub);
  const total = sub + shippingFee;
  const cartCodEligible = allCodEligible();
  const pincodeRateLimited = pincodeRateLimitSeconds > 0;
  const deliveryStatusUnknown = !!selectedAddressId && !pincodeLoading && !pincodeService;

  // COD: admin allows it via cart + courier partner supports it at this pincode
  const codEligible = cartCodEligible && (pincodeService?.cod ?? false);
  // Online/prepaid: always admin-allowed, but block if courier can't deliver at all
  const onlineEligible = pincodeService?.prepaid ?? false;
  const notDeliverable = pincodeService !== null && !pincodeService.deliverable;

  // ── GST estimate across cart items ─────────────────────────────────────────
  // cart items carry gst_rate if set; fall back to admin-configured GST rate
  const estimatedGst = items.reduce((acc, item) => {
    const rate = (item as any).gst_rate ?? gstRate;
    const { gstAmount } = calcGstBreakdown(item.price, rate);
    return acc + gstAmount * item.qty;
  }, 0);
  const estimatedTaxable = sub - estimatedGst;
  // ─────────────────────────────────────────────────────────────────────────────

  const handleSaveAddress = async (a: any) => {
    const payload: AddressPayload = {
      label: a.label || 'Home',
      name: a.name,
      phone: a.phone,
      house_no: a.house_no,
      area: a.area,
      village: a.village,
      taluka: a.taluka,
      district: a.district,
      pincode: a.pincode,
      state: a.state || 'Gujarat',
      gstin: a.gstin || undefined,
    };
    const saved = await addAddress(payload);
    if (saved) {
      setSelectedAddressId(saved.id);
      setShowAddressForm(false);
      showToast('Address saved', 'success');
    } else {
      showToast('Failed to save address', 'error');
    }
  };

  const handlePlaceOrder = async () => {
    if (!paymentMethod) return showToast('Please select a payment method', 'warning');
    if (!selectedAddressId) return showToast('Please select a delivery address', 'warning');

    setPlacing(true);
    try {
      const payload = {
        items: items.map((i) => ({
          product_id: Number(i.product_id),
          variant_id: Number(i.variant_id),
          quantity: Number(i.qty),
        })),
        address_id: Number(selectedAddressId),
        payment_method: paymentMethod as 'cod' | 'online',
      };

      const response = await ordersApi.create(payload);

      if (paymentMethod === 'online') {
        const res = response as OnlineOrderResponse;
        if (res.payment_session_id) {
          clearCart();
          await openCashfreeCheckout(res.payment_session_id);
        } else {
          navigate(`/order-success/${res.order_id}`);
          clearCart();
        }
      } else {
        const res = response as any;
        navigate(`/order-success/${res.id}`);
        clearCart();
      }
    } catch (err: any) {
      const detail = err?.response?.data?.detail;
      const msg = Array.isArray(detail)
        ? detail.map((d: any) => `${d.loc?.slice(-1)[0]}: ${d.msg}`).join(' | ')
        : typeof detail === 'string'
        ? detail
        : 'Failed to place order. Please try again.';
      showToast(msg, 'error');
      console.error('[Order Error]', err?.response?.data);
    } finally {
      setPlacing(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-3 sm:px-4 py-4 md:py-6 w-full pb-14 md:pb-6">
      {/* Progress steps */}
      <div className="bg-white rounded-xl shadow-card p-3 md:p-5 mb-4">
        <div className="flex items-center justify-between">
          {steps.map((s, i) => {
            const idx = (i + 1) as 1 | 2 | 3;
            const done = step > idx;
            const cur = step === idx;
            return (
              <Fragment key={s}>
                <div className="flex items-center gap-1.5 md:gap-2 shrink-0">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs transition-colors
                    ${done ? 'bg-success text-white' : cur ? 'bg-primary text-white' : 'bg-gray-200 text-muted'}`}>
                    {done ? <CheckIcon size={13} /> : idx}
                  </div>
                  <span className={`text-[11px] md:text-sm font-semibold
                    ${cur ? 'text-primary' : done ? 'text-ink' : 'text-muted'}`}>
                    {s}
                  </span>
                </div>
                {i < steps.length - 1 && (
                  <div className={`flex-1 h-0.5 mx-1 md:mx-2 ${step > idx ? 'bg-success' : 'bg-gray-200'}`} />
                )}
              </Fragment>
            );
          })}
        </div>
      </div>

      <div className="grid lg:grid-cols-[1fr_340px] gap-4 md:gap-6">
        <div className="space-y-3 md:space-y-4">

          {/* Step 1 — Login */}
          {step === 1 && (
            <div className="bg-white rounded-xl shadow-card p-4 md:p-6">
              <h2 className="font-heading font-bold text-base md:text-xl text-ink mb-3">Sign in to continue</h2>
              <p className="text-muted text-sm mb-4">
                Please <Link to="/login" className="text-primary font-semibold">sign in</Link> or{' '}
                <Link to="/register" className="text-primary font-semibold">create an account</Link>.
              </p>
              <Link to="/login">
                <Button variant="primary" size="lg" fullWidth>Sign In</Button>
              </Link>
            </div>
          )}

          {/* Step 2 — Address */}
          {step === 2 && (
            <div className="bg-white rounded-xl shadow-card p-4 md:p-6">
              <h2 className="font-heading font-bold text-base md:text-xl text-ink mb-3">Delivery Address</h2>

              {!showAddressForm && addresses.length > 0 && (
                <div className="space-y-2 mb-4">
                  {addresses.map((a) => (
                    <label
                      key={a.id}
                      className={`block border-2 rounded-xl p-3 cursor-pointer transition-all
                        ${selectedAddressId === a.id ? 'border-primary bg-primary/5' : 'border-gray-200 hover:border-gray-300'}`}
                    >
                      <div className="flex items-start gap-2.5">
                        <input
                          type="radio"
                          checked={selectedAddressId === a.id}
                          onChange={() => setSelectedAddressId(a.id)}
                          className="mt-0.5 accent-primary shrink-0"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-semibold text-xs md:text-sm text-ink">{a.name}</span>
                            <span className="text-[10px] bg-gray-100 text-muted px-1.5 py-0.5 rounded-full">{a.label}</span>
                            {a.is_default && (
                              <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded-full font-medium">Default</span>
                            )}
                          </div>
                          <p className="text-[11px] text-muted mt-0.5">{a.phone}</p>
                          <p className="text-[11px] text-muted leading-relaxed">
                            {a.house_no}, {a.area}, {a.village}, {a.taluka}, {a.district} — {a.pincode}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={async (e) => {
                            e.preventDefault();
                            if (confirm('Delete this address?')) {
                              await deleteAddress(a.id);
                              if (selectedAddressId === a.id) setSelectedAddressId(null);
                            }
                          }}
                          className="text-gray-400 hover:text-red-500 p-1 shrink-0"
                        >
                          <Trash2Icon size={14} />
                        </button>
                      </div>
                    </label>
                  ))}
                </div>
              )}

              {showAddressForm && (
                <div className="mb-4">
                  <AddressForm
                    onSave={handleSaveAddress}
                    onCancel={addresses.length > 0 ? () => setShowAddressForm(false) : undefined}
                  />
                </div>
              )}

              {!showAddressForm && (
                <button
                  type="button"
                  onClick={() => setShowAddressForm(true)}
                  className="flex items-center gap-1.5 text-sm text-primary font-medium hover:underline mb-4"
                >
                  <PlusIcon size={15} /> Add new address
                </button>
              )}

              {selectedAddressId && !showAddressForm && (
                <Button variant="primary" size="lg" fullWidth onClick={() => setStep(3)}>
                  Continue to Payment
                </Button>
              )}
            </div>
          )}

          {/* Step 3 — Payment */}
          {step === 3 && (
            <div className="bg-white rounded-xl shadow-card p-4 md:p-6">
              <h2 className="font-heading font-bold text-base md:text-xl text-ink mb-3">Payment Method</h2>

              {pincodeLoading ? (
                <div className="flex items-center gap-2 text-xs text-muted mb-4">
                  <Loader2Icon size={13} className="animate-spin" /> Checking delivery availability...
                </div>
              ) : pincodeRateLimited ? (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-4 text-sm text-amber-800">
                  Too many pincode checks. Please place order retry in {pincodeRateLimitSeconds} seconds.
                </div>
              ) : notDeliverable ? (
                <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-4 text-sm text-red-700">
                  Sorry, delivery is not available at your selected pincode. Please choose a different address.
                </div>
              ) : deliveryStatusUnknown ? (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-4 text-sm text-amber-800">
                  {pincodeError || 'Unable to verify delivery at your selected pincode. Please retry in a moment.'}
                </div>
              ) : (
                <div className="space-y-2.5 mb-5">
                  {codEligible && (
                    <label className={`flex items-center gap-3 border-2 rounded-xl p-3 md:p-4 cursor-pointer transition-all
                      ${paymentMethod === 'cod' ? 'border-primary bg-primary/5' : 'border-gray-200 hover:border-gray-300'}`}>
                      <input type="radio" name="pm" checked={paymentMethod === 'cod'}
                        onChange={() => setPaymentMethod('cod')} className="accent-primary" />
                      <BanknoteIcon size={20} className="text-success shrink-0" />
                      <div>
                        <p className="font-semibold text-ink text-xs md:text-sm">Cash on Delivery</p>
                        <p className="text-xs text-muted">Pay when your order arrives</p>
                      </div>
                    </label>
                  )}
                  {!codEligible && cartCodEligible && pincodeService && !pincodeService.cod && (
                    <div className="flex items-center gap-3 border-2 border-gray-100 rounded-xl p-3 md:p-4 opacity-50 cursor-not-allowed">
                      <BanknoteIcon size={20} className="text-gray-400 shrink-0" />
                      <div>
                        <p className="font-semibold text-gray-400 text-xs md:text-sm">Cash on Delivery</p>
                        <p className="text-xs text-red-400">COD not available at your pincode</p>
                      </div>
                    </div>
                  )}
                  {onlineEligible && (
                    <label className={`flex items-center gap-3 border-2 rounded-xl p-3 md:p-4 cursor-pointer transition-all
                      ${paymentMethod === 'online' ? 'border-primary bg-primary/5' : 'border-gray-200 hover:border-gray-300'}`}>
                      <input type="radio" name="pm" checked={paymentMethod === 'online'}
                        onChange={() => setPaymentMethod('online')} className="accent-primary" />
                      <CreditCardIcon size={20} className="text-primary shrink-0" />
                      <div>
                        <p className="font-semibold text-ink text-xs md:text-sm">Online Payment</p>
                        <p className="text-xs text-muted">UPI, Cards, Net Banking via Cashfree</p>
                      </div>
                    </label>
                  )}
                </div>
              )}

              <div className="flex items-center gap-1.5 text-xs text-muted mb-4">
                <LockIcon size={12} /> Secured by Cashfree · 256-bit SSL
              </div>

              <Button variant="primary" size="lg" fullWidth
                onClick={handlePlaceOrder} disabled={placing || !paymentMethod || notDeliverable || pincodeLoading || deliveryStatusUnknown}>
                {placing ? (
                  <span className="flex items-center gap-2 justify-center">
                    <Loader2Icon size={16} className="animate-spin" />
                    {paymentMethod === 'online' ? 'Redirecting...' : 'Placing order...'}
                  </span>
                ) : `Place Order · ${formatINR(total)}`}
              </Button>
            </div>
          )}
        </div>

        {/* ── Order Summary sidebar ─────────────────────────────────────────── */}
        <div className="bg-white rounded-xl shadow-card p-4 md:p-5 h-fit lg:sticky lg:top-20">
          {/* Mobile: collapsible header */}
          <button
            type="button"
            onClick={() => setSummaryOpen(!summaryOpen)}
            className="w-full flex items-center justify-between md:cursor-default"
          >
            <h3 className="font-heading font-bold text-sm md:text-base text-ink">
              Order Summary · {formatINR(total)}
            </h3>
            <ChevronDownIcon
              size={16}
              className={`md:hidden text-muted transition-transform duration-200 ${summaryOpen ? 'rotate-180' : ''}`}
            />
          </button>

          <div className={`overflow-hidden transition-all duration-200 md:block ${summaryOpen ? 'max-h-[600px]' : 'max-h-0 md:max-h-none'}`}>
            {/* Items list */}
            <div className="space-y-2.5 mt-3 mb-3 max-h-56 overflow-y-auto">
              {items.map((item) => (
                <div key={item.variant_id} className="flex gap-2.5 items-center">
                  <div className="w-10 h-10 md:w-12 md:h-12 bg-bg rounded-lg shrink-0 overflow-hidden">
                    <img src={getImageUrl(item.image)} alt={item.name} className="w-full h-full object-contain p-1" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-ink line-clamp-1">{item.name}</p>
                    <p className="text-[10px] text-muted">{item.color} · {item.storage} · Qty {item.qty}</p>
                  </div>
                  <span className="text-xs md:text-sm font-semibold text-ink shrink-0">{formatINR(item.price * item.qty)}</span>
                </div>
              ))}
            </div>

            {/* Price breakdown */}
            <div className="border-t border-gray-100 pt-3 space-y-1.5 text-sm">
              <div className="flex justify-between text-muted text-xs md:text-sm">
                <span>Subtotal</span><span>{formatINR(sub)}</span>
              </div>
              <div className="flex justify-between text-muted text-xs md:text-sm">
                <span>Shipping</span>
                <span className={shippingFee === 0 ? 'text-success font-medium' : ''}>
                  {shippingFee === 0 ? 'FREE' : formatINR(shippingFee)}
                </span>
              </div>
              <div className="flex justify-between font-bold text-ink text-sm md:text-base border-t border-gray-100 pt-2">
                <span>Total</span><span>{formatINR(total)}</span>
              </div>
            </div>

            {/* ── GST estimate ─────────────────────────────────────────────── */}
            <div className="mt-2.5 bg-gray-50 rounded-lg p-2.5 space-y-1 text-[10px] md:text-xs text-muted border border-gray-100">
              <p className="font-semibold text-ink text-[11px]">Tax Breakdown (estimated)</p>
              <div className="flex justify-between">
                <span>Taxable amount (ex-GST)</span>
                <span>{formatINR(parseFloat(estimatedTaxable.toFixed(2)))}</span>
              </div>
              <div className="flex justify-between">
                <span>GST (CGST + SGST)</span>
                <span>{formatINR(parseFloat(estimatedGst.toFixed(2)))}</span>
              </div>
              <p className="text-[9px] md:text-[10px] text-gray-400 mt-0.5">
                Exact GST split per item is shown on your invoice after order.
              </p>
            </div>
            {/* ─────────────────────────────────────────────────────────────── */}

            {!cartCodEligible && (
              <p className="text-xs text-amber-600 bg-amber-50 rounded-lg p-2 mt-3">
                Some items don't support Cash on Delivery.
              </p>
            )}
          </div>
        </div>
        {/* ──────────────────────────────────────────────────────────────────── */}
      </div>
    </div>
  );
}
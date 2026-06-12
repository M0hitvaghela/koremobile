import React, { useState, useEffect } from 'react';
import { Loader2Icon } from 'lucide-react';
import { useSettingsStore } from '../../store/settingsStore';
import { useToastStore } from '../../store/toastStore';
import { adminSettingsApi } from '../../utils/adminApi';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';

export function AdminSettings() {
  const settingsStore = useSettingsStore();
  const showToast = useToastStore((s) => s.showToast);

  const [form, setForm] = useState({
    freeShippingThreshold: settingsStore.freeShippingThreshold,
    flatShippingFee: settingsStore.flatShippingFee,
    enableFreeShipping: settingsStore.enableFreeShipping,
    defaultCodEnabled: settingsStore.defaultCodEnabled,
    defaultOnlineEnabled: settingsStore.defaultOnlineEnabled,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Load settings from backend on mount
  useEffect(() => {
    adminSettingsApi
      .get()
      .then((data) => {
        setForm(data);
        settingsStore.update(data); // keep local store in sync
      })
      .catch(() => {
        // Fall back to whatever is in local store already
      })
      .finally(() => setLoading(false));
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      await adminSettingsApi.update(form);
      settingsStore.update(form); // sync local store (used by checkout)
      showToast('Settings saved', 'success');
    } catch {
      showToast('Failed to save settings', 'error');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2Icon size={26} className="animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4 max-w-3xl">
      <div>
        <h1 className="font-heading font-bold text-2xl text-white">Settings</h1>
        <p className="text-sm text-gray-400 mt-1">Configure your store</p>
      </div>

      {/* Shipping */}
      <div className="bg-adminSurf border border-adminBorder rounded-xl p-6 space-y-4">
        <h3 className="font-heading font-semibold text-lg text-white">
          Shipping Configuration
        </h3>
        <div className="grid sm:grid-cols-2 gap-4">
          <Input
            dark
            label="Free Shipping Threshold (₹)"
            type="number"
            value={form.freeShippingThreshold}
            onChange={(e) =>
              setForm({ ...form, freeShippingThreshold: +e.target.value })
            }
            hint="Orders above this amount get free shipping"
          />
          <Input
            dark
            label="Flat Shipping Fee (₹)"
            type="number"
            value={form.flatShippingFee}
            onChange={(e) =>
              setForm({ ...form, flatShippingFee: +e.target.value })
            }
            hint="Charged on orders below threshold"
          />
        </div>
        <Toggle
          label="Enable Free Shipping"
          description="Apply free shipping when threshold is met"
          checked={form.enableFreeShipping}
          onChange={(v) => setForm({ ...form, enableFreeShipping: v })}
        />
      </div>

      {/* Payment */}
      <div className="bg-adminSurf border border-adminBorder rounded-xl p-6 space-y-4">
        <h3 className="font-heading font-semibold text-lg text-white">
          Payment Configuration
        </h3>
        <Toggle
          label="Default COD Enabled"
          description="New products allow Cash on Delivery by default"
          checked={form.defaultCodEnabled}
          onChange={(v) => setForm({ ...form, defaultCodEnabled: v })}
        />
        <Toggle
          label="Default Online Payment Enabled"
          description="New products allow online payment by default"
          checked={form.defaultOnlineEnabled}
          onChange={(v) => setForm({ ...form, defaultOnlineEnabled: v })}
        />
      </div>

      <div className="flex justify-end">
        <Button variant="primary" size="lg" onClick={save} disabled={saving}>
          {saving ? 'Saving…' : 'Save Settings'}
        </Button>
      </div>
    </div>
  );
}

function Toggle({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-4 py-2">
      <div>
        <div className="text-sm font-semibold text-white">{label}</div>
        {description && (
          <div className="text-xs text-gray-400 mt-0.5">{description}</div>
        )}
      </div>
      <label className="cursor-pointer shrink-0 mt-1">
        <span className="relative inline-block w-10 h-6">
          <input
            type="checkbox"
            checked={checked}
            onChange={(e) => onChange(e.target.checked)}
            className="sr-only peer"
          />
          <span className="absolute inset-0 bg-adminBg border border-adminBorder rounded-full peer-checked:bg-primary transition-colors" />
          <span className="absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform peer-checked:translate-x-4" />
        </span>
      </label>
    </div>
  );
}
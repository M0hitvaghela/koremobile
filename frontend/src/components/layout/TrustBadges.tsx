import React, { Fragment, useEffect } from 'react';
import {
  TruckIcon,
  BanknoteIcon,
  ReceiptIcon,
  ShieldCheckIcon,
  RotateCcwIcon,
} from 'lucide-react';
import { useSettingsStore } from '../../store/settingsStore';
import { formatINR } from '../../utils/formatPrice';

export function TrustBadges() {
  const freeShippingThreshold = useSettingsStore((s) => s.freeShippingThreshold);
  const flatShippingFee = useSettingsStore((s) => s.flatShippingFee);
  const enableFreeShipping = useSettingsStore((s) => s.enableFreeShipping);
  const defaultCodEnabled = useSettingsStore((s) => s.defaultCodEnabled);
  const fetchSettings = useSettingsStore((s) => s.fetchSettings);

  useEffect(() => { fetchSettings(); }, [fetchSettings]);

  const shippingLabel = enableFreeShipping
    ? `Free Delivery above ${formatINR(freeShippingThreshold)}`
    : `Delivery ${formatINR(flatShippingFee)}`;

  const items = [
    { icon: TruckIcon,       label: shippingLabel },
    { icon: BanknoteIcon,    label: defaultCodEnabled ? 'Cash on Delivery' : 'Online Payments' },
    { icon: ReceiptIcon,     label: 'GST Invoice' },
    { icon: ShieldCheckIcon, label: '100% Secure' },
    { icon: RotateCcwIcon,   label: 'Easy Returns' },
  ];

  return (
    <div className="bg-bg w-full border-y border-gray-200">
      <div className="max-w-7xl mx-auto px-3 sm:px-4 py-2 flex items-center justify-start md:justify-center gap-3 md:gap-8 overflow-x-auto no-scrollbar">
        {items.map((item, i) => {
          const Icon = item.icon;
          return (
            <Fragment key={i}>
              <div className="flex items-center gap-1.5 shrink-0">
                <Icon size={14} className="text-primary shrink-0" />
                <span className="text-[10px] md:text-sm text-ink font-medium whitespace-nowrap">
                  {item.label}
                </span>
              </div>
              {i < items.length - 1 && (
                <span className="text-gray-300 shrink-0 hidden md:inline">|</span>
              )}
            </Fragment>
          );
        })}
      </div>
    </div>
  );
}
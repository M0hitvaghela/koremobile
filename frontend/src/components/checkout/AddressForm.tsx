import React, { useState } from 'react';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { GujaratCascade } from './GujaratCascade';
import { Address } from '../../types/order';

interface AddressFormProps {
  initial?: Address;
  onSave: (a: Address) => void;
  onCancel?: () => void;
  dark?: boolean;
}

const blank: Address = {
  name: '',
  phone: '',
  house_no: '',
  area: '',
  village: '',
  taluka: '',
  district: '',
  pincode: '',
  state: 'Gujarat',
  label: 'Home',
  is_default: false,
  gstin: '',
};

export function AddressForm({ initial, onSave, onCancel, dark }: AddressFormProps) {
  const [data, setData] = useState<Address>(initial || blank);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = () => {
    const e: Record<string, string> = {};
    if (!data.name.trim()) e.name = 'Required';
    if (!/^\d{10}$/.test(data.phone)) e.phone = 'Enter a valid 10-digit phone';
    if (!data.house_no.trim()) e.house_no = 'Required';
    if (!data.area.trim()) e.area = 'Required';
    if (!data.district) e.district = 'Required';
    if (!data.taluka) e.taluka = 'Required';
    if (!data.village) e.village = 'Required';
    if (!/^\d{6}$/.test(data.pincode)) e.pincode = 'Enter a valid 6-digit pincode';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSave = () => {
    if (validate()) onSave(data);
  };

  const labelBtn = (label: 'Home' | 'Work' | 'Other') => (
    <button
      key={label}
      onClick={() => setData({ ...data, label })}
      className={`px-4 py-2 rounded-full text-sm font-medium border transition-colors ${
        data.label === label
          ? 'bg-primary text-white border-primary'
          : dark
          ? 'bg-adminBg text-gray-300 border-adminBorder hover:border-primary'
          : 'bg-white text-ink border-gray-300 hover:border-primary'
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="space-y-4">
      {/* Name + Phone */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Input
          label="Full Name"
          required
          dark={dark}
          value={data.name}
          onChange={(e) => setData({ ...data, name: e.target.value })}
          error={errors.name}
        />
        <Input
          label="Phone Number"
          required
          dark={dark}
          maxLength={10}
          value={data.phone}
          onChange={(e) =>
            setData({ ...data, phone: e.target.value.replace(/\D/g, '') })
          }
          error={errors.phone}
        />
      </div>

      {/* House + Area */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Input
          label="House No / Flat / Building"
          required
          dark={dark}
          value={data.house_no}
          onChange={(e) => setData({ ...data, house_no: e.target.value })}
          error={errors.house_no}
        />
        <Input
          label="Area / Street / Locality"
          required
          dark={dark}
          value={data.area}
          onChange={(e) => setData({ ...data, area: e.target.value })}
          error={errors.area}
        />
      </div>

      {/*
        GujaratCascade now owns the Pincode field too.
        Entering a pincode auto-fills District + Taluka and narrows the Village list.
        Picking a Village auto-fills its pincode.
      */}
      <GujaratCascade
        district={data.district}
        taluka={data.taluka}
        village={data.village}
        pincode={data.pincode}
        onChange={(d) => setData({ ...data, ...d })}
        errors={errors}
        dark={dark}
      />

      {/* State (read-only) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Input label="State" disabled value="Gujarat" dark={dark} />
      </div>

      {/* Address Type */}
      <div>
        <div
          className={`block text-sm font-medium mb-2 ${
            dark ? 'text-gray-200' : 'text-ink'
          }`}
        >
          Address Type
        </div>
        <div className="flex gap-2 flex-wrap">
          {(['Home', 'Work', 'Other'] as const).map(labelBtn)}
        </div>
      </div>

      {/* GSTIN */}
      <Input
        label="GSTIN (optional)"
        hint="For GST Invoice"
        dark={dark}
        value={data.gstin || ''}
        onChange={(e) =>
          setData({ ...data, gstin: e.target.value.toUpperCase() })
        }
      />

      {/* Default checkbox */}
      <label className="flex items-center gap-2 cursor-pointer text-sm">
        <input
          type="checkbox"
          checked={data.is_default}
          onChange={(e) => setData({ ...data, is_default: e.target.checked })}
          className="w-4 h-4 accent-primary"
        />
        <span className={dark ? 'text-gray-200' : 'text-ink'}>
          Set as default address
        </span>
      </label>

      {/* Actions */}
      <div className="flex gap-3 pt-2">
        <Button variant="primary" onClick={handleSave}>
          Save Address
        </Button>
        {onCancel && (
          <button
            onClick={onCancel}
            className={`text-sm font-semibold ${
              dark ? 'text-gray-400' : 'text-muted'
            } hover:underline`}
          >
            Cancel
          </button>
        )}
      </div>
    </div>
  );
}
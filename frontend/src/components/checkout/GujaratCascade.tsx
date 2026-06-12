import React, { useMemo, useState, useEffect } from 'react';
import { Select } from '../ui/Input';
import {
  getDistricts,
  getTalukas,
  getPincodes,
  lookupByPincode,
  PincodeMatch,
  getDeliveryCache,
  setDeliveryCache,
  setCityCache,
} from '../../utils/gujaratData';
import { api } from '../../utils/api';

interface CascadeValue {
  district: string;
  taluka: string;
  village: string;
  pincode: string;
}

interface GujaratCascadeProps {
  district: string;
  taluka: string;
  village: string;
  pincode: string;
  onChange: (data: CascadeValue) => void;
  errors?: {
    district?: string;
    taluka?: string;
    village?: string;
    pincode?: string;
  };
  dark?: boolean;
}

export function GujaratCascade({
  district,
  taluka,
  village,
  pincode,
  onChange,
  errors,
  dark,
}: GujaratCascadeProps) {
  const [pincodeInput, setPincodeInput] = useState(pincode);
  const [pincodeStatus, setPincodeStatus] = useState<'idle' | 'found' | 'not_found'>('idle');
  // When a pincode matches multiple talukas, store them for user to pick
  const [talukaChoices, setTalukaChoices] = useState<PincodeMatch[]>([]);

  const districts = useMemo(() => getDistricts(), []);
  const talukas = useMemo(() => getTalukas(district), [district]);
  const pincodes = useMemo(() => getPincodes(district, taluka), [district, taluka]);

  useEffect(() => { setPincodeInput(pincode); }, [pincode]);

  const inputBase = dark
    ? 'bg-adminBg border-adminBorder text-gray-100'
    : 'bg-white border-gray-300 text-ink';

  const handlePincodeChange = async (raw: string) => {
    const val = raw.replace(/\D/g, '').slice(0, 6);
    setPincodeInput(val);
    setPincodeStatus('idle');
    setTalukaChoices([]);

    if (val.length !== 6) {
      onChange({ district, taluka, village, pincode: val });
      return;
    }

    const matches = lookupByPincode(val);
    if (matches.length === 0) {
      setPincodeStatus('not_found');
      onChange({ district, taluka, village, pincode: val });
      return;
    }

    const unique = [...new Map(matches.map(m => [`${m.district}|${m.taluka}`, m])).values()];

    if (unique.length === 1) {
      // Only one taluka — auto-fill directly
      setPincodeStatus('found');
      onChange({ district: unique[0].district, taluka: unique[0].taluka, village, pincode: val });
      return;
    }

    // Multiple talukas — call API to get correct city_name and auto-select
    try {
      const cached = getDeliveryCache(val);
      let cityName = '';

      if (cached) {
        // Already have API data — use cached city
        const { getCityCache } = await import('../../utils/gujaratData');
        cityName = getCityCache(val) ?? '';
      } else {
        const res = await api.get(`pincode/check?pincode=${val}`);
        const { deliverable, cod, prepaid, city, state } = res.data;
        setDeliveryCache(val, { deliverable, cod, prepaid });
        setCityCache(val, city ? `${city}, ${state}` : '');
        cityName = city ?? '';
      }

      // Try to find the taluka whose name matches city_name from API
      const cityLower = cityName.toLowerCase().trim();
      const apiMatch = cityLower
        ? unique.find(m => m.taluka.toLowerCase().includes(cityLower) || cityLower.includes(m.taluka.toLowerCase()))
        : null;

      setPincodeStatus('found');

      if (apiMatch) {
        // API confirmed the correct taluka — auto-fill silently, no choice box shown
        onChange({ district: apiMatch.district, taluka: apiMatch.taluka, village, pincode: val });
        setTalukaChoices([]); // hide choices — auto-selected correctly
      } else {
        // API city didn't match any taluka name — show all options for user to pick
        setTalukaChoices(unique);
        onChange({ district: unique[0].district, taluka: '', village, pincode: val });
      }
    } catch {
      // API failed — show all taluka choices
      setPincodeStatus('found');
      setTalukaChoices(unique);
      onChange({ district: unique[0].district, taluka: '', village, pincode: val });
    }
  };

  const handleTalukaChoice = (key: string) => {
    const [d, t] = key.split('|');
    setTalukaChoices([]);
    onChange({ district: d, taluka: t, village, pincode: pincodeInput });
  };

  const handleDistrictChange = (d: string) => {
    setPincodeInput('');
    setPincodeStatus('idle');
    setTalukaChoices([]);
    onChange({ district: d, taluka: '', village: '', pincode: '' });
  };

  const handleTalukaChange = (t: string) => {
    setPincodeInput('');
    setPincodeStatus('idle');
    setTalukaChoices([]);
    onChange({ district, taluka: t, village: '', pincode: '' });
  };

  const handlePincodeSelect = (pin: string) => {
    setPincodeInput(pin);
    setPincodeStatus('found');
    setTalukaChoices([]);
    onChange({ district, taluka, village, pincode: pin });
  };

  return (
    <div className="space-y-4">
      {/* Pincode entry */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className={`block text-sm font-medium mb-1 ${dark ? 'text-gray-200' : 'text-ink'}`}>
            Pincode <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <input
              type="text"
              inputMode="numeric"
              maxLength={6}
              value={pincodeInput}
              placeholder="Enter 6-digit pincode"
              onChange={(e) => handlePincodeChange(e.target.value)}
              className={`w-full px-3 py-2 rounded-lg border text-sm outline-none transition-colors focus:border-primary ${inputBase} ${
                errors?.pincode ? 'border-red-400' : ''
              }`}
            />
            {pincodeInput.length === 6 && (
              <span className={`absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium ${
                pincodeStatus === 'found' ? 'text-green-500' : 'text-red-400'
              }`}>
                {pincodeStatus === 'found' ? '✓ Found' : '✗ Not found'}
              </span>
            )}
          </div>
          {errors?.pincode && <p className="text-xs text-red-400 mt-1">{errors.pincode}</p>}
          {pincodeStatus === 'not_found' && (
            <p className="text-xs text-amber-500 mt-1">
              Pincode not found — please select district &amp; taluka manually.
            </p>
          )}
        </div>
        <div className="flex items-end">
          <p className={`text-xs pb-2 ${dark ? 'text-gray-400' : 'text-muted'}`}>
            Enter pincode to auto-fill district &amp; taluka, or select manually below.
          </p>
        </div>
      </div>

      {/* Ambiguous pincode — ask user to pick correct taluka */}
      {talukaChoices.length > 0 && (
        <div className={`rounded-lg border p-3 ${dark ? 'bg-adminBg border-adminBorder' : 'bg-amber-50 border-amber-200'}`}>
          <p className={`text-xs font-medium mb-2 ${dark ? 'text-amber-400' : 'text-amber-700'}`}>
            Pincode {pincodeInput} covers multiple talukas. {taluka ? 'Auto-selected based on location — change if needed:' : 'Please select yours:'}
          </p>
          <div className="flex flex-wrap gap-2">
            {talukaChoices.map((m) => {
              const isSelected = m.district === district && m.taluka === taluka;
              return (
                <button
                  key={`${m.district}|${m.taluka}`}
                  type="button"
                  onClick={() => handleTalukaChoice(`${m.district}|${m.taluka}`)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                    isSelected
                      ? 'bg-primary text-white border-primary'
                      : dark
                      ? 'border-adminBorder text-gray-200 hover:border-primary hover:text-primary'
                      : 'border-amber-300 text-amber-800 hover:border-primary hover:text-primary hover:bg-white'
                  }`}
                >
                  {isSelected ? '✓ ' : ''}{m.taluka}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* District + Taluka + Pincode */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Select
          label="District"
          required
          dark={dark}
          value={district}
          error={errors?.district}
          onChange={(e) => handleDistrictChange(e.target.value)}
        >
          <option value="">Select District</option>
          {districts.map((d) => (
            <option key={d} value={d}>{d}</option>
          ))}
        </Select>

        <Select
          label="Taluka"
          required
          dark={dark}
          value={taluka}
          disabled={!district}
          error={errors?.taluka}
          onChange={(e) => handleTalukaChange(e.target.value)}
        >
          <option value="">Select Taluka</option>
          {talukas.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </Select>

        <Select
          label="Pincode"
          required
          dark={dark}
          value={pincode}
          disabled={!taluka}
          error={errors?.pincode}
          onChange={(e) => handlePincodeSelect(e.target.value)}
        >
          <option value="">Select Pincode</option>
          {pincodes.map((p) => (
            <option key={p} value={p}>{p}</option>
          ))}
        </Select>
      </div>

      {/* Village — manual text input */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className={`block text-sm font-medium mb-1 ${dark ? 'text-gray-200' : 'text-ink'}`}>
            Village / City <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={village}
            placeholder="Enter your village or city name"
            onChange={(e) => onChange({ district, taluka, village: e.target.value, pincode })}
            className={`w-full px-3 py-2 rounded-lg border text-sm outline-none transition-colors focus:border-primary ${inputBase} ${
              errors?.village ? 'border-red-400' : ''
            }`}
          />
          {errors?.village && <p className="text-xs text-red-400 mt-1">{errors.village}</p>}
        </div>
      </div>
    </div>
  );
}
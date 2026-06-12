import React, { useEffect, useState } from 'react';
import { PlusIcon, Trash2Icon, CheckCircleIcon, Loader2Icon, EditIcon } from 'lucide-react';
import { useAddressStore } from '../../store/addressStore';
import { useAuthStore } from '../../store/authStore';
import { useToastStore } from '../../store/toastStore';
import { AddressForm } from '../../components/checkout/AddressForm';
import { Button } from '../../components/ui/Button';
import type { Address } from '../../types/order';
import type { AddressOut } from '../../utils/ordersApi';

function addrToLocal(a: AddressOut): Address {
  return {
    id: String(a.id),
    label: (a.label || 'Home') as 'Home' | 'Work' | 'Other',
    name: a.name,
    phone: a.phone,
    house_no: a.house_no,
    area: a.area,
    village: a.village,
    taluka: a.taluka,
    district: a.district,
    pincode: a.pincode,
    state: a.state,
    is_default: a.is_default,
    gstin: a.gstin,
  };
}

export function Addresses() {
  const { addresses, loading, fetchAddresses, addAddress, updateAddress, deleteAddress, setDefault } =
    useAddressStore();
  const user = useAuthStore((s) => s.user);   // ✅ get logged-in user
  const showToast = useToastStore((s) => s.showToast);

  const [showForm, setShowForm] = useState(false);
  const [editAddr, setEditAddr] = useState<AddressOut | null>(null);

  useEffect(() => { fetchAddresses(); }, []);

  // ✅ blank pre-filled with user's name + phone from their profile
  const blankWithUser: Address = {
    name: user?.name || '',
    phone: user?.phone || '',
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

  const handleSave = async (a: Address) => {
    const payload = {
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
      gstin: a.gstin,
    };

    if (editAddr) {
      const ok = await updateAddress(editAddr.id, payload);
      if (ok) { showToast('Address updated', 'success'); setEditAddr(null); }
      else showToast('Failed to update address', 'error');
    } else {
      const ok = await addAddress(payload);
      if (ok) { showToast('Address added', 'success'); setShowForm(false); }
      else showToast('Failed to add address', 'error');
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this address?')) return;
    const ok = await deleteAddress(id);
    if (ok) showToast('Address deleted', 'success');
    else showToast('Failed to delete address', 'error');
  };

  const handleSetDefault = async (id: number) => {
    const ok = await setDefault(id);
    if (ok) showToast('Default address updated', 'success');
    else showToast('Failed to update default', 'error');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2Icon size={28} className="animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-3 md:space-y-4">

      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="font-heading font-bold text-base md:text-lg text-ink">Saved Addresses</h2>
        <Button
          variant="outline"
          size="sm"
          onClick={() => { setShowForm(true); setEditAddr(null); }}
          className="flex items-center gap-1.5 text-xs md:text-sm"
        >
          <PlusIcon size={14} /> Add Address
        </Button>
      </div>

      {/* Address Form */}
      {(showForm || editAddr) && (
        <div className="bg-white rounded-xl shadow-card p-4 md:p-5">
          <h3 className="font-semibold text-sm text-ink mb-3">
            {editAddr ? 'Edit Address' : 'New Address'}
          </h3>
          <AddressForm
            // ✅ new form gets user's name+phone pre-filled; edit form keeps original data
            initial={editAddr ? addrToLocal(editAddr) : blankWithUser}
            onSave={handleSave}
            onCancel={() => { setShowForm(false); setEditAddr(null); }}
          />
        </div>
      )}

      {/* Empty state */}
      {addresses.length === 0 && !showForm && (
        <div className="text-center py-14">
          <p className="text-muted text-sm">No saved addresses yet.</p>
        </div>
      )}

      {/* Address cards */}
      {addresses.map((addr) => (
        <div
          key={addr.id}
          className={`bg-white rounded-xl shadow-card p-4 md:p-5 border-2 transition-colors ${
            addr.is_default ? 'border-primary' : 'border-transparent'
          }`}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              {/* Name + badges */}
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <span className="font-semibold text-xs md:text-sm text-ink">{addr.name}</span>
                <span className="text-[10px] md:text-xs bg-gray-100 text-muted px-2 py-0.5 rounded-full">
                  {addr.label}
                </span>
                {addr.is_default && (
                  <span className="flex items-center gap-1 text-[10px] md:text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium">
                    <CheckCircleIcon size={10} /> Default
                  </span>
                )}
              </div>
              <p className="text-[11px] md:text-xs text-muted">{addr.phone}</p>
              <p className="text-[11px] md:text-xs text-muted leading-relaxed mt-0.5">
                {addr.house_no}, {addr.area}, {addr.village}, {addr.taluka},{' '}
                {addr.district}, {addr.state} — {addr.pincode}
              </p>
              {addr.gstin && (
                <p className="text-[11px] md:text-xs text-muted mt-1">GSTIN: {addr.gstin}</p>
              )}
            </div>

            {/* Action buttons */}
            <div className="flex items-center gap-1 shrink-0">
              <button
                onClick={() => setEditAddr(addr)}
                className="text-muted hover:text-primary p-2 rounded-lg hover:bg-primary/5 transition-colors"
              >
                <EditIcon size={15} />
              </button>
              <button
                onClick={() => handleDelete(addr.id)}
                className="text-muted hover:text-red-500 p-2 rounded-lg hover:bg-red-50 transition-colors"
              >
                <Trash2Icon size={15} />
              </button>
            </div>
          </div>

          {!addr.is_default && (
            <button
              onClick={() => handleSetDefault(addr.id)}
              className="mt-2.5 text-xs text-primary font-medium hover:underline"
            >
              Set as default
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
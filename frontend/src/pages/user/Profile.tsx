import React, { useEffect, useState } from 'react';
import { Loader2Icon, SaveIcon } from 'lucide-react';
import { userApi, UserProfileOut } from '../../utils/ordersApi';
import { useToastStore } from '../../store/toastStore';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';

export function Profile() {
  const showToast = useToastStore((s) => s.showToast);
  const [profile, setProfile] = useState<UserProfileOut | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');

  useEffect(() => {
    userApi.getProfile()
      .then((p) => {
        setProfile(p);
        setName(p.name || '');
        setEmail(p.email || '');
        setPhone(p.phone || '');
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload: Record<string, string> = {};
      if (name !== profile?.name) payload.name = name;
      if (email !== profile?.email) payload.email = email;
      if (phone !== profile?.phone) payload.phone = phone;

      if (Object.keys(payload).length === 0) {
        showToast('No changes to save', 'info');
        setSaving(false);
        return;
      }

      const updated = await userApi.updateProfile(payload);
      setProfile(updated);
      showToast('Profile updated', 'success');
    } catch (err: any) {
      const msg = err?.response?.data?.detail || 'Failed to update profile';
      showToast(msg, 'error');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2Icon size={28} className="animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4 md:space-y-5">
      <h2 className="font-heading font-bold text-base md:text-lg text-ink">My Profile</h2>

      <div className="bg-white rounded-xl shadow-card p-4 md:p-6 space-y-4 w-full max-w-md">
        <Input
          label="Full Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Your name"
        />
        <Input
          label="Email Address"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="your@email.com"
        />
        <Input
          label="Phone Number"
          type="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
          placeholder="10-digit mobile number"
          maxLength={10}
        />

        {/* Account meta info */}
        <div className="text-xs text-muted bg-gray-50 rounded-lg p-3 space-y-1">
          <p>
            Auth method:{' '}
            <span className="font-medium text-ink capitalize">
              {profile?.auth_method || 'email'}
            </span>
          </p>
          <p>
            Verified:{' '}
            <span className={`font-medium ${profile?.is_verified ? 'text-success' : 'text-red-500'}`}>
              {profile?.is_verified ? 'Yes' : 'No'}
            </span>
          </p>
        </div>

        <Button
          variant="primary"
          size="md"
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 w-full sm:w-auto"
        >
          {saving ? <Loader2Icon size={14} className="animate-spin" /> : <SaveIcon size={14} />}
          Save Changes
        </Button>
      </div>
    </div>
  );
}
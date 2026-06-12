import React from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  PackageIcon,
  MapPinIcon,
  UserIcon,
  ReceiptIcon,
  LogOutIcon,
  MonitorSmartphoneIcon,
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';

const nav = [
  {
    to: '/account/orders',
    label: 'My Orders',
    icon: PackageIcon,
  },
  {
    to: '/account/addresses',
    label: 'My Addresses',
    icon: MapPinIcon,
  },
  {
    to: '/account/profile',
    label: 'My Profile',
    icon: UserIcon,
  },
  {
    to: '/account/profile',
    label: 'GST Details',
    icon: ReceiptIcon,
    hash: '#gst',
  },
  {
    to: '/account/sessions',
    label: 'Active Sessions',
    icon: MonitorSmartphoneIcon,
  },
];

export function UserLayout() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  if (!user) return null;

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 w-full">
      <div className="grid lg:grid-cols-[260px_1fr] gap-6">
        <aside className="space-y-2">
          <div className="bg-white rounded-xl shadow-card p-5">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-primary text-white font-bold flex items-center justify-center">
                {user.name.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0">
                <div className="font-semibold text-sm text-ink truncate">
                  {user.name}
                </div>
                <div className="text-xs text-muted truncate">{user.email}</div>
              </div>
            </div>
          </div>

          <nav className="bg-white rounded-xl shadow-card p-2">
            {nav.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.label}
                  to={item.to + (item.hash || '')}
                  end={item.to === '/account/orders'}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                      isActive
                        ? 'bg-primary-50 text-primary'
                        : 'text-ink hover:bg-bg'
                    }`
                  }
                >
                  <Icon size={16} />
                  {item.label}
                </NavLink>
              );
            })}

            <button
              onClick={() => {
                logout();
                navigate('/login');
              }}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-red-600 hover:bg-red-50 mt-1"
            >
              <LogOutIcon size={16} />
              Logout
            </button>
          </nav>
        </aside>

        <main className="min-w-0">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
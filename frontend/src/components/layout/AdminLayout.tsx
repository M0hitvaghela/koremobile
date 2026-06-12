import React from 'react';
import { NavLink, Outlet, useNavigate, Navigate } from 'react-router-dom';
import {
  LayoutDashboardIcon,
  PackageIcon,
  ShoppingBagIcon,
  SettingsIcon,
  LogOutIcon,
  BellIcon,
  MessageSquareIcon,
  MonitorSmartphoneIcon,
  UsersIcon,          // ← ADD
  MailIcon,           // ← ADD
} from 'lucide-react';
import { Logo } from '../ui/Logo';
import { useAuthStore } from '../../store/authStore';

const navItems = [
  {
    to: '/admin',
    label: 'Dashboard',
    icon: LayoutDashboardIcon,
    end: true,
  },
  {
    to: '/admin/products',
    label: 'Products',
    icon: PackageIcon,
  },
  {
    to: '/admin/orders',
    label: 'Orders',
    icon: ShoppingBagIcon,
  },
  {
    to: '/admin/reviews',
    label: 'Reviews',
    icon: MessageSquareIcon,
  },
  {
    to: '/admin/settings',
    label: 'Settings',
    icon: SettingsIcon,
  },
  {
    to: '/admin/sessions',
    label: 'Sessions',
    icon: MonitorSmartphoneIcon,
  },
  {
    to: '/admin/users',
    label: 'Users',
    icon: UsersIcon,
  },
  {
    to: '/admin/email-log',
    label: 'Email Log',
    icon: MailIcon,
  }
];

export function AdminLayout() {
  const navigate = useNavigate();
  const { user, isAuthenticated, adminLogout, isHydrating } = useAuthStore();

  if (isHydrating) return null;

  if (!isAuthenticated || user?.role !== 'admin') {
    return <Navigate to="/admin/login" replace />;
  }

  const today = new Date().toLocaleDateString('en-IN', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  return (
    <div className="min-h-screen bg-adminBg text-white flex w-full">
      {/* Sidebar */}
      <aside className="w-60 bg-adminSurf border-r border-adminBorder flex flex-col fixed left-0 top-0 bottom-0 h-screen">
        <div className="px-5 py-5 border-b border-adminBorder">
          <Logo size="sm" variant="light" />
          <div className="text-xs text-gray-500 mt-1">Admin Panel</div>
        </div>

        <nav className="flex-1 py-4 px-3 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all relative ${
                    isActive
                      ? 'bg-primary text-white'
                      : 'text-gray-400 hover:bg-white/5 hover:text-white'
                  }`
                }
              >
                <Icon size={18} />
                {item.label}
              </NavLink>
            );
          })}
        </nav>

        <div className="border-t border-adminBorder p-3">
          <div className="px-3 py-2 mb-2">
            <div className="text-xs text-gray-500">Logged in as</div>
            <div className="text-sm font-medium text-white truncate">
              {user?.name || user?.email}
            </div>
          </div>
          <button
            onClick={async () => {
              await adminLogout();
              navigate('/admin/login');
            }}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-red-400 hover:bg-red-500/10 transition-colors"
          >
            <LogOutIcon size={18} />
            Logout
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 ml-60 flex flex-col min-w-0">
        <header className="h-16 bg-adminSurf border-b border-adminBorder flex items-center justify-between px-6 sticky top-0 z-30">
          <div>
            <h1 className="font-heading font-semibold text-lg">
              Welcome back, Admin
            </h1>
            <div className="text-xs text-gray-500">{today}</div>
          </div>
          <div className="flex items-center gap-3">
            <button className="relative p-2 rounded-lg hover:bg-white/5">
              <BellIcon size={18} />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-discount" />
            </button>
            <div className="w-9 h-9 rounded-full bg-primary text-white font-bold text-sm flex items-center justify-center">
              A
            </div>
          </div>
        </header>

        <main className="flex-1 p-6 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
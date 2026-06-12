import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  InstagramIcon,
  MessageCircleIcon,
  MapPinIcon,
  PhoneIcon,
  MailIcon,
  ClockIcon,
  ChevronDownIcon,
} from 'lucide-react';
import { Logo } from '../ui/Logo';

function CollapsibleSection({ title, children }: { title: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-white/10 md:border-none">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between py-3.5 md:py-0 md:cursor-default"
      >
        <h6 className="font-heading font-semibold text-sm md:text-base">{title}</h6>
        <ChevronDownIcon
          size={16}
          className={`md:hidden text-gray-400 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
        />
      </button>
      <div className={`overflow-hidden transition-all duration-200 md:block ${open ? 'max-h-96 pb-4' : 'max-h-0 md:max-h-none'}`}>
        {children}
      </div>
    </div>
  );
}

export function Footer() {
  return (
    <footer className="bg-[#1A1A2E] text-white mt-12 md:mt-16 w-full pb-14 md:pb-0">
      <div className="max-w-7xl mx-auto px-4 py-8 md:py-12">
        {/* Brand row — always visible */}
        <div className="mb-6 md:hidden">
          <Logo size="md" variant="light" />
          <p className="text-xs text-gray-400 mt-2 leading-relaxed">
            Your one-stop shop for genuine electronics in Gujarat.
          </p>
          <div className="flex items-center gap-2 mt-3">
            <a
              href="#"
              className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
              aria-label="Instagram"
            >
              <InstagramIcon size={16} />
            </a>
            <a
              href="#"
              className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
              aria-label="WhatsApp"
            >
              <MessageCircleIcon size={16} />
            </a>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-0 md:gap-8">
          {/* Col 1 — desktop only brand */}
          <div className="hidden md:block">
            <Logo size="md" variant="light" />
            <p className="text-sm text-gray-400 mt-3">Trusted Electronics, Best Prices</p>
            <p className="text-xs text-gray-500 mt-2 leading-relaxed">
              Your one-stop shop for genuine electronics in Gujarat. Sealed products, authentic warranty, fast delivery.
            </p>
            <div className="flex items-center gap-2 mt-4">
              <a href="#" className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors" aria-label="Instagram">
                <InstagramIcon size={16} />
              </a>
              <a href="#" className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors" aria-label="WhatsApp">
                <MessageCircleIcon size={16} />
              </a>
            </div>
          </div>

          {/* Col 2 */}
          <CollapsibleSection title="Quick Links">
            <ul className="space-y-2.5 text-sm text-gray-400">
              {[
                { to: '/', label: 'Home' },
                { to: '/products', label: 'All Products' },
                { to: '/cart', label: 'My Cart' },
                { to: '/account/orders', label: 'My Orders' },
                { to: '/account/orders', label: 'Track Order' },
              ].map((item) => (
                <li key={item.label}>
                  <Link to={item.to} className="hover:text-white transition-colors">
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </CollapsibleSection>

          {/* Col 3 */}
          <CollapsibleSection title="Categories">
            <ul className="space-y-2.5 text-sm text-gray-400">
              {[
                { to: '/products?category=Mobiles', label: 'Mobiles' },
                { to: '/products?category=Laptops', label: 'Laptops' },
                { to: '/products?category=TVs', label: 'Smart TVs' },
                { to: '/products?category=Tablets', label: 'Tablets' },
                { to: '/products?category=Accessories', label: 'Accessories' },
              ].map((item) => (
                <li key={item.label}>
                  <Link to={item.to} className="hover:text-white transition-colors">
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </CollapsibleSection>

          {/* Col 4 */}
          <CollapsibleSection title="Contact Us">
            <ul className="space-y-3 text-sm text-gray-400">
              <li className="flex items-start gap-2">
                <MapPinIcon size={14} className="mt-0.5 shrink-0 text-primary" />
                <span>123, CG Road, Ahmedabad - 380009, Gujarat</span>
              </li>
              <li className="flex items-center gap-2">
                <PhoneIcon size={14} className="text-primary" />
                <a href="tel:+919876543210" className="hover:text-white">+91 98765 43210</a>
              </li>
              <li className="flex items-center gap-2">
                <MailIcon size={14} className="text-primary" />
                <a href="mailto:support@koremobile.in" className="hover:text-white break-all">support@koremobile.in</a>
              </li>
              <li className="flex items-center gap-2">
                <ClockIcon size={14} className="text-primary" />
                <span>Mon - Sat: 10AM - 7PM</span>
              </li>
            </ul>
          </CollapsibleSection>
        </div>

        {/* Bottom bar */}
        <div className="border-t border-white/10 mt-8 pt-5 flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-gray-400">
          <div className="order-3 md:order-1">© 2025 Koremobile. All rights reserved.</div>
          <div className="order-2 flex items-center gap-4 flex-wrap justify-center">
            <Link to="#" className="hover:text-white">Privacy Policy</Link>
            <Link to="#" className="hover:text-white">Terms of Service</Link>
            <Link to="#" className="hover:text-white">Return Policy</Link>
          </div>
          <div className="order-1 md:order-3 flex items-center gap-1.5 flex-wrap justify-center">
            {['UPI', 'Visa', 'Mastercard', 'COD', 'Cashfree'].map((p) => (
              <span key={p} className="px-2 py-1 bg-white/10 rounded text-[10px] font-semibold">
                {p}
              </span>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}
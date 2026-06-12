import React from 'react';
import { Link, useLocation, useSearchParams } from 'react-router-dom';
const categories = [
{
  label: 'All',
  value: null
},
{
  label: 'Mobiles',
  value: 'Mobiles'
},
{
  label: 'Laptops',
  value: 'Laptops'
},
{
  label: 'Smart TVs',
  value: 'TVs'
},
{
  label: 'Tablets',
  value: 'Tablets'
},
{
  label: 'Accessories',
  value: 'Accessories'
}];

export function CategoryNav() {
  const location = useLocation();
  const [params] = useSearchParams();
  const active =
  location.pathname === '/products' ? params.get('category') : null;
  return (
    <nav className="bg-white border-b border-gray-100 w-full">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex items-center gap-1 overflow-x-auto no-scrollbar -mb-px">
          {categories.map((c) => {
            const isActive =
            c.value === null &&
            location.pathname === '/products' &&
            !active ||
            c.value === active;
            const to = c.value ? `/products?category=${c.value}` : '/products';
            return (
              <Link
                key={c.label}
                to={to}
                className={`shrink-0 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${isActive ? 'text-primary border-primary' : 'text-ink border-transparent hover:text-primary'}`}>
                
                {c.label}
              </Link>);

          })}
        </div>
      </div>
    </nav>);

}
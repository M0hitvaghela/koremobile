import React from 'react';
type Variant = 'discount' | 'success' | 'info' | 'warning' | 'grey' | 'danger';
type Size = 'sm' | 'md';
interface BadgeProps {
  variant?: Variant;
  size?: Size;
  children: React.ReactNode;
  className?: string;
}
const styles: Record<Variant, string> = {
  discount: 'bg-discount text-white',
  success: 'bg-success-light text-success',
  info: 'bg-primary-50 text-primary',
  warning: 'bg-amber-50 text-amber-700',
  grey: 'bg-gray-100 text-muted',
  danger: 'bg-red-50 text-red-600'
};
const sizes: Record<Size, string> = {
  sm: 'text-[10px] px-1.5 py-0.5',
  md: 'text-xs px-2 py-1'
};
export function Badge({
  variant = 'grey',
  size = 'md',
  children,
  className = ''
}: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center font-semibold rounded-md ${styles[variant]} ${sizes[size]} ${className}`}>
      
      {children}
    </span>);

}
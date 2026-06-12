import React from 'react';
type Variant = 'primary' | 'cta' | 'outline' | 'ghost' | 'danger' | 'dark';
type Size = 'sm' | 'md' | 'lg';
interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  fullWidth?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}
const variants: Record<Variant, string> = {
  primary: 'bg-primary text-white hover:bg-primary-600 active:scale-[0.98]',
  cta: 'bg-cta text-white hover:bg-cta-dark active:scale-[0.98]',
  outline:
  'border border-gray-300 text-ink hover:border-primary hover:text-primary bg-white',
  ghost: 'text-ink hover:bg-gray-100',
  danger: 'bg-white text-red-600 border border-red-300 hover:bg-red-50',
  dark: 'bg-adminSurf text-white border border-adminBorder hover:border-primary'
};
const sizes: Record<Size, string> = {
  sm: 'px-3 py-1.5 text-xs',
  md: 'px-3.5 py-2 text-sm md:px-4 md:py-2.5',
  lg: 'px-4 py-2.5 text-sm md:px-6 md:py-3 md:text-base'
};
export function Button({
  variant = 'primary',
  size = 'md',
  fullWidth,
  leftIcon,
  rightIcon,
  children,
  className = '',
  disabled,
  ...rest
}: ButtonProps) {
  return (
    <button
      {...rest}
      disabled={disabled}
      className={`inline-flex items-center justify-center gap-2 rounded-lg font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed ${variants[variant]} ${sizes[size]} ${fullWidth ? 'w-full' : ''} ${className}`}>
      
      {leftIcon}
      {children}
      {rightIcon}
    </button>);

}
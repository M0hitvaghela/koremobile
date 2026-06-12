import React from 'react';
interface LogoProps {
  size?: 'sm' | 'md' | 'lg';
  variant?: 'dark' | 'light';
}
export function Logo({ size = 'md', variant = 'dark' }: LogoProps) {
  const sizes = {
    sm: {
      text: 'text-lg',
      bolt: 16,
      gap: 'gap-1.5'
    },
    md: {
      text: 'text-2xl',
      bolt: 22,
      gap: 'gap-2'
    },
    lg: {
      text: 'text-4xl',
      bolt: 32,
      gap: 'gap-2.5'
    }
  };
  const s = sizes[size];
  const koreColor = variant === 'light' ? '#FFFFFF' : '#2874F0';
  const mobileColor = variant === 'light' ? '#FFFFFF' : '#FB641B';
  const boltFill = variant === 'light' ? '#FFFFFF' : '#FB641B';
  return (
    <div
      className={`flex items-center ${s.gap} select-none`}
      aria-label="Koremobile">
      
      <svg
        width={s.bolt}
        height={s.bolt}
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true">
        
        <path
          d="M13 2L4.5 13.5h6L9.5 22 19.5 10h-6L14 2h-1z"
          fill={boltFill}
          stroke={boltFill}
          strokeWidth="0.5"
          strokeLinejoin="round" />
        
      </svg>
      <span
        className={`font-heading font-extrabold ${s.text} tracking-tight leading-none`}>
        
        <span
          style={{
            color: koreColor
          }}>
          
          Kore
        </span>
        <span
          style={{
            color: mobileColor
          }}>
          
          mobile
        </span>
      </span>
    </div>);

}
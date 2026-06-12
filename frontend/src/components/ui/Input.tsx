import React from 'react';
interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
  dark?: boolean;
}
export function Input({
  label,
  error,
  hint,
  dark,
  className = '',
  ...rest
}: InputProps) {
  return (
    <label className="block">
      {label &&
      <span
        className={`block text-xs md:text-sm font-medium mb-1 ${dark ? 'text-gray-200' : 'text-ink'}`}>
        
          {label}
          {rest.required && <span className="text-red-500"> *</span>}
        </span>
      }
      <input
        {...rest}
        className={`w-full px-3 py-2 md:px-3.5 md:py-2.5 rounded-lg border text-sm transition-colors outline-none ${dark ? 'bg-adminBg border-adminBorder text-white placeholder-gray-500 focus:border-primary' : 'bg-white border-gray-300 text-ink placeholder-gray-400 focus:border-primary focus:ring-2 focus:ring-primary-50'} ${error ? 'border-red-500' : ''} ${className}`} />
      
      {error &&
      <span className="block text-xs text-red-500 mt-1">{error}</span>
      }
      {hint && !error &&
      <span
        className={`block text-xs mt-1 ${dark ? 'text-gray-500' : 'text-muted'}`}>
        
          {hint}
        </span>
      }
    </label>);

}
interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  dark?: boolean;
  children: React.ReactNode;
}
export function Select({
  label,
  error,
  dark,
  children,
  className = '',
  ...rest
}: SelectProps) {
  return (
    <label className="block">
      {label &&
      <span
        className={`block text-xs md:text-sm font-medium mb-1 ${dark ? 'text-gray-200' : 'text-ink'}`}>
        
          {label}
          {rest.required && <span className="text-red-500"> *</span>}
        </span>
      }
      <select
        {...rest}
        className={`w-full px-3 py-2 md:px-3.5 md:py-2.5 rounded-lg border text-sm transition-colors outline-none ${dark ? 'bg-adminBg border-adminBorder text-white focus:border-primary' : 'bg-white border-gray-300 text-ink focus:border-primary focus:ring-2 focus:ring-primary-50'} ${error ? 'border-red-500' : ''} ${className}`}>
        
        {children}
      </select>
      {error &&
      <span className="block text-xs text-red-500 mt-1">{error}</span>
      }
    </label>);

}
interface TextareaProps extends
  React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  dark?: boolean;
}
export function Textarea({
  label,
  error,
  dark,
  className = '',
  ...rest
}: TextareaProps) {
  return (
    <label className="block">
      {label &&
      <span
        className={`block text-xs md:text-sm font-medium mb-1 ${dark ? 'text-gray-200' : 'text-ink'}`}>
        
          {label}
          {rest.required && <span className="text-red-500"> *</span>}
        </span>
      }
      <textarea
        {...rest}
        className={`w-full px-3 py-2 md:px-3.5 md:py-2.5 rounded-lg border text-sm transition-colors outline-none resize-y ${dark ? 'bg-adminBg border-adminBorder text-white placeholder-gray-500 focus:border-primary' : 'bg-white border-gray-300 text-ink placeholder-gray-400 focus:border-primary focus:ring-2 focus:ring-primary-50'} ${error ? 'border-red-500' : ''} ${className}`} />
      
      {error &&
      <span className="block text-xs text-red-500 mt-1">{error}</span>
      }
    </label>);

}
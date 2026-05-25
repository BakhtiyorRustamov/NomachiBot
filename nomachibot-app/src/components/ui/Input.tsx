import React from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export const Input: React.FC<InputProps> = ({ label, error, className = '', ...props }) => {
  return (
    <div className={`flex flex-col mb-4 ${className}`}>
      {label && (
        <label className="mb-1 text-sm font-medium text-tg-hint">
          {label}
        </label>
      )}
      <input
        className={`px-4 py-3 rounded-lg bg-tg-secondaryBg text-tg-text border ${error ? 'border-red-500' : 'border-transparent focus:border-tg-link'} outline-none transition-colors`}
        {...props}
      />
      {error && <span className="mt-1 text-xs text-red-500">{error}</span>}
    </div>
  );
};

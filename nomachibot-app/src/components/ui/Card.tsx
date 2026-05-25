import React from 'react';

export const Card: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className = '' }) => (
  <div className={`bg-tg-bg border border-tg-secondaryBg rounded-xl shadow-sm p-4 ${className}`}>
    {children}
  </div>
);

import React from 'react';

interface MyAwesomeButtonProps {
  variant?: 'primary' | 'secondary';
  size?: 'sm' | 'md' | 'lg';
  children: React.ReactNode;
}

/**
 * An awesome button component with kebab-case filename
 */
export const MyAwesomeButton = ({ variant = 'primary', size = 'md', children }: MyAwesomeButtonProps) => {
  return (
    <button className={`awesome-btn awesome-btn--${variant} awesome-btn--${size}`}>
      {children}
    </button>
  );
};

export default MyAwesomeButton;
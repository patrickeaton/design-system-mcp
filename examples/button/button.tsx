import React from 'react';

/**
 * @dsm
 * name: Button
 * description: A primary button component for user actions with customizable styling and size options
 * category: actions
 * tags: interactive, form, primary
 * accessibility: aria-label supported, keyboard navigable, focus visible
 */
interface ButtonProps {
  primary?: boolean;
  backgroundColor?: string;
  size?: 'small' | 'medium' | 'large';
  label: string;
  onClick?: () => void;
}

/**
 * Primary UI component for user interaction
 * 
 * @dsm {
 *   "name": "Button",
 *   "description": "A highly versatile button component with extensive customization options",
 *   "category": "actions", 
 *   "tags": ["interactive", "customizable", "primary-action"],
 *   "examples": [
 *     {"title": "primary", "code": "<Button primary label='Click me' />"},
 *     {"title": "secondary", "code": "<Button label='Cancel' />"}
 *   ]
 * }
 */
export const Button = ({
  primary = false,
  size = 'medium',
  backgroundColor,
  label,
  ...props
}: ButtonProps) => {
  const mode = primary ? 'primary' : 'secondary';
  return (
    <button
      type="button"
      className={['button', `button--${size}`, `button--${mode}`].join(' ')}
      style={{ backgroundColor }}
      {...props}
    >
      {label}
    </button>
  );
};

export default Button;
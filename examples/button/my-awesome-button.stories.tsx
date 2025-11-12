import React from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { MyAwesomeButton } from './my-awesome-button';

const meta: Meta<typeof MyAwesomeButton> = {
  title: 'Components/MyAwesomeButton',
  component: MyAwesomeButton,
  parameters: {
    docs: {
      description: {
        component: 'A super awesome button component with kebab-case filename that demonstrates component name extraction.'
      }
    },
  },
  tags: ['autodocs', 'awesome', 'button'],
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Primary: Story = {
  args: {
    variant: 'primary',
    children: 'Awesome Button',
  },
};

export const Secondary: Story = {
  args: {
    variant: 'secondary', 
    children: 'Secondary Awesome',
  },
};
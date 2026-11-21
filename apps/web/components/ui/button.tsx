import { cva, type VariantProps } from 'class-variance-authority';
import type { ButtonHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

export const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 rounded-lg font-semibold text-[15px] transition-colors cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 min-h-11',
  {
    variants: {
      variant: {
        primary: 'bg-primary text-white hover:bg-primary-hover',
        outline: 'bg-surface text-ink border border-line-input hover:border-primary',
        ghost: 'bg-transparent text-ink hover:bg-surface-2',
        danger: 'bg-surface text-danger border border-line-input hover:border-danger',
      },
      size: {
        md: 'px-4',
        lg: 'min-h-[52px] w-full rounded-[14px] px-5',
        sm: 'min-h-9 px-3 text-[13px] rounded-md',
      },
    },
    defaultVariants: { variant: 'primary', size: 'md' },
  },
);

export function Button({
  className,
  variant,
  size,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & VariantProps<typeof buttonVariants>) {
  return <button className={cn(buttonVariants({ variant, size }), className)} {...props} />;
}

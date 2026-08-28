import Link from 'next/link';
import type { ComponentProps, ReactNode } from 'react';

type Props = { children: ReactNode; variant?: 'default' | 'primary' | 'danger'; href?: string } & Omit<ComponentProps<'button'>, 'children'>;

export default function Button({ children, variant = 'default', href, className = '', ...props }: Props) {
  const classes = `button-ui ${variant === 'primary' ? 'button-ui-primary' : ''} ${variant === 'danger' ? 'button-ui-danger' : ''} ${className}`.trim();
  if (href) return <Link className={classes} href={href}>{children}</Link>;
  return <button className={classes} {...props}>{children}</button>;
}

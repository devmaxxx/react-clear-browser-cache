import type { ReactNode } from 'react';

export default function Component({ children }: { children: ReactNode }) {
  return <p data-testid='lazy'>{children}</p>;
}

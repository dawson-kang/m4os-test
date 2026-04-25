'use client';

import { usePathname } from 'next/navigation';
import Layout from './Layout';
import type { ReactNode } from 'react';

export default function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  if (pathname === '/login') return <>{children}</>;
  return <Layout>{children}</Layout>;
}

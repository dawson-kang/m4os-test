import AppShell from '@/components/layout/AppShell';
import { AuthProvider } from '@/lib/AuthContext';
import '@/styles/globals.css';

export const metadata = { title: 'M4 OS Hub' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>
        <AuthProvider>
          <AppShell>{children}</AppShell>
        </AuthProvider>
      </body>
    </html>
  );
}

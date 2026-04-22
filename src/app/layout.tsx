import RootLayout from '@/components/layout/Layout';
import '@/styles/globals.css';
export default function App({ children }: { children: React.ReactNode }) {
  return <RootLayout>{children}</RootLayout>;
}

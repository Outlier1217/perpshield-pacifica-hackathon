// app/layout.tsx
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import SolanaProvider from './providers/SolanaProvider';
import SolanaCSS from './providers/SolanaCSS'; // ← Add this

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'PerpShield - Delta-Neutral Yield Vault',
  description: 'Automated yield generation using delta-neutral strategies on perpetual futures',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <SolanaCSS /> {/* ← Add this before SolanaProvider */}
        <SolanaProvider>
          {children}
        </SolanaProvider>
      </body>
    </html>
  );
}
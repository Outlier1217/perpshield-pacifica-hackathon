'use client';

import { SolanaWalletProvider } from '../components/WalletProvider';
import PerpShieldDashboard from '../components/PerpShieldDashboard';

export default function Home() {
  return (
    <SolanaWalletProvider>
      <PerpShieldDashboard />
    </SolanaWalletProvider>
  );
}
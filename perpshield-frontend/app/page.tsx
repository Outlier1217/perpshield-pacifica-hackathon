'use client';

import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { usePerpShield } from './hooks/usePerpShield';
import { Shield, TrendingUp, TrendingDown, Award, Clock, AlertTriangle } from 'lucide-react';
import { useState, useEffect } from 'react';

export default function Home() {
  const { connected } = useWallet();
  const { vaultData, userStats, loading, deposit, withdraw, harvest, updateShieldScore } = usePerpShield();
  const [mounted, setMounted] = useState(false);

  // Fix hydration error - component mount hone ke baad render karo
  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 flex items-center justify-center">
        <div className="text-center">
          <Shield className="w-20 h-20 text-blue-500 mx-auto mb-6" />
          <h1 className="text-4xl font-bold text-white mb-4">PerpShield</h1>
          <p className="text-gray-400 mb-8">Loading...</p>
        </div>
      </div>
    );
  }

  if (!connected) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 flex items-center justify-center">
        <div className="text-center">
          <Shield className="w-20 h-20 text-blue-500 mx-auto mb-6" />
          <h1 className="text-4xl font-bold text-white mb-4">PerpShield</h1>
          <p className="text-gray-400 mb-8">Delta-Neutral Yield Vault on Solana</p>
          <WalletMultiButton className="bg-blue-600 hover:bg-blue-700" />
        </div>
      </div>
    );
  }

  // Rest of your component remains same...
  if (loading || !vaultData) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 flex items-center justify-center">
        <div className="text-white text-xl">Loading vault data...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800">
      {/* Header */}
      <header className="bg-black/50 backdrop-blur-sm border-b border-gray-700">
        <div className="container mx-auto px-6 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <Shield className="w-8 h-8 text-blue-500" />
            <h1 className="text-2xl font-bold text-white">PerpShield</h1>
          </div>
          <div className="flex items-center gap-4">
            {userStats && (
              <div className="flex items-center gap-2 bg-gray-800 rounded-lg px-4 py-2">
                <Award className="w-5 h-5 text-yellow-500" />
                <span className="text-white">Level {userStats.level}</span>
                <span className="text-gray-400">| {userStats.xp} XP</span>
              </div>
            )}
            <WalletMultiButton className="bg-blue-600 hover:bg-blue-700" />
          </div>
        </div>
      </header>

      <main className="container mx-auto px-6 py-8">
        {/* Shield Score Gauge */}
        <div className="bg-gray-800/50 rounded-2xl p-6 mb-8 backdrop-blur-sm">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold text-white">Shield Score</h2>
            <button
              onClick={() => updateShieldScore(75, 8, 10)}
              className="text-sm bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg transition"
            >
              Update Score
            </button>
          </div>
          <div className="relative h-4 bg-gray-700 rounded-full overflow-hidden">
            <div
              className={`absolute left-0 top-0 h-full transition-all duration-500 ${
                vaultData.shieldScore >= 70 ? 'bg-green-500' :
                vaultData.shieldScore >= 40 ? 'bg-yellow-500' : 'bg-red-500'
              }`}
              style={{ width: `${vaultData.shieldScore}%` }}
            />
          </div>
          <div className="flex justify-between mt-2">
            <span className="text-3xl font-bold text-white">{vaultData.shieldScore}%</span>
            {vaultData.isPaused && (
              <div className="flex items-center gap-2 text-red-400">
                <AlertTriangle className="w-5 h-5" />
                <span>Circuit Breaker Active</span>
              </div>
            )}
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-gray-800/50 rounded-2xl p-6 backdrop-blur-sm">
            <div className="flex items-center gap-3 mb-3">
              <TrendingUp className="w-6 h-6 text-green-500" />
              <span className="text-gray-400">Total Assets</span>
            </div>
            <div className="text-2xl font-bold text-white">
              ${(vaultData.totalAssets / 1e6).toLocaleString()} USDC
            </div>
          </div>

          <div className="bg-gray-800/50 rounded-2xl p-6 backdrop-blur-sm">
            <div className="flex items-center gap-3 mb-3">
              <TrendingUp className="w-6 h-6 text-blue-500" />
              <span className="text-gray-400">Long Position</span>
            </div>
            <div className="text-2xl font-bold text-white">
              ${(vaultData.longPosition / 1e6).toLocaleString()}
            </div>
          </div>

          <div className="bg-gray-800/50 rounded-2xl p-6 backdrop-blur-sm">
            <div className="flex items-center gap-3 mb-3">
              <TrendingDown className="w-6 h-6 text-red-500" />
              <span className="text-gray-400">Short Position</span>
            </div>
            <div className="text-2xl font-bold text-white">
              ${(vaultData.shortPosition / 1e6).toLocaleString()}
            </div>
          </div>

          <div className="bg-gray-800/50 rounded-2xl p-6 backdrop-blur-sm">
            <div className="flex items-center gap-3 mb-3">
              <Clock className="w-6 h-6 text-purple-500" />
              <span className="text-gray-400">Funding Accrued</span>
            </div>
            <div className="text-2xl font-bold text-white">
              ${(vaultData.fundingAccrued / 1e6).toLocaleString()}
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <button
            onClick={() => deposit(1000000)}
            disabled={vaultData.isPaused}
            className="bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed py-4 rounded-xl font-semibold transition"
          >
            Deposit 1 USDC
          </button>
          <button
            onClick={() => withdraw(1000000)}
            disabled={vaultData.isPaused}
            className="bg-yellow-600 hover:bg-yellow-700 disabled:bg-gray-600 disabled:cursor-not-allowed py-4 rounded-xl font-semibold transition"
          >
            Withdraw
          </button>
          <button
            onClick={harvest}
            disabled={vaultData.isPaused}
            className="bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 disabled:cursor-not-allowed py-4 rounded-xl font-semibold transition"
          >
            Harvest Bounty
          </button>
        </div>

        {/* Bounty Info */}
        <div className="bg-gray-800/50 rounded-2xl p-6 backdrop-blur-sm">
          <h3 className="text-lg font-semibold text-white mb-4">Bounty Rewards</h3>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <div className="text-2xl font-bold text-blue-500">{vaultData.harvestBounty / 100}%</div>
              <div className="text-gray-400 text-sm">Harvest Bounty</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-green-500">{vaultData.rebalanceBounty / 100}%</div>
              <div className="text-gray-400 text-sm">Rebalance Bounty</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-red-500">{vaultData.deleverageBounty / 100}%</div>
              <div className="text-gray-400 text-sm">Deleverage Bounty</div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
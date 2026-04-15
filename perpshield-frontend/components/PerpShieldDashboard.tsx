'use client';

import { useState, useEffect } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import toast, { Toaster } from 'react-hot-toast';
import { PublicKey, Transaction, SystemProgram } from '@solana/web3.js';
import { 
  getAssociatedTokenAddress, 
  createAssociatedTokenAccountInstruction,
  createInitializeMintInstruction,
  MINT_SIZE,
  TOKEN_PROGRAM_ID,
  getAccount,
} from '@solana/spl-token';
import { PerpShieldService } from '../services/programService';
import { PacificaService, PacificaMarketData } from '../services/pacificaService';
import { connection, USDC_MINT, findVaultMintPDA, getVaultMintKeypair } from '../lib/solana';

export default function PerpShieldDashboard() {
  const { publicKey, connected, wallet, sendTransaction } = useWallet();
  const [service, setService] = useState<PerpShieldService | null>(null);
  const [vault, setVault] = useState<any>(null);
  const [userStats, setUserStats] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [depositAmount, setDepositAmount] = useState('');
  const [withdrawShares, setWithdrawShares] = useState('');
  const [shieldScore, setShieldScore] = useState<number>(0);
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [vaultMintInitialized, setVaultMintInitialized] = useState(false);
  const [usdcBalance, setUsdcBalance] = useState(0);
  const [solBalance, setSolBalance] = useState(0);
  const [pacificaData, setPacificaData] = useState<PacificaMarketData | null>(null);
  const [pacificaService] = useState(() => new PacificaService());
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (connected && mounted) {
      pacificaService.connect();
      pacificaService.onPriceUpdate((data: PacificaMarketData) => {
        if (data.symbol === 'BTC-PERP' || data.symbol === 'BTC') setPacificaData(data);
      });
    }
    return () => { if (mounted) pacificaService.disconnect(); };
  }, [connected, mounted]);

  useEffect(() => {
    if (connected && publicKey && wallet && mounted) {
      const svc = new PerpShieldService(wallet.adapter);
      setService(svc);
      loadVaultData(svc);
      loadUserStats(svc);
      checkVaultMint();
      checkUSDCBalance();
      checkSolBalance();
    }
  }, [connected, publicKey, wallet, mounted]);

  const checkVaultMint = async () => {
    try {
      const vaultMint = await findVaultMintPDA();
      const info = await connection.getAccountInfo(vaultMint);
      setVaultMintInitialized(!!info);
    } catch { setVaultMintInitialized(false); }
  };

  const checkSolBalance = async () => {
    if (!publicKey) return;
    try { setSolBalance((await connection.getBalance(publicKey)) / 1e9); } catch {}
  };

  const checkUSDCBalance = async () => {
    if (!publicKey) return;
    try {
      const ata = await getAssociatedTokenAddress(USDC_MINT, publicKey);
      try { setUsdcBalance(Number((await getAccount(connection, ata)).amount) / 1e6); }
      catch { setUsdcBalance(0); }
    } catch {}
  };

  const loadVaultData = async (svc: PerpShieldService) => {
    try {
      const v = await svc.getVault();
      if (v) { setVault(v); setShieldScore(v.shieldScore); setIsPaused(v.isPaused); }
    } catch {}
  };

  const loadUserStats = async (svc: PerpShieldService) => {
    if (!publicKey) return;
    try { const s = await svc.getUserStats(publicKey); if (s) setUserStats(s); } catch {}
  };

  // ✅ THE FIX: Set blockhash + feePayer manually before calling sendTransaction
  // Phantom Standard Wallet requires this — without it you get "Unexpected error"
  const createUSDCAccount = async () => {
    if (!publicKey || !sendTransaction) { toast.error('Connect wallet first'); return; }
    setLoading(true);
    try {
      const ata = await getAssociatedTokenAddress(USDC_MINT, publicKey);
      if (await connection.getAccountInfo(ata)) {
        toast.success('USDC account already exists!');
        await checkUSDCBalance();
        return;
      }

      const tx = new Transaction().add(
        createAssociatedTokenAccountInstruction(publicKey, ata, publicKey, USDC_MINT)
      );

      // ✅ CRITICAL: Must set these manually for Phantom Standard Wallet
      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');
      tx.recentBlockhash = blockhash;
      tx.feePayer = publicKey;

      const sig = await sendTransaction(tx, connection);
      await connection.confirmTransaction({ signature: sig, blockhash, lastValidBlockHeight }, 'confirmed');
      toast.success(`USDC account created! TX: ${sig.slice(0, 8)}...`);
      await checkUSDCBalance();
    } catch (error: any) {
      console.error('USDC account error:', error);
      if (error?.message?.includes('already in use')) {
        toast.success('USDC account already exists!');
        await checkUSDCBalance();
      } else {
        toast.error(`Failed: ${error?.message || 'Unknown error'}`);
      }
    } finally { setLoading(false); }
  };


// ==================== INITIALIZE VAULT MINT - WORKING VERSION ====================
const initializeVaultMint = async () => {
  if (!publicKey || !wallet?.adapter) {
    toast.error('Please connect your wallet first');
    return;
  }

  setLoading(true);
  const toastId = toast.loading('Creating vault mint...');
  
  try {
    // ✅ Use regular Keypair, not PDA
    const mintKeypair = getVaultMintKeypair();
    const vaultMint = mintKeypair.publicKey;
    const accountInfo = await connection.getAccountInfo(vaultMint);

    if (accountInfo) {
      toast.success('✅ Vault Mint already initialized!', { id: toastId });
      setVaultMintInitialized(true);
      return;
    }

    console.log("🏦 Creating Vault Mint at:", vaultMint.toString());
    console.log("Mint Keypair public key:", mintKeypair.publicKey.toString());

    const mintRent = await connection.getMinimumBalanceForRentExemption(MINT_SIZE);

    const transaction = new Transaction();
    
    transaction.add(
      SystemProgram.createAccount({
        fromPubkey: publicKey,
        newAccountPubkey: vaultMint,
        lamports: mintRent,
        space: MINT_SIZE,
        programId: TOKEN_PROGRAM_ID,
      }),
      createInitializeMintInstruction(
        vaultMint,
        6,
        publicKey,
        null
      )
    );

    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = publicKey;

    // ✅ CRITICAL: Sign with the mint keypair (it's a real signer now!)
    transaction.partialSign(mintKeypair);
    
    // Sign with wallet
    const signed = await wallet.adapter.signTransaction(transaction);
    
    const signature = await connection.sendRawTransaction(signed.serialize(), {
      skipPreflight: false,
      preflightCommitment: 'confirmed',
    });

    await connection.confirmTransaction({
      signature,
      blockhash,
      lastValidBlockHeight,
    }, 'confirmed');

    toast.success(`✅ Vault Mint Created! TX: ${signature.slice(0, 8)}...`, { id: toastId });
    setVaultMintInitialized(true);

  } catch (error: any) {
    console.error("Vault Mint Error:", error);
    
    if (error?.message?.includes('already in use')) {
      toast.success('✅ Vault Mint already exists!', { id: toastId });
      setVaultMintInitialized(true);
    } else {
      toast.error(`Failed: ${error?.message || 'Unknown error'}`, { id: toastId });
    }
  } finally {
    setLoading(false);
  }
};

  const handleDeposit = async () => {
    if (!service || !depositAmount) { toast.error('Enter an amount'); return; }
    if (usdcBalance === 0) { toast.error('No USDC balance!'); return; }
    const amount = parseFloat(depositAmount);
    if (isNaN(amount) || amount <= 0) { toast.error('Invalid amount'); return; }
    if (amount > usdcBalance) { toast.error(`Insufficient USDC! Have: ${usdcBalance}`); return; }
    setLoading(true);
    try {
      const tx = await service.deposit(amount);
      toast.success(`Deposit successful! TX: ${tx.slice(0, 8)}...`);
      setDepositAmount('');
      await Promise.all([checkVaultMint(), loadVaultData(service), loadUserStats(service), checkUSDCBalance()]);
    } catch (error: any) {
      console.error('Deposit error:', error);
      if (error?.logs) console.error('Logs:', error.logs.join('\n'));
      toast.error(`Deposit failed: ${error?.message}`);
    } finally { setLoading(false); }
  };

  const handleWithdraw = async () => {
    if (!service || !withdrawShares) return;
    setLoading(true);
    try {
      const tx = await service.withdraw(parseFloat(withdrawShares));
      toast.success(`Withdrawn! TX: ${tx.slice(0, 8)}...`);
      setWithdrawShares('');
      await Promise.all([loadVaultData(service), loadUserStats(service), checkUSDCBalance()]);
    } catch (error: any) { toast.error(`Withdraw failed: ${error?.message}`); }
    finally { setLoading(false); }
  };

  const handleHarvest = async () => {
    if (!service) return;
    setLoading(true);
    try {
      const tx = await service.harvest();
      toast.success(`Harvested! TX: ${tx.slice(0, 8)}...`);
      await loadVaultData(service);
    } catch (error: any) { toast.error(`Harvest failed: ${error?.message}`); }
    finally { setLoading(false); }
  };

  const handleUpdateShieldScore = async () => {
    if (!service) { toast.error('Service not initialized'); return; }
    if (!pacificaData) { toast.error('⏳ Waiting for Pacifica data...'); return; }
    setLoading(true);
    try {
      const fundingMag = pacificaService.calculateFundingMagnitude(pacificaData.funding);
      let drawdown = 0;
      if (vault?.peakAssets && Number(vault.peakAssets) > 0)
        drawdown = Math.min(100, Math.floor((Number(vault.peakAssets) - Number(vault.totalAssets)) * 100 / Number(vault.peakAssets)));
      await service.updateShieldScore(fundingMag, 0, drawdown);
      toast.success(`✅ Shield Score updated! Funding: ${(pacificaData.funding * 100).toFixed(6)}%`);
      await loadVaultData(service);
    } catch (error: any) { toast.error(`Update failed: ${error?.message}`); }
    finally { setLoading(false); }
  };

  const handleEmergencyDeleverage = async () => {
    if (!service) return;
    setLoading(true);
    try {
      const tx = await service.emergencyDeleverage();
      toast.success(`Emergency deleverage done! TX: ${tx.slice(0, 8)}...`);
      await loadVaultData(service);
    } catch (error: any) { toast.error(`Deleverage failed: ${error?.message}`); }
    finally { setLoading(false); }
  };

  if (!mounted) return null;

  if (!connected) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-white mb-8">🛡️ PerpShield</h1>
          <WalletMultiButton />
          <p className="text-gray-400 mt-4">Connect your wallet to start</p>
          <div className="mt-8 p-4 bg-gray-800 rounded-lg">
            <p className="text-sm text-gray-400">Powered by Pacifica API</p>
            <p className="text-xs text-gray-500 mt-2">Real-time funding rates & oracle prices</p>
          </div>
        </div>
      </div>
    );
  }

  const shieldColor = shieldScore >= 70 ? 'text-green-400' : shieldScore >= 40 ? 'text-yellow-400' : 'text-red-400';
  const shieldBorder = shieldScore >= 70 ? 'border-green-500' : shieldScore >= 40 ? 'border-yellow-500' : 'border-red-500';

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800">
      <Toaster position="top-right" />
      <header className="bg-gray-800/50 backdrop-blur-sm border-b border-gray-700">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <span className="text-3xl">🛡️</span>
            <h1 className="text-2xl font-bold text-white">PerpShield</h1>
            {isPaused && <span className="bg-red-500 text-white px-3 py-1 rounded-full text-sm font-semibold">⚠️ PAUSED</span>}
          </div>
          <div className="flex items-center gap-2">
            <div className="hidden sm:flex items-center gap-1 px-3 py-1 bg-gray-700 rounded-lg">
              <span className="text-xs text-gray-400">SOL:</span>
              <span className="text-xs text-white font-mono">{solBalance.toFixed(3)}</span>
            </div>

            {!vaultMintInitialized && (
    <button 
      onClick={initializeVaultMint}
      disabled={loading}
      className="px-3 py-1 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm transition disabled:opacity-50"
    >
      🏦 Initialize Vault Mint
    </button>
  )}
            <button onClick={createUSDCAccount} disabled={loading}
              className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm transition disabled:opacity-50">
              💰 Setup USDC Account
            </button>
            <WalletMultiButton />
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {/* Status Banners */}
        <div className="mb-6 grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className={`rounded-xl p-3 border text-center text-sm ${vaultMintInitialized ? 'bg-green-900/30 border-green-500/50 text-green-400' : 'bg-yellow-900/30 border-yellow-500/50 text-yellow-400'}`}>
            {vaultMintInitialized ? '✅ Vault Mint: Ready' : 'ℹ️ Vault Mint: Created on first deposit'}
          </div>
          <div className={`rounded-xl p-3 border text-center text-sm ${usdcBalance > 0 ? 'bg-green-900/30 border-green-500/50 text-green-400' : 'bg-red-900/30 border-red-500/50 text-red-400'}`}>
            {usdcBalance > 0 ? `✅ USDC: ${usdcBalance.toLocaleString()}` : '❌ No USDC — Click "Setup USDC Account"'}
          </div>
          <div className={`rounded-xl p-3 border text-center text-sm ${solBalance > 0.1 ? 'bg-green-900/30 border-green-500/50 text-green-400' : 'bg-red-900/30 border-red-500/50 text-red-400'}`}>
            {solBalance > 0.1 ? `✅ SOL: ${solBalance.toFixed(3)}` : `⚠️ Low SOL: ${solBalance.toFixed(3)}`}
          </div>
        </div>

        {/* Pacifica Live Data */}
        {pacificaData ? (
          <div className="bg-gradient-to-r from-emerald-900/30 to-teal-900/30 border border-emerald-500/50 rounded-2xl p-5 mb-6 backdrop-blur-sm">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-emerald-400 text-sm font-semibold flex items-center gap-2">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                📡 LIVE PACIFICA DATA (BTC-PERP)
              </h3>
              <span className="text-xs text-emerald-400/70">
                {(pacificaData as any).isSimulated ? '⚠️ Simulated' : '✅ Live API'}
              </span>
            </div>
            <div className="grid grid-cols-3 gap-4 text-center">
              <div className="bg-black/30 rounded-xl p-3">
                <p className="text-xs text-gray-400">Funding Rate</p>
                <p className="text-lg font-bold text-white">{(pacificaData.funding * 100).toFixed(6)}%</p>
                <p className="text-xs text-emerald-400">per 8h</p>
              </div>
              <div className="bg-black/30 rounded-xl p-3">
                <p className="text-xs text-gray-400">Oracle Price</p>
                <p className="text-lg font-bold text-white">${pacificaData.oracle.toLocaleString()}</p>
                <p className="text-xs text-emerald-400">Verified</p>
              </div>
              <div className="bg-black/30 rounded-xl p-3">
                <p className="text-xs text-gray-400">Funding Magnitude</p>
                <p className="text-lg font-bold text-emerald-400">{pacificaService.calculateFundingMagnitude(pacificaData.funding)}/100</p>
                <p className="text-xs text-emerald-400">Shield Score Input</p>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-yellow-900/30 border border-yellow-500/50 rounded-2xl p-4 mb-6 text-center">
            <p className="text-yellow-400 text-sm">⏳ Connecting to Pacifica API...</p>
          </div>
        )}

        {/* Shield Score */}
        <div className="bg-gray-800/50 backdrop-blur-sm rounded-2xl p-6 mb-8 border border-gray-700">
          <div className="text-center">
            <h2 className="text-gray-400 text-sm uppercase tracking-wider mb-2">Shield Score</h2>
            <div className={`w-32 h-32 rounded-full border-8 ${shieldBorder} flex items-center justify-center mx-auto`}>
              <span className={`text-3xl font-bold ${shieldColor}`}>{shieldScore}</span>
            </div>
            <p className="text-gray-400 mt-2">/100</p>
            <button onClick={handleUpdateShieldScore} disabled={loading || !pacificaData}
              className="mt-4 px-4 py-2 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white rounded-lg transition disabled:opacity-50">
              {!pacificaData ? '⏳ Waiting for Pacifica...' : loading ? 'Updating...' : '🔄 Update with Pacifica Data'}
            </button>
            {pacificaData && <p className="text-xs text-emerald-400 mt-2">Funding: {(pacificaData.funding * 100).toFixed(6)}%</p>}
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {[
            { label: 'Total Assets', value: `$${vault?.totalAssets ? (Number(vault.totalAssets) / 1e6).toLocaleString() : '0'} USDC`, color: 'text-white' },
            { label: 'Long Position', value: `$${vault?.longPosition ? (Number(vault.longPosition) / 1e6).toLocaleString() : '0'}`, color: 'text-green-500' },
            { label: 'Short Position', value: `$${vault?.shortPosition ? (Number(vault.shortPosition) / 1e6).toLocaleString() : '0'}`, color: 'text-red-500' },
            { label: 'Your USDC Balance', value: `$${usdcBalance.toLocaleString()} USDC`, color: 'text-blue-500' },
          ].map(({ label, value, color }) => (
            <div key={label} className="bg-gray-800/50 backdrop-blur-sm rounded-xl p-6 border border-gray-700">
              <p className="text-gray-400 text-sm">{label}</p>
              <p className={`text-2xl font-bold ${color}`}>{value}</p>
            </div>
          ))}
        </div>

        {/* User Stats */}
        {userStats && (
          <div className="bg-gradient-to-r from-purple-600/20 to-blue-600/20 rounded-xl p-6 mb-8 border border-purple-500/30">
            <div className="flex justify-between items-center">
              <div><p className="text-gray-300 text-sm">Your Level</p><p className="text-3xl font-bold text-white">{userStats.level}</p></div>
              <div className="text-right"><p className="text-gray-300 text-sm">Your XP</p><p className="text-2xl font-bold text-purple-400">{userStats.xp?.toString() || '0'}</p></div>
            </div>
            <div className="mt-3 h-2 bg-gray-700 rounded-full overflow-hidden">
              <div className="h-full bg-gradient-to-r from-purple-500 to-blue-500 rounded-full" style={{ width: `${(Number(userStats.xp) || 0) % 100}%` }} />
            </div>
          </div>
        )}

        {/* Action Cards */}
        <div className="grid md:grid-cols-2 gap-6 mb-8">
          <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl p-6 border border-gray-700">
            <h3 className="text-xl font-bold text-white mb-4">💰 Deposit USDC</h3>
            {isPaused && <div className="mb-3 p-3 bg-red-900/40 border border-red-500/50 rounded-lg"><p className="text-red-400 text-sm">⚠️ Vault paused. Shield score too low.</p></div>}
            <div className="space-y-4">
              <div>
                <label className="block text-gray-400 text-sm mb-2">Amount (USDC) — Balance: <span className="text-blue-400">{usdcBalance}</span></label>
                <input type="number" value={depositAmount} onChange={(e) => setDepositAmount(e.target.value)} placeholder="Enter amount..."
                  className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-blue-500"
                  disabled={isPaused || usdcBalance === 0} />
              </div>
              <button onClick={handleDeposit} disabled={loading || isPaused || usdcBalance === 0}
                className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-3 rounded-lg transition disabled:opacity-50">
                {usdcBalance === 0 ? '❌ Setup USDC Account First' : loading ? 'Processing...' : 'Deposit'}
              </button>
            </div>
          </div>

          <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl p-6 border border-gray-700">
            <h3 className="text-xl font-bold text-white mb-4">💸 Withdraw Shares</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-gray-400 text-sm mb-2">Shares to Burn</label>
                <input type="number" value={withdrawShares} onChange={(e) => setWithdrawShares(e.target.value)} placeholder="Enter shares..."
                  className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-blue-500" />
              </div>
              <button onClick={handleWithdraw} disabled={loading}
                className="w-full bg-red-600 hover:bg-red-700 text-white font-semibold py-3 rounded-lg transition disabled:opacity-50">
                {loading ? 'Processing...' : 'Withdraw'}
              </button>
            </div>
          </div>
        </div>

        {/* Bounties & Position Info */}
        <div className="grid md:grid-cols-2 gap-6">
          <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl p-6 border border-gray-700">
            <h3 className="text-xl font-bold text-white mb-4">🎯 Bounty Actions</h3>
            <div className="space-y-3">
              <div className="flex justify-between items-center py-2 border-b border-gray-700">
                <div>
                  <span className="text-gray-300 block">Harvest Funding</span>
                  <span className="text-green-400 text-xs">Bounty: {vault?.harvestBounty ? vault.harvestBounty / 100 : 0}%</span>
                </div>
                <button onClick={handleHarvest} disabled={loading} className="px-4 py-1 bg-yellow-600 hover:bg-yellow-700 text-white rounded transition disabled:opacity-50">Harvest</button>
              </div>
              <div className="flex justify-between items-center py-2">
                <div>
                  <span className="text-gray-300 block">Emergency Deleverage</span>
                  <span className="text-red-400 text-xs">Bounty: {vault?.deleverageBounty ? vault.deleverageBounty / 100 : 0}%{shieldScore > 15 && ' (Score too high)'}</span>
                </div>
                <button onClick={handleEmergencyDeleverage} disabled={loading || shieldScore > 15} className="px-4 py-1 bg-red-600 hover:bg-red-700 text-white rounded transition disabled:opacity-50">Emergency</button>
              </div>
            </div>
          </div>

          <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl p-6 border border-gray-700">
            <h3 className="text-xl font-bold text-white mb-4">📊 Position Info</h3>
            <div className="space-y-2">
              <div className="flex justify-between"><span className="text-gray-400">Long/Short Delta:</span><span className="text-white">{vault ? `${Math.abs((Number(vault.longPosition) - Number(vault.shortPosition)) / 1e6).toLocaleString()} USDC` : '0'}</span></div>
              <div className="flex justify-between"><span className="text-gray-400">Peak Assets:</span><span className="text-white">${vault?.peakAssets ? (Number(vault.peakAssets) / 1e6).toLocaleString() : '0'} USDC</span></div>
              <div className="flex justify-between"><span className="text-gray-400">Last Rebalance:</span><span className="text-white text-sm">{vault?.lastRebalance ? new Date(Number(vault.lastRebalance) * 1000).toLocaleString() : 'N/A'}</span></div>
              <div className="flex justify-between"><span className="text-gray-400">Vault Mint:</span><span className={`text-sm ${vaultMintInitialized ? 'text-green-400' : 'text-yellow-400'}`}>{vaultMintInitialized ? '✅ Initialized' : '⏳ Pending first deposit'}</span></div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
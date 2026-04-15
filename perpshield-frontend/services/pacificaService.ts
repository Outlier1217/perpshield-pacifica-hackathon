'use client';

export interface PacificaMarketData {
  symbol: string;
  funding: number;
  oracle: number;
  mark: number;
  timestamp: number;
  isSimulated?: boolean;
}

export class PacificaService {
  private listeners: ((data: PacificaMarketData) => void)[] = [];
  private interval: NodeJS.Timeout | null = null;
  private isConnected: boolean = false;

  // ✅ CORRECT endpoints from Pacifica docs
  // Testnet: https://test-api.pacifica.fi/api/v1
  // Mainnet: https://api.pacifica.fi/api/v1
  private readonly TESTNET_URL = 'https://test-api.pacifica.fi/api/v1';
  private readonly MAINNET_URL = 'https://api.pacifica.fi/api/v1';

  connect() {
    if (this.isConnected) return;
    console.log('🔄 Connecting to Pacifica API...');
    this.isConnected = true;
    this.fetchMarketData();
    this.interval = setInterval(() => this.fetchMarketData(), 15000);
  }

  private async fetchMarketData() {
    let marketData: PacificaMarketData | null = null;

    // ✅ Try 1: Testnet /prices endpoint — returns funding + oracle for all symbols
    // Correct endpoint from docs: GET /api/v1/prices
    if (!marketData) {
      try {
        const res = await fetch(`${this.TESTNET_URL}/prices`, {
          headers: { 'Accept': 'application/json' },
        });
        if (res.ok) {
          const json = await res.json();
          const data = json?.data || json;
          const arr = Array.isArray(data) ? data : [];
          const btc = arr.find((m: any) => m.symbol === 'BTC' || m.symbol === 'BTC-PERP');
          if (btc) {
            marketData = {
              symbol: 'BTC-PERP',
              funding: parseFloat(btc.funding || btc.funding_rate || '0.0000125'),
              oracle: parseFloat(btc.oracle || btc.index_price || btc.mark || '65000'),
              mark: parseFloat(btc.mark || btc.mark_price || '65000'),
              timestamp: Date.now(),
              isSimulated: false,
            };
            console.log('✅ Pacifica Testnet /prices:', marketData);
          }
        }
      } catch (e) {
        console.log('⚠️ Testnet /prices failed');
      }
    }

    // ✅ Try 2: Testnet /market_info endpoint — has funding_rate field
    // Correct endpoint from docs: GET /api/v1/market_info
    if (!marketData) {
      try {
        const res = await fetch(`${this.TESTNET_URL}/market_info`, {
          headers: { 'Accept': 'application/json' },
        });
        if (res.ok) {
          const json = await res.json();
          const arr = Array.isArray(json?.data) ? json.data : Array.isArray(json) ? json : [];
          const btc = arr.find((m: any) => m.symbol === 'BTC' || m.symbol === 'BTC-PERP');
          if (btc) {
            marketData = {
              symbol: 'BTC-PERP',
              funding: parseFloat(btc.funding_rate || btc.funding || '0.0000125'),
              oracle: parseFloat(btc.oracle || btc.index_price || '65000'),
              mark: parseFloat(btc.mark_price || btc.mark || '65000'),
              timestamp: Date.now(),
              isSimulated: false,
            };
            console.log('✅ Pacifica Testnet /market_info:', marketData);
          }
        }
      } catch (e) {
        console.log('⚠️ Testnet /market_info failed');
      }
    }

    // ✅ Try 3: Mainnet /prices (read-only public data, no auth needed)
    if (!marketData) {
      try {
        const res = await fetch(`${this.MAINNET_URL}/prices`, {
          headers: { 'Accept': 'application/json' },
        });
        if (res.ok) {
          const json = await res.json();
          const arr = Array.isArray(json?.data) ? json.data : [];
          const btc = arr.find((m: any) => m.symbol === 'BTC' || m.symbol === 'BTC-PERP');
          if (btc) {
            marketData = {
              symbol: 'BTC-PERP',
              funding: parseFloat(btc.funding || '0.0000125'),
              oracle: parseFloat(btc.oracle || btc.mark || '65000'),
              mark: parseFloat(btc.mark || '65000'),
              timestamp: Date.now(),
              isSimulated: false,
            };
            console.log('✅ Pacifica Mainnet /prices:', marketData);
          }
        }
      } catch (e) {
        console.log('⚠️ Mainnet /prices failed');
      }
    }

    // ✅ Try 4: Mainnet /market_info
    if (!marketData) {
      try {
        const res = await fetch(`${this.MAINNET_URL}/market_info`, {
          headers: { 'Accept': 'application/json' },
        });
        if (res.ok) {
          const json = await res.json();
          const arr = Array.isArray(json?.data) ? json.data : Array.isArray(json) ? json : [];
          const btc = arr.find((m: any) => m.symbol === 'BTC');
          if (btc) {
            marketData = {
              symbol: 'BTC-PERP',
              funding: parseFloat(btc.funding_rate || '0.0000125'),
              oracle: parseFloat(btc.oracle || '65000'),
              mark: parseFloat(btc.mark_price || '65000'),
              timestamp: Date.now(),
              isSimulated: false,
            };
            console.log('✅ Pacifica Mainnet /market_info:', marketData);
          }
        }
      } catch (e) {
        console.log('⚠️ Mainnet /market_info failed');
      }
    }

    // Fallback with realistic simulated data
    if (!marketData) {
      console.warn('⚠️ All Pacifica endpoints failed — using simulated data');
      marketData = {
        symbol: 'BTC-PERP',
        funding: 0.0000125,
        oracle: 65000 + (Math.random() - 0.5) * 1000,
        mark: 65000 + (Math.random() - 0.5) * 500,
        timestamp: Date.now(),
        isSimulated: true,
      };
    }

    this.listeners.forEach(l => l(marketData!));
  }

  onPriceUpdate(callback: (data: PacificaMarketData) => void) {
    this.listeners.push(callback);
  }

  disconnect() {
    if (this.interval) { clearInterval(this.interval); this.interval = null; }
    this.isConnected = false;
    this.listeners = [];
    console.log('🔌 Pacifica Service disconnected');
  }

  calculateFundingMagnitude(fundingRate: number): number {
    const mag = Math.floor(Math.abs(fundingRate) * 1_000_000);
    return Math.min(100, Math.max(0, mag));
  }
}
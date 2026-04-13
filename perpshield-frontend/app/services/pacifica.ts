// app/services/pacifica.ts
'use client';

const PACIFICA_API = 'https://api.pacifica.fi/api/v1';
const BUILDER_CODE = 'PERPSHIELD'; // Apna builder code yahan lagao

export interface PacificaOrder {
  symbol: string;
  amount: string;
  side: 'bid' | 'ask';
  slippage_percent?: string;
  reduce_only?: boolean;
  builder_code?: string;
}

export interface PacificaPosition {
  symbol: string;
  side: 'bid' | 'ask';
  size: string;
  entry_price: string;
  unrealized_pnl: string;
}

// Sign message for Pacifica (using Solana wallet)
async function signMessage(wallet: any, message: string): Promise<string> {
  const encodedMessage = new TextEncoder().encode(message);
  const signature = await wallet.signMessage(encodedMessage);
  return Buffer.from(signature).toString('base64');
}

// Create compact JSON for signing
function createCompactJson(obj: any): string {
  const sorted = sortObjectKeys(obj);
  return JSON.stringify(sorted);
}

function sortObjectKeys(obj: any): any {
  if (obj === null || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(sortObjectKeys);
  
  const sorted: any = {};
  Object.keys(obj).sort().forEach(key => {
    sorted[key] = sortObjectKeys(obj[key]);
  });
  return sorted;
}

// Approve builder code for user
export async function approveBuilderCode(wallet: any, account: string, maxFeeRate: string = '0.001'): Promise<void> {
  const timestamp = Date.now();
  const payload = {
    timestamp,
    expiry_window: 5000,
    type: 'approve_builder_code',
    data: {
      builder_code: BUILDER_CODE,
      max_fee_rate: maxFeeRate
    }
  };
  
  const compactJson = createCompactJson(payload);
  const signature = await signMessage(wallet, compactJson);
  
  const response = await fetch(`${PACIFICA_API}/account/builder_codes/approve`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      account,
      signature,
      timestamp,
      expiry_window: 5000,
      builder_code: BUILDER_CODE,
      max_fee_rate: maxFeeRate
    })
  });
  
  if (!response.ok) {
    throw new Error(`Failed to approve builder code: ${response.statusText}`);
  }
}

// Create market order on Pacifica
export async function createMarketOrder(
  wallet: any,
  account: string,
  symbol: string,
  amount: string,
  side: 'bid' | 'ask',
  slippagePercent: string = '0.5'
): Promise<any> {
  const timestamp = Date.now();
  const clientOrderId = crypto.randomUUID();
  
  const payload = {
    timestamp,
    expiry_window: 30000,
    type: 'create_market_order',
    data: {
      symbol,
      amount,
      side,
      slippage_percent: slippagePercent,
      reduce_only: false,
      client_order_id: clientOrderId,
      builder_code: BUILDER_CODE
    }
  };
  
  const compactJson = createCompactJson(payload);
  const signature = await signMessage(wallet, compactJson);
  
  const response = await fetch(`${PACIFICA_API}/orders/create_market`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      account,
      signature,
      timestamp,
      expiry_window: 30000,
      symbol,
      amount,
      side,
      slippage_percent: slippagePercent,
      reduce_only: false,
      client_order_id: clientOrderId,
      builder_code: BUILDER_CODE
    })
  });
  
  if (!response.ok) {
    throw new Error(`Failed to create order: ${response.statusText}`);
  }
  
  return response.json();
}

// Get user positions
export async function getPositions(account: string): Promise<PacificaPosition[]> {
  const response = await fetch(`${PACIFICA_API}/positions?account=${account}`);
  if (!response.ok) throw new Error('Failed to fetch positions');
  return response.json();
}

// Get funding rates for Shield Score
export async function getFundingRates(symbol: string = 'BTC'): Promise<{ fundingRate: number; timestamp: number }> {
  const response = await fetch(`${PACIFICA_API}/funding/${symbol}`);
  if (!response.ok) throw new Error('Failed to fetch funding rates');
  const data = await response.json();
  return {
    fundingRate: parseFloat(data.funding_rate),
    timestamp: Date.now()
  };
}

// Get oracle price freshness
export async function getOracleFreshness(symbol: string = 'BTC'): Promise<{ price: number; age: number }> {
  const response = await fetch(`${PACIFICA_API}/oracle/${symbol}`);
  if (!response.ok) throw new Error('Failed to fetch oracle data');
  const data = await response.json();
  return {
    price: parseFloat(data.price),
    age: Date.now() - data.timestamp
  };
}

// Execute delta-neutral strategy
export async function executeDeltaNeutral(
  wallet: any,
  account: string,
  amount: string
): Promise<{ longOrder: any; shortOrder: any }> {
  // Long position
  const longOrder = await createMarketOrder(wallet, account, 'BTC', amount, 'bid', '0.5');
  
  // Short position (using same amount for delta-neutral)
  const shortOrder = await createMarketOrder(wallet, account, 'BTC', amount, 'ask', '0.5');
  
  return { longOrder, shortOrder };
}
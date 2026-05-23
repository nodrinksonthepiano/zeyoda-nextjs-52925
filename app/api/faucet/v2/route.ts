import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { ethers, JsonRpcProvider } from 'ethers';
import { rateLimit } from '@/app/utils/apiGuard';
import { createGuardedSigner } from '@/app/utils/guardedSigner';
import {
  BASE_SEPOLIA_CHAIN_ID,
  ChainGuardError,
  requireFreshBaseSepolia,
} from '@/app/utils/networkGuard';
import { getMagicAuthFromBearer } from '@/app/utils/server/magicBearerEmail';
import { verifyFaucetEligibility } from '@/app/utils/server/verifyFaucetEligibility';

const FAUCET_VERSION = 'v2';
const FAUCET_AMOUNT_WEI = ethers.parseEther('0.002');
const FAUCET_DAILY_CAP_WEI = ethers.parseEther('0.03');
const FAUCET_MIN_BALANCE_WEI = ethers.parseEther('0.005');
const FAUCET_LOW_BALANCE_ALERT_WEI = ethers.parseEther('0.01');
const PENDING_INSERT_BACKOFF_MS = [100, 300, 600] as const;

const REJECTED_BODY_KEYS = ['userAddress', 'recipient', 'amount', 'email'] as const;

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceRoleKey) {
  throw new Error('Supabase URL and service role key are required.');
}

const serviceSupabase = createClient(supabaseUrl, supabaseServiceRoleKey);

type FundingStatus =
  | 'success'
  | 'pending'
  | 'failed_confirmation'
  | 'failed_validation'
  | 'failed_signing'
  | 'failed_chain_guard'
  | 'failed_balance'
  | 'failed_cap'
  | 'failed_duplicate';

type InsertFundingResult = { ok: boolean; error: unknown | null };

async function insertFundingRow(row: {
  wallet_address: string;
  email: string;
  funded_amount: string;
  chain_id: number;
  status: FundingStatus;
  error: string | null;
  transaction_hash: string | null;
  deployer_address: string | null;
}): Promise<InsertFundingResult> {
  const { error } = await serviceSupabase.from('wallet_funding').insert([
    {
      ...row,
      faucet_version: FAUCET_VERSION,
      funded_at: new Date().toISOString(),
    },
  ]);

  if (error) {
    console.error('[faucet/v2] wallet_funding insert failed:', error);
    return { ok: false, error };
  }

  return { ok: true, error: null };
}

async function insertPendingFundingRowWithRetry(row: {
  wallet_address: string;
  email: string;
  funded_amount: string;
  chain_id: number;
  status: 'pending';
  error: null;
  transaction_hash: string;
  deployer_address: string;
}): Promise<InsertFundingResult> {
  let lastResult: InsertFundingResult = { ok: false, error: null };

  for (let attempt = 0; attempt < PENDING_INSERT_BACKOFF_MS.length + 1; attempt++) {
    lastResult = await insertFundingRow(row);
    if (lastResult.ok) {
      return lastResult;
    }
    if (attempt < PENDING_INSERT_BACKOFF_MS.length) {
      await new Promise((resolve) => setTimeout(resolve, PENDING_INSERT_BACKOFF_MS[attempt]));
    }
  }

  return lastResult;
}

async function insertAlert(
  alert_type: string,
  wallet_address: string | null,
  email: string | null,
  details: Record<string, unknown>,
): Promise<void> {
  try {
    const { error } = await serviceSupabase.from('faucet_alerts').insert([
      {
        alert_type,
        wallet_address,
        email,
        details,
      },
    ]);

    if (error) {
      console.error('[faucet/v2] faucet_alerts insert failed:', error);
    }
  } catch (alertError) {
    console.error('[faucet/v2] faucet_alerts insert exception:', alertError);
  }
}

async function getDailyFundedWei(): Promise<bigint> {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const { data, error } = await serviceSupabase
    .from('wallet_funding')
    .select('funded_amount')
    .eq('faucet_version', FAUCET_VERSION)
    .in('status', ['success', 'pending'])
    .gte('funded_at', since);

  if (error) {
    console.error('[faucet/v2] daily cap query failed:', error);
    throw new Error('Daily cap check failed');
  }

  let total = 0n;
  for (const row of data ?? []) {
    try {
      total += BigInt(row.funded_amount);
    } catch (parseErr) {
      console.warn('[faucet/v2] skipping malformed funded_amount row:', {
        funded_amount: row.funded_amount,
        error: String(parseErr),
      });
    }
  }
  return total;
}

function hasRejectedBodyFields(body: Record<string, unknown>): boolean {
  return REJECTED_BODY_KEYS.some((key) => body[key] !== undefined && body[key] !== null);
}

export async function POST(request: NextRequest) {
  const rl = rateLimit(request, 'faucet-v2', 10, 60_000);
  if (rl) return rl;

  if (process.env.FAUCET_ENABLED !== 'true') {
    return NextResponse.json({ error: 'Faucet disabled', funded: false }, { status: 403 });
  }

  let wallet = '';
  let email = '';

  try {
    let body: Record<string, unknown> = {};
    try {
      const text = await request.text();
      if (text.trim()) {
        body = JSON.parse(text) as Record<string, unknown>;
      }
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body', funded: false }, { status: 400 });
    }

    if (hasRejectedBodyFields(body)) {
      await insertAlert('client_body_rejected', null, null, {
        keys: REJECTED_BODY_KEYS.filter((k) => body[k] !== undefined),
      });

      return NextResponse.json(
        { error: 'Invalid request body', funded: false },
        { status: 400 },
      );
    }

    const auth = await getMagicAuthFromBearer(request);
    if (!auth) {
      return NextResponse.json(
        { error: 'Authentication required', funded: false },
        { status: 401 },
      );
    }

    wallet = auth.publicAddress?.trim().toLowerCase() ?? '';
    email = auth.email ?? '';

    if (!wallet) {
      await insertFundingRow({
        wallet_address: 'unknown',
        email: email || 'unknown',
        funded_amount: FAUCET_AMOUNT_WEI.toString(),
        chain_id: BASE_SEPOLIA_CHAIN_ID,
        status: 'failed_validation',
        error: 'No wallet on session',
        transaction_hash: null,
        deployer_address: null,
      });
      return NextResponse.json(
        { error: 'No wallet on session', funded: false },
        { status: 401 },
      );
    }

    const emailRl = rateLimit(request, `faucet-v2-email:${email}`, 5, 60_000);
    if (emailRl) return emailRl;

    const eligibility = await verifyFaucetEligibility(email, wallet);
    if (!eligibility.eligible) {
      await insertFundingRow({
        wallet_address: wallet,
        email: email || 'unknown',
        funded_amount: FAUCET_AMOUNT_WEI.toString(),
        chain_id: BASE_SEPOLIA_CHAIN_ID,
        status: 'failed_validation',
        error: eligibility.error ?? 'Not eligible',
        transaction_hash: null,
        deployer_address: null,
      });
      return NextResponse.json({ error: 'Not eligible', funded: false }, { status: 403 });
    }

    const { data: priorSuccess } = await serviceSupabase
      .from('wallet_funding')
      .select('id')
      .eq('wallet_address', wallet)
      .eq('status', 'success')
      .maybeSingle();

    if (priorSuccess) {
      return NextResponse.json({ funded: true, message: 'Wallet ready.' });
    }

    const { data: priorPending } = await serviceSupabase
      .from('wallet_funding')
      .select('id')
      .eq('wallet_address', wallet)
      .eq('status', 'pending')
      .maybeSingle();

    if (priorPending) {
      return NextResponse.json({ funded: true, message: 'Wallet ready.' });
    }

    let dailyTotal: bigint;
    try {
      dailyTotal = await getDailyFundedWei();
    } catch {
      return NextResponse.json(
        { error: 'Daily cap check failed', funded: false },
        { status: 503 },
      );
    }

    if (dailyTotal + FAUCET_AMOUNT_WEI > FAUCET_DAILY_CAP_WEI) {
      await insertFundingRow({
        wallet_address: wallet,
        email: email || 'unknown',
        funded_amount: FAUCET_AMOUNT_WEI.toString(),
        chain_id: BASE_SEPOLIA_CHAIN_ID,
        status: 'failed_cap',
        error: 'Daily global cap exceeded',
        transaction_hash: null,
        deployer_address: null,
      });
      await insertAlert('cap_hit', wallet, email || null, {
        dailyTotalWei: dailyTotal.toString(),
        capWei: FAUCET_DAILY_CAP_WEI.toString(),
      });
      return NextResponse.json(
        { error: 'Daily faucet cap reached', funded: false },
        { status: 503 },
      );
    }

    const faucetKey = process.env.TESTNET_FAUCET_KEY_V2?.trim();
    const rpcUrl = process.env.SERVER_BASE_SEPOLIA_RPC_URL?.trim();

    if (!faucetKey || !rpcUrl) {
      return NextResponse.json(
        { error: 'Faucet misconfigured', funded: false },
        { status: 500 },
      );
    }

    const signer = await createGuardedSigner(faucetKey, rpcUrl);
    const faucetBalance = await signer.provider!.getBalance(signer.address);

    if (faucetBalance < FAUCET_MIN_BALANCE_WEI) {
      await insertFundingRow({
        wallet_address: wallet,
        email: email || 'unknown',
        funded_amount: FAUCET_AMOUNT_WEI.toString(),
        chain_id: BASE_SEPOLIA_CHAIN_ID,
        status: 'failed_balance',
        error: 'Faucet wallet below refusal threshold',
        transaction_hash: null,
        deployer_address: signer.address,
      });
      await insertAlert('low_balance', wallet, email || null, {
        balanceWei: faucetBalance.toString(),
        refusalThresholdWei: FAUCET_MIN_BALANCE_WEI.toString(),
      });
      return NextResponse.json(
        { error: 'Faucet temporarily unavailable', funded: false },
        { status: 503 },
      );
    }

    if (faucetBalance < FAUCET_LOW_BALANCE_ALERT_WEI) {
      await insertAlert('low_balance', null, null, {
        balanceWei: faucetBalance.toString(),
        alertThresholdWei: FAUCET_LOW_BALANCE_ALERT_WEI.toString(),
        note: 'Below alert threshold but above refusal threshold',
      });
    }

    await requireFreshBaseSepolia(signer.provider as JsonRpcProvider);

    let tx: ethers.TransactionResponse;
    try {
      tx = await signer.sendTransaction({
        to: wallet,
        value: FAUCET_AMOUNT_WEI,
        gasLimit: 21_000,
      });
    } catch (sendError) {
      const message = sendError instanceof Error ? sendError.message : 'sendTransaction failed';
      await insertFundingRow({
        wallet_address: wallet,
        email: email || 'unknown',
        funded_amount: FAUCET_AMOUNT_WEI.toString(),
        chain_id: BASE_SEPOLIA_CHAIN_ID,
        status: 'failed_signing',
        error: message,
        transaction_hash: null,
        deployer_address: signer.address,
      });
      await insertAlert('signing_failure', wallet, email || null, { error: message });
      return NextResponse.json({ error: 'Funding failed', funded: false }, { status: 500 });
    }

    const pendingRow = {
      wallet_address: wallet,
      email: email || 'unknown',
      funded_amount: FAUCET_AMOUNT_WEI.toString(),
      chain_id: BASE_SEPOLIA_CHAIN_ID,
      status: 'pending' as const,
      error: null,
      transaction_hash: tx.hash,
      deployer_address: signer.address,
    };

    const insertResult = await insertPendingFundingRowWithRetry(pendingRow);

    if (!insertResult.ok) {
      await insertAlert('db_failure_after_broadcast', wallet, email || null, {
        tx_hash: tx.hash,
        recipient_wallet: wallet,
        recipient_email: email || null,
        funded_amount_wei: FAUCET_AMOUNT_WEI.toString(),
        faucet_signer_address: signer.address,
        db_error: JSON.stringify(insertResult.error),
      });

      console.error(
        JSON.stringify({
          event: 'db_failure_after_broadcast',
          tx_hash: tx.hash,
          recipient_wallet: wallet,
          recipient_email: email || null,
          funded_amount_wei: FAUCET_AMOUNT_WEI.toString(),
          timestamp_iso: new Date().toISOString(),
          faucet_signer_address: signer.address,
          db_error: JSON.stringify(insertResult.error),
        }),
      );
    }

    return NextResponse.json({
      success: true,
      funded: true,
      message: 'Wallet ready.',
      transactionHash: tx.hash,
      amount: ethers.formatEther(FAUCET_AMOUNT_WEI),
    });
  } catch (error) {
    const isChainGuard = error instanceof ChainGuardError;
    const message = error instanceof Error ? error.message : 'Unknown error';

    if (wallet) {
      await insertFundingRow({
        wallet_address: wallet,
        email: email || 'unknown',
        funded_amount: FAUCET_AMOUNT_WEI.toString(),
        chain_id: BASE_SEPOLIA_CHAIN_ID,
        status: isChainGuard ? 'failed_chain_guard' : 'failed_signing',
        error: message,
        transaction_hash: null,
        deployer_address: null,
      });
    }

    if (isChainGuard) {
      await insertAlert('wrong_chain', wallet || null, email || null, { error: message });
    }

    console.error('[faucet/v2] unexpected error:', error);
    return NextResponse.json({ error: 'Funding failed', funded: false }, { status: 500 });
  }
}

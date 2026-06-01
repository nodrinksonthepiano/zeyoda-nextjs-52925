import { authenticatedFetch } from '@/app/utils/authenticatedFetch';

type ToastFn = (message: string, type?: 'success' | 'error' | 'info') => void;

export type FaucetClientBody = {
  success?: boolean;
  funded?: boolean;
  message?: string;
  error?: string;
  amount?: string;
  transactionHash?: string;
};

function mapFaucetError(error: string | undefined): string {
  switch (error) {
    case 'Faucet disabled':
      return 'Faucet is off. Contact your host.';
    case 'Not eligible':
      return 'Wallet not funded yet. Finish claim or ask your host.';
    case 'Faucet misconfigured':
      return 'Faucet misconfigured. Contact your host.';
    case 'Faucet temporarily unavailable':
      return 'Faucet temporarily unavailable. Try again shortly.';
    case 'Daily faucet cap reached':
      return 'Daily faucet cap reached. Try again later.';
    case 'Daily cap check failed':
      return 'Faucet unavailable. Try again shortly.';
    case 'Funding failed':
      return 'Wallet funding failed. Try again or contact your host.';
    case 'Authentication required':
      return 'Sign in again to fund your wallet.';
    case 'No wallet on session':
      return 'Wallet session missing. Sign in again.';
    case 'Too many requests':
      return 'Too many funding attempts. Wait a moment.';
    case 'Invalid JSON body':
    case 'Invalid request body':
      return 'Funding request failed.';
    default:
      return error?.trim() ? `Wallet funding failed: ${error}` : 'Wallet funding failed.';
  }
}

export function showFaucetFundingToast(
  response: Response,
  body: FaucetClientBody,
  showToast: ToastFn,
): void {
  if (response.ok && body.success === true) {
    const amountSuffix = body.amount ? ` (${body.amount} ETH)` : '';
    showToast(body.message?.trim() || `Wallet funded.${amountSuffix}`, 'success');
    return;
  }

  if (response.ok && body.funded === true) {
    showToast(body.message?.trim() || 'Wallet already ready.', 'success');
    return;
  }

  if (!response.ok) {
    showToast(mapFaucetError(typeof body.error === 'string' ? body.error : undefined), 'error');
    return;
  }

  showToast('Wallet funding status unclear. Try again.', 'error');
}

export async function requestFaucetAndNotify(
  getDidToken: () => Promise<string | null>,
  showToast: ToastFn,
): Promise<void> {
  try {
    const fundingResponse = await authenticatedFetch(
      '/api/faucet/v2',
      { method: 'POST' },
      getDidToken,
    );
    const fundingResult = (await fundingResponse.json().catch(() => ({}))) as FaucetClientBody;
    showFaucetFundingToast(fundingResponse, fundingResult, showToast);
  } catch (fundingError) {
    console.warn('⚠️ Auto-funding failed:', fundingError);
    showToast('Could not reach faucet. Check connection or contact your host.', 'error');
  }
}

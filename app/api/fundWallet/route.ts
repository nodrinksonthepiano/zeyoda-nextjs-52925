import { NextRequest, NextResponse } from 'next/server';

// Disabled permanently. Use /api/faucet/v2 instead.

export async function POST(_request: NextRequest) {
  return NextResponse.json(
    {
      error: 'Endpoint disabled for security. Contact administrator.',
      funded: false,
    },
    { status: 403 },
  );
}

# Download Minting Backend Service Setup

## Overview
This document explains how to set up the backend relayer service for minting download tokens when users purchase with the "Include Featured Download" option.

## Required Environment Variable

Add the following to your `.env.local` file (server-side only):

```bash
# Private key for the wallet that owns the download contracts
# This wallet must be the owner of both GOSHEESH and JAITEA download contracts
DOWNLOAD_MINTER_PK=0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef
```

⚠️ **SECURITY NOTE**: This private key should NEVER be exposed in client-side code or committed to version control.

## How It Works

1. **User Purchase Flow**:
   - User completes an artistock swap with "Include Featured Download" checked
   - Frontend calls `/api/mintDownload` with transaction details
   - Backend verifies the transaction and mints the download token

2. **API Route**: `/api/mintDownload`
   - **Method**: POST
   - **Request Body**:
     ```json
     {
       "artistId": "gosheesh",
       "userAddress": "0x123...",
       "assetId": 1,
       "txHash": "0xabc...",
       "amount": 1
     }
     ```
   - **Response**: 
     ```json
     {
       "success": true,
       "mintTxHash": "0xdef...",
       "message": "Successfully minted download token"
     }
     ```

3. **Verification Steps**:
   - Validates transaction exists and is confirmed
   - Checks that the signer wallet is the contract owner
   - Prevents duplicate minting for the same asset
   - Executes mint transaction with proper gas limits

## Testing

### Debug Endpoint
Use the GET endpoint to check configuration:
```bash
curl "http://localhost:3000/api/mintDownload?artistId=gosheesh"
```

### Expected Response
```json
{
  "artistId": "gosheesh",
  "downloadContract": "0x51A7...",
  "contractOwner": "0x123...",
  "serverConfigured": true,
  "rpcConnected": true
}
```

## Contract Addresses

The system uses these download contracts:
- **GOSHEESH**: `0x51A7...E676`
- **JAITEA**: `0xec7B...ea21`

## Error Handling

The API provides detailed error messages:
- `400`: Invalid request or transaction verification failed
- `404`: Artist or contract not found
- `500`: Server configuration or contract execution errors

## Frontend Integration

The PurchaseFlow component automatically:
1. Calls the mint API after successful swaps
2. Refreshes the download access hook
3. Updates the wallet display with new tokens
4. Shows success/error messages to users

## Security Features

- Transaction verification before minting
- Owner validation to prevent unauthorized minting
- Duplicate minting prevention
- Gas limit controls
- Comprehensive error logging 
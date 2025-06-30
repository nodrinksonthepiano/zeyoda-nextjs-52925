# 🛠️ BROWSER FIX GUIDE - Stop Transaction Blocking

## 🎯 Problem
`net::ERR_BLOCKED_BY_CLIENT` errors prevent transactions from working properly.

## ✅ Quick Fixes

### **Option 1: Disable Ad Blockers (Recommended)**
1. **uBlock Origin**: Click extension → Click power button for `localhost:3000`
2. **AdBlock Plus**: Click extension → "Enabled on this site" toggle OFF
3. **Other blockers**: Whitelist `localhost:3000`

### **Option 2: Use Incognito/Private Mode**
- **Chrome/Edge**: `Cmd+Shift+N` (Mac) or `Ctrl+Shift+N` (PC)
- **Firefox**: `Cmd+Shift+P` (Mac) or `Ctrl+Shift+P` (PC)
- **Safari**: `Cmd+Shift+N`

### **Option 3: Whitelist Domains**
Add these to your ad blocker whitelist:
- `localhost:3000`
- `sepolia.base.org`
- `auth.magic.link`
- `*.supabase.co`

## 🧪 Test if Fixed
1. Open browser console (`F12`)
2. Go to `localhost:3000/?artist=gosheesh`
3. Try a small swap ($1-5)
4. Look for `✅ TreasurySwapLite swap successful` message
5. Should see success popup and page refresh

## 📞 Backup Plan
If still blocked:
1. Try different browser (Firefox, Safari, Edge)
2. Use mobile browser on same network
3. Test on different device/network

The transactions ARE working - we just need the browser to stop blocking the UI updates! 
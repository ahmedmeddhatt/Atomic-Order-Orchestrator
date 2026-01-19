# Quick Testing Guide

## Prerequisites
- Backend running on `http://localhost:9000`
- Frontend running on `http://localhost:3000`

## Step-by-Step Testing

### 1. Start the Backend
```bash
cd backend
npm run start:dev
```

Verify backend is running:
```bash
curl http://localhost:9000/orders
```

### 2. Start the Frontend
```bash
cd fincart-frontend
npm run dev
```

### 3. Open Dashboard
Navigate to: `http://localhost:3000/dashboard`

**Expected Results:**
- ✅ Dashboard loads without errors
- ✅ Socket connection badge shows "Live Socket Connected" (green)
- ✅ Orders table displays data from backend
- ✅ KPI cards show correct counts

### 4. Test Real-Time Updates

From the **root directory**, run:
```bash
node test-webhook.js
```

**Expected Results:**
- ✅ Console shows "Webhook sent successfully"
- ✅ New order appears in the table immediately (no page refresh needed)
- ✅ Order count in KPI cards updates
- ✅ No errors in browser console

### 5. Test Multiple Updates

Run the webhook test multiple times:
```bash
node test-webhook.js
node test-webhook.js
node test-webhook.js
```

**Expected Results:**
- ✅ Each webhook creates a new order
- ✅ Orders appear at the top of the table
- ✅ Table scrolls smoothly (virtualization working)
- ✅ No duplicate orders

### 6. Test Edit Modal

1. Click the edit icon (pencil) on any order
2. Change the status dropdown
3. Click "Save Changes"

**Expected Results:**
- ✅ Modal opens smoothly
- ✅ Form fields are populated
- ✅ Status can be changed
- ✅ "Unsaved Changes" indicator appears
- ✅ Modal closes after save
- ✅ Order updates in the table

### 7. Test Conflict Resolution

1. Open edit modal for an order
2. Make a change (don't save yet)
3. In another terminal, run `test-webhook.js` with the same order ID
4. Observe conflict alert

**Expected Results:**
- ✅ Conflict alert appears (red banner)
- ✅ Shows "Your Change" vs "Server Value"
- ✅ Can click "Refresh (Accept Server)" to discard changes
- ✅ Can click "Force Overwrite" to keep your changes
- ✅ Save button is disabled during conflict

### 8. Test Socket Reconnection

1. Stop the backend server
2. Observe socket badge turns red: "Socket Disconnected"
3. Restart the backend server
4. Observe socket badge turns green: "Live Socket Connected"

**Expected Results:**
- ✅ Socket disconnection is detected
- ✅ Warning message appears: "Updates paused (Reconnecting...)"
- ✅ Socket reconnects automatically when backend is back
- ✅ Real-time updates resume

## Browser Console Checks

Open browser DevTools (F12) and check:

### Console Tab
Should see:
```
Socket connected: <socket-id>
```

Should NOT see:
- ❌ CORS errors
- ❌ Failed to fetch errors
- ❌ WebSocket connection errors
- ❌ Type errors

### Network Tab
Check:
- ✅ `GET /orders` returns 200 OK
- ✅ WebSocket connection to `/sync` is established
- ✅ `ORDER_SYNCED` events are received

## Common Issues

### Socket Won't Connect
1. Check backend is running: `curl http://localhost:9000/orders`
2. Check `.env.local` has correct URLs
3. Check backend Socket.IO namespace is `/sync`
4. Clear browser cache and reload

### Orders Not Displaying
1. Check backend has orders: `curl http://localhost:9000/orders`
2. Check browser console for errors
3. Verify CORS is enabled on backend
4. Check `NEXT_PUBLIC_API_URL` in `.env.local`

### Real-Time Updates Not Working
1. Verify socket is connected (green badge)
2. Check browser console for `ORDER_SYNCED` events
3. Run `test-webhook.js` and watch console
4. Verify backend is emitting events

## Success Criteria

✅ All tests pass
✅ No console errors
✅ Socket stays connected
✅ Real-time updates work
✅ Conflict resolution works
✅ UI is responsive and smooth

## Performance Check

With 5000+ orders:
- ✅ Table scrolls smoothly (60 FPS)
- ✅ No lag when receiving updates
- ✅ Memory usage stays stable
- ✅ CPU usage is reasonable

## Next Steps

If all tests pass:
1. ✅ Integration is complete
2. ✅ Ready for production testing
3. ✅ Can extend backend to provide customer/items data
4. ✅ Can add additional features (filtering, search, etc.)

If tests fail:
1. Check the troubleshooting section in `INTEGRATION_SUMMARY.md`
2. Review browser console errors
3. Verify backend configuration
4. Check environment variables

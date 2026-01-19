# Frontend Integration Guide for Fincart Backend

## Overview
This document describes the backend API structure, WebSocket events, and data models for the **Atomic Order Orchestrator** backend. The frontend should integrate with these endpoints to display real-time order data.

---

## Backend Configuration

### Base URLs
- **API Base URL**: `http://localhost:9000`
- **WebSocket URL**: `http://localhost:9000/sync` (Socket.IO namespace)

### Environment Variables (Frontend `.env.local`)
```env
NEXT_PUBLIC_API_URL=http://localhost:9000
NEXT_PUBLIC_WS_URL=http://localhost:9000
```

---

## API Endpoints

### 1. GET `/orders`
Retrieves all orders from the database.

**Request:**
```http
GET http://localhost:9000/orders
```

**Response:** `200 OK`
```json
[
  {
    "id": "ecd6cfa5-b123-4567-8901-234567890abc",
    "shopifyOrderId": "123457343",
    "status": "CONFIRMED",
    "shippingFee": "5.99",
    "lastExternalUpdatedAt": "2026-01-15T18:30:00.000Z",
    "version": 1,
    "createdAt": "2026-01-15T18:25:00.000Z",
    "updatedAt": "2026-01-15T18:30:00.000Z"
  }
]
```

**Response Fields:**
| Field | Type | Description |
|-------|------|-------------|
| `id` | UUID | Internal database ID |
| `shopifyOrderId` | string | Shopify's order identifier |
| `status` | enum | One of: `PENDING`, `CONFIRMED`, `SHIPPED`, `CANCELLED` |
| `shippingFee` | decimal | Calculated shipping fee based on order total |
| `lastExternalUpdatedAt` | ISO8601 | Last update timestamp from Shopify |
| `version` | number | Optimistic locking version (increments on each update) |
| `createdAt` | ISO8601 | Record creation timestamp |
| `updatedAt` | ISO8601 | Last modification timestamp |

**Notes:**
- Returns up to 50 most recent orders (sorted by `updatedAt DESC`)
- Pagination can be added later if needed

---

### 2. POST `/webhooks/shopify`
Receives Shopify webhook events for order creation/updates.

**Request:**
```http
POST http://localhost:9000/webhooks/shopify
Content-Type: application/json
x-shopify-webhook-id: webhook-1234567890
x-shopify-topic: orders/create
```

**Request Body:**
```json
{
  "id": "123456789",
  "updated_at": "2026-01-17T18:30:00Z",
  "financial_status": "paid",
  "fulfillment_status": null,
  "total_price": "150.00"
}
```

**Response:** `200 OK`
```json
{
  "status": "accepted",
  "webhookId": "webhook-1234567890"
}
```

**Notes:**
- This endpoint is for Shopify webhooks only
- Frontend should NOT call this endpoint directly
- Used for testing with the `test-webhook.js` script

---

## WebSocket Integration

### Connection
The backend uses **Socket.IO** with a `/sync` namespace for real-time updates.

**Connection URL:** `http://localhost:9000/sync`

**Socket.IO Configuration:**
```typescript
import { io } from 'socket.io-client';

const socket = io('http://localhost:9000/sync', {
  transports: ['websocket', 'polling'],
  reconnection: true,
  reconnectionAttempts: 5,
  reconnectionDelay: 1000,
});
```

### Events

#### 1. `ORDER_SYNCED` (Server → Client)
Emitted when an order is created or updated.

**Event Payload:**
```typescript
interface OrderSyncedPayload {
  id: string;                    // Internal UUID
  shopifyOrderId: string;        // Shopify order ID
  status: string;                // PENDING | CONFIRMED | SHIPPED | CANCELLED
  shippingFee: number;           // Calculated shipping fee
  updatedAt: Date;               // Last update timestamp
  version: number;               // Version for optimistic locking
}
```

**Example:**
```json
{
  "id": "ecd6cfa5-b123-4567-8901-234567890abc",
  "shopifyOrderId": "123457343",
  "status": "CONFIRMED",
  "shippingFee": 5.99,
  "updatedAt": "2026-01-17T18:30:00.000Z",
  "version": 2
}
```

**Frontend Handling:**
```typescript
socket.on('ORDER_SYNCED', (payload: OrderSyncedPayload) => {
  // Update the order in React Query cache
  queryClient.setQueryData<Order[]>(['orders'], (oldOrders) => {
    if (!oldOrders) return oldOrders;
    
    const index = oldOrders.findIndex(
      o => o.id === payload.id || o.shopifyOrderId === payload.shopifyOrderId
    );
    
    if (index > -1) {
      // Update existing order (only if version is newer)
      if (payload.version > oldOrders[index].version) {
        const newOrders = [...oldOrders];
        newOrders[index] = { ...oldOrders[index], ...payload };
        return newOrders;
      }
      return oldOrders;
    } else {
      // Add new order to the list
      return [mapBackendToFrontend(payload), ...oldOrders];
    }
  });
});
```

---

## Data Model Mapping

### Backend Order Entity
```typescript
{
  id: string;                      // UUID
  shopifyOrderId: string;          // Shopify ID
  status: OrderStatus;             // Enum
  shippingFee: number;             // Decimal
  lastExternalUpdatedAt: Date;     // ISO8601
  version: number;                 // Integer
  createdAt: Date;                 // ISO8601
  updatedAt: Date;                 // ISO8601
}
```

### Frontend Order Interface (Current)
```typescript
{
  id: string;
  shopifyOrderId: string;
  version: number;
  status: OrderStatus;
  shippingFee?: number;
  customer: Customer;              // NOT in backend
  items: OrderItem[];              // NOT in backend
  total: number;                   // NOT in backend
  trackingNumber?: string;         // NOT in backend
  createdAt: string;
  updatedAt: string;
}
```

### Required Frontend Changes

#### 1. Update Type Definitions
The backend does NOT store customer, items, or total data. The frontend should either:
- **Option A**: Make these fields optional and use mock data for display
- **Option B**: Fetch additional data from Shopify API separately
- **Option C**: Extend the backend to store this data

**Recommended: Option A (Quick Fix)**
```typescript
// types/order.ts
export interface Order {
  id: string;
  shopifyOrderId: string;
  version: number;
  status: OrderStatus;
  shippingFee: number;
  createdAt: string;
  updatedAt: string;
  
  // Optional fields (for display purposes)
  customer?: Customer;
  items?: OrderItem[];
  total?: number;
  trackingNumber?: string;
}
```

#### 2. Update `useOrders` Hook
```typescript
// hooks/useOrders.ts
const fetchOrders = async (): Promise<Order[]> => {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:9000';
  const response = await fetch(`${apiUrl}/orders`);
  
  if (!response.ok) {
    throw new Error('Failed to fetch orders');
  }
  
  const data = await response.json();
  
  // Map backend data to frontend format
  return data.map((order: any) => ({
    id: order.id,
    shopifyOrderId: order.shopifyOrderId,
    version: order.version,
    status: order.status,
    shippingFee: Number(order.shippingFee),
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
    
    // Mock data for display (until backend provides it)
    customer: {
      id: 'shopify-customer',
      name: 'Shopify Customer',
      email: 'customer@shopify.com',
      address: 'Shopify Address',
    },
    items: [],
    total: Number(order.shippingFee) || 0,
    trackingNumber: `TRACK-${order.shopifyOrderId}`,
  }));
};
```

#### 3. Update `useOrderSync` Hook
```typescript
// hooks/useOrderSync.ts
export const useOrderSync = () => {
  const baseUrl = process.env.NEXT_PUBLIC_WS_URL || 'http://localhost:9000';
  const socketUrl = `${baseUrl}/sync`;
  const { on, isConnected } = useSocket(socketUrl);
  const queryClient = useQueryClient();

  useEffect(() => {
    const unsubscribe = on('ORDER_SYNCED', (event: any) => {
      queryClient.setQueryData<Order[]>(['orders'], (oldOrders) => {
        if (!oldOrders) return oldOrders;

        const existingIndex = oldOrders.findIndex(
          o => o.id === event.id || o.shopifyOrderId === event.shopifyOrderId
        );

        if (existingIndex > -1) {
          const existing = oldOrders[existingIndex];
          
          // Only update if version is newer
          if (event.version > existing.version) {
            const updated = {
              ...existing,
              status: event.status,
              shippingFee: Number(event.shippingFee),
              updatedAt: event.updatedAt,
              version: event.version,
              total: Number(event.shippingFee),
            };
            
            const newOrders = [...oldOrders];
            newOrders[existingIndex] = updated;
            return newOrders;
          }
          return oldOrders;
        } else {
          // New order - add to list
          const newOrder: Order = {
            id: event.id,
            shopifyOrderId: event.shopifyOrderId,
            version: event.version,
            status: event.status,
            shippingFee: Number(event.shippingFee),
            createdAt: event.updatedAt,
            updatedAt: event.updatedAt,
            customer: {
              id: 'shopify-customer',
              name: 'Shopify Customer',
              email: 'customer@shopify.com',
              address: 'Shopify Address',
            },
            items: [],
            total: Number(event.shippingFee),
            trackingNumber: `TRACK-${event.shopifyOrderId}`,
          };
          return [newOrder, ...oldOrders];
        }
      });
    });

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [on, queryClient]);

  return { isConnected };
};
```

#### 4. Fix Hydration Error
Add `suppressHydrationWarning` to the root layout:

```tsx
// app/layout.tsx
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        <QueryProvider>
          {children}
        </QueryProvider>
      </body>
    </html>
  );
}
```

---

## Order Status Enum

```typescript
enum OrderStatus {
  PENDING = 'PENDING',       // Initial state or payment pending
  CONFIRMED = 'CONFIRMED',   // Payment confirmed
  SHIPPED = 'SHIPPED',       // Order fulfilled/shipped
  CANCELLED = 'CANCELLED',   // Refunded or voided
}
```

**Status Mapping from Shopify:**
- `financial_status: 'paid'` → `CONFIRMED`
- `financial_status: 'pending'` → `PENDING`
- `fulfillment_status: 'fulfilled'` → `SHIPPED`
- `financial_status: 'refunded'` → `CANCELLED`

---

## Testing

### 1. Test Backend Connection
```bash
# From the backend directory
curl http://localhost:9000/orders
```

### 2. Test Webhook
```bash
# From the root directory
node test-webhook.js
```

This will:
1. Send a mock Shopify webhook to the backend
2. Backend processes it and saves to database
3. Backend emits `ORDER_SYNCED` via WebSocket
4. Frontend should receive the event and update the UI

### 3. Verify WebSocket Connection
Open browser console on `http://localhost:3000/dashboard` and check for:
```
Socket connected: <socket-id>
```

---

## Common Issues & Fixes

### Issue 1: Socket Disconnected
**Symptoms:** Red "Socket Disconnected" badge

**Fixes:**
1. Ensure backend is running on port 9000
2. Check `NEXT_PUBLIC_WS_URL` in `.env.local`
3. Verify socket URL includes `/sync` namespace
4. Add `'polling'` to transports array

### Issue 2: Hydration Mismatch Error
**Symptoms:** Full-screen error overlay in development

**Fix:** Add `suppressHydrationWarning` to `<html>` tag in `layout.tsx`

### Issue 3: Orders Not Displaying
**Symptoms:** Empty table or skeleton loaders

**Fixes:**
1. Check browser console for fetch errors
2. Verify CORS is enabled on backend (already configured)
3. Ensure `NEXT_PUBLIC_API_URL` is set correctly
4. Check that backend has orders in database

### Issue 4: Real-time Updates Not Working
**Symptoms:** Socket connected but table doesn't update

**Fixes:**
1. Verify `ORDER_SYNCED` event listener is registered
2. Check browser console for socket events
3. Ensure version comparison logic is correct
4. Test with `test-webhook.js` script

---

## Architecture Overview

```
┌─────────────────┐
│   Shopify       │
│   Webhooks      │
└────────┬────────┘
         │ POST /webhooks/shopify
         ▼
┌─────────────────────────────────┐
│   NestJS Backend (Port 9000)    │
│                                 │
│  ┌──────────────────────────┐  │
│  │  Orders Controller       │  │
│  │  - GET /orders           │  │
│  │  - POST /webhooks/shopify│  │
│  └──────────┬───────────────┘  │
│             │                   │
│  ┌──────────▼───────────────┐  │
│  │  Orders Service          │  │
│  │  - findAll()             │  │
│  │  - createOrder()         │  │
│  │  - calculateShipping()   │  │
│  └──────────┬───────────────┘  │
│             │                   │
│  ┌──────────▼───────────────┐  │
│  │  BullMQ Queue            │  │
│  │  - process-order job     │  │
│  └──────────┬───────────────┘  │
│             │                   │
│  ┌──────────▼───────────────┐  │
│  │  Orders Processor        │  │
│  │  - Saves to PostgreSQL   │  │
│  │  - Emits WebSocket event │  │
│  └──────────┬───────────────┘  │
│             │                   │
│  ┌──────────▼───────────────┐  │
│  │  Sync Gateway            │  │
│  │  - Socket.IO /sync       │  │
│  │  - Emits ORDER_SYNCED    │  │
│  └──────────────────────────┘  │
└─────────────┬───────────────────┘
              │ WebSocket
              ▼
┌─────────────────────────────────┐
│   Next.js Frontend (Port 3000)  │
│                                 │
│  ┌──────────────────────────┐  │
│  │  useOrders Hook          │  │
│  │  - Fetches GET /orders   │  │
│  │  - React Query cache     │  │
│  └──────────────────────────┘  │
│                                 │
│  ┌──────────────────────────┐  │
│  │  useOrderSync Hook       │  │
│  │  - Connects to /sync     │  │
│  │  - Listens ORDER_SYNCED  │  │
│  │  - Updates cache         │  │
│  └──────────────────────────┘  │
│                                 │
│  ┌──────────────────────────┐  │
│  │  Dashboard Page          │  │
│  │  - Displays orders       │  │
│  │  - Shows socket status   │  │
│  └──────────────────────────┘  │
└─────────────────────────────────┘
```

---

## Next Steps for Frontend Team

1. ✅ **Fix Hydration Error**: Add `suppressHydrationWarning` to `layout.tsx`
2. ✅ **Update Type Definitions**: Make customer/items/total optional in `Order` interface
3. ✅ **Update `useOrders` Hook**: Map backend response to frontend format
4. ✅ **Update `useOrderSync` Hook**: Handle `ORDER_SYNCED` events correctly
5. ✅ **Test Connection**: Verify socket connects and shows green badge
6. ✅ **Test Real-time Updates**: Run `test-webhook.js` and verify table updates
7. 🔄 **Optional**: Add error boundaries and loading states
8. 🔄 **Optional**: Add pagination for large order lists

---

## Support

For questions or issues, contact the backend team or check:
- Backend logs: `npm run start:dev` output
- Frontend console: Browser DevTools
- WebSocket events: Socket.IO DevTools extension

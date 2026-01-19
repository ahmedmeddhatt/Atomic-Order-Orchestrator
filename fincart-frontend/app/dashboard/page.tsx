'use client';

import { useOrders } from '@/hooks/useOrders';
import { useOrderSync } from '@/hooks/useOrderSync';
import { OrdersTable } from '@/components/orders-table';
import { Activity, ServerOff } from 'lucide-react';

export default function DashboardPage() {
  const { orders, isLoading, isError } = useOrders();
  const { isConnected } = useOrderSync();

  console.log('🎯 [Dashboard] Render:', { isLoading, isError, ordersCount: orders.length, isConnected });

  if (isError) {
    console.error('🚨 [Dashboard] Error state detected - showing error UI');
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900">Failed to load orders</h2>
          <p className="mt-2 text-gray-600">Please try refreshing the page.</p>
        </div>
      </div>
    );
  }

  const activeShipmentsCount = orders.filter(
    o => o.status === 'PENDING' || o.status === 'SHIPPED'
  ).length;

  return (
    <div className="min-h-screen bg-gray-100 font-sans text-gray-900">
      {/* Top Navigation / Header */}
      <header className="sticky top-0 z-30 w-full border-b bg-white/80 backdrop-blur-md">
        <div className="container mx-auto flex h-16 items-center justify-between px-6">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-blue-600 flex items-center justify-center">
              <Activity className="h-5 w-5 text-white" />
            </div>
            <h1 className="text-xl font-bold tracking-tight">Atomic Order Orchestrator</h1>
          </div>
          
          <div className="flex items-center gap-4">
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium ${
              isConnected 
                ? 'bg-green-100 text-green-700' 
                : 'bg-red-100 text-red-700'
            }`}>
              <div className={`h-2 w-2 rounded-full ${isConnected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
              {isConnected ? 'Live Socket Connected' : 'Socket Disconnected'}
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto p-6 space-y-6">
        {/* KPI Cards */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
            <div className="text-sm font-medium text-gray-500">Total Orders</div>
            <div className="mt-2 text-3xl font-bold text-gray-900">
              {isLoading ? '...' : orders.length.toLocaleString()}
            </div>
            <div className="mt-1 text-xs text-green-600 font-medium">
               Real-time
            </div>
          </div>
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
            <div className="text-sm font-medium text-gray-500">Active Shipments</div>
            <div className="mt-2 text-3xl font-bold text-blue-600">
              {isLoading ? '...' : activeShipmentsCount.toLocaleString()}
            </div>
            <div className="mt-1 text-xs text-gray-500">
               Pending or Shipped
            </div>
          </div>
           {/* Placeholder KPIs */}
           <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 opacity-60">
            <div className="text-sm font-medium text-gray-500">Revenue (24h)</div>
            <div className="mt-2 text-3xl font-bold text-gray-900">$124.5k</div>
          </div>
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 opacity-60">
            <div className="text-sm font-medium text-gray-500">Avg. Delivery Time</div>
            <div className="mt-2 text-3xl font-bold text-gray-900">42m</div>
          </div>
        </div>

        {/* Main Content Area */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">Live Logistics Feed</h2>
             {!isConnected && (
                <div className="flex items-center gap-2 text-amber-600 text-sm bg-amber-50 px-3 py-1 rounded-md border border-amber-200">
                  <ServerOff className="h-4 w-4" />
                  <span>Updates paused (Reconnecting...)</span>
                </div>
             )}
          </div>
          
          <OrdersTable orders={orders} isLoading={isLoading} />
        </div>
      </main>
    </div>
  );
}

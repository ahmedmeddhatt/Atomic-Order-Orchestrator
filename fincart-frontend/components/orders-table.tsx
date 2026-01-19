import { useRef, useState } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { Order } from '@/types/order';
import { StatusBadge } from './ui/status-badge';
import { EditOrderModal } from './edit-order-modal';
import { Skeleton } from './ui/skeleton';
import { cn } from '@/lib/utils';
import { Edit2 } from 'lucide-react';

interface OrdersTableProps {
  orders: Order[];
  isLoading: boolean;
}

export function OrdersTable({ orders, isLoading }: OrdersTableProps) {
  const parentRef = useRef<HTMLDivElement>(null);
  const [editingOrder, setEditingOrder] = useState<Order | null>(null);

  const virtualizer = useVirtualizer({
    count: isLoading ? 15 : orders.length, // Render skeleton rows if loading
    getScrollElement: () => parentRef.current,
    estimateSize: () => 60, // Estimated row height in px
    overscan: 5,
  });

  const virtualItems = virtualizer.getVirtualItems();

  if (isLoading) {
    return (
      <div className="border rounded-xl bg-white shadow-sm overflow-hidden">
         <div className="grid grid-cols-12 gap-4 px-6 py-3 bg-gray-50 border-b text-xs font-semibold text-gray-500 uppercase tracking-wider">
            <div className="col-span-2">Order ID</div>
            <div className="col-span-3">Customer</div>
            <div className="col-span-2">Status</div>
            <div className="col-span-2">Amount</div>
            <div className="col-span-2">Tracking</div>
            <div className="col-span-1 text-right">Actions</div>
        </div>
        <div className="p-4 space-y-4">
          {Array.from({ length: 15 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="border rounded-xl bg-white shadow-sm flex flex-col h-[700px]">
        {/* Table Header */}
        <div className="grid grid-cols-12 gap-4 px-6 py-3 bg-gray-50 border-b text-xs font-semibold text-gray-500 uppercase tracking-wider sticky top-0 z-10">
            <div className="col-span-2">Order ID</div>
            <div className="col-span-3">Customer</div>
            <div className="col-span-2">Status</div>
            <div className="col-span-2">Amount</div>
            <div className="col-span-2">Tracking</div>
            <div className="col-span-1 text-right">Actions</div>
        </div>

        {/* Scrollable Body */}
        <div 
          ref={parentRef} 
          className="flex-1 overflow-y-auto contain-strict"
        >
          <div
            style={{
              height: `${virtualizer.getTotalSize()}px`,
              width: '100%',
              position: 'relative',
            }}
          >
            {virtualItems.map((virtualItem) => {
              const order = orders[virtualItem.index];
              if (!order) return null;

              return (
                <div
                  key={order.id}
                  className={cn(
                    "absolute top-0 left-0 w-full grid grid-cols-12 gap-4 px-6 py-3 items-center border-b hover:bg-gray-50 transition-colors",
                    virtualItem.index % 2 === 0 ? "bg-white" : "bg-slate-50/50" // Alternate row stripes
                  )}
                  style={{
                    height: `${virtualItem.size}px`,
                    transform: `translateY(${virtualItem.start}px)`,
                  }}
                >
                  <div className="col-span-2 font-mono text-sm font-medium text-gray-900 truncate">
                    #{order.id.slice(0, 8)}
                  </div>
                  <div className="col-span-3">
                    <div className="text-sm font-medium text-gray-900 truncate">{order.customer?.name || 'N/A'}</div>
                    <div className="text-xs text-gray-500 truncate">{order.customer?.email || 'N/A'}</div>
                  </div>
                  <div className="col-span-2">
                    <StatusBadge status={order.status} />
                  </div>
                  <div className="col-span-2 font-mono text-sm text-gray-600">
                    ${(order.total || 0).toLocaleString()}
                  </div>
                  <div className="col-span-2 text-sm text-gray-500 truncate font-mono">
                    {order.trackingNumber || '—'}
                  </div>
                  <div className="col-span-1 text-right">
                    <button 
                      onClick={() => setEditingOrder(order)}
                      className="p-1.5 hover:bg-gray-200 rounded-md text-gray-500 hover:text-gray-700 transition-colors"
                      title="Edit Order"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Edit Modal */}
      {editingOrder && (
        <EditOrderModal
          order={editingOrder}
          isOpen={!!editingOrder}
          onClose={() => setEditingOrder(null)}
        />
      )}
    </>
  );
}

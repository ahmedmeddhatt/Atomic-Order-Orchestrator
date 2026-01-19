import { useState, useEffect, useRef } from 'react';
import { X, AlertTriangle } from 'lucide-react';
import { Order, OrderStatus, SocketOrderEvent } from '@/types/order';
import { useSocket } from '@/hooks/useSocket';
import { useOrders } from '@/hooks/useOrders';
import { StatusBadge } from '@/components/ui/status-badge';
import { cn } from '@/lib/utils';

interface EditOrderModalProps {
  order: Order;
  isOpen: boolean;
  onClose: () => void;
}

export function EditOrderModal({ order: initialOrder, isOpen, onClose }: EditOrderModalProps) {
  const [formData, setFormData] = useState<Order>(initialOrder);
  const [isDirty, setIsDirty] = useState(false);
  const [conflict, setConflict] = useState<{ serverOrder: Order } | null>(null);
  
  const initialVersionRef = useRef(initialOrder.version);
  const baseUrl = process.env.NEXT_PUBLIC_WS_URL || 'http://localhost:9000';
  const socketUrl = `${baseUrl}/sync`;
  const { on, emit } = useSocket(socketUrl);
  const { updateOrder } = useOrders();

  // Reset state when order changes or modal opens
  useEffect(() => {
    if (isOpen) {
      setFormData(initialOrder);
      setIsDirty(false);
      setConflict(null);
      initialVersionRef.current = initialOrder.version;
    }
  }, [initialOrder, isOpen]);

  // Listen for conflict events
  useEffect(() => {
    if (!isOpen) return;

    // Listen to ORDER_SYNCED events from backend
    const unsubscribe = on('ORDER_SYNCED', (event: any) => {
      // THE GUARD: Logic Core
      if (
        event.id === initialOrder.id &&
        event.version > initialVersionRef.current &&
        isDirty
      ) {
        // Conflict detected - user has unsaved changes and server updated
        setConflict({ 
          serverOrder: {
            ...initialOrder,
            ...event,
            shippingFee: Number(event.shippingFee),
            total: Number(event.shippingFee),
          }
        });
      } else if (
        event.id === initialOrder.id && 
        event.version > initialVersionRef.current && 
        !isDirty
      ) {
        // No conflict - user hasn't made changes, so update form data
        setFormData(prev => ({
          ...prev,
          status: event.status,
          shippingFee: Number(event.shippingFee),
          updatedAt: event.updatedAt,
          version: event.version,
          total: Number(event.shippingFee),
        }));
        initialVersionRef.current = event.version;
      }
    });

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [isOpen, initialOrder.id, on, isDirty]);

  const handleFieldChange = (field: keyof Order, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setIsDirty(true);
  };

  const handleResolve = (strategy: 'mine' | 'server') => {
    if (strategy === 'server' && conflict) {
      // Overwrite local with server data
      setFormData(conflict.serverOrder);
      initialVersionRef.current = conflict.serverOrder.version;
      setConflict(null);
      setIsDirty(false); // Reset dirty since we essentially just loaded fresh data
    } else {
      // Force overwrite - we will submit our data
      // For UI, we just clear the conflict warning and allow save
      setConflict(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Simulate API call to save
    // In real app: await fetch(`/api/orders/${order.id}`, { method: 'PUT', body: JSON.stringify(formData) })
    
    // Optimistic update
    updateOrder(formData.id, (old) => ({ ...formData, version: (old.version || 0) + 1 }));
    
    // Emit event to mock backend (since we don't have a real one receiving PUTs)
    emit('UPDATE_ORDER', { orderId: formData.id, data: formData });
    
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-2xl bg-white rounded-xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="text-xl font-bold text-gray-900">
            Edit Order <span className="text-gray-500">#{formData.id}</span>
          </h2>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Conflict Alert */}
        {conflict && (
          <div className="bg-red-50 px-6 py-4 border-b border-red-100 animate-in slide-in-from-top-2">
            <div className="flex items-start gap-4">
              <div className="p-2 bg-red-100 rounded-full">
                <AlertTriangle className="w-5 h-5 text-red-600" />
              </div>
              <div className="flex-1">
                <h3 className="text-sm font-bold text-red-800">Merge Conflict Detected</h3>
                <p className="items-center mt-1 text-sm text-red-700">
                  This order was modified by the server while you were editing.
                </p>
                
                <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
                  <div className="p-3 bg-white rounded border border-red-200">
                    <span className="block text-xs font-semibold text-gray-500 uppercase">Your Change</span>
                    <div className="mt-1 font-medium">{formData.status}</div>
                  </div>
                  <div className="p-3 bg-white rounded border border-red-200">
                     <span className="block text-xs font-semibold text-gray-500 uppercase">Server Value</span>
                     <div className="mt-1 font-medium">{conflict.serverOrder.status}</div>
                  </div>
                </div>

                <div className="mt-4 flex gap-3">
                  <button 
                    onClick={() => handleResolve('server')}
                    className="px-3 py-1.5 bg-red-100 text-red-700 font-medium rounded hover:bg-red-200 text-sm"
                  >
                    Refresh (Accept Server)
                  </button>
                  <button 
                    onClick={() => handleResolve('mine')}
                    className="px-3 py-1.5 bg-red-600 text-white font-medium rounded hover:bg-red-700 text-sm"
                  >
                    Force Overwrite
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Status</label>
              <select
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                value={formData.status}
                onChange={(e) => handleFieldChange('status', e.target.value)}
              >
                {Object.values(OrderStatus).map((status) => (
                  <option key={status} value={status}>{status}</option>
                ))}
              </select>
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Tracking Number</label>
              <input
                type="text"
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                value={formData.trackingNumber || ''}
                onChange={(e) => handleFieldChange('trackingNumber', e.target.value)}
                placeholder="e.g. TRK-123456789"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">Notes</label>
            <textarea
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none h-32 resize-none"
              value={formData.notes || ''}
              onChange={(e) => handleFieldChange('notes', e.target.value)}
              placeholder="Add internal notes..."
            />
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between pt-4 border-t">
            <div className="text-xs text-gray-500">
              Order Version: <span className="font-mono bg-gray-100 px-1 py-0.5 rounded">{initialVersionRef.current}</span>
              {isDirty && <span className="ml-2 text-orange-600 font-medium">(Unsaved Changes)</span>}
            </div>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg font-medium transition-colors"
                disabled={!!conflict}
              >
                Cancel
              </button>
              <button
                type="submit"
                className={cn(
                  "px-4 py-2 bg-blue-600 text-white rounded-lg font-medium shadow-sm hover:bg-blue-700 transition-all",
                  conflict && "opacity-50 cursor-not-allowed"
                )}
                disabled={!!conflict}
              >
                Save Changes
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

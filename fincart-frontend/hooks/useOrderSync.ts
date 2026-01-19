import { useEffect, useRef, useCallback, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { useQueryClient } from '@tanstack/react-query';
import { Order } from '@/types/order';

// Types for socket updates
interface OrderUpdate {
  id: string;
  shopifyOrderId?: string;
  status?: string;
  shippingFee?: number;
  updatedAt: string;
  version: number;
}

export const useOrderSync = () => {
  const queryClient = useQueryClient();
  const socketRef = useRef<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  
  // 1. BUFFER: Store updates here instead of React State
  // Using useRef means updates accumulate WITHOUT triggering re-renders
  const updateBuffer = useRef<Map<string, OrderUpdate>>(new Map());
  const flushTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // 2. BATCH PROCESSOR: Merges buffer into React Query cache once every 100-200ms
  const flushUpdates = useCallback(() => {
    if (updateBuffer.current.size === 0) return;

    // Create a snapshot of updates to process
    const updatesToProcess = new Map(updateBuffer.current);
    updateBuffer.current.clear();

    console.log(`🚀 Flushing ${updatesToProcess.size} buffered socket updates...`);

    // 3. OPTIMISTIC UPDATE: Direct manipulation of Query Cache
    // This is much faster than setState() for huge lists
    queryClient.setQueryData<Order[]>(['orders'], (oldOrders) => {
      if (!oldOrders) return oldOrders;

      // Map over all orders and apply buffered updates
      return oldOrders.map((order) => {
        const update = updatesToProcess.get(order.id);
        if (update && update.version > order.version) {
          return {
            ...order,
            status: update.status ?? order.status,
            shippingFee: update.shippingFee ?? order.shippingFee,
            total: update.shippingFee ?? order.total,
            updatedAt: update.updatedAt,
            version: update.version,
          };
        }
        return order;
      });
    });
  }, [queryClient]);

  useEffect(() => {
    // Initialize Socket with optimized transport settings
    const baseUrl = process.env.NEXT_PUBLIC_WS_URL || 'http://localhost:9000';
    
    socketRef.current = io(baseUrl, {
      transports: ['websocket'], // Force websocket to avoid HTTP polling overhead
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: 10,
    });

    const socket = socketRef.current;

    socket.on('connect', () => {
      console.log('✅ Socket connected:', socket.id);
      setIsConnected(true);
    });

    socket.on('disconnect', () => {
      console.log('❌ Socket disconnected');
      setIsConnected(false);
    });

    // 4. LISTENER: Push to buffer, don't render yet
    socket.on('ORDER_SYNCED', (payload: any) => {
      const update: OrderUpdate = {
        id: payload.id,
        shopifyOrderId: payload.shopifyOrderId,
        status: payload.status,
        shippingFee: Number(payload.shippingFee),
        updatedAt: payload.updatedAt,
        version: payload.version,
      };
      
      updateBuffer.current.set(payload.id, update);

      // Debounce: If no flush is scheduled, schedule one in 100ms
      if (!flushTimeoutRef.current) {
        flushTimeoutRef.current = setTimeout(() => {
          flushUpdates();
          flushTimeoutRef.current = null;
        }, 100); // 100ms latency is imperceptible but batches 10+ updates
      }
    });

    return () => {
      if (flushTimeoutRef.current) clearTimeout(flushTimeoutRef.current);
      socket.disconnect();
    };
  }, [flushUpdates]);

  return { isConnected };
};

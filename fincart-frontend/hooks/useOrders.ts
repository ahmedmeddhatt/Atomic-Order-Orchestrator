import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Order } from '@/types/order';

// Fetch orders from API
const fetchOrders = async (): Promise<Order[]> => {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:9000';
  console.log('📡 [useOrders] Fetching from:', `${apiUrl}/orders`);
  
  try {
    const response = await fetch(`${apiUrl}/orders`);
    console.log('📡 [useOrders] Response status:', response.status);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ [useOrders] API Error:', response.status, errorText);
      throw new Error(`Failed to fetch orders (${response.status}): ${errorText}`);
    }
    
    const data = await response.json();
    console.log('✅ [useOrders] Fetched response:', data);
    
    // Backend returns paginated response: { data: [...], total: 5005, skip: 0, take: 50, hasMore: true }
    const orders = Array.isArray(data) ? data : data.data || [];
    console.log('✅ [useOrders] Extracted orders:', orders.length, 'items');
    
    // Map backend data to frontend format
    return orders.map((order: any) => ({
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
  } catch (error) {
    console.error('❌ [useOrders] Exception during fetch:', error);
    throw error;
  }
};

export const useOrders = () => {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['orders'],
    queryFn: fetchOrders,
  });

  console.log('📊 [useOrders] Query state:', {
    status: query.status,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    dataLength: query.data?.length || 0,
  });

  // Helper for surgical updates (optimistic or real-time)
  const updateOrder = (orderId: string, updater: (oldOrder: Order) => Order) => {
    queryClient.setQueryData<Order[]>(['orders'], (oldOrders) => {
      if (!oldOrders) return oldOrders;
      
      return oldOrders.map((order) => 
        order.id === orderId ? updater(order) : order
      );
    });
  };

  return {
    ...query,
    orders: query.data || [],
    updateOrder,
  };
};

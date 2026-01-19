import { NextResponse } from 'next/server';
import { Order, OrderStatus } from '@/types/order';

// Generate 5000+ mock orders
const generateMockOrders = (count: number): Order[] => {
  return Array.from({ length: count }).map((_, i) => ({
    id: `ord_${Math.random().toString(36).substr(2, 9)}_${i}`,
    shopifyOrderId: `shopify_${Math.random().toString(36).substr(2, 9)}`,
    version: 1,
    status: Object.values(OrderStatus)[Math.floor(Math.random() * 4)],
    shippingFee: Math.floor(Math.random() * 50) + 5,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    // Optional fields for display
    customer: {
      id: `cust_${i}`,
      name: `Customer ${i + 1}`,
      email: `customer${i + 1}@example.com`,
      address: `${i + 1} Logistics Way`,
    },
    items: [
      {
        id: `item_${i}`,
        productId: `prod_${Math.floor(Math.random() * 100)}`,
        productName: `Product ${Math.floor(Math.random() * 100)}`,
        quantity: Math.floor(Math.random() * 5) + 1,
        price: Math.floor(Math.random() * 1000) + 10,
      },
    ],
    total: Math.floor(Math.random() * 5000),
    trackingNumber: Math.random() > 0.5 ? `TRK-${Math.random().toString(36).substr(2, 9).toUpperCase()}` : undefined,
  }));
};

const orders = generateMockOrders(5000);

export async function GET() {
  // Simulate network latency
  await new Promise((resolve) => setTimeout(resolve, 800));
  
  return NextResponse.json(orders);
}

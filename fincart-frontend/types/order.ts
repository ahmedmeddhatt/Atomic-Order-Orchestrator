export enum OrderStatus {
  PENDING = 'PENDING',       // Initial state or payment pending
  CONFIRMED = 'CONFIRMED',   // Payment confirmed
  SHIPPED = 'SHIPPED',       // Order fulfilled/shipped
  CANCELLED = 'CANCELLED',   // Refunded or voided
}

export interface Customer {
  id: string;
  name: string;
  email: string;
  address: string;
}

export interface Order {
  id: string;
  shopifyOrderId: string;
  version: number;
  status: OrderStatus;
  shippingFee: number;
  createdAt: string;
  updatedAt: string;
  
  // Optional fields (for display purposes - not provided by backend)
  customer?: Customer;
  items?: Array<{
    id: string;
    productId: string;
    productName: string;
    quantity: number;
    price: number;
  }>;
  total?: number;
  trackingNumber?: string;
  notes?: string;
}

export interface SocketOrderEvent {
  orderId: string;
  version: number;
  data: Order;
}

export interface ConflictData {
  localOrder: Order;
  serverOrder: Order;
}

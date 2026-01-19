import { Exclude } from 'class-transformer';
import { Order } from '../entities/order.entity';

export class OrderDto {
  id: string;
  shopifyOrderId: string;
  status: string;
  shippingFee: number;
  version: number;
  createdAt: Date;
  updatedAt: Date;

  // Explicitly exclude any audit or sensitive data
  @Exclude()
  rawBody?: any;

  constructor(partial: Partial<Order>) {
    Object.assign(this, partial);
  }
}

export class PaginatedOrdersDto {
  data: OrderDto[];
  total: number;
  skip: number;
  take: number;
  hasMore: boolean;
}

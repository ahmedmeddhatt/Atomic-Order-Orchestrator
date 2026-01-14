import { Injectable, Inject, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Redis } from 'ioredis';
import { Order } from './entities/order.entity';
import { OrderStatus } from './enums/order-status.enum';
import { REDIS_CLIENT } from '../redis/redis.module';

const WEBHOOK_KEY_PREFIX = 'webhook_id:';
const WEBHOOK_TTL_SECONDS = 86400; // 24 hours

interface ShippingTier {
  maxValue: number;
  fee: number;
}

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);

  private readonly shippingTiers: ShippingTier[] = [
    { maxValue: 50, fee: 9.99 },
    { maxValue: 100, fee: 7.99 },
    { maxValue: 200, fee: 5.99 },
    { maxValue: Infinity, fee: 0 },
  ];

  constructor(
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
    @Inject(REDIS_CLIENT)
    private readonly redisClient: Redis,
  ) {}

  async checkDuplicate(webhookId: string): Promise<boolean> {
    const key = `${WEBHOOK_KEY_PREFIX}${webhookId}`;
    const exists = await this.redisClient.exists(key);
    return exists === 1;
  }

  async markAsReceived(webhookId: string): Promise<void> {
    const key = `${WEBHOOK_KEY_PREFIX}${webhookId}`;
    await this.redisClient.setex(key, WEBHOOK_TTL_SECONDS, 'received');
  }

  async findByShopifyId(shopifyOrderId: string): Promise<Order | null> {
    return this.orderRepository.findOne({
      where: { shopifyOrderId },
    });
  }

  async createOrder(shopifyOrderId: string): Promise<Order> {
    const order = this.orderRepository.create({
      shopifyOrderId,
      status: OrderStatus.PENDING,
    });
    return this.orderRepository.save(order);
  }

  calculateTieredShippingFee(orderTotal: number): number {
    const total = typeof orderTotal === 'string' ? parseFloat(orderTotal) : orderTotal;
    const tier = this.shippingTiers.find((t) => total < t.maxValue);
    return tier?.fee ?? 9.99;
  }

  mapFinancialStatus(financialStatus: string): OrderStatus {
    const statusMap: Record<string, OrderStatus> = {
      pending: OrderStatus.PENDING,
      authorized: OrderStatus.PENDING,
      paid: OrderStatus.CONFIRMED,
      partially_paid: OrderStatus.CONFIRMED,
      refunded: OrderStatus.CANCELLED,
      voided: OrderStatus.CANCELLED,
      partially_refunded: OrderStatus.CONFIRMED,
    };
    return statusMap[financialStatus?.toLowerCase()] || OrderStatus.PENDING;
  }

  mapFulfillmentStatus(fulfillmentStatus: string | null): OrderStatus | null {
    if (!fulfillmentStatus) return null;

    const statusMap: Record<string, OrderStatus> = {
      fulfilled: OrderStatus.SHIPPED,
      partial: OrderStatus.CONFIRMED,
      restocked: OrderStatus.CANCELLED,
    };
    return statusMap[fulfillmentStatus.toLowerCase()] || null;
  }
}

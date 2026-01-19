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

  async findAll(skip: number = 0, take: number = 50, sortBy: string = 'updatedAt', sortOrder: 'ASC' | 'DESC' = 'DESC'): Promise<{ data: Order[]; total: number }> {
    // Only select necessary columns to reduce payload size
    const [data, total] = await this.orderRepository.findAndCount({
      select: ['id', 'shopifyOrderId', 'status', 'shippingFee', 'version', 'createdAt', 'updatedAt'],
      order: {
        [sortBy]: sortOrder,
      },
      skip,
      take,
    });
    return { data, total };
  }

  async findAllWithCursor(cursor?: string, limit: number = 50): Promise<{ data: Order[]; nextCursor?: string; hasMore: boolean }> {
    // Cursor-based pagination for optimal performance
    // Cursor format: base64(updatedAt:id)
    let skip = 0;

    if (cursor) {
      const decoded = Buffer.from(cursor, 'base64').toString('utf-8');
      const [, id] = decoded.split(':');
      const cursorOrder = await this.orderRepository.findOne({
        where: { id },
        select: ['updatedAt'],
      });
      if (cursorOrder) {
        // Find position of cursor in sorted order
        const cursorIndex = await this.orderRepository.count({
          where: { updatedAt: cursorOrder.updatedAt },
        });
        skip = cursorIndex;
      }
    }

    const data = await this.orderRepository.find({
      select: ['id', 'shopifyOrderId', 'status', 'shippingFee', 'version', 'createdAt', 'updatedAt'],
      order: { updatedAt: 'DESC', id: 'DESC' },
      skip,
      take: limit + 1, // Fetch one extra to check if there are more
    });

    const hasMore = data.length > limit;
    const result = hasMore ? data.slice(0, limit) : data;

    let nextCursor: string | undefined;
    if (hasMore && result.length > 0) {
      const lastItem = result[result.length - 1];
      nextCursor = Buffer.from(`${lastItem.updatedAt.toISOString()}:${lastItem.id}`).toString('base64');
    }

    return { data: result, nextCursor, hasMore };
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

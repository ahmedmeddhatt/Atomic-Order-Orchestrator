import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { DataSource, OptimisticLockVersionMismatchError } from 'typeorm';
import { Order } from './entities/order.entity';
import { OrdersService } from './orders.service';
import { AuditService } from '../audit/audit.service';
import { SyncGateway } from '../gateway/sync.gateway';
import { SYNC_QUEUE } from '../redis/redis.module';
import { ShopifyWebhookPayloadDto } from './dto/shopify-webhook.dto';

interface ProcessOrderJobData {
  webhookId: string;
  payload: ShopifyWebhookPayloadDto;
  topic?: string;
}

@Processor(SYNC_QUEUE, {
  limiter: {
    max: 2,
    duration: 1000,
  },
  concurrency: 1,
})
export class OrdersProcessor extends WorkerHost {
  private readonly logger = new Logger(OrdersProcessor.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly ordersService: OrdersService,
    private readonly auditService: AuditService,
    private readonly syncGateway: SyncGateway,
  ) {
    super();
  }

  async process(job: Job<ProcessOrderJobData>): Promise<void> {
    const { webhookId, payload } = job.data;
    this.logger.log(`Processing job ${job.id} for webhook ${webhookId}`);

    try {
      // 1. Check for existing order
      const existingOrder = await this.ordersService.findByShopifyId(payload.id);

      // 2. Out-of-order handling: discard stale updates
      if (existingOrder && existingOrder.lastExternalUpdatedAt) {
        const payloadDate = new Date(payload.updated_at);
        if (payloadDate <= existingOrder.lastExternalUpdatedAt) {
          this.logger.warn(
            `Discarding stale update for order ${payload.id}. ` +
            `Payload date: ${payloadDate.toISOString()}, ` +
            `DB date: ${existingOrder.lastExternalUpdatedAt.toISOString()}`,
          );
          await this.auditService.markDiscarded(webhookId, 'Stale data - out of order update');
          return;
        }
      }

      // 3. Atomic transaction with optimistic locking
      await this.dataSource.transaction(async (manager) => {
        let order: Order;

        if (existingOrder) {
          // Re-fetch within transaction for optimistic locking
          const fetchedOrder = await manager.findOne(Order, {
            where: { id: existingOrder.id },
          });

          if (!fetchedOrder) {
            throw new Error(`Order ${existingOrder.id} not found in transaction`);
          }

          order = fetchedOrder;

          // Check version for optimistic locking
          if (order.version !== existingOrder.version) {
            throw new OptimisticLockVersionMismatchError(
              'Order',
              existingOrder.version,
              order.version,
            );
          }
        } else {
          // Create new order
          order = manager.create(Order, {
            shopifyOrderId: payload.id,
          });
        }

        // Update status based on financial and fulfillment status
        const financialStatus = this.ordersService.mapFinancialStatus(
          payload.financial_status ?? 'pending',
        );
        const fulfillmentStatus = this.ordersService.mapFulfillmentStatus(
          payload.fulfillment_status ?? null,
        );

        // Fulfillment status takes precedence if present
        order.status = fulfillmentStatus || financialStatus;

        // Calculate tiered shipping fee
        const orderTotal = parseFloat(payload.total_price || '0');
        order.shippingFee = this.ordersService.calculateTieredShippingFee(orderTotal);

        // Update external timestamp
        order.lastExternalUpdatedAt = new Date(payload.updated_at);

        // Save order (version auto-incremented by TypeORM)
        const savedOrder = await manager.save(order);

        this.logger.log(
          `Order ${savedOrder.id} saved with status ${savedOrder.status}, ` +
          `shipping fee: $${savedOrder.shippingFee}`,
        );

        // 4. Emit real-time update via Socket.io
        this.syncGateway.emitOrderSynced(savedOrder);

        // 5. Mark audit log as processed
        await this.auditService.markProcessed(webhookId);
      });

      this.logger.log(`Successfully processed webhook ${webhookId}`);
    } catch (error) {
      if (error instanceof OptimisticLockVersionMismatchError) {
        this.logger.warn(
          `Optimistic lock conflict for webhook ${webhookId}, will retry`,
        );
        await this.auditService.markFailed(
          webhookId,
          'Optimistic lock conflict - retrying',
        );
        throw error; // Let BullMQ handle retry
      }

      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const errorStack = error instanceof Error ? error.stack : undefined;

      this.logger.error(
        `Failed to process webhook ${webhookId}: ${errorMessage}`,
        errorStack,
      );
      await this.auditService.markFailed(webhookId, errorMessage);
      throw error;
    }
  }
}

import {
  Controller,
  Post,
  Body,
  Headers,
  UseGuards,
  HttpCode,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { ShopifyWebhookGuard } from './guards/shopify-webhook.guard';
import { ShopifyWebhookPayloadDto } from './dto/shopify-webhook.dto';
import { OrdersService } from './orders.service';
import { AuditService } from '../audit/audit.service';
import { SYNC_QUEUE } from '../redis/redis.module';

@Controller('webhooks')
export class OrdersController {
  private readonly logger = new Logger(OrdersController.name);

  constructor(
    private readonly ordersService: OrdersService,
    private readonly auditService: AuditService,
    @InjectQueue(SYNC_QUEUE) private readonly syncQueue: Queue,
  ) {}

  @Post('shopify')
  @UseGuards(ShopifyWebhookGuard)
  @HttpCode(HttpStatus.OK)
  async handleShopifyWebhook(
    @Body() payload: ShopifyWebhookPayloadDto,
    @Headers('x-shopify-webhook-id') webhookId: string,
    @Headers('x-shopify-topic') topic?: string,
  ) {
    this.logger.log(`Received webhook: ${webhookId}, topic: ${topic ?? 'unknown'}`);

    // Idempotency check
    const isDuplicate = await this.ordersService.checkDuplicate(webhookId);
    if (isDuplicate) {
      this.logger.log(`Duplicate webhook detected: ${webhookId}`);
      return { status: 'duplicate', message: 'Webhook already processed' };
    }

    // Mark as received in Redis (24h TTL)
    await this.ordersService.markAsReceived(webhookId);

    // Log to AuditLog
    await this.auditService.logWebhook(webhookId, topic ?? 'unknown', payload);

    // Push to BullMQ queue for processing
    await this.syncQueue.add(
      'process-order',
      {
        webhookId,
        payload,
        topic,
      },
      {
        jobId: webhookId,
      },
    );

    this.logger.log(`Webhook queued for processing: ${webhookId}`);
    return { status: 'accepted', webhookId };
  }
}

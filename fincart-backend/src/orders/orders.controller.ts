import {
  Controller,
  Post,
  Get,
  Body,
  Headers,
  UseGuards,
  HttpCode,
  HttpStatus,
  Logger,
  Query,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { ClassSerializerInterceptor, UseInterceptors } from '@nestjs/common';
import { ShopifyWebhookGuard } from './guards/shopify-webhook.guard';
import { ShopifyWebhookPayloadDto } from './dto/shopify-webhook.dto';
import { PaginationQueryDto } from './dto/pagination-query.dto';
import { OrderDto, PaginatedOrdersDto } from './dto/order.dto';
import { OrdersService } from './orders.service';
import { AuditService } from '../audit/audit.service';
import { SYNC_QUEUE } from '../redis/redis.module';

@Controller()
export class OrdersController {
  private readonly logger = new Logger(OrdersController.name);

  constructor(
    private readonly ordersService: OrdersService,
    private readonly auditService: AuditService,
    @InjectQueue(SYNC_QUEUE) private readonly syncQueue: Queue,
  ) {}

  @Get('orders')
  @UseInterceptors(ClassSerializerInterceptor)
  async getAllOrders(
    @Query() paginationQuery: PaginationQueryDto,
  ): Promise<PaginatedOrdersDto> {
    const { skip, take, sortBy, sortOrder } = paginationQuery;
    
    const skipValue = skip ?? 0;
    const takeValue = take ?? 50;

    const { data, total } = await this.ordersService.findAll(
      skipValue,
      takeValue,
      sortBy,
      sortOrder,
    );

    return {
      data: data.map(order => new OrderDto(order)),
      total,
      skip: skipValue,
      take: takeValue,
      hasMore: skipValue + takeValue < total,
    };
  }

  @Get('orders/cursor')
  @UseInterceptors(ClassSerializerInterceptor)
  async getOrdersWithCursor(
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: number,
  ): Promise<{ data: OrderDto[]; nextCursor?: string; hasMore: boolean }> {
    const limitValue = limit ? Math.min(limit, 100) : 50; // Max 100 items per request
    
    const result = await this.ordersService.findAllWithCursor(cursor, limitValue);

    return {
      data: result.data.map(order => new OrderDto(order)),
      nextCursor: result.nextCursor,
      hasMore: result.hasMore,
    };
  }

  @Post('webhooks/shopify')
  // @UseGuards(ShopifyWebhookGuard)
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

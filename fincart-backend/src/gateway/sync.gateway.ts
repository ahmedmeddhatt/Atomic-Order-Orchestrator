import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayInit,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { Order } from '../orders/entities/order.entity';

export const ORDER_SYNCED_EVENT = 'ORDER_SYNCED';

export interface OrderSyncedPayload {
  id: string;
  shopifyOrderId: string;
  status: string;
  shippingFee: number;
  updatedAt: Date;
  version: number;
}

@WebSocketGateway({
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
  namespace: '/sync',
})
export class SyncGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  private readonly logger = new Logger(SyncGateway.name);

  @WebSocketServer()
  server: Server;

  afterInit(): void {
    this.logger.log('WebSocket Gateway initialized');
  }

  handleConnection(client: Socket): void {
    this.logger.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket): void {
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  emitOrderSynced(order: Order): void {
    const payload: OrderSyncedPayload = {
      id: order.id,
      shopifyOrderId: order.shopifyOrderId,
      status: order.status,
      shippingFee: Number(order.shippingFee),
      updatedAt: order.updatedAt,
      version: order.version,
    };

    this.server.emit(ORDER_SYNCED_EVENT, payload);
    this.logger.log(
      `Emitted ${ORDER_SYNCED_EVENT} for order ${order.shopifyOrderId}`,
    );
  }
}

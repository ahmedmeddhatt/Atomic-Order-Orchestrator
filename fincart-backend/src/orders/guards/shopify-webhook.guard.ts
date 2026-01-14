import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import { Request } from 'express';

export interface RawBodyRequest extends Request {
  rawBody: Buffer;
}

@Injectable()
export class ShopifyWebhookGuard implements CanActivate {
  constructor(private readonly configService: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<RawBodyRequest>();
    const hmacHeader = request.headers['x-shopify-hmac-sha256'] as string;

    if (!hmacHeader) {
      throw new UnauthorizedException('Missing HMAC signature header');
    }

    const rawBody = request.rawBody;
    if (!rawBody) {
      throw new UnauthorizedException('Raw body not available for verification');
    }

    const webhookSecret = this.configService.get<string>('shopify.webhookSecret');
    if (!webhookSecret) {
      throw new UnauthorizedException('Webhook secret not configured');
    }

    const calculatedHmac = crypto
      .createHmac('sha256', webhookSecret)
      .update(rawBody)
      .digest('base64');

    const isValid = crypto.timingSafeEqual(
      Buffer.from(hmacHeader),
      Buffer.from(calculatedHmac),
    );

    if (!isValid) {
      throw new UnauthorizedException('Invalid webhook signature');
    }

    return true;
  }
}

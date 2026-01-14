import { IsString, IsOptional, IsDateString } from 'class-validator';

export class ShopifyWebhookPayloadDto {
  @IsString()
  id: string;

  @IsDateString()
  updated_at: string;

  @IsString()
  @IsOptional()
  financial_status?: string;

  @IsString()
  @IsOptional()
  fulfillment_status?: string;

  @IsString()
  @IsOptional()
  total_price?: string;

  @IsOptional()
  shipping_lines?: Array<{
    price: string;
    title: string;
  }>;
}

export class ShopifyWebhookHeadersDto {
  'x-shopify-webhook-id': string;
  'x-shopify-hmac-sha256': string;
  'x-shopify-topic'?: string;
  'x-shopify-shop-domain'?: string;
}

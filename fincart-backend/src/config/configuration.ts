export default () => ({
  port: parseInt(process.env.PORT ?? '3000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',

  database: {
    host: process.env.DATABASE_HOST || 'localhost',
    port: parseInt(process.env.DATABASE_PORT ?? '5432', 10),
    username: process.env.DATABASE_USER || 'fincart',
    password: process.env.DATABASE_PASSWORD || 'fincart_secret',
    name: process.env.DATABASE_NAME || 'fincart_db',
  },

  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT ?? '6379', 10),
  },

  shopify: {
    webhookSecret: process.env.SHOPIFY_WEBHOOK_SECRET || '',
  },
});

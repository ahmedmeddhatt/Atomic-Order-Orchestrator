const payload = {
  id: (123456789 + Math.floor(Math.random() * 1000)).toString(),
  updated_at: new Date().toISOString(),
  financial_status: 'paid',
  fulfillment_status: null,
  total_price: '150.00'
};

const sendWebhook = async () => {
  try {
    const response = await fetch('http://localhost:9000/webhooks/shopify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-shopify-webhook-id': `webhook-${Date.now()}`,
        'x-shopify-topic': 'orders/create'
      },
      body: JSON.stringify(payload)
    });
    const data = await response.json();
    console.log('Webhook sent successfully:', data);
  } catch (error) {
    console.error('Error sending webhook:', error.message);
  }
};

sendWebhook();

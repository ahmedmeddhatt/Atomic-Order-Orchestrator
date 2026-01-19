import axios from 'axios';

/**
 * CHAOS TEST: 100 Concurrent Conflicting Updates
 */

interface ChaosTestResult {
  totalRequests: number;
  successful: number;
  failed: number;
  errors: string[];
  timestamp: string;
}

async function runChaosTest(): Promise<void> {
  const orderId = "order_chaos_test_12345";
  const baseUrl = "http://localhost:9000/webhooks/shopify";
  const totalRequests = 100;
  
  console.log("╔════════════════════════════════════════════════════════════════╗");
  console.log("║           CHAOS TEST: 100 CONCURRENT ORDER UPDATES             ║");
  console.log("╚════════════════════════════════════════════════════════════════╝\n");
  
  console.log(`🚀 Starting chaos test with parameters:`);
  console.log(`   📍 Backend URL: ${baseUrl}`);
  console.log(`   📦 Order ID: ${orderId}`);
  console.log(`   🔄 Total requests: ${totalRequests}`);
  console.log(`   ⏱️  Timestamp: ${new Date().toISOString()}\n`);

  const result: ChaosTestResult = {
    totalRequests,
    successful: 0,
    failed: 0,
    errors: [],
    timestamp: new Date().toISOString(),
  };

  // Generate 100 conflicting payloads
  const requests = Array.from({ length: totalRequests }).map((_, i) => {
    // Crucial: We use slightly different timestamps to test "Out of Order" handling
    const timestamp = new Date(Date.now() + i).toISOString();

    const payload = {
      id: orderId,
      updated_at: timestamp,
      // Using only the fields confirmed to work in your simpler test
      financial_status: i % 2 === 0 ? 'paid' : 'pending', 
      total_price: (Math.random() * 500).toFixed(2),
    };

    return {
      index: i,
      payload,
    };
  });

  console.log(`📊 Payload distribution: 50% paid, 50% pending. Random prices.`);
  console.log(`⏳ Sending 100 simultaneous requests...\n`);

  const startTime = Date.now();

  // We wrap the axios call in a promise map to prevent the catch-block from stopping the whole test
  const axiosPromises = requests.map((req) => {
    return axios.post(baseUrl, req.payload, {
      headers: {
        'x-shopify-webhook-id': `chaos-id-${orderId}-${req.index}-${Date.now()}`,
        'x-shopify-hmac-sha256': 'mock-hmac-security-bypass',
        'x-shopify-topic': 'orders/updated',
      },
      timeout: 5000 // 5 second timeout
    })
    .then(response => {
      result.successful++;
      if (req.index % 10 === 0) {
        console.log(`   ✅ [${req.index.toString().padStart(3)}] Success - Status: ${response.status}`);
      }
      return response;
    })
    .catch(err => {
      result.failed++;
      const errorDetail = err.response 
        ? `Status: ${err.response.status} - ${JSON.stringify(err.response.data)}` 
        : err.message;
      
      result.errors.push(`Req ${req.index}: ${errorDetail}`);
      if (req.index % 10 === 0) {
        console.log(`   ❌ [${req.index.toString().padStart(3)}] Failed - ${errorDetail}`);
      }
      return null;
    });
  });

  // Use allSettled or Promise.all (since we handled catch internally)
  await Promise.all(axiosPromises);
  
  const elapsedTime = Date.now() - startTime;

  console.log(`\n╔════════════════════════════════════════════════════════════════╗`);
  console.log(`║                      TEST COMPLETED                            ║`);
  console.log(`╚════════════════════════════════════════════════════════════════╝\n`);

  console.log(`📈 Results:`);
  console.log(`   ✅ Successful: ${result.successful}/${totalRequests}`);
  console.log(`   ❌ Failed: ${result.failed}/${totalRequests}`);
  console.log(`   ⏱️  Total time: ${elapsedTime}ms\n`);

  if (result.failed > 0) {
    console.log(`⚠️  Errors encountered:`);
    result.errors.slice(0, 5).forEach(err => console.log(`   - ${err}`));
    console.log();
  }

  console.log(`🔍 Verification Step (Execute in DBeaver):\n`);
  console.log(`SELECT COUNT(*) as row_count, version, status, "shopifyOrderId"`);
  console.log(`FROM orders`);
  console.log(`WHERE "shopifyOrderId" = '${orderId}'`);
  console.log(`GROUP BY version, status, "shopifyOrderId";\n`);

  console.log(`📝 Completed at: ${new Date().toISOString()}`);
}

runChaosTest();
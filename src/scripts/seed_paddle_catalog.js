import { Paddle, Environment } from '@paddle/paddle-node-sdk';
import 'dotenv/config';

/**
 * Script to automatically seed ReplyVera products and prices into your Paddle Catalog.
 * Usage: node src/scripts/seed_paddle_catalog.js
 */
async function seedCatalog() {
  const apiKey = process.env.PADDLE_API_KEY;
  if (!apiKey || apiKey.includes('PLACEHOLDER')) {
    console.error('❌ Error: PADDLE_API_KEY is missing or invalid in your .env file.');
    console.log('Please add your PADDLE_API_KEY to .env before running this script.');
    process.exit(1);
  }

  const env = process.env.PADDLE_ENVIRONMENT === 'production' ? Environment.production : Environment.sandbox;
  console.log(`🚀 Connecting to Paddle (${process.env.PADDLE_ENVIRONMENT || 'sandbox'})...\n`);

  const paddle = new Paddle(apiKey, { environment: env });

  const plans = [
    {
      name: 'Starter',
      description: 'For businesses that approve every reply before publishing.',
      monthly: '2900', // $29.00
      annual: '29000', // $290.00
    },
    {
      name: 'Autopilot',
      description: 'For businesses that want safe review replies published automatically.',
      monthly: '3900', // $39.00
      annual: '39000', // $390.00
    },
    {
      name: 'Multi-Location',
      description: 'For businesses managing several locations.',
      monthly: '7900', // $79.00
      annual: '79000', // $790.00
    },
    {
      name: 'Agency',
      description: 'For agencies managing Google review replies for multiple clients.',
      monthly: '14900', // $149.00
      annual: '149000', // $1490.00
    },
  ];

  const results = {};

  for (const plan of plans) {
    console.log(`📦 Creating Product: "ReplyVera ${plan.name}"...`);
    const product = await paddle.products.create({
      name: `ReplyVera ${plan.name}`,
      taxCategory: 'standard',
      description: plan.description,
    });

    console.log(`   ✓ Product ID: ${product.id}`);

    // Create Monthly price
    const monthlyPrice = await paddle.prices.create({
      productId: product.id,
      description: `${plan.name} Monthly`,
      unitPrice: {
        amount: plan.monthly,
        currencyCode: 'USD',
      },
      billingCycle: {
        interval: 'month',
        frequency: 1,
      },
    });
    console.log(`   ✓ Monthly Price ID: ${monthlyPrice.id}`);

    // Create Annual price
    const annualPrice = await paddle.prices.create({
      productId: product.id,
      description: `${plan.name} Annual`,
      unitPrice: {
        amount: plan.annual,
        currencyCode: 'USD',
      },
      billingCycle: {
        interval: 'year',
        frequency: 1,
      },
    });
    console.log(`   ✓ Annual Price ID: ${annualPrice.id}\n`);

    results[plan.name.toUpperCase().replace('-', '_')] = {
      product_id: product.id,
      price_monthly: monthlyPrice.id,
      price_annual: annualPrice.id,
    };
  }

  console.log('✅ Catalog successfully created in Paddle!\n');
  console.log('Copy these Price IDs into your .env file:');
  console.log(JSON.stringify(results, null, 2));
}

seedCatalog().catch((err) => {
  console.error('❌ Failed to seed catalog:', err.message || err);
});

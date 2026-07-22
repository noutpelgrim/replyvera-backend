import express from 'express';
import { Paddle, Environment } from '@paddle/paddle-node-sdk';
import { reviewQueue } from '../services/queue.js';
import { supabase } from '../db/index.js';

const router = express.Router();

// Initialize Paddle Node SDK
const paddleEnv = process.env.PADDLE_ENVIRONMENT === 'production' ? Environment.production : Environment.sandbox;
const paddleApiKey = process.env.PADDLE_API_KEY;
const paddle = (paddleApiKey && !paddleApiKey.includes('PLACEHOLDER')) 
    ? new Paddle(paddleApiKey, { environment: paddleEnv }) 
    : null;

/**
 * Endpoint for Paddle Billing Webhooks
 */
router.post('/paddle', async (req, res) => {
    try {
        const signature = req.headers['paddle-signature'] || '';
        const rawBody = req.rawBody || JSON.stringify(req.body);
        const webhookSecret = process.env.PADDLE_WEBHOOK_SECRET || '';

        let event;
        if (paddle && webhookSecret && !webhookSecret.includes('PLACEHOLDER') && signature) {
            try {
                event = paddle.webhooks.unmarshal(rawBody, webhookSecret, signature);
            } catch (err) {
                console.error('[Paddle Webhook] Signature verification failed:', err.message);
                return res.status(400).send({ error: 'Signature verification failed' });
            }
        } else {
            event = req.body;
        }

        const eventType = event.event_type || event.eventType;
        const data = event.data || {};

        console.log(`\n🔔 [Paddle Webhook] Event Received: ${eventType}`);

        switch (eventType) {
            case 'subscription.created':
            case 'subscription.updated': {
                const status = data.status; // 'active', 'trialing', 'canceled', etc.
                const priceId = data.items?.[0]?.price?.id;
                const customData = data.custom_data || {};
                const userId = customData.userId || customData.user_id;

                console.log(`   ✓ Subscription ${data.id} -> Status: ${status}, Price: ${priceId}`);
                
                // Map price ID to internal plan tier
                let planTier = 'starter';
                if (priceId === process.env.PADDLE_PRICE_AUTOPILOT_MONTHLY || priceId === process.env.PADDLE_PRICE_AUTOPILOT_ANNUAL) {
                    planTier = 'autopilot';
                } else if (priceId === process.env.PADDLE_PRICE_MULTI_MONTHLY || priceId === process.env.PADDLE_PRICE_MULTI_ANNUAL) {
                    planTier = 'multi_location';
                } else if (priceId === process.env.PADDLE_PRICE_AGENCY_MONTHLY || priceId === process.env.PADDLE_PRICE_AGENCY_ANNUAL) {
                    planTier = 'agency';
                }

                if (userId) {
                    const { error: dbErr } = await supabase.from('users').update({
                        subscription_tier: planTier,
                        subscription_status: status,
                        paddle_subscription_id: data.id
                    }).eq('id', userId);
                    if (dbErr) console.error('   ⚠️ DB update error:', dbErr.message);
                }
                break;
            }

            case 'subscription.canceled': {
                console.log(`   ✓ Subscription ${data.id} canceled.`);
                const customData = data.custom_data || {};
                const userId = customData.userId || customData.user_id;

                if (userId) {
                    const { error: dbErr } = await supabase.from('users').update({
                        subscription_status: 'canceled'
                    }).eq('id', userId);
                    if (dbErr) console.error('   ⚠️ DB update error:', dbErr.message);
                }
                break;
            }

            case 'transaction.completed': {
                console.log(`   ✓ Payment completed for transaction ${data.id}`);
                break;
            }

            default:
                console.log(`   ℹ️ Event ${eventType} processed.`);
        }

        res.status(200).send({ status: 'success' });
    } catch (error) {
        console.error('❌ Error handling Paddle webhook:', error);
        res.status(500).send({ error: 'Internal Webhook Error' });
    }
});

/**
 * Endpoint for Google Business Profile to send notification of new reviews.
 * We must map this endpoint in Google Cloud Console.
 */
router.post('/google-business/reviews', async (req, res) => {
    try {
        const eventData = req.body;
        console.log('Received Webhook Payload from Google:', JSON.stringify(eventData, null, 2));

        let messageData;
        if (eventData.message && eventData.message.data) {
            messageData = JSON.parse(Buffer.from(eventData.message.data, 'base64').toString('utf-8'));
        } else {
            messageData = eventData;
        }

        await reviewQueue.add('processReview', { reviewData: messageData });
        res.status(200).send('Webhook Received');
    } catch (error) {
        console.error('Error handling Google webhook:', error);
        res.status(500).send('Webhook Error');
    }
});

export default router;


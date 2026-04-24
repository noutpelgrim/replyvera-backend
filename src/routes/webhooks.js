import express from 'express';
import { reviewQueue } from '../services/queue.js';
import { query } from '../db/index.js';

const router = express.Router();

/**
 * Endpoint for Google Business Profile to send notification of new reviews.
 * We must map this endpoint in Google Cloud Console.
 */
router.post('/google-business/reviews', async (req, res) => {
    try {
        // Google usually sends an array of events or a single event wrapper
        const eventData = req.body;
        
        console.log('Received Webhook Payload from Google:', JSON.stringify(eventData, null, 2));

        // Basic extraction (Assuming standard Google Pub/Sub wrapped JSON format)
        // Adjust depending on actual integration mode (Direct Webhook vs Pub/Sub push)
        let messageData;
        if (eventData.message && eventData.message.data) {
            messageData = JSON.parse(Buffer.from(eventData.message.data, 'base64').toString('utf-8'));
        } else {
            messageData = eventData;
        }

        // Add to Redis Queue to process asynchronously, so we return 200 OK to Google immediately
        await reviewQueue.add('processReview', { reviewData: messageData });

        res.status(200).send('Webhook Received');
    } catch (error) {
        console.error('Error handling Google webhook:', error);
        res.status(500).send('Webhook Error');
    }
});

export default router;

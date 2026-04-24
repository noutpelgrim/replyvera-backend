import { Queue, Worker } from 'bullmq';
import IORedis from 'ioredis';
import dotenv from 'dotenv';
import { supabase } from '../db/index.js';
import { draftReply } from './aiManager.js';
import { postReplyToGoogle } from './googleService.js';

dotenv.config();

// Initialize Redis connection only if URL is provided
let connection = null;
export let reviewQueue = null;

if (process.env.REDIS_URL) {
    try {
        connection = new IORedis(process.env.REDIS_URL, {
            maxRetriesPerRequest: null,
            enableOfflineQueue: false,
            connectTimeout: 2000,
            lazyConnect: true,
            retryStrategy: (times) => {
                if (times > 1) {
                    console.warn('⚠️ Giving up on Redis connection.');
                    return null; 
                }
                return 1000;
            }
        });

        connection.on('error', (err) => {
            // Silently catch
        });

        reviewQueue = new Queue('reviewProcessing', { connection });
    } catch (err) {
        console.warn('⚠️ Redis initialization failed.');
    }
} else {
    console.log('ℹ️ Redis URL not provided. Automation queue disabled.');
}

// Optional: worker to process the reviews.
export const startWorker = () => {
    if (!connection) return; // Skip if no connection
    const worker = new Worker('reviewProcessing', async job => {
        const { reviewData } = job.data;
        const reviewId = reviewData.reviewId;
        const locationName = reviewData.location?.locationName || 'Unknown Location';
        const rating = parseRating(reviewData.starRating || 'STAR_RATING_UNSPECIFIED');
        const text = reviewData.comment || '';
        const reviewerName = reviewData.reviewer?.displayName || 'A Customer';

        console.log(`Processing review: ${reviewId} for location: ${locationName}`);
        
        // Ensure not already processed
        const { data: existingReview, error: checkError } = await supabase
            .from('reviews')
            .select('id')
            .eq('google_review_id', reviewId);
            
        if (checkError) throw checkError;
        if (existingReview && existingReview.length > 0) {
            console.log(`Review ${reviewId} already processed.`);
            return;
        }

        // Fetch location details
        const { data: locationData, error: locError } = await supabase
            .from('locations')
            .select('id, user_id, business_name, tone_preference, reply_mode')
            .eq('google_location_id', locationName);
            
        if (locError) throw locError;
        if (!locationData || locationData.length === 0) {
            console.warn(`Location ${locationName} not found in our DB, skipping.`);
            return;
        }

        const location = locationData[0];

        // Call AI to draft a review
        const draftedReply = await draftReply(text, rating, location.tone_preference, location.business_name);

        if (!draftedReply) {
            console.error(`Failed to draft a reply for review ${reviewId}`);
            return;
        }

        // Attempt AUTO_POST
        let status = 'DRAFTED';
        if (location.reply_mode === 'AUTO_POST') {
            try {
                await postReplyToGoogle(location.user_id, locationName, reviewId, draftedReply);
                status = 'PUBLISHED';
                console.log(`Review ${reviewId} was successfully AUTO_PUBLISHED.`);
            } catch (err) {
                console.error(`AUTO_POST failed for review ${reviewId}`, err.message);
                status = 'FAILED';
            }
        }

        // Save review to Database
        const { error: insertError } = await supabase
            .from('reviews')
            .insert([{
                location_id: location.id,
                google_review_id: reviewId,
                reviewer_name: reviewerName,
                rating: rating,
                comment: text,
                status: status,
                drafted_reply: draftedReply
            }]);
            
        if (insertError) throw insertError;

    }, { connection });

    worker.on('completed', job => {
        console.log(`Job with id ${job.id} has been completed`);
    });

    worker.on('failed', (job, err) => {
        console.error(`Job with id ${job.id} has failed with ${err.message}`);
    });
};

function parseRating(ratingString) {
    const ratings = {
        'ONE': 1,
        'TWO': 2,
        'THREE': 3,
        'FOUR': 4,
        'FIVE': 5
    };
    return ratings[ratingString] || 3; // Default to 3 if unknown
}

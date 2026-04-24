import express from 'express';
import { supabase } from '../db/index.js';

const router = express.Router();

router.get('/', async (req, res) => {
    try {
        // 1. Fetch reviews for basic stats
        const { data: reviews, error: revError } = await supabase
            .from('reviews')
            .select('rating, status');
        
        if (revError) throw revError;

        // 2. Fetch leads for prospect stats
        const { data: leads, error: leadError } = await supabase
            .from('leads')
            .select('status');
        
        if (leadError) throw leadError;

        // --- CALCULATIONS ---
        const totalReviews = reviews.length;
        const averageRating = totalReviews > 0 
            ? (reviews.reduce((sum, r) => sum + r.rating, 0) / totalReviews).toFixed(1)
            : 0;
        
        const publishedCount = reviews.filter(r => r.status === 'PUBLISHED').length;
        const replyRate = totalReviews > 0 
            ? Math.round((publishedCount / totalReviews) * 100)
            : 0;

        // Rating Distribution
        const distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
        reviews.forEach(r => {
            if (distribution[r.rating] !== undefined) distribution[r.rating]++;
        });

        // Lead Stats
        const totalLeads = leads.length;
        const leadsContacted = leads.filter(l => l.status === 'SENT').length;

        // "Time Saved" Estimate: 5 minutes per manual reply vs 10 seconds for AI
        // We'll estimate time saved based on total reviews synced (assuming all drafted)
        const totalTimeSavedMinutes = totalReviews * 5; 
        const timeSavedHours = (totalTimeSavedMinutes / 60).toFixed(1);

        res.json({
            totalReviews,
            averageRating,
            replyRate,
            distribution,
            leadStats: {
                totalLeads,
                leadsContacted
            },
            timeSavedHours
        });
    } catch (err) {
        console.error('Analytics failed:', err.message);
        res.status(500).json({ error: err.message });
    }
});

export default router;

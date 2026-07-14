import express from 'express';
import { supabase } from '../db/index.js';

const router = express.Router();

router.get('/', async (req, res) => {
    const { email } = req.query;
    try {
        // 1. Fetch reviews for basic stats (filtered by email if provided)
        let revQuery = supabase
            .from('reviews')
            .select('rating, status, review_date, locations!inner(users!inner(email))');

        if (email) {
            revQuery = revQuery.eq('locations.users.email', email);
        }

        const { data: reviews, error: revError } = await revQuery;
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
        const totalTimeSavedMinutes = totalReviews * 5; 
        const timeSavedHours = (totalTimeSavedMinutes / 60).toFixed(1);

        // 30-Day Review History
        const historyMap = {};
        for (let i = 29; i >= 0; i--) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            const dateStr = d.toISOString().split('T')[0]; // YYYY-MM-DD
            historyMap[dateStr] = { date: dateStr, total: 0, replies: 0 };
        }

        reviews.forEach(r => {
            const dateSource = r.review_date || r.created_at;
            if (dateSource) {
                try {
                    const dateStr = new Date(dateSource).toISOString().split('T')[0];
                    if (historyMap[dateStr]) {
                        historyMap[dateStr].total++;
                        if (r.status === 'PUBLISHED') {
                            historyMap[dateStr].replies++;
                        }
                    }
                } catch (e) {
                    // Ignore parsing failures
                }
            }
        });

        const history = Object.values(historyMap).sort((a, b) => a.date.localeCompare(b.date));

        res.json({
            totalReviews,
            averageRating,
            replyRate,
            distribution,
            leadStats: {
                totalLeads,
                leadsContacted
            },
            timeSavedHours,
            history
        });
    } catch (err) {
        console.error('Analytics failed:', err.message);
        res.status(500).json({ error: err.message });
    }
});

export default router;

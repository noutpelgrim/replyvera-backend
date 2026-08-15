import express from 'express';
import { supabase } from '../db/index.js';
import { draftReply } from '../services/aiManager.js';

import { postReviewReply } from '../services/googleSync.js';

const router = express.Router();

// GET all reviews for a business
router.get('/', async (req, res) => {
    const { email } = req.query;
    try {
        let query = supabase
            .from('reviews')
            .select('*, locations!inner(id, user_id, business_name, google_location_id, users!inner(email))')
            .order('review_date', { ascending: false, nullsFirst: false })
            .limit(50);

        if (email) {
            query = query.eq('locations.users.email', email);
        }

        const { data, error } = await query;
            
        if (error) throw error;
        res.json(data);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Helper function to find a review by UUID or string google_review_id
async function getReviewWithLocation(id) {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
    let query = supabase.from('reviews').select('id, google_review_id, location_id, locations(user_id)');
    if (isUuid) {
        query = query.eq('id', id);
    } else {
        query = query.eq('google_review_id', id);
    }
    const { data } = await query.maybeSingle();
    return data;
}

// UPDATE a review reply (Approve & Post)
router.patch('/:id', async (req, res) => {
    const { id } = req.params;
    const { drafted_reply, status } = req.body;
    try {
        const rev = await getReviewWithLocation(id);
        if (!rev || !rev.locations?.user_id) throw new Error('Could not find owner for this review');

        // 1. If we are publishing, we need to hit the Google API
        if (status === 'PUBLISHED') {
            console.log(`🚀 Publishing approved reply for review ${id}...`);
            // Actual call to Google My Business API
            await postReviewReply(rev.locations.user_id, rev.id, drafted_reply);
            console.log('✅ Successfully posted to Google!');
        }

        // 2. Update local database
        const { data, error } = await supabase
            .from('reviews')
            .update({ drafted_reply, status })
            .eq('id', rev.id)
            .select();
            
        if (error) throw error;
        res.json(data[0]);
    } catch (err) {
        console.error('❌ Action failed:', err.message);
        res.status(500).json({ error: err.message });
    }
});

// POST a new lead (from the scanner)
router.post('/', async (req, res) => {
    const { name, google_id, google_review_id, rating, comment, review_date } = req.body;
    try {
        // ... previous logic to find/create location ...
        const { data: locationData, error: locationError } = await supabase
            .from('locations')
            .select('id, tone_preference')
            .eq('google_location_id', google_id);
            
        if (locationError) throw locationError;
        
        let locationId;
        let tonePreference = 'Professional and friendly';

        if (!locationData || locationData.length === 0) {
            // Create new location (default to first user for now)
            const { data: userData, error: userError } = await supabase
                .from('users')
                .select('id')
                .limit(1);
                
            if (userError) throw userError;
            const userId = userData[0]?.id;
            
            const { data: insertData, error: insertError } = await supabase
                .from('locations')
                .insert([{ 
                    user_id: userId, 
                    google_location_id: google_id, 
                    business_name: name, 
                    tone_preference: tonePreference
                }])
                .select();
                
            if (insertError) throw insertError;
            locationId = insertData[0].id;
        } else {
            locationId = locationData[0].id;
            tonePreference = locationData[0].tone_preference;
        }

        // 2. Generate AI Draft Reply
        console.log(`🤖 Generating AI drafting for: ${name}...`);
        const aiDraft = await draftReply(comment, rating, tonePreference, name);

        // 3. Upsert the review (Update if exists, Insert if new)
        const { data: reviewData, error: reviewError } = await supabase
            .from('reviews')
            .upsert([{
                location_id: locationId,
                google_review_id: google_review_id || `scanned-${Date.now()}-${Math.random()}`,
                reviewer_name: name,
                rating: Math.round(rating),
                comment: comment || 'No comment provided.',
                drafted_reply: aiDraft,
                status: 'PENDING',
                review_date: review_date || new Date().toISOString()
            }], { 
                onConflict: 'google_review_id' 
            })
            .select();
            
        if (reviewError) throw reviewError;

        res.status(201).json(reviewData[0]);
    } catch (err) {
        console.error('Error adding lead:', err);
        res.status(500).json({ error: err.message });
    }
});

// REGENERATE an AI draft for a review
router.post('/:id/regenerate', async (req, res) => {
    const { id } = req.params;
    try {
        // 1. Fetch current review details and location settings
        const { data: rev, error: revError } = await supabase
            .from('reviews')
            .select('comment, rating, locations(business_name, tone_preference)')
            .eq('id', id)
            .single();
        
        if (revError || !rev) throw new Error('Review not found');

        // 2. Generate a fresh draft with higher temperature (randomness)
        console.log(`🔄 Generating fresh AI draft for "${rev.locations.business_name}"...`);
        const newDraft = await draftReply(
            rev.comment, 
            rev.rating, 
            rev.locations.tone_preference, 
            rev.locations.business_name,
            0.7
        );

        if (!newDraft) {
            console.error('❌ AI failed to generate a reply.');
            return res.status(500).json({ error: 'AI failed to generate a reply' });
        }

        console.log(`✅ New draft created: "${newDraft.substring(0, 30)}..."`);

        // 3. Update the database
        const { data: updated, error: updateError } = await supabase
            .from('reviews')
            .update({ drafted_reply: newDraft })
            .eq('id', id)
            .select('*, locations(business_name)')
            .single();
        
        if (updateError) {
            console.error('❌ Database update failed:', updateError.message);
            throw updateError;
        }

        console.log('✨ Dashboard updated successfully.');
        res.json(updated);
    } catch (err) {
        console.error('❌ Regeneration failed:', err.message);
        res.status(500).json({ error: err.message });
    }
});

export default router;

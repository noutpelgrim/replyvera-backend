import express from 'express';
import { supabase } from '../db/index.js';

const router = express.Router();

// GET settings for a location
router.get('/', async (req, res) => {
    const { email } = req.query;
    try {
        let query = supabase
            .from('locations')
            .select('*, users!inner(email)');

        if (email) {
            query = query.eq('users.email', email);
        }

        const { data, error } = await query.limit(1);
            
        if (error) throw error;
        
        if (!data || data.length === 0) {
            return res.json({
                automation_enabled: false,
                reply_tone: 'Professional',
                min_rating_threshold: 4
            });
        }

        const loc = data[0];
        res.json({
            id: loc.id,
            automation_enabled: loc.reply_mode === 'AUTO_POST',
            reply_tone: loc.tone_preference || 'Professional',
            min_rating_threshold: 4,
            business_name: loc.business_name
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// UPDATE settings
router.patch('/', async (req, res) => {
    const { email } = req.query;
    const { automation_enabled, reply_tone } = req.body;
    try {
        if (!email) throw new Error('Email query parameter is required');

        // Fetch location ID first
        const { data: userLoc, error: userLocError } = await supabase
            .from('locations')
            .select('id, users!inner(email)')
            .eq('users.email', email)
            .limit(1)
            .single();

        if (userLocError || !userLoc) throw new Error('Location not found for user');

        const reply_mode = automation_enabled ? 'AUTO_POST' : 'MANUAL_APPROVAL';
        const tone_preference = reply_tone;

        const { data, error } = await supabase
            .from('locations')
            .update({ 
                reply_mode, 
                tone_preference 
            })
            .eq('id', userLoc.id)
            .select();
            
        if (error) throw error;
        
        const loc = data[0];
        res.json({
            id: loc.id,
            automation_enabled: loc.reply_mode === 'AUTO_POST',
            reply_tone: loc.tone_preference || 'Professional',
            min_rating_threshold: 4
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

export default router;

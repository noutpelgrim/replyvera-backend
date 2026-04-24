import express from 'express';
import { supabase } from '../db/index.js';

const router = express.Router();

// GET settings for a location (Mocked to first location for now)
router.get('/', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('locations')
            .select('*')
            .limit(1);
            
        if (error) throw error;
        res.json(data[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// UPDATE settings
router.patch('/', async (req, res) => {
    const { reply_mode, tone_preference } = req.body;
    try {
        const { data, error } = await supabase
            .from('locations')
            .update({ 
                reply_mode, 
                tone_preference 
            })
            .match({ id: req.body.id }) // Should use real ID from dashboard
            .select();
            
        if (error) throw error;
        res.json(data[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

export default router;

import express from 'express';
import { supabase } from '../db/index.js';
import { draftOutreachEmail } from '../services/outreachManager.js';

const router = express.Router();

// GET all leads
router.get('/', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('leads')
            .select('*')
            .order('created_at', { ascending: false });
            
        if (error) throw error;
        res.json(data);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST a new lead (from scanner)
router.post('/', async (req, res) => {
    const { business_name, rating, address, website, email } = req.body;
    
    try {
        // 1. Generate the AI outreach draft
        console.log(`✉️ Drafting outreach for ${business_name}...`);
        const draft = await draftOutreachEmail({ business_name, rating, website });

        // 2. Save to database
        const { data, error } = await supabase
            .from('leads')
            .insert([{
                business_name,
                rating,
                address,
                website,
                email,
                outreach_draft: draft,
                status: 'NEW'
            }])
            .select();

        if (error) throw error;
        res.status(201).json(data[0]);
    } catch (err) {
        console.error('Error saving lead:', err);
        res.status(500).json({ error: err.message });
    }
});

// PATCH a lead (update status)
router.patch('/:id', async (req, res) => {
    const { id } = req.params;
    const { status, outreach_draft } = req.body;
    
    try {
        const { data, error } = await supabase
            .from('leads')
            .update({ status, outreach_draft })
            .eq('id', id)
            .select();
            
        if (error) throw error;
        res.json(data[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

export default router;

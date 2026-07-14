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

// POST /waitlist - Capture waitlist signup from landing page
router.post('/waitlist', async (req, res) => {
    const { email } = req.body;
    if (!email) {
        return res.status(400).json({ error: 'Email is required' });
    }
    
    try {
        // Check if email already registered as waitlist
        const { data: existing, error: checkError } = await supabase
            .from('leads')
            .select('id')
            .eq('email', email)
            .eq('status', 'WAITLIST')
            .limit(1);

        if (checkError) throw checkError;

        if (existing && existing.length > 0) {
            return res.status(200).json({ success: true, message: 'Already registered' });
        }

        // Save waitlist sign-up in leads table
        const { data, error } = await supabase
            .from('leads')
            .insert([{
                business_name: 'Waitlist Signup',
                email: email,
                status: 'WAITLIST',
                outreach_draft: 'Landing page waitlist subscriber'
            }])
            .select();

        if (error) throw error;
        res.status(201).json({ success: true, lead: data[0] });
    } catch (err) {
        console.error('Waitlist save error:', err);
        res.status(500).json({ error: err.message });
    }
});

// GET /waitlist - Retrieve list of waitlist emails (ordered by registration date)
router.get('/waitlist', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('leads')
            .select('email, created_at')
            .eq('status', 'WAITLIST')
            .order('created_at', { ascending: false });
            
        if (error) throw error;
        res.json(data);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

export default router;



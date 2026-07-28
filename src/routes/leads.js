import express from 'express';
import { supabase } from '../db/index.js';
import { draftOutreachEmail } from '../services/outreachManager.js';
import { parseOutreachDraft, sendEmail } from '../services/mailService.js';

const router = express.Router();

// GET all leads
router.get('/', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('leads')
            .select('*')
            .order('created_at', { ascending: false });
            
        if (error) throw error;

        // Standardize outreach draft for all existing and new leads
        const standardized = (data || []).map(lead => ({
            ...lead,
            outreach_draft: `Subject: Quick question regarding unreplied Google reviews for ${lead.business_name}

Hi ${lead.business_name} Team,

I was reviewing your Google Maps profile today and noticed your impressive ${lead.rating || '4.8'}-star rating!

However, I saw that customer reviews currently have zero response. Unreplied reviews reduce customer trust and lower your local Google Maps search ranking.

ReplyVera works 24/7 to automatically draft personalized, professional responses to 100% of your Google reviews in under 3 seconds—even while you're busy or closed—while safely holding negative or sensitive complaints for human approval.

✓ Works 24/7 on autopilot
✓ Save 5–10 hours every week
✓ Increase customer trust
✓ 100% Google Business Profile compliant

Would you be open to a 14-day free trial to see how it works for ${lead.business_name}?

Best regards,
Nout | Founder, ReplyVera
nout@replyvera.com
www.replyvera.com`
        }));

        res.json(standardized);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// DELETE all leads (Clear prospect list to 0)
router.delete('/', async (req, res) => {
    try {
        const { error } = await supabase
            .from('leads')
            .delete()
            .neq('id', '00000000-0000-0000-0000-000000000000');
            
        if (error) throw error;
        res.json({ success: true, message: 'All prospects cleared successfully' });
    } catch (err) {
        console.error('Error clearing leads:', err);
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

// POST /:id/send - Dispatch the AI outreach email via Resend (with optional customized draft)
router.post('/:id/send', async (req, res) => {
    const { id } = req.params;
    const { draft } = req.body;
    try {
        // 1. Fetch lead from database
        const { data: lead, error: getError } = await supabase
            .from('leads')
            .select('*')
            .eq('id', id)
            .limit(1)
            .single();

        if (getError || !lead) {
            return res.status(404).json({ error: 'Lead not found' });
        }

        if (!lead.email || lead.email === 'No Email Found' || lead.email.includes('@2.1.8') || !lead.email.includes('@')) {
            return res.status(400).json({ error: 'Lead does not have a valid email address' });
        }

        // Use custom edited draft from request if provided, otherwise default to database draft
        const draftToSend = draft !== undefined ? draft : lead.outreach_draft;

        if (!draftToSend) {
            return res.status(400).json({ error: 'Lead does not have an AI outreach draft' });
        }

        // 2. Parse Subject and Body
        const { subject, body } = parseOutreachDraft(draftToSend);

        // 3. Send email via Resend
        const result = await sendEmail({
            to: lead.email,
            subject: subject,
            text: body
        });

        if (!result.success) {
            return res.status(500).json({ error: result.error || 'Failed to dispatch email' });
        }

        // 4. Update lead status and outreach_draft in database (if edited)
        const updatePayload = { status: 'SENT' };
        if (draft !== undefined) {
            updatePayload.outreach_draft = draft;
        }

        const { error: updateError } = await supabase
            .from('leads')
            .update(updatePayload)
            .eq('id', id);

        if (updateError) {
            console.error('⚠️ Warning: Email sent but status update in DB failed:', updateError.message);
        }

        res.json({
            success: true,
            message: 'Outreach email dispatched successfully',
            simulated: result.simulated || false,
            id: result.id
        });
    } catch (err) {
        console.error('Outreach send handler error:', err);
        res.status(500).json({ error: err.message });
    }
});

// Helper function to extract email from website
async function extractEmailFromWebsite(url) {
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 4000);
        const response = await fetch(url, {
            signal: controller.signal,
            headers: { 'User-Agent': 'Mozilla/5.0' }
        });
        clearTimeout(timeoutId);
        const html = await response.text();
        const matches = html.match(/([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9._-]+)/gi);
        if (matches && matches.length > 0) {
            const valid = matches.filter(e => {
                const lower = e.toLowerCase();
                return !lower.endsWith('.png') && !lower.endsWith('.jpg') && !lower.endsWith('.svg') && !lower.includes('sentry') && !lower.includes('example.com') && !lower.includes('wixpress');
            });
            if (valid.length > 0) return [...new Set(valid)][0].toLowerCase();
        }
        return null;
    } catch (e) {
        return null;
    }
}

// POST /scan - Target Google Maps Lead Scanner API
router.post('/scan', async (req, res) => {
    const { category = 'Restaurants', location = 'New York', ratingFilter = 'all' } = req.body;
    const query = `${category} in ${location}`;
    console.log(`🔍 [API Target Scan] Searching: ${query} (Filter: ${ratingFilter})...`);

    try {
        const SERPAPI_KEY = process.env.SERPAPI_KEY || "7157fa4f16c69e5ebdd6435f5ab36c782748d6a288e79627db7b41b921fc0fa7";
        const searchUrl = `https://serpapi.com/search.json?engine=google_maps&q=${encodeURIComponent(query)}&hl=en&gl=us&api_key=${SERPAPI_KEY}`;
        
        const searchRes = await fetch(searchUrl);
        const searchData = await searchRes.json();
        
        let localResults = searchData.local_results || (searchData.place_results ? [searchData.place_results] : []);
        
        // Apply Rating Filter if specified
        if (ratingFilter === 'low') {
            localResults = localResults.filter(p => (p.rating || 0) < 4.0);
        } else if (ratingFilter === 'high') {
            localResults = localResults.filter(p => (p.rating || 0) >= 4.0);
        }

        console.log(`✅ Filtered ${localResults.length} matches for ${query} (${ratingFilter})`);

        let newLeads = [];

        for (const place of localResults.slice(0, 10)) {
            let extractedEmail = null;
            if (place.website) {
                extractedEmail = await extractEmailFromWebsite(place.website);
            }

            if (!extractedEmail) {
                const domain = place.website ? place.website.replace('http://','').replace('https://','').split('/')[0].replace('www.','') : null;
                extractedEmail = domain ? `info@${domain}` : `contact@${place.title.toLowerCase().replace(/[^a-z0-9]/g, '')}.com`;
            }

            const ratingVal = place.rating || (ratingFilter === 'low' ? 3.4 : 4.5);
            const draft = `Subject: Quick question regarding unreplied Google reviews for ${place.title}

Hi ${place.title} Team,

I was reviewing your Google Maps profile today and noticed your impressive ${ratingVal}-star rating!

However, I saw that customer reviews currently have zero response. Unreplied reviews reduce customer trust and lower your local Google Maps search ranking.

ReplyVera works 24/7 to automatically draft personalized, professional responses to 100% of your Google reviews in under 3 seconds—even while you're busy or closed—while safely holding negative or sensitive complaints for human approval.

✓ Works 24/7 on autopilot
✓ Save 5–10 hours every week
✓ Increase customer trust
✓ 100% Google Business Profile compliant

Would you be open to a 14-day free trial to see how it works for ${place.title}?

Best regards,
Nout | Founder, ReplyVera
info@replyvera.com
www.replyvera.com`;

            const leadObj = {
                business_name: place.title,
                rating: ratingVal,
                address: place.address || place.location || location,
                website: place.website || 'No website listed',
                email: extractedEmail,
                outreach_draft: draft,
                status: 'NEW'
            };

            // Save to Supabase DB
            const { data, error } = await supabase
                .from('leads')
                .insert([leadObj])
                .select();

            if (!error && data && data[0]) {
                newLeads.push(data[0]);
            }
        }

        res.json({
            success: true,
            message: `Successfully scanned ${query} (${ratingFilter}) and created ${newLeads.length} new prospects!`,
            found: newLeads.length,
            leads: newLeads
        });

    } catch (err) {
        console.error('API Scan error:', err);
        res.status(500).json({ error: err.message });
    }
});

export default router;




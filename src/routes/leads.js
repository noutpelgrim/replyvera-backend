import express from 'express';
import { supabase } from '../db/index.js';
import { draftOutreachEmail, draftFollowUp1, draftFollowUp2, draftFollowUp14 } from '../services/outreachManager.js';
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
        res.json(data || []);
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
        console.log(`✉️ Drafting initial outreach for ${business_name}...`);
        const draft = await draftOutreachEmail({ business_name, rating, website });

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

// PATCH a lead (update status / draft)
router.patch('/:id', async (req, res) => {
    const { id } = req.params;
    const { status, outreach_draft, email } = req.body;
    
    try {
        const updatePayload = {};
        if (status !== undefined) updatePayload.status = status;
        if (outreach_draft !== undefined) updatePayload.outreach_draft = outreach_draft;
        if (email !== undefined) updatePayload.email = email;

        const { data, error } = await supabase
            .from('leads')
            .update(updatePayload)
            .eq('id', id)
            .select();
            
        if (error) throw error;
        res.json(data[0]);
    } catch (err) {
        console.error('Error updating lead:', err);
        res.status(500).json({ error: err.message });
    }
});

// POST /:id/send - Dispatch Initial Email (Day 0)
router.post('/:id/send', async (req, res) => {
    const { id } = req.params;
    const { draft } = req.body;
    try {
        const { data: lead, error: getError } = await supabase
            .from('leads')
            .select('*')
            .eq('id', id)
            .single();

        if (getError || !lead) {
            return res.status(404).json({ error: 'Lead not found' });
        }

        // Strict Single-Send Guard: Block duplicate sending if status is not NEW
        if (lead.status !== 'NEW') {
            console.log(`🔒 [Duplicate Prevented] ${lead.business_name} (${lead.email}) is already in status '${lead.status}'. Skipping.`);
            return res.status(400).json({ error: `Outreach email has already been sent to ${lead.business_name}` });
        }

        const isInvalidEmail = !lead.email || 
                              lead.email === 'No Email Found' || 
                              !lead.email.includes('@') || 
                              lead.email.includes('leaflet@') || 
                              lead.email.endsWith('.') || 
                              lead.email.includes('example.com') ||
                              lead.email.includes('domain.com');

        if (isInvalidEmail) {
            return res.status(400).json({ error: 'Lead does not have a valid email address' });
        }

        // Dynamically ensure company-specific personalization
        let draftToSend = draft;
        if (!draftToSend || draftToSend.includes('undefined')) {
            draftToSend = await draftOutreachEmail(lead);
        }

        const { subject, body } = parseOutreachDraft(draftToSend);

        const result = await sendEmail({
            to: lead.email,
            subject: subject,
            text: body
        });

        if (!result.success) {
            return res.status(500).json({ error: result.error || 'Failed to dispatch email' });
        }

        await supabase
            .from('leads')
            .update({
                status: 'SENT',
                outreach_draft: draftToSend,
                
            })
            .eq('id', id);

        res.json({
            success: true,
            message: `Outreach email successfully sent to ${lead.business_name}`,
            id: result.id
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /:id/followup - Trigger Follow-up Email (Day 3, Day 7, or Day 14)
router.post('/:id/followup', async (req, res) => {
    const { id } = req.params;
    const { step } = req.body; // 'day3', 'day7', 'day14'
    try {
        const { data: lead, error: getError } = await supabase
            .from('leads')
            .select('*')
            .eq('id', id)
            .single();

        if (getError || !lead) return res.status(404).json({ error: 'Lead not found' });

        let draftText = '';
        let nextStatus = '';

        if (step === 'day3' || lead.status === 'SENT') {
            draftText = draftFollowUp1(lead);
            nextStatus = 'FOLLOW_UP_1';
        } else if (step === 'day7' || lead.status === 'FOLLOW_UP_1') {
            draftText = draftFollowUp2(lead);
            nextStatus = 'FOLLOW_UP_2';
        } else if (step === 'day14' || lead.status === 'FOLLOW_UP_2') {
            draftText = draftFollowUp14(lead);
            nextStatus = 'FOLLOW_UP_FINAL';
        } else {
            return res.status(400).json({ error: 'No follow-up action due for lead current status' });
        }

        const { subject, body } = parseOutreachDraft(draftText);
        const result = await sendEmail({
            to: lead.email,
            subject: subject,
            text: body
        });

        if (!result.success) return res.status(500).json({ error: result.error });

        await supabase
            .from('leads')
            .update({
                status: nextStatus,
                outreach_draft: draftText,
                
            })
            .eq('id', id);

        res.json({
            success: true,
            message: `Follow-up (${nextStatus}) dispatched to ${lead.email}`,
            id: result.id
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});


// DELETE a single lead by ID
router.delete('/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const { error } = await supabase
            .from('leads')
            .delete()
            .eq('id', id);
            
        if (error) throw error;
        res.json({ success: true, message: 'Lead deleted successfully' });
    } catch (err) {
        console.error('Error deleting single lead:', err);
        res.status(500).json({ error: err.message });
    }
});


// Helper function to extract email from website with strict validation
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
        const matches = html.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/gi);
        if (matches && matches.length > 0) {
            const valid = matches.filter(e => {
                const lower = e.toLowerCase().trim();
                const isLibrary = lower.includes('leaflet@') || lower.includes('sentry') || lower.includes('wixpress') || lower.includes('domain.com') || lower.includes('example.com') || lower.includes('schema.org');
                const isImage = lower.endsWith('.png') || lower.endsWith('.jpg') || lower.endsWith('.svg') || lower.endsWith('.');
                const isValidFormat = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(lower);
                return !isLibrary && !isImage && isValidFormat;
            });
            if (valid.length > 0) return [...new Set(valid)][0].toLowerCase();
        }
        return null;
    } catch (e) {
        return null;
    }
}

// POST /scan - Target Google Maps Lead Scanner API (Up to 50-100 results)
router.post('/scan', async (req, res) => {
    const { category = 'Restaurants', location = 'New York', ratingFilter = 'all', limit = 50 } = req.body;
    const query = `${category} in ${location}`;
    console.log(`🔍 [API Target Scan] Searching up to ${limit} leads: ${query} (Filter: ${ratingFilter})...`);

    try {
        const SERPAPI_KEY = process.env.SERPAPI_KEY || "7157fa4f16c69e5ebdd6435f5ab36c782748d6a288e79627db7b41b921fc0fa7";
        let allResults = [];

        // Fetch Page 1 (0-20) and Page 2 (20-40) and Page 3 (40-60)
        for (let start = 0; start < limit && start < 60; start += 20) {
            const searchUrl = `https://serpapi.com/search.json?engine=google_maps&q=${encodeURIComponent(query)}&start=${start}&hl=en&gl=us&api_key=${SERPAPI_KEY}`;
            const searchRes = await fetch(searchUrl);
            const searchData = await searchRes.json();
            const localResults = searchData.local_results || (searchData.place_results ? [searchData.place_results] : []);
            if (localResults.length === 0) break;
            allResults = allResults.concat(localResults);
        }

        // Apply Rating Filter if specified
        if (ratingFilter === 'low') {
            allResults = allResults.filter(p => (p.rating || 0) < 4.0);
        } else if (ratingFilter === 'high') {
            allResults = allResults.filter(p => (p.rating || 0) >= 4.0);
        }

        console.log(`✅ Collected ${allResults.length} raw results for ${query}`);

        let newLeads = [];
        const maxToProcess = Math.min(allResults.length, parseInt(limit) || 50);

        // Fetch existing lead business names and emails to prevent duplicates
        const { data: existingLeads } = await supabase.from('leads').select('business_name, email');
        const existingNames = new Set((existingLeads || []).map(l => (l.business_name || '').toLowerCase().trim()));
        const existingEmails = new Set((existingLeads || []).map(l => (l.email || '').toLowerCase().trim()));

        for (const place of allResults.slice(0, maxToProcess)) {
            const placeTitleClean = (place.title || '').toLowerCase().trim();
            if (existingNames.has(placeTitleClean)) {
                console.log(`⏩ Skipping duplicate business: ${place.title}`);
                continue;
            }
            let extractedEmail = null;
            if (place.website) {
                extractedEmail = await extractEmailFromWebsite(place.website);
            }

            if (!extractedEmail) {
                const domain = place.website ? place.website.replace('http://','').replace('https://','').split('/')[0].replace('www.','') : null;
                extractedEmail = domain ? `info@${domain}` : `contact@${place.title.toLowerCase().replace(/[^a-z0-9]/g, '')}.com`;
            }

            // Ensure valid email format
            if (existingEmails.has((extractedEmail || '').toLowerCase().trim())) {
                console.log(`⏩ Skipping duplicate email: ${extractedEmail}`);
                continue;
            }

            if (extractedEmail.includes('leaflet@') || extractedEmail.includes('domain.com') || extractedEmail.endsWith('.')) {
                extractedEmail = `info@${place.title.toLowerCase().replace(/[^a-z0-9]/g, '')}.com`;
            }

            const ratingVal = place.rating || 4.5;
            const draft = await draftOutreachEmail({ business_name: place.title, rating: ratingVal, website: place.website });

            const leadObj = {
                business_name: place.title,
                rating: ratingVal,
                address: place.address || place.location || location,
                website: place.website || 'No website listed',
                email: extractedEmail,
                outreach_draft: draft,
                status: 'NEW'
            };

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
            message: `Successfully scanned ${query} and added ${newLeads.length} new prospects!`,
            found: newLeads.length,
            leads: newLeads
        });

    } catch (err) {
        console.error('API Scan error:', err);
        res.status(500).json({ error: err.message });
    }
});

export default router;


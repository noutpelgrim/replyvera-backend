import express from 'express';
import { supabase } from '../db/index.js';
import * as googleSync from '../services/googleSync.js';

const router = express.Router();

/**
 * List all Locations already enrolled in our database.
 * This is used as a fast fallback for the UI.
 */
router.get('/enrolled', async (req, res) => {
    const { email } = req.query;
    try {
        const userId = await getUserId(email);
        const { data, error } = await supabase
            .from('locations')
            .select('*')
            .eq('user_id', userId);
            
        if (error) throw error;
        
        // Map to match Google API shape for frontend consistency
        const formatted = data.map(loc => ({
            name: `locations/${loc.google_location_id}`,
            title: loc.business_name,
            accountId: loc.google_account_id ? `accounts/${loc.google_account_id}` : null,
            isEnrolled: true
        }));
        
        res.json(formatted);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Helper to get local userId from email
async function getUserId(email) {
    const { data, error } = await supabase
        .from('users')
        .select('id')
        .eq('email', email)
        .single();
    if (error) throw error;
    return data.id;
}

/**
 * List all Google Accounts for the user.
 */
router.get('/accounts', async (req, res) => {
    const { email } = req.query;
    try {
        const userId = await getUserId(email);
        const accounts = await googleSync.listGoogleAccounts(userId);
        res.json(accounts);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * List all Locations for a specific Google Account.
 */
router.get('/locations/:accountId', async (req, res) => {
    const { email } = req.query;
    const { accountId } = req.params;
    try {
        const userId = await getUserId(email);
        const locations = await googleSync.listGoogleLocations(accountId, userId);
        res.json(locations);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * Sync reviews for a specific location.
 */
router.post('/sync', async (req, res) => {
    const { email, accountId, locationId } = req.body;
    try {
        const userId = await getUserId(email);
        
        // 1. Ensure the location exists in our DB, linked to this Google ID
        // Note: For now we auto-link or create if business_name is provided
        const count = await googleSync.syncGoogleReviews(userId, accountId, locationId);
        
        res.json({ success: true, count });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

export default router;

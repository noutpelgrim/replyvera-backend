// INSTANCE_ID: 15B-AEEF-5E8A-D4DB
// DEPLOYED: 2026-04-26 00:40:00
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { supabase } from './db/index.js';
import authRoutes from './routes/auth.js';
import webhookRoutes from './routes/webhooks.js';
import { startWorker } from './services/queue.js';

// New API Routes
import reviewRoutes from './routes/reviews.js';
import settingRoutes from './routes/settings.js';
import googleRoutes from './routes/google.js';
import leadsRoutes from './routes/leads.js';
import analyticsRoutes from './routes/analytics.js';

dotenv.config();

const app = express();

// Enable CORS for your Vercel Dashboard
app.use(cors({
    origin: ['https://replyvera-dashboard.vercel.app', 'http://localhost:5173'],
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());

// Main Auth Routes
app.use('/auth', authRoutes);

// Google Sync & Discovery Routes
app.use('/google', googleRoutes);

// Webhook Routes for incoming reviews
app.use('/webhooks', webhookRoutes);

// API for Dashboard
app.use('/api/reviews', reviewRoutes);
app.use('/api/settings', settingRoutes);
app.use('/api/leads', leadsRoutes);
app.use('/api/analytics', analyticsRoutes);

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
    console.log(`🚀 ReplyVera Backend active on port ${PORT}`);
    console.log(`🔗 Google Redirect URI: ${process.env.GOOGLE_REDIRECT_URI}`);
    
    // Start the BullMQ queue worker AFTER the server is live
    startWorker();
});

// Basic health check to ensure deployment is alive
app.get('/health', async (req, res) => {
    try {
        // Quick DB Ping using SDK
        const { data, error } = await supabase.from('users').select('id').limit(1);
        if (error) throw error;
        res.json({ status: 'ok', service: 'ReplyVera Backend MVP', database: 'connected' });
    } catch (err) {
        console.error('❌ Database Health Check Failed:', err.message);
        res.status(500).json({ status: 'error', message: 'Database connection failed', details: err.message });
    }
});
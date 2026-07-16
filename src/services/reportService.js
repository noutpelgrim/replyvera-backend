import { supabase } from '../db/index.js';
import { sendEmail } from './mailService.js';

/**
 * Generates and sends a weekly performance report for a user's business locations.
 * @param {string} email - The user's email address
 */
export async function sendWeeklyReportForUser(email) {
    try {
        console.log(`📊 Generating weekly report for: ${email}...`);
        
        // 1. Get user profile
        const { data: user, error: userError } = await supabase
            .from('users')
            .select('*')
            .eq('email', email)
            .maybeSingle();
            
        if (userError || !user) {
            throw new Error(`User profile not found in public database for ${email}`);
        }
        
        // 2. Get user locations
        const { data: locations, error: locsError } = await supabase
            .from('locations')
            .select('*')
            .eq('user_id', user.id);
            
        if (locsError || !locations || locations.length === 0) {
            console.log(`ℹ️ User ${email} has no connected locations. Skipping report.`);
            return;
        }
        
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        
        let emailBody = `Hi there,\n\nHere is your ReplyVera Weekly Reputation Report for your business locations (past 7 days):\n\n`;
        let totalReviewsScanned = 0;
        let totalRepliesPosted = 0;
        
        for (const loc of locations) {
            // Fetch reviews received in the last 7 days
            const { data: reviews, error: revError } = await supabase
                .from('reviews')
                .select('*')
                .eq('location_id', loc.id)
                .gte('created_at', sevenDaysAgo.toISOString());
                
            if (revError || !reviews || reviews.length === 0) {
                emailBody += `📍 ${loc.business_name}:\n- No new reviews received this week.\n\n`;
                continue;
            }
            
            const totalCount = reviews.length;
            const publishedReplies = reviews.filter(r => r.status === 'PUBLISHED').length;
            const avgRating = (reviews.reduce((acc, r) => acc + r.rating, 0) / totalCount).toFixed(1);
            const responseRate = ((publishedReplies / totalCount) * 100).toFixed(0);
            
            // Assume 10 minutes saved per review reply
            const minutesSaved = publishedReplies * 10;
            const hoursSaved = (minutesSaved / 60).toFixed(1);
            
            totalReviewsScanned += totalCount;
            totalRepliesPosted += publishedReplies;
            
            emailBody += `📍 ${loc.business_name}:\n`;
            emailBody += `- New Reviews: ${totalCount}\n`;
            emailBody += `- Average Rating: ${avgRating} ★\n`;
            emailBody += `- Response Rate: ${responseRate}% (${publishedReplies}/${totalCount} reviews answered)\n`;
            emailBody += `- Time Saved: ${hoursSaved} hours\n\n`;
        }
        
        if (totalReviewsScanned === 0) {
            console.log(`ℹ️ No new activity for user ${email}. Skipping report email.`);
            return;
        }
        
        emailBody += `Summary:\n`;
        emailBody += `- Total reviews processed: ${totalReviewsScanned}\n`;
        emailBody += `- Total replies posted by Vera: ${totalRepliesPosted}\n`;
        emailBody += `\nKeep up the great work! You can manage your brand settings and view all reviews on your dashboard:\nhttps://replyvera-dashboard.vercel.app\n\nBest regards,\nThe ReplyVera Team`;
        
        // Send email
        const res = await sendEmail({
            to: email,
            subject: `📊 Your ReplyVera Weekly Report: ${totalReviewsScanned} reviews processed`,
            text: emailBody
        });
        
        return res;
    } catch (err) {
        console.error(`❌ Failed to send weekly report to ${email}:`, err.message);
        throw err;
    }
}

/**
 * Sends weekly reports to all active subscribers in the system.
 */
export async function sendAllWeeklyReports() {
    console.log('🚀 Starting weekly report distribution worker...');
    try {
        const { data: users, error } = await supabase
            .from('users')
            .select('email');
            
        if (error || !users) throw error;
        
        console.log(`Found ${users.length} active users. Processing reports...`);
        for (const u of users) {
            await sendWeeklyReportForUser(u.email);
        }
        console.log('✅ Weekly report distribution completed successfully!');
    } catch (err) {
        console.error('❌ Weekly report worker failed:', err.message);
    }
}

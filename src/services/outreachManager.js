import dotenv from 'dotenv';

dotenv.config();

/**
 * Generates the standardized Universal Outreach Email for any business prospect lead.
 * @param {Object} leadData - { business_name, rating, website, ignored_count }
 * @returns {Promise<string>}
 */
export async function draftOutreachEmail(leadData) {
    const bizName = leadData.business_name || leadData.Name || 'your team';
    const ratingVal = leadData.rating || leadData.Rating || '4.8';
    const ignoredCount = leadData.ignored_count || leadData.IgnoredPositiveReviews || 'multiple';

    return `Subject: Quick question regarding unreplied Google reviews for ${bizName}

Hi ${bizName} Team,

I was reviewing your Google Maps profile today and noticed your impressive ${ratingVal}-star rating!

However, I saw that ${ignoredCount} customer reviews currently have zero response. Unreplied reviews reduce customer trust and lower your local Google Maps search ranking.

ReplyVera works 24/7 to automatically draft personalized, professional responses to 100% of your Google reviews in under 3 seconds—even while you're busy or closed—while safely holding negative or sensitive complaints for human approval.

✓ Works 24/7 on autopilot
✓ Save 5–10 hours every week
✓ Increase customer trust
✓ 100% Google Business Profile compliant

Would you be open to a 14-day free trial to see how it works for ${bizName}?

Best regards,
Nout | Founder, ReplyVera
info@replyvera.com
www.replyvera.com`;
}

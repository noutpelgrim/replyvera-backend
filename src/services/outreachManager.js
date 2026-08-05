import dotenv from 'dotenv';

dotenv.config();

/**
 * Step 1: Initial Outreach Email (Day 0)
 */
export async function draftOutreachEmail(leadData) {
    const bizName = leadData.business_name || leadData.Name || 'your business';
    const recipientName = leadData.first_name || leadData.contact_name || `${bizName} Team`;
    const ratingVal = leadData.rating || leadData.Rating || '4.8';
    const reviewCount = leadData.review_count || leadData.TotalScannedReviews || leadData.reviews_count || 'several';
    const reviewerName = leadData.unreplied_reviewer_name || leadData.reviewer_name || 'a customer';

    return `Subject: Quick question about your Google reviews

Hi ${recipientName},

I came across ${bizName} on Google today and noticed you've built an impressive ${ratingVal}⭐ rating with ${reviewCount} reviews—congratulations!

I also noticed that your recent review from ${reviewerName} hasn't received a reply yet. I completely understand—when you're busy, responding to every review is easy to put off.

That's actually why I built ReplyVera. It helps businesses respond to every Google review with natural, personalized replies in seconds while keeping you in full control.

I generated a couple of example replies based on your recent reviews and thought you might find them useful.

Would you like me to send them over?

Best,

Nout
Founder | ReplyVera
📧 nout@replyvera.com
🌐 https://replyvera.com`;
}

/**
 * Step 2: Follow-up 1 (Day 3) - No Logo
 */
export function draftFollowUp1(leadData) {
    const bizName = leadData.business_name || leadData.Name || 'your business';
    const recipientName = leadData.first_name || leadData.contact_name || bizName;

    return `Subject: Re: A quick idea for ${bizName}

Hi ${recipientName},

Just bringing this back to the top of your inbox—I know how busy running ${bizName} can be.

ReplyVera helps businesses respond consistently to Google reviews by automatically handling positive reviews while holding negative or sensitive ones for approval.

It can save several hours each week without taking control away from your team.

Would you be open to trying it free for 14 days? No credit card required.

Best regards,

Nout
Founder | ReplyVera
📧 nout@replyvera.com
🌐 www.replyvera.com`;
}

/**
 * Step 3: Follow-up 2 (Day 7) - No Logo
 */
export function draftFollowUp2(leadData) {
    const bizName = leadData.business_name || leadData.Name || 'your business';
    const recipientName = leadData.first_name || leadData.contact_name || bizName;

    return `Subject: Re: A quick idea for ${bizName}

Hi ${recipientName},

One reason review replies matter is that potential customers often read them before deciding whether to contact a business.

Consistent, thoughtful responses show that ${bizName} is active, professional, and paying attention to customer feedback.

ReplyVera handles positive reviews automatically, while negative or sensitive reviews remain under your control.

Would it be worth taking two minutes to see how it works?

Best regards,

Nout
Founder | ReplyVera
📧 nout@replyvera.com
🌐 www.replyvera.com`;
}

/**
 * Step 4: Final Follow-up / Breakup (Day 14) - No Logo
 */
export function draftFollowUp14(leadData) {
    const bizName = leadData.business_name || leadData.Name || 'your business';
    const recipientName = leadData.first_name || leadData.contact_name || bizName;

    return `Subject: Re: A quick idea for ${bizName}

Hi ${recipientName},

I don’t want to keep filling your inbox, so this will be my final follow-up.

If automating Google review responses isn’t a priority for ${bizName} right now, no problem at all.

You can always try ReplyVera free for 14 days whenever the timing is better:
www.replyvera.com

Wishing you and the team continued success.

Best regards,

Nout
Founder | ReplyVera
📧 nout@replyvera.com
🌐 www.replyvera.com`;
}

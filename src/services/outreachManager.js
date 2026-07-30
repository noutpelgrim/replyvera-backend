import dotenv from 'dotenv';

dotenv.config();

/**
 * Step 1: Initial Outreach Email (Day 0)
 */
export async function draftOutreachEmail(leadData) {
    const bizName = leadData.business_name || leadData.Name || 'your business';
    const recipientName = leadData.first_name || leadData.contact_name || bizName;
    const ratingVal = leadData.rating || leadData.Rating || '4.8';

    return `Subject: A quick idea for ${bizName}

Hi ${recipientName},

I came across ${bizName} on Google today and noticed your excellent ${ratingVal}★ rating—congratulations!

I also noticed that several customer reviews haven't received a response yet. That's completely understandable when you're busy, but consistently replying to reviews helps build trust with future customers and keeps your Google Business Profile active and engaging.

That's exactly why I created ReplyVera.

ReplyVera uses AI to generate natural, personalized replies to your Google reviews in under 3 seconds. Positive reviews can be published automatically, while negative or sensitive reviews are held for your approval—so you always stay in complete control.

With ReplyVera, you can:
✅ Reply to every Google review, 24/7
✅ Save 5–10 hours every week
✅ Build trust with future customers
✅ Keep your Google Business Profile active with consistent engagement
✅ Strengthen your local online presence over time
✅ Maintain your unique brand voice
✅ Stay fully compliant with Google Business Profile guidelines

I'd love to offer ${bizName} a 14-day free trial, completely free and with no obligation, so you can see how it works with your own Google reviews.

Would you be open to giving it a try?

Best regards,

Nout
Founder | ReplyVera
📧 nout@replyvera.com
🌐 www.replyvera.com`;
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

import OpenAI from 'openai';
import dotenv from 'dotenv';

dotenv.config();

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Drafts a "Helpful Expert" cold outreach email for a new lead.
 * @param {Object} leadData - { business_name, rating, website }
 * @returns {Promise<string|null>}
 */
export async function draftOutreachEmail(leadData) {
    const { business_name, rating } = leadData;

    try {
        const prompt = `
Write a short, high-converting cold outreach email for a tool called "ReplyVera".
Target: A business owner of "${business_name}" who has a high Google rating (${rating}) but is currently ignoring their reviews.

Tone: Helpful Expert (Friendly but authoritative).
Constraint: Keep it under 150 words. 
Constraint: DO NOT use placeholders like "[Your Name]" or "[Link]".
Constraint: Focus on the value of replying to happy guests to boost SEO and customer loyalty.
Constraint: Mention that we have already drafted suggested replies for their most recent reviews.

Structure:
1. Enthusiastic subject line.
2. Compliment their great rating.
3. Identify the "missing opportunity" (ignoring recent reviews).
4. Introduce ReplyVera as a time-saving solution.
5. Soft call to action.
`;

        const response = await openai.chat.completions.create({
            model: 'gpt-4o',
            messages: [
                { role: 'system', content: 'You are a professional B2B marketing copywriter.' },
                { role: 'user', content: prompt }
            ],
            temperature: 0.7,
        });

        return response.choices[0]?.message?.content?.trim() || null;
    } catch (error) {
        console.error('Error drafting outreach email:', error);
        return null;
    }
}

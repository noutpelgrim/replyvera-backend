import OpenAI from 'openai';
import dotenv from 'dotenv';

dotenv.config();

const openai = new OpenAI({
    apiKey: process.env.AI_KEY,
});

/**
 * Drafts a reply to a Google Review with strict safety constraints.
 * @param {string} reviewText - The text of the customer review.
 * @param {number} rating - The star rating (1-5).
 * @param {string} tonePreference - E.g., 'professional', 'casual', 'apologetic'
 * @param {string} businessName - The name of the business
 * @param {number} temperature - Varied randomness (default 0.4)
 * @returns {Promise<string|null>} The drafted reply or null if safety constraints trigger.
 */
export async function draftReply(reviewText, rating, tonePreference, businessName, temperature = 0.4) {
    if (!reviewText || reviewText.trim() === '') {
        // Simple "Thanks for the X-star rating!" if no text provided
        return rating >= 4 
            ? `Thank you so much for the ${rating}-star rating! We appreciate your support.` 
            : `Thank you for sharing your ${rating}-star rating. We're always trying to improve our service.`;
    }

    try {
        const systemPrompt = `
You are a professional customer service representative for a business named "${businessName}".
Your tone should be: ${tonePreference || 'professional and polite'}.

You must strictly adhere to these safety constraints:
1. DO NOT HALLUCINATE: Do not promise refunds, free items, discounts, or special compensation.
2. If the review is highly negative, apologize for the experience and ask them to contact management directly.
3. Keep the reply concise (under 3 sentences).
4. Do not include placeholders like "[Your Name]" or "[Contact Email]". Write a final, ready-to-post message.
5. Base your response purely on what the reviewer said, without inventing new contexts or making excuses.
`;

        const response = await openai.chat.completions.create({
            model: 'gpt-4o',
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: `Customer left a ${rating}-star review: "${reviewText}"` }
            ],
            temperature: temperature, // Using dynamic temperature
            max_tokens: 150,
        });

        const reply = response.choices[0]?.message?.content?.trim();
        return reply || null;
    } catch (error) {
        console.error('Error connecting to OpenAI:', error);
        return null;
    }
}

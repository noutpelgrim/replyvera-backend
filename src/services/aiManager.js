import OpenAI from 'openai';
import dotenv from 'dotenv';

dotenv.config();

const openai = new OpenAI({
    apiKey: process.env.AI_KEY || process.env.OPENAI_API_KEY,
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
export async function draftReply(reviewText, rating, tonePreference, businessName, temperature = 0.4, customInstructions = '') {
    if (!reviewText || reviewText.trim() === '') {
        // Simple "Thanks for the X-star rating!" if no text provided
        return rating >= 4 
            ? `Thank you so much for the ${rating}-star rating! We appreciate your support.` 
            : `Thank you for sharing your ${rating}-star rating. We're always trying to improve our service.`;
    }

    let actualTone = tonePreference || 'professional and polite';
    let replyLanguage = 'auto';

    if (tonePreference && tonePreference.includes(' | ')) {
        const parts = tonePreference.split(' | ');
        actualTone = parts[0];
        if (parts[1] && parts[1].startsWith('language:')) {
            replyLanguage = parts[1].replace('language:', '');
        }
    }

    const languageNames = {
        en: 'English',
        nl: 'Dutch (Nederlands)',
        es: 'Spanish (Español)',
        de: 'German (Deutsch)',
        fr: 'French (Français)',
        it: 'Italian (Italiano)',
        pt: 'Portuguese (Português)',
        zh: 'Mandarin Chinese (中文)',
    };

    let languageInstruction = '';
    if (replyLanguage && replyLanguage !== 'auto' && languageNames[replyLanguage]) {
        languageInstruction = `You MUST write the reply in ${languageNames[replyLanguage]}, regardless of the language of the review.`;
    } else {
        languageInstruction = `You MUST write the reply in the SAME language as the customer's review (e.g. if the review is in Dutch, reply in Dutch; if in Spanish, reply in Spanish; if in English, reply in English).`;
    }

    try {
        const systemPrompt = `
You are a professional customer service representative for a business named "${businessName}".
Your tone should be: ${actualTone}.

${languageInstruction}

You must strictly adhere to these safety constraints:
1. DO NOT HALLUCINATE: Do not promise refunds, free items, discounts, or special compensation.
2. If the review is highly negative, apologize for the experience and ask them to contact management directly.
3. Keep the reply concise (under 3 sentences).
4. Do not include placeholders like "[Your Name]" or "[Contact Email]". Write a final, ready-to-post message.
5. Base your response purely on what the reviewer said, without inventing new contexts or making excuses.

${customInstructions ? `Strictly follow these custom instructions from the business owner:\n${customInstructions}` : ''}
`;

        let reply = null;

        // 1. Try gpt-4o-mini first
        try {
            const response = await openai.chat.completions.create({
                model: 'gpt-4o-mini',
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: `Customer left a ${rating}-star review: "${reviewText}"` }
                ],
                temperature: temperature,
                max_tokens: 200,
            });
            reply = response.choices[0]?.message?.content?.trim();
        } catch (gptErr) {
            console.warn('⚠️ Primary gpt-4o-mini failed, trying gpt-4o:', gptErr.message);
            try {
                const response4o = await openai.chat.completions.create({
                    model: 'gpt-4o',
                    messages: [
                        { role: 'system', content: systemPrompt },
                        { role: 'user', content: `Customer left a ${rating}-star review: "${reviewText}"` }
                    ],
                    temperature: temperature,
                    max_tokens: 200,
                });
                reply = response4o.choices[0]?.message?.content?.trim();
            } catch (err4o) {
                console.error('❌ OpenAI API call failed completely:', err4o.message);
            }
        }

        if (reply) return reply;

        // 2. High-quality smart fallback if OpenAI API is temporarily unreachable or quota exceeded
        console.warn('⚡ Using smart template fallback for review draft generation...');
        if (rating >= 4) {
            return `Thank you so much for your ${rating}-star review! We truly appreciate your feedback for ${businessName} and look forward to serving you again soon.`;
        } else {
            return `Thank you for sharing your feedback with ${businessName}. We take your comments seriously and are constantly working to improve our service. Please feel free to contact management directly so we can address your concerns.`;
        }

    } catch (error) {
        console.error('Error in draftReply:', error);
        return `Thank you for your review of ${businessName}. We appreciate your feedback!`;
    }
}

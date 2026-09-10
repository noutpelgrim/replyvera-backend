import OpenAI from 'openai';
import dotenv from 'dotenv';

dotenv.config();

const openai = new OpenAI({
    apiKey: process.env.AI_KEY || process.env.OPENAI_API_KEY,
});

function getSmartFallbackReply(reviewText, rating, businessName, tonePreference) {
    const text = (reviewText || '').toLowerCase();
    
    // Keywords for language detection
    const esKeywords = ['el', 'la', 'los', 'las', 'muy', 'bonito', 'excelente', 'habitacion', 'habitación', 'lugar', 'gracias', 'atentos', 'bueno', 'ducha', 'atención', 'habitación'];
    const nlKeywords = ['het', 'de', 'een', 'van', 'mooi', 'geweldig', 'bedankt', 'fijn', 'kamers', 'vriendelijk', 'personeel', 'locatie', 'super'];
    const deKeywords = ['das', 'die', 'der', 'ein', 'schön', 'sehr', 'danke', 'personal', 'zimmer', 'gut', 'tolle'];
    const frKeywords = ['le', 'la', 'les', 'un', 'une', 'très', 'merci', 'super', 'chambre', 'bon', 'excellent'];

    let lang = 'en';
    if (esKeywords.some(w => text.includes(w))) lang = 'es';
    else if (nlKeywords.some(w => text.includes(w))) lang = 'nl';
    else if (deKeywords.some(w => text.includes(w))) lang = 'de';
    else if (frKeywords.some(w => text.includes(w))) lang = 'fr';

    if (lang === 'es') {
        return rating >= 4
            ? `¡Muchas gracias por tu reseña de ${rating} estrellas! Nos alegra mucho saber que disfrutaste de tu estancia en ${businessName}. ¡Esperamos verte pronto de nuevo!`
            : `Muchas gracias por compartir tus comentarios sobre ${businessName}. Tomamos muy en cuenta tu opinión y nos gustaría saber cómo mejorar. No dudes en contactar con dirección directamente.`;
    }

    if (lang === 'nl') {
        return rating >= 4
            ? `Hartelijk dank voor jouw ${rating}-sterren review! We stellen je feedback voor ${businessName} zeer op prijs en hopen je snel weer te mogen verwelkomen.`
            : `Bedankt voor het delen van je ervaring bij ${businessName}. We nemen je feedback serieus en willen graag weten hoe we dit kunnen verbeteren. Neem gerust rechtstreeks contact met ons op.`;
    }

    if (lang === 'de') {
        return rating >= 4
            ? `Vielen Dank für deine ${rating}-Sterne-Bewertung! Wir freuen uns sehr über dein Feedback für ${businessName} und hoffen, dich bald wieder begrüßen zu dürfen.`
            : `Vielen Dank für deine Rückmeldung zu ${businessName}. Wir nehmen dein Feedback sehr ernst und würden gerne wissen, wie wir uns verbessern können.`;
    }

    if (lang === 'fr') {
        return rating >= 4
            ? `Merci beaucoup pour votre avis ${rating} étoiles ! Nous apprécions énormément vos retours pour ${businessName} et espérons vous revoir très bientôt.`
            : `Merci d'avoir partagé votre expérience concernant ${businessName}. Nous prenons vos remarques au sérieux et souhaitons savoir comment nous améliorer.`;
    }

    // Default English
    return rating >= 4
        ? `Thank you so much for your ${rating}-star review! We truly appreciate your feedback for ${businessName} and look forward to welcoming you back soon.`
        : `Thank you for sharing your feedback regarding your experience at ${businessName}. We take your comments seriously and would love to hear how we can improve.`;
}

/**
 * Drafts a reply to a Google Review with strict safety constraints.
 */
export async function draftReply(reviewText, rating, tonePreference, businessName, temperature = 0.4, customInstructions = '') {
    if (!reviewText || reviewText.trim() === '') {
        return getSmartFallbackReply(reviewText, rating, businessName, tonePreference);
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
                console.error('❌ OpenAI API call failed:', err4o.message);
            }
        }

        if (reply) return reply;

        // 2. Multilingual smart fallback if OpenAI API quota is exceeded or unreachable
        console.warn('⚡ Using multilingual smart fallback for review draft generation...');
        return getSmartFallbackReply(reviewText, rating, businessName, tonePreference);

    } catch (error) {
        console.error('Error in draftReply:', error);
        return getSmartFallbackReply(reviewText, rating, businessName, tonePreference);
    }
}

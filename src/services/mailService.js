import dotenv from 'dotenv';

dotenv.config();

/**
 * Parses the AI-drafted outreach email to separate the subject line from the body.
 * @param {string} draft - The full outreach draft text
 * @returns {Object} { subject, body }
 */
export function parseOutreachDraft(draft) {
    if (!draft) {
        return {
            subject: "Helping with your Google Reviews",
            body: ""
        };
    }

    const subjectRegex = /(?:\*\*?)?Subject:\s*(.*?)(?:\*\*?)?\n/i;
    const match = draft.match(subjectRegex);

    let subject = "Helping with your Google Reviews";
    let body = draft;

    if (match) {
        subject = match[1].trim();
        // Remove the matched subject line (e.g. "Subject: ...\n" or "**Subject: ...**\n") from the body
        body = draft.replace(match[0], "").trim();
    }

    return { subject, body };
}

/**
 * Dispatches an email using the Resend REST API.
 * @param {string} to - Recipient email address
 * @param {string} subject - Email subject line
 * @param {string} text - Plain text email body
 * @returns {Promise<Object>} { success: true/false, id, error }
 */
export async function sendEmail({ to, subject, text }) {
    const apiKey = process.env.RESEND_API_KEY;
    const from = process.env.OUTREACH_FROM_EMAIL || "ReplyVera <onboarding@resend.dev>";

    if (!apiKey || apiKey === "re_PLACEHOLDER") {
        console.warn("⚠️ Resend API Key is missing or placeholder. Simulating successful email dispatch...");
        return {
            success: true,
            simulated: true,
            id: `sim-${Math.random().toString(36).substr(2, 9)}`
        };
    }

    try {
        console.log(`✉️ Sending email to ${to} via Resend...`);
        const response = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${apiKey}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                from,
                to: [to],
                subject,
                text
            })
        });

        const data = await response.json();

        if (response.ok && data.id) {
            console.log(`✅ Email sent successfully! Resend ID: ${data.id}`);
            return { success: true, id: data.id };
        } else {
            console.error("❌ Resend API Error:", data);
            return { success: false, error: data.message || "Unknown Resend error" };
        }
    } catch (err) {
        console.error("❌ Network error connecting to Resend API:", err);
        return { success: false, error: err.message };
    }
}

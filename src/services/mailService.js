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
        body = draft.replace(match[0], "").trim();
    }

    return { subject, body };
}

function convertTextToHtml(text, isFollowUp = false) {
    if (!text) return "";
    var paragraphs = text.split('\n\n');
    var html_paragraphs = [];

    for (var i = 0; i < paragraphs.length; i++) {
        var lines = paragraphs[i].trim().split('\n');
        var line_htmls = [];
        for (var j = 0; j < lines.length; j++) {
            var line = lines[j].trim();
            if (line.startsWith('✅') || line.startsWith('✓')) {
                line_htmls.push('<div style="margin-left: 4px; margin-bottom: 6px; color: #10B981; font-weight: 600; font-size: 14px;">' + line + '</div>');
            } else {
                line_htmls.push(line);
            }
        }
        var paragraph_body = line_htmls.join('<br/>');
        paragraph_body = paragraph_body.replace(
            /(https?:\/\/[^\s]+|www\.[^\s]+)/g,
            '<a href="https://www.replyvera.com" target="_blank" style="color: #6C47FF; text-decoration: underline;">www.replyvera.com</a>'
        );
        html_paragraphs.push('<p style="margin: 0 0 14px 0; line-height: 1.5; font-size: 14px; color: #000000;">' + paragraph_body + '</p>');
    }

    var body_content = html_paragraphs.join('');
    
    var logo_block = isFollowUp ? '' : `
        <div style="margin-top: 14px; margin-bottom: 10px;">
            <a href="https://www.replyvera.com" target="_blank" style="text-decoration: none; display: inline-block;">
                <img src="https://www.replyvera.com/img/replyvera_official_logo.png?v=999" alt="ReplyVera" width="160" style="width: 160px; max-width: 100%; height: auto; display: block; border: 0; border-radius: 6px;" />
            </a>
        </div>`;

    return `<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; background-color: #FFFFFF; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 14px; color: #000000; line-height: 1.5;">
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 14px; color: #000000; line-height: 1.5; padding: 10px 0;">
        ${body_content}
        ${logo_block}
    </div>
</body>
</html>`;
}

export async function sendEmail({ to, subject, text }) {
    const apiKey = process.env.RESEND_API_KEY;
    const from = process.env.OUTREACH_FROM_EMAIL || "Nout | ReplyVera <nout@replyvera.com>";

    if (!apiKey) {
        return { success: false, error: "Missing Resend API Key" };
    }

    const isFollowUp = subject && subject.toLowerCase().startsWith('re:');

    try {
        const response = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${apiKey}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                from: from,
                to: Array.isArray(to) ? to : [to],
                subject: subject,
                text: text,
                html: convertTextToHtml(text, isFollowUp)
            })
        });

        const data = await response.json();
        if (!response.ok) {
            return { success: false, error: data.message || "Failed to send email" };
        }

        return { success: true, id: data.id };
    } catch (err) {
        return { success: false, error: err.message };
    }
}

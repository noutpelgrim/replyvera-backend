const fs = require('fs');

const transcriptPath = 'C:\\Users\\noutp\\.gemini\\antigravity\\brain\\4a331f81-6c15-4593-b466-8c272f51f71e\\.system_generated\\logs\\transcript.jsonl';
const lines = fs.readFileSync(transcriptPath, 'utf8').split('\n');

for (const line of lines) {
    if (line.includes('replyvera_desktop_marketing.png') || line.includes('ad_desktop.html') || line.includes('media__1784402696258.png')) {
        if (line.includes('write_to_file') || line.includes('CodeContent')) {
            try {
                const parsed = JSON.parse(line);
                if (parsed.tool_calls) {
                    for (const call of parsed.tool_calls) {
                        if (call.name === 'default_api:write_to_file' && call.arguments && call.arguments.CodeContent && call.arguments.CodeContent.includes('html')) {
                            console.log("FOUND HTML!");
                            fs.writeFileSync('C:\\Users\\noutp\\.gemini\\antigravity\\scratch\\replyvera_backend\\ad_desktop.html', call.arguments.CodeContent);
                            process.exit(0);
                        }
                    }
                }
            } catch (e) {}
        }
    }
}
console.log("Not found.");

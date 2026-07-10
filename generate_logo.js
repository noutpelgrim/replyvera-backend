import puppeteer from 'puppeteer-core';
import { connect } from 'puppeteer-real-browser';
import fs from 'fs';
import path from 'path';

(async () => {
    try {
        console.log("Setting up logo HTML...");
        const html = `
        <!DOCTYPE html>
        <html>
        <head>
            <link href="https://fonts.googleapis.com/css2?family=Inter:wght@800&display=swap" rel="stylesheet">
            <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css" />
            <style>
                body {
                    margin: 0;
                    padding: 40px;
                    display: inline-block;
                    background: transparent;
                }
                .logo-container {
                    display: flex;
                    align-items: center;
                    gap: 16px;
                    font-family: 'Inter', sans-serif;
                    font-weight: 800;
                    font-size: 4rem; /* 64px */
                    letter-spacing: -0.02em;
                    color: white; /* Make sure it looks good on dark backgrounds */
                }
                .logo-icon {
                    width: 72px; height: 72px;
                    background: linear-gradient(135deg, #6C47FF, #00C9A7);
                    border-radius: 16px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 2.2rem;
                    color: white;
                    box-shadow: 0 8px 30px rgba(108,71,255,0.4);
                }
                .logo-accent {
                    color: #8B6FFF;
                }
            </style>
        </head>
        <body>
            <div id="capture-logo" class="logo-container">
                <span class="logo-icon"><i class="fa-solid fa-reply"></i></span>
                <span>Reply<span class="logo-accent">Vera</span></span>
            </div>
        </body>
        </html>
        `;

        const htmlPath = path.resolve('temp_logo.html');
        fs.writeFileSync(htmlPath, html);

        console.log("Starting browser...");
        const { browser, page } = await connect({
            headless: true, // we want to run headlessly, but real-browser might need "false" as a string? We'll see.
            args: [],
            customConfig: {},
            turnstile: false,
            connectOption: {}
        });

        const url = 'file://' + htmlPath;
        await page.goto(url, { waitUntil: 'networkidle0' });

        // Wait for font to load
        await page.evaluateHandle('document.fonts.ready');

        // We capture just the element
        const element = await page.$('#capture-logo');
        
        const outputPath = path.resolve('../replyvera_logo_transparent.png');
        await element.screenshot({
            path: outputPath,
            omitBackground: true // Transparent PNG
        });

        console.log("Saved transparent logo to: " + outputPath);
        
        await browser.close();
        fs.unlinkSync(htmlPath);
        
    } catch (e) {
        console.error("Error:", e);
        process.exit(1);
    }
})();

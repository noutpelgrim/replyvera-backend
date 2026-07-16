import { sendAllWeeklyReports } from '../services/reportService.js';

async function run() {
    console.log('--- WEEKLY REPORT SYSTEM TRIGGERED ---');
    try {
        await sendAllWeeklyReports();
    } catch (e) {
        console.error('Fatal error running reports script:', e.message);
    } finally {
        process.exit(0);
    }
}

run();

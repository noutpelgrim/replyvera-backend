
import { supabase } from './src/db/index.js';

async function insertJenteReview() {
    const reviewData = {
        location_id: '632a8707-e914-421a-9b24-98a696609528',
        google_review_id: 'Ci9DQUlRQUNvZENodHljRjlvT2tWS1JFUnFia3h6Y21aVE1qZGZkSEV6VWxrMlNtYxAB',
        reviewer_name: 'Jente',
        rating: 5,
        comment: 'Top hostel!! Jolanda, Nout en de kids ontvangen je met open armen. Mooi en proper hostel. Goed uitgeruste keuken en locatie vlakbij het strand. Aanrader!',
        status: 'PENDING',
        drafted_reply: 'Hoi Jente, ontzettend bedankt voor je mooie review! We vonden het erg leuk dat je er was. Fijn om te horen dat je hebt genoten van het hostel, de keuken en de locatie. Hopelijk tot een volgende keer! Groetjes van Jolanda, Nout en de kids.',
        review_date: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString() // Approximately a day ago
    };

    console.log('🚀 Manual Sync: Inserting Jente\'s review...');
    
    try {
        const { data, error } = await supabase
            .from('reviews')
            .upsert(reviewData, { onConflict: 'google_review_id' })
            .select();

        if (error) {
            console.error('❌ Error inserting review:', error.message);
        } else {
            console.log('✅ Successfully inserted Jente\'s review!');
            console.log(JSON.stringify(data, null, 2));
        }
    } catch (err) {
        console.error('❌ Unexpected error:', err);
    }
}

insertJenteReview();

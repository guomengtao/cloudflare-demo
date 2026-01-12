const fetch = require('node-fetch');
const dotenv = require('dotenv');
dotenv.config();

const { CLOUDFLARE_API_KEY, CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_DATABASE_ID } = process.env;
const API_URL = `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/d1/database/${CLOUDFLARE_DATABASE_ID}/query`;

async function checkDatabase() {
    try {
        // Check missing_persons_cases columns
        const columnsResponse = await fetch(API_URL, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${CLOUDFLARE_API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ sql: 'PRAGMA table_info(missing_persons_cases)' })
        });

        const columnsData = await columnsResponse.json();
        console.log('missing_persons_cases columns:');
        columnsData.result[0].results.forEach(col => {
            console.log(`- ${col.name} (${col.type})`);
        });

        // Get sample data
        const sampleResponse = await fetch(API_URL, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${CLOUDFLARE_API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ sql: 'SELECT * FROM missing_persons_cases LIMIT 1' })
        });

        const sampleData = await sampleResponse.json();
        console.log('\nSample data:');
        console.log(JSON.stringify(sampleData.result[0].results, null, 2));

        // Check what content is actually available
        const contentResponse = await fetch(API_URL, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${CLOUDFLARE_API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ sql: 'SELECT id, case_url, case_title, scraped_content FROM missing_persons_cases LIMIT 3' })
        });

        const contentData = await contentResponse.json();
        console.log('\nContent available:');
        contentData.result[0].results.forEach(row => {
            console.log(`ID: ${row.id}`);
            console.log(`URL: ${row.case_url}`);
            console.log(`Title: ${row.case_title}`);
            console.log(`Has scraped_content: ${row.scraped_content ? 'Yes' : 'No'}`);
            if (row.scraped_content) {
                console.log(`Scraped content length: ${row.scraped_content.length}`);
            }
            console.log('---');
        });

    } catch (error) {
        console.error('Error:', error);
    }
}

checkDatabase();
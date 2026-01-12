const fetch = require('node-fetch');
const dotenv = require('dotenv');
dotenv.config();

const { CLOUDFLARE_API_KEY, CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_DATABASE_ID } = process.env;
const API_URL = `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/d1/database/${CLOUDFLARE_DATABASE_ID}/query`;

async function getCaseIds() {
    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${CLOUDFLARE_API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ sql: 'SELECT id, case_url FROM missing_persons_cases LIMIT 5' })
        });

        const data = await response.json();
        if (data.success) {
            console.log('First 5 cases:');
            data.result[0].rows.forEach(row => {
                console.log(`ID: ${row.id}, URL: ${row.case_url}`);
            });
        } else {
            console.error('Error:', data.errors);
        }
    } catch (error) {
        console.error('Error:', error);
    }
}

getCaseIds();
const fetch = require('node-fetch');
const dotenv = require('dotenv');
dotenv.config();

const { CLOUDFLARE_API_KEY, CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_DATABASE_ID } = process.env;
const API_URL = `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/d1/database/${CLOUDFLARE_DATABASE_ID}/query`;

async function getDatabaseInfo() {
    try {
        // Check all tables
        const tablesResponse = await fetch(API_URL, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${CLOUDFLARE_API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ sql: 'SELECT name FROM sqlite_master WHERE type="table"' })
        });
        const tablesData = await tablesResponse.json();
        
        if (tablesData.success) {
            const tables = tablesData.result[0].rows;
            console.log('Tables in database:', tables.map(t => t.name));
            
            // Check missing_persons_cases structure
            const casesStructureResponse = await fetch(API_URL, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${CLOUDFLARE_API_KEY}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ sql: 'PRAGMA table_info(missing_persons_cases)' })
            });
            const casesStructureData = await casesStructureResponse.json();
            
            if (casesStructureData.success) {
                console.log('\nmissing_persons_cases columns:');
                casesStructureData.result[0].rows.forEach(col => {
                    console.log(`- ${col.name} (${col.type})`);
                });
            }
            
            // Check missing_persons_info structure
            const infoStructureResponse = await fetch(API_URL, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${CLOUDFLARE_API_KEY}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ sql: 'PRAGMA table_info(missing_persons_info)' })
            });
            const infoStructureData = await infoStructureResponse.json();
            
            if (infoStructureData.success) {
                console.log('\nmissing_persons_info columns:');
                infoStructureData.result[0].rows.forEach(col => {
                    console.log(`- ${col.name} (${col.type})`);
                });
            }
            
            // Get sample data from both tables
            const sampleResponse = await fetch(API_URL, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${CLOUDFLARE_API_KEY}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ sql: 'SELECT mpc.id, mpc.case_url, mpc.scraped_content, mpi.* FROM missing_persons_cases mpc LEFT JOIN missing_persons_info mpi ON mpc.id = mpi.case_id LIMIT 2' })
            });
            const sampleData = await sampleResponse.json();
            
            if (sampleData.success) {
                console.log('\nSample data:');
                console.log(JSON.stringify(sampleData.result[0].rows, null, 2));
            }
        } else {
            console.error('Error:', tablesData.errors);
        }
    } catch (error) {
        console.error('Error:', error);
    }
}

getDatabaseInfo();
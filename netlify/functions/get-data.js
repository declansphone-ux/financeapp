const { Client } = require('pg');

exports.handler = async (event, context) => {
    // Check if the database URL is set
    const connectionString = process.env.NETLIFY_DATABASE_URL;
    if (!connectionString) {
        console.error("NETLIFY_DATABASE_URL environment variable is not set.");
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'Database configuration missing.' }),
        };
    }
    
    let client;
    try {
        client = new Client({
            connectionString: connectionString,
            // Ensure you use the correct SSL setting for Neon
            ssl: { rejectUnauthorized: false }, 
        });

        await client.connect();

        // ------------------------------------------------------------------
        // 1. Get Periods Data (Finance_data table)
        // CRITICAL FIX: Removing ORDER BY from the SQL query to avoid JSON parsing errors (text ->> unknown)
        // Sorting will be done in the client-side JS (Step 46 revised)
        // ------------------------------------------------------------------
        const periodsResult = await client.query('SELECT periods FROM "finance_data"');
        
        // The periods column holds an ARRAY of period objects (JSON array in one column).
        // .map(row => row.periods) extracts the JSON array from the column object.
        // .filter(periods => periods !== null) removes any rows where the column was NULL.
        // .flat() flattens the result into a single array of period objects for the app.
        const periodsArray = periodsResult.rows
            .map(row => row.periods)
            .filter(periods => periods !== null)
            .flat(); 

        // ------------------------------------------------------------------
        // 2. Get Subcategories Data (Subcategories_data table)
        // ------------------------------------------------------------------
        const subcategoriesResult = await client.query('SELECT app_config FROM subcategories_data WHERE id = 1');
        
        let subcategoriesObject = {};
        if (subcategoriesResult.rows.length > 0 && subcategoriesResult.rows[0].app_config) {
            // Extract the 'subcategories' object from the 'app_config' column
            subcategoriesObject = subcategoriesResult.rows[0].app_config.subcategories || {}; 
        }

        // ------------------------------------------------------------------
        // 3. Combine and Return
        // ------------------------------------------------------------------
        const fullDataObject = {
            periods: periodsArray,
            subcategories: subcategoriesObject
        };

        return {
            statusCode: 200,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(fullDataObject),
        };

    } catch (error) {
        console.error('Database Operation Error:', error.stack);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'Failed to retrieve data from database.' }),
        };
    } finally {
        // Ensure the database connection is closed
        if (client) {
            await client.end();
        }
    }
};

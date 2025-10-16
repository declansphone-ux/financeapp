// netlify/functions/get-data.js

const { Client } = require('pg');

exports.handler = async (event, context) => {
  // Database connection string is set as an environment variable in Netlify
  const connectionString = process.env.NETLIFY_DATABASE_URL;
  const client = new Client({
    connectionString: connectionString,
    // Required for Netlify to connect to Neon DB
    ssl: { rejectUnauthorized: false }, 
  });

  try {
    await client.connect();

    // 1. Get Periods Data (from finance_data table)
    // The 'periods' column holds a single JSONB array of all period objects.
    // We order by the 'startDate' of the FIRST element in that JSONB array.
    const periodsResult = await client.query('SELECT periods FROM "finance_data" ORDER BY periods->>0->>\'startDate\' DESC');
    
    let periodsArray = [];
    if (periodsResult.rows.length > 0) {
        // The column 'periods' contains the full array of periods.
        // We filter out any null entries (blank rows) and then grab the content.
        periodsArray = periodsResult.rows
            .map(row => row.periods)
            .filter(periods => periods !== null)
            .flat(); // Use .flat() to ensure we return a single array if the DB returns multiple arrays
    }

    // 2. Get Subcategories Data (from subcategories_data table)
    // The 'app_config' column holds the object containing the subcategories.
    const subcategoriesResult = await client.query('SELECT app_config FROM subcategories_data WHERE id = 1');
    
    let subcategoriesObject = {};
    if (subcategoriesResult.rows.length > 0 && subcategoriesResult.rows[0].app_config) {
        // Extract the actual 'subcategories' map from the 'app_config' JSONB column
        subcategoriesObject = subcategoriesResult.rows[0].app_config.subcategories || {}; 
    }

    // 3. Combine both into a single object for the app
    const fullDataObject = {
        periods: periodsArray,
        subcategories: subcategoriesObject
    };

    // 4. Return the full object
    return {
        statusCode: 200,
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify(fullDataObject),
    };

  } catch (error) {
    console.error('Database Get Error:', error);
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: 'Failed to retrieve data from database.' }),
    };
  } finally {
    if (client) {
      await client.end();
    }
  }
};

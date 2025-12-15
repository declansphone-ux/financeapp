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
    // Removed complex ORDER BY clause to avoid SQL operator errors.
    const periodsResult = await client.query('SELECT periods FROM "finance_data"');
    
    let periodsArray = [];
    if (periodsResult.rows.length > 0) {
        // The column 'periods' contains the full array of periods.
        // We filter out any null entries (blank rows) and then grab the content.
        periodsArray = periodsResult.rows
            .map(row => row.periods)
            .filter(periods => periods !== null)
            .flat(); // Flatten the result (e.g., if DB returns [[period1, period2], [period3]])

        // *** SORTING NOW DONE IN JAVASCRIPT ***
        // Sorts periods by the 'startDate' of the first element in the array, descending.
        periodsArray.sort((a, b) => {
            const dateA = a[0] ? new Date(a[0].startDate) : 0;
            const dateB = b[0] ? new Date(b[0].startDate) : 0;
            return dateB - dateA; // Descending order
        });
    }

    // 2. Get Subcategories Data (from subcategories_data table)
    // The 'app_config' column holds the object containing the subcategories.
    const subcategoriesResult = await client.query('SELECT app_config FROM subcategories_data WHERE id = 1');

    let subcategoriesObject = {};
    if (subcategoriesResult.rows.length > 0 && subcategoriesResult.rows[0].app_config) {
        // Extract the actual 'subcategories' map from the 'app_config' JSONB column
        subcategoriesObject = subcategoriesResult.rows[0].app_config.subcategories || {};
    }

    // 3. Get Bank Accounts Data (from subcategories_data table with id = 2)
    const bankAccountsResult = await client.query('SELECT app_config FROM subcategories_data WHERE id = 2');

    let bankAccountsArray = [];
    if (bankAccountsResult.rows.length > 0 && bankAccountsResult.rows[0].app_config) {
        // Extract the actual 'bankAccounts' array from the 'app_config' JSONB column
        bankAccountsArray = bankAccountsResult.rows[0].app_config.bankAccounts || [];
    }

    // 4. Combine all into a single object for the app
    const fullDataObject = {
        periods: periodsArray,
        subcategories: subcategoriesObject,
        bankAccounts: bankAccountsArray
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

// netlify/functions/get-data.js

// 1. Import the PostgreSQL client
const { Client } = require('pg');

exports.handler = async (event, context) => {
  // 2. Get the connection string from Netlify's environment variable
  // The Neon Netlify extension typically sets this as DATABASE_URL.
  // If you manually set it as NEON_DATABASE_URL, change the variable name below.
  const connectionString = process.env.NETLIFY_DATABASE_URL;

  // Handle the case where the variable isn't set (safety check)
  if (!connectionString) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Database connection string not found. Check Netlify Environment variables." }),
    };
  }

  // 3. Create a new client instance
  const client = new Client({
    connectionString: connectionString,
    // Netlify Functions (Lambda) require SSL to connect securely to Neon
    ssl: {
      rejectUnauthorized: false,
    },
  });

  try {
    await client.connect();

    // 1. Get Periods Data (Array of period objects)
    // 🚨 USING COLUMN NAME 'period' in table 'finance_data'
    const periodsResult = await client.query('SELECT period FROM "finance_data" ORDER BY period->>\'startDate\' DESC');
    const periodsArray = periodsResult.rows.map(row => row.period); // Changed from row.period_data

    // 2. Get Subcategories Data (Single config object from subcategories_data table)
    const subcategoriesResult = await client.query('SELECT app_config FROM subcategories_data WHERE id = 1');

    let subcategoriesObject = {};
    if (subcategoriesResult.rows.length > 0) {
        // Extract the 'subcategories' object from the 'app_config' column
        subcategoriesObject = subcategoriesResult.rows[0].app_config.subcategories; 
    }

    // 3. Combine both into a single object for the app
    const fullDataObject = {
        periods: periodsArray,
        subcategories: subcategoriesObject
    };

    // 4. Return the full object
    return {
        statusCode: 200,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(fullDataObject),
    };

}
 finally {
    // 6. Close the connection to avoid memory leaks (Crucial for serverless)
    await client.end();
  }
};

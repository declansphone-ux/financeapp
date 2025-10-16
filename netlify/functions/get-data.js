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
    // Connect to the database
    await client.connect();

    // 4. Run the query to get all your finance data
    const result = await client.query('SELECT * FROM finance_data ORDER BY date DESC');

    // 5. Return the data rows as JSON
    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(result.rows), // result.rows contains your data array
    };
  } catch (error) {
    // Log the full error to Netlify's console for debugging
    console.error('Database Error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Failed to retrieve data from database.' }),
    };
  } finally {
    // 6. Close the connection to avoid memory leaks (Crucial for serverless)
    await client.end();
  }
};

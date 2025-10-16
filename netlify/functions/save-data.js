// netlify/functions/save-data.js

const { Client } = require('pg');

exports.handler = async (event, context) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  let fullDataObject;
  try {
    // Expecting { periods: [...], subcategories: {...} } from the HTML
    fullDataObject = JSON.parse(event.body);
  } catch (e) {
    return { statusCode: 400, body: 'Bad Request: Invalid JSON in body' };
  }

  const connectionString = process.env.NETLIFY_DATABASE_URL;
  const client = new Client({
    connectionString: connectionString,
    ssl: { rejectUnauthorized: false },
  });

  try {
    await client.connect();
    await client.query('BEGIN'); // Start transaction

    // --- 1. Save Periods Data (Finance_data table) ---
    // Clear old data and insert new periods
    await client.query('TRUNCATE TABLE "finance_data" RESTART IDENTITY');

    const insertPromises = fullDataObject.periods.map(periods => {
      // 🚨 USING COLUMN NAME 'period' in table 'finance_data'
      return client.query(
        `INSERT INTO "finance_data" (periods) VALUES ($1)`, 
        [JSON.stringify(periods)]
      );
    });
    await Promise.all(insertPromises);

    // --- 2. Save Subcategories Data (Subcategories_data table) ---
    // Upsert the single row in the subcategories_data table
    const subcategoriesConfig = { subcategories: fullDataObject.subcategories };
    const configJsonString = JSON.stringify(subcategoriesConfig);

    const upsertQuery = `
      INSERT INTO subcategories_data (id, app_config)
      VALUES (1, $1) 
      ON CONFLICT (id) DO UPDATE SET app_config = $1;
    `;
    await client.query(upsertQuery, [configJsonString]);

    // --- 3. Commit Transaction ---
    await client.query('COMMIT');

    return {
      statusCode: 200,
      body: JSON.stringify({ message: "All data successfully saved to Neon database." }),
    };

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Database Save Error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Failed to save data to database.' }),
    };
  } finally {
    await client.end();
  }
};

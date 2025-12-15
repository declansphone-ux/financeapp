// netlify/functions/save-data.js

const { Client } = require('pg');

exports.handler = async (event, context) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  let fullDataObject;
  try {
    // Expecting { periods: [...], subcategories: {...}, bankAccounts: [...] } from the HTML
    fullDataObject = JSON.parse(event.body);
  } catch (e) {
    return { statusCode: 400, body: 'Bad Request: Invalid JSON in body' };
  }

  const connectionString = process.env.NETLIFY_DATABASE_URL;
  let client; // Declared outside try block to be accessible in finally

  try {
    client = new Client({
      connectionString: connectionString,
      ssl: { rejectUnauthorized: false },
    });
    
    await client.connect();
    await client.query('BEGIN'); // Start transaction for atomicity

    // --- 1. Save Periods Data (finance_data table) ---
    // Clear old data and insert the new array into the single 'periods' column
    await client.query('TRUNCATE TABLE "finance_data" RESTART IDENTITY');

    // The entire periods array is stringified and saved into the single 'periods' JSONB column
    const allPeriodsJsonString = JSON.stringify(fullDataObject.periods);

    // 🚨 USING CONFIRMED COLUMN NAME 'periods'
    await client.query(
      `INSERT INTO "finance_data" (periods) VALUES ($1)`, 
      [allPeriodsJsonString]
    );

    // --- 2. Save Subcategories Data (subcategories_data table) ---
    // Create the wrapper object for the app_config column
    const subcategoriesConfig = { subcategories: fullDataObject.subcategories };
    const configJsonString = JSON.stringify(subcategoriesConfig);

    // UPSERT: Insert if not exists (id=1), otherwise update the existing row
    const upsertQuery = `
      INSERT INTO subcategories_data (id, app_config)
      VALUES (1, $1)
      ON CONFLICT (id) DO UPDATE SET app_config = $1;
    `;
    await client.query(upsertQuery, [configJsonString]);

    // --- 3. Save Bank Accounts Data (subcategories_data table with id=2) ---
    const bankAccountsConfig = { bankAccounts: fullDataObject.bankAccounts || [] };
    const bankAccountsJsonString = JSON.stringify(bankAccountsConfig);

    // UPSERT: Insert if not exists (id=2), otherwise update the existing row
    const upsertBankAccountsQuery = `
      INSERT INTO subcategories_data (id, app_config)
      VALUES (2, $1)
      ON CONFLICT (id) DO UPDATE SET app_config = $1;
    `;
    await client.query(upsertBankAccountsQuery, [bankAccountsJsonString]);

    // --- 4. Commit Transaction ---
    await client.query('COMMIT');

    return {
      statusCode: 200,
      body: JSON.stringify({ message: "All data successfully saved to Neon database." }),
    };

  } catch (error) {
    // Ensure the transaction is rolled back on any error
    if (client) {
      await client.query('ROLLBACK');
    }
    console.error('Database Save Error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Failed to save data to database.' }),
    };
  } finally {
    // Safely check and close the client connection
    if (client) {
      await client.end();
    }
  }
};

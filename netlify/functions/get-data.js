// netlify/functions/get-data.js

exports.handler = async (event, context) => {
  // This is a basic response to test the function setup.
  // It will be replaced with database logic in a later step.
  try {
    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
      },
      // This message confirms the function is working.
      body: JSON.stringify({ message: "Success! Function endpoint is ready for deployment." }),
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message }),
    };
  }
};

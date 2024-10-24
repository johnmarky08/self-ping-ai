const express = require('express');
const axios = require('axios');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const app = express();
const PORT = 3000;

app.use(express.urlencoded({ extended: true }));

let pingResults = [];
let clients = [];

// Function to ping the URL
const pingURL = async (url) => {
  try {
    const response = await axios.get(url);
    const result = { url, status: 'Success', time: new Date().toLocaleString() };
    pingResults.push(result);
    notifyClients(result);
  } catch (error) {
    const result = { url, status: 'Error', time: new Date().toLocaleString() };
    pingResults.push(result);
    notifyClients(result);
  }
};

// Notify all connected clients
const notifyClients = (result) => {
  clients.forEach((client) => {
    client.res.write(`data: ${JSON.stringify(result)}\n\n`);
  });
};

// Handle client connection for SSE
app.get('/events', async (req, res) => {
  const { url } = req.query;

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  // Add the client to the clients list
  clients.push({ res, url });

  // Remove the client when the connection is closed
  req.on('close', () => {
    clients = clients.filter(client => client.res !== res);
  });

  // Start pinging the specified URL if provided
  if (url) {
    setInterval(() => pingURL(url), 1000);
  }
});

// Serve the main HTML page
app.get('/', async (req, res) => {
  const { url } = req.query;

  // If no URL is provided, show the form to enter a URL
  if (!url) {
    return res.send(`
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Enter URL</title>
      </head>
      <body>
        <h1>Enter a URL to Ping</h1>
        <form action="/add-url" method="POST">
          <label for="url">URL:</label>
          <input type="text" id="url" name="url" required>
          <button type="submit">Submit</button>
        </form>
      </body>
      </html>
    `);
  }

  // Otherwise, show the ping results for the specified URL
  return res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Ping Results for ${url}</title>
        <style>
            body { font-family: Arial, sans-serif; }
            table { width: 100%; border-collapse: collapse; }
            th, td { border: 1px solid #ddd; padding: 8px; }
            th { background-color: #f2f2f2; }
        </style>
    </head>
    <body>
        <h1>Ping Results for ${url}</h1>
        <table id="resultsTable">
            <tr>
                <th>Status</th>
                <th>Time</th>
                <th>URL</th>
            </tr>
        </table>
        <script>
            const resultsTable = document.getElementById('resultsTable');
            const eventSource = new EventSource('/events?url=${encodeURIComponent(url)}');
            eventSource.onmessage = function(event) {
                const result = JSON.parse(event.data);
                const newRow = resultsTable.insertRow();
                const statusCell = newRow.insertCell(0);
                const timeCell = newRow.insertCell(1);
                const urlCell = newRow.insertCell(2);
                statusCell.textContent = result.status;
                timeCell.textContent = result.time;
                urlCell.textContent = result.url;
            };
        </script>
    </body>
    </html>
  `);
});

// Handle form submission to add a new URL
app.post('/add-url', async (req, res) => {
  const { url } = req.body;

  try {
    // Store the URL in the database using Prisma
    await prisma.url.create({
      data: { url },
    });

    // Redirect the user to the URL-specific page
    res.redirect(`/?url=${encodeURIComponent(url)}`);
  } catch (error) {
    // Handle error (e.g., if the URL is already in the database)
    res.status(400).send('Error: This URL already exists.');
  }
});

app.listen(PORT, () => {
  console.log(`Server is running at port: ${PORT}`);
});

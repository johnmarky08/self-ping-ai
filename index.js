const express = require('express');
const axios = require('axios');

const app = express();
const PORT = 3000;

let pingResults = [];
let clients = [];

// Function to ping the URL
const pingURL = async () => {
  try {
    const url = process.env.URL;
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
app.get('/events', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  // Add the client to the clients list
  clients.push({ res });

  // Remove the client when the connection is closed
  req.on('close', () => {
    clients = clients.filter(client => client.res !== res);
  });
});

// Ping every second
setInterval(pingURL, 1000);

// Serve the main HTML page
app.get('/', (req, res) => {
  res.send(`
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Ping Results</title>
            <style>
                body { font-family: Arial, sans-serif; }
                table { width: 100%; border-collapse: collapse; }
                th, td { border: 1px solid #ddd; padding: 8px; }
                th { background-color: #f2f2f2; }
            </style>
        </head>
        <body>
            <h1>Ping Results</h1>
            <table id="resultsTable">
                <tr>
                    <th>Status</th>
                    <th>Time</th>
                    <th>URL</th>
                </tr>
            </table>
            <script>
                const resultsTable = document.getElementById('resultsTable');

                const eventSource = new EventSource('/events');
                eventSource.onmessage = function(event) {
                    const result = JSON.parse(event.data);
                    const newRow = resultsTable.insertRow();
                    const statusCell = newRow.insertCell(0);
                    const timeCell = newRow.insertCell(1);
                    const urlCell = newRow.insertCell(2);
                    statusCell.textContent = result.status;
                    timeCell.textContent = result.time;
                    urlCell.textContent = result.url
                };
            </script>
        </body>
        </html>
    `);
});

app.listen(PORT, () => {
  console.log(`Server is running at port: ${PORT}`);
});
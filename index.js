const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const axios = require('axios');

const app = express();
const PORT = 3000;

// MongoDB connection
mongoose.connect(encodeURI(process.env.MONGO_URL), {
  useNewUrlParser: true,
  useUnifiedTopology: true
});

// Define a schema for storing URLs
const urlSchema = new mongoose.Schema({
  url: { type: String, required: true }
});
const URLModel = mongoose.model('URL', urlSchema);

app.use(bodyParser.urlencoded({ extended: true }));

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

// Serve the form for URL submission
app.get('/', (req, res) => {
  const userUrl = req.query.url ? decodeURIComponent(req.query.url) : '';
  
  res.send(`
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Ping URL</title>
            <style>
                body { font-family: Arial, sans-serif; }
                table { width: 100%; border-collapse: collapse; }
                th, td { border: 1px solid #ddd; padding: 8px; }
                th { background-color: #f2f2f2; }
            </style>
        </head>
        <body>
            <h1>Enter URL to Ping</h1>
            <form action="/add" method="POST">
                <label for="url">URL:</label>
                <input type="text" id="url" name="url" required value="${userUrl}">
                <button type="submit">Submit</button>
            </form>
            
            ${userUrl ? `
            <h1>Ping Results for ${userUrl}</h1>
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
                    if (result.url === '${userUrl}') {
                        const newRow = resultsTable.insertRow();
                        const statusCell = newRow.insertCell(0);
                        const timeCell = newRow.insertCell(1);
                        const urlCell = newRow.insertCell(2);
                        statusCell.textContent = result.status;
                        timeCell.textContent = result.time;
                        urlCell.textContent = result.url;
                    }
                };
            </script>
            ` : ''}
        </body>
        </html>
    `);
});

// Handle the form submission and store the URL in MongoDB
app.post('/add', async (req, res) => {
  const { url } = req.body;
  
  // Save the URL to MongoDB
  const newURL = new URLModel({ url });
  await newURL.save();
  
  // Redirect to /?url=THEIR_URL
  res.redirect(`/?url=${encodeURIComponent(url)}`);
});

// Ping the stored URL every second
setInterval(async () => {
  const urls = await URLModel.find();
  urls.forEach(urlDoc => {
    pingURL(urlDoc.url);
  });
}, 1000);

app.listen(PORT, () => {
  console.log(`Server is running at port: ${PORT}`);
});

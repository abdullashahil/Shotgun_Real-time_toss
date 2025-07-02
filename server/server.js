
const express = require('express');
const http = require('http');
const cors = require('cors');
const { registerSocketHandlers } = require('./sockets');
require('dotenv').config();

const app = express();

// Middlewares
app.use(cors());
app.use(express.json());

// Basic route
app.get('/', (req, res) => {
  res.send('Toss Game API Running...');
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

const server = http.createServer(app);

// Initialize Socket.IO
registerSocketHandlers(server);

const PORT = process.env.PORT || 6000;
server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📡 Socket.IO server ready for connections`);
});

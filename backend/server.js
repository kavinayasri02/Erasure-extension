const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
require('dotenv').config();

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: { origin: '*' }
});

app.use(cors());
app.use(express.json());

// Store connected machines in memory
const connectedMachines = {};

// Routes
app.use('/api/sessions', require('./routes/sessions')(io));
app.use('/api/auth', require('./routes/auth'));

// WebSocket - machines connect here
io.on('connection', (socket) => {
  console.log('Machine connected:', socket.id);

  socket.on('register_machine', (data) => {
    connectedMachines[data.machineId] = socket.id;
    console.log('Machine registered:', data.machineId);
  });

  socket.on('disconnect', () => {
    for (const [machineId, socketId] of Object.entries(connectedMachines)) {
      if (socketId === socket.id) delete connectedMachines[machineId];
    }
  });
});

// Make io and machines available to routes
app.set('io', io);
app.set('connectedMachines', connectedMachines);

server.listen(process.env.PORT, () => {
  console.log(`✅ Server running on port ${process.env.PORT}`);
});
// server.js
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
app.use(cors()); // Allow all origins for now (in production, restrict this)

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "http://localhost:3000", // frontend origin
    methods: ["GET", "POST"]
  }
});

io.on('connection', (socket) => {
  console.log(`Socket connected: ${socket.id}`);

  socket.on('join-room', ({ roomId, username }) => {
    console.log(`${username} joined room: ${roomId}`);
    socket.join(roomId);

    // Notify all other users in the room
    socket.to(roomId).emit('user-joined', { id: socket.id });

    // Handle signaling
    socket.on('signal', ({ userToSignal, signal, from }) => {
      io.to(userToSignal).emit('signal', { signal, from });
    });

    // Handle disconnect
    socket.on('disconnect', () => {
      console.log(`Socket disconnected: ${socket.id}`);
      socket.to(roomId).emit('user-left', { id: socket.id });
    });

    // Handle leaving the room
    socket.on("leave-room", ({ roomId }) => {
      socket.leave(roomId);
      socket.broadcast.to(roomId).emit("user-disconnected", { id: socket.id });
    });

  });
});

server.listen(3001, () => {
  console.log('✅ Server running on http://localhost:3001');
});

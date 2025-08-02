const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
});

const PORT = process.env.PORT || 5000;
app.use(cors());

// Track rooms and participants
const rooms = {};

io.on('connection', (socket) => {
  console.log(`Socket connected: ${socket.id}`);

  socket.on('join-room', ({ roomId, userName }) => {
    socket.join(roomId);
    socket.roomId = roomId;
    socket.userName = userName;

    // Create room entry if it doesn't exist
    if (!rooms[roomId]) {
      rooms[roomId] = [];
    }
    rooms[roomId].push(socket.id);

    console.log(`User ${socket.id} (${userName}) joined room ${roomId}`);

    const peersInRoom = {};
    const room = io.sockets.adapter.rooms.get(roomId);

    if (room) {
      for (const id of room) {
        const peerSocket = io.sockets.sockets.get(id);
        if (peerSocket && peerSocket.id !== socket.id) {
          peersInRoom[peerSocket.id] = peerSocket.userName || 'Peer';
        }
      }
    }

    // Notify joining user
    socket.emit('peer-list', peersInRoom);
    socket.emit('new-user', { existingPeers: Object.keys(peersInRoom) });

    // Notify others in room
    socket.to(roomId).emit('user-connected', {
      socketId: socket.id,
      userName: userName,
    });

    // Acknowledge each peer to new user
    Object.entries(peersInRoom).forEach(([peerId, peerName]) => {
      socket.emit('user-connected', {
        socketId: peerId,
        userName: peerName,
      });
    });
  });

  socket.on('offer', ({ target, offer }) => {
    io.to(target).emit('offer', {
      caller: socket.id,
      offer,
      userName: socket.userName,
    });
  });

  socket.on('answer', ({ target, answer }) => {
    io.to(target).emit('answer', {
      caller: socket.id,
      answer,
    });
  });

  socket.on('ice-candidate', ({ target, candidate }) => {
    io.to(target).emit('ice-candidate', {
      from: socket.id,
      candidate,
    });
  });

  socket.on('leave-room', (roomId) => {
    socket.leave(roomId);
    if (rooms[roomId]) {
      rooms[roomId] = rooms[roomId].filter(id => id !== socket.id);
      if (rooms[roomId].length === 0) {
        delete rooms[roomId];
      }
    }
    socket.to(roomId).emit('user-disconnected', socket.id);
    console.log(`User ${socket.id} left room ${roomId}`);
  });

  socket.on('end-room', (roomId) => {
    io.to(roomId).emit('room-ended');
    io.in(roomId).socketsLeave(roomId);
    delete rooms[roomId];
    console.log(`Room ${roomId} has been ended by host`);
  });

  socket.on('disconnect', () => {
    const roomId = socket.roomId;
    if (roomId && rooms[roomId]) {
      rooms[roomId] = rooms[roomId].filter(id => id !== socket.id);
      if (rooms[roomId].length === 0) {
        delete rooms[roomId];
      }
      socket.to(roomId).emit('user-disconnected', socket.id);
    }
    console.log(`User disconnected: ${socket.id}`);
  });
});

server.listen(PORT, () => {
  console.log(`✅ Server running at http://localhost:${PORT}`);
});

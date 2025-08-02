// server.js
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

io.on('connection', (socket) => {
  console.log(`Socket connected: ${socket.id}`);

  socket.on('join-room', ({ roomId, userName }) => {
    socket.join(roomId);
    socket.roomId = roomId;
    socket.userName = userName;

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

    socket.emit('peer-list', peersInRoom);
    socket.emit('new-user', { existingPeers: Object.keys(peersInRoom) });

    socket.to(roomId).emit('user-connected', {
      socketId: socket.id,
      userName: userName,
    });

    Object.entries(peersInRoom).forEach(([peerId, peerName]) => {
      socket.emit('user-connected', {
        socketId: peerId,
        userName: peerName,
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

    socket.on('disconnect', () => {
      console.log(`Socket disconnected: ${socket.id}`);
      socket.to(socket.roomId).emit('user-disconnected', socket.id);
    });
  });
});

server.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});

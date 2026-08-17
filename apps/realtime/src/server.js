const http = require('http');
const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');

const PORT = process.env.PORT || 5001;
const JWT_SECRET = process.env.JWT_SECRET || 'super_secure_travelbee_jwt_secret_key_2026';
const API_URL = process.env.API_URL || 'http://localhost:5000';

const server = http.createServer();
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

// Map to store online users: { userId: socketId }
const activeUsers = new Map();

// Authentication middleware for Socket.IO
io.use((socket, next) => {
  const token = socket.handshake.auth.token || socket.handshake.query.token;

  if (!token) {
    return next(new Error('Authentication token required'));
  }

  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) {
      return next(new Error('Invalid authentication token'));
    }
    socket.user = decoded;
    next();
  });
});

io.on('connection', (socket) => {
  const userId = socket.user.id;
  const email = socket.user.email;
  
  activeUsers.set(userId, socket.id);
  console.log(`🔌 Realtime: User ${email} connected. Socket: ${socket.id}`);

  // Broadcast user online status
  io.emit('user_status', { userId, status: 'online' });

  // Handle joining a direct chat room
  socket.on('join_room', (roomId) => {
    socket.join(roomId);
    console.log(`👥 Socket ${socket.id} joined room ${roomId}`);
  });

  // Handle incoming private message events
  socket.on('private_message', async (data) => {
    const { receiverId, content, placeShare } = data;
    
    const messagePayload = {
      senderId: userId,
      receiverId,
      content,
      placeShare
    };

    console.log(`✉️ Realtime: Message from ${userId} to ${receiverId}`);

    // Deliver to recipient if online
    const recipientSocketId = activeUsers.get(receiverId);
    if (recipientSocketId) {
      io.to(recipientSocketId).emit('private_message', {
        ...messagePayload,
        timestamp: new Date(),
        senderEmail: email
      });
    }

    // Echo back to sender's other sockets
    socket.emit('private_message', {
      ...messagePayload,
      timestamp: new Date(),
      senderEmail: email
    });

    // Persist to Express API backend database via native fetch
    try {
      const response = await fetch(`${API_URL}/api/users/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${socket.handshake.auth.token || socket.handshake.query.token}`
        },
        body: JSON.stringify(messagePayload)
      });
      
      if (!response.ok) {
        console.error(`❌ Realtime: Failed to save message to API backend. Status: ${response.status}`);
      }
    } catch (error) {
      console.error('❌ Realtime: Error connecting to API backend for message persistence:', error.message);
    }
  });

  // Handle disconnect
  socket.on('disconnect', () => {
    activeUsers.delete(userId);
    console.log(`🔌 Realtime: User ${email} disconnected.`);
    // Broadcast user offline status
    io.emit('user_status', { userId, status: 'offline' });
  });
});

server.listen(PORT, () => {
  console.log(`⚡ Socket.IO Realtime Server running on port ${PORT}`);
});

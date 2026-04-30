const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const colors = require('colors');
const connectDB = require('./config/db');
const User = require('./models/User');

// Load env vars
dotenv.config();

// Connect to database
connectDB();

const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
  },
});

app.set('socketio', io);

// Body parser with increased limit for image uploads
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Enable CORS
app.use(cors());

// Simple Request Logger
app.use((req, res, next) => {
  console.log(`${req.method} ${req.originalUrl}`);
  next();
});

// Socket.io Implementation
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('setup_user', async (userId) => {
    socket.userId = userId;
    try {
      await User.findByIdAndUpdate(userId, { onlineStatus: true });
      socket.broadcast.emit('user_status_changed', { userId, onlineStatus: true });
      console.log(`User ${userId} is online`);
    } catch (err) {
      console.error('Error updating user status:', err);
    }
  });

  socket.on('join_room', (data) => {
    socket.join(data);
    console.log(`User ${socket.id} joined room: ${data}`);
  });

  socket.on('send_message', (data) => {
    // data should contain room (conversationId), sender, text, etc.
    socket.to(data.room).emit('receive_message', data);
  });

  socket.on('delete_message', (data) => {
    // data should contain room and messageId
    socket.to(data.room).emit('message_deleted', data.messageId);
  });

  socket.on('mark_as_read', (data) => {
    // data should contain room (conversationId)
    socket.to(data.room).emit('messages_read', data);
  });

  socket.on('disconnect', async () => {
    if (socket.userId) {
      try {
        await User.findByIdAndUpdate(socket.userId, { onlineStatus: false, lastSeen: Date.now() });
        socket.broadcast.emit('user_status_changed', { userId: socket.userId, onlineStatus: false });
        console.log(`User ${socket.userId} is offline`);
      } catch (err) {
        console.error('Error updating user status on disconnect:', err);
      }
    }
    console.log('User disconnected:', socket.id);
  });
});

// Route files
const authRoutes = require('./routes/authRoutes');
const messageRoutes = require('./routes/messageRoutes');
const storyRoutes = require('./routes/storyRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const postRoutes = require('./routes/postRoutes');
const uploadRoutes = require('./routes/uploadRoutes');

// Mount routers
app.use('/api/auth', authRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/stories', storyRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/posts', postRoutes);
app.use('/api/upload', uploadRoutes);

app.get('/', (req, res) => {
  res.send('API is running...');
});

const PORT = process.env.PORT || 5000;

server.listen(
  PORT,
  () => console.log(`Server is running on port ${PORT}`)
);

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const { executeCode } = require('./src/engine/executor');
const { splitCode } = require('./src/engine/splitter');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' }
});

const PORT = process.env.PORT || 7860;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// In-memory rooms: stores current code and active users per room
const rooms = new Map();

// ── Real-Time Live Collaboration via WebSockets ──
io.on('connection', (socket) => {
  let currentRoom = null;

  socket.on('join-room', (roomId) => {
    currentRoom = roomId;
    socket.join(roomId);

    // Send existing room code to new joiner
    if (rooms.has(roomId)) {
      socket.emit('code-sync', rooms.get(roomId));
    }

    // Broadcast user count to room
    const userCount = io.sockets.adapter.rooms.get(roomId)?.size || 1;
    io.to(roomId).emit('user-count', userCount);
  });

  // When someone types, broadcast instantly to all others in the same room
  socket.on('code-change', (data) => {
    if (!currentRoom) return;
    rooms.set(currentRoom, data.code);
    socket.to(currentRoom).emit('code-update', data);
  });

  // When someone runs code, sync output across all connected users
  socket.on('run-sync', (result) => {
    if (!currentRoom) return;
    socket.to(currentRoom).emit('run-result', result);
  });

  socket.on('disconnect', () => {
    if (currentRoom) {
      const userCount = io.sockets.adapter.rooms.get(currentRoom)?.size || 0;
      io.to(currentRoom).emit('user-count', userCount);
    }
  });
});

// ── API: Execute mixed-language code ──
app.post('/api/run', async (req, res) => {
  try {
    const result = await executeCode(req.body.code || '');
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── API: Detect languages per line ──
app.post('/api/detect', (req, res) => {
  try {
    const { detectedLines } = splitCode(req.body.code || '');
    res.json(detectedLines);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

server.listen(PORT, () => {
  console.log('');
  console.log('  ◈  PolyGlot IDE is running with Real-Time Collaboration!');
  console.log(`  ➜  Open in browser: http://localhost:${PORT}`);
  console.log('');
});

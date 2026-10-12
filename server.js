const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const fs = require('fs');
const os = require('os');
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
    const result = await executeCode(req.body.code || '', req.body.stdin || '', req.body.filename || '');
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── API: Detect languages per line ──
app.post('/api/detect', (req, res) => {
  try {
    const { detectedLines } = splitCode(req.body.code || '', req.body.filename || '');
    res.json(detectedLines);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── API: SQLite Database Studio ──
const TEMP_DIR = path.join(os.tmpdir(), 'polyglot-ide');
app.post('/api/db/query', (req, res) => {
  try {
    const sql = req.body.sql || '';
    if (!fs.existsSync(TEMP_DIR)) fs.mkdirSync(TEMP_DIR, { recursive: true });
    const dbFile = path.join(TEMP_DIR, 'polyglot.db');
    const runnerScript = path.join(TEMP_DIR, 'db_runner.py');

    const pyCode = `import sqlite3, json, sys
db_file = sys.argv[1]
sql_text = sys.stdin.read()
conn = sqlite3.connect(db_file)
cursor = conn.cursor()
results = []
try:
    for stmt in sql_text.split(';'):
        stmt = stmt.strip()
        if not stmt:
            continue
        cursor.execute(stmt)
        if cursor.description:
            cols = [c[0] for c in cursor.description]
            rows = [list(r) for r in cursor.fetchall()]
            results.append({"type": "table", "columns": cols, "rows": rows, "count": len(rows)})
        else:
            results.append({"type": "status", "message": f"Query OK ({cursor.rowcount} rows affected)"})
    conn.commit()
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%';")
    tables = [r[0] for r in cursor.fetchall()]
    print(json.dumps({"success": True, "results": results, "tables": tables}))
except Exception as e:
    print(json.dumps({"success": False, "error": str(e)}))
finally:
    conn.close()
`;
    fs.writeFileSync(runnerScript, pyCode, 'utf8');
    const pyCmd = process.platform === 'win32' ? 'python' : 'python3';
    const child = require('child_process').exec(`${pyCmd} "${runnerScript}" "${dbFile}"`, { maxBuffer: 10 * 1024 * 1024 }, (err, stdout, stderr) => {
      try {
        const parsed = JSON.parse(stdout);
        res.json(parsed);
      } catch (pe) {
        res.json({ success: false, error: stderr || stdout || err?.message || 'Database error' });
      }
    });
    child.stdin.write(sql);
    child.stdin.end();
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// ── Healthcheck & Keep-Alive to prevent cold starts ──
app.get('/health', (req, res) => res.json({ status: 'ok', uptime: process.uptime() }));

server.listen(PORT, () => {
  console.log('');
  console.log('  ◈  PolyGlot IDE is running with Real-Time Collaboration!');
  console.log(`  ➜  Open in browser: http://localhost:${PORT}`);
  console.log('');

  // Keep Render container awake (Render sleeps after 15 minutes of inactivity)
  const externalUrl = process.env.RENDER_EXTERNAL_URL;
  if (externalUrl) {
    console.log(`  ⚡ Keep-alive self-ping active for: ${externalUrl}`);
    const https = require('https');
    setInterval(() => {
      https.get(`${externalUrl}/health`, (res) => {
        // Self-ping to stay awake
      }).on('error', () => {});
    }, 12 * 60 * 1000); // Every 12 minutes
  }
});


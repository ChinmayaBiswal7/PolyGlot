const express = require('express');
const path = require('path');
const { executeCode } = require('./src/engine/executor');
const { splitCode } = require('./src/engine/splitter');

const app = express();
const PORT = process.env.PORT || 7860;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

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

app.listen(PORT, () => {
  console.log('');
  console.log('  ◈  PolyGlot IDE is running!');
  console.log(`  ➜  Open in browser: http://localhost:${PORT}`);
  console.log('');
});

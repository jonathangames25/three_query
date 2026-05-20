const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = 3000;

app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use('/assets', express.static(path.join(__dirname, 'assets')));

let commandQueue = [];

// In-memory scene state (optional, we could just pass commands to frontend)
// For simplicity and since scene state is managed by Three.js on the client,
// the server acts as a parser and query validator.
app.post('/api/query', (req, res) => {
    const { query, fromFrontend } = req.body;
    if (!query) return res.status(400).json({ success: false, error: 'Empty query' });

    try {
        const parsed = parseQuery(query);
        if (!fromFrontend) {
            commandQueue.push(parsed);
        }
        res.json({ success: true, command: parsed });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

app.get('/api/poll', (req, res) => {
    const commands = [...commandQueue];
    commandQueue = [];
    res.json({ success: true, commands });
});

function parseQuery(q) {
    // Splits by spaces, but keeps text inside double or single quotes together
    const matches = q.match(/(?:[^\s'"]+|'[^']*'|"[^"]*")+/g);
    if (!matches) throw new Error("Invalid query syntax");
    
    const action = matches[0].toUpperCase();
    const args = {};
    for (let i = 1; i < matches.length; i++) {
        const eqIdx = matches[i].indexOf('=');
        if (eqIdx !== -1) {
            const key = matches[i].slice(0, eqIdx);
            let val = matches[i].slice(eqIdx + 1);
            // Remove quotes if present
            if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
                val = val.slice(1, -1);
            }
            args[key] = val;
        }
    }
    return { action, args };
}

app.listen(PORT, () => {
    console.log(`ThreeQuery Engine running on http://localhost:${PORT}`);
});

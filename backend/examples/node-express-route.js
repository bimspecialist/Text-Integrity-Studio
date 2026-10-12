/* Example for an EXISTING authenticated Node.js / Express backend.
 * npm install express (only if your backend does not already have it)
 * Mount after your existing session/JWT middleware: app.use('/api', router)
 * Never put the TIS_API_KEY value in GitHub Pages/client-side JavaScript.
 */
'use strict';
const express = require('express');
const router = express.Router();

const UPSTREAM = 'http://127.0.0.1:8000/v1/analyze';

router.post('/detect', express.json({ limit: '135kb' }), async (req, res) => {
  // Replace this with existing verified session/JWT authorization logic.
  if (!req.user || !req.user.id) return res.status(401).json({ error: 'Authentication required' });
  const key = process.env.TIS_API_KEY;
  if (!key || key.length < 32) return res.status(503).json({ error: 'Detection upstream not configured' });
  const body = req.body;
  if (!body || typeof body.text !== 'string' || body.text.length > 120000) {
    return res.status(422).json({ error: 'Invalid text payload' });
  }
  try {
    const upstream = await fetch(UPSTREAM, {
      method: 'POST',
      headers: {
        'X-API-Key': key,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(31000),
      redirect: 'error',
    });
    const result = await upstream.json();
    res.set('Cache-Control', 'no-store');
    return res.status(upstream.status).json(result);
  } catch (_) {
    // Never log the user body or upstream credentials.
    return res.status(503).json({ error: 'Private detection service unavailable' });
  }
});
module.exports = router;

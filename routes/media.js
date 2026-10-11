const express = require('express');
const db = require('../config/db');

const router = express.Router();

// Serves images uploaded through the admin panel.
router.get('/:id', async (req, res, next) => {
  const id = parseInt(req.params.id, 10);
  if (!id) return next();
  const file = await db.one('SELECT mime_type, data FROM media WHERE id = ?', [id]);
  if (!file) return next();
  res.set('Cache-Control', 'public, max-age=31536000, immutable');
  res.type(file.mime_type).send(file.data);
});

module.exports = router;

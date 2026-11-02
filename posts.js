const express = require('express');
const db = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

const POST_SELECT = `
  SELECT p.id, p.title, p.content, p.created_at, p.updated_at, p.user_id,
         u.username AS author,
         (SELECT COUNT(*) FROM comments c WHERE c.post_id = p.id) AS comment_count
  FROM posts p JOIN users u ON u.id = p.user_id`;

const COMMENT_SELECT = `
  SELECT c.id, c.body, c.created_at, c.user_id, u.username AS author
  FROM comments c JOIN users u ON u.id = c.user_id`;

// ---- Posts -------------------------------------------------------------

router.get('/posts', (req, res) => {
  res.json(db.prepare(`${POST_SELECT} ORDER BY p.created_at DESC, p.id DESC`).all());
});

router.get('/posts/:id', (req, res) => {
  const post = db.prepare(`${POST_SELECT} WHERE p.id = ?`).get(req.params.id);
  if (!post) return res.status(404).json({ error: 'Post not found.' });
  res.json(post);
});

router.post('/posts', requireAuth, (req, res) => {
  const { title, content } = req.body || {};
  if (!title?.trim() || !content?.trim())
    return res.status(400).json({ error: 'Title and content are required.' });
  const info = db
    .prepare('INSERT INTO posts (user_id, title, content) VALUES (?, ?, ?)')
    .run(req.user.id, title.trim(), content.trim());
  res.status(201).json(db.prepare(`${POST_SELECT} WHERE p.id = ?`).get(info.lastInsertRowid));
});

router.put('/posts/:id', requireAuth, (req, res) => {
  const post = db.prepare('SELECT * FROM posts WHERE id = ?').get(req.params.id);
  if (!post) return res.status(404).json({ error: 'Post not found.' });
  if (post.user_id !== req.user.id) return res.status(403).json({ error: 'You can only edit your own posts.' });
  const { title, content } = req.body || {};
  if (!title?.trim() || !content?.trim())
    return res.status(400).json({ error: 'Title and content are required.' });
  db.prepare('UPDATE posts SET title = ?, content = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
    .run(title.trim(), content.trim(), post.id);
  res.json(db.prepare(`${POST_SELECT} WHERE p.id = ?`).get(post.id));
});

router.delete('/posts/:id', requireAuth, (req, res) => {
  const post = db.prepare('SELECT * FROM posts WHERE id = ?').get(req.params.id);
  if (!post) return res.status(404).json({ error: 'Post not found.' });
  if (post.user_id !== req.user.id) return res.status(403).json({ error: 'You can only delete your own posts.' });
  db.prepare('DELETE FROM posts WHERE id = ?').run(post.id);
  res.json({ ok: true });
});

// ---- Comments ----------------------------------------------------------

router.get('/posts/:id/comments', (req, res) => {
  res.json(db.prepare(`${COMMENT_SELECT} WHERE c.post_id = ? ORDER BY c.created_at ASC, c.id ASC`).all(req.params.id));
});

router.post('/posts/:id/comments', requireAuth, (req, res) => {
  const post = db.prepare('SELECT id FROM posts WHERE id = ?').get(req.params.id);
  if (!post) return res.status(404).json({ error: 'Post not found.' });
  const body = (req.body?.body || '').trim();
  if (!body) return res.status(400).json({ error: 'Write something before posting.' });
  const info = db.prepare('INSERT INTO comments (post_id, user_id, body) VALUES (?, ?, ?)')
    .run(post.id, req.user.id, body);
  res.status(201).json(db.prepare(`${COMMENT_SELECT} WHERE c.id = ?`).get(info.lastInsertRowid));
});

// A comment can be deleted by its author or by the owner of the post
router.delete('/comments/:id', requireAuth, (req, res) => {
  const row = db.prepare(`SELECT c.id, c.user_id, p.user_id AS post_owner
                          FROM comments c JOIN posts p ON p.id = c.post_id WHERE c.id = ?`).get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Comment not found.' });
  if (row.user_id !== req.user.id && row.post_owner !== req.user.id)
    return res.status(403).json({ error: 'You can only delete your own comments.' });
  db.prepare('DELETE FROM comments WHERE id = ?').run(row.id);
  res.json({ ok: true });
});

module.exports = router;

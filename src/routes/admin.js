const express = require('express');
const router = express.Router();
const { db, verifyPassword, generateToken } = require('../db');
const { adminAuth, createAdminSession, destroyAdminSession } = require('../middleware/auth');

// POST /api/admin/login
router.post('/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ success: false, error: 'ID Admin dan Sandi wajib diisi.' });
  }

  const stmt = db.prepare('SELECT * FROM admins WHERE username = ?');
  const admin = stmt.get(username);
  if (!admin || !verifyPassword(password, admin.password_hash)) {
    return res.status(401).json({ success: false, error: 'ID Admin atau Sandi salah.' });
  }

  const sessionToken = createAdminSession();
  res.cookie('admin_token', sessionToken, {
    httpOnly: true,
    maxAge: 7 * 24 * 60 * 60 * 1000,
    sameSite: 'lax'
  });

  return res.json({ success: true, message: 'Login berhasil', username: admin.username });
});

// POST /api/admin/logout
router.post('/logout', (req, res) => {
  const token = req.cookies?.admin_token;
  destroyAdminSession(token);
  res.clearCookie('admin_token');
  return res.json({ success: true, message: 'Logout berhasil' });
});

// GET /api/admin/me
router.get('/me', adminAuth, (req, res) => {
  res.json({ success: true, loggedIn: true });
});

// GET /api/admin/invitations
router.get('/invitations', adminAuth, (req, res) => {
  const query = `
    SELECT 
      i.*,
      (SELECT COUNT(*) FROM guests WHERE invitation_id = i.id) AS guest_count,
      (SELECT COUNT(*) FROM wishes WHERE invitation_id = i.id) AS wish_count
    FROM invitations i
    ORDER BY i.id DESC
  `;
  const invitations = db.prepare(query).all();
  res.json({ success: true, invitations });
});

// POST /api/admin/invitations
router.post('/invitations', adminAuth, (req, res) => {
  let { title, slug, theme_id, groom_nickname, bride_nickname } = req.body;

  if (!title || !title.trim()) {
    title = 'The Wedding of ' + (groom_nickname || 'Andi') + ' & ' + (bride_nickname || 'Sinta');
  }

  if (!slug || !slug.trim()) {
    slug = (groom_nickname || 'mempelai') + '-' + (bride_nickname || 'bahagia') + '-' + Math.floor(100 + Math.random() * 900);
  }
  // Sanitize slug
  slug = slug.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');

  // Check slug uniqueness
  const existingSlug = db.prepare('SELECT id FROM invitations WHERE slug = ?').get(slug);
  if (existingSlug) {
    slug += '-' + Math.floor(100 + Math.random() * 900);
  }

  // Generate secure random management token
  const managementToken = generateToken(16);
  theme_id = theme_id || 'islamic-elegant';

  const defaultLoveStory = JSON.stringify([
    { year: '2022', title: 'Awal Pertemuan', desc: 'Awal mula perkenalan yang penuh berkah dan kesederhanaan.' },
    { year: '2024', title: 'Keseriusan & Lamaran', desc: 'Pertemuan kedua keluarga untuk merencanakan ikatan suci pernikahan.' },
    { year: '2026', title: 'Menuju Hari Bahagia', desc: 'Melangkah ke jenjang pelaminan membangun bahtera rumah tangga sakinah mawaddah warahmah.' }
  ]);
  const defaultGallery = JSON.stringify([
    'https://images.unsplash.com/photo-1583939003579-730e3918a45a?w=800&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1519741497674-611481863552?w=800&auto=format&fit=crop&q=80'
  ]);
  const defaultBank = JSON.stringify([
    { bank_name: 'Bank BCA', account_number: '1234567890', account_holder: groom_nickname || 'Mempelai Pria' }
  ]);

  const insertStmt = db.prepare(`
    INSERT INTO invitations (
      slug, title, management_token, is_active, theme_id,
      groom_name, groom_nickname, bride_name, bride_nickname,
      love_story, gallery_photos, bank_accounts
    ) VALUES (
      ?, ?, ?, 1, ?,
      ?, ?, ?, ?,
      ?, ?, ?
    )
  `);

  const result = insertStmt.run(
    slug,
    title,
    managementToken,
    theme_id,
    groom_nickname ? `Muhammad ${groom_nickname}` : 'Muhammad Andi Pratama',
    groom_nickname || 'Andi',
    bride_nickname ? `Siti Nur ${bride_nickname}` : 'Siti Nur Aisyah',
    bride_nickname || 'Sinta',
    defaultLoveStory,
    defaultGallery,
    defaultBank
  );

  const newInvitation = db.prepare('SELECT * FROM invitations WHERE id = ?').get(result.lastInsertRowid);
  res.json({ success: true, invitation: newInvitation, managementToken });
});

// PATCH /api/admin/invitations/:id/status
router.patch('/invitations/:id/status', adminAuth, (req, res) => {
  const { id } = req.params;
  const { is_active } = req.body;

  const updateStmt = db.prepare('UPDATE invitations SET is_active = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?');
  updateStmt.run(is_active ? 1 : 0, id);

  res.json({ success: true, message: 'Status undangan berhasil diperbarui.' });
});

// DELETE /api/admin/invitations/:id
router.delete('/invitations/:id', adminAuth, (req, res) => {
  const { id } = req.params;
  const delStmt = db.prepare('DELETE FROM invitations WHERE id = ?');
  delStmt.run(id);
  res.json({ success: true, message: 'Undangan berhasil dihapus.' });
});

module.exports = router;

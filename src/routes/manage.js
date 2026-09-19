const express = require('express');
const router = express.Router();
const { db, generateToken } = require('../db');
const { tenantAuth } = require('../middleware/auth');

// All endpoints in this router use tenantAuth
router.use('/:managementToken', tenantAuth);

// GET /api/manage/:managementToken
// Returns complete invitation details, guests list, wishes, and statistics
router.get('/:managementToken', (req, res) => {
  const invitation = req.invitation;

  // Fetch guests for this invitation
  const guests = db.prepare('SELECT * FROM guests WHERE invitation_id = ? ORDER BY id DESC').all(invitation.id);

  // Fetch wishes for this invitation
  const wishes = db.prepare('SELECT * FROM wishes WHERE invitation_id = ? ORDER BY id DESC').all(invitation.id);

  // Parse JSON fields safely
  let love_story = [];
  let gallery_photos = [];
  let bank_accounts = [];
  let events_data = [];
  try { love_story = JSON.parse(invitation.love_story || '[]'); } catch (e) {}
  try { gallery_photos = JSON.parse(invitation.gallery_photos || '[]'); } catch (e) {}
  try { bank_accounts = JSON.parse(invitation.bank_accounts || '[]'); } catch (e) {}
  try { events_data = JSON.parse(invitation.events_data || '[]'); } catch (e) {}

  res.json({
    success: true,
    invitation: {
      ...invitation,
      love_story,
      gallery_photos,
      bank_accounts,
      events_data
    },
    guests,
    wishes,
    stats: {
      total_guests: guests.length,
      attending: guests.filter(g => g.attendance_status === 'hadir').length,
      not_attending: guests.filter(g => g.attendance_status === 'tidak_hadir').length,
      pending: guests.filter(g => g.attendance_status === 'pending' || g.attendance_status === 'ragu').length,
      total_wishes: wishes.length
    }
  });
});

// PUT /api/manage/:managementToken
// Autosave or update invitation details
router.put('/:managementToken', (req, res) => {
  const invitation = req.invitation;
  const data = req.body;

  // Whitelist fields to update
  const allowedFields = [
    'title', 'theme_id',
    'groom_name', 'groom_nickname', 'groom_parents', 'groom_photo',
    'bride_name', 'bride_nickname', 'bride_parents', 'bride_photo',
    'event_date',
    'akad_date', 'akad_time', 'akad_location', 'akad_address', 'akad_map_url',
    'resepsi_date', 'resepsi_time', 'resepsi_location', 'resepsi_address', 'resepsi_map_url',
    'quote_text', 'quote_source',
    'music_url',
    'bismillah_enabled', 'salam_opening', 'opening_text',
    'quote_enabled', 'quote_arabic',
    'closing_title', 'closing_text', 'closing_salam',
    'section_countdown_enabled', 'section_story_enabled',
    'section_gallery_enabled', 'section_gift_enabled',
    'section_rsvp_enabled', 'section_wishes_enabled'
  ];

  const updates = [];
  const params = [];

  for (const field of allowedFields) {
    if (data[field] !== undefined) {
      updates.push(`${field} = ?`);
      params.push(data[field]);
    }
  }

  // Handle JSON fields
  if (data.love_story !== undefined) {
    updates.push('love_story = ?');
    params.push(typeof data.love_story === 'string' ? data.love_story : JSON.stringify(data.love_story));
  }
  if (data.gallery_photos !== undefined) {
    updates.push('gallery_photos = ?');
    params.push(typeof data.gallery_photos === 'string' ? data.gallery_photos : JSON.stringify(data.gallery_photos));
  }
  if (data.bank_accounts !== undefined) {
    updates.push('bank_accounts = ?');
    params.push(typeof data.bank_accounts === 'string' ? data.bank_accounts : JSON.stringify(data.bank_accounts));
  }
  if (data.events_data !== undefined) {
    updates.push('events_data = ?');
    params.push(typeof data.events_data === 'string' ? data.events_data : JSON.stringify(data.events_data));
  }

  if (updates.length > 0) {
    updates.push('updated_at = CURRENT_TIMESTAMP');
    const sql = `UPDATE invitations SET ${updates.join(', ')} WHERE id = ?`;
    params.push(invitation.id);
    db.prepare(sql).run(...params);
  }

  const updatedInv = db.prepare('SELECT * FROM invitations WHERE id = ?').get(invitation.id);
  res.json({ success: true, message: 'Data undangan berhasil disimpan.', invitation: updatedInv });
});

// PUT /api/manage/:managementToken/theme
// Change theme only - strictly guarantees no content is modified (RULE 12)
router.put('/:managementToken/theme', (req, res) => {
  const invitation = req.invitation;
  const { theme_id } = req.body;

  const validThemes = ['islamic-elegant', 'islami-emerald', 'rose-gold', 'modern-minimalist', 'rustic-flora'];
  if (!theme_id || !validThemes.includes(theme_id)) {
    return res.status(400).json({ success: false, error: 'Pilihan tema tidak valid.' });
  }

  db.prepare('UPDATE invitations SET theme_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
    .run(theme_id, invitation.id);

  res.json({ success: true, message: `Tema berhasil diganti ke ${theme_id}. Seluruh data tetap aman!`, theme_id });
});

// POST /api/manage/:managementToken/guests
// Add single or multiple guests and automatically generate unique guestToken
router.post('/:managementToken/guests', (req, res) => {
  const invitation = req.invitation;
  const { name, phone, category } = req.body;

  if (!name || !name.trim()) {
    return res.status(400).json({ success: false, error: 'Nama tamu tidak boleh kosong.' });
  }

  // Generate unique guest token
  let guestToken = generateToken(6);
  while (db.prepare('SELECT id FROM guests WHERE guest_token = ?').get(guestToken)) {
    guestToken = generateToken(6);
  }

  const insert = db.prepare(`
    INSERT INTO guests (invitation_id, guest_token, name, phone, category)
    VALUES (?, ?, ?, ?, ?)
  `);

  const result = insert.run(
    invitation.id,
    guestToken,
    name.trim(),
    phone ? phone.trim() : '',
    category ? category.trim() : 'Tamu Undangan'
  );

  const newGuest = db.prepare('SELECT * FROM guests WHERE id = ?').get(result.lastInsertRowid);
  res.json({ success: true, guest: newGuest, message: 'Tamu berhasil ditambahkan.' });
});

// DELETE /api/manage/:managementToken/guests/:guestId
// Delete a guest (enforcing invitation ownership)
router.delete('/:managementToken/guests/:guestId', (req, res) => {
  const invitation = req.invitation;
  const { guestId } = req.params;

  const delStmt = db.prepare('DELETE FROM guests WHERE id = ? AND invitation_id = ?');
  const result = delStmt.run(guestId, invitation.id);

  if (result.changes === 0) {
    return res.status(404).json({ success: false, error: 'Data tamu tidak ditemukan atau bukan milik undangan ini.' });
  }

  res.json({ success: true, message: 'Tamu berhasil dihapus.' });
});

// DELETE /api/manage/:managementToken/wishes/:wishId
// Delete an inappropriate wish (moderation)
router.delete('/:managementToken/wishes/:wishId', (req, res) => {
  const invitation = req.invitation;
  const { wishId } = req.params;

  const delStmt = db.prepare('DELETE FROM wishes WHERE id = ? AND invitation_id = ?');
  const result = delStmt.run(wishId, invitation.id);

  if (result.changes === 0) {
    return res.status(404).json({ success: false, error: 'Ucapan tidak ditemukan.' });
  }

  res.json({ success: true, message: 'Ucapan berhasil dihapus.' });
});

module.exports = router;

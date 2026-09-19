const express = require('express');
const router = express.Router();
const { db } = require('../db');
const { guestResolver } = require('../middleware/auth');

router.use('/:slug/:guestToken?', guestResolver);

// GET /api/u/:slug/:guestToken
router.get('/:slug/:guestToken?', (req, res) => {
  const invitation = req.invitation;
  const guest = req.guest;

  let love_story = [];
  let gallery_photos = [];
  let bank_accounts = [];
  let events_data = [];
  try { love_story = JSON.parse(invitation.love_story || '[]'); } catch (e) {}
  try { gallery_photos = JSON.parse(invitation.gallery_photos || '[]'); } catch (e) {}
  try { bank_accounts = JSON.parse(invitation.bank_accounts || '[]'); } catch (e) {}
  try { events_data = JSON.parse(invitation.events_data || '[]'); } catch (e) {}

  const wishes = db.prepare('SELECT id, sender_name, message, attendance, created_at FROM wishes WHERE invitation_id = ? ORDER BY id DESC LIMIT 50').all(invitation.id);

  // Return public safe payload (without management_token or admin details)
  const safeInvitation = {
    id: invitation.id,
    slug: invitation.slug,
    title: invitation.title,
    theme_id: invitation.theme_id,
    groom_name: invitation.groom_name,
    groom_nickname: invitation.groom_nickname,
    groom_parents: invitation.groom_parents,
    groom_photo: invitation.groom_photo,
    bride_name: invitation.bride_name,
    bride_nickname: invitation.bride_nickname,
    bride_parents: invitation.bride_parents,
    bride_photo: invitation.bride_photo,
    event_date: invitation.event_date,
    akad_date: invitation.akad_date,
    akad_time: invitation.akad_time,
    akad_location: invitation.akad_location,
    akad_address: invitation.akad_address,
    akad_map_url: invitation.akad_map_url,
    resepsi_date: invitation.resepsi_date,
    resepsi_time: invitation.resepsi_time,
    resepsi_location: invitation.resepsi_location,
    resepsi_address: invitation.resepsi_address,
    resepsi_map_url: invitation.resepsi_map_url,
    events_data,
    bismillah_enabled: invitation.bismillah_enabled !== undefined ? invitation.bismillah_enabled : 1,
    salam_opening: invitation.salam_opening,
    opening_text: invitation.opening_text,
    quote_enabled: invitation.quote_enabled !== undefined ? invitation.quote_enabled : 1,
    quote_arabic: invitation.quote_arabic,
    quote_text: invitation.quote_text,
    quote_source: invitation.quote_source,
    closing_title: invitation.closing_title,
    closing_text: invitation.closing_text,
    closing_salam: invitation.closing_salam,
    section_countdown_enabled: invitation.section_countdown_enabled !== undefined ? invitation.section_countdown_enabled : 1,
    section_story_enabled: invitation.section_story_enabled !== undefined ? invitation.section_story_enabled : 1,
    section_gallery_enabled: invitation.section_gallery_enabled !== undefined ? invitation.section_gallery_enabled : 1,
    section_gift_enabled: invitation.section_gift_enabled !== undefined ? invitation.section_gift_enabled : 1,
    section_rsvp_enabled: invitation.section_rsvp_enabled !== undefined ? invitation.section_rsvp_enabled : 1,
    section_wishes_enabled: invitation.section_wishes_enabled !== undefined ? invitation.section_wishes_enabled : 1,
    love_story,
    gallery_photos,
    music_url: invitation.music_url,
    bank_accounts
  };

  res.json({
    success: true,
    invitation: safeInvitation,
    guest: {
      id: guest.id,
      name: guest.name,
      category: guest.category,
      attendance_status: guest.attendance_status,
      total_pax: guest.total_pax,
      token: guest.guest_token
    },
    wishes
  });
});

// POST /api/u/:slug/:guestToken/rsvp
router.post('/:slug/:guestToken/rsvp', (req, res) => {
  const invitation = req.invitation;
  const guest = req.guest;
  const { attendance_status, total_pax } = req.body;

  const validStatuses = ['hadir', 'tidak_hadir', 'ragu'];
  const status = validStatuses.includes(attendance_status) ? attendance_status : 'hadir';
  const pax = Math.max(1, parseInt(total_pax) || 1);

  if (guest.id) {
    db.prepare('UPDATE guests SET attendance_status = ?, total_pax = ? WHERE id = ?')
      .run(status, pax, guest.id);
  }

  res.json({
    success: true,
    message: 'Terima kasih, konfirmasi kehadiran berhasil dicatat.',
    attendance_status: status,
    total_pax: pax
  });
});

// POST /api/u/:slug/:guestToken/wishes
router.post('/:slug/:guestToken/wishes', (req, res) => {
  const invitation = req.invitation;
  const guest = req.guest;
  let { sender_name, message, attendance } = req.body;

  sender_name = (sender_name || guest.name || 'Tamu Undangan').trim();
  message = (message || '').trim();

  if (!message) {
    return res.status(400).json({ success: false, error: 'Pesan ucapan tidak boleh kosong.' });
  }

  const insert = db.prepare(`
    INSERT INTO wishes (invitation_id, guest_id, sender_name, message, attendance)
    VALUES (?, ?, ?, ?, ?)
  `);

  const result = insert.run(
    invitation.id,
    guest.id || null,
    sender_name,
    message,
    attendance || 'hadir'
  );

  const newWish = db.prepare('SELECT id, sender_name, message, attendance, created_at FROM wishes WHERE id = ?').get(result.lastInsertRowid);

  res.json({
    success: true,
    message: 'Terima kasih atas doa dan ucapannya!',
    wish: newWish
  });
});

// GET /api/u/:slug/:guestToken/wishes
router.get('/:slug/:guestToken/wishes', (req, res) => {
  const invitation = req.invitation;
  const wishes = db.prepare('SELECT id, sender_name, message, attendance, created_at FROM wishes WHERE invitation_id = ? ORDER BY id DESC LIMIT 50').all(invitation.id);
  res.json({ success: true, wishes });
});

module.exports = router;

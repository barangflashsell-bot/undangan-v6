const { DatabaseSync } = require('node:sqlite');
const path = require('node:path');
const crypto = require('node:crypto');

const DB_PATH = path.join(__dirname, '..', 'undangan.sqlite');
const db = new DatabaseSync(DB_PATH);

// Helper for hashing password using scrypt
function hashPassword(password, salt = 'undangan_salt_v5') {
  return crypto.scryptSync(password, salt, 32).toString('hex');
}

function verifyPassword(password, storedHash, salt = 'undangan_salt_v5') {
  const hash = hashPassword(password, salt);
  return crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(storedHash));
}

// Generate random URL-safe tokens
function generateToken(length = 16) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const bytes = crypto.randomBytes(length);
  let token = '';
  for (let i = 0; i < length; i++) {
    token += chars[bytes[i] % chars.length];
  }
  return token;
}

// Initialize tables and apply automatic migrations
function initDb() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS admins (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS invitations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      slug TEXT UNIQUE NOT NULL,
      title TEXT NOT NULL,
      management_token TEXT UNIQUE NOT NULL,
      is_active INTEGER DEFAULT 1,
      theme_id TEXT DEFAULT 'islamic-elegant',
      groom_name TEXT DEFAULT 'Ahmad Fadillah',
      groom_nickname TEXT DEFAULT 'Ahmad',
      groom_parents TEXT DEFAULT 'Putra pertama dari Bpk. Ir. H. Mansyur & Ibu Hj. Siti Fatimah',
      groom_photo TEXT DEFAULT '',
      bride_name TEXT DEFAULT 'Aisyah Rahma',
      bride_nickname TEXT DEFAULT 'Aisyah',
      bride_parents TEXT DEFAULT 'Putri kedua dari Bpk. H. Rahmat Hidayat & Ibu Hj. Nur Hasanah',
      bride_photo TEXT DEFAULT '',
      event_date TEXT DEFAULT '2026-12-12',
      akad_date TEXT DEFAULT 'Sabtu, 12 Desember 2026',
      akad_time TEXT DEFAULT '08.00 WIB',
      akad_location TEXT DEFAULT 'Masjid Raya Al-Ikhlas',
      akad_address TEXT DEFAULT 'Jl. Mawar Melati No. 12, Jakarta Selatan',
      akad_map_url TEXT DEFAULT 'https://maps.google.com',
      resepsi_date TEXT DEFAULT 'Sabtu, 12 Desember 2026',
      resepsi_time TEXT DEFAULT '11.00 WIB',
      resepsi_location TEXT DEFAULT 'Grand Ballroom Sasana Kriya',
      resepsi_address TEXT DEFAULT 'Taman Mini Indonesia Indah, Jakarta Timur',
      resepsi_map_url TEXT DEFAULT 'https://maps.google.com',
      events_data TEXT DEFAULT '[]',
      bismillah_enabled INTEGER DEFAULT 1,
      salam_opening TEXT DEFAULT 'Assalamu''alaikum Warahmatullahi Wabarakatuh',
      opening_text TEXT DEFAULT 'Dengan memohon rahmat dan ridho Allah Subhanahu Wa Ta''ala, kami bermaksud mengundang Bapak/Ibu/Saudara/i untuk menghadiri syukuran pernikahan kami:',
      quote_enabled INTEGER DEFAULT 1,
      quote_arabic TEXT DEFAULT 'وَمِنْ آيَاتِهِ أَنْ خَلَقَ لَكُم مِّنْ أَنفُسِكُمْ أَزْوَاجًا لِّتَسْكُنُوا إِلَيْهَا وَجَعَلَ بَيْنَكُم مَّوَدَّةً وَرَحْمَةً',
      quote_text TEXT DEFAULT 'Dan di antara tanda-tanda kekuasaan-Nya ialah Dia menciptakan untukmu pasangan hidup dari jenismu sendiri, supaya kamu merasa tenteram kepadanya, dan dijadikan-Nya di antaramu rasa kasih dan sayang.',
      quote_source TEXT DEFAULT 'QS. Ar-Rum: 21',
      closing_title TEXT DEFAULT 'Jazakumullahu Khairan Katsiran',
      closing_text TEXT DEFAULT 'Merupakan suatu kehormatan dan kebahagiaan bagi kami apabila Bapak/Ibu/Saudara/i berkenan hadir dan memberikan doa restu kepada kami.',
      closing_salam TEXT DEFAULT 'Wassalamu''alaikum Warahmatullahi Wabarakatuh',
      section_countdown_enabled INTEGER DEFAULT 1,
      section_story_enabled INTEGER DEFAULT 1,
      section_gallery_enabled INTEGER DEFAULT 1,
      section_gift_enabled INTEGER DEFAULT 1,
      section_rsvp_enabled INTEGER DEFAULT 1,
      section_wishes_enabled INTEGER DEFAULT 1,
      love_story TEXT DEFAULT '[]',
      gallery_photos TEXT DEFAULT '[]',
      music_url TEXT DEFAULT 'https://cdn.pixabay.com/download/audio/2022/05/27/audio_1808fbf07a.mp3?filename=romantic-wedding-113880.mp3',
      bank_accounts TEXT DEFAULT '[]',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS guests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      invitation_id INTEGER NOT NULL REFERENCES invitations(id) ON DELETE CASCADE,
      guest_token TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      phone TEXT DEFAULT '',
      category TEXT DEFAULT 'Tamu Undangan',
      attendance_status TEXT DEFAULT 'pending',
      total_pax INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS wishes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      invitation_id INTEGER NOT NULL REFERENCES invitations(id) ON DELETE CASCADE,
      guest_id INTEGER REFERENCES guests(id) ON DELETE SET NULL,
      sender_name TEXT NOT NULL,
      message TEXT NOT NULL,
      attendance TEXT DEFAULT 'hadir',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Safe incremental migration helper
  const addColumnIfNotExists = (colDef) => {
    try {
      db.exec(`ALTER TABLE invitations ADD COLUMN ${colDef}`);
    } catch (e) {
      // Column already exists, safe to ignore
    }
  };

  addColumnIfNotExists("events_data TEXT DEFAULT '[]'");
  addColumnIfNotExists("bismillah_enabled INTEGER DEFAULT 1");
  addColumnIfNotExists("salam_opening TEXT DEFAULT 'Assalamu''alaikum Warahmatullahi Wabarakatuh'");
  addColumnIfNotExists("opening_text TEXT DEFAULT 'Dengan memohon rahmat dan ridho Allah Subhanahu Wa Ta''ala, kami bermaksud mengundang Bapak/Ibu/Saudara/i untuk menghadiri syukuran pernikahan kami:'");
  addColumnIfNotExists("quote_enabled INTEGER DEFAULT 1");
  addColumnIfNotExists("quote_arabic TEXT DEFAULT 'وَمِنْ آيَاتِهِ أَنْ خَلَقَ لَكُم مِّنْ أَنفُسِكُمْ أَزْوَاجًا لِّتَسْكُنُوا إِلَيْهَا وَجَعَلَ بَيْنَكُم مَّوَدَّةً وَرَحْمَةً'");
  addColumnIfNotExists("closing_title TEXT DEFAULT 'Jazakumullahu Khairan Katsiran'");
  addColumnIfNotExists("closing_text TEXT DEFAULT 'Merupakan suatu kehormatan dan kebahagiaan bagi kami apabila Bapak/Ibu/Saudara/i berkenan hadir dan memberikan doa restu kepada kami.'");
  addColumnIfNotExists("closing_salam TEXT DEFAULT 'Wassalamu''alaikum Warahmatullahi Wabarakatuh'");
  addColumnIfNotExists("section_countdown_enabled INTEGER DEFAULT 1");
  addColumnIfNotExists("section_story_enabled INTEGER DEFAULT 1");
  addColumnIfNotExists("section_gallery_enabled INTEGER DEFAULT 1");
  addColumnIfNotExists("section_gift_enabled INTEGER DEFAULT 1");
  addColumnIfNotExists("section_rsvp_enabled INTEGER DEFAULT 1");
  addColumnIfNotExists("section_wishes_enabled INTEGER DEFAULT 1");

  // Check admin
  const adminStmt = db.prepare('SELECT id FROM admins WHERE username = ?');
  const admin = adminStmt.get('admin');
  if (!admin) {
    const insertAdmin = db.prepare('INSERT INTO admins (username, password_hash) VALUES (?, ?)');
    insertAdmin.run('admin', hashPassword('admin123'));
    console.log('[DB] Default admin seeded: ID=admin, Pass=admin123');
  }

  // Create demo invitation if empty
  const countInvitations = db.prepare('SELECT COUNT(*) as count FROM invitations').get();
  if (countInvitations.count === 0) {
    const defaultLoveStory = JSON.stringify([
      { year: '2022', title: 'Awal Pertemuan', desc: 'Dipertemukan dalam kegiatan kajian dan ikhtiar silaturahmi keluarga yang penuh berkah.' },
      { year: '2024', title: 'Lamaran Khidmat', desc: 'Mengikat niat suci dalam khitbah keluarga dengan doa dan restu kedua orang tua.' },
      { year: '2026', title: 'Menuju Hari Bahagia', desc: 'Melangkah mantap menuju ikatan suci pernikahan sakinah, mawaddah, warahmah.' }
    ]);
    const defaultGallery = JSON.stringify([
      'https://images.unsplash.com/photo-1583939003579-730e3918a45a?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1519741497674-611481863552?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1511285560929-80b456fea0bc?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1532712938310-34cb3982ef74?w=800&auto=format&fit=crop&q=80'
    ]);
    const defaultBank = JSON.stringify([
      { bank_name: 'Bank Syariah Indonesia (BSI)', account_number: '7123456789', account_holder: 'Ahmad Fadillah' },
      { bank_name: 'Bank Mandiri', account_number: '1400019283746', account_holder: 'Aisyah Rahma' }
    ]);

    const demoManagementToken = 'AbC82xP92LmK7nQ4';
    const insertInv = db.prepare(`
      INSERT INTO invitations (
        slug, title, management_token, is_active, theme_id,
        groom_name, groom_nickname, groom_parents, groom_photo,
        bride_name, bride_nickname, bride_parents, bride_photo,
        event_date, akad_date, akad_time, akad_location, akad_address,
        resepsi_date, resepsi_time, resepsi_location, resepsi_address,
        quote_text, quote_source,
        love_story, gallery_photos, bank_accounts
      ) VALUES (
        ?, ?, ?, 1, 'islamic-elegant',
        'Ahmad Fadillah', 'Ahmad', 'Putra pertama dari Bpk. Ir. H. Mansyur & Ibu Hj. Siti Fatimah', 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=600',
        'Aisyah Rahma', 'Aisyah', 'Putri kedua dari Bpk. H. Rahmat Hidayat & Ibu Hj. Nur Hasanah', 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=600',
        '2026-12-12', 'Sabtu, 12 Desember 2026', '08.00 WIB', 'Masjid Raya Al-Ikhlas', 'Jl. Mawar Melati No. 12, Jakarta Selatan',
        'Sabtu, 12 Desember 2026', '11.00 WIB', 'Grand Ballroom Sasana Kriya', 'Taman Mini Indonesia Indah, Jakarta Timur',
        'Dan di antara tanda-tanda kekuasaan-Nya ialah Dia menciptakan untukmu pasangan hidup dari jenismu sendiri, supaya kamu merasa tenteram kepadanya, dan dijadikan-Nya di antaramu rasa kasih dan sayang.',
        'QS. Ar-Rum: 21',
        ?, ?, ?
      )
    `);
    const invResult = insertInv.run(
      'wedding-ahmad-aisyah',
      'The Wedding of Ahmad & Aisyah',
      demoManagementToken,
      defaultLoveStory,
      defaultGallery,
      defaultBank
    );
    const invId = invResult.lastInsertRowid;

    // Seed sample guests
    const insertGuest = db.prepare(`
      INSERT INTO guests (invitation_id, guest_token, name, category)
      VALUES (?, ?, ?, ?)
    `);
    const g1 = insertGuest.run(invId, 'X7mQa9', 'Bapak Dr. H. Ahmad & Keluarga', 'VIP');
    const g2 = insertGuest.run(invId, 'K82Lp3', 'Budi Santoso & Partner', 'Sahabat');
    const g3 = insertGuest.run(invId, 'Q91Mn7', 'Citra Lestari, S.Kom', 'Rekan Kerja');

    // Seed sample wishes
    const insertWish = db.prepare(`
      INSERT INTO wishes (invitation_id, guest_id, sender_name, message, attendance)
      VALUES (?, ?, ?, ?, ?)
    `);
    insertWish.run(invId, g1.lastInsertRowid, 'Bapak Dr. H. Ahmad', 'Barakallahu lakum wa baraka alaikum wa jama\'a bainakuma fi khair. Semoga ananda Ahmad dan Aisyah menjadi keluarga sakinah, mawaddah, warahmah.', 'hadir');
    insertWish.run(invId, g2.lastInsertRowid, 'Budi Santoso', 'Selamat berbahagia Ahmad & Aisyah! Semoga dilancarkan sampai hari H dan senantiasa penuh berkah.', 'hadir');

    console.log('[DB] Seeded demo invitation (Islamic Elegant):');
    console.log('     Management Link: /manage/' + demoManagementToken);
    console.log('     Guest Link:      /u/wedding-ahmad-aisyah/X7mQa9');
  }
}

module.exports = {
  db,
  initDb,
  hashPassword,
  verifyPassword,
  generateToken
};

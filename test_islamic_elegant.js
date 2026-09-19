const http = require('node:http');

function request(options, data = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(body);
          resolve({ status: res.statusCode, headers: res.headers, body: json });
        } catch (e) {
          resolve({ status: res.statusCode, headers: res.headers, body });
        }
      });
    });
    req.on('error', reject);
    if (data) {
      req.write(typeof data === 'string' ? data : JSON.stringify(data));
    }
    req.end();
  });
}

async function runTests() {
  console.log('--- STARTING VERIFICATION: ISLAMIC ELEGANT THEME & SYSTEM ---');
  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`[PASS] ${message}`);
      passed++;
    } else {
      console.error(`[FAIL] ${message}`);
      failed++;
    }
  }

  try {
    // 1. Check Root Portal
    const portal = await request({ hostname: 'localhost', port: 3000, path: '/', method: 'GET' });
    assert(portal.status === 200, 'Portal Landing Page returns HTTP 200');

    // 2. Check Tenant Management Data
    const manageRes = await request({
      hostname: 'localhost',
      port: 3000,
      path: '/api/manage/AbC82xP92LmK7nQ4',
      method: 'GET'
    });
    assert(manageRes.status === 200 && manageRes.body.success, 'GET /api/manage/:token returns HTTP 200 and success');
    const inv = manageRes.body.invitation;
    assert(inv.theme_id === 'islamic-elegant', `Default theme is islamic-elegant (got: ${inv.theme_id})`);
    assert(inv.groom_name === 'Ahmad Fadillah', `Groom name is Ahmad Fadillah (got: ${inv.groom_name})`);
    assert(inv.bride_name === 'Aisyah Rahma', `Bride name is Aisyah Rahma (got: ${inv.bride_name})`);
    assert(inv.quote_source === 'QS. Ar-Rum: 21', `Quote source is QS. Ar-Rum: 21 (got: ${inv.quote_source})`);
    assert(inv.bismillah_enabled === 1, 'Bismillah enabled by default');

    // 3. Check Guest Link
    const guestRes = await request({
      hostname: 'localhost',
      port: 3000,
      path: '/api/u/wedding-ahmad-aisyah/X7mQa9',
      method: 'GET'
    });
    assert(guestRes.status === 200 && guestRes.body.success, 'GET /api/u/:slug/:token returns HTTP 200');
    assert(guestRes.body.guest.name === 'Bapak Dr. H. Ahmad & Keluarga', `Guest personalized name is correct (${guestRes.body.guest.name})`);
    assert(guestRes.body.invitation.theme_id === 'islamic-elegant', 'Guest invitation reflects islamic-elegant theme');

    // 4. Update Invitation via Tenant Editor
    const updateRes = await request({
      hostname: 'localhost',
      port: 3000,
      path: '/api/manage/AbC82xP92LmK7nQ4',
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' }
    }, {
      quote_text: 'Dan di antara tanda-tanda kekuasaan-Nya ialah Dia menciptakan untukmu pasangan hidup...',
      closing_title: 'Jazakumullahu Khairan Katsiran'
    });
    assert(updateRes.status === 200 && updateRes.body.success, 'PUT /api/manage/:token autosave updates successfully');

    // 5. Submit RSVP from Guest
    const rsvpRes = await request({
      hostname: 'localhost',
      port: 3000,
      path: '/api/u/wedding-ahmad-aisyah/X7mQa9/rsvp',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, {
      attendance_status: 'hadir',
      total_pax: 2
    });
    assert(rsvpRes.status === 200 && rsvpRes.body.success, 'POST RSVP submitted successfully');

    // 6. Submit Wish from Guest
    const wishRes = await request({
      hostname: 'localhost',
      port: 3000,
      path: '/api/u/wedding-ahmad-aisyah/X7mQa9/wishes',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, {
      sender_name: 'Bapak Dr. H. Ahmad & Keluarga',
      message: 'Barakallahu lakuma wa baraka alaikuma wa jama\'a bainakuma fi khair.',
      attendance: 'hadir'
    });
    assert(wishRes.status === 200 && wishRes.body.success, 'POST Wish submitted successfully');

    // 7. Verify Theme Switch Preservation (RULE 12)
    const switchThemeRes = await request({
      hostname: 'localhost',
      port: 3000,
      path: '/api/manage/AbC82xP92LmK7nQ4/theme',
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' }
    }, {
      theme_id: 'rose-gold'
    });
    assert(switchThemeRes.status === 200 && switchThemeRes.body.success, 'Switch theme to rose-gold succeeds');

    // Verify data remains intact
    const checkInv = await request({
      hostname: 'localhost',
      port: 3000,
      path: '/api/manage/AbC82xP92LmK7nQ4',
      method: 'GET'
    });
    assert(checkInv.body.invitation.groom_name === 'Ahmad Fadillah', 'Groom name preserved after theme change');

    // Switch back to islamic-elegant
    const switchBackRes = await request({
      hostname: 'localhost',
      port: 3000,
      path: '/api/manage/AbC82xP92LmK7nQ4/theme',
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' }
    }, {
      theme_id: 'islamic-elegant'
    });
    assert(switchBackRes.status === 200 && switchBackRes.body.success, 'Switched back to islamic-elegant');

  } catch (err) {
    console.error('Test execution error:', err);
    failed++;
  }

  console.log(`\n--- TEST SUMMARY: ${passed} PASSED, ${failed} FAILED ---`);
  process.exit(failed > 0 ? 1 : 0);
}

runTests();

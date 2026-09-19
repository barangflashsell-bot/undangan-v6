const express = require('express');
const path = require('node:path');
const cookieParser = require('cookie-parser');
const { initDb } = require('./src/db');
const { adminAuth, tenantAuth, guestResolver } = require('./src/middleware/auth');

const adminRoutes = require('./src/routes/admin');
const manageRoutes = require('./src/routes/manage');
const guestRoutes = require('./src/routes/guest');

const app = express();
const PORT = process.env.PORT || 3000;

// Initialize database
initDb();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Static assets
app.use(express.static(path.join(__dirname, 'public')));

// API Routes
app.use('/api/admin', adminRoutes);
app.use('/api/manage', manageRoutes);
app.use('/api/u', guestRoutes);

// View Routes
// 1. Admin Login View
app.get('/admin/login', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin-login.html'));
});

// 2. Admin Dashboard View (Protected)
app.get('/admin', adminAuth, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin-dashboard.html'));
});

// 3. Tenant Management View (RULE 2: NO LOGIN / NO PASSWORD, validates managementToken)
app.get('/manage/:managementToken', tenantAuth, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'manage.html'));
});

// 4. Guest View (RULE 3 & 10: NO LOGIN / NO REGISTRATION, validates slug & guestToken)
app.get('/u/:slug/:guestToken?', guestResolver, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'invitation.html'));
});

// Root route
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start Server
app.listen(PORT, () => {
  console.log(`====================================================`);
  console.log(`  UNDANGAN DIGITAL V6 RUNNING AT http://localhost:${PORT}`);
  console.log(`  Tema: Islamic Elegant (Emerald & Soft Gold)`);
  console.log(`  1. Portal Utama:    http://localhost:${PORT}/`);
  console.log(`  2. Admin Panel:     http://localhost:${PORT}/admin/login`);
  console.log(`  3. Management Demo: http://localhost:${PORT}/manage/AbC82xP92LmK7nQ4`);
  console.log(`  4. Guest Link VIP:  http://localhost:${PORT}/u/wedding-ahmad-aisyah/X7mQa9`);
  console.log(`====================================================`);
});

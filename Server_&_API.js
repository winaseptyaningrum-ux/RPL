const express = require('express');
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = 3000;
const JWT_SECRET = 'campus_blood_emergency_secret_key_2026';

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Konfigurasi koneksi ke MySQL yang sudah ada
const pool = mysql.createPool({
  host: 'localhost',
  user: 'root',        // Sesuaikan dengan user MySQL Anda
  password: '',        // Sesuaikan dengan password MySQL Anda
  database: 'campus_blood_emergency',
  waitForConnections: true,
  connectionLimit: 10
});

// Middleware verifikasi JWT Token
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ message: 'Akses ditolak, token tidak ditemukan.' });

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ message: 'Token tidak valid atau kedaluwarsa.' });
    req.user = user;
    next();
  });
}

// 1. POST /api/register -> Daftar akun baru ke tabel `users`
app.post('/api/register', async (req, res) => {
  const { email_kampus, password } = req.body;

  if (!email_kampus || !password) {
    return res.status(400).json({ message: 'Email kampus dan password wajib diisi.' });
  }

  try {
    // Cek apakah email sudah terdaftar
    const [existing] = await pool.execute(
      'SELECT id_user FROM users WHERE email_kampus = ?',
      [email_kampus.trim()]
    );

    if (existing.length > 0) {
      return res.status(409).json({ message: 'Email kampus sudah terdaftar. Silakan masuk.' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Simpan ke tabel users
    const [result] = await pool.execute(
      'INSERT INTO users (email_kampus, password) VALUES (?, ?)',
      [email_kampus.trim(), hashedPassword]
    );

    const token = jwt.sign(
      { id_user: result.insertId, email_kampus: email_kampus.trim() },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.status(201).json({
      message: 'Registrasi berhasil!',
      token,
      user: { id_user: result.insertId, email_kampus: email_kampus.trim() },
      hasProfile: false
    });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ message: 'Terjadi kesalahan pada server.' });
  }
});

// 2. POST /api/login -> Autentikasi ke `users` & cek profil di `pendonor`
app.post('/api/login', async (req, res) => {
  const { email_kampus, password } = req.body;

  if (!email_kampus || !password) {
    return res.status(400).json({ message: 'Email kampus dan password wajib diisi.' });
  }

  try {
    const [users] = await pool.execute(
      'SELECT * FROM users WHERE email_kampus = ?',
      [email_kampus.trim()]
    );

    if (users.length === 0) {
      return res.status(401).json({ message: 'Email kampus atau password salah.' });
    }

    const user = users[0];
    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res.status(401).json({ message: 'Email kampus atau password salah.' });
    }

    // Cek apakah profil pendonor sudah ada
    const [pendonorRows] = await pool.execute(
      'SELECT * FROM pendonor WHERE user_id = ?',
      [user.id_user]
    );

    const token = jwt.sign(
      { id_user: user.id_user, email_kampus: user.email_kampus },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      message: 'Login berhasil!',
      token,
      user: { id_user: user.id_user, email_kampus: user.email_kampus },
      hasProfile: pendonorRows.length > 0,
      profil: pendonorRows[0] || null
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Terjadi kesalahan pada server.' });
  }
});

// 3. GET /api/profil -> Ambil data pendonor milik user yang sedang login
app.get('/api/profil', authenticateToken, async (req, res) => {
  try {
    const [rows] = await pool.execute(
      'SELECT * FROM pendonor WHERE user_id = ?',
      [req.user.id_user]
    );

    if (rows.length === 0) {
      return res.json({ hasProfile: false, profil: null });
    }

    res.json({ hasProfile: true, profil: rows[0] });
  } catch (error) {
    console.error('Get profil error:', error);
    res.status(500).json({ message: 'Gagal mengambil data profil.' });
  }
});

// 4. POST /api/profil -> Simpan (INSERT) atau Perbarui (UPDATE) data di tabel `pendonor`
app.post('/api/profil', authenticateToken, async (req, res) => {
  const {
    nama_lengkap,
    nim_id_civitas,
    no_telepon,
    fakultas_unit,
    golongan_darah,
    bersedia_donor
  } = req.body;

  if (!nama_lengkap || !nim_id_civitas || !no_telepon || !fakultas_unit) {
    return res.status(400).json({ message: 'Semua kolom identitas wajib diisi.' });
  }

  const validGolongan = ['A', 'B', 'AB', 'O', 'Belum Tahu'];
  const goldar = validGolongan.includes(golongan_darah) ? golongan_darah : 'Belum Tahu';
  const bersedia = bersedia_donor ? 1 : 0;

  try {
    const [existing] = await pool.execute(
      'SELECT id_pendonor FROM pendonor WHERE user_id = ?',
      [req.user.id_user]
    );

    if (existing.length > 0) {
      // Update profil yang sudah ada
      await pool.execute(
        `UPDATE pendonor 
         SET nama_lengkap = ?, nim_id_civitas = ?, no_telepon = ?, 
             fakultas_unit = ?, golongan_darah = ?, bersedia_donor = ?, update_at = CURRENT_TIMESTAMP
         WHERE user_id = ?`,
        [nama_lengkap.trim(), nim_id_civitas.trim(), no_telepon.trim(), fakultas_unit.trim(), goldar, bersedia, req.user.id_user]
      );
    } else {
      // Insert profil baru
      await pool.execute(
        `INSERT INTO pendonor 
         (user_id, nama_lengkap, nim_id_civitas, no_telepon, fakultas_unit, golongan_darah, bersedia_donor) 
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [req.user.id_user, nama_lengkap.trim(), nim_id_civitas.trim(), no_telepon.trim(), fakultas_unit.trim(), goldar, bersedia]
      );
    }

    const [updated] = await pool.execute(
      'SELECT * FROM pendonor WHERE user_id = ?',
      [req.user.id_user]
    );

    res.json({
      message: 'Profil pendonor berhasil disimpan',
      profil: updated[0]
    });
  } catch (error) {
    console.error('Save profil error:', error);
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ message: 'NIM / ID Civitas sudah terdaftar pada akun lain.' });
    }
    res.status(500).json({ message: 'Gagal menyimpan profil pendonor.' });
  }
});

app.listen(PORT, () => {
  console.log(`Server Campus Blood Emergency berjalan di http://localhost:${PORT}`);
});
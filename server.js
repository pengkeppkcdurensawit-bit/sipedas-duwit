process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const express = require('express');
const { Pool } = require('pg');
const path = require('path');
const app = express();
// ... sisa kode di bawahnya biarkan saja seperti biasa

// Middleware wajib untuk membaca JSON dan berkas statis
app.use(express.json());
app.use(express.static('public'));

// ===================================================
// KONEKSI DATABASE (Inisialisasi Terlebih Dahulu)
// ===================================================
const db = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false,
    checkServerIdentity: () => undefined
  }
});

// ===================================================
// RUTE PROSES LOGIN (VERSI AMAN & ANTI-UNDEFINED)
// ===================================================
app.post('/api/login', async (req, res) => {
  // Menangkap 'username' atau 'jabatan' dari frontend agar fleksibel dan tidak memicu 'undefined'
  const namaJabatan = req.body.username || req.body.jabatan;
  const kataSandi = req.body.password;

  if (!namaJabatan) {
    return res.json({ success: false, message: 'Pilihan jabatan tidak terbaca oleh sistem!' });
  }

  if (kataSandi === 'pusk2024') {
    try {
      const result = await db.query('SELECT * FROM pegawai WHERE jabatan = $1', [namaJabatan]);
      
      if (result.rows.length > 0) {
        // Mengirimkan semua kemungkinan format variabel (role, jabatan, dll) agar cocok dengan login.html Anda
        return res.json({ 
          success: true, 
          role: result.rows[0].jabatan,
          jabatan: result.rows[0].jabatan 
        });
      } else {
        return res.json({ success: false, message: `Jabatan '${namaJabatan}' tidak terdaftar di database!` });
      }
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  } else {
    return res.json({ success: false, message: 'Kata Sandi Salah!' });
  }
});

// ===================================================
// INTEGRASI API DATA (SUPABASE)
// ===================================================

// 1. AMBIL SEMUA SURAT KELUAR (Untuk Dashboard)
app.get('/api/surat-keluar-all', async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM surat_keluar ORDER BY id DESC');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 2. AMBIL SURAT MASUK BELUM DIDISPOSISI
app.get('/api/surat-belum-disposisi', async (req, res) => {
  try {
    const result = await db.query("SELECT * FROM surat_masuk WHERE status = 'Menunggu Disposisi' ORDER BY id DESC");
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 3. UPDATE STATUS / TINDAKAN SURAT KELUAR
app.post('/api/update-status-surat-keluar', async (req, res) => {
  const { id, status_terakhir, catatan_kasubbag, nomor_surat_resmi } = req.body;
  try {
    const query = `
      UPDATE surat_keluar 
      SET status_terakhir = $1, catatan_kasubbag = $2, nomor_surat_resmi = $3 
      WHERE id = $4
    `;
    await db.query(query, [status_terakhir, catatan_kasubbag, nomor_surat_resmi, id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 4. SIMPAN DISPOSISI SURAT MASUK
app.post('/api/simpan-disposisi', async (req, res) => {
  const { id_surat, disposisi_ke, catatan_disposisi } = req.body;
  try {
    const query = `
      UPDATE surat_masuk 
      SET status = 'Sudah Didisposisi', disposisi_ke = $1, catatan_disposisi = $2 
      WHERE id = $3
    `;
    await db.query(query, [disposisi_ke, catatan_disposisi, id_surat]);
    res.redirect('/kasubbag.html?status=sukses');
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 5. AMBIL DATA PEGAWAI
app.get('/api/pegawai', async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM pegawai');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ===================================================
// MANAJEMEN ROUTING HALAMAN HTML (Untuk Serverless Vercel)
// ===================================================

// Menangkap semua request berakhiran .html agar diarahkan ke folder public
app.get('/:page.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', `${req.params.page}.html`));
});

// Halaman utama (/) otomatis menyajikan login.html sebagai gerbang pertama
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

// Ekspor aplikasi agar dikenali oleh runtime Node.js Vercel
module.exports = app;

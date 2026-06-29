process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const express = require('express');
const { Pool } = require('pg');
const path = require('path');
const app = express();

// 1. MIDDLEWARE WAJIB (Membaca JSON & Melayani Berkas Tampilan HTML/CSS/JS)
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// 2. KONEKSI DATABASE (SUPABASE VIA TRANSACTION POOLER)
const db = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false,
    checkServerIdentity: () => undefined
  }
});

// 3. RUTE PROSES LOGIN (API)
app.post('/api/login', async (req, res, next) => {
  const namaJabatan = req.body.username || req.body.jabatan;
  const kataSandi = req.body.password;

  if (!namaJabatan) {
    return res.json({ success: false, message: 'Pilihan jabatan tidak terbaca oleh sistem!' });
  }

  if (kataSandi === 'pusk2024') {
    try {
      const result = await db.query('SELECT * FROM pegawai WHERE jabatan = $1', [namaJabatan]);
      if (result.rows.length > 0) {
        const pegawai = result.rows[0];
        
        return res.json({
          success: true,
          role: pegawai.jabatan,
          jabatan: pegawai.jabatan,
          nama_pegawai: pegawai.nama_pegawai,
          user: {
            id: pegawai.id,
            nama_pegawai: pegawai.nama_pegawai,
            role: pegawai.jabatan,
            jabatan: pegawai.jabatan
          }
        });
      } else {
        return res.json({ success: false, message: `Jabatan '${namaJabatan}' tidak terdaftar di database!` });
      }
    } catch (err) {
      next(err); // Diteruskan ke Global Error Handler agar tidak crash
    }
  } else {
    return res.json({ success: false, message: 'Kata Sandi Salah!' });
  }
});

// 4. INTEGRASI API DATA SURAT
app.get('/api/surat-keluar-all', async (req, res, next) => {
  try {
    const result = await db.query('SELECT * FROM surat_keluar ORDER BY id DESC');
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

app.get('/api/surat-belum-disposisi', async (req, res, next) => {
  try {
    const result = await db.query("SELECT * FROM surat_masuk WHERE status = 'Menunggu Disposisi' ORDER BY id DESC");
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

app.post('/api/update-status-surat-keluar', async (req, res, next) => {
  const { id, status_terakhir, catatan_kasubbag, nomor_surat_resmi } = req.body;
  try {
    const query = `
      UPDATE surat_keluar 
      SET status_terakhir = $1, catatan_kasubbag = $2, nomor_surat_resmi = $3 
      WHERE id = $4 
      RETURNING *`;
    const result = await db.query(query, [status_terakhir, catatan_kasubbag, nomor_surat_resmi, id]);
    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    next(err);
  }
});

// 5. FALLBACK ROUTE (Menyajikan halaman login.html jika rute tidak dikenal)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

// 6. GLOBAL ERROR HANDLER (Pengaman utama agar serverless Vercel tidak pernah mati/crash)
app.use((err, req, res, next) => {
  console.error('Sistem Error:', err.message);
  res.status(500).json({
    success: false,
    message: 'Terjadi kesalahan internal pada serverless function.',
    error: err.message
  });
});

module.exports = app;

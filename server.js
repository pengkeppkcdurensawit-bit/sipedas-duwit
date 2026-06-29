process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const express = require('express');
const { Pool } = require('pg');
const path = require('path');
const app = express();

// Middleware wajib untuk membaca JSON dan berkas statis aman di Vercel
app.use(express.json());
app.use(express.static(path.join(process.cwd(), 'public')));

// ===================================================
// KONEKSI DATABASE (SUPABASE VIA TRANSACTION POOLER)
// ===================================================
const db = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false,
    checkServerIdentity: () => undefined
  }
});

// ===================================================
// RUTE PROSES LOGIN (SINKRON DENGAN LOCALSTORAGE FRONTEND)
// ===================================================
app.post('/api/login', async (req, res) => {
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
      return res.status(500).json({ success: false, message: err.message });
    }
  } else {
    return res.json({ success: false, message: 'Kata Sandi Salah!' });
  }
});

// ===================================================
// INTEGRASI API DATA SURAT
// ===================================================

app.get('/api/surat-keluar-all', async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM surat_keluar ORDER BY id DESC');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/surat-belum-disposisi', async (req, res) => {
  try {
    const result = await db.query("SELECT * FROM surat_masuk WHERE status = 'Menunggu Disposisi' ORDER BY id DESC");
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/update-status-surat-keluar', async (req, res) => {
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
    res.status(500).json({ success: false, error: err.message });
  }
});

// Fallback routing menggunakan process.cwd() agar path file terbaca di Vercel
app.get('*', (req, res) => {
  res.sendFile(path.join(process.cwd(), 'public', 'login.html'));
});

// Menjalankan Server secara kondisional (Hanya aktif jika dijalankan di komputer lokal)
if (process.env.NODE_ENV !== 'production') {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

module.exports = app;

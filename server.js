const express = require('express');
const { Pool } = require('pg');
const app = express();

app.use(express.json());
app.use(express.static('public'));

// Koneksi ke Supabase PostgreSQL
const db = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

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

// Vercel memerlukan 'module.exports'
module.exports = app;
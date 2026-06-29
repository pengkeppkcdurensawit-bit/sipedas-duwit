const express = require('express');
const { Pool } = require('pg');
const app = express();

app.use(express.json());
app.use(express.static('public'));

// ==========================================
// RUTE PROSES LOGIN (TAMBAHKAN INI)
// ==========================================
app.post('/api/login', async (req, res) => {
  const { username, password } = req.body; // Mengambil input dari halaman login

  // Verifikasi kata sandi standar puskesmas Anda
  if (password === 'pusk2024') {
    try {
      // Memeriksa apakah jabatan tersebut ada di tabel pegawai Supabase
      const result = await db.query('SELECT * FROM pegawai WHERE jabatan = $1', [username]);
      
      if (result.rows.length > 0) {
        // Jika cocok, kirim tanda sukses ke halaman login.html
        return res.json({ success: true, role: result.rows[0].jabatan });
      } else {
        return res.json({ success: false, message: 'Jabatan tidak ditemukan di database!' });
      }
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  } else {
    return res.json({ success: false, message: 'Kata Sandi Salah!' });
  }
});

// Koneksi ke Supabase PostgreSQL
const db = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// ==========================================
// RUTE AUTHENTICATION LOGIN (Tambahkan Ini!)
// ==========================================
app.post('/api/login', async (req, res) => {
  const { jabatan, password } = req.body;

  // Sesuai dengan password standar puskesmas Anda
  if (password === 'pusk2024') { 
    try {
      const result = await db.query('SELECT * FROM pegawai WHERE jabatan = $1', [jabatan]);
      if (result.rows.length > 0) {
        return res.json({ success: true, jabatan: result.rows[0].jabatan });
      } else {
        return res.status(404).json({ error: 'Jabatan tidak terdaftar di database' });
      }
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  } else {
    return res.status(401).json({ error: 'Kata Sandi Salah!' });
  }
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

// Tambahkan ini di bagian paling bawah server.js (sebelum module.exports = app)
const path = require('path');

// Menangkap semua halaman HTML agar disajikan dengan benar oleh Express di Vercel
app.get('/:page.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', `${req.params.page}.html`));
});

// Halaman utama otomatis mengarah ke login atau kasubbag
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'kasubbag.html'));
});

// Vercel memerlukan 'module.exports'
module.exports = app;

// Vercel memerlukan 'module.exports'
module.exports = app;

const { Pool } = require('pg');

// Menggunakan Environment Variable untuk keamanan (tidak menaruh password langsung di kode)
const db = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false // Diperlukan untuk koneksi ke Supabase
  }
});

// Contoh fungsi query yang perlu diubah dari .all() atau .run() SQLite ke .query() PostgreSQL:
// SQLite: db.all("SELECT * FROM surat", (err, rows) => { ... })
// PostgreSQL: 
// db.query("SELECT * FROM surat", (err, res) => { 
//    if (err) throw err;
//    const rows = res.rows;
//    ...
// });

// Middleware untuk memproses data dari Form dan JSON Fetch
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Melayani file statis dari folder 'public' (HTML, JS, CSS)
app.use(express.static(path.join(__dirname, 'public')));

// ========================================================
// 1. DATABASE SETUP & INITIALIZATION
// ========================================================
const db = new sqlite3.Database('./sipedas_duwit.db', (err) => {
    if (err) console.error("Gagal terhubung ke database:", err.message);
    else console.log("Terhubung ke database SQLite sipedas_duwit.db");
});

// Struktur Tabel Utama Aplikasi (Masuk & Keluar)
db.serialize(() => {
    // [SURAT MASUK] Tabel Surat Masuk
    db.run(`CREATE TABLE IF NOT EXISTS surat_masuk (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nomor_surat TEXT,
        asal_surat TEXT,
        perihal TEXT,
        tanggal_surat TEXT,
        tanggal_terima TEXT,
        file_path TEXT,
        status_terakhir TEXT DEFAULT 'Baru Masuk',
        disposisi_ke TEXT,
        catatan_disposisi TEXT,
        disposisi_oleh TEXT,
        ttd_pimpinan TEXT
    )`);

    // [SURAT KELUAR] Tabel Utama Pencatatan Surat Keluar
    db.run(`CREATE TABLE IF NOT EXISTS surat_keluar (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nomor_antrean TEXT,
        nomor_surat_resmi TEXT DEFAULT 'Belum Diberikan',
        jenis_surat TEXT,
        pemohon_unit TEXT,
        perihal TEXT,
        tanggal_keluar TEXT,
        tujuan TEXT,
        keterangan TEXT,
        status_terakhir TEXT DEFAULT 'Menunggu Verifikasi Kasubbag'
    )`);

    // Tabel Histori Perjalanan Surat (Timeline Pelacakan Terpadu)
    db.run(`CREATE TABLE IF NOT EXISTS histori_perjalanan (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        id_surat INTEGER,
        tanggal_aksi TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        kategori TEXT, -- 'Masuk' atau 'Keluar'
        status TEXT,
        oleh_user TEXT
    )`);

    // Tabel Master Data Pegawai
    db.run(`CREATE TABLE IF NOT EXISTS pegawai (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nama_pegawai TEXT NOT NULL,
        jabatan TEXT NOT NULL
    )`, () => {
        db.get("SELECT COUNT(*) as total FROM pegawai", [], (err, row) => {
            if (row && row.total === 0) {
                db.run(`INSERT INTO pegawai (nama_pegawai, jabatan) VALUES 
                    ('dr. Shinta (Poli Gigi)', 'Dokter Gigi'),
                    ('Budianto, A.Md.Kep', 'Perawat Penyelia'),
                    ('Siti Aminah, S.KM', 'Sanitarian (Kesling)')`);
            }
        });
    });
});

// ========================================================
// 2. DATA OTENTIKASI AKUN INTERNAL (LOGIN RESMI)
// ========================================================
const DATA_PENGGUNA = {
    "tu_masuk": { password: "masuk123", nama: "Petugas Surat Masuk", redirect: "/tu_masuk.html" },
    "tu_keluar": { password: "keluar123", nama: "Petugas Surat Keluar", redirect: "/tu_keluar.html" },
    "kapus": { password: "kapus123", nama: "Kepala Puskesmas", redirect: "/kapus.html" },
    "kasubbag": { password: "tu456", nama: "Ka Subbag TU", redirect: "/kasubbag.html" },
    "admin": { password: "admin123", nama: "Super Admin", redirect: "/admin.html" }
};

// ========================================================
// 3. API ENDPOINTS (AUTHENTICATION & MASTER DATA)
// ========================================================

app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    if (DATA_PENGGUNA[username] && DATA_PENGGUNA[username].password === password) {
        res.json({
            sukses: true,
            peran: username,
            nama: DATA_PENGGUNA[username].nama,
            tujuan: DATA_PENGGUNA[username].redirect
        });
    } else {
        res.json({ sukses: false, pesan: "Kombinasi Hak Akses dan Kata Sandi tidak cocok!" });
    }
});

app.get('/api/pegawai', (req, res) => {
    db.all(`SELECT * FROM pegawai ORDER BY nama_pegawai ASC`, [], (err, rows) => {
        if (err) return res.status(500).json([]);
        res.json(rows);
    });
});

// ========================================================
// 4. API ENDPOINTS (MANAJEMEN SURAT MASUK)
// ========================================================

app.post('/api/tambah-surat', (req, res) => {
    const { nomor_surat, asal_surat, perihal, tanggal_surat, tanggal_terima, file_path } = req.body;
    db.run(`INSERT INTO surat_masuk (nomor_surat, asal_surat, perihal, tanggal_surat, tanggal_terima, file_path) VALUES (?, ?, ?, ?, ?, ?)`, 
    [nomor_surat, asal_surat, perihal, tanggal_surat, tanggal_terima, file_path], function(err) {
        if (err) return res.status(500).send("Gagal.");
        
        const idSurat = this.lastID;
        db.run(`INSERT INTO histori_perjalanan (id_surat, kategori, status, oleh_user) VALUES (?, 'Masuk', 'Surat berhasil diinput dan diarsipkan ke sistem', 'Petugas Surat Masuk')`, 
        [idSurat], () => {
            res.send(`<script>alert('Surat Masuk Berhasil Diarsipkan!'); window.location.href='/tu_masuk.html';</script>`);
        });
    });
});

app.get('/api/surat-belum-disposisi', (req, res) => {
    db.all(`SELECT id, perihal FROM surat_masuk WHERE status_terakhir = 'Baru Masuk'`, [], (err, rows) => {
        if (err) return res.status(500).json([]);
        res.json(rows);
    });
});

app.get('/api/surat-masuk-all', (req, res) => {
    db.all(`SELECT * FROM surat_masuk ORDER BY id DESC`, [], (err, rows) => {
        if (err) return res.status(500).json([]);
        res.json(rows);
    });
});

app.post('/api/simpan-disposisi', (req, res) => {
    const { id_surat, jabatan_pimpinan, status_plh, disposisi_ke, catatan_disposisi, ttd_pimpinan } = req.body;
    const status_baru = 'Diterima Kembali dari Kepala Puskesmas';
    const aktorPenandatangan = (status_plh === 'ya') ? `${jabatan_pimpinan} (Plh. Kepala Puskesmas)` : jabatan_pimpinan;

    db.run(`UPDATE surat_masuk SET status_terakhir = ?, disposisi_ke = ?, catatan_disposisi = ?, disposisi_oleh = ?, ttd_pimpinan = ? WHERE id = ?`, 
    [status_baru, disposisi_ke, catatan_disposisi, aktorPenandatangan, ttd_pimpinan, id_surat], function(err) {
        if (err) return res.status(500).send("Gagal.");

        const logMsg = `Surat didisposisi oleh ${aktorPenandatangan} kepada ${disposisi_ke} dengan catatan: "${catatan_disposisi}"`;
        db.run(`INSERT INTO histori_perjalanan (id_surat, kategori, status, oleh_user) VALUES (?, 'Masuk', ?, ?)`, 
        [id_surat, logMsg, aktorPenandatangan], () => {
            const targetRedir = (jabatan_pimpinan === 'Ka Subbag TU') ? '/kasubbag.html' : '/kapus.html';
            res.send(`<script>alert('Disposisi Digital Berhasil Dikunci!'); window.location.href='${targetRedir}';</script>`);
        });
    });
});

app.post('/api/serah-surat-pegawai', (req, res) => {
    const { id_surat, nama_penerima, ttd_penerima } = req.body;
    const status_akhir = 'Selesai Diserahkan ke Pegawai';

    db.run(`UPDATE surat_masuk SET status_terakhir = ?, ttd_pimpinan = ? WHERE id = ?`, 
    [status_akhir, ttd_penerima, id_surat], function(err) {
        if (err) return res.json({ sukses: false });

        const logMsg = `Berkas fisik surat resmi diserahkan ke ${nama_penerima}. Tanda tangan bukti terima sah terkunci.`;
        db.run(`INSERT INTO histori_perjalanan (id_surat, kategori, status, oleh_user) VALUES (?, 'Masuk', ?, 'Petugas Surat Masuk')`, 
        [id_surat, logMsg], () => {
            res.json({ sukses: true });
        });
    });
});

// ========================================================
// 5. API ENDPOINTS (MANAJEMEN SIMULASI SURAT KELUAR)
// ========================================================

// API: Simpan Draft Pengajuan Nomor Surat Keluar Baru
app.post('/api/tambah-surat-keluar', (req, res) => {
    const { nomor_antrean, jenis_surat, pemohon_unit, perihal, tanggal_keluar, tujuan, keterangan } = req.body;

    db.run(`INSERT INTO surat_keluar (nomor_antrean, jenis_surat, pemohon_unit, perihal, tanggal_keluar, tujuan, keterangan) 
            VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [nomor_antrean, jenis_surat, pemohon_unit, perihal, tanggal_keluar, tujuan, keterangan], function(err) {
        if (err) return res.status(500).send("Gagal menyimpan agenda surat keluar.");

        const idKeluar = this.lastID;
        // Rekam log awal perjalanan draf surat keluar
        db.run(`INSERT INTO histori_perjalanan (id_surat, kategori, status, oleh_user) 
                VALUES (?, 'Keluar', 'Draft agenda surat keluar berhasil dibuat, menunggu verifikasi penomoran', 'Petugas Surat Keluar')`,
        [idKeluar], () => {
            res.send(`<script>alert('Agenda Surat Keluar Berhasil Dicatatkan! Menunggu Verifikasi Penomoran.'); window.location.href='/tu_keluar.html';</script>`);
        });
    });
});

// API: Ambil Semua Data Registrasi Surat Keluar (Untuk Tabel Pantauan)
app.get('/api/surat-keluar-all', (req, res) => {
    db.all(`SELECT * FROM surat_keluar ORDER BY id DESC`, [], (err, rows) => {
        if (err) return res.status(500).json([]);
        res.json(rows);
    });
});

// API: Update Status Surat Keluar (Digunakan oleh Ka Subbag TU dan Kepala Puskesmas)
app.post('/api/update-status-surat-keluar', (req, res) => {
    const { id, status_terakhir, nomor_surat_resmi } = req.body;
    
    db.run(`UPDATE surat_keluar SET status_terakhir = ?, nomor_surat_resmi = ? WHERE id = ?`, 
    [status_terakhir, nomor_surat_resmi, id], function(err) {
        if (err) return res.status(500).json({ sukses: false, pesan: "Gagal memproses surat keluar" });

        // Tentukan pencatat log berdasarkan status alur baru
        let aktor = "Sistem";
        let pesanLog = "";
        
        if (status_terakhir === 'Sudah Diparaf Ka Subbag TU') {
            aktor = "Ka Subbag TU";
            pesanLog = "Berkas draf diperiksa dan dibubuhi paraf oleh Ka Subbag TU. Diteruskan ke Kepala Puskesmas.";
        } else if (status_terakhir === 'Selesai Ditandatangani Kepala Puskesmas') {
            aktor = "Manajemen / Pimpinan";
            pesanLog = `Surat resmi disetujui dan ditandatangani dengan nomor resmi: ${nomor_surat_resmi}`;
        }

        db.run(`INSERT INTO histori_perjalanan (id_surat, kategori, status, oleh_user) VALUES (?, 'Keluar', ?, ?)`,
        [id, pesanLog, aktor], () => {
            res.json({ sukses: true, status: status_terakhir });
        });
    });
});

// ========================================================
// 6. API ENDPOINTS (FITUR LACAK SURAT PINTAR MULTI-KEYWORD)
// ========================================================
app.get('/api/lacak-surat', (req, res) => {
    const keyword = req.query.keyword;
    if (!keyword) return res.json({ sukses: false, pesan: "Kosong!" });

    const query = `SELECT * FROM surat_masuk WHERE id = ? OR nomor_surat LIKE ? OR perihal LIKE ? LIMIT 1`;
    db.get(query, [keyword, `%${keyword}%`, `%${keyword}%`], (err, surat) => {
        if (err || !surat) return res.json({ sukses: false, pesan: "Tidak ditemukan." });

        db.all(`SELECT * FROM histori_perjalanan WHERE id_surat = ? ORDER BY tanggal_aksi DESC`, [surat.id], (err, histori) => {
            res.json({ sukses: true, dataSurat: surat, dataHistori: histori });
        });
    });
});

app.listen(PORT, () => {
    console.log(` SIPEDAS DUWIT SERVER RUNNING ON: http://localhost:${PORT}`);
});
# Artoria Pendragon | Bot

ArtoriaBot adalah bot WhatsApp yang dibangun menggunakan Node.js dan Baileys. Bot ini menyediakan berbagai fitur seperti pengelolaan grup, downloader media, dan banyak lagi.

## Fitur Utama

- **Pengelolaan Grup**: Ban, kick, mute, dan fitur admin lainnya.
- **Downloader**: Unduh video dari YouTube, Instagram, TikTok, dan Facebook.
- **Media Tools**: Sticker, gambar, dan konversi media.
- **Hiburan**: Chatbot, Quote, joke, fact, dan game sederhana.
- **Lainnya**: Weather, news, translate, dan banyak lagi.

## Persyaratan Sistem

- Node.js versi 16 atau lebih tinggi
- FFmpeg (untuk pemrosesan media)
- Git (untuk cloning repository)
- PM2 (untuk process management - opsional)

## Instalasi

### Langkah 1: Clone Repository

Clone repository ini menggunakan Git:

```bash
git clone https://github.com/santstyle/artoriabot-v2.git
cd artoriabot-v2
```

### Langkah 2: Install Node Modules

Install semua dependensi yang diperlukan:

```bash
npm install
```

### Langkah 3: Install FFmpeg

FFmpeg diperlukan untuk pemrosesan audio dan video. Instal sesuai sistem operasi Anda:

#### Linux (Ubuntu/Debian)

```bash
sudo apt update
sudo apt install ffmpeg -y
```

#### Windows

- Unduh dari situs resmi FFmpeg.
- Ekstrak dan tambahkan ke PATH sistem.

#### macOS

```bash
brew install ffmpeg
```

### Langkah 4: Konfigurasi Environment

Salin file environment contoh:

```bash
cp .env.example .env
```

Edit file `.env` untuk mengatur konfigurasi:

```bash
nano .env
```

atau

```bash
vim .env
```

Isi konfigurasi yang diperlukan seperti:

- Nomor WhatsApp
- API keys
- Pengaturan database
- dll

### Langkah 5: Generate Session WhatsApp

Jalankan bot untuk pertama kali untuk generate session:

```bash
npm start
```

**Catatan:**

- Buka WhatsApp di HP Anda
- Scan QR code yang muncul di terminal
- Tunggu hingga terkoneksi (biasanya muncul pesan "Connected!")
- Tekan Ctrl + C untuk menghentikan setelah session tersimpan

### Langkah 6: Jalankan dengan PM2 (Production)

Untuk menjalankan bot di background dan auto-restart:

```bash
# Install PM2 global jika belum
npm install -g pm2

# Jalankan bot dengan PM2
pm2 start npm --name "artoria-bot" -- start

# Atau jika menggunakan ecosystem.config.js
pm2 start ecosystem.config.js

# Simpan konfigurasi PM2 untuk auto start
pm2 save
pm2 startup
```

### Langkah 7: Verifikasi Status

Cek status bot yang sedang berjalan:

```bash
pm2 list
pm2 status artoria-bot
pm2 logs artoria-bot --lines 50
```

## Update Bot

Untuk memperbarui bot ke versi terbaru:

```bash
# Hentikan bot terlebih dahulu
pm2 stop artoria-bot

# Backup data penting jika perlu
cp -r session session-backup
cp .env .env-backup

# Pull update terbaru
git pull origin main

# Install dependencies baru
npm install

# Restart bot
pm2 restart artoria-bot
```

## Penggunaan

Setelah bot berjalan, gunakan perintah `.help` atau `!menu` untuk melihat daftar perintah yang tersedia.

## Troubleshooting

### Bot Tidak Berjalan

Cek log error:

```bash
pm2 logs artoria-bot
```

Pastikan FFmpeg terinstall:

```bash
ffmpeg -version
```

Cek Node.js version:

```bash
node --version
```

### QR Code Tidak Muncul

Hapus folder session dan coba lagi:

```bash
rm -rf session
npm start
```

### Permission Denied

Jika ada error permission:

```bash
sudo chmod -R 755 .
```

## Fitur PM2 yang Berguna

```bash
# Monitor bot
pm2 monit

# Restart bot
pm2 restart artoria-bot

# Stop bot
pm2 stop artoria-bot

# Hapus dari PM2
pm2 delete artoria-bot

# Cek resource usage
pm2 show artoria-bot
```

## Lisensi

Proyek ini menggunakan lisensi MIT. Lihat file LICENSE untuk detail lebih lanjut.

Modifikasi dari [https://github.com/mruniquehacker/Knightbot-MD](https://github.com/mruniquehacker/Knightbot-MD)

## Dukungan

Jika ada pertanyaan atau masalah:

- Buat issue di repository GitHub
- Cek bagian FAQ di dokumentasi
- Hubungi maintainer melalui kontak yang tersedia


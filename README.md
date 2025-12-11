# ArtoriaBot v1.6

ArtoriaBot adalah bot WhatsApp yang dibangun menggunakan Node.js dan Baileys. Bot ini menyediakan berbagai fitur seperti pengelolaan grup, downloader media, dan banyak lagi.

## Fitur Utama

- **Pengelolaan Grup**: Ban, kick, mute, dan fitur admin lainnya.
- **Downloader**: Unduh video dari YouTube, Instagram, TikTok, dan Facebook.
- **Media Tools**: Sticker, gambar, dan konversi media.
- **Hiburan**: Quote, joke, fact, dan game sederhana.
- **Lainnya**: Weather, news, translate, dan banyak lagi.

## Persyaratan Sistem

- Node.js versi 16 atau lebih tinggi
- FFmpeg (untuk pemrosesan media)
- Git (untuk cloning repository)

## Instalasi

### Langkah 1: Clone atau Unduh Repository

Clone repository ini menggunakan Git:

```bash
git clone https://github.com/santstyle/artoriabot-v1.6.git
cd artoriabot-v1.6
```

Atau unduh ZIP dari GitHub dan ekstrak ke folder lokal.

### Langkah 2: Install Node Modules

Install semua dependensi yang diperlukan:

```bash
npm install
```

### Langkah 3: Install FFmpeg

FFmpeg diperlukan untuk pemrosesan audio dan video. Instal sesuai sistem operasi Anda:

#### Windows
- Unduh dari [situs resmi FFmpeg](https://ffmpeg.org/download.html#build-windows).
- Ekstrak dan tambahkan ke PATH sistem.

#### Linux (Ubuntu/Debian)
```bash
sudo apt update
sudo apt install ffmpeg
```

#### macOS
```bash
brew install ffmpeg
```

### Langkah 4: Konfigurasi Bot

1. Edit file `config.js` untuk mengatur konfigurasi bot.
2. Edit file `settings.js` untuk pengaturan tambahan.
3. Pastikan semua file konfigurasi sudah benar.

### Langkah 5: Jalankan Bot

Jalankan bot menggunakan PM2 (disarankan untuk production):

```bash
npm install -g pm2
pm2 start ecosystem.config.js
```

Atau jalankan langsung:

```bash
node index.js
```

## Penggunaan

Setelah bot berjalan, scan QR code di terminal untuk login ke WhatsApp. Gunakan perintah `.help` untuk melihat daftar perintah yang tersedia.

## Lisensi

Proyek ini menggunakan lisensi MIT. Lihat file LICENSE untuk detail lebih lanjut.
Modifikasi dari https://github.com/mruniquehacker/Knightbot-MD

## Dukungan

Jika ada pertanyaan atau masalah, buat issue di repository GitHub atau hubungi maintainer.

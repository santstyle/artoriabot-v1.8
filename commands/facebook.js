const axios = require("axios");

async function facebookCommand(sock, chatId, message) {
    try {
        const text = message.message?.conversation ||
            message.message?.extendedTextMessage?.text ||
            message.message?.imageMessage?.caption ||
            '';

        const url = text.split(' ').slice(1).join(' ').trim();

        if (!url) {
            return await sock.sendMessage(chatId, {
                text: `Facebook Downloader\n\nGunakan: .fb <link facebook>\n\nFormat link yang bisa:\n- .fb https://fb.watch/lA2HqJwMmw/\n- .fb https://facebook.com/reel/123456789\n- .fb https://facebook.com/watch/?v=123456789`
            }, { quoted: message });
        }

        console.log('URL diterima:', url);

        // Perbaikan: Jangan block link /reel/ meskipun ada parameter
        // Hanya block link /share/ yang benar-benar tidak bisa
        if (url.includes('/share/')) {
            return await sock.sendMessage(chatId, {
                text: `Link Facebook tidak bisa didownload!\n\nLink "/share/" adalah link privat yang selalu butuh login Facebook.\n\nRekomendasi website downloader Facebook:\n1. fdownloader.net\n2. fbdownloader.net\n3. getmyfb.com\n\nCara pakai website di atas:\n1. Buka website tersebut di browser\n2. Paste link Facebook\n3. Download manual`
            }, { quoted: message });
        }

        // Bersihkan URL dari parameter tambahan untuk Facebook Reels
        let cleanUrl = url;
        if (url.includes('/reel/')) {
            // Ambil hanya bagian sebelum '?' untuk Reels
            const reelMatch = url.match(/(https?:\/\/[^\/]+\/reel\/\d+)/);
            if (reelMatch) {
                cleanUrl = reelMatch[1];
                console.log('URL Reels dibersihkan:', cleanUrl);
            }
        }

        // Kirim status processing
        await sock.sendMessage(chatId, {
            text: `Memproses link Facebook...\n\nURL: ${url.substring(0, 50)}${url.length > 50 ? '...' : ''}\n\nMohon tunggu sebentar...`
        });

        // Method 1: Untuk Facebook Reels (pakai API khusus)
        if (cleanUrl.includes('/reel/')) {
            try {
                console.log('Mencoba download Facebook Reels...');

                // Pakai snapinsta.app untuk Reels
                const response = await axios.post(
                    'https://snapinsta.app/action.php',
                    `url=${encodeURIComponent(cleanUrl)}`,
                    {
                        headers: {
                            'Content-Type': 'application/x-www-form-urlencoded',
                            'User-Agent': 'Mozilla/5.0'
                        },
                        timeout: 20000
                    }
                );

                if (response.data) {
                    // Cari link video dalam response
                    const responseText = typeof response.data === 'string' ? response.data : JSON.stringify(response.data);
                    const videoMatch = responseText.match(/"download_url":"([^"]+)"/) ||
                        responseText.match(/href="(https?:\/\/[^"]+\.mp4[^"]*)"/);

                    if (videoMatch && videoMatch[1]) {
                        const videoUrl = videoMatch[1].replace(/\\\//g, '/');
                        console.log('Video Reels ditemukan:', videoUrl);

                        await sock.sendMessage(chatId, {
                            video: { url: videoUrl },
                            caption: "From Facebook Reels"
                        });

                        await sock.sendMessage(chatId, {
                            text: "Download Berhasil!\n\nFacebook Reels berhasil didownload!"
                        });
                        return;
                    }
                }
            } catch (error) {
                console.log('Reels download gagal:', error.message);
            }
        }

        // Method 2: Untuk semua jenis video Facebook (termasuk fb.watch)
        try {
            console.log('Mencoba dengan fdownloader.net...');

            const response = await axios.post(
                'https://fdownloader.net/api/ajaxSearch',
                `q=${encodeURIComponent(cleanUrl)}`,
                {
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded',
                        'User-Agent': 'Mozilla/5.0'
                    },
                    timeout: 20000
                }
            );

            if (response.data?.data) {
                const html = response.data.data;
                const videoMatch = html.match(/href="(https?:\/\/[^"]+\.mp4[^"]*)"/);

                if (videoMatch && videoMatch[1]) {
                    const videoUrl = videoMatch[1];
                    console.log('Video ditemukan via fdownloader:', videoUrl);

                    await sock.sendMessage(chatId, {
                        video: { url: videoUrl },
                        caption: "From Facebook"
                    });

                    await sock.sendMessage(chatId, {
                        text: "Download Berhasil!\n\nVideo Facebook berhasil didownload!"
                    });
                    return;
                }
            }
        } catch (error) {
            console.log('fdownloader.net gagal:', error.message);
        }

        // Method 3: Pakai ssyoutube.com (fallback)
        try {
            console.log('Mencoba dengan ssyoutube.com...');

            const response = await axios.get(
                `https://ssyoutube.com/watch?v=${encodeURIComponent(cleanUrl)}`,
                {
                    headers: {
                        'User-Agent': 'Mozilla/5.0'
                    },
                    timeout: 20000
                }
            );

            const html = response.data;
            const videoMatch = html.match(/href="(https?:\/\/[^"]+\.mp4[^"]*)"/);

            if (videoMatch && videoMatch[1]) {
                await sock.sendMessage(chatId, {
                    video: { url: videoMatch[1] },
                    caption: "From Facebook"
                });

                await sock.sendMessage(chatId, {
                    text: "Download Berhasil via ssyoutube!"
                });
                return;
            }
        } catch (error) {
            console.log('ssyoutube.com gagal:', error.message);
        }

        // Jika semua gagal
        console.log('Semua metode gagal untuk:', cleanUrl);

        let errorMsg = "Tidak bisa mendownload video ini!\n\n";

        if (cleanUrl.includes('/groups/')) {
            errorMsg += "Video dari private group tidak bisa didownload.\n";
        } else if (!cleanUrl.includes('facebook.com') && !cleanUrl.includes('fb.watch')) {
            errorMsg += "Bukan link Facebook yang valid.\n";
        } else {
            errorMsg += "Kemungkinan:\n";
            errorMsg += "1. Video sudah dihapus/diprivate\n";
            errorMsg += "2. Hanya bisa diakses oleh teman/pengikut\n";
            errorMsg += "3. Server downloader sedang down\n\n";
        }

        errorMsg += "Rekomendasi website downloader Facebook:\n";
        errorMsg += "1. fdownloader.net\n";
        errorMsg += "2. fbdownloader.net\n";
        errorMsg += "3. getmyfb.com\n";
        errorMsg += "Cara pakai:\n";
        errorMsg += "1. Buka salah satu website di atas\n";
        errorMsg += "2. Paste link Facebook\n";
        errorMsg += "3. Download manual via browser\n\n";


        await sock.sendMessage(chatId, {
            text: errorMsg
        });

    } catch (error) {
        console.error("Facebook error:", error);

        await sock.sendMessage(chatId, {
            text: "Error sistem: " + error.message
        }, { quoted: message });
    }
}

module.exports = {
    fb: facebookCommand,
    facebook: facebookCommand
};
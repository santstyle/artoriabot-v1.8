const axios = require('axios');
const fs = require('fs');
const path = require('path');

// Multiple lyrics API providers with fallback
const lyricsApis = [
    {
        name: "Lyrics.ovh",
        url: "https://api.lyrics.ovh/v1",
        method: "GET",
        parse: (data) => data.lyrics,
        getTitle: (artist, title) => `${artist} - ${title}`
    },
    {
        name: "SomeRandomAPI",
        url: "https://some-random-api.com/lyrics",
        method: "GET",
        parse: (data) => data.lyrics,
        getTitle: (data) => data.title || data.title
    },
    {
        name: "GeniusAPI",
        url: "https://genius.com/api/search",
        method: "GET",
        parse: (data) => {
            // Genius API returns search results, need to extract lyrics URL
            if (data.response?.hits && data.response.hits.length > 0) {
                return data.response.hits[0].result.url;
            }
            return null;
        },
        getTitle: (data) => {
            if (data.response?.hits && data.response.hits.length > 0) {
                return data.response.hits[0].result.title;
            }
            return null;
        }
    },
    {
        name: "AZLyricsAPI",
        url: "https://api.lyrics.az",
        method: "GET",
        parse: (data) => data.lyrics,
        getTitle: (data) => data.title
    }
];

// Extract artist and title from search query
function parseSongQuery(query) {
    const separators = [' - ', ' – ', ' — ', ' // ', ' by ', ' dari '];

    for (const sep of separators) {
        if (query.includes(sep)) {
            const parts = query.split(sep);
            return {
                artist: parts[0].trim(),
                title: parts.slice(1).join(sep).trim()
            };
        }
    }

    // If no separator found, try common patterns
    const patterns = [
        /^(.+?)\s+-\s+(.+)$/,  // "Artist - Title"
        /^(.+?)\s+by\s+(.+)$/i, // "Title by Artist"
        /^(.+?)\s+dari\s+(.+)$/i // "Title dari Artist"
    ];

    for (const pattern of patterns) {
        const match = query.match(pattern);
        if (match) {
            return {
                artist: match[2].trim(),
                title: match[1].trim()
            };
        }
    }

    // If no pattern matches, assume whole query is title
    return {
        artist: null,
        title: query.trim()
    };
}

// Split long text into WhatsApp-friendly chunks
function splitLyrics(lyrics, title, maxLength = 4000) {
    const chunks = [];
    const lines = lyrics.split('\n');
    let currentChunk = `🎵 *${title}*\n\n`;

    for (const line of lines) {
        if ((currentChunk + line + '\n').length > maxLength) {
            chunks.push(currentChunk);
            currentChunk = '';
        }
        currentChunk += line + '\n';
    }

    if (currentChunk) {
        chunks.push(currentChunk);
    }

    return chunks;
}

// Get lyrics from APIs with fallback
async function getLyricsFromAPI(artist, title, apiIndex = 0) {
    if (apiIndex >= lyricsApis.length) {
        return { success: false, error: "Semua API gagal" };
    }

    const api = lyricsApis[apiIndex];

    try {
        console.log(`Mencoba API ${api.name}...`);

        let response;
        if (api.name === "GeniusAPI") {
            // Genius API requires search
            const searchQuery = artist ? `${title} ${artist}` : title;
            response = await axios.get(`${api.url}?q=${encodeURIComponent(searchQuery)}`, {
                timeout: 15000,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                    'Accept': 'application/json'
                }
            });
        } else if (artist && title && api.name !== "SomeRandomAPI") {
            // APIs that support artist/title separation
            response = await axios.get(`${api.url}/${encodeURIComponent(artist)}/${encodeURIComponent(title)}`, {
                timeout: 15000,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                    'Accept': 'application/json'
                }
            });
        } else {
            // APIs that only need title
            response = await axios.get(`${api.url}?title=${encodeURIComponent(title)}`, {
                timeout: 15000,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                    'Accept': 'application/json'
                }
            });
        }

        const data = response.data;
        const lyrics = api.parse(data);

        if (lyrics) {
            let songTitle;
            if (api.name === "GeniusAPI") {
                songTitle = api.getTitle(data) || title;
            } else {
                songTitle = artist ? `${artist} - ${title}` : title;
            }

            return {
                success: true,
                lyrics: lyrics,
                title: songTitle,
                api: api.name,
                artist: artist || "Unknown Artist",
                source: api.name
            };
        } else {
            console.log(`API ${api.name} tidak mengembalikan lirik`);
            return await getLyricsFromAPI(artist, title, apiIndex + 1);
        }
    } catch (error) {
        console.log(`API ${api.name} gagal:`, error.message);
        return await getLyricsFromAPI(artist, title, apiIndex + 1);
    }
}

// Alternative: Scrape lyrics from websites (fallback)
async function scrapeLyrics(artist, title) {
    try {
        // Try to get from lyrics.wikia (if still available)
        const formattedArtist = artist ? encodeURIComponent(artist.replace(/\s+/g, '_')) : '';
        const formattedTitle = encodeURIComponent(title.replace(/\s+/g, '_'));

        const response = await axios.get(`https://lyrics.fandom.com/wiki/${formattedArtist}:${formattedTitle}`, {
            timeout: 10000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });

        // Simple HTML parsing for lyrics (this is a basic example)
        const html = response.data;
        const lyricsMatch = html.match(/<div class='lyricbox'>(.*?)<\/div>/s);

        if (lyricsMatch) {
            let lyrics = lyricsMatch[1]
                .replace(/<br\s*\/?>/gi, '\n')
                .replace(/<[^>]+>/g, '')
                .replace(/&amp;/g, '&')
                .replace(/&lt;/g, '<')
                .replace(/&gt;/g, '>')
                .replace(/&quot;/g, '"')
                .replace(/&#039;/g, "'")
                .trim();

            if (lyrics.length > 100) {
                return {
                    success: true,
                    lyrics: lyrics,
                    title: `${artist} - ${title}`,
                    api: "LyricsFandom",
                    artist: artist,
                    source: "Lyrics Fandom"
                };
            }
        }
    } catch (error) {
        console.log('Scraping gagal:', error.message);
    }

    return { success: false, error: "Gagal mengambil lirik" };
}

// Main lyrics command function
async function lyricsCommand(sock, chatId, songTitle, message) {
    try {
        // Check if songTitle is provided
        if (!songTitle || songTitle.trim() === '') {
            await sock.sendMessage(chatId, {
                text: `🎵 *Pencari Lirik Lagu*\n\n` +
                    `*Cara penggunaan:*\n` +
                    `.lyrics <judul lagu>\n` +
                    `.lirik <judul lagu>\n\n` +
                    `*Format yang didukung:*\n` +
                    `.lyrics Judul Lagu\n` +
                    `.lyrics Judul Lagu - Nama Artis\n` +
                    `.lyrics Nama Artis - Judul Lagu\n` +
                    `.lirik Judul Lagu by Nama Artis\n\n` +
                    `*Contoh:*\n` +
                    `.lyrics Alan Walker Faded\n` +
                    `.lirik Bruno Mars - That's What I Like\n` +
                    `.lyrics Perfect by Ed Sheeran\n\n` +
                    `*Fitur:*\n` +
                    `• Multiple API backup\n` +
                    `• Auto artist/title detection\n` +
                    `• Split long lyrics\n` +
                    `• Smart search`
            }, { quoted: message });
            return;
        }

        // Send initial processing message
        const processingMsg = await sock.sendMessage(chatId, {
            text: `🔍 *Mencari lirik...*\n\n` +
                `"${songTitle.substring(0, 50)}${songTitle.length > 50 ? '...' : ''}"\n\n` +
                `⏳ Mohon tunggu sebentar...`
        }, { quoted: message });

        try {
            // Parse artist and title from query
            const parsed = parseSongQuery(songTitle);
            const artist = parsed.artist;
            const title = parsed.title;

            // Update status
            await sock.sendMessage(chatId, {
                text: `🔍 *Mencari lirik...*\n\n` +
                    `Judul: ${title}\n` +
                    `${artist ? `Artis: ${artist}\n` : ''}` +
                    `⏳ Menunggu hasil...`,
                edit: processingMsg.key
            });

            // Try to get lyrics from APIs
            let lyricsData = await getLyricsFromAPI(artist, title);

            // If API fails, try scraping
            if (!lyricsData.success) {
                await sock.sendMessage(chatId, {
                    text: `🔄 *Mencoba metode alternatif...*\n\n` +
                        `API tidak merespons, mencoba sumber lain...`,
                    edit: processingMsg.key
                });

                if (artist) {
                    lyricsData = await scrapeLyrics(artist, title);
                }
            }

            if (!lyricsData.success) {
                await sock.sendMessage(chatId, {
                    text: `❌ *Lirik Tidak Ditemukan!*\n\n` +
                        `Lirik untuk "${songTitle}" tidak ditemukan.\n\n` +
                        `*Coba:*\n` +
                        `1. Periksa penulisan judul/artis\n` +
                        `2. Gunakan format: "Judul - Artis"\n` +
                        `3. Cari dengan judul bahasa Inggris\n` +
                        `4. Coba lagu lain`,
                    edit: processingMsg.key
                });
                return;
            }

            // Check if lyrics is a URL (Genius API case)
            if (lyricsData.lyrics.startsWith('http')) {
                await sock.sendMessage(chatId, {
                    text: `✅ *Lirik Ditemukan!*\n\n` +
                        `Lirik tersedia di link berikut:\n` +
                        `${lyricsData.lyrics}\n\n` +
                        `Klik link di atas untuk melihat lirik lengkap.`,
                    edit: processingMsg.key
                });
                return;
            }

            // Update status
            await sock.sendMessage(chatId, {
                text: `✅ *Lirik Ditemukan!*\n\n` +
                    `Sumber: ${lyricsData.source}\n` +
                    `⏳ *Menyusun lirik...*`,
                edit: processingMsg.key
            });

            // Clean and format lyrics
            let lyrics = lyricsData.lyrics
                .replace(/\r\n/g, '\n')
                .replace(/\n{3,}/g, '\n\n')
                .trim();

            // Add header to lyrics
            const fullTitle = lyricsData.title || `${artist || ''} ${title}`.trim();
            const header = `🎵 *${fullTitle}*\n` +
                `${lyricsData.artist ? `👤 ${lyricsData.artist}\n` : ''}` +
                `📝 Sumber: ${lyricsData.source}\n\n`;

            const fullLyrics = header + lyrics + `\n\n_Semoga membantu! 🎶_`;

            // Split lyrics if too long
            const chunks = splitLyrics(fullLyrics, fullTitle);

            // Delete processing message
            await sock.deleteMessage(chatId, processingMsg.key);

            // Send lyrics in chunks
            for (let i = 0; i < chunks.length; i++) {
                const chunk = chunks[i];

                if (i === 0) {
                    await sock.sendMessage(chatId, {
                        text: chunk
                    }, { quoted: message });
                } else {
                    await sock.sendMessage(chatId, {
                        text: chunk
                    });
                }

                // Add delay between messages to avoid rate limiting
                if (i < chunks.length - 1) {
                    await new Promise(resolve => setTimeout(resolve, 1000));
                }
            }

            // Send completion message if lyrics were split
            if (chunks.length > 1) {
                await sock.sendMessage(chatId, {
                    text: `📄 *Lirik lengkap terkirim!*\n\n` +
                        `Total ${chunks.length} bagian.\n` +
                        `Selamat bernyanyi! 🎤`
                });
            }

        } catch (error) {
            console.error('Lyrics processing error:', error);

            await sock.sendMessage(chatId, {
                text: `❌ *Terjadi Kesalahan!*\n\n` +
                    `Gagal memproses permintaan lirik.\n\n` +
                    `Error: ${error.message || 'Unknown'}\n\n` +
                    `Coba lagi nanti atau gunakan judul yang berbeda.`,
                edit: processingMsg.key
            });
        }

    } catch (error) {
        console.error('Error in lyrics command:', error);

        await sock.sendMessage(chatId, {
            text: "❌ *Terjadi Kesalahan Sistem!*\n\n" +
                "Maaf, terjadi error yang tidak terduga.\n" +
                "Silakan coba lagi nanti.\n\n" +
                "Error: " + (error.message || "Unknown")
        }, { quoted: message });
    }
}

// Quick lyrics search (simple version)
async function quickLyricsCommand(sock, chatId, songTitle, message) {
    try {
        if (!songTitle) {
            return await sock.sendMessage(chatId, {
                text: '🎵 Cari lirik lagu\n\nGunakan: .lyrics <judul lagu>\nContoh: .lyrics Alan Walker Faded'
            }, { quoted: message });
        }

        await sock.sendMessage(chatId, {
            react: { text: '🔍', key: message.key }
        });

        const processingMsg = await sock.sendMessage(chatId, {
            text: '⏳ Mencari lirik...'
        }, { quoted: message });

        // Try lyrics.ovh API first (most reliable)
        try {
            const parsed = parseSongQuery(songTitle);
            const artist = parsed.artist;
            const title = parsed.title;

            let apiUrl;
            if (artist) {
                apiUrl = `https://api.lyrics.ovh/v1/${encodeURIComponent(artist)}/${encodeURIComponent(title)}`;
            } else {
                apiUrl = `https://api.lyrics.ovh/v1/${encodeURIComponent(title)}`;
            }

            const response = await axios.get(apiUrl, { timeout: 10000 });
            const data = response.data;

            if (data.lyrics) {
                const lyrics = data.lyrics.substring(0, 4000);
                const displayTitle = artist ? `${artist} - ${title}` : title;

                await sock.sendMessage(chatId, {
                    text: `🎵 *${displayTitle}*\n\n${lyrics}\n\n_Semoga membantu! 🎶_`
                }, { quoted: message });

                await sock.deleteMessage(chatId, processingMsg.key);
                await sock.sendMessage(chatId, {
                    react: { text: '✅', key: message.key }
                });

                return;
            }
        } catch (apiError) {
            console.log('lyrics.ovh failed, trying alternative...');
        }

        // Try some-random-api as fallback
        try {
            const response = await axios.get(`https://some-random-api.com/lyrics?title=${encodeURIComponent(songTitle)}`, {
                timeout: 10000
            });

            const data = response.data;

            if (data.lyrics) {
                const lyrics = data.lyrics.substring(0, 4000);
                const title = data.title || songTitle;

                await sock.sendMessage(chatId, {
                    text: `🎵 *${title}*\n\n${lyrics}\n\n_Semoga membantu! 🎶_`
                }, { quoted: message });

                await sock.deleteMessage(chatId, processingMsg.key);
                await sock.sendMessage(chatId, {
                    react: { text: '✅', key: message.key }
                });

                return;
            }
        } catch (error) {
            console.log('some-random-api failed');
        }

        await sock.sendMessage(chatId, {
            text: `❌ Lirik untuk "${songTitle}" tidak ditemukan.\nCoba judul lain atau sertakan nama artis.`,
            edit: processingMsg.key
        });

        await sock.sendMessage(chatId, {
            react: { text: '❌', key: message.key }
        });

    } catch (error) {
        console.error('Quick lyrics error:', error);
        await sock.sendMessage(chatId, {
            text: '❌ Gagal mencari lirik! Coba lagi nanti.'
        }, { quoted: message });
    }
}

// Export for multiple commands
module.exports = {
    lyrics: lyricsCommand,
    lirik: lyricsCommand,
    lyricsQuick: quickLyricsCommand
};
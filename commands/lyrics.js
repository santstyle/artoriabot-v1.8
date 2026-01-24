const axios = require('axios');

function parseSongQuery(query) {
    query = query.trim();

    if (!query) {
        return { artist: null, title: '' };
    }

    const patterns = [
        { regex: /^([^-]+)\s*-\s*(.+)$/, artist: 1, title: 2 },
        { regex: /^(.+)\s+by\s+(.+)$/i, artist: 2, title: 1 },
        { regex: /^([^:]+):\s*(.+)$/, artist: 1, title: 2 },
        { regex: /^(.+)\s+\(feat\.\s*(.+)\)$/i, artist: 2, title: 1 },
        { regex: /^(.+)\s+ft\.\s*(.+)$/i, artist: 2, title: 1 },
    ];

    for (const pattern of patterns) {
        const match = query.match(pattern.regex);
        if (match) {
            return {
                artist: match[pattern.artist].trim(),
                title: match[pattern.title].trim()
            };
        }
    }

    const words = query.split(/\s+/);

    if (words.length >= 3) {
        const knownArtists = [
            'alan walker', 'ed sheeran', 'taylor swift', 'bruno mars',
            'justin bieber', 'ariana grande', 'drake', 'post malone',
            'billie eilish', 'the weeknd', 'coldplay', 'maroon 5',
            'eminem', 'rihanna', 'beyonce', 'shakira', 'selena gomez',
            'blink-182', 'one direction', 'bts', 'blackpink',
            'nirvana', 'queen', 'the beatles', 'michael jackson'
        ];

        for (let i = 2; i <= Math.min(4, words.length - 1); i++) {
            const possibleArtist = words.slice(0, i).join(' ').toLowerCase();
            for (const artist of knownArtists) {
                if (possibleArtist === artist || artist.includes(possibleArtist)) {
                    return {
                        artist: words.slice(0, i).join(' '),
                        title: words.slice(i).join(' ')
                    };
                }
            }
        }

        if (words.length === 3) {
            return {
                artist: words.slice(0, 2).join(' '), // "alan walker"
                title: words[2] // "faded"
            };
        }
    }

    const commonSongs = {
        '18': { title: '18', artist: 'One Direction' },
        'faded': { title: 'Faded', artist: 'Alan Walker' },
        'shape': { title: 'Shape of You', artist: 'Ed Sheeran' },
        'perfect': { title: 'Perfect', artist: 'Ed Sheeran' },
        'sorry': { title: 'Sorry', artist: 'Justin Bieber' },
        'hello': { title: 'Hello', artist: 'Adele' },
        'blank': { title: 'Blank Space', artist: 'Taylor Swift' },
        'thunder': { title: 'Thunder', artist: 'Imagine Dragons' },
        'believer': { title: 'Believer', artist: 'Imagine Dragons' },
        'havana': { title: 'Havana', artist: 'Camila Cabello' }
    };

    const lowerQuery = query.toLowerCase();
    if (commonSongs[lowerQuery]) {
        return {
            title: commonSongs[lowerQuery].title,
            artist: commonSongs[lowerQuery].artist
        };
    }

    return {
        artist: null,
        title: query
    };
}

function cleanText(text) {
    if (!text) return '';

    return text
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#039;/g, "'")
        .replace(/&nbsp;/g, ' ')
        .replace(/&#x27;/g, "'")
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<[^>]+>/g, '')
        .replace(/\r\n/g, '\n')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
}

function splitLyrics(lyrics, maxLength = 3500) {
    const chunks = [];
    let currentChunk = '';

    const lines = lyrics.split('\n');

    for (const line of lines) {
        if ((currentChunk + line + '\n').length > maxLength) {
            if (currentChunk) {
                chunks.push(currentChunk.trim());
                currentChunk = '';
            }
        }
        currentChunk += line + '\n';
    }

    if (currentChunk.trim()) {
        chunks.push(currentChunk.trim());
    }

    return chunks;
}

async function getLyricsFromGenius(artist, title) {
    try {
        let searchQuery = title;
        if (artist) {
            searchQuery = `${artist} ${title}`;
        }

        console.log(`Searching Genius for: ${searchQuery}`);

        const searchUrl = `https://genius.com/api/search/multi?q=${encodeURIComponent(searchQuery)}`;

        const searchResponse = await axios.get(searchUrl, {
            timeout: 20000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                'Accept': 'application/json',
                'Accept-Language': 'en-US,en;q=0.9',
                'Referer': 'https://genius.com/'
            }
        });

        const searchData = searchResponse.data;

        let songResult = null;
        if (searchData.response && searchData.response.sections) {
            for (const section of searchData.response.sections) {
                if (section.type === 'song' && section.hits && section.hits.length > 0) {
                    for (const hit of section.hits) {
                        const result = hit.result;
                        const resultTitle = result.title.toLowerCase();
                        const resultArtist = result.primary_artist.name.toLowerCase();

                        if (title && resultTitle.includes(title.toLowerCase())) {
                            songResult = result;
                            break;
                        } else if (artist && resultArtist.includes(artist.toLowerCase())) {
                            songResult = result;
                            break;
                        }
                    }

                    if (!songResult && section.hits[0]) {
                        songResult = section.hits[0].result;
                    }

                    if (songResult) break;
                }
            }
        }

        if (!songResult) {
            console.log('No song found on Genius');
            return null;
        }

        console.log(`Found song: ${songResult.title} by ${songResult.primary_artist.name}`);

        const lyricsUrl = songResult.url;
        console.log(`Fetching lyrics from: ${lyricsUrl}`);

        const lyricsResponse = await axios.get(lyricsUrl, {
            timeout: 20000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.5',
                'Referer': 'https://genius.com/'
            }
        });

        const html = lyricsResponse.data;

        let lyrics = '';

        const lyricsContainersRegex = /<div[^>]*data-lyrics-container="true"[^>]*>([\s\S]*?)<\/div>/g;
        let match;
        while ((match = lyricsContainerRegex.exec(html)) !== null) {
            lyrics += cleanText(match[1]) + '\n\n';
        }

        if (!lyrics || lyrics.length < 100) {
            const containerRegex = /<div[^>]*class="[^"]*Lyrics__Container[^"]*"[^>]*>([\s\S]*?)<\/div>/g;
            while ((match = containerRegex.exec(html)) !== null) {
                lyrics += cleanText(match[1]) + '\n\n';
            }
        }

        if (!lyrics || lyrics.length < 100) {
            const lyricsRegex = /<div[^>]*class="[^"]*lyrics[^"]*"[^>]*>([\s\S]*?)<\/div>/s;
            const lyricsMatch = html.match(lyricsRegex);
            if (lyricsMatch) {
                lyrics = cleanText(lyricsMatch[1]);
            }
        }

        lyrics = cleanText(lyrics);

        if (lyrics && lyrics.length > 50) {
            lyrics = lyrics
                .replace(/\d+\s+ContributorsTranslation(s?)/gi, '')
                .replace(/You might also like/g, '')
                .replace(/Embed/g, '')
                .trim();

            return {
                success: true,
                lyrics: lyrics,
                title: songResult.title,
                artist: songResult.primary_artist.name,
                source: "Genius",
                url: lyricsUrl
            };
        } else {
            return {
                success: true,
                lyrics: `Lirik lengkap tersedia di:\n${lyricsUrl}`,
                title: songResult.title,
                artist: songResult.primary_artist.name,
                source: "Genius (Link)",
                url: lyricsUrl
            };
        }

    } catch (error) {
        console.error('Genius API error:', error.message);
        return null;
    }
}

async function getLyrics(artist, title) {
    console.log(`Mencari lirik: ${artist || 'Unknown'} - ${title}`);

    const geniusResult = await getLyricsFromGenius(artist, title);

    if (geniusResult) {
        return geniusResult;
    }

    const searchQuery = encodeURIComponent(`${artist || ''} ${title} lyrics`);
    return {
        success: false,
        error: "Lirik tidak ditemukan",
        searchUrl: `https://www.google.com/search?q=${searchQuery}`
    };
}

async function lyricsCommand(sock, chatId, songTitle, message) {
    try {
        if (!songTitlse || songTitle.trim() === '') {
            await sock.sendMessage(chatId, {
                text: `Fitur .lyrics digunakan untuk mencari lirik lagu.

Cara penggunaan: ketik \`.lyrics <judul lagu>\``
            }, { quoted: message });
            return;
        }



        try {
            const parsed = parseSongQuery(songTitle);
            const artist = parsed.artist;
            const title = parsed.title;

            console.log(`Parsed: Artist="${artist}", Title="${title}"`);

            const lyricsData = await getLyrics(artist, title);

            if (!lyricsData.success) {
                await sock.sendMessage(chatId, {
                    text: `Lirik Tidak Ditemukan

"${songTitle}" tidak ditemukan.

Anda dapat mencari manual di:
${lyricsData.searchUrl}

Tips untuk pencarian berikutnya:
• Gunakan format: "Judul - Artis"
• Contoh: .lyrics faded - alan walker
• Contoh: .lyrics shape of you - ed sheeran

Atau coba lagu populer:
• .lyrics faded - alan walker
• .lyrics perfect - ed sheeran
• .lyrics sorry - justin bieber`
                });
                return;
            }

            const displayTitle = `${lyricsData.artist} - ${lyricsData.title}`;
            const header = `Lyrics ${displayTitle}`;

            const cleanLyrics = cleanText(lyricsData.lyrics);

            const fullLyrics = header + '\n\n' + cleanLyrics;

            const chunks = splitLyrics(fullLyrics);

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

                if (i < chunks.length - 1) {
                    await new Promise(resolve => setTimeout(resolve, 500));
                }
            }

        } catch (error) {
            console.error('Lyrics processing error:', error);

            await sock.sendMessage(chatId, {
                text: `Terjadi Kesalahan

Gagal memproses permintaan lirik.

Error: ${error.message || 'Tidak diketahui'}

Coba format: "Judul - Artis"
Contoh: .lyrics faded - alan walker`
            });
        }

    } catch (error) {
        console.error('Error in lyrics command:', error);

        await sock.sendMessage(chatId, {
            text: `Error Sistem

Maaf, terjadi error.
Silakan coba lagi nanti.

Error: ${error.message || "Tidak diketahui"}`
        }, { quoted: message });
    }
}

async function quickLyricsCommand(sock, chatId, songTitle, message) {
    try {
        if (!songTitle) {
            return await sock.sendMessage(chatId, {
                text: `Cari Lirik Cepat

Gunakan:
• .lyrics <judul> - <artis>

Contoh:
• .lyrics faded - alan walker
• .lyrics shape of you - ed sheeran`
            }, { quoted: message });
        }

        await sock.sendMessage(chatId, {
            text: `Mencari: ${songTitle}...`
        }, { quoted: message });

        const parsed = parseSongQuery(songTitle);
        const artist = parsed.artist;
        const title = parsed.title;

        const lyricsData = await getLyrics(artist, title);

        if (!lyricsData.success) {
            await sock.sendMessage(chatId, {
                text: `Tidak ditemukan

"${songTitle}" tidak ditemukan.

Gunakan format: Judul - Artis
Contoh: faded - alan walker`
            });
            return;
        }

        const displayTitle = `${lyricsData.artist} - ${lyricsData.title}`;
        const lyrics = cleanText(lyricsData.lyrics);
        const formattedLyrics = `Lyrics ${displayTitle}\n\n${lyrics}`;

        await sock.sendMessage(chatId, {
            text: formattedLyrics
        }, { quoted: message });

    } catch (error) {
        console.error('Quick lyrics error:', error);
        await sock.sendMessage(chatId, {
            text: 'Gagal mencari lirik. Gunakan format: Judul - Artis'
        }, { quoted: message });
    }
}

module.exports = {
    lyrics: lyricsCommand,
    lirik: lyricsCommand,
    lyricsQuick: quickLyricsCommand
};
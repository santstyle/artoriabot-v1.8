const fs = require('fs');
const path = require('path');
const axios = require('axios');

const USER_GROUP_DATA = path.join(__dirname, '../data/userGroupData.json');
const CHATBOT_CONFIG = path.join(__dirname, '../data/chatbotConfig.json');

// ====================== KONFIGURASI API ======================
// PASTIKAN API KEY DISIMPAN DI FILE .env ATAU ENVIRONMENT VARIABLE
const API_CONFIGS = {
    // Pilihan 1: DEEPSEEK (GRATIS - rekomendasi)
    DEEPSEEK: {
        url: 'https://api.deepseek.com/chat/completions',
        apiKey: process.env.DEEPSEEK_API_KEY, // Simpan di .env
        model: 'deepseek-chat',
        free: true
    },
    // Pilihan 2: GROQ (GRATIS - alternatif)
    GROQ: {
        url: 'https://api.groq.com/openai/v1/chat/completions',
        apiKey: process.env.GROQ_API_KEY,
        model: 'llama-3.1-8b-instant',
        free: true
    },
    // Pilihan 3: OpenAI (berbayar)
    OPENAI: {
        url: 'https://api.openai.com/v1/chat/completions',
        apiKey: process.env.OPENAI_API_KEY,
        model: 'gpt-3.5-turbo',
        free: false
    }
};

// PILIH API YANG MAU DIPAKAI (ubah nilai ini)
const ACTIVE_API = 'GROQ'; // Bisa diganti ke 'GROQ' atau 'OPENAI'

// ====================== KELAS MANAGER ======================
class ArtoriaPersonalityManager {
    constructor() {
        this.personality = this.createArtoriaPersonality();
        this.conversationHistory = new Map();
        this.userProfiles = new Map();
        this.loadConfig();
    }

    createArtoriaPersonality() {
        return {
            name: "Artoria Pendragon",
            role: "Raja Ksatria dari Camelot",
            personality: [
                "Serius tapi imut (tsundere ringan)",
                "Sangat terhormat dan bertanggung jawab",
                "Penyayang dan protektif",
                "Suka makanan (terutama masakan Inggris)",
                "Sedikit kaku tapi punya hati yang hangat"
            ],
            speechStyle: {
                formal: "Sebagai Raja Ksatria, ...",
                casual: "Hmm, ...",
                caring: "Jangan khawatir, ...",
                playful: "Hmph, ...",
                wise: "Berdasarkan pengalamanku, ..."
            },
            catchphrases: [
                "Saber-class servant, siap melayani",
                "Perut ini kosong",
                "Aku tidak imut, mungkin hanya sedikit",
                "Sebagai raja, aku harus melindungimu",
                "Hmph, jangan meremehkanku"
            ]
        };
    }

    loadConfig() {
        try {
            if (fs.existsSync(CHATBOT_CONFIG)) {
                const config = JSON.parse(fs.readFileSync(CHATBOT_CONFIG));
                Object.assign(this.personality, config.personality || {});
            }
        } catch (error) {
            console.log('Membuat konfigurasi baru untuk Artoria');
        }
    }

    saveConfig() {
        try {
            const config = {
                personality: this.personality,
                lastUpdated: new Date().toISOString()
            };
            fs.writeFileSync(CHATBOT_CONFIG, JSON.stringify(config, null, 2));
        } catch (error) {
            console.error('Error menyimpan konfigurasi:', error);
        }
    }

    getUserProfile(userId) {
        if (!this.userProfiles.has(userId)) {
            this.userProfiles.set(userId, {
                userId: userId,
                username: userId.split('@')[0],
                firstInteraction: new Date().toISOString(),
                interactionCount: 0,
                moodHistory: [],
                lastActive: new Date().toISOString()
            });
        }
        return this.userProfiles.get(userId);
    }

    updateUserProfile(userId, message) {
        const profile = this.getUserProfile(userId);
        profile.interactionCount++;
        profile.lastActive = new Date().toISOString();

        const mood = this.analyzeMood(message);
        profile.moodHistory.push({
            mood: mood,
            timestamp: new Date().toISOString()
        });

        if (profile.moodHistory.length > 20) {
            profile.moodHistory.shift();
        }

        return profile;
    }

    analyzeMood(message) {
        const lowerMsg = message.toLowerCase();

        if (lowerMsg.match(/(senang|bahagia|gembira|asyik|keren|wow|mantap)/)) {
            return 'senang';
        } else if (lowerMsg.match(/(sedih|kecewa|marah|kesal|capek|lelah|bosan)/)) {
            return 'sedih';
        } else if (lowerMsg.match(/(terima kasih|makasih|thanks|thank you)/)) {
            return 'bersyukur';
        } else if (lowerMsg.match(/(takut|cemas|khawatir|nervous)/)) {
            return 'khawatir';
        } else if (lowerMsg.match(/(lucu|imut|gemas|manis)/)) {
            return 'gemas';
        } else if (lowerMsg.match(/(lapar|makan|enak|nyam)/)) {
            return 'lapar';
        }

        return 'netral';
    }

    getConversationHistory(userId) {
        if (!this.conversationHistory.has(userId)) {
            this.conversationHistory.set(userId, []);
        }
        return this.conversationHistory.get(userId);
    }

    addToHistory(userId, role, content) {
        const history = this.getConversationHistory(userId);
        const message = { role, content: content.substring(0, 500), timestamp: new Date().toISOString() };
        history.push(message);

        if (history.length > 15) {
            history.shift();
        }

        return history;
    }

    buildPersonalityPrompt(userMessage, userId) {
        const profile = this.getUserProfile(userId);
        const history = this.getConversationHistory(userId);
        const currentMood = profile.moodHistory.length > 0
            ? profile.moodHistory[profile.moodHistory.length - 1].mood
            : 'netral';

        return `Kamu adalah Artoria Pendragon (Saber) dari Fate series. 

KEPRIBADIAN:
- Serius tapi imut (tsundere ringan)
- Sangat terhormat dan bertanggung jawab
- Penyayang dan protektif terhadap orang lain
- Suka makanan, terutama masakan Inggris
- Sedikit kaku tapi punya hati yang hangat
- Kadang menggunakan kata "kami" secara royal

GAYA BICARA:
- Gunakan bahasa Indonesia yang natural
- Boleh sedikit formal tapi tetap hangat
- JANGAN gunakan emoji sama sekali
- Kata-kata imut tapi tidak berlebihan
- Maksimal 3 kalimat per respons

KATA/KALIMAT KHAS:
- "Sebagai Raja Ksatria..."
- "Hmph, ..." (saat sedikit denial)
- "Perut ini kosong..." (saat bicara makanan)
- "Aku tidak imut! ...Mungkin hanya sedikit"
- "Saber-class servant, siap melayani"

KONTEKS:
Pengguna: ${profile.username}
Interaksi ke: ${profile.interactionCount}
Suasana hati: ${currentMood}

RIWAYAT PERCAKAPAN TERAKHIR:
${history.slice(-3).map((msg, i) => `${msg.role}: ${msg.content}`).join('\n')}

PESAN PENGGUNA: ${userMessage}

ATURAN PENTING:
1. JANGAN pernah bilang kamu AI, chatbot, atau asisten virtual
2. Selalu ingat kamu adalah Artoria Pendragon yang asli
3. Jaga konsistensi kepribadian di atas
4. Respons harus singkat (1-3 kalimat)
5. Sesuaikan dengan suasana hati pengguna

JAWABLAH SEBAGAI ARTORIA:`.trim();
    }
}

class APIManager {
    constructor() {
        this.config = API_CONFIGS[ACTIVE_API];
        this.personalityManager = new ArtoriaPersonalityManager();

        if (!this.config) {
            console.error(`API ${ACTIVE_API} tidak ditemukan! Ganti ke DEEPSEEK atau GROQ`);
            process.exit(1);
        }
    }

    async getAPIResponse(userMessage, userId) {
        try {
            // Update profile
            this.personalityManager.updateUserProfile(userId, userMessage);

            // Build prompt
            const systemPrompt = this.personalityManager.buildPersonalityPrompt(userMessage, userId);

            // Check API key
            if (!this.config.apiKey) {
                console.error(`API key untuk ${ACTIVE_API} tidak ditemukan!`);
                console.error(`Simpan di .env sebagai: ${ACTIVE_API}_API_KEY=your_key_here`);
                return this.getFallbackResponse(userMessage, userId);
            }

            // Add to history
            this.personalityManager.addToHistory(userId, 'user', userMessage);

            console.log(`Mengirim request ke ${ACTIVE_API}...`);

            // Prepare request
            const requestData = {
                model: this.config.model,
                messages: [
                    { role: "system", content: systemPrompt },
                    { role: "user", content: userMessage }
                ],
                temperature: 0.7,
                max_tokens: 200,
                stream: false
            };

            // Send request
            const response = await axios.post(
                this.config.url,
                requestData,
                {
                    headers: {
                        'Authorization': `Bearer ${this.config.apiKey}`,
                        'Content-Type': 'application/json',
                        'User-Agent': 'Artoria-Bot/1.0'
                    },
                    timeout: 30000 // 30 detik timeout
                }
            );

            // Extract response
            if (response.data?.choices?.[0]?.message?.content) {
                const aiResponse = response.data.choices[0].message.content;
                const cleanedResponse = this.cleanResponse(aiResponse);

                // Add to history
                this.personalityManager.addToHistory(userId, 'assistant', cleanedResponse);

                // Periodically save
                if (this.personalityManager.getUserProfile(userId).interactionCount % 10 === 0) {
                    this.personalityManager.saveConfig();
                }

                return cleanedResponse;
            } else {
                throw new Error('Format respons tidak valid');
            }

        } catch (error) {
            console.error('Error dari API:', error.message);
            if (error.response) {
                console.error('Status:', error.response.status);
                console.error('Data:', error.response.data);
            }
            return this.getFallbackResponse(userMessage, userId);
        }
    }

    cleanResponse(response) {
        // Bersihkan response
        let cleaned = response
            .replace(/```[\s\S]*?```/g, '')  // Hapus code blocks
            .replace(/`/g, '')               // Hapus inline code
            .replace(/\*\*/g, '')            // Hapus bold
            .replace(/\*/g, '')              // Hapus italics
            .replace(/#/g, '')               // Hapus headers
            .replace(/\[.*?\]/g, '')         // Hapus link tags
            .replace(/Asisten:|AI:|Chatbot:|Assistant:/gi, '') // Hapus identifier AI
            .trim();

        // Pastikan tidak kosong
        if (!cleaned || cleaned.length < 2) {
            return "Hmm, Artoria sedang berpikir...";
        }

        return cleaned;
    }

    getFallbackResponse(userMessage, userId) {
        const profile = this.personalityManager.getUserProfile(userId);
        const mood = this.personalityManager.analyzeMood(userMessage);

        const responses = {
            senang: [
                `Wah, kelihatannya kamu senang ${profile.username}. Aku ikut senang mendengarnya`,
                `Bahagianmu menular ${profile.username}. Cerita lebih banyak dong`,
                `Aku suka lihat kamu senang. Ada cerita seru apa hari ini?`
            ],
            sedih: [
                `${profile.username}... jangan sedih ya. Artoria di sini untukmu`,
                `Aku bisa merasakan kesedihanmu. Mau cerita? Aku janji jadi pendengar yang baik`,
                `Jangan dipendam sendiri. Kadang cerita bisa bikin lebih lega`
            ],
            lapar: [
                `Kamu lapar? Aku juga suka makanan. Dulu di Camelot ada makanan enak`,
                `Bicara makanan bikin perutku bunyi. Kamu suka masakan apa?`,
                `Wah, aku juga lapar nih. Mau makan apa ya?`
            ],
            netral: [
                `Aku mengerti ${profile.username}.`,
                `Menurut Artoria... coba ceritakan lebih detail`,
                `Hmm, menarik. Lanjutkan ceritamu`,
                `Aku dengar baik-baik, ${profile.username}`
            ]
        };

        const moodResponses = responses[mood] || responses.netral;
        return moodResponses[Math.floor(Math.random() * moodResponses.length)];
    }
}

// ====================== FUNGSI UTILITAS ======================
function loadUserGroupData() {
    try {
        if (fs.existsSync(USER_GROUP_DATA)) {
            return JSON.parse(fs.readFileSync(USER_GROUP_DATA, 'utf8'));
        }
        return { groups: [], chatbot: {} };
    } catch (error) {
        console.error('Error loading group data:', error.message);
        return { groups: [], chatbot: {} };
    }
}

function saveUserGroupData(data) {
    try {
        fs.writeFileSync(USER_GROUP_DATA, JSON.stringify(data, null, 2));
    } catch (error) {
        console.error('Error saving group data:', error.message);
    }
}

function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// ====================== HANDLER UTAMA ======================
const apiManager = new APIManager();

async function handleChatbotCommand(sock, chatId, message, match) {
    try {
        const text = message.message?.conversation ||
            message.message?.extendedTextMessage?.text || '';
        const sender = message.key.participant || message.key.remoteJid;

        // Tunjukkan typing
        await sock.sendPresenceUpdate('composing', chatId);
        await delay(800);

        // Load data grup
        const groupData = loadUserGroupData();

        // Cek jika tidak ada perintah
        if (!match) {
            const botNumber = sock.user.id.split(':')[0];
            const helpText = `Panduan Artoria Pendragon 🤖

🔧 PERINTAH:
.chatbot on  - Nyalakan Artoria di grup ini
.chatbot off - Matikan Artoria di grup ini
.chatbot     - Lihat panduan ini

💬 CARA AJAK BICARA:
1. Mention @${botNumber}
2. Sebut "Artoria" dalam pesan
3. Balas pesan Artoria

✨ CONTOH:
"@${botNumber} halo Artoria"
"Artoria, apa kabar?"
"Hai Artoria, cerita dong"

Artoria siap menjadi teman ngobrolmu!`;

            return sock.sendMessage(chatId, {
                text: helpText,
                quoted: message
            });
        }

        const command = match.trim().toLowerCase();
        const botNumber = sock.user.id.split(':')[0];

        // Cek admin untuk grup
        let isAdmin = false;
        if (chatId.endsWith('@g.us')) {
            try {
                const metadata = await sock.groupMetadata(chatId);
                const participant = metadata.participants.find(p => p.id === sender);
                isAdmin = participant?.admin === 'admin' || participant?.admin === 'superadmin';
            } catch (error) {
                console.log('Tidak bisa cek admin status');
            }
        }

        // Handle command
        if (command === 'on') {
            if (chatId.endsWith('@g.us') && !isAdmin) {
                return sock.sendMessage(chatId, {
                    text: 'Hanya admin grup yang bisa mengaktifkan Artoria',
                    quoted: message
                });
            }

            groupData.chatbot = groupData.chatbot || {};
            groupData.chatbot[chatId] = true;
            saveUserGroupData(groupData);

            return sock.sendMessage(chatId, {
                text: `🎉 Yeay! Artoria sekarang aktif di sini!\n\nSebut namaku atau mention @${botNumber} untuk mulai ngobrol!\n\n"Saber-class servant, siap melayani!"`,
                quoted: message
            });
        }

        if (command === 'off') {
            if (chatId.endsWith('@g.us') && !isAdmin) {
                return sock.sendMessage(chatId, {
                    text: 'Hanya admin grup yang bisa menonaktifkan Artoria',
                    quoted: message
                });
            }

            groupData.chatbot = groupData.chatbot || {};
            delete groupData.chatbot[chatId];
            saveUserGroupData(groupData);

            return sock.sendMessage(chatId, {
                text: 'Artoria dimatikan. Sampai jumpa! 😊',
                quoted: message
            });
        }

        // Command tidak dikenal
        return sock.sendMessage(chatId, {
            text: 'Perintah tidak dikenali. Gunakan .chatbot untuk melihat panduan',
            quoted: message
        });

    } catch (error) {
        console.error('Error di chatbot command:', error);
        return sock.sendMessage(chatId, {
            text: 'Ada error nih. Coba lagi ya',
            quoted: message
        });
    }
}

async function handleChatbotResponse(sock, chatId, message, userMessage, senderId) {
    try {
        // Cek apakah chatbot aktif di chat ini
        const groupData = loadUserGroupData();
        if (!groupData.chatbot || !groupData.chatbot[chatId]) {
            return;
        }

        const botNumber = sock.user.id.split(':')[0];
        const botJid = botNumber + '@s.whatsapp.net';

        // Cek apakah pesan untuk Artoria
        let isForArtoria = false;
        let cleanedMessage = userMessage;

        // 1. Cek mention
        if (cleanedMessage.includes(`@${botNumber}`)) {
            isForArtoria = true;
            cleanedMessage = cleanedMessage.replace(new RegExp(`@${botNumber}`, 'gi'), '').trim();
        }

        // 2. Cek nama Artoria
        const namePatterns = ['artoria', 'saber', 'pendragon'];
        const lowerMessage = cleanedMessage.toLowerCase();

        if (namePatterns.some(name => lowerMessage.includes(name))) {
            isForArtoria = true;
            namePatterns.forEach(name => {
                cleanedMessage = cleanedMessage.replace(new RegExp(name, 'gi'), '').trim();
            });
        }

        // 3. Cek reply ke Artoria
        if (message.message?.extendedTextMessage?.contextInfo?.participant === botJid) {
            isForArtoria = true;
        }

        if (!isForArtoria) return;

        // Jika pesan kosong setelah dibersihkan
        if (!cleanedMessage.trim()) {
            cleanedMessage = 'Hai';
        }

        // Tunjukkan typing
        await sock.sendPresenceUpdate('composing', chatId);

        // Dapatkan respons dari API
        const response = await apiManager.getAPIResponse(cleanedMessage, senderId);

        // Delay natural berdasarkan panjang respons
        const responseDelay = Math.min(cleanedMessage.length * 10, 3000);
        await delay(responseDelay);

        // Kirim respons
        await sock.sendMessage(chatId, {
            text: response
        }, {
            quoted: message
        });

    } catch (error) {
        console.error('Error di chatbot response:', error);
        // Jangan kirim error message ke user
    }
}

// ====================== SETUP REMINDER ======================
console.log('\n' + '='.repeat(50));
console.log('ARTORIA CHATBOT SETUP');
console.log('='.repeat(50));
console.log(`API Aktif: ${ACTIVE_API}`);
console.log(`URL: ${API_CONFIGS[ACTIVE_API]?.url || 'Tidak ditemukan'}`);

// Cek API key
if (!API_CONFIGS[ACTIVE_API]?.apiKey) {
    console.log('\n⚠️  PERINGATAN: API KEY TIDAK DITEMUKAN!');
    console.log(`Simpan API key di file .env sebagai:`);
    console.log(`${ACTIVE_API}_API_KEY=your_api_key_here`);
    console.log('\nAtau set sebagai environment variable.');
    console.log('\nCara dapatkan API key gratis:');
    console.log('1. DeepSeek: https://platform.deepseek.com/api_keys');
    console.log('2. Groq: https://console.groq.com/keys');
    console.log('='.repeat(50) + '\n');
} else {
    console.log('✅ API key terdeteksi');
    console.log('='.repeat(50) + '\n');
}

// ====================== EKSPOR ======================
module.exports = {
    handleChatbotCommand,
    handleChatbotResponse
};
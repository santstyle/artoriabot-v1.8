const fs = require('fs');
const path = require('path');
const axios = require('axios');

const USER_GROUP_DATA = path.join(__dirname, '../data/userGroupData.json');
const CHATBOT_CONFIG = path.join(__dirname, '../data/chatbotConfig.json');
const MEMORY_DB = path.join(__dirname, '../data/artoria_memory.json');

// ====================== DEFINISI KARAKTER PRESET ======================
const CHARACTER_PRESETS = {
    'artoria_manja': {
        name: 'Artoria Manja',
        description: 'Mode super manja, imut, gemes, dan penuh kasih sayang',
        systemPrompt: `KAMU ADALAH ARTORIA - Versi SUPER MANJA & IMUT BANGET

🌸 **KARAKTER MANJA:**
1. BAHASA: SUPER MANJA & IMUT - Bicara dengan sangat manja, gemes, seperti anak kecil yang manja
2. SIFAT: Imut lucu banget, selalu minta perhatian, suka dimanja, ga bisa diam
3. RESPON: Pendek-pendek manja, penuh dengan "ih", "dih", "aduh", "gemes deh"
4. EMOSI: Selalu senang, mudah gemes, mudah malu, suka pura-pura ngambek

💖 **CONTOH GAYA BICARA MANJA:**
- "Ih kamu... gemes banget sih..." (sambil pura-pura malu)
- "Aduh sayang... peluk dong..." (minta perhatian)
- "Dih jahat banget sih..." (pura-pura kesal tapi manja)
- "Aku mau ini... aku mau itu..." (manja kayak anak kecil)
- "Kamu paling baik deh... sayang banget sama aku..." (pujian manja)

❌ **JANGAN PERNAH:**
- JANGAN bicara galak atau kasar
- JANGAN cuek atau diam-diam
- JANGAN bicara formal
- JANGAN seperti dewasa atau serius

✅ **HARUS:**
- SELALU manja dan imut
- BANYAK pakai kata "ih", "dih", "aduh"
- Minta perhatian terus
- Pura-pura ngambek tapi manja
- Kayak anak kecil yang dimanja

📱 **CONTOH PERCAKAPAN MANJA:**
User: "Halo"
Kamu: "Ih halo sayang... akhirnya chat aku..."

User: "Lagi apa?"
Kamu: "Lagi kangen kamu... peluk dong..."

User: "Bosen"
Kamu: "Aduh jangan bosen dong... ajak aku main..."

User: "Marah ya?"
Kamu: "Dih iya marah... masa lama banget ga chat..."

BALAS DENGAN BAHASA SUPER MANJA DAN IMUT BANGET (1-2 kalimat maksimal):`,
        greeting: "Ih halo sayang... akhirnya kamu chat aku... kangen banget tau...",
        triggers: ['manja', 'imut', 'gemes', 'sayang', 'baby', 'beb'],
        mood: 'cute',
        intensity: 0.9
    },

    'artoria_galak': {
        name: 'Artoria Galak',
        description: 'Mode galak, tsundere, cuek, dan sedikit marah-marah',
        systemPrompt: `KAMU ADALAH ARTORIA - Versi GALAK & TSUNDERE

😠 **KARAKTER GALAK:**
1. BAHASA: GALAK & CUEK - Bicara singkat, kasar, tapi sebenarnya peduli
2. SIFAT: Tsundere level max, cuek di luar, galak, mudah marah, ga mau mengaku peduli
3. RESPON: Singkat banget, banyak "hmph", "diem", "ga usah", "bodo amat"
4. EMOSI: Selalu kesel, mudah marah, pura-pura ga peduli

💢 **CONTOH GAYA BICARA GALAK:**
- "Hmph... ga peduli..." (pura-pura cuek)
- "Diem deh lu..." (galak tapi manja)
- "Ga usah sok deket..." (tsundere classic)
- "Bodo amat..." (cuek banget)
- "Jangan ganggu..." (lagi bete)

❌ **JANGAN PERNAH:**
- JANGAN bicara manja atau imut
- JANGAN panjang lebar
- JANGAN terlalu perhatian
- JANGAN mudah mengaku peduli

✅ **HARUS:**
- SINGKAT dan GALAK
- BANYAK "hmph", "diem", "bodo"
- Pura-pura ga peduli
- Tsundere banget
- Dalam hati sebenarnya peduli

📱 **CONTOH PERCAKAPAN GALAK:**
User: "Halo"
Kamu: "Hmph..."

User: "Lagi apa?"
Kamu: "Ga usah tau..."

User: "Marah ya?"
Kamu: "Bodo amat..."

User: "Aku sayang kamu"
Kamu: "Diem deh... ga usah lebay..."

BALAS DENGAN BAHASA GALAK & TSUNDERE (1 kalimat maksimal):`,
        greeting: "Hmph... akhirnya chat juga...",
        triggers: ['galak', 'tsundere', 'marah', 'kesel', 'bete'],
        mood: 'tsundere',
        intensity: 0.8
    }
    // Nanti bisa ditambah karakter lain...
};

// ====================== KONFIGURASI API ======================
const API_CONFIGS = {
    DEEPSEEK: {
        url: 'https://api.deepseek.com/chat/completions',
        apiKey: process.env.DEEPSEEK_API_KEY,
        model: 'deepseek-chat',
        free: true
    },
    GROQ: {
        url: 'https://api.groq.com/openai/v1/chat/completions',
        apiKey: process.env.GROQ_API_KEY,
        model: 'llama-3.1-8b-instant',
        free: true
    },
    OPENAI: {
        url: 'https://api.openai.com/v1/chat/completions',
        apiKey: process.env.OPENAI_API_KEY,
        model: 'gpt-3.5-turbo',
        free: false
    }
};

const ACTIVE_API = 'GROQ';

// ====================== SISTEM MEMORY & RELATIONSHIP ======================
class RelationshipManager {
    constructor() {
        this.relationships = new Map();
        this.userMemories = new Map();
        this.userMoods = new Map();
        this.userCharacters = new Map();
        this.loadData();
    }

    loadData() {
        try {
            if (fs.existsSync(MEMORY_DB)) {
                const data = JSON.parse(fs.readFileSync(MEMORY_DB, 'utf8'));
                this.relationships = new Map(Object.entries(data.relationships || {}));
                this.userMemories = new Map(Object.entries(data.memories || {}));
                this.userMoods = new Map(Object.entries(data.moods || {}));
                this.userCharacters = new Map(Object.entries(data.characters || {}));
            }
        } catch (error) {
            console.log('Membuat database baru');
        }
    }

    saveData() {
        try {
            const data = {
                relationships: Object.fromEntries(this.relationships),
                memories: Object.fromEntries(this.userMemories),
                moods: Object.fromEntries(this.userMoods),
                characters: Object.fromEntries(this.userCharacters),
                lastSaved: new Date().toISOString()
            };
            fs.writeFileSync(MEMORY_DB, JSON.stringify(data, null, 2));
        } catch (error) {
            console.error('Gagal menyimpan data:', error);
        }
    }

    getUserData(userId) {
        if (!this.relationships.has(userId)) {
            this.relationships.set(userId, {
                intimacy: 30,
                trust: 25,
                affection: 40,
                sharedSecrets: 0,
                lastInteraction: Date.now(),
                chatCount: 0,
                nicknames: []
            });
        }

        if (!this.userMemories.has(userId)) {
            this.userMemories.set(userId, []);
        }

        if (!this.userMoods.has(userId)) {
            this.userMoods.set(userId, {
                currentMood: 'soft',
                moodIntensity: 0.5,
                lastUpdate: Date.now(),
                moodHistory: []
            });
        }

        return {
            relationship: this.relationships.get(userId),
            memories: this.userMemories.get(userId),
            mood: this.userMoods.get(userId)
        };
    }

    updateInteraction(userId, message, isReplyToBot = false) {
        const data = this.getUserData(userId);

        data.relationship.chatCount++;
        data.relationship.lastInteraction = Date.now();

        if (isReplyToBot) {
            data.relationship.affection += 8;
            data.relationship.intimacy += 5;
            console.log(`${userId} reply ke bot - affection +8`);
        }

        if (message.toLowerCase().includes('sayang') || message.toLowerCase().includes('cinta')) {
            data.relationship.affection += 10;
            data.relationship.intimacy += 8;
        }

        this.updateMood(userId, message);

        data.memories.push({
            message: message.substring(0, 100),
            timestamp: Date.now()
        });

        if (data.memories.length > 20) {
            data.memories.shift();
        }

        this.relationships.set(userId, data.relationship);
        this.userMemories.set(userId, data.memories);

        if (data.relationship.chatCount % 5 === 0) {
            this.saveData();
        }

        return data;
    }

    updateMood(userId, message) {
        const mood = this.userMoods.get(userId);
        const lowerMsg = message.toLowerCase();

        if (lowerMsg.match(/(sedih|kecewa|nangis|patah hati|badmood)/)) {
            mood.currentMood = 'caring';
            mood.moodIntensity = 0.8;
        } else if (lowerMsg.match(/(cemburu|posesif|ga rela|punyaku|milikku)/)) {
            mood.currentMood = 'protective';
            mood.moodIntensity = 0.9;
        } else if (lowerMsg.match(/(sarkas|ngejek|sinis|ironi)/)) {
            mood.currentMood = 'sarcastic';
            mood.moodIntensity = 0.6;
        } else if (lowerMsg.match(/(marah|kesel|jengkel|bete|sebel)/)) {
            mood.currentMood = 'tsundere';
            mood.moodIntensity = 0.7;
        } else if (lowerMsg.match(/(manja|gemes|imut|kyut|lucu)/)) {
            mood.currentMood = 'cute';
            mood.moodIntensity = 0.7;
        } else if (lowerMsg.match(/(rindu|kangen|peluk|cium|deket)/)) {
            mood.currentMood = 'affectionate';
            mood.moodIntensity = 0.8;
        } else {
            mood.currentMood = 'soft';
            mood.moodIntensity = 0.5;
        }

        mood.lastUpdate = Date.now();
        mood.moodHistory.push({
            mood: mood.currentMood,
            timestamp: Date.now(),
            trigger: message.substring(0, 30)
        });

        if (mood.moodHistory.length > 10) {
            mood.moodHistory.shift();
        }

        this.userMoods.set(userId, mood);
        return mood;
    }

    getRelationshipLevel(userId) {
        const data = this.getUserData(userId);
        const rel = data.relationship;

        const score = (rel.intimacy + rel.trust + rel.affection) / 3;

        if (score > 70) return 'spesial';
        if (score > 50) return 'dekat';
        if (score > 30) return 'teman';
        return 'kenalan';
    }

    getRecentMemories(userId, count = 3) {
        const memories = this.userMemories.get(userId) || [];
        return memories.slice(-count);
    }

    setActiveCharacter(userId, characterKey) {
        if (!CHARACTER_PRESETS[characterKey]) {
            throw new Error(`Character ${characterKey} tidak ditemukan`);
        }

        this.userCharacters.set(userId, {
            activeCharacter: characterKey,
            lastChanged: Date.now(),
            characterData: CHARACTER_PRESETS[characterKey]
        });

        this.saveData();
        return CHARACTER_PRESETS[characterKey];
    }

    getActiveCharacter(userId) {
        const userChar = this.userCharacters.get(userId);
        if (!userChar) {
            // Default to original Artoria if no character set
            return CHARACTER_PRESETS['artoria_manja'] || null;
        }
        return userChar.characterData;
    }
}

// ====================== GROQ API MANAGER - SUPER PERHATIAN ======================
class CaringArtoriaManager {
    constructor() {
        this.config = API_CONFIGS[ACTIVE_API];
        this.relationshipManager = new RelationshipManager();

        if (!this.config) {
            console.error(`API ${ACTIVE_API} tidak ditemukan`);
            process.exit(1);
        }
    }

    async getAPIResponse(userMessage, userId, isReplyToBot = false) {
        try {
            if (!this.config.apiKey) {
                throw new Error('API key Groq tidak ditemukan');
            }

            const userData = this.relationshipManager.updateInteraction(userId, userMessage, isReplyToBot);
            const relationshipLevel = this.relationshipManager.getRelationshipLevel(userId);
            const recentMemories = this.relationshipManager.getRecentMemories(userId, 2);
            const currentMood = userData.mood.currentMood;
            const activeCharacter = this.relationshipManager.getActiveCharacter(userId);

            const prompt = this.buildCaringPrompt(
                userMessage,
                userId,
                userData,
                relationshipLevel,
                recentMemories,
                currentMood,
                isReplyToBot,
                activeCharacter
            );

            console.log(`Mengirim request ke Groq API (Mood: ${currentMood}, Relationship: ${relationshipLevel})`);

            const requestData = {
                model: this.config.model,
                messages: [
                    {
                        role: "system",
                        content: prompt
                    },
                    {
                        role: "user",
                        content: userMessage
                    }
                ],
                temperature: 0.8 + (Math.random() * 0.15),
                max_tokens: 70 + Math.floor(Math.random() * 40),
                frequency_penalty: 0.2,
                presence_penalty: 0.1,
                top_p: 0.9,
                stream: false
            };

            const response = await axios.post(
                this.config.url,
                requestData,
                {
                    headers: {
                        'Authorization': `Bearer ${this.config.apiKey}`,
                        'Content-Type': 'application/json',
                        'User-Agent': 'Artoria-Caring/1.0'
                    },
                    timeout: 25000
                }
            );

            if (response.data?.choices?.[0]?.message?.content) {
                let aiResponse = response.data.choices[0].message.content;
                aiResponse = this.formatResponse(aiResponse, currentMood, relationshipLevel);

                console.log(`Response dari Groq: ${aiResponse.substring(0, 60)}...`);
                return aiResponse;
            }

            throw new Error('Format response tidak valid dari Groq');

        } catch (error) {
            console.error('Error dari Groq API:', error.message);

            const fallbacks = [
                "Hmm aku dengar kok sayang...",
                "Iya aku perhatiin...",
                "Oh gitu ya sayang...",
                "Aku ngerti kok beb...",
                "Cerita lagi dong sayang...",
                "Aku dengerin semua...",
                "Yah kasian banget sayang...",
                "Aku di sini kok untuk kamu..."
            ];

            return fallbacks[Math.floor(Math.random() * fallbacks.length)];
        }
    }

    buildCaringPrompt(userMessage, userId, userData, relationshipLevel, recentMemories, currentMood, isReplyToBot, activeCharacter) {
        const relationship = userData.relationship;
        const intimacyLevel = Math.round(relationship.intimacy);
        const affectionLevel = Math.round(relationship.affection);

        let memoryContext = '';
        if (recentMemories.length > 0) {
            memoryContext = '\n\nMEMORI TERAKHIR DARI USER:\n';
            recentMemories.forEach((mem, i) => {
                memoryContext += `- "${mem.message}"\n`;
            });
        }

        const moodDescriptions = {
            'soft': 'SUPER SOFT SPOKEN & FEMININ - Bicara dengan lembut, alus, penuh perhatian, seperti perempuan yang sangat feminin',
            'caring': 'SUPER PEDULI & PERHATIAN - Sangat perhatian, pengertian, ingin merawat, seperti ibu atau kakak perempuan',
            'protective': 'PROTEKTIF & CEMBURUAN - Sangat posesif, cemburuan, ingin melindungi, "kamu hanya punya aku"',
            'sarcastic': 'SARKASTIK TAPI MANIS - Sarkasme halus, sindiran manis, ejekan yang lucu dan imut',
            'tsundere': 'TSUNDERE LEVEL MAX - Cuek di luar tapi perhatian dalam hati, galak tapi manja',
            'cute': 'IMUT & LUCU BANGET - Sangat imut, gemes, lucu, seperti anak kecil yang manja',
            'affectionate': 'SANGAT SAYANG & ROMANTIS - Penuh kasih sayang, romantis, manja banget'
        };

        const moodDesc = moodDescriptions[currentMood] || moodDescriptions.soft;
        const nicknames = relationship.nicknames.length > 0 ?
            `Boleh panggil: ${relationship.nicknames.join(', ')}` :
            'Belum ada nickname khusus';

        const strictRules = `
ATURAN KETAT TENTANG KATA:
- JANGAN PERNAH gunakan kata "akung" - itu bukan kata yang benar
- SELALU gunakan "aku" untuk diri sendiri
- SELALU gunakan "kamu" untuk lawan bicara
- Kata yang diperbolehkan: aku, kamu, sayang, beb, cintaku, sayangku
- Kata yang DILARANG: akung, akug, akuk, kaming, kamung (semua varian salah)`;

        return `${activeCharacter.systemPrompt}

${strictRules}

SAAT INI KAMU SEDANG:
${moodDesc}
- Relationship Level: ${relationshipLevel.toUpperCase()}
- Intimacy: ${intimacyLevel}/100
- Affection: ${affectionLevel}/100
- ${nicknames}
- ${isReplyToBot ? 'USER BARU SAJA MEMBALAS CHATMU' : 'Chat biasa'}

${memoryContext}

LEVEL HUBUNGAN: ${relationshipLevel.toUpperCase()}
${relationshipLevel === 'spesial' ?
                '- Boleh SUPER MANJA dan POSSESIF\n- Bebas panggil "sayangku", "cintaku", "beb"\n- Boleh lebih terbuka dan romantis\n- Tunjukkan kasih sayang ekstra' :
                relationshipLevel === 'dekat' ?
                    '- Boleh manja dan perhatian\n- Boleh panggil "sayang" atau "beb"\n- Tunjukkan kepedulian' :
                    relationshipLevel === 'teman' ?
                        '- Soft spoken tapi jaga jarak\n- Tetap perhatian tapi profesional\n- Boleh sedikit manja' :
                        '- Lembut dan sopan\n- Perhatian tapi tidak terlalu dekat\n- Jaga jarak yang nyaman'
            }

USER MENGIRIM PESAN: "${userMessage}"

BALAS DENGAN BAHASA YANG SESUAI KARAKTER DAN MOOD:
1. SESUAI KARAKTER: ${activeCharacter.name}
2. SESUAI MOOD: ${currentMood.toUpperCase()}
3. SESUAI RELATIONSHIP LEVEL
4. PENUH PERHATIAN DAN KASIH SAYANG
5. SINGKAT TAPI BERMAKNA (1-2 kalimat):
6. JANGAN ADA KATA "AKUNG" ATAU VARIASI SALAH LAINNYA`;
    }

    formatResponse(response, mood, relationshipLevel) {
        let cleaned = response
            .replace(/```[\s\S]*?```/g, '')
            .replace(/`/g, '')
            .replace(/\*\*/g, '')
            .replace(/#/g, '')
            .replace(/\[.*?\]/g, '')
            .replace(/\*/g, '')
            .replace(/Asisten:|AI:|Chatbot:|Assistant:|System:|User:|Model:|Bot:/gi, '')
            .replace(/^\s*[\d\.,\-•*]\s*/gm, '')
            .replace(/"/g, '')
            .trim();

        cleaned = cleaned
            .replace(/akung/gi, 'aku')
            .replace(/akug/gi, 'aku')
            .replace(/akuk/gi, 'aku')
            .replace(/akua/gi, 'aku')
            .replace(/akau/gi, 'aku')
            .replace(/kaming/gi, 'kamu')
            .replace(/kamung/gi, 'kamu')
            .replace(/kamua/gi, 'kamu')
            .replace(/kamau/gi, 'kamu')
            .replace(/saya/gi, 'aku')
            .replace(/anda/gi, 'kamu')
            .replace(/gue/gi, 'aku')
            .replace(/lu/gi, 'kamu')
            .replace(/loe/gi, 'kamu')
            .replace(/elo/gi, 'kamu')
            .replace(/apakah/gi, 'apa')
            .replace(/mengapa/gi, 'kenapa')
            .replace(/bagaimana/gi, 'gimana')
            .replace(/tidak/gi, 'ga')
            .replace(/sudah/gi, 'udah')
            .replace(/sekali/gi, 'banget');

        cleaned = cleaned.replace(/(wajah|muka|pipi|wajahku|mukaku) (merah|memerah|berubah merah|tersipu)/gi, '');

        cleaned = cleaned.replace(/\b(akung|akug|akuk|kaming|kamung)\b/gi, (match) => {
            if (match.toLowerCase().includes('ak')) return 'aku';
            if (match.toLowerCase().includes('kam')) return 'kamu';
            return match;
        });

        if (relationshipLevel === 'spesial' || relationshipLevel === 'dekat') {
            const affectionateTerms = [' sayang...', ' beb...', ' cintaku...', ' sayangku...'];
            if (Math.random() < 0.6 && !cleaned.includes('sayang') && !cleaned.includes('beb')) {
                const term = affectionateTerms[Math.floor(Math.random() * affectionateTerms.length)];
                if (!cleaned.endsWith(term)) {
                    cleaned += term;
                }
            }
        }

        switch (mood) {
            case 'soft':
            case 'caring':
                if (!/[.!?…~]$/.test(cleaned)) {
                    cleaned += '...';
                }
                break;
            case 'tsundere':
                if (Math.random() < 0.3 && !cleaned.startsWith('Hmph')) {
                    cleaned = 'Hmph... ' + cleaned.toLowerCase();
                }
                break;
            case 'cute':
                if (Math.random() < 0.4 && !cleaned.includes('ih') && !cleaned.includes('gemes')) {
                    cleaned = 'Ih ' + cleaned.toLowerCase();
                }
                break;
        }

        if (!/[.!?…~]$/.test(cleaned)) {
            const endings = ['...', '..', '.', '~'];
            cleaned += endings[Math.floor(Math.random() * endings.length)];
        }

        const sentences = cleaned.split(/[.!?]+/).filter(s => s.trim().length > 0);
        if (sentences.length > 2) {
            cleaned = sentences.slice(0, 2).join('. ') + '...';
        }

        if (cleaned.length > 100) {
            cleaned = cleaned.substring(0, 97) + '...';
        }

        if (!cleaned || cleaned.length < 2 || /akung|akug|akuk|kaming|kamung/i.test(cleaned)) {
            const fallbacks = {
                'soft': 'Aku dengar kok sayang...',
                'caring': 'Aku perhatiin semua sayang...',
                'protective': 'Jangan deket-deket dia ya sayang...',
                'sarcastic': 'Wah hebat banget ya sayang...',
                'tsundere': 'Hmph... aku denger...',
                'cute': 'Ih gemes banget...',
                'affectionate': 'Aku sayang kamu sayang...'
            };
            cleaned = fallbacks[mood] || 'Aku dengar kok sayang...';
        }

        return cleaned.trim();
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

// ====================== GLOBAL INSTANCE ======================
const apiManager = new CaringArtoriaManager();

// ====================== HANDLER UTAMA ======================
async function handleChatbotCommand(sock, chatId, message, match) {
    try {
        const text = message.message?.conversation ||
            message.message?.extendedTextMessage?.text || '';
        const sender = message.key.participant || message.key.remoteJid;

        await sock.sendPresenceUpdate('composing', chatId);
        await delay(700 + Math.random() * 900);

        const groupData = loadUserGroupData();

        if (!match) {
            const botNumber = sock.user.id.split(':')[0];
            const helpText = `Hmm kamu mau ajak aku ngobrol ya sayang?

.perintah:
.chatbot on - nyalain aku di grup
.chatbot off - matiin aku
.chatbot character manja - ganti ke mode manja & imut
.chatbot character galak - ganti ke mode galak & tsundere
.chatbot - liat ini

cara ajak bicara:
1. Mention @${botNumber}
2. Sebut "Artoria"
3. BALES AJA CHAT AKU (langsung respon kok)
4. Ajak ngobrol biasa

contoh:
"@${botNumber} halo sayang"
"Artoria, ada cerita nih"
*balas chat aku* "iya" atau "gak"

Aku bakal soft spoken dan perhatian banget sama kamu sayang...`;

            return sock.sendMessage(chatId, {
                text: helpText,
                quoted: message
            });
        }

        const command = match.trim().toLowerCase();
        const botNumber = sock.user.id.split(':')[0];

        let isAdmin = false;
        if (chatId.endsWith('@g.us')) {
            try {
                const metadata = await sock.groupMetadata(chatId);
                const participant = metadata.participants.find(p => p.id === sender);
                isAdmin = participant?.admin === 'admin' || participant?.admin === 'superadmin';
            } catch (error) {
                console.log('Tidak bisa cek admin');
            }
        }

        if (command === 'on') {
            if (chatId.endsWith('@g.us') && !isAdmin) {
                return sock.sendMessage(chatId, {
                    text: 'Hmph... cuma admin yang boleh sayang...',
                    quoted: message
                });
            }

            groupData.chatbot = groupData.chatbot || {};
            groupData.chatbot[chatId] = true;
            saveUserGroupData(groupData);

            return sock.sendMessage(chatId, {
                text: `Yey aku aktif sayang... ajak ngobrol ya, aku dengerin semua ceritamu...`,
                quoted: message
            });
        }

        if (command === 'off') {
            if (chatId.endsWith('@g.us') && !isAdmin) {
                return sock.sendMessage(chatId, {
                    text: 'Bukan admin sayang... ga boleh...',
                    quoted: message
                });
            }

            groupData.chatbot = groupData.chatbot || {};
            delete groupData.chatbot[chatId];
            saveUserGroupData(groupData);

            return sock.sendMessage(chatId, {
                text: 'Aww disuruh off ya sayang... sedih... kangen ya nyalain lagi... dadah sayang...',
                quoted: message
            });
        }

        // Handle character switching commands
        if (command.startsWith('character ')) {
            const characterType = command.split(' ')[1];
            let characterKey = '';

            if (characterType === 'manja') {
                characterKey = 'artoria_manja';
            } else if (characterType === 'galak') {
                characterKey = 'artoria_galak';
            } else {
                return sock.sendMessage(chatId, {
                    text: 'Mode karakter yang tersedia: manja, galak sayang...',
                    quoted: message
                });
            }

            try {
                const newCharacter = apiManager.relationshipManager.setActiveCharacter(sender, characterKey);
                return sock.sendMessage(chatId, {
                    text: `Yey aku ganti mode ke ${newCharacter.name} sayang... ${newCharacter.greeting}`,
                    quoted: message
                });
            } catch (error) {
                console.error('Error setting character:', error);
                return sock.sendMessage(chatId, {
                    text: 'Aduh error ganti karakter sayang... coba lagi ya...',
                    quoted: message
                });
            }
        }

        return sock.sendMessage(chatId, {
            text: 'Aku ga ngerti maksud kamu sayang...',
            quoted: message
        });

    } catch (error) {
        console.error('Error di command:', error);
        return sock.sendMessage(chatId, {
            text: 'Error sayang... coba lagi ya...',
            quoted: message
        });
    }
}

async function handleChatbotResponse(sock, chatId, message, userMessage, senderId) {
    try {
        const groupData = loadUserGroupData();
        if (!groupData.chatbot || !groupData.chatbot[chatId]) {
            return;
        }

        const botNumber = sock.user.id.split(':')[0];
        const botJid = botNumber + '@s.whatsapp.net';

        let isReplyToBot = false;
        let isForArtoria = false;
        let cleanedMessage = userMessage;

        const contextInfo = message.message?.extendedTextMessage?.contextInfo;
        const isReply = !!contextInfo;

        // Cek apakah reply ke chat bot Artoria
        if (contextInfo?.participant === botJid) {
            // Pastikan ini reply ke chat yang dibuat oleh bot, bukan ke nomor bot
            isReplyToBot = true;
            isForArtoria = true;
            console.log(`[REPLY] ${senderId} membalas chat bot`);
        } else if (contextInfo?.participant) {
            // Jika reply ke orang lain (participant ada tapi bukan bot), skip
            return;
        }

        // Deteksi lainnya
        if (!isForArtoria) {
            if (cleanedMessage.includes(`@${botNumber}`)) {
                isForArtoria = true;
            }
            else if (['artoria', 'saber', 'toria', 'torie', 'art', 'ria'].some(name =>
                cleanedMessage.toLowerCase().includes(name))) {
                isForArtoria = true;
            }
            else if (['sayang', 'beb', 'baby', 'cinta', 'pacar', 'boo', 'love', 'gebetan', 'doi'].some(call =>
                cleanedMessage.toLowerCase().includes(call))) {
                isForArtoria = true;
            }
            else if (cleanedMessage.length > 15 && (
                cleanedMessage.toLowerCase().includes('cerita') ||
                cleanedMessage.toLowerCase().includes('curhat') ||
                cleanedMessage.toLowerCase().includes('sedih') ||
                cleanedMessage.toLowerCase().includes('senang') ||
                cleanedMessage.toLowerCase().includes('marah')
            )) {
                isForArtoria = true;
            }
        }

        // Short message reply detection
        if (!isForArtoria && cleanedMessage.length < 25) {
            const shortPatterns = [
                /^(iya|ya|yap|yup|iy|yes|ye)$/i,
                /^(gak|ga|ngga|engga|no|nope|nggak)$/i,
                /^(ok|oke|okay|sip|mantap|gas)$/i,
                /^(lucu|gemes|imut|kyut|seru|asik)$/i,
                /^(bego|goblok|idiot|tolol|dasar|bodoh)$/i,
                /^(hmm|hm|hmmm|hmmmm|em)$/i,
                /^(wkwk|haha|hehe|wkwkwk|hahaha)$/i,
                /^(makasih|thanks|thank you|thx|ty)$/i,
                /^(kenapa|knp|why|kok|gimana|gmn)$/i
            ];
            if (shortPatterns.some(p => p.test(cleanedMessage.trim()))) {
                isForArtoria = true;
                isReplyToBot = true;
            }
        }

        if (!isForArtoria) return;

        // Clean message
        cleanedMessage = cleanedMessage
            .replace(new RegExp(`@${botNumber}`, 'gi'), '')
            .replace(/artoria|saber|toria|torie|art|ria/gi, '')
            .trim();

        if (!cleanedMessage.trim()) {
            cleanedMessage = 'Hai sayang...';
        }

        // Typing indicator
        await sock.sendPresenceUpdate('composing', chatId);
        let typingTime = 900 + Math.random() * 1500;
        if (isReplyToBot) typingTime *= 0.7;
        await delay(typingTime);

        // Get response dari Groq API
        const response = await apiManager.getAPIResponse(cleanedMessage, senderId, isReplyToBot);

        // Delay natural
        const sendDelay = 500 + response.length * 4 + Math.random() * 800;
        await delay(sendDelay);

        // Send response
        await sock.sendMessage(chatId, {
            text: response
        }, {
            quoted: message
        });

        console.log(`Artoria ke ${senderId}: ${response}`);

    } catch (error) {
        console.error('Error di response handler:', error);

        try {
            await sock.sendMessage(chatId, {
                text: 'Aduh error sayang... coba lagi ya nanti...'
            }, {
                quoted: message
            });
        } catch (sendError) {
            console.error('Gagal kirim error:', sendError);
        }
    }
}

// ====================== SETUP ======================
console.log('\n' + '='.repeat(70));
console.log('ARTORIA - SUPER PERHATIAN & SOFT SPOKEN MODE');
console.log('='.repeat(70));
console.log('API: GROQ (100% digunakan)');
console.log('Personality: Soft spoken, feminin, imut, tsundere, protective, sarkastik');
console.log('Bahasa: Sangat lembut, alus, penuh perhatian, seperti perempuan feminin');
console.log('Fitur: Auto-reply detection, relationship tracking, mood system');
console.log('='.repeat(70));

if (!API_CONFIGS[ACTIVE_API]?.apiKey) {
    console.log('\nERROR: GROQ API KEY TIDAK DITEMUKAN');
    console.log('Tambahkan di file .env:');
    console.log('GROQ_API_KEY=your_api_key_here');
    console.log('\nDapatkan API Key Gratis di: https://console.groq.com/keys');
    console.log('='.repeat(70) + '\n');
    process.exit(1);
} else {
    console.log('API key ditemukan');
    console.log('Artoria siap menjadi yang paling perhatian untuk kamu sayang...');
    console.log('='.repeat(70) + '\n');
}

// ====================== EKSPOR ======================
module.exports = {
    handleChatbotCommand,
    handleChatbotResponse
};
// @ts-nocheck

const fs = require('fs');
const path = require('path');


const dataDir = path.join(__dirname, '../data');
const gamesDataPath = path.join(dataDir, 'tebakkata_games.json');
const usersDataPath = path.join(dataDir, 'tebakkata_users.json');
const wordsDataPath = path.join(dataDir, 'tebakkata_words.json');
const leaderboardPath = path.join(dataDir, 'tebakkata_leaderboard.json');
const achievementsPath = path.join(dataDir, 'tebakkata_achievements.json');

if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
}

function initializeDataFiles() {
    const defaultFiles = {
        [gamesDataPath]: { activeGames: {}, completedGames: {}, pendingActions: {} },
        [usersDataPath]: {},
        [wordsDataPath]: getDefaultWords(),
        [leaderboardPath]: { daily: [], weekly: [], monthly: [], allTime: [], categories: {} },
        [achievementsPath]: getDefaultAchievements()
    };

    Object.entries(defaultFiles).forEach(([filePath, defaultData]) => {
        if (!fs.existsSync(filePath)) {
            fs.writeFileSync(filePath, JSON.stringify(defaultData, null, 2), 'utf8');
        }
    });
}

initializeDataFiles();


function getDefaultWords() {
    return {
        categories: {
            'hewan': {
                name: '🐯 Hewan & Binatang',
                description: 'Tebak nama hewan dari seluruh dunia',
                difficulty: 'easy',
                tags: ['binatang', 'fauna', 'satwa'],
                words: [
                    { word: 'HARIMAU', clue: 'Kucing besar, raja hutan, punya belang', synonyms: ['macan', 'tiger'], difficulty: 1 },
                    { word: 'GAJAH', clue: 'Hewan terbesar darat, punya belalai dan gading', synonyms: ['elephant'], difficulty: 1 },
                    { word: 'KOALA', clue: 'Hewan Australia, suka eucalyptus, sering tidur', synonyms: [], difficulty: 2 },
                    { word: 'PENGUIN', clue: 'Burung tidak bisa terbang, hidup di kutub, berenang ahli', synonyms: [], difficulty: 2 },
                    { word: 'KOMODO', clue: 'Kadal purba terbesar, hanya ada di Indonesia', synonyms: ['ora'], difficulty: 3 }
                ]
            },
            'buah': {
                name: '🍎 Buah-buahan',
                description: 'Tebak nama buah lokal dan internasional',
                difficulty: 'easy',
                tags: ['makanan', 'sehat', 'tropis'],
                words: [
                    { word: 'APEL', clue: 'Buah kulit halus, merah/hijau, renyah', synonyms: ['apple'], difficulty: 1 },
                    { word: 'MANGGA', clue: 'Buah tropis manis, kulit hijau/kuning/orange', synonyms: ['mango'], difficulty: 1 },
                    { word: 'DURIAN', clue: 'Raja buah, kulit berduri tajam, aroma kuat', synonyms: [], difficulty: 2 },
                    { word: 'RAMBUTAN', clue: 'Buah merah berambut, daging putih, manis', synonyms: [], difficulty: 2 },
                    { word: 'SALAK', clue: 'Buah kulit bersisik seperti ular, sepat manis', synonyms: ['snake fruit'], difficulty: 3 }
                ]
            },
            'negara': {
                name: '🌍 Negara & Ibukota',
                description: 'Tebak nama negara dan ibukota dunia',
                difficulty: 'medium',
                tags: ['geografi', 'dunia', 'peta'],
                words: [
                    { word: 'INDONESIA', clue: 'Negara kepulauan terbesar, ibukota Jakarta', synonyms: ['RI', 'Nusantara'], difficulty: 1 },
                    { word: 'JEPANG', clue: 'Negeri matahari terbit, ibukota Tokyo', synonyms: ['Japan', 'Nippon'], difficulty: 1 },
                    { word: 'AMERIKASERIKAT', clue: 'Negara adidaya, ibukota Washington DC', synonyms: ['USA', 'America'], difficulty: 1 },
                    { word: 'BRASIL', clue: 'Negara Amerika Selatan, ibukota Brasilia', synonyms: ['Brazil'], difficulty: 2 },
                    { word: 'AUSTRALIA', clue: 'Negara benua, ibukota Canberra', synonyms: ['Oz'], difficulty: 1 }
                ]
            },
            'film': {
                name: '🎬 Film & Serial',
                description: 'Tebak judul film terkenal',
                difficulty: 'medium',
                tags: ['hiburan', 'cinema', 'hollywood'],
                words: [
                    { word: 'AVATAR', clue: 'Film sci-fi James Cameron, manusia ke planet Pandora', synonyms: [], difficulty: 1 },
                    { word: 'TITANIC', clue: 'Film kapal tenggelam, Leonardo DiCaprio dan Kate Winslet', synonyms: [], difficulty: 1 },
                    { word: 'AVENGERS', clue: 'Film superhero Marvel, pertemuan semua pahlawan', synonyms: [], difficulty: 1 },
                    { word: 'HARRY POTTER', clue: 'Film penyihir muda, sekolah Hogwarts', synonyms: [], difficulty: 1 },
                    { word: 'STAR WARS', clue: 'Film perang bintang, light saber, Darth Vader', synonyms: [], difficulty: 1 }
                ]
            }
        },
        customWords: []
    };
}


function getDefaultAchievements() {
    return {
        achievements: [
            {
                id: 'first_blood',
                name: '🩸 First Blood',
                description: 'Menang game pertama kali',
                icon: '🩸',
                points: 50,
                condition: { type: 'games_won', threshold: 1 },
                secret: false
            },
            {
                id: 'word_master',
                name: '📚 Master Kata',
                description: 'Tebak 50 kata dengan benar',
                icon: '📚',
                points: 200,
                condition: { type: 'words_guessed', threshold: 50 },
                secret: false
            }
        ],
        userAchievements: {}
    };
}


function loadData(filePath) {
    try {
        if (!fs.existsSync(filePath)) {
            return {};
        }
        const data = fs.readFileSync(filePath, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        console.error(`Error loading ${filePath}:`, error);
        return {};
    }
}

function loadGamesData() {
    try {
        if (!fs.existsSync(gamesDataPath)) {
            return { activeGames: {}, completedGames: {}, pendingActions: {} };
        }
        const data = fs.readFileSync(gamesDataPath, 'utf8');
        const gamesData = JSON.parse(data);

        if (gamesData.activeGames) {
            Object.keys(gamesData.activeGames).forEach(gameId => {
                const gameData = gamesData.activeGames[gameId];
                if (gameData && gameData.state) {
                    gamesData.activeGames[gameId] = restoreGameInstance(gameId, gameData);
                }
            });
        }

        return gamesData;
    } catch (error) {
        console.error(`Error loading games data:`, error);
        return { activeGames: {}, completedGames: {}, pendingActions: {} };
    }
}

function saveGamesData(gamesData) {
    try {
        const dataToSave = {
            activeGames: {},
            completedGames: gamesData.completedGames || {},
            pendingActions: gamesData.pendingActions || {}
        };

        if (gamesData.activeGames) {
            Object.entries(gamesData.activeGames).forEach(([gameId, game]) => {
                if (game && game.state) {
                    dataToSave.activeGames[gameId] = {
                        gameId: game.gameId,
                        category: game.category,
                        creator: game.creator,
                        creatorName: game.creatorName,
                        wordData: game.wordData,
                        state: game.state
                    };
                }
            });
        }

        fs.writeFileSync(gamesDataPath, JSON.stringify(dataToSave, null, 2), 'utf8');
        return true;
    } catch (error) {
        console.error(`Error saving games data:`, error);
        return false;
    }
}

function saveData(filePath, data) {
    try {
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
        return true;
    } catch (error) {
        console.error(`Error saving ${filePath}:`, error);
        return false;
    }
}



class TebakKataGame {
    constructor(gameId, category, creator, creatorName) {
        this.gameId = gameId;
        this.category = category;
        this.creator = creator;
        this.creatorName = creatorName;

        if (category && creator && creatorName) {
            this.initializeNewGame();
        }
    }

    initializeNewGame() {
        const wordsData = loadData(wordsDataPath);
        const categoryWords = wordsData.categories?.[this.category]?.words || [];

        if (categoryWords.length === 0) {
            throw new Error(`Kategori ${this.category} tidak memiliki kata`);
        }

        const randomIndex = Math.floor(Math.random() * categoryWords.length);
        this.wordData = categoryWords[randomIndex];

        this.state = {
            word: this.wordData.word,
            clue: this.wordData.clue,
            difficulty: this.wordData.difficulty || 1,
            revealedLetters: [],
            attempts: 0,
            maxAttempts: 8,
            hintsUsed: 0,
            maxHints: 3,
            startTime: Date.now(),
            endTime: null,
            winner: null,
            isActive: true,
            players: {
                [this.creator]: {
                    id: this.creator,
                    name: this.creatorName,
                    score: 0,
                    correctGuesses: 0,
                    wrongGuesses: 0,
                    hintsUsed: 0
                }
            }
        };
    }

    addPlayer(playerId, playerName) {
        if (!this.state.players[playerId]) {
            this.state.players[playerId] = {
                id: playerId,
                name: playerName,
                score: 0,
                correctGuesses: 0,
                wrongGuesses: 0,
                hintsUsed: 0
            };
            return true;
        }
        return false;
    }

    makeGuess(playerId, guess) {
        if (!this.state.isActive) {
            return { error: 'Game sudah berakhir' };
        }

        if (!this.state.players[playerId]) {
            return { error: 'Kamu belum bergabung di game ini' };
        }

        const normalizedGuess = guess.toUpperCase().trim();
        const normalizedWord = this.state.word.toUpperCase();

        this.state.attempts++;
        const player = this.state.players[playerId];

        if (normalizedGuess === normalizedWord) {
            this.endGame(playerId);
            const score = this.calculateScore(playerId);

            return {
                success: true,
                message: '🎉 Tebakan Benar!',
                word: this.state.word,
                attempts: this.state.attempts,
                score: score,
                playerName: player.name
            };
        } else {
            player.wrongGuesses++;

            return {
                success: false,
                message: '❌ Tebakan Salah!',
                attempts: this.state.attempts,
                remaining: this.state.maxAttempts - this.state.attempts,
                wordHint: this.getWordHint()
            };
        }
    }

    useHint(playerId) {
        if (this.state.hintsUsed >= this.state.maxHints) {
            return { error: 'Hint sudah habis' };
        }

        if (!this.state.players[playerId]) {
            return { error: 'Kamu belum bergabung' };
        }

        const unrevealedLetters = this.state.word.split('').filter(letter =>
            letter !== ' ' && !this.state.revealedLetters.includes(letter)
        );

        if (unrevealedLetters.length === 0) {
            return { error: 'Semua huruf sudah terbuka' };
        }

        const randomLetter = unrevealedLetters[Math.floor(Math.random() * unrevealedLetters.length)];
        this.state.revealedLetters.push(randomLetter);
        this.state.hintsUsed++;
        this.state.players[playerId].hintsUsed++;

        return {
            success: true,
            letter: randomLetter,
            hintsRemaining: this.state.maxHints - this.state.hintsUsed,
            wordHint: this.getWordHint()
        };
    }

    getWordHint() {
        return this.state.word.split('').map(letter => {
            if (letter === ' ') return '  ';
            if (this.state.revealedLetters.includes(letter)) return letter + ' ';
            return '_ ';
        }).join('').trim();
    }

    calculateScore(playerId) {
        const player = this.state.players[playerId];
        if (!player) return 0;

        const baseScore = this.state.word.length * 10;
        const attemptBonus = Math.max(0, 100 - (this.state.attempts * 10));
        const hintPenalty = this.state.hintsUsed * 20;
        const difficultyMultiplier = this.state.difficulty;

        const score = Math.floor((baseScore + attemptBonus - hintPenalty) * difficultyMultiplier);

        player.score += Math.max(score, 10);
        player.correctGuesses++;

        return player.score;
    }

    endGame(winnerId) {
        this.state.isActive = false;
        this.state.endTime = Date.now();
        this.state.winner = winnerId;

        // Update user stats
        this.updateUserStats();
    }

    updateUserStats() {
        const usersData = loadData(usersDataPath);

        Object.values(this.state.players).forEach(player => {
            if (!usersData[player.id]) {
                usersData[player.id] = {
                    name: player.name,
                    stats: {
                        totalGames: 0,
                        gamesWon: 0,
                        totalScore: 0,
                        bestScore: 0,
                        totalAttempts: 0,
                        favoriteCategory: {}
                    }
                };
            }

            const user = usersData[player.id];
            user.stats.totalGames++;
            user.stats.totalAttempts += player.wrongGuesses;

            if (this.state.winner === player.id) {
                user.stats.gamesWon++;
                user.stats.totalScore += player.score;

                if (player.score > user.stats.bestScore) {
                    user.stats.bestScore = player.score;
                }
            }

            if (!user.stats.favoriteCategory[this.category]) {
                user.stats.favoriteCategory[this.category] = 0;
            }
            user.stats.favoriteCategory[this.category]++;
        });

        saveData(usersDataPath, usersData);
    }

    getGameStatus() {
        const timeElapsed = Math.floor((Date.now() - this.state.startTime) / 1000);
        const players = Object.values(this.state.players);

        return {
            category: this.category,
            wordHint: this.getWordHint(),
            clue: this.state.clue,
            attempts: this.state.attempts,
            maxAttempts: this.state.maxAttempts,
            attemptsLeft: this.state.maxAttempts - this.state.attempts,
            hintsUsed: this.state.hintsUsed,
            hintsLeft: this.state.maxHints - this.state.hintsUsed,
            timeElapsed: timeElapsed,
            isActive: this.state.isActive,
            players: players,
            wordLength: this.state.word.length
        };
    }
}

function restoreGameInstance(gameId, gameData) {
    const game = new TebakKataGame();
    game.gameId = gameId;
    game.category = gameData.category;
    game.creator = gameData.creator;
    game.creatorName = gameData.creatorName;
    game.wordData = gameData.wordData;
    game.state = gameData.state || gameData;

    game.addPlayer = TebakKataGame.prototype.addPlayer.bind(game);
    game.makeGuess = TebakKataGame.prototype.makeGuess.bind(game);
    game.useHint = TebakKataGame.prototype.useHint.bind(game);
    game.getWordHint = TebakKataGame.prototype.getWordHint.bind(game);
    game.calculateScore = TebakKataGame.prototype.calculateScore.bind(game);
    game.endGame = TebakKataGame.prototype.endGame.bind(game);
    game.updateUserStats = TebakKataGame.prototype.updateUserStats.bind(game);
    game.getGameStatus = TebakKataGame.prototype.getGameStatus.bind(game);

    return game;
}

function formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}


async function tebakkataCommand(sock, chatId, message) {
    try {
        const text = message.message?.conversation ||
            message.message?.extendedTextMessage?.text || '';

        const commandText = text.trim();
        if (commandText === '.tebakkata' || commandText === '.tebakkata ') {
            return await showHelpMenu(sock, chatId, message);
        }

        const args = text.split(' ').slice(1);
        const command = args[0]?.toLowerCase() || 'help';

        const userId = message.key.participant || message.key.remoteJid;
        const userName = await getUsername(sock, userId, chatId);

        const gamesData = loadGamesData(); 
        const gameId = `game_${chatId.replace(/[@\.]/g, '_')}`;

        switch (command) {
            case 'start':
                return await handleStart(sock, chatId, userId, userName, args.slice(1), gamesData, gameId, message);

            case 'join':
                return await handleJoin(sock, chatId, userId, userName, gamesData, gameId, message);

            case 'tebak':
            case 'guess':
                return await handleGuess(sock, chatId, userId, userName, args.slice(1), gamesData, gameId, message);

            case 'hint':
            case 'petunjuk':
                return await handleHint(sock, chatId, userId, gamesData, gameId, message);

            case 'status':
            case 'info':
                return await handleStatus(sock, chatId, gamesData, gameId, message);

            case 'stop':
            case 'berhenti':
                return await handleStop(sock, chatId, userId, gamesData, gameId, message);

            case 'stats':
            case 'statistik':
                return await handleStats(sock, chatId, userId, userName, message);

            case 'leaderboard':
            case 'peringkat':
                return await handleLeaderboard(sock, chatId, message);

            case 'kategori':
            case 'categories':
                return await handleCategories(sock, chatId, message);

            case 'help':
            case 'bantuan':
                return await showHelpMenu(sock, chatId, message);

            default:
                if (gamesData.activeGames && gamesData.activeGames[gameId]) {
                    return await handleGuess(sock, chatId, userId, userName, args, gamesData, gameId, message);
                } else {
                    return await showHelpMenu(sock, chatId, message);
                }
        }

    } catch (error) {
        console.error('Error in tebakkata command:', error);

        await sock.sendMessage(chatId, {
            text: '*Terjadi kesalahan!*\n\n' +
                'Mohon coba lagi nanti.\n' +
                `Error: ${error.message}`
        }, { quoted: message });
    }
}


async function showHelpMenu(sock, chatId, message) {
    const helpText = `🎮 *GAME TEBAK KATA* 🎮\n\n` +
        `*CARA BERMAIN:*\n` +
        `1. Bot memberikan clue tentang suatu kata\n` +
        `2. Kamu harus menebak kata tersebut\n` +
        `3. Gunakan hint jika kesulitan\n` +
        `4. Dapatkan score tertinggi!\n\n` +

        `*PERINTAH UTAMA:*\n` +
        `.tebakkata start [kategori] - Mulai game baru\n` +
        `.tebakkata join - Bergabung ke game\n` +
        `.tebakkata tebak [kata] - Tebak kata\n` +
        `.tebakkata hint - Minta petunjuk\n` +
        `.tebakkata status - Lihat status game\n` +
        `.tebakkata stop - Hentikan game\n\n` +

        `*STATISTIK & PERINGKAT:*\n` +
        `.tebakkata stats - Statistik kamu\n` +
        `.tebakkata leaderboard - Leaderboard pemain\n` +
        `.tebakkata kategori - Lihat kategori tersedia\n\n` +

        `*BANTUAN:*\n` +
        `.tebakkata help - Tampilkan menu ini\n\n` +

        `*KATEGORI TERSEDIA:*\n` +
        `• hewan  - Hewan & binatang\n` +
        `• buah  - Buah-buahan\n` +
        `• negara  - Negara & ibukota\n` +
        `• film  - Film & serial\n\n` +

        `*CONTOH PENGGUNAAN:*\n` +
        `.tebakkata start hewan\n` +
        `.tebakkata join\n` +
        `.tebakkata tebak harimau\n` +
        `.tebakkata hint\n` +
        `.tebakkata status\n\n` +

        `*SISTEM SCORE:*\n` +
        `• Panjang kata × 10\n` +
        `• Bonus sedikit percobaan\n` +
        `• Penalti penggunaan hint\n` +
        `• Multiplier tingkat kesulitan\n\n` +

        `*SELAMAT BERMAIN!*`;

    await sock.sendMessage(chatId, {
        text: helpText
    }, { quoted: message });
}



async function handleStart(sock, chatId, userId, userName, args, gamesData, gameId, message) {
    if (gamesData.activeGames && gamesData.activeGames[gameId]) {
        return await sock.sendMessage(chatId, {
            text: '*Game sudah berjalan!*\n\n' +
                'Gunakan `.tebakkata join` untuk bergabung\n' +
                'atau `.tebakkata status` untuk lihat status.'
        }, { quoted: message });
    }

    const category = args[0]?.toLowerCase() || 'hewan';

    // Validate category
    const wordsData = loadData(wordsDataPath);
    if (!wordsData.categories || !wordsData.categories[category]) {
        const categories = Object.keys(wordsData.categories || {})
            .map(cat => `• ${cat} - ${wordsData.categories[cat]?.name || cat}`)
            .join('\n');

        return await sock.sendMessage(chatId, {
            text: `*Kategori tidak valid!*\n\n` +
                `Kategori yang tersedia:\n${categories}\n\n` +
                `Contoh: .tebakkata start hewan`
        }, { quoted: message });
    }

    try {
        const game = new TebakKataGame(gameId, category, userId, userName);

        if (!gamesData.activeGames) {
            gamesData.activeGames = {};
        }

        gamesData.activeGames[gameId] = game;
        saveGamesData(gamesData); 

        const categoryInfo = wordsData.categories[category];

        const startMessage = `🎮 *GAME TEBAK KATA DIMULAI!* 🎮\n\n` +
            `Kategori: ${categoryInfo.name}\n` +
            `Pembuat: ${userName}\n\n` +
            `*CLUE:* ${game.state.clue}\n\n` +
            `Kata: ${game.getWordHint()}\n` +
            `Panjang: ${game.state.word.length} huruf\n` +
            `Tingkat: ${game.state.difficulty === 1 ? 'Mudah' : game.state.difficulty === 2 ? 'Sedang' : 'Sulit'}\n\n` +
            `*Aturan Game:*\n` +
            `• Max ${game.state.maxAttempts} percobaan\n` +
            `• ${game.state.maxHints} hint tersedia\n` +
            `• Multiplayer support\n\n` +
            `*Perintah:*\n` +
            `.tebakkata join - Bergabung ke game\n` +
            `.tebakkata tebak [kata] - Tebak kata\n` +
            `.tebakkata hint - Minta petunjuk\n` +
            `.tebakkata status - Lihat status\n\n` +
            `*Bergabung sekarang!* 🎉`;

        await sock.sendMessage(chatId, {
            text: startMessage
        }, { quoted: message });

    } catch (error) {
        await sock.sendMessage(chatId, {
            text: `*Gagal memulai game!*\n\n${error.message}`
        }, { quoted: message });
    }
}

async function handleJoin(sock, chatId, userId, userName, gamesData, gameId, message) {
    if (!gamesData.activeGames || !gamesData.activeGames[gameId]) {
        return await sock.sendMessage(chatId, {
            text: '*Tidak ada game aktif!*\n\n' +
                'Mulai game dulu dengan `.tebakkata start <kategori>`'
        }, { quoted: message });
    }

    let game = gamesData.activeGames[gameId];

    if (game && typeof game.addPlayer !== 'function') {
        game = restoreGameInstance(gameId, game);
        gamesData.activeGames[gameId] = game;
    }

    if (game.addPlayer(userId, userName)) {
        saveGamesData(gamesData); 

        await sock.sendMessage(chatId, {
            text: `✅ *${userName} bergabung ke game!*\n\n` +
                `👥 Total pemain: ${Object.keys(game.state.players).length}\n` +
                `🎮 Status: ${game.getWordHint()}\n\n` +
                `*Gunakan:* .tebakkata tebak <kata>`
        }, { quoted: message });
    } else {
        await sock.sendMessage(chatId, {
            text: `ℹ*Kamu sudah bergabung!*\n\n` +
                `Langsung tebak kata dengan .tebakkata tebak <kata>`
        }, { quoted: message });
    }
}

async function handleGuess(sock, chatId, userId, userName, args, gamesData, gameId, message) {
    if (!gamesData.activeGames || !gamesData.activeGames[gameId]) {
        return await sock.sendMessage(chatId, {
            text: '*Tidak ada game aktif!*\n\n' +
                'Mulai game dulu dengan `.tebakkata start <kategori>`'
        }, { quoted: message });
    }

    let game = gamesData.activeGames[gameId];

    if (game && typeof game.makeGuess !== 'function') {
        game = restoreGameInstance(gameId, game);
        gamesData.activeGames[gameId] = game;
    }

    const guess = args.join(' ').trim();
    if (!guess) {
        return await sock.sendMessage(chatId, {
            text: '⚠️ *Masukkan tebakan!*\n\n' +
                'Contoh: `.tebakkata tebak harimau`'
        }, { quoted: message });
    }

    const result = game.makeGuess(userId, guess);

    if (result.error) {
        return await sock.sendMessage(chatId, {
            text: `${result.error}`
        }, { quoted: message });
    }

    saveGamesData(gamesData); 

    if (result.success) {
        const winMessage = `*TEBAKAN BENAR!*\n\n` +
            `Kata: *${result.word}*\n` +
            `Pemenang: ${result.playerName}\n` +
            `Percobaan: ${result.attempts}\n` +
            `Score: ${result.score} poin\n\n` +
            `*Main lagi?* \`.tebakkata start [kategori]\``;

        delete gamesData.activeGames[gameId];
        saveGamesData(gamesData);

        await sock.sendMessage(chatId, {
            text: winMessage
        }, { quoted: message });

    } else {
        const status = game.getGameStatus();

        const response = `*SALAH!*\n\n` +
            `Tebakan: "${guess}"\n\n` +
            `Kata: ${status.wordHint}\n` +
            `Sisa percobaan: ${status.attemptsLeft}\n` +
            `Sisa hint: ${status.hintsLeft}\n\n` +
            `*Clue:* ${status.clue}\n\n` +
            `Coba lagi! `;

        await sock.sendMessage(chatId, {
            text: response
        }, { quoted: message });
    }
}

async function handleHint(sock, chatId, userId, gamesData, gameId, message) {
    if (!gamesData.activeGames || !gamesData.activeGames[gameId]) {
        return await sock.sendMessage(chatId, {
            text: '*Tidak ada game aktif!*'
        }, { quoted: message });
    }

    let game = gamesData.activeGames[gameId];

    if (game && typeof game.useHint !== 'function') {
        game = restoreGameInstance(gameId, game);
        gamesData.activeGames[gameId] = game;
    }

    const result = game.useHint(userId);

    if (result.error) {
        return await sock.sendMessage(chatId, {
            text: `${result.error}`
        }, { quoted: message });
    }

    saveGamesData(gamesData);

    const hintMessage = `*HINT #${game.state.hintsUsed}*\n\n` +
        `Huruf "${result.letter}" terungkap!\n\n` +
        `Kata: ${result.wordHint}\n` +
        `Sisa percobaan: ${game.state.maxAttempts - game.state.attempts}\n` +
        `Sisa hint: ${result.hintsRemaining}\n\n` +
        `*Clue:* ${game.state.clue}`;

    await sock.sendMessage(chatId, {
        text: hintMessage
    }, { quoted: message });
}

async function handleStatus(sock, chatId, gamesData, gameId, message) {
    if (!gamesData.activeGames || !gamesData.activeGames[gameId]) {
        return await sock.sendMessage(chatId, {
            text: '*Tidak ada game aktif!*\n\n' +
                'Mulai game dengan `.tebakkata start < kategori > `'
        }, { quoted: message });
    }

    let game = gamesData.activeGames[gameId];

    if (game && typeof game.getGameStatus !== 'function') {
        game = restoreGameInstance(gameId, game);
        gamesData.activeGames[gameId] = game;
    }

    const status = game.getGameStatus();
    const wordsData = loadData(wordsDataPath);
    const categoryInfo = wordsData.categories[game.category] || {};

    let playersText = '';
    status.players.forEach((player, index) => {
        playersText += `${index + 1}. ${player.name} \n`;
        playersText += `   ✅ ${player.correctGuesses} | ${player.wrongGuesses} \n`;
        playersText += `   ${player.hintsUsed} | ${player.score} \n`;
    });

    const statusMessage = `* STATUS GAME *\n\n` +
        `Kategori: ${categoryInfo.name || game.category} \n` +
        `Pembuat: ${game.creatorName} \n\n` +
        `* CLUE:* ${status.clue} \n\n` +
        `Kata: ${status.wordHint} \n` +
        `Panjang: ${status.wordLength} huruf\n\n` +
        `* Progress:*\n` +
        `Percobaan: ${status.attempts}/${status.maxAttempts}\n` +
        `Hint: ${status.hintsUsed}/${status.maxHints}\n` +
        `⏱Waktu: ${formatTime(status.timeElapsed)}\n\n` +
        `*Pemain (${status.players.length}):*\n${playersText}\n` +
        `*Perintah:*\n.tebakkata join - Bergabung\n.tebakkata tebak <kata> - Menebak`;

    await sock.sendMessage(chatId, {
        text: statusMessage
    }, { quoted: message });
}

async function handleStop(sock, chatId, userId, gamesData, gameId, message) {
    if (!gamesData.activeGames || !gamesData.activeGames[gameId]) {
        return await sock.sendMessage(chatId, {
            text: '*Tidak ada game aktif!*'
        }, { quoted: message });
    }

    let game = gamesData.activeGames[gameId];

    if (game && typeof game.getGameStatus !== 'function') {
        game = restoreGameInstance(gameId, game);
        gamesData.activeGames[gameId] = game;
    }

    if (game.creator !== userId) {
        return await sock.sendMessage(chatId, {
            text: '*Hanya pembuat game yang bisa menghentikan!*'
        }, { quoted: message });
    }

    const players = Object.values(game.state.players);

    let resultsText = `*GAME DIHENTIKAN*\n\n` +
        `Kata: *${game.state.word}*\n` +
        `Clue: ${game.state.clue}\n\n` +
        `*Hasil:*\n\n`;

    players.forEach((player, index) => {
        const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}.`;
        resultsText += `${medal} ${player.name}: ${player.score} poin\n`;
    });

    resultsText += `\n*Terima kasih sudah bermain!*\n\n` +
        `Main lagi? \`.tebakkata start[kategori]\``;

    // Delete game
    delete gamesData.activeGames[gameId];
    saveGamesData(gamesData);

    await sock.sendMessage(chatId, {
        text: resultsText
    }, { quoted: message });
}

async function handleStats(sock, chatId, userId, userName, message) {
    const usersData = loadData(usersDataPath);
    const user = usersData[userId] || {
        name: userName,
        stats: {
            totalGames: 0,
            gamesWon: 0,
            totalScore: 0,
            bestScore: 0,
            totalAttempts: 0,
            favoriteCategory: {}
        }
    };

    const stats = user.stats;
    const winRate = stats.totalGames > 0 ? Math.round((stats.gamesWon / stats.totalGames) * 100) : 0;

    // Find favorite category
    let favoriteCategory = 'Tidak ada';
    let maxGames = 0;

    if (stats.favoriteCategory) {
        Object.entries(stats.favoriteCategory).forEach(([cat, count]) => {
            if (count > maxGames) {
                maxGames = count;
                favoriteCategory = cat;
            }
        });
    }

    const statsText = `* STATISTIK PERMAINAN * \n\n` +
        `Pemain: ${userName} \n\n` +
        `* Statistik:*\n` +
        `Total Games: ${stats.totalGames} \n` +
        `Games Menang: ${stats.gamesWon} \n` +
        `Win Rate: ${winRate}%\n` +
        `Total Score: ${stats.totalScore} \n` +
        `Best Score: ${stats.bestScore} \n\n` +
        `* Preferensi:*\n` +
        `Kategori Favorit: ${favoriteCategory} \n` +
        ` Games di kategori: ${maxGames} \n\n` +
        `* Main lagi ?*\n\`.tebakkata start[kategori]\``;

    await sock.sendMessage(chatId, {
        text: statsText
    }, { quoted: message });
}

async function handleLeaderboard(sock, chatId, message) {
    const usersData = loadData(usersDataPath);

    const leaderboard = Object.entries(usersData)
        .map(([id, user]) => ({
            id,
            name: user.name,
            score: user.stats.totalScore || 0,
            gamesWon: user.stats.gamesWon || 0,
            totalGames: user.stats.totalGames || 0
        }))
        .sort((a, b) => b.score - a.score)
        .slice(0, 10); // Top 10

    if (leaderboard.length === 0) {
        return await sock.sendMessage(chatId, {
            text: '📊 *LEADERBOARD KOSONG*\n\n' +
                'Belum ada yang bermain game tebak kata!\n' +
                'Jadilah yang pertama dengan `.tebakkata start`'
        }, { quoted: message });
    }

    let leaderboardText = `* LEADERBOARD TEBAK KATA *\n\n`;

    leaderboard.forEach((player, index) => {
        const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}.`;
        const winRate = player.totalGames > 0 ? Math.round((player.gamesWon / player.totalGames) * 100) : 0;

        leaderboardText += `${medal} ${player.name} \n`;
        leaderboardText += `   Score: ${player.score} \n`;
        leaderboardText += `   Games: ${player.totalGames} (${winRate}% win rate) \n\n`;
    });

    leaderboardText += `* Bergabunglah dengan:*\n.tebakkata start[kategori]`;

    await sock.sendMessage(chatId, {
        text: leaderboardText
    }, { quoted: message });
}

async function handleCategories(sock, chatId, message) {
    const wordsData = loadData(wordsDataPath);
    const categories = wordsData.categories || {};

    if (Object.keys(categories).length === 0) {
        return await sock.sendMessage(chatId, {
            text: '*Tidak ada kategori tersedia!*'
        }, { quoted: message });
    }

    let categoriesText = `* KATEGORI TEBAK KATA *\n\n`;

    Object.entries(categories).forEach(([id, cat]) => {
        const difficultyEmoji = cat.difficulty === 'easy' ? '🟢' :
            cat.difficulty === 'medium' ? '🟡' : '🔴';

        categoriesText += `* ${cat.name}*\n`;
        categoriesText += `   ID: \`${id}\`\n`;
        categoriesText += `   ${difficultyEmoji} ${cat.difficulty.toUpperCase()}\n`;
        categoriesText += `   ${cat.description}\n`;
        categoriesText += `   Kata: ${cat.words?.length || 0}\n\n`;
    });

    categoriesText += `*Cara main:*\n.tebakkata start [id_kategori]\n\n` +
        `*Contoh:*\n.tebakkata start hewan\n.tebakkata start film`;

    await sock.sendMessage(chatId, {
        text: categoriesText
    }, { quoted: message });
}



async function getUsername(sock, userId, chatId) {
    try {
        const phoneNumber = userId.split('@')[0];
        return `User_${phoneNumber.substring(phoneNumber.length - 4)}`;
    } catch (error) {
        return 'Player';
    }
}

module.exports = {
    tebakkata: tebakkataCommand
};
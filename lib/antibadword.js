const antibadwordConfig = require('./antibadword-config');
const warningSystem = require('./warning-system');
const isAdminHelper = require('./isAdmin');

const defaultBadwords = [
    'goblok', 'bego', 'tolol', 'anjing', 'bangsat', 'kontol', 'memek',
    'jembut', 'ngentot', 'peju', 'pantek', 'bajingan', 'kampret',
    'asu', 'anjir', 'jancuk', 'jancok', 'jablay', 'bitch', 'fuck',
    'shit', 'asshole', 'motherfucker', 'dick', 'pussy', 'bastard',
    'cunt', 'whore', 'slut', 'nigga', 'nigger', 'retard', 'idiot',
    'stupid', 'dumb', 'moron', 'suck', 'sucks', 'sucking',
    'babi', 'celeng', 'kafir', 'murtad', 'setan', 'iblis',
    'gay', 'lesbi', 'homo', 'bencong', 'banci', 'waria',
    'sundal', 'lonte', 'pelacur', 'perek', 'lacur',
    'coli', 'masturbasi', 'senge', 'senggama', 'bokep',
    'porno', 'hentai', 'bugil', 'telanjang'
];

async function handleAntiBadwordCommand(sock, chatId, message, match, senderId) {
    const parts = match.trim().split(' ');
    const command = parts[0]?.toLowerCase();
    const args = parts.slice(1);

    const isAdmin = await isAdminHelper(sock, chatId, senderId);
    if (!isAdmin) {
        return sock.sendMessage(chatId, {
            text: 'PERINGATAN\nHanya admin grup yang dapat menggunakan perintah ini!'
        });
    }

    if (!command) {
        return showHelpMenu(sock, chatId);
    }

    switch (command) {
        case 'on':
            return enableAntibadword(sock, chatId);

        case 'off':
            return disableAntibadword(sock, chatId);

        case 'action':
            return setAction(sock, chatId, args[0]);

        case 'add':
            return addBadword(sock, chatId, args);

        case 'remove':
            return removeBadword(sock, chatId, args);

        case 'list':
            return listBadwords(sock, chatId);

        case 'reset':
            return resetConfig(sock, chatId);

        case 'warnings':
            return showWarnings(sock, chatId, args[0]);

        case 'exclude':
            return manageExclusions(sock, chatId, args);

        case 'mute':
            return setMuteDuration(sock, chatId, args[0]);

        case 'stats':
            return showStats(sock, chatId);

        case 'test':
            return testBadword(sock, chatId, args.join(' '));

        default:
            return sock.sendMessage(chatId, {
                text: 'Perintah tidak dikenali! Ketik `.antibadword` untuk melihat menu bantuan.'
            });
    }
}

async function showHelpMenu(sock, chatId) {
    const config = antibadwordConfig.loadGroupConfig(chatId);

    const helpText = `
ANTIBADWORD SYSTEM - MENU BANTUAN

Status: ${config.enabled ? 'AKTIF' : 'NONAKTIF'}
Aksi saat ini: ${config.action.toUpperCase()}
Kata terlarang: ${config.badwords.length} kata
Max Warning: ${config.maxWarnings} kali

DAFTAR PERINTAH:

Pengaturan Dasar
• \`.antibadword on\` - Aktifkan sistem
• \`.antibadword off\` - Nonaktifkan sistem
• \`.antibadword action <delete/warn/kick/mute>\` - Atur aksi
• \`.antibadword mute <menit>\` - Atur durasi mute

Manajemen Kata
• \`.antibadword add <kata1 kata2 ...>\` - Tambah kata terlarang
• \`.antibadword remove <kata>\` - Hapus kata terlarang
• \`.antibadword list\` - Lihat daftar kata
• \`.antibadword test <kalimat>\` - Test kata terlarang

Manajemen User
• \`.antibadword exclude add @user\` - Exclude user
• \`.antibadword exclude remove @user\` - Hapus exclude
• \`.antibadword warnings @user\` - Lihat warning user
• \`.antibadword warnings reset @user\` - Reset warning

Informasi
• \`.antibadword stats\` - Lihat statistik
• \`.antibadword reset\` - Reset semua pengaturan

Contoh:
• \`.antibadword add anjing bangsat\`
• \`.antibadword action warn\`
• \`.antibadword mute 10\`
• \`.antibadword warnings @6281234567890\`
    `;

    await sock.sendMessage(chatId, { text: helpText });
}

async function enableAntibadword(sock, chatId) {
    const config = antibadwordConfig.loadGroupConfig(chatId);

    if (config.enabled) {
        return sock.sendMessage(chatId, {
            text: 'Sistem antibadword sudah aktif!'
        });
    }

    antibadwordConfig.updateGroupConfig(chatId, { enabled: true });

    await sock.sendMessage(chatId, {
        text: 'SISTEM ANTIBADWORD DIAKTIFKAN!\n\n' +
            'Sistem antibadword sekarang aktif di grup ini.\n' +
            'Gunakan `.antibadword action` untuk mengatur aksi yang diinginkan.\n' +
            'Tambahkan kata-kata terlarang dengan `.antibadword add <kata>`'
    });
}

async function disableAntibadword(sock, chatId) {
    const config = antibadwordConfig.loadGroupConfig(chatId);

    if (!config.enabled) {
        return sock.sendMessage(chatId, {
            text: 'Sistem antibadword sudah nonaktif!'
        });
    }

    antibadwordConfig.updateGroupConfig(chatId, { enabled: false });

    await sock.sendMessage(chatId, {
        text: 'SISTEM ANTIBADWORD DINONAKTIFKAN!\n\n' +
            'Sistem antibadword telah dinonaktifkan di grup ini.\n' +
            'Semua kata yang sebelumnya terlarang sekarang diperbolehkan.'
    });
}

async function setAction(sock, chatId, action) {
    const validActions = ['delete', 'warn', 'kick', 'mute'];

    if (!action || !validActions.includes(action.toLowerCase())) {
        return sock.sendMessage(chatId, {
            text: 'PENGGUNAAN SALAH!\n\n' +
                'Format: `.antibadword action <aksi>`\n' +
                'Pilihan aksi: delete, warn, kick, mute\n\n' +
                'Contoh:\n' +
                '`.antibadword action warn`\n' +
                '`.antibadword action mute`'
        });
    }

    antibadwordConfig.updateGroupConfig(chatId, {
        action: action.toLowerCase()
    });

    const actionDescriptions = {
        'delete': 'Hanya menghapus pesan',
        'warn': 'Memberikan peringatan (auto-kick setelah 3x)',
        'kick': 'Langsung mengeluarkan dari grup',
        'mute': 'Membisukan sementara'
    };

    await sock.sendMessage(chatId, {
        text: 'AKSI DIPERBARUI!\n\n' +
            'Aksi antibadword diatur ke: ' + action.toUpperCase() + '\n' +
            'Deskripsi: ' + actionDescriptions[action] + '\n\n' +
            'Sistem akan ' + actionDescriptions[action].toLowerCase() + ' ketika mendeteksi kata terlarang.'
    });
}

async function addBadword(sock, chatId, words) {
    if (words.length === 0) {
        return sock.sendMessage(chatId, {
            text: 'PENGGUNAAN SALAH!\n\n' +
                'Format: `.antibadword add <kata1 kata2 ...>`\n\n' +
                'Contoh:\n' +
                '`.antibadword add anjing bangsat`\n' +
                '`.antibadword add kontol memek`'
        });
    }

    let addedCount = 0;
    let alreadyExists = [];

    for (const word of words) {
        if (word.length < 2) continue;

        if (antibadwordConfig.addBadword(chatId, word)) {
            addedCount++;
        } else {
            alreadyExists.push(word);
        }
    }

    const config = antibadwordConfig.loadGroupConfig(chatId);

    let response = '';
    if (addedCount > 0) {
        response += addedCount + ' KATA BERHASIL DITAMBAHKAN!\n\n';
        response += 'Total kata terlarang sekarang: ' + config.badwords.length + ' kata\n\n';
    }

    if (alreadyExists.length > 0) {
        response += alreadyExists.length + ' kata sudah ada:\n';
        response += alreadyExists.join(', ') + '\n\n';
    }

    response += 'Kata yang ditambahkan:\n' + words.join(', ');

    await sock.sendMessage(chatId, { text: response });
}

async function removeBadword(sock, chatId, words) {
    if (words.length === 0) {
        return sock.sendMessage(chatId, {
            text: 'PENGGUNAAN SALAH!\n\n' +
                'Format: `.antibadword remove <kata>`\n\n' +
                'Contoh:\n' +
                '`.antibadword remove anjing`\n' +
                '`.antibadword remove bangsat`'
        });
    }

    let removedCount = 0;
    let notFound = [];

    for (const word of words) {
        if (antibadwordConfig.removeBadword(chatId, word)) {
            removedCount++;
        } else {
            notFound.push(word);
        }
    }

    const config = antibadwordConfig.loadGroupConfig(chatId);

    let response = '';
    if (removedCount > 0) {
        response += removedCount + ' KATA BERHASIL DIHAPUS!\n\n';
        response += 'Total kata terlarang sekarang: ' + config.badwords.length + ' kata\n\n';
    }

    if (notFound.length > 0) {
        response += notFound.length + ' kata tidak ditemukan:\n';
        response += notFound.join(', ');
    }

    await sock.sendMessage(chatId, { text: response });
}

async function listBadwords(sock, chatId) {
    const badwords = antibadwordConfig.getBadwords(chatId);
    const config = antibadwordConfig.loadGroupConfig(chatId);

    if (badwords.length === 0) {
        return sock.sendMessage(chatId, {
            text: 'DAFTAR KATA TERLARANG\n\n' +
                'Belum ada kata terlarang yang ditambahkan.\n' +
                'Gunakan `.antibadword add <kata>` untuk menambahkan.'
        });
    }

    if (badwords.length > 50) {
        const pages = Math.ceil(badwords.length / 50);

        for (let i = 0; i < pages; i++) {
            const start = i * 50;
            const end = start + 50;
            const pageWords = badwords.slice(start, end);

            const text = 'DAFTAR KATA TERLARANG (Halaman ' + (i + 1) + '/' + pages + ')\n\n' +
                'Total: ' + badwords.length + ' kata\n' +
                'Status: ' + (config.enabled ? 'AKTIF' : 'NONAKTIF') + '\n\n' +
                'Kata-kata terlarang:\n' +
                pageWords.map((w, idx) => (start + idx + 1) + '. ' + w).join('\n');

            await sock.sendMessage(chatId, { text });
            await new Promise(resolve => setTimeout(resolve, 1000)); // Delay antar pesan
        }
    } else {
        const text = 'DAFTAR KATA TERLARANG\n\n' +
            'Total: ' + badwords.length + ' kata\n' +
            'Status: ' + (config.enabled ? 'AKTIF' : 'NONAKTIF') + '\n\n' +
            'Kata-kata terlarang:\n' +
            badwords.map((w, idx) => (idx + 1) + '. ' + w).join('\n');

        await sock.sendMessage(chatId, { text });
    }
}

async function resetConfig(sock, chatId) {
    antibadwordConfig.resetGroupConfig(chatId);
    warningSystem.clearAllGroupWarnings(chatId);

    await sock.sendMessage(chatId, {
        text: 'SEMUA PENGATURAN DIHAPUS!\n\n' +
            'Semua pengaturan antibadword telah direset ke default.\n' +
            'Semua warning user telah dihapus.\n\n' +
            'Gunakan `.antibadword on` untuk mengaktifkan kembali.'
    });
}

async function showWarnings(sock, chatId, user) {
    if (!user) {
        const allWarnings = warningSystem.getAllWarnings(chatId);
        const totalUsers = Object.keys(allWarnings).length;
        const totalWarnings = Object.values(allWarnings).reduce((sum, w) => sum + w.count, 0);

        return sock.sendMessage(chatId, {
            text: 'STATISTIK WARNING\n\n' +
                'Total user dengan warning: ' + totalUsers + '\n' +
                'Total warning diberikan: ' + totalWarnings + '\n\n' +
                'Gunakan `.antibadword warnings @user` untuk melihat detail user tertentu.'
        });
    }

    const userId = user.replace('@', '').split('@')[0] + '@s.whatsapp.net';
    const warnings = warningSystem.getUserWarnings(chatId, userId);

    if (!warnings) {
        return sock.sendMessage(chatId, {
            text: 'INFORMASI WARNING\n\n' +
                'User ' + user + ' tidak memiliki warning.'
        });
    }

    const historyText = warnings.history.length > 0
        ? '\nRiwayat Warning:\n' + warnings.history.slice(-5).map((h, idx) =>
            (idx + 1) + '. ' + new Date(h.timestamp).toLocaleString('id-ID') + ' - ' + h.reason
        ).join('\n')
        : '';

    await sock.sendMessage(chatId, {
        text: 'DETAIL WARNING\n\n' +
            'User: ' + user + '\n' +
            'Total Warning: ' + warnings.count + '\n' +
            'Warning Terakhir: ' + (warnings.lastWarning ? new Date(warnings.lastWarning).toLocaleString('id-ID') : 'Tidak ada') + '\n' +
            historyText +
            '\n\nReset warning dengan:\n`.antibadword warnings reset ' + user + '`',
        mentions: [userId]
    });
}

async function manageExclusions(sock, chatId, args) {
    if (args.length < 2) {
        return sock.sendMessage(chatId, {
            text: 'PENGGUNAAN SALAH!\n\n' +
                'Format:\n' +
                '`.antibadword exclude add @user`\n' +
                '`.antibadword exclude remove @user`\n' +
                '`.antibadword exclude list`'
        });
    }

    const subCommand = args[0].toLowerCase();
    const user = args[1];

    if (subCommand === 'list') {
        const config = antibadwordConfig.loadGroupConfig(chatId);

        if (config.excludedUsers.length === 0) {
            return sock.sendMessage(chatId, {
                text: 'DAFTAR USER EXCLUDE\n\n' +
                    'Belum ada user yang di-exclude dari sistem antibadword.'
            });
        }

        return sock.sendMessage(chatId, {
            text: 'DAFTAR USER EXCLUDE\n\n' +
                'Total: ' + config.excludedUsers.length + ' user\n\n' +
                'User yang di-exclude:\n' +
                config.excludedUsers.join('\n'),
            mentions: config.excludedUsers
        });
    }

    const userId = user.replace('@', '').split('@')[0] + '@s.whatsapp.net';
    const config = antibadwordConfig.loadGroupConfig(chatId);

    if (subCommand === 'add') {
        if (!config.excludedUsers.includes(userId)) {
            config.excludedUsers.push(userId);
            antibadwordConfig.saveGroupConfig(chatId, config);

            await sock.sendMessage(chatId, {
                text: 'USER DITAMBAHKAN KE EXCLUDE LIST!\n\n' +
                    'User ' + user + ' sekarang di-exclude dari sistem antibadword.\n' +
                    'User ini tidak akan terkena sanksi meski menggunakan kata terlarang.',
                mentions: [userId]
            });
        } else {
            await sock.sendMessage(chatId, {
                text: 'User ' + user + ' sudah ada dalam exclude list.',
                mentions: [userId]
            });
        }
    } else if (subCommand === 'remove') {
        const index = config.excludedUsers.indexOf(userId);
        if (index > -1) {
            config.excludedUsers.splice(index, 1);
            antibadwordConfig.saveGroupConfig(chatId, config);

            await sock.sendMessage(chatId, {
                text: 'USER DIHAPUS DARI EXCLUDE LIST!\n\n' +
                    'User ' + user + ' sekarang TIDAK di-exclude dari sistem antibadword.\n' +
                    'User ini akan terkena sanksi jika menggunakan kata terlarang.',
                mentions: [userId]
            });
        } else {
            await sock.sendMessage(chatId, {
                text: 'User ' + user + ' tidak ditemukan dalam exclude list.',
                mentions: [userId]
            });
        }
    }
}

async function setMuteDuration(sock, chatId, duration) {
    const minutes = parseInt(duration);

    if (isNaN(minutes) || minutes < 1 || minutes > 1440) {
        return sock.sendMessage(chatId, {
            text: 'DURASI TIDAK VALID!\n\n' +
                'Format: `.antibadword mute <menit>`\n' +
                'Rentang: 1-1440 menit (24 jam)\n\n' +
                'Contoh:\n' +
                '`.antibadword mute 10` (10 menit)\n' +
                '`.antibadword mute 60` (1 jam)'
        });
    }

    antibadwordConfig.updateGroupConfig(chatId, { muteDuration: minutes });

    await sock.sendMessage(chatId, {
        text: 'DURASI MUTE DIPERBARUI!\n\n' +
            'Durasi mute diatur ke: ' + minutes + ' menit\n\n' +
            'Ketika aksi diatur ke "mute", user akan dibisukan selama ' + minutes + ' menit jika menggunakan kata terlarang.'
    });
}

async function showStats(sock, chatId) {
    const config = antibadwordConfig.loadGroupConfig(chatId);
    const allWarnings = warningSystem.getAllWarnings(chatId);
    const totalUsers = Object.keys(allWarnings).length;
    const totalWarnings = Object.values(allWarnings).reduce((sum, w) => sum + w.count, 0);

    const statsText = `
STATISTIK ANTIBADWORD

Status Sistem
• Status: ${config.enabled ? 'AKTIF' : 'NONAKTIF'}
• Aksi: ${config.action.toUpperCase()}
• Auto Delete: ${config.autoDelete ? 'YA' : 'TIDAK'}
• Durasi Mute: ${config.muteDuration} menit
• Max Warning: ${config.maxWarnings} kali

Data Kata Terlarang
• Total Kata: ${config.badwords.length} kata
• User Exclude: ${config.excludedUsers.length} user
• Roles Exclude: ${config.excludedRoles.join(', ')}

Data Warning
• Total User dengan Warning: ${totalUsers} user
• Total Warning Diberikan: ${totalWarnings} kali
• User Paling Sering: ${getMostWarnedUser(allWarnings)}

Penggunaan Terakhir
${getLastActivityText(allWarnings)}

Tips: Gunakan \`.antibadword list\` untuk melihat daftar kata terlarang.
    `;

    await sock.sendMessage(chatId, { text: statsText });
}

async function testBadword(sock, chatId, text) {
    if (!text) {
        return sock.sendMessage(chatId, {
            text: 'PENGGUNAAN SALAH!\n\n' +
                'Format: `.antibadword test <kalimat>`\n\n' +
                'Contoh:\n' +
                '`.antibadword test kalimat uji coba`\n' +
                '`.antibadword test kata anjing dan bangsat`'
        });
    }

    const config = antibadwordConfig.loadGroupConfig(chatId);
    const badwords = config.badwords;
    const cleanText = text.toLowerCase().replace(/[^\w\s]/g, ' ');
    const foundWords = [];

    for (const badword of badwords) {
        if (cleanText.includes(badword.toLowerCase())) {
            foundWords.push(badword);
        }
    }

    if (foundWords.length === 0) {
        await sock.sendMessage(chatId, {
            text: 'TEST KATA TERLARANG\n\n' +
                'Kalimat: "' + text + '"\n\n' +
                'HASIL: TIDAK ditemukan kata terlarang!\n\n' +
                'Kalimat ini aman dari sistem antibadword.'
        });
    } else {
        await sock.sendMessage(chatId, {
            text: 'TEST KATA TERLARANG\n\n' +
                'Kalimat: "' + text + '"\n\n' +
                'HASIL: Ditemukan ' + foundWords.length + ' kata terlarang!\n\n' +
                'Kata terlarang yang ditemukan:\n' +
                foundWords.map(w => '• ' + w).join('\n') + '\n\n' +
                'Aksi yang akan diambil: ' + config.action.toUpperCase() + '\n' +
                'User akan ' + getActionDescription(config.action)
        });
    }
}

function getMostWarnedUser(warnings) {
    if (Object.keys(warnings).length === 0) return "Tidak ada";

    let maxUser = null;
    let maxCount = 0;

    for (const [userId, data] of Object.entries(warnings)) {
        if (data.count > maxCount) {
            maxCount = data.count;
            maxUser = userId.split('@')[0];
        }
    }

    return maxUser + ' (' + maxCount + 'x)';
}

function getLastActivityText(warnings) {
    if (Object.keys(warnings).length === 0) return "Belum ada aktivitas";

    let lastActivity = null;
    for (const data of Object.values(warnings)) {
        if (data.lastWarning) {
            const date = new Date(data.lastWarning);
            if (!lastActivity || date > lastActivity) {
                lastActivity = date;
            }
        }
    }

    return lastActivity
        ? lastActivity.toLocaleString('id-ID')
        : "Belum ada aktivitas";
}

function getActionDescription(action) {
    const descriptions = {
        'delete': 'mendapat pesan peringatan',
        'warn': 'mendapat warning (auto-kick setelah 3x)',
        'kick': 'langsung di-kick dari grup',
        'mute': 'dibisukan sementara'
    };
    return descriptions[action] || 'mendapat sanksi';
}

async function handleBadwordDetection(sock, chatId, message, userMessage, senderId) {
    try {
        const config = antibadwordConfig.loadGroupConfig(chatId);

        if (!config.enabled) return false;

        if (!chatId.endsWith('@g.us')) return false;

        if (message.key.fromMe) return false;

        if (config.excludedUsers.includes(senderId)) {
            console.log('User ' + senderId + ' di-exclude, skip antibadword');
            return false;
        }

        if (config.excludedRoles.includes('admin')) {
            const groupMetadata = await sock.groupMetadata(chatId);
            const participant = groupMetadata.participants.find(p => p.id === senderId);
            if (participant?.admin) {
                console.log('Admin ' + senderId + ' di-exclude, skip antibadword');
                return false;
            }
        }

        const cleanMessage = userMessage.toLowerCase()
            .replace(/[^\w\s]/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();

        const badwords = config.badwords;
        let containsBadword = false;
        let foundWord = '';

        const wordsToCheck = badwords.length > 0 ? badwords : defaultBadwords;

        for (const badword of wordsToCheck) {
            const regex = new RegExp('\\b' + badword + '\\b', 'i');
            if (regex.test(cleanMessage) || cleanMessage.includes(badword)) {
                containsBadword = true;
                foundWord = badword;
                break;
            }
        }

        if (!containsBadword) return false;

        console.log('Badword detected: "' + foundWord + '" from ' + senderId);

        const groupMetadata = await sock.groupMetadata(chatId);
        const botId = sock.user.id.split(':')[0] + '@s.whatsapp.net';
        const bot = groupMetadata.participants.find(p => p.id === botId);
        if (!bot?.admin) {
            console.log('Bot bukan admin, tidak bisa mengambil aksi');
            return false;
        }

        if (config.autoDelete) {
            try {
                await sock.sendMessage(chatId, {
                    delete: message.key
                });
                console.log('Pesan berhasil dihapus');
            } catch (err) {
                console.error('Gagal menghapus pesan:', err);
            }
        }

        switch (config.action) {
            case 'delete':
                await handleDeleteAction(sock, chatId, senderId, foundWord);
                break;

            case 'warn':
                await handleWarnAction(sock, chatId, senderId, foundWord, config);
                break;

            case 'kick':
                await handleKickAction(sock, chatId, senderId, foundWord);
                break;

            case 'mute':
                await handleMuteAction(sock, chatId, senderId, foundWord, config);
                break;
        }

        return true;

    } catch (error) {
        console.error('Error in handleBadwordDetection:', error);
        return false;
    }
}

async function handleDeleteAction(sock, chatId, senderId, foundWord) {
    await sock.sendMessage(chatId, {
        text: 'PERINGATAN!\n\n' +
            '@' + senderId.split('@')[0] + ' menggunakan kata terlarang: ' + foundWord + '\n' +
            'Pesan telah dihapus. Jangan gunakan kata kasar ya!',
        mentions: [senderId]
    });
}

async function handleWarnAction(sock, chatId, senderId, foundWord, config) {
    const warningCount = warningSystem.addWarning(chatId, senderId);

    if (warningCount >= config.maxWarnings) {
        try {
            await sock.groupParticipantsUpdate(chatId, [senderId], 'remove');
            warningSystem.removeUser(chatId, senderId);

            await sock.sendMessage(chatId, {
                text: 'USER DI-KICK!\n\n' +
                    '@' + senderId.split('@')[0] + ' telah mencapai ' + config.maxWarnings + ' warning.\n' +
                    'Kata terlarang terakhir: ' + foundWord + '\n\n' +
                    'User telah dikeluarkan dari grup.',
                mentions: [senderId]
            });
        } catch (error) {
            console.error('Error kicking user:', error);
        }
    } else {
        const warningMessage = config.warningMessages[Math.min(warningCount - 1, config.warningMessages.length - 1)];
        const message = warningMessage.replace('{user}', '@' + senderId.split('@')[0]);

        await sock.sendMessage(chatId, {
            text: 'WARNING ' + warningCount + '/' + config.maxWarnings + '!\n\n' +
                message + '\n' +
                'Kata terlarang: ' + foundWord + '\n\n' +
                'Awas ya, masih ' + (config.maxWarnings - warningCount) + ' warning lagi sebelum di-kick!',
            mentions: [senderId]
        });
    }
}

async function handleKickAction(sock, chatId, senderId, foundWord) {
    try {
        await sock.groupParticipantsUpdate(chatId, [senderId], 'remove');

        await sock.sendMessage(chatId, {
            text: 'USER DI-KICK!\n\n' +
                '@' + senderId.split('@')[0] + ' dikeluarkan karena menggunakan kata terlarang.\n' +
                'Kata: ' + foundWord + '\n\n' +
                'Grup ini tidak mentolerir kata-kata kasar!',
            mentions: [senderId]
        });
    } catch (error) {
        console.error('Error kicking user:', error);

        await sock.sendMessage(chatId, {
            text: 'GAGAL MENGHAPUS USER!\n\n' +
                'Bot tidak memiliki izin untuk mengeluarkan user.\n' +
                'Silakan jadikan bot sebagai admin.'
        });
    }
}

async function handleMuteAction(sock, chatId, senderId, foundWord, config) {
    try {
        const muteDuration = config.muteDuration * 60;

        await sock.sendMessage(chatId, {
            text: 'USER DIBISUKAN!\n\n' +
                '@' + senderId.split('@')[0] + ' dibisukan selama ' + config.muteDuration + ' menit.\n' +
                'Alasan: Menggunakan kata terlarang ' + foundWord + '\n\n' +
                'Mohon jaga kata-kata ya!',
            mentions: [senderId]
        });

        warningSystem.addWarning(chatId, senderId);

    } catch (error) {
        console.error('Error muting user:', error);
    }
}

module.exports = {
    handleAntiBadwordCommand,
    handleBadwordDetection,
    antibadwordConfig,
    warningSystem
};
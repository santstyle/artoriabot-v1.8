const fs = require('fs');
const path = require('path');

function loadUserGroupData() {
    try {
        const dataPath = path.join(__dirname, '../data/userGroupData.json');
        if (!fs.existsSync(dataPath)) {
            const defaultData = {
                antibadword: {},
                antilink: {},
                welcome: {},
                goodbye: {},
                chatbot: {},
                warnings: {},
                sudo: []
            };
            fs.writeFileSync(dataPath, JSON.stringify(defaultData, null, 2));
            return defaultData;
        }
        const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
        return data;
    } catch (error) {
        console.error('Hmm, ada error waktu loading data grup nih:', error);
        return {
            antibadword: {},
            antilink: {},
            welcome: {},
            goodbye: {},
            chatbot: {},
            warnings: {}
        };
    }
}

function saveUserGroupData(data) {
    try {
        const dataPath = path.join(__dirname, '../data/userGroupData.json');
        const dir = path.dirname(dataPath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        fs.writeFileSync(dataPath, JSON.stringify(data, null, 2));
        return true;
    } catch (error) {
        console.error('Aduh, gagal nyimpen data grup nih:', error);
        return false;
    }
}

async function setAntilink(groupId, type, action) {
    try {
        const data = loadUserGroupData();
        if (!data.antilink) data.antilink = {};
        if (!data.antilink[groupId]) data.antilink[groupId] = {};

        data.antilink[groupId] = {
            enabled: type === 'on',
            action: action || 'delete' 
        };

        saveUserGroupData(data);
        return true;
    } catch (error) {
        console.error('Ada masalah waktu atur antilink:', error);
        return false;
    }
}

async function getAntilink(groupId, type) {
    try {
        const data = loadUserGroupData();
        if (!data.antilink || !data.antilink[groupId]) return null;

        return type === 'on' ? data.antilink[groupId] : null;
    } catch (error) {
        console.error('Gagal ambil data antilink:', error);
        return null;
    }
}

async function removeAntilink(groupId, type) {
    try {
        const data = loadUserGroupData();
        if (data.antilink && data.antilink[groupId]) {
            delete data.antilink[groupId];
            saveUserGroupData(data);
        }
        return true;
    } catch (error) {
        console.error('Error waktu hapus antilink:', error);
        return false;
    }
}

async function setAntitag(groupId, type, action) {
    try {
        const data = loadUserGroupData();
        if (!data.antitag) data.antitag = {};
        if (!data.antitag[groupId]) data.antitag[groupId] = {};

        data.antitag[groupId] = {
            enabled: type === 'on',
            action: action || 'delete'
        };

        saveUserGroupData(data);
        return true;
    } catch (error) {
        console.error('Wah, error waktu atur antitag:', error);
        return false;
    }
}

async function getAntitag(groupId, type) {
    try {
        const data = loadUserGroupData();
        if (!data.antitag || !data.antitag[groupId]) return null;

        return type === 'on' ? data.antitag[groupId] : null;
    } catch (error) {
        console.error('Gagal ambil data antitag:', error);
        return null;
    }
}

async function removeAntitag(groupId, type) {
    try {
        const data = loadUserGroupData();
        if (data.antitag && data.antitag[groupId]) {
            delete data.antitag[groupId];
            saveUserGroupData(data);
        }
        return true;
    } catch (error) {
        console.error('Error waktu hapus antitag:', error);
        return false;
    }
}

async function incrementWarningCount(groupId, userId) {
    try {
        const data = loadUserGroupData();
        if (!data.warnings) data.warnings = {};
        if (!data.warnings[groupId]) data.warnings[groupId] = {};
        if (!data.warnings[groupId][userId]) data.warnings[groupId][userId] = 0;

        data.warnings[groupId][userId]++;
        saveUserGroupData(data);
        return data.warnings[groupId][userId];
    } catch (error) {
        console.error('Hmm, error waktu nambah warning count:', error);
        return 0;
    }
}

async function resetWarningCount(groupId, userId) {
    try {
        const data = loadUserGroupData();
        if (data.warnings && data.warnings[groupId] && data.warnings[groupId][userId]) {
            data.warnings[groupId][userId] = 0;
            saveUserGroupData(data);
        }
        return true;
    } catch (error) {
        console.error('Error waktu reset warning count:', error);
        return false;
    }
}

async function isSudo(userId) {
    try {
        const data = loadUserGroupData();
        return data.sudo && data.sudo.includes(userId);
    } catch (error) {
        console.error('Error waktu cek sudo user:', error);
        return false;
    }
}

async function addSudo(userJid) {
    try {
        const data = loadUserGroupData();
        if (!data.sudo) data.sudo = [];
        if (!data.sudo.includes(userJid)) {
            data.sudo.push(userJid);
            saveUserGroupData(data);
        }
        return true;
    } catch (error) {
        console.error('Error waktu tambah sudo user:', error);
        return false;
    }
}

async function removeSudo(userJid) {
    try {
        const data = loadUserGroupData();
        if (!data.sudo) data.sudo = [];
        const idx = data.sudo.indexOf(userJid);
        if (idx !== -1) {
            data.sudo.splice(idx, 1);
            saveUserGroupData(data);
        }
        return true;
    } catch (error) {
        console.error('Error waktu hapus sudo user:', error);
        return false;
    }
}

async function getSudoList() {
    try {
        const data = loadUserGroupData();
        return Array.isArray(data.sudo) ? data.sudo : [];
    } catch (error) {
        console.error('Error waktu ambil list sudo:', error);
        return [];
    }
}

async function addWelcome(jid, enabled, message) {
    try {
        const data = loadUserGroupData();
        if (!data.welcome) data.welcome = {};

        data.welcome[jid] = {
            enabled: enabled,
            message: message || '╔═⚔️ WELCOME ⚔️═╗\n║ 🛡️ User: {user}\n║ 🏰 Kingdom: {group}\n╠═══════════════╣\n║ 📜 Message:\n║ {description}\n╚═══════════════╝'
        };

        saveUserGroupData(data);
        return true;
    } catch (error) {
        console.error('Ada yang error waktu tambah welcome message:', error);
        return false;
    }
}

async function delWelcome(jid) {
    try {
        const data = loadUserGroupData();
        if (data.welcome && data.welcome[jid]) {
            delete data.welcome[jid];
            saveUserGroupData(data);
        }
        return true;
    } catch (error) {
        console.error('Error waktu hapus welcome message:', error);
        return false;
    }
}

async function isWelcomeOn(jid) {
    try {
        const data = loadUserGroupData();
        return data.welcome && data.welcome[jid] && data.welcome[jid].enabled;
    } catch (error) {
        console.error('Error waktu cek status welcome:', error);
        return false;
    }
}

async function addGoodbye(jid, enabled, message) {
    try {
        const data = loadUserGroupData();
        if (!data.goodbye) data.goodbye = {};

        data.goodbye[jid] = {
            enabled: enabled,
            message: message || '╔═⚔️ GOODBYE ⚔️═╗\n║ 🛡️ User: {user}\n║ 🏰 Kingdom: {group}\n╠═══════════════╣\n║ ⚰️ We will never miss you!\n╚═══════════════╝'
        };

        saveUserGroupData(data);
        return true;
    } catch (error) {
        console.error('Error waktu tambah goodbye message:', error);
        return false;
    }
}

async function delGoodBye(jid) {
    try {
        const data = loadUserGroupData();
        if (data.goodbye && data.goodbye[jid]) {
            delete data.goodbye[jid];
            saveUserGroupData(data);
        }
        return true;
    } catch (error) {
        console.error('Error waktu hapus goodbye message:', error);
        return false;
    }
}

async function isGoodByeOn(jid) {
    try {
        const data = loadUserGroupData();
        return data.goodbye && data.goodbye[jid] && data.goodbye[jid].enabled;
    } catch (error) {
        console.error('Error waktu cek status goodbye:', error);
        return false;
    }
}

// Add these functions to your existing SQL helper file
async function setAntiBadword(groupId, type, action) {
    try {
        const data = loadUserGroupData();
        if (!data.antibadword) data.antibadword = {};
        if (!data.antibadword[groupId]) data.antibadword[groupId] = {};

        data.antibadword[groupId] = {
            enabled: type === 'on',
            action: action || 'delete'
        };

        saveUserGroupData(data);
        return true;
    } catch (error) {
        console.error('Error waktu atur antibadword:', error);
        return false;
    }
}

async function getAntiBadword(groupId, type) {
    try {
        const data = loadUserGroupData();

        if (!data.antibadword || !data.antibadword[groupId]) {
            console.log('Ga ada setting antibadword nih');
            return null;
        }

        const config = data.antibadword[groupId];

        return type === 'on' ? config : null;
    } catch (error) {
        console.error('Gagal ambil data antibadword:', error);
        return null;
    }
}

async function removeAntiBadword(groupId, type) {
    try {
        const data = loadUserGroupData();
        if (data.antibadword && data.antibadword[groupId]) {
            delete data.antibadword[groupId];
            saveUserGroupData(data);
        }
        return true;
    } catch (error) {
        console.error('Error waktu hapus antibadword:', error);
        return false;
    }
}

async function setChatbot(groupId, enabled) {
    try {
        const data = loadUserGroupData();
        if (!data.chatbot) data.chatbot = {};

        data.chatbot[groupId] = {
            enabled: enabled
        };

        saveUserGroupData(data);
        return true;
    } catch (error) {
        console.error('Error waktu atur chatbot:', error);
        return false;
    }
}

async function getChatbot(groupId) {
    try {
        const data = loadUserGroupData();
        return data.chatbot?.[groupId] || null;
    } catch (error) {
        console.error('Error waktu ambil data chatbot:', error);
        return null;
    }
}

async function removeChatbot(groupId) {
    try {
        const data = loadUserGroupData();
        if (data.chatbot && data.chatbot[groupId]) {
            delete data.chatbot[groupId];
            saveUserGroupData(data);
        }
        return true;
    } catch (error) {
        console.error('Error waktu hapus chatbot:', error);
        return false;
    }
}

async function addBadword(groupId, word) {
    try {
        const data = loadUserGroupData();
        if (!data.antibadword) data.antibadword = {};
        if (!data.antibadword[groupId]) data.antibadword[groupId] = { enabled: false, action: 'delete', badwords: [] };

        if (!data.antibadword[groupId].badwords) data.antibadword[groupId].badwords = [];

        const lowerWord = word.toLowerCase().trim();
        if (!data.antibadword[groupId].badwords.includes(lowerWord)) {
            data.antibadword[groupId].badwords.push(lowerWord);
            saveUserGroupData(data);
            return true;
        }
        return false;
    } catch (error) {
        console.error('Error waktu tambah kata buruk:', error);
        return false;
    }
}

async function removeBadword(groupId, word) {
    try {
        const data = loadUserGroupData();
        if (!data.antibadword || !data.antibadword[groupId] || !data.antibadword[groupId].badwords) return false;

        const lowerWord = word.toLowerCase().trim();
        const index = data.antibadword[groupId].badwords.indexOf(lowerWord);
        if (index !== -1) {
            data.antibadword[groupId].badwords.splice(index, 1);
            saveUserGroupData(data);
            return true;
        }
        return false; 
    } catch (error) {
        console.error('Error waktu hapus kata buruk:', error);
        return false;
    }
}

async function getBadwords(groupId) {
    try {
        const data = loadUserGroupData();
        if (!data.antibadword || !data.antibadword[groupId] || !data.antibadword[groupId].badwords) return [];
        return data.antibadword[groupId].badwords;
    } catch (error) {
        console.error('Error waktu ambil daftar kata buruk:', error);
        return [];
    }
}

async function clearBadwords(groupId) {
    try {
        const data = loadUserGroupData();
        if (data.antibadword && data.antibadword[groupId]) {
            data.antibadword[groupId].badwords = [];
            saveUserGroupData(data);
        }
        return true;
    } catch (error) {
        console.error('Error waktu bersihkan daftar kata buruk:', error);
        return false;
    }
}

module.exports = {
    setAntilink,
    getAntilink,
    removeAntilink,
    setAntitag,
    getAntitag,
    removeAntitag,
    incrementWarningCount,
    resetWarningCount,
    isSudo,
    addSudo,
    removeSudo,
    getSudoList,
    addWelcome,
    delWelcome,
    isWelcomeOn,
    addGoodbye,
    delGoodBye,
    isGoodByeOn,
    setAntiBadword,
    getAntiBadword,
    removeAntiBadword,
    setChatbot,
    getChatbot,
    removeChatbot,
    addBadword,
    removeBadword,
    getBadwords,
    clearBadwords,
};

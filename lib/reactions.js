const fs = require('fs');
const path = require('path');

// List of emojis for command reactions
const commandEmojis = ['⏳'];

// Path for storing auto-reaction state
const USER_GROUP_DATA = path.join(__dirname, '../data/userGroupData.json');

// Load auto-reaction state from file
function loadAutoReactionState() {
    try {
        if (fs.existsSync(USER_GROUP_DATA)) {
            const data = JSON.parse(fs.readFileSync(USER_GROUP_DATA));
            return data.autoReaction || false;
        }
    } catch (error) {
        console.error('Wah, error waktu loading auto-reaction state nih:', error);
    }
    return false;
}

// Save auto-reaction state to file
function saveAutoReactionState(state) {
    try {
        const data = fs.existsSync(USER_GROUP_DATA)
            ? JSON.parse(fs.readFileSync(USER_GROUP_DATA))
            : { groups: [], chatbot: {} };

        data.autoReaction = state;
        fs.writeFileSync(USER_GROUP_DATA, JSON.stringify(data, null, 2));
    } catch (error) {
        console.error('Aduh, error waktu nyimpen auto-reaction state:', error);
    }
}

// Store auto-reaction state
let isAutoReactionEnabled = loadAutoReactionState();

function getRandomEmoji() {
    return commandEmojis[0];
}

// Function to add reaction to a command message
async function addCommandReaction(sock, message) {
    try {
        if (!isAutoReactionEnabled || !message?.key?.id) return;

        const emoji = getRandomEmoji();
        await sock.sendMessage(message.key.remoteJid, {
            react: {
                text: emoji,
                key: message.key
            }
        });
    } catch (error) {
        console.error('Hmm, ada error waktu nambahin reaksi:', error);
    }
}

// Function to handle areact command
async function handleAreactCommand(sock, chatId, message, isOwner) {
    try {
        if (!isOwner) {
            await sock.sendMessage(chatId, {
                text: 'Maaf, command ini cuma buat owner aja~',
                quoted: message
            });
            return;
        }

        const args = message.message?.conversation?.split(' ') || [];
        const action = args[1]?.toLowerCase();

        if (action === 'on') {
            isAutoReactionEnabled = true;
            saveAutoReactionState(true);
            await sock.sendMessage(chatId, {
                text: 'Horee! Auto-reaction udah aku nyalain di semua tempat~ Sekarang aku bakal kasih reaksi otomatis',
                quoted: message
            });
        } else if (action === 'off') {
            isAutoReactionEnabled = false;
            saveAutoReactionState(false);
            await sock.sendMessage(chatId, {
                text: 'Oke deh, auto-reaction udah aku matiin. Aku ga bakal kasih reaksi otomatis lagi~',
                quoted: message
            });
        } else {
            const currentState = isAutoReactionEnabled ? 'nyala' : 'mati';
            await sock.sendMessage(chatId, {
                text: `Auto-reaction lagi ${currentState} nih di semua grup.\n\nCoba pake:\n.areact on - Nyalain auto-reaction\n.areact off - Matiin auto-reaction`,
                quoted: message
            });
        }
    } catch (error) {
        console.error('Ada error nih waktu handle command areact:', error);
        await sock.sendMessage(chatId, {
            text: 'Aduh, ada yang error waktu atur auto-reaction. Coba lagi ya~',
            quoted: message
        });
    }
}

module.exports = {
    addCommandReaction,
    handleAreactCommand
};
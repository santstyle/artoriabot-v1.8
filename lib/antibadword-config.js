const fs = require('fs');
const path = require('path');

const configPath = path.join(__dirname, '../data/antibadword-config.json');

const defaultConfig = {
    enabled: false,
    action: 'delete',
    muteDuration: 5,
    maxWarnings: 3,
    badwords: [], 
    autoDelete: true,
    warningMessages: [
        "Hai {user}, kata-kata kasar tidak diperbolehkan di grup ini!",
        "Kedua kalinya {user}, hati-hati ya dengan kata-katamu!",
        "Terakhir kali peringatan {user}! Masih kasar lagi akan di-kick!"
    ],
    excludedUsers: [],
    excludedRoles: ['admin']
};

function loadGroupConfig(groupId) {
    try {
        if (!fs.existsSync(configPath)) {
            return { ...defaultConfig };
        }
        
        const data = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        return { ...defaultConfig, ...data[groupId] };
    } catch (error) {
        console.error('Error loading antibadword config:', error);
        return { ...defaultConfig };
    }
}

function saveGroupConfig(groupId, config) {
    try {
        let allData = {};
        
        if (fs.existsSync(configPath)) {
            allData = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        }
        
        allData[groupId] = config;
        fs.writeFileSync(configPath, JSON.stringify(allData, null, 2), 'utf8');
        return true;
    } catch (error) {
        console.error('Error saving antibadword config:', error);
        return false;
    }
}

function updateGroupConfig(groupId, updates) {
    const config = loadGroupConfig(groupId);
    const newConfig = { ...config, ...updates };
    return saveGroupConfig(groupId, newConfig);
}

function addBadword(groupId, word) {
    const config = loadGroupConfig(groupId);
    if (!config.badwords.includes(word.toLowerCase())) {
        config.badwords.push(word.toLowerCase());
        return saveGroupConfig(groupId, config);
    }
    return false;
}

function removeBadword(groupId, word) {
    const config = loadGroupConfig(groupId);
    const index = config.badwords.indexOf(word.toLowerCase());
    if (index > -1) {
        config.badwords.splice(index, 1);
        return saveGroupConfig(groupId, config);
    }
    return false;
}

function getBadwords(groupId) {
    const config = loadGroupConfig(groupId);
    return config.badwords;
}

function isBadword(groupId, word) {
    const config = loadGroupConfig(groupId);
    return config.badwords.includes(word.toLowerCase());
}

function resetGroupConfig(groupId) {
    return saveGroupConfig(groupId, { ...defaultConfig });
}

module.exports = {
    loadGroupConfig,
    saveGroupConfig,
    updateGroupConfig,
    addBadword,
    removeBadword,
    getBadwords,
    isBadword,
    resetGroupConfig
};
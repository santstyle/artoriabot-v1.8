const fs = require('fs');
const path = require('path');

const warningPath = path.join(__dirname, '../data/warnings.json');

class WarningSystem {
    constructor() {
        this.warnings = this.loadWarnings();
    }

    loadWarnings() {
        try {
            if (!fs.existsSync(warningPath)) {
                return {};
            }
            return JSON.parse(fs.readFileSync(warningPath, 'utf8'));
        } catch (error) {
            console.error('Error loading warnings:', error);
            return {};
        }
    }

    saveWarnings() {
        try {
            fs.writeFileSync(warningPath, JSON.stringify(this.warnings, null, 2), 'utf8');
            return true;
        } catch (error) {
            console.error('Error saving warnings:', error);
            return false;
        }
    }

    addWarning(groupId, userId) {
        if (!this.warnings[groupId]) {
            this.warnings[groupId] = {};
        }
        
        if (!this.warnings[groupId][userId]) {
            this.warnings[groupId][userId] = {
                count: 0,
                lastWarning: null,
                history: []
            };
        }

        const warningData = this.warnings[groupId][userId];
        warningData.count += 1;
        warningData.lastWarning = new Date().toISOString();
        warningData.history.push({
            timestamp: new Date().toISOString(),
            reason: 'Badword detected'
        });

        // Keep only last 10 warnings in history
        if (warningData.history.length > 10) {
            warningData.history = warningData.history.slice(-10);
        }

        this.saveWarnings();
        return warningData.count;
    }

    getWarningCount(groupId, userId) {
        if (!this.warnings[groupId] || !this.warnings[groupId][userId]) {
            return 0;
        }
        return this.warnings[groupId][userId].count || 0;
    }

    resetWarnings(groupId, userId) {
        if (this.warnings[groupId] && this.warnings[groupId][userId]) {
            this.warnings[groupId][userId] = {
                count: 0,
                lastWarning: null,
                history: []
            };
            this.saveWarnings();
            return true;
        }
        return false;
    }

    removeUser(groupId, userId) {
        if (this.warnings[groupId] && this.warnings[groupId][userId]) {
            delete this.warnings[groupId][userId];
            this.saveWarnings();
            return true;
        }
        return false;
    }

    clearAllGroupWarnings(groupId) {
        if (this.warnings[groupId]) {
            delete this.warnings[groupId];
            this.saveWarnings();
            return true;
        }
        return false;
    }

    getUserWarnings(groupId, userId) {
        if (!this.warnings[groupId] || !this.warnings[groupId][userId]) {
            return null;
        }
        return this.warnings[groupId][userId];
    }

    getAllWarnings(groupId) {
        return this.warnings[groupId] || {};
    }
}

module.exports = new WarningSystem();
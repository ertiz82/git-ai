const fs = require('fs');
const path = require('path');

const PROMPTS_DIR = path.join(__dirname, 'prompts');

// Stub dosyalarını bir kez oku ve cache'le
const cache = {};

function loadPrompt(name) {
    if (cache[name]) return cache[name];

    const stubPath = path.join(PROMPTS_DIR, `prompt-${name}.stub`);
    try {
        cache[name] = fs.readFileSync(stubPath, 'utf8');
    } catch (e) {
        throw new Error(`Prompt stub not found: ${stubPath}`);
    }
    return cache[name];
}

function getGroupPrompt() {
    return loadPrompt('group');
}

function getCommitPrompt() {
    return loadPrompt('commit');
}

function getIssuePrompt() {
    return loadPrompt('issue');
}

// Prompt'a değişkenleri inject et
function buildPrompt(template, vars = {}) {
    let result = template;
    for (const [key, value] of Object.entries(vars)) {
        result = result.replace(new RegExp(`{{${key}}}`, 'g'), value || '');
    }
    return result;
}

module.exports = {
    getGroupPrompt,
    getCommitPrompt,
    getIssuePrompt,
    buildPrompt,
    // Backward compat - eski template'ler
    get GROUP_PROMPT_TEMPLATE() { return getGroupPrompt(); },
    get ISSUE_PROMPT_TEMPLATE() { return getIssuePrompt(); }
};
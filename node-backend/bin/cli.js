#!/usr/bin/env node
const fs = require('fs-extra');
const path = require('path');
const execa = require('execa');
const fetch = require('node-fetch');
const argv = require('minimist')(process.argv.slice(2));

const { findRepoRoot, loadConfig, collectMinimalDiff, formatDiffForPrompt, currentBranch, extractJiraFromBranch } = require('./lib/git-utils');
const { getGroupPrompt, buildPrompt } = require('./lib/prompt-templates');
const { buildCommitMessage } = require('./lib/commit-template');

async function main() {
    try {
        const cmd = argv._[0] || 'help';
        if (cmd === 'help') return printHelp();
        if (cmd === 'version') return printVersion();
        if (cmd === 'commit') return await runCommit();
        console.error('Unknown subcommand:', cmd);
        process.exit(2);
    } catch (err) {
        console.error('Error:', err.message || err);
        process.exit(1);
    }
}

function printHelp() {
    console.log(`Usage: git-ai <command>

Commands:
  commit    Analyze changes, group them, and create commits
  help      Show this help message
  version   Show version

Options:
  --dry-run    Show what would be committed without committing
`);
}

function printVersion() {
    console.log('git-ai 0.1.0');
}

async function runCommit() {
    const cwd = process.cwd();
    const repoRoot = await findRepoRoot(cwd);
    const config = await loadConfig(repoRoot);
    const dryRun = argv['dry-run'] || argv.dryRun;

    // 1. Minimal diff topla
    const diffResult = await collectMinimalDiff(repoRoot);

    if (diffResult.files.length === 0) {
        console.log('No changes to commit.');
        return;
    }

    console.log(`Found ${diffResult.files.length} changed file(s)`);

    // 2. API key kontrol
    const apiKey = process.env.CLOUD_AI_API_KEY || config?.cloud?.apiKey;
    if (!apiKey) {
        throw new Error('CLOUD_AI_API_KEY missing (set env or in jira.local.json under cloud.apiKey)');
    }

    // 3. Group prompt oluştur - TEK API CALL
    const diffText = formatDiffForPrompt(diffResult);
    const groupPrompt = buildPrompt(getGroupPrompt(), {
        DIFF_SNIPPETS: diffText
    });

    console.log('Analyzing changes...');
    const groupResponse = await callCloudAI(apiKey, groupPrompt, { maxTokens: 800 });

    // 4. Parse groups
    let groups;
    try {
        groups = JSON.parse(groupResponse);
    } catch (e) {
        throw new Error('AI returned invalid JSON: ' + groupResponse.slice(0, 200));
    }

    if (!Array.isArray(groups) || groups.length === 0) {
        throw new Error('No groups returned from AI');
    }

    console.log(`Grouped into ${groups.length} commit(s)`);

    // 5. Branch ve JIRA bilgisi
    const branch = await currentBranch(repoRoot);
    const jiraInfo = extractJiraFromBranch(branch);

    if (jiraInfo) {
        console.log(`JIRA ticket detected: ${jiraInfo.prefix}-${jiraInfo.number}`);
    }

    // 6. Her grup için LOCAL template ile commit oluştur
    for (const group of groups) {
        if (!group.files || group.files.length === 0) continue;

        // Commit mesajını LOCAL olarak üret - API CALL YOK
        const commitMessage = buildCommitMessage(group, { jiraInfo, config });

        if (dryRun) {
            console.log('\n--- DRY RUN ---');
            console.log('Files:', group.files.join(', '));
            console.log('Message:\n' + commitMessage);
            console.log('---------------\n');
            continue;
        }

        // git add
        await execa('git', ['add', '--'].concat(group.files), { cwd: repoRoot });

        // git commit
        await execa('git', ['commit', '-m', commitMessage], { cwd: repoRoot });

        console.log(`✓ Committed: ${group.title || group.files.join(', ')}`);
    }

    if (!dryRun) {
        console.log('\nDone! All changes committed.');
    }
}

async function callCloudAI(apiKey, prompt, opts = {}) {
    const url = process.env.CLOUD_AI_API_URL || 'https://api.cloud.ai/v1/generate';

    const res = await fetch(url, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            prompt,
            max_tokens: opts.maxTokens || 500
        })
    });

    if (!res.ok) {
        const txt = await res.text();
        throw new Error(`API error ${res.status}: ${txt}`);
    }

    const json = await res.json();
    return json.text || JSON.stringify(json);
}

main();
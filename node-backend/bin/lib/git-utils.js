const execa = require('execa');
const fs = require('fs-extra');
const path = require('path');


async function findRepoRoot(start) {
    const { stdout } = await execa('git', ['rev-parse', '--show-toplevel'], { cwd: start });
    return stdout.trim();
}


async function loadConfig(repoRoot) {
    const cfgPath = path.join(repoRoot, 'jira.json');
    const localPath = path.join(repoRoot, 'jira.local.json');
    const cfg = await fs.readJson(cfgPath).catch(() => ({}));
    const local = await fs.readJson(localPath).catch(() => ({}));
    return Object.assign({}, cfg, local);
}


async function collectMinimalDiff(repoRoot) {
    // Token-efficient diff: file path + sadece değişen satırlar (max 100 satır/dosya)
    const { stdout } = await execa('git', ['status', '--porcelain'], { cwd: repoRoot });
    const lines = stdout.split('\n').filter(Boolean);

    const result = {
        files: [],
        diffs: []
    };

    for (const line of lines) {
        const status = line.slice(0, 2).trim();
        const filePath = line.slice(3);

        result.files.push({ path: filePath, status });

        // Sadece modified/added dosyalar için diff al
        if (status === 'M' || status === 'A' || status === 'AM' || status === '??') {
            try {
                // Staged değişiklikler için --cached, unstaged için normal diff
                const diffArgs = status === '??'
                    ? ['diff', '--no-index', '/dev/null', filePath]
                    : ['diff', '--unified=3', '--', filePath];

                const { stdout: diff } = await execa('git', diffArgs, { cwd: repoRoot }).catch(() => ({ stdout: '' }));

                if (diff) {
                    // Sadece +/- satırları al (context hariç), max 100 satır
                    const changedLines = diff
                        .split('\n')
                        .filter(l => l.startsWith('+') || l.startsWith('-'))
                        .filter(l => !l.startsWith('+++') && !l.startsWith('---'))
                        .slice(0, 100);

                    if (changedLines.length > 0) {
                        result.diffs.push({
                            path: filePath,
                            changes: changedLines.join('\n')
                        });
                    }
                }
            } catch (e) {
                // ignore
            }
        }
    }

    return result;
}

function formatDiffForPrompt(diffResult) {
    // AI'ya gönderilecek minimal format
    const fileList = diffResult.files.map(f => f.path).join('\n');
    const diffs = diffResult.diffs.map(d => `[${d.path}]\n${d.changes}`).join('\n\n');

    return `FILES:\n${fileList}\n\nDIFFS:\n${diffs}`;
}

function getValidFiles(diffResult) {
    return diffResult.files.map(f => f.path);
}


async function currentBranch(repoRoot) {
    const { stdout } = await execa('git', ['rev-parse', '--abbrev-ref', 'HEAD'], { cwd: repoRoot });
    return stdout.trim();
}


function extractJiraFromBranch(branch) {
// matches feature/SCRUM-571-description
    const m = branch.match(/^(?:feature|hotfix|bugfix|task)\/([A-Z]+)-(\d+)/i);
    if (!m) return null;
    return { prefix: m[1].toUpperCase(), number: m[2] };
}


module.exports = { findRepoRoot, loadConfig, collectMinimalDiff, formatDiffForPrompt, getValidFiles, currentBranch, extractJiraFromBranch };
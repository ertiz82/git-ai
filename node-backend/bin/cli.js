#!/usr/bin/env node
const fs = require('fs-extra');
const path = require('path');
const execa = require('execa');
const fetch = require('node-fetch');
const readline = require('readline');
const argv = require('minimist')(process.argv.slice(2));

const { findRepoRoot, loadConfig, collectMinimalDiff, formatDiffForPrompt, getValidFiles, currentBranch, extractJiraFromBranch } = require('./lib/git-utils');
const { getGroupPrompt, buildPrompt } = require('./lib/prompt-templates');
const { buildCommitMessage } = require('./lib/commit-template');

async function main() {
    try {
        const cmd = argv._[0] || 'help';
        if (cmd === 'help') return printHelp();
        if (cmd === 'version') return printVersion();
        if (cmd === 'init') return await runInit();
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
  init      Initialize git-ai in current project (interactive setup)
  commit    Analyze changes, group them, and create commits
  help      Show this help message
  version   Show version

Options:
  --dry-run    Show what would be committed without committing
`);
}

function printVersion() {
    console.log('git-ai 1.0.3');
}

// ==================== INIT COMMAND ====================

const PROVIDERS = {
    ollama: {
        name: 'Ollama (Free, Local)',
        models: [
            { id: 'gemma3:4b', name: 'Gemma 3 4B', desc: 'Recommended, fast', size: '3.3GB' },
            { id: 'llama3.2', name: 'Llama 3.2', desc: 'Meta compact model', size: '2.0GB' },
            { id: 'llama3.3', name: 'Llama 3.3 70B', desc: 'High performance', size: '43GB' },
            { id: 'qwen2.5-coder:7b', name: 'Qwen 2.5 Coder 7B', desc: 'Code optimized', size: '4.7GB' },
            { id: 'qwen3', name: 'Qwen 3', desc: 'Latest Qwen generation', size: '4.7GB' },
            { id: 'deepseek-r1:8b', name: 'DeepSeek R1 8B', desc: 'Reasoning model', size: '4.9GB' },
            { id: 'codellama:7b', name: 'Code Llama 7B', desc: 'Code generation', size: '3.8GB' },
            { id: 'mistral', name: 'Mistral 7B', desc: 'General purpose', size: '4.1GB' },
            { id: 'phi4', name: 'Phi 4 14B', desc: 'Microsoft SOTA', size: '9.1GB' },
            { id: 'gemma2:9b', name: 'Gemma 2 9B', desc: 'Google efficient', size: '5.4GB' }
        ]
    },
    gemini: {
        name: 'Google Gemini',
        models: [
            { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', desc: 'Best price-performance', cost: '$0.075/1M tokens' },
            { id: 'gemini-2.5-flash-lite', name: 'Gemini 2.5 Flash Lite', desc: 'Fastest, cheapest', cost: '$0.02/1M tokens' },
            { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro', desc: 'Advanced reasoning', cost: '$1.25/1M tokens' },
            { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash', desc: 'Second-gen workhorse', cost: '$0.10/1M tokens' },
            { id: 'gemini-3-pro-preview', name: 'Gemini 3 Pro Preview', desc: 'Most intelligent', cost: '$2.50/1M tokens' }
        ]
    },
    openai: {
        name: 'OpenAI (GPT)',
        models: [
            { id: 'gpt-4.1-nano', name: 'GPT-4.1 Nano', desc: 'Fastest, cheapest', cost: '$0.10/1M tokens' },
            { id: 'gpt-4.1-mini', name: 'GPT-4.1 Mini', desc: 'Good balance', cost: '$0.40/1M tokens' },
            { id: 'gpt-4.1', name: 'GPT-4.1', desc: 'Best for coding', cost: '$2.00/1M tokens' },
            { id: 'gpt-4o-mini', name: 'GPT-4o Mini', desc: 'Fast multimodal', cost: '$0.15/1M tokens' },
            { id: 'gpt-4o', name: 'GPT-4o', desc: 'Omni multimodal', cost: '$2.50/1M tokens' },
            { id: 'o3-mini', name: 'o3-mini', desc: 'Reasoning model', cost: '$1.10/1M tokens' }
        ]
    },
    anthropic: {
        name: 'Anthropic (Claude)',
        models: [
            { id: 'claude-haiku-4-5-20251001', name: 'Claude 4.5 Haiku', desc: 'Fastest', cost: '$0.25/1M tokens' },
            { id: 'claude-sonnet-4-5-20250929', name: 'Claude 4.5 Sonnet', desc: 'Best balance', cost: '$3/1M tokens' },
            { id: 'claude-opus-4-5-20251101', name: 'Claude 4.5 Opus', desc: 'Most capable', cost: '$15/1M tokens' },
            { id: 'claude-3-5-haiku-20241022', name: 'Claude 3.5 Haiku', desc: 'Fast legacy', cost: '$0.25/1M tokens' },
            { id: 'claude-3-haiku-20240307', name: 'Claude 3 Haiku', desc: 'Budget legacy', cost: '$0.25/1M tokens' }
        ]
    }
};

function createReadlineInterface() {
    return readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });
}

function ask(rl, question) {
    return new Promise(resolve => rl.question(question, resolve));
}

async function selectOption(rl, prompt, options) {
    console.log(`\n${prompt}`);
    options.forEach((opt, i) => {
        const desc = opt.desc ? ` - ${opt.desc}` : '';
        const extra = opt.size ? ` [${opt.size}]` : opt.cost ? ` [${opt.cost}]` : '';
        console.log(`  ${i + 1}) ${opt.name || opt.id}${desc}${extra}`);
    });

    while (true) {
        const answer = await ask(rl, `\nSelect (1-${options.length}): `);
        const num = parseInt(answer, 10);
        if (num >= 1 && num <= options.length) {
            return options[num - 1];
        }
        console.log('Invalid selection, try again.');
    }
}

async function checkOllamaInstalled() {
    try {
        await execa('which', ['ollama']);
        return true;
    } catch {
        return false;
    }
}

async function checkOllamaRunning() {
    try {
        const res = await fetch('http://localhost:11434/api/tags');
        return res.ok;
    } catch {
        return false;
    }
}

async function getOllamaModels() {
    try {
        const res = await fetch('http://localhost:11434/api/tags');
        if (!res.ok) return [];
        const data = await res.json();
        return data.models?.map(m => m.name) || [];
    } catch {
        return [];
    }
}

async function installOllama(rl) {
    console.log('\n⚠ Ollama is not installed.');
    const answer = await ask(rl, 'Install Ollama via Homebrew? (y/n): ');

    if (answer.toLowerCase() === 'y') {
        console.log('\nInstalling Ollama...');
        try {
            await execa('brew', ['install', 'ollama'], { stdio: 'inherit' });
            console.log('✓ Ollama installed successfully');
            return true;
        } catch (err) {
            console.error('✗ Failed to install Ollama:', err.message);
            console.log('Please install manually: brew install ollama');
            return false;
        }
    }
    return false;
}

async function startOllama() {
    console.log('\nStarting Ollama server...');
    try {
        // Start ollama serve in background
        execa('ollama', ['serve'], { detached: true, stdio: 'ignore' }).unref();
        // Wait a bit for it to start
        await new Promise(resolve => setTimeout(resolve, 2000));
        return await checkOllamaRunning();
    } catch {
        return false;
    }
}

async function pullOllamaModel(model) {
    console.log(`\nPulling model ${model}... (this may take a while)`);
    try {
        await execa('ollama', ['pull', model], { stdio: 'inherit' });
        console.log(`✓ Model ${model} pulled successfully`);
        return true;
    } catch (err) {
        console.error(`✗ Failed to pull model: ${err.message}`);
        return false;
    }
}

async function updateGitignore(repoRoot) {
    const gitignorePath = path.join(repoRoot, '.gitignore');
    const entry = 'jira.local.json';

    try {
        let content = '';
        if (await fs.pathExists(gitignorePath)) {
            content = await fs.readFile(gitignorePath, 'utf8');
            if (content.includes(entry)) {
                return; // Already exists
            }
        }

        // Add entry
        const newContent = content.endsWith('\n') || content === ''
            ? content + entry + '\n'
            : content + '\n' + entry + '\n';

        await fs.writeFile(gitignorePath, newContent);
        console.log('✓ Added jira.local.json to .gitignore');
    } catch (err) {
        console.log(`⚠ Could not update .gitignore: ${err.message}`);
    }
}

async function runInit() {
    const cwd = process.cwd();
    let repoRoot;

    try {
        repoRoot = await findRepoRoot(cwd);
    } catch {
        console.error('Error: Not a git repository. Run "git init" first.');
        process.exit(1);
    }

    console.log('🚀 git-ai initialization\n');
    console.log(`Project: ${repoRoot}\n`);

    const rl = createReadlineInterface();

    try {
        // 1. Select provider
        const providerOptions = Object.entries(PROVIDERS).map(([id, p]) => ({ id, name: p.name }));
        const selectedProvider = await selectOption(rl, 'Select AI provider:', providerOptions);
        const provider = selectedProvider.id;

        // 2. Select model
        const modelOptions = PROVIDERS[provider].models;
        const selectedModel = await selectOption(rl, `Select ${PROVIDERS[provider].name} model:`, modelOptions);
        const model = selectedModel.id;

        // 3. Provider-specific setup
        let apiKey = null;

        if (provider === 'ollama') {
            // Check Ollama installation
            const isInstalled = await checkOllamaInstalled();

            if (!isInstalled) {
                const installed = await installOllama(rl);
                if (!installed) {
                    console.log('\n⚠ Continuing without Ollama. Install it later and run git-ai init again.');
                }
            }

            // Check if running
            let isRunning = await checkOllamaRunning();
            if (!isRunning && isInstalled) {
                isRunning = await startOllama();
                if (!isRunning) {
                    console.log('\n⚠ Could not start Ollama. Run "ollama serve" manually.');
                }
            }

            // Check if model is pulled
            if (isRunning) {
                const installedModels = await getOllamaModels();
                const modelInstalled = installedModels.some(m => m.startsWith(model.split(':')[0]));

                if (!modelInstalled) {
                    await pullOllamaModel(model);
                } else {
                    console.log(`✓ Model ${model} is already available`);
                }
            }
        } else {
            // Cloud providers - need API key
            console.log(`\nGet your API key from:`);
            if (provider === 'anthropic') {
                console.log('  https://console.anthropic.com/settings/keys');
            } else if (provider === 'openai') {
                console.log('  https://platform.openai.com/api-keys');
            } else if (provider === 'gemini') {
                console.log('  https://aistudio.google.com/app/apikey');
            }

            apiKey = await ask(rl, '\nEnter API key: ');
            if (!apiKey.trim()) {
                console.log('⚠ No API key provided. You can add it later to jira.local.json');
                apiKey = null;
            }
        }

        // 4. MaxTokens setting
        console.log('\nMaxTokens controls response length. Higher = more files can be grouped.');
        console.log('Recommended: 4000 (default), 8000 (large projects), 16000 (very large)');
        const maxTokensAnswer = await ask(rl, 'MaxTokens (press Enter for 4000): ');
        const maxTokens = parseInt(maxTokensAnswer, 10) || 4000;

        // 5. Create jira.local.json
        const localConfig = {
            cloud: {
                provider,
                model,
                maxTokens
            }
        };

        if (apiKey) {
            localConfig.cloud.apiKey = apiKey;
        }

        const localConfigPath = path.join(repoRoot, 'jira.local.json');
        await fs.writeJson(localConfigPath, localConfig, { spaces: 2 });
        console.log(`\n✓ Created jira.local.json`);

        // 6. Create jira.json (optional project config)
        const jiraConfigPath = path.join(repoRoot, 'jira.json');
        if (!await fs.pathExists(jiraConfigPath)) {
            const createJira = await ask(rl, '\nCreate jira.json for JIRA integration? (y/n): ');
            if (createJira.toLowerCase() === 'y') {
                const projectKey = await ask(rl, 'Project key (e.g., SCRUM): ') || 'PROJECT';
                const jiraUrl = await ask(rl, 'JIRA base URL (e.g., https://company.atlassian.net): ');

                const jiraConfig = {
                    project: {
                        key: projectKey.toUpperCase(),
                        name: 'Project Name',
                        url: jiraUrl ? `${jiraUrl}/browse/${projectKey.toUpperCase()}` : ''
                    },
                    jira: {
                        baseUrl: jiraUrl || ''
                    },
                    commitPrefix: projectKey.toUpperCase(),
                    branchPattern: `feature/{prefix}-{issueNumber}-{description}`
                };

                await fs.writeJson(jiraConfigPath, jiraConfig, { spaces: 2 });
                console.log('✓ Created jira.json');
            }
        } else {
            console.log('✓ jira.json already exists');
        }

        // 7. Update .gitignore
        await updateGitignore(repoRoot);

        // 8. Done!
        console.log('\n✅ git-ai initialized successfully!\n');
        console.log('Usage:');
        console.log('  git-ai commit --dry-run  # Preview commits');
        console.log('  git-ai commit            # Create commits\n');

    } finally {
        rl.close();
    }
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

    // 2. API key ve provider kontrol
    const provider = process.env.AI_PROVIDER || config?.cloud?.provider || 'anthropic';
    const apiKey = process.env.CLOUD_AI_API_KEY || config?.cloud?.apiKey;
    const model = process.env.CLOUD_AI_MODEL || config?.cloud?.model;

    if (provider !== 'ollama' && !apiKey) {
        throw new Error('CLOUD_AI_API_KEY missing (set env or in jira.local.json under cloud.apiKey)');
    }

    console.log(`Using AI provider: ${provider}`);

    // 3. Group prompt oluştur - TEK API CALL
    const diffText = formatDiffForPrompt(diffResult);
    const groupPrompt = buildPrompt(getGroupPrompt(), {
        DIFF_SNIPPETS: diffText
    });

    console.log('Analyzing changes...');
    const maxTokens = config?.cloud?.maxTokens || 4000;
    const groupResponse = await callCloudAI(apiKey, groupPrompt, {
        maxTokens,
        provider,
        model,
        ollamaUrl: config?.cloud?.url
    });

    // 4. Parse groups (markdown code block temizle)
    let groups;
    try {
        let jsonStr = groupResponse.trim();
        // ```json ... ``` formatını temizle
        if (jsonStr.startsWith('```')) {
            jsonStr = jsonStr.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
        }
        groups = JSON.parse(jsonStr);
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

    // 6. Geçerli dosya listesi
    const validFiles = getValidFiles(diffResult);

    // 6.1 Eksik dosyaları tespit et ve otomatik grupla
    const allGroupedFiles = groups.flatMap(g => g.files || []);
    const missingFiles = validFiles.filter(f => !allGroupedFiles.includes(f));

    if (missingFiles.length > 0) {
        console.log(`⚠ AI missed ${missingFiles.length} file(s), adding to miscellaneous group`);
        groups.push({
            title: 'Add remaining project files',
            summary: 'Additional configuration and boilerplate files',
            files: missingFiles
        });
    }

    // 7. Her grup için LOCAL template ile commit oluştur
    for (const group of groups) {
        if (!group.files || group.files.length === 0) continue;

        // AI'nın döndürdüğü dosyaları doğrula - sadece gerçek dosyaları al
        const verifiedFiles = group.files.filter(f => validFiles.includes(f));

        if (verifiedFiles.length === 0) {
            console.log(`⚠ Skipping group "${group.title}" - no valid files`);
            continue;
        }

        // Commit mesajını LOCAL olarak üret - API CALL YOK
        const commitMessage = buildCommitMessage({ ...group, files: verifiedFiles }, { jiraInfo, config });

        if (dryRun) {
            console.log('\n--- DRY RUN ---');
            console.log('Files:', verifiedFiles.join(', '));
            console.log('Message:\n' + commitMessage);
            console.log('---------------\n');
            continue;
        }

        // git add
        await execa('git', ['add', '--'].concat(verifiedFiles), { cwd: repoRoot });

        // Staged değişiklik var mı kontrol et
        const { stdout: staged } = await execa('git', ['diff', '--cached', '--name-only'], { cwd: repoRoot });
        if (!staged.trim()) {
            console.log(`⚠ Skipping group "${group.title}" - no staged changes`);
            continue;
        }

        // git commit (mesajı tek satıra indir)
        const safeMessage = commitMessage.replace(/\n+/g, ' ').trim();
        await execa('git', ['commit', '-m', safeMessage], { cwd: repoRoot });

        console.log(`✓ Committed: ${group.title || verifiedFiles.join(', ')}`);
    }

    if (!dryRun) {
        console.log('\nDone! All changes committed.');
    }
}

async function callCloudAI(apiKey, prompt, opts = {}) {
    const provider = opts.provider || process.env.AI_PROVIDER || 'anthropic';
    const model = opts.model || process.env.CLOUD_AI_MODEL;

    if (provider === 'ollama') {
        return callOllama(prompt, model || 'llama3.2', opts);
    } else if (provider === 'openai') {
        return callOpenAI(apiKey, prompt, model || 'gpt-4o-mini', opts);
    } else if (provider === 'gemini') {
        return callGemini(apiKey, prompt, model || 'gemini-2.5-flash', opts);
    } else {
        return callAnthropic(apiKey, prompt, model || 'claude-3-haiku-20240307', opts);
    }
}

async function callOllama(prompt, model, opts = {}) {
    const url = opts.ollamaUrl || process.env.OLLAMA_URL || 'http://localhost:11434/api/generate';

    const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            model,
            prompt,
            stream: false,
            options: {
                num_predict: opts.maxTokens || 500
            }
        })
    });

    if (!res.ok) {
        const txt = await res.text();
        throw new Error(`Ollama error ${res.status}: ${txt}`);
    }

    const json = await res.json();
    return json.response || '';
}

async function callOpenAI(apiKey, prompt, model, opts = {}) {
    const url = process.env.OPENAI_URL || 'https://api.openai.com/v1/chat/completions';

    const res = await fetch(url, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            model,
            max_tokens: opts.maxTokens || 500,
            messages: [{ role: 'user', content: prompt }]
        })
    });

    if (!res.ok) {
        const txt = await res.text();
        throw new Error(`OpenAI error ${res.status}: ${txt}`);
    }

    const json = await res.json();
    return json.choices?.[0]?.message?.content || '';
}

async function callAnthropic(apiKey, prompt, model, opts = {}) {
    const url = process.env.ANTHROPIC_URL || 'https://api.anthropic.com/v1/messages';

    const res = await fetch(url, {
        method: 'POST',
        headers: {
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            model,
            max_tokens: opts.maxTokens || 500,
            messages: [{ role: 'user', content: prompt }]
        })
    });

    if (!res.ok) {
        const txt = await res.text();
        throw new Error(`Anthropic error ${res.status}: ${txt}`);
    }

    const json = await res.json();
    return json.content?.[0]?.text || '';
}

async function callGemini(apiKey, prompt, model, opts = {}) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    const res = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
                maxOutputTokens: opts.maxTokens || 4000
            }
        })
    });

    if (!res.ok) {
        const txt = await res.text();
        throw new Error(`Gemini error ${res.status}: ${txt}`);
    }

    const json = await res.json();
    return json.candidates?.[0]?.content?.parts?.[0]?.text || '';
}

main();
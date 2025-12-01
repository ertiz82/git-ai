# git-ai

AI-powered Git commit grouping and message generation.

git-ai analyzes your code changes, intelligently groups related modifications, and generates meaningful commit messages automatically.

## Features

- **Smart Grouping**: AI analyzes diffs and groups related changes together
- **Auto Commit Messages**: Generates descriptive commit messages based on changes
- **JIRA Integration**: Extracts ticket info from branch names (e.g., `feature/SCRUM-123-description`)
- **Multi-Provider Support**: Works with Ollama (local), Anthropic, or OpenAI
- **Token Efficient**: Sends minimal diffs to reduce API costs
- **Dry Run Mode**: Preview commits before executing

## Installation

### Homebrew (macOS)

```bash
brew tap ertiz82/gitai
brew install git-ai
```

### Manual Installation

```bash
git clone https://github.com/ertiz82/git-ai.git
cd git-ai/node-backend
npm install
npm link
```

## Quick Start

```bash
# 1. Configure AI provider (choose one)

# Option A: Ollama (Free, Local)
export AI_PROVIDER=ollama
ollama pull llama3.2

# Option B: Anthropic
export AI_PROVIDER=anthropic
export CLOUD_AI_API_KEY=sk-ant-xxxxx

# Option C: OpenAI
export AI_PROVIDER=openai
export CLOUD_AI_API_KEY=sk-xxxxx

# 2. Use git-ai
cd your-project
# make some changes...
git-ai commit --dry-run  # preview
git-ai commit            # execute
```

## Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `AI_PROVIDER` | AI provider: `ollama`, `anthropic`, `openai` | `anthropic` |
| `CLOUD_AI_API_KEY` | API key (not needed for Ollama) | - |
| `CLOUD_AI_MODEL` | Model name | Provider default |
| `OLLAMA_URL` | Ollama API URL | `http://localhost:11434/api/generate` |

### Project Configuration

Create `jira.json` in your project root for JIRA integration:

```json
{
  "project": {
    "key": "SCRUM",
    "name": "My Project",
    "url": "https://your-domain.atlassian.net/browse/SCRUM"
  },
  "jira": {
    "baseUrl": "https://your-domain.atlassian.net"
  },
  "commitPrefix": "SCRUM"
}
```

For sensitive data, create `jira.local.json` (add to `.gitignore`):

```json
{
  "cloud": {
    "apiKey": "sk-ant-xxxxx"
  }
}
```

## Usage

### Basic Commands

```bash
git-ai commit           # Analyze, group, and commit changes
git-ai commit --dry-run # Preview without committing
git-ai help             # Show help
git-ai version          # Show version
```

### Workflow Example

```bash
# 1. Make changes to multiple files
vim src/auth/login.js
vim src/auth/logout.js
vim src/utils/helpers.js
vim README.md

# 2. Preview what git-ai will do
git-ai commit --dry-run

# Output:
# Found 4 changed file(s)
# Analyzing changes...
# Grouped into 2 commit(s)
#
# --- DRY RUN ---
# Files: src/auth/login.js, src/auth/logout.js
# Message:
# Authentication improvements
#
# Updated login and logout functionality
# ---------------
#
# --- DRY RUN ---
# Files: src/utils/helpers.js, README.md
# Message:
# Documentation and utilities update
#
# Updated helper functions and documentation
# ---------------

# 3. Execute commits
git-ai commit
```

### Branch Naming for JIRA

git-ai automatically detects JIRA tickets from branch names:

```bash
# Supported patterns:
feature/SCRUM-123-add-login
hotfix/SCRUM-456-fix-crash
bugfix/SCRUM-789-resolve-issue
task/SCRUM-012-update-deps

# Commit message will include:
# SCRUM-123: Add login functionality
#
# Description of changes
#
# https://your-domain.atlassian.net/browse/SCRUM-123
```

## AI Providers

### Ollama (Recommended for Local Use)

Free, private, runs locally.

```bash
# Install Ollama
brew install ollama

# Start server
ollama serve

# Pull a model
ollama pull llama3.2          # General purpose
ollama pull qwen2.5-coder:7b  # Code-optimized
ollama pull codellama:7b      # Code-optimized

# Configure
export AI_PROVIDER=ollama
export CLOUD_AI_MODEL=llama3.2
```

### Anthropic (Claude)

Best quality, requires API key.

```bash
export AI_PROVIDER=anthropic
export CLOUD_AI_API_KEY=sk-ant-xxxxx
export CLOUD_AI_MODEL=claude-3-haiku-20240307  # Fast & cheap
# or claude-3-5-sonnet-20241022 for better quality
```

Get API key: [console.anthropic.com](https://console.anthropic.com/settings/keys)

### OpenAI (GPT)

```bash
export AI_PROVIDER=openai
export CLOUD_AI_API_KEY=sk-xxxxx
export CLOUD_AI_MODEL=gpt-3.5-turbo  # Fast & cheap
# or gpt-4o for better quality
```

Get API key: [platform.openai.com](https://platform.openai.com/api-keys)

## Shell Configuration

Add to your `~/.zshrc` or `~/.bashrc`:

```bash
# git-ai configuration
export AI_PROVIDER=ollama
export CLOUD_AI_MODEL=llama3.2

# Alias for quick access
alias gac='git-ai commit'
alias gacd='git-ai commit --dry-run'
```

## How It Works

```
┌─────────────────────────────────────────────────────────┐
│                    git-ai commit                         │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│  1. Collect Changes                                      │
│     - git status --porcelain                            │
│     - git diff (minimal, max 100 lines/file)            │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│  2. AI Analysis (Single API Call)                        │
│     - Send file list + diffs to AI                      │
│     - AI groups related changes                          │
│     - Returns JSON: [{title, summary, files}]           │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│  3. Generate Commits (Local, No API)                     │
│     - For each group:                                    │
│       - git add <files>                                  │
│       - Build commit message from template              │
│       - git commit -m "<message>"                        │
└─────────────────────────────────────────────────────────┘
```

## Project Structure

```
git-ai/
├── node-backend/
│   ├── bin/
│   │   ├── cli.js              # Main CLI entry point
│   │   └── lib/
│   │       ├── git-utils.js    # Git operations
│   │       ├── prompt-templates.js
│   │       ├── commit-template.js
│   │       └── prompts/
│   │           ├── prompt-group.stub
│   │           ├── prompt-commit.stub
│   │           └── prompt-issue.stub
│   ├── package.json
│   ├── jira.example.json
│   └── jira.local.example.json
├── brew/
│   └── formula/
│       └── git-ai.rb
├── zsh-plugin/
│   ├── git-ai.plugin.zsh
│   └── bin/git-ai
├── LICENSE
└── README.md
```

## Troubleshooting

### "No changes to commit"

Make sure you have uncommitted changes:
```bash
git status
```

### "AI returned invalid JSON"

The AI model may not be following instructions. Try:
- A different model (`llama3.2` works well)
- Increase `max_tokens` if response is cut off

### "Ollama error: connection refused"

Start Ollama server:
```bash
ollama serve
```

### "API error 401"

Check your API key:
```bash
echo $CLOUD_AI_API_KEY
```

### Files not being committed

AI might return wrong file paths. The tool validates and filters invalid paths automatically. Check the warning messages.

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git-ai commit`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

MIT License - see [LICENSE](LICENSE) file.

## Links

- [GitHub Repository](https://github.com/ertiz82/git-ai)
- [Homebrew Tap](https://github.com/ertiz82/homebrew-gitai)
- [Report Issues](https://github.com/ertiz82/git-ai/issues)
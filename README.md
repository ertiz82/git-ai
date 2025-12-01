# git-ai

AI-powered Git commit grouping and message generation.

git-ai analyzes your code changes, intelligently groups related modifications, and generates meaningful commit messages automatically.

## Features

- **Interactive Setup**: `git-ai init` configures everything with guided prompts
- **Smart Grouping**: AI analyzes diffs and groups related changes together
- **Auto Commit Messages**: Generates descriptive commit messages based on changes
- **Multi-Provider Support**: Ollama (local), Google Gemini, OpenAI, or Anthropic
- **JIRA Integration**: Extracts ticket info from branch names
- **Missing File Detection**: Automatically catches files AI might miss
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
# Navigate to your project
cd your-project

# Initialize git-ai (interactive setup)
git-ai init

# Make some changes, then commit
git-ai commit --dry-run  # preview
git-ai commit            # execute
```

## Commands

| Command | Description |
|---------|-------------|
| `git-ai init` | Interactive setup wizard |
| `git-ai commit` | Analyze, group, and commit changes |
| `git-ai commit --dry-run` | Preview without committing |
| `git-ai help` | Show help |
| `git-ai version` | Show version |

## AI Providers

### Ollama (Free, Local)

Free, private, runs locally. **Recommended for most users.**

| Model | Description | Size |
|-------|-------------|------|
| `gemma3:4b` | Recommended, fast | 3.3GB |
| `llama3.2` | Meta compact model | 2.0GB |
| `llama3.3` | High performance | 43GB |
| `qwen2.5-coder:7b` | Code optimized | 4.7GB |
| `qwen3` | Latest Qwen generation | 4.7GB |
| `deepseek-r1:8b` | Reasoning model | 4.9GB |
| `codellama:7b` | Code generation | 3.8GB |
| `mistral` | General purpose | 4.1GB |
| `phi4` | Microsoft SOTA | 9.1GB |
| `gemma2:9b` | Google efficient | 5.4GB |

### Google Gemini

Best price-performance for cloud.

| Model | Description | Cost |
|-------|-------------|------|
| `gemini-2.5-flash` | Best price-performance | $0.075/1M tokens |
| `gemini-2.5-flash-lite` | Fastest, cheapest | $0.02/1M tokens |
| `gemini-2.5-pro` | Advanced reasoning | $1.25/1M tokens |
| `gemini-2.0-flash` | Second-gen workhorse | $0.10/1M tokens |
| `gemini-3-pro-preview` | Most intelligent | $2.50/1M tokens |

Get API key: [aistudio.google.com/app/apikey](https://aistudio.google.com/app/apikey)

### OpenAI (GPT)

| Model | Description | Cost |
|-------|-------------|------|
| `gpt-4.1-nano` | Fastest, cheapest | $0.10/1M tokens |
| `gpt-4.1-mini` | Good balance | $0.40/1M tokens |
| `gpt-4.1` | Best for coding | $2.00/1M tokens |
| `gpt-4o-mini` | Fast multimodal | $0.15/1M tokens |
| `gpt-4o` | Omni multimodal | $2.50/1M tokens |
| `o3-mini` | Reasoning model | $1.10/1M tokens |

Get API key: [platform.openai.com/api-keys](https://platform.openai.com/api-keys)

### Anthropic (Claude)

Best quality for complex code analysis.

| Model | Description | Cost |
|-------|-------------|------|
| `claude-haiku-4-5-20251001` | Fastest | $0.25/1M tokens |
| `claude-sonnet-4-5-20250929` | Best balance | $3/1M tokens |
| `claude-opus-4-5-20251101` | Most capable | $15/1M tokens |
| `claude-3-5-haiku-20241022` | Fast legacy | $0.25/1M tokens |
| `claude-3-haiku-20240307` | Budget legacy | $0.25/1M tokens |

Get API key: [console.anthropic.com/settings/keys](https://console.anthropic.com/settings/keys)

## Configuration

### Using `git-ai init` (Recommended)

The easiest way to configure git-ai:

```bash
git-ai init
```

This will:
1. Ask which AI provider to use
2. Show available models with descriptions and pricing
3. For Ollama: Install if needed, pull selected model
4. For cloud providers: Ask for API key
5. Configure maxTokens setting
6. Create `jira.local.json` configuration file
7. Optionally create `jira.json` for JIRA integration
8. Add `jira.local.json` to `.gitignore`

### Manual Configuration

#### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `AI_PROVIDER` | `ollama`, `gemini`, `openai`, `anthropic` | `anthropic` |
| `CLOUD_AI_API_KEY` | API key (not needed for Ollama) | - |
| `CLOUD_AI_MODEL` | Model name | Provider default |
| `OLLAMA_URL` | Ollama API URL | `http://localhost:11434/api/generate` |

#### Project Configuration Files

**`jira.local.json`** - AI provider settings (add to `.gitignore`):

```json
{
  "cloud": {
    "provider": "gemini",
    "model": "gemini-2.5-flash",
    "apiKey": "your-api-key",
    "maxTokens": 4000
  }
}
```

**`jira.json`** - JIRA integration (can be committed):

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

## Usage Examples

### Basic Workflow

```bash
# Make changes to multiple files
vim src/auth/login.js
vim src/auth/logout.js
vim src/utils/helpers.js
vim README.md

# Preview what git-ai will do
git-ai commit --dry-run

# Output:
# Found 4 changed file(s)
# Using AI provider: gemini
# Analyzing changes...
# Grouped into 2 commit(s)
#
# --- DRY RUN ---
# Files: src/auth/login.js, src/auth/logout.js
# Message: Add authentication features
# ---------------
#
# --- DRY RUN ---
# Files: src/utils/helpers.js, README.md
# Message: Update utilities and documentation
# ---------------

# Execute commits
git-ai commit
```

### With JIRA Integration

```bash
# Create branch with JIRA ticket
git checkout -b feature/SCRUM-123-add-login

# Make changes and commit
git-ai commit

# Commit message will include:
# SCRUM-123: Add login functionality
#
# Description of changes
#
# https://your-domain.atlassian.net/browse/SCRUM-123
```

## Shell Configuration

Add to your `~/.zshrc` or `~/.bashrc`:

```bash
# Aliases for quick access
alias gac='git-ai commit'
alias gacd='git-ai commit --dry-run'
alias gai='git-ai init'
```

## How It Works

```
┌─────────────────────────────────────────────────────────┐
│                    git-ai commit                        │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│  1. Collect Changes                                     │
│     - git status --porcelain -uall                      │
│     - git diff (minimal, max 100 lines/file)            │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│  2. AI Analysis (Single API Call)                       │
│     - Send file list + diffs to AI                      │
│     - AI groups related changes                         │
│     - Returns JSON: [{title, summary, files}]           │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│  3. Missing File Detection                              │
│     - Compare AI response with actual file list         │
│     - Auto-add missed files to "remaining" group        │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│  4. Generate Commits (Local, No API)                    │
│     - For each group:                                   │
│       - git add <files>                                 │
│       - Build commit message from template              │
│       - git commit -m "<message>"                       │
└─────────────────────────────────────────────────────────┘
```

## Troubleshooting

### "No changes to commit"

Make sure you have uncommitted changes:
```bash
git status
```

### "AI returned invalid JSON"

The AI model may not be following instructions. Try:
- A different model (`gemini-2.5-flash` or `llama3.2` work well)
- Increase `maxTokens` if response is cut off (default: 4000)

```json
{
  "cloud": {
    "maxTokens": 8000
  }
}
```

### "Ollama error: connection refused"

Start Ollama server:
```bash
ollama serve
```

Or run `git-ai init` to auto-start.

### "API error 401"

Check your API key in `jira.local.json` or environment:
```bash
echo $CLOUD_AI_API_KEY
```

### Files not being committed

git-ai automatically detects and groups files that AI might miss. Check the warning message:
```
⚠ AI missed 5 file(s), adding to miscellaneous group
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
│   │           └── prompt-group.stub
│   ├── package.json
│   ├── jira.example.json
│   └── jira.local.example.json
├── Formula/
│   └── git-ai.rb
├── LICENSE
└── README.md
```

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
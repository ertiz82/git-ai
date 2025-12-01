# git-ai.plugin.zsh
# Put this file under ~/.oh-my-zsh/custom/plugins/git-ai/git-ai.plugin.zsh
# or any plugin dir and add `git-ai` to your plugins=(...) in ~/.zshrc


# PATH to bundled bin inside plugin
_plugin_root="${ZSH_CUSTOM:-$HOME/.oh-my-zsh/custom}/plugins/git-ai"
export PATH="$PLUGIN_ROOT/bin:$PATH"


# Provide git ai subcommand
function git-ai() {
# forward everything to bundled or global binary
if command -v git-ai >/dev/null 2>&1; then
command git-ai "$@"
return $?
fi


# try plugin-local bin
if [[ -x "${_plugin_root}/bin/git-ai" ]]; then
"${_plugin_root}/bin/git-ai" "$@"
return $?
fi


echo "git-ai: binary not found. Install the Node backend or add to PATH." >&2
return 1
}


# optional completion (basic)
_git_ai_complete() {
local -a commands
commands=(commit help version)
_describe -t commands 'git-ai' commands
}
compdef _git_ai_complete git-ai
#!/bin/bash
# MCP Server wrapper script that ensures proper node environment

# Source nvm if available
if [ -f "$HOME/.nvm/nvm.sh" ]; then
    source "$HOME/.nvm/nvm.sh"
fi

# Get the directory of this script
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Run the main.js with the current node
exec node "$DIR/dist/main.js" "$@"
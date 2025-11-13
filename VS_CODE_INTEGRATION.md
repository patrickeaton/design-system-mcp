# VS Code MCP Integration

This document explains how to use the Design System MCP server with VS Code and GitHub Copilot.

## ✅ Setup Complete

The MCP server has been successfully configured and tested! Here's what's working:

### 1. Built Executable
- **Location:** `./dist/main.js` (compiled TypeScript)
- **Wrapper:** `./mcp-server.sh` (handles environment setup)
- **Build command:** `yarn build`

### 2. MCP Configuration
The server is configured in `.vscode/mcp.json`:

```json
{
  "servers": {
    "design-system-mcp": {
      "type": "stdio",
      "command": "${workspaceFolder}/mcp-server.sh",
      "args": ["serve"],
      "cwd": "${workspaceFolder}"
    }
  },
  "inputs": []
}
```

### 3. Available MCP Tools ✅

Your design system MCP server provides these tools to VS Code Copilot:

#### `search_components` 🔍
Search for components by name, description, or tags.
- **Input:** `{ "query": "button", "searchIn": ["name", "description", "tags"] }`
- **Example:** Find all button-related components

#### `list_components` 📋
List all available components, optionally filtered by category.
- **Input:** `{ "category": "actions" }` (optional)
- **Example:** Show all components or filter by category

#### `analyze_component` 🔍
Get detailed analysis of a specific component.
- **Input:** `{ "componentName": "Button", "filePath": "./examples/button/button.tsx" }`
- **Example:** Deep dive into component details

#### `get_design_system_info` ℹ️
Get overall information about the design system.
- **Input:** `{}`
- **Example:** System overview and metadata

## 🚀 How to Use

### 1. Restart VS Code
After setup, restart VS Code to load the MCP server configuration.

### 2. Use MCP Tools in Chat
In GitHub Copilot chat, you can now ask questions and the assistant will use your design system tools:

**Example Queries:**
- "What buttons do I have available?" ➜ Uses `search_components`
- "Search for button components in my design system" ➜ Uses `search_components`
- "List all my components" ➜ Uses `list_components`
- "Analyze the MyAwesomeButton component" ➜ Uses `analyze_component`

### 3. Current Button Components Found ✅

Your design system currently includes:

1. **TestButton**
   - Description: "A versatile button component with multiple variants and sizes"
   - Tags: autodocs, component, interactive
   - Import: `import { TestButton } from '@examples/TestButton';`

2. **MyAwesomeButton**
   - Description: "A super awesome button component with kebab-case filename that demonstrates component name extraction"
   - Tags: autodocs, awesome, button
   - Import: `import { MyAwesomeButton } from '@examples/my-awesome-button';`

## 🔧 Technical Details

### Build Process
```bash
# Build the server
yarn build

# Test the server manually
node test-search.js

# Run in production
./mcp-server.sh serve
```

### File Structure
```
.vscode/
  mcp.json              # MCP server configuration
src/
  commands/serve.ts     # MCP server implementation (no logging)
  main.ts              # CLI entry point with dotenv handling
dist/
  main.js              # Compiled executable with shebang
mcp-server.sh          # Wrapper script for environment setup
```

### Server Features
- ✅ **Silent operation** - No console output to interfere with JSON-RPC
- ✅ **Proper error handling** - Graceful shutdown and error recovery
- ✅ **Component discovery** - Scans Storybook files automatically
- ✅ **Search functionality** - Query components by multiple criteria
- ✅ **Production ready** - Compiled and optimized

## 🐛 Troubleshooting

### Server Not Responding
1. **Check server status:**
   ```bash
   ./mcp-server.sh serve &
   # Should start silently and stay running
   ```

2. **Test JSON-RPC communication:**
   ```bash
   node test-search.js
   # Should show proper responses
   ```

3. **Rebuild if needed:**
   ```bash
   yarn build
   # Recompiles any changes
   ```

### VS Code Integration Issues
1. **Restart VS Code** after any configuration changes
2. **Check MCP extension logs** in VS Code Output panel
3. **Verify file permissions:**
   ```bash
   chmod +x mcp-server.sh
   chmod +x dist/main.js
   ```

### Node.js Path Issues (nvm users)
The `mcp-server.sh` wrapper automatically handles nvm environments:
```bash
# Sources nvm if available
source "$HOME/.nvm/nvm.sh"
# Uses current node version
exec node "$DIR/dist/main.js" "$@"
```

## 🎯 Next Steps

1. **Add more components** to `examples/` directory
2. **Create stories** for new components (`.stories.tsx` files)
3. **Run `yarn build`** to update the MCP server
4. **Ask Copilot** about your components using natural language

## 📝 Example MCP Usage

```
You: "What buttons do I have available?"
Copilot: *Uses search_components tool* 
        "You have 2 button components: TestButton and MyAwesomeButton..."

You: "Show me how to use MyAwesomeButton"
Copilot: *Uses analyze_component tool*
        "MyAwesomeButton accepts these props: variant, size, children..."
```

The MCP server is now fully functional and integrated with VS Code! 🎉
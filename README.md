# Design System MCP Server

A **Model Context Protocol (MCP) server** that automatically discovers, analyzes, and provides intelligent access to your design system components. Integrates seamlessly with VS Code and GitHub Copilot to make your design system searchable and queryable through natural language.

## 🚀 What is This?

This package transforms your Storybook-based design system into an intelligent, searchable knowledge base that AI assistants can understand and interact with. Instead of manually documenting components, the MCP server automatically:

- **🔍 Discovers components** from your Storybook files
- **📊 Analyzes component structure** (props, slots, variants, examples)
- **🏷️ Extracts metadata** (tags, categories, descriptions)
- **🤖 Provides AI-friendly APIs** for component search and analysis
- **⚡ Enables natural language queries** like "What buttons do I have?" or "Show me form components"

## 🏗️ Architecture

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Storybook     │───▶│  Design System   │───▶│   VS Code +     │
│   Files         │    │  MCP Server      │    │   GitHub        │
│   (.stories.tsx)│    │                  │    │   Copilot       │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                              │
                              ▼
                    ┌──────────────────┐
                    │  Component       │
                    │  Knowledge Base  │
                    │  (Parsed & Indexed)
                    └──────────────────┘
```

## ⚡ Quick Start

### 1. Installation

```bash
# Clone or download the package
cd your-design-system
yarn install
```

### 2. Build the Server

```bash
# Compile TypeScript to executable
yarn build
```

### 3. Configure for VS Code

Create `.vscode/mcp.json`:
```json
{
  "servers": {
    "design-system-mcp": {
      "type": "stdio",
      "command": "${workspaceFolder}/mcp-server.sh",
      "args": ["serve"],
      "cwd": "${workspaceFolder}"
    }
  }
}
```

### 4. Start Using

Restart VS Code and ask GitHub Copilot:
- *"What buttons do I have available?"*
- *"Search for form components in my design system"*
- *"Analyze the Button component"*

## 🛠️ How It Works

### Component Discovery Pipeline

```
Storybook Files (.stories.tsx)
         ↓
┌─────────────────────┐
│ File System Scanner │  ← Finds all story files
└─────────────────────┘
         ↓
┌─────────────────────┐
│ Parser Chain        │  ← Extracts component info
│ • Storybook Parser  │
│ • Comment Parser    │  
│ • OpenAI Enhancer   │
└─────────────────────┘
         ↓
┌─────────────────────┐
│ Component Database  │  ← Structured component data
│ • Props & Types     │
│ • Examples & Docs   │
│ • Tags & Categories │
└─────────────────────┘
         ↓
┌─────────────────────┐
│ MCP Server         │  ← JSON-RPC API for AI tools
│ • search_components │
│ • list_components   │
│ • analyze_component │
│ • get_system_info   │
└─────────────────────┘
```

### Supported File Patterns

- **Stories:** `**/*.stories.@(js|jsx|ts|tsx|mdx)`
- **Components:** Co-located with stories or specified paths
- **Frameworks:** React, Vue, Angular, Svelte, Web Components

## 🔧 CLI Commands

### Development Commands

```bash
# Scan for components (dry run)
yarn tsx src/main.ts scan

# List discovered components
yarn tsx src/main.ts list

# Generate MCP JSON output
yarn tsx src/main.ts generate

# Parse with enhanced analysis
yarn tsx src/main.ts parse --parsers storybook,openai,comments
```

### Production Commands

```bash
# Build executable
yarn build

# Start MCP server
./mcp-server.sh serve

# Test server locally
node test-search.js
```

## 🧩 MCP Tools API

The server provides these tools to AI assistants:

### `search_components`

Search components by name, description, or tags.

**Input:**
```json
{
  "query": "button",
  "searchIn": ["name", "description", "tags"]
}
```

**Output:**
```json
[
  {
    "name": "Button",
    "description": "Primary UI component for user interaction",
    "tags": ["interactive", "form", "primary"],
    "importPath": "import { Button } from '@components/Button';",
    "props": [...],
    "examples": [...]
  }
]
```

### `list_components`

List all components, optionally filtered.

**Input:**
```json
{
  "category": "actions"  // optional
}
```

### `analyze_component`

Deep analysis of a specific component.

**Input:**
```json
{
  "componentName": "Button",
  "filePath": "./src/Button.tsx"  // optional
}
```

### `get_design_system_info`

System overview and metadata.

**Input:**
```json
{}
```

## 🎯 Parser Chain System

The package uses a configurable parser chain to extract maximum information:

### 1. Storybook Parser
- **Extracts:** Component names, descriptions, args, stories
- **Analyzes:** Variants, examples, story metadata
- **Infers:** Categories from component names and content

### 2. Comment Parser
- **Finds:** JSDoc comments and `@dsm` blocks
- **Extracts:** Manual annotations and accessibility notes
- **Supports:** JSON and YAML metadata blocks

### 3. OpenAI Enhancer (Optional)
- **Enhances:** Descriptions and categorization
- **Infers:** Missing props and usage patterns
- **Generates:** Examples and best practices

### Configuration Example

```json
{
  "parsers": {
    "enabled": true,
    "mergeStrategy": "merge",
    "parsers": [
      {
        "name": "storybook",
        "enabled": true,
        "weight": 1,
        "config": {
          "extractVariants": true,
          "extractExamples": true
        }
      },
      {
        "name": "openai",
        "enabled": false,
        "weight": 2,
        "config": {
          "model": "gpt-4o-mini",
          "temperature": 0.3
        }
      }
    ]
  }
}
```

## 📁 Project Structure

```
design-system-mcp/
├── src/
│   ├── main.ts                 # CLI entry point
│   ├── commands/
│   │   ├── serve.ts           # MCP server implementation
│   │   ├── scan.ts            # File discovery
│   │   ├── parse.ts           # Component parsing
│   │   └── generate.ts        # Output generation
│   ├── parsers/
│   │   ├── implementations/
│   │   │   ├── storybook-parser.ts
│   │   │   ├── comment-parser.ts
│   │   │   └── openai-parser.ts
│   │   └── parser-chain.ts
│   ├── utils/
│   │   ├── storybook.ts       # Storybook utilities
│   │   └── config.ts          # Configuration management
│   └── models.ts              # TypeScript definitions
├── dist/                      # Compiled output
├── examples/                  # Sample components
├── .vscode/
│   └── mcp.json              # VS Code MCP configuration
├── mcp-server.sh             # Server wrapper script
└── package.json
```

## 🔍 Component Analysis Features

### Automatic Detection
- **Component names** from file names and exports
- **Props and types** from TypeScript interfaces
- **Variants** from Storybook args and controls
- **Categories** from naming patterns and content analysis

### Metadata Extraction
- **Tags** from story metadata and inferred patterns
- **Examples** from story definitions
- **Documentation** from comments and descriptions
- **Dependencies** from imports and relationships

### Smart Categorization
```typescript
// Automatically categorized as "actions"
export const Button = ({ primary, size, label }) => { ... }

// Automatically categorized as "forms" 
export const TextInput = ({ value, onChange, placeholder }) => { ... }

// Automatically categorized as "layout"
export const Card = ({ children, padding, shadow }) => { ... }
```

## 🎨 Usage Examples

### Natural Language Queries

```bash
# Through GitHub Copilot in VS Code:
"What buttons do I have available?"
"Show me all form components"
"How do I use the Card component?"
"Find components with 'primary' variants"
"What components are in the 'navigation' category?"
```

### Programmatic Usage

```typescript
// Direct CLI usage
import { parseStorybookFile } from './src/utils/storybook';

const components = await parseStorybookFile(
  './examples/button/button.stories.tsx',
  'react'
);
```

### MCP Integration

```javascript
// Test MCP server locally
const response = await fetch('http://localhost:3000', {
  method: 'POST',
  body: JSON.stringify({
    jsonrpc: '2.0',
    method: 'tools/call',
    params: {
      name: 'search_components',
      arguments: { query: 'button' }
    }
  })
});
```

## ⚙️ Configuration

### Design System Config (`dsm.config.json`)

```json
{
  "name": "My Design System",
  "rootDirectory": "./src",
  "framework": "react",
  "storybook": {
    "storiesPattern": "**/*.stories.@(js|jsx|ts|tsx)"
  },
  "output": {
    "mode": "single-file",
    "outputPath": "./design-system-mcp.json"
  },
  "baseImportPath": "@components"
}
```

### Environment Variables (`.dsmrc`)

```bash
OPENAI_API_KEY=your_api_key_here
DESIGN_SYSTEM_NAME="My Design System"
```

## 🧪 Testing

```bash
# Test component discovery
yarn tsx src/main.ts scan --verbose

# Test MCP server
node test-search.js

# Test specific parser
yarn tsx src/main.ts parse --parsers storybook
```

## 🤝 Contributing

1. **Add new parsers** in `src/parsers/implementations/`
2. **Extend component models** in `src/models.ts`
3. **Add new MCP tools** in `src/commands/serve.ts`
4. **Improve categorization** in parser implementations

## 📄 License

MIT License - See LICENSE file for details.

---

**Made with ❤️ for design system teams who want their components to be discoverable and AI-friendly.**

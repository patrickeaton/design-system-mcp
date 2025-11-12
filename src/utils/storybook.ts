import { glob } from 'glob';
import { writeFileSync, readFileSync, existsSync } from 'fs';
import { join, dirname, resolve, extname, basename } from 'path';
import type {
  DesignSystemConfig,
  ComponentDefinition,
  MCPOutput,
} from '../models';
import { Framework } from '../models';

/**
 * Find Storybook files based on configuration
 */
export const findStorybookFiles = async (
  config: DesignSystemConfig,
): Promise<string[]> => {
  const { rootDirectory, storybook } = config;
  const { storiesPattern, excludePatterns = [] } = storybook;

  let allFiles: string[] = [];

  // Find all matching story files
  for (const pattern of storiesPattern) {
    const files = await glob(pattern, {
      cwd: rootDirectory,
      absolute: true,
      ignore: excludePatterns,
    });
    allFiles = [...allFiles, ...files];
  }

  // Remove duplicates
  return [...new Set(allFiles)];
};

/**
 * Find the corresponding component file for a story file
 */
const findComponentFile = (storyFilePath: string): string | null => {
  const dir = dirname(storyFilePath);
  const baseName = basename(storyFilePath);

  // Remove .stories from the filename and try different extensions
  const componentBase = baseName.replace(/\.stories\.(js|jsx|ts|tsx|mdx)$/, '');
  const extensions = ['tsx', 'ts', 'jsx', 'js'];

  for (const ext of extensions) {
    const componentPath = join(dir, `${componentBase}.${ext}`);
    if (existsSync(componentPath)) {
      return componentPath;
    }
  }

  // Also try looking for index files in a directory with the component name
  const componentDir = join(dir, componentBase);
  for (const ext of extensions) {
    const indexPath = join(componentDir, `index.${ext}`);
    if (existsSync(indexPath)) {
      return indexPath;
    }
  }

  return null;
};

/**
 * Extract component names from a component file by analyzing exports
 */
const extractComponentNamesFromFile = (componentFilePath: string): string[] => {
  try {
    const content = readFileSync(componentFilePath, 'utf-8');
    const componentNames: string[] = [];

    // Look for named exports that are likely components (start with uppercase)
    const namedExportRegex =
      /export\s+(?:const|function|class)\s+([A-Z][a-zA-Z0-9]*)/g;
    let match;
    while ((match = namedExportRegex.exec(content)) !== null) {
      componentNames.push(match[1]);
    }

    // Look for default export if it's a component
    const defaultExportRegex =
      /export\s+default\s+(?:function\s+)?([A-Z][a-zA-Z0-9]*)/;
    const defaultMatch = content.match(defaultExportRegex);
    if (defaultMatch) {
      componentNames.push(defaultMatch[1]);
    }

    // Look for arrow function components
    const arrowComponentRegex =
      /export\s+const\s+([A-Z][a-zA-Z0-9]*)\s*=\s*[^=]/g;
    while ((match = arrowComponentRegex.exec(content)) !== null) {
      if (!componentNames.includes(match[1])) {
        componentNames.push(match[1]);
      }
    }

    return componentNames;
  } catch (error) {
    console.warn(`Failed to read component file ${componentFilePath}:`, error);
    return [];
  }
};

/**
 * Convert kebab-case filename to PascalCase component name
 */
const kebabToPascalCase = (kebabCase: string): string => {
  return kebabCase
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join('');
};

/**
 * Parse a single Storybook file and extract component information
 */
export const parseStorybookFile = async (
  filePath: string,
  framework: Framework,
  config?: { baseImportPath?: string },
): Promise<ComponentDefinition[]> => {
  const fileName = basename(filePath);
  const componentBase = fileName.replace(/\.stories\.(js|jsx|ts|tsx|mdx)$/, '');

  // Find the corresponding component file
  const componentFile = findComponentFile(filePath);

  // Extract component names from the actual component file
  let componentNames: string[] = [];
  if (componentFile) {
    componentNames = extractComponentNamesFromFile(componentFile);
  }

  // If no component names found, fall back to converted filename
  if (componentNames.length === 0) {
    const fallbackName = kebabToPascalCase(componentBase);
    componentNames = [fallbackName];
  }

  // Try to dynamically import the story file to extract metadata
  let storyMetadata: any = {};
  try {
    // For now, we'll read the file content and try to extract some basic info
    // In a full implementation, we'd use a proper AST parser or dynamic import
    const storyContent = readFileSync(filePath, 'utf-8');

    // Extract title from export default
    const titleMatch = storyContent.match(/title:\s*['"`]([^'"`]+)['"`]/);
    const title = titleMatch ? titleMatch[1] : componentBase;

    // Extract tags
    const tagsMatch = storyContent.match(/tags:\s*\[([^\]]+)\]/);
    const tags = tagsMatch
      ? tagsMatch[1]
          .split(',')
          .map((t: string) => t.trim().replace(/['"`]/g, ''))
      : ['component'];

    // Extract parameters.docs.description.component (more comprehensive)
    const docsDescMatch = storyContent.match(
      /description:\s*\{\s*component:\s*['"`]([^'"`]+)['"`]/,
    );
    const simpleDescMatch = storyContent.match(
      /docs:\s*\{[^}]*description:\s*['"`]([^'"`]+)['"`]/,
    );
    const description = docsDescMatch
      ? docsDescMatch[1]
      : simpleDescMatch
        ? simpleDescMatch[1]
        : `Component from ${title}`;

    storyMetadata = {
      title,
      tags,
      description,
    };
  } catch (error) {
    console.warn(`Failed to parse story file ${filePath}:`, error);
  }

  // Remove duplicates from component names
  const uniqueComponentNames = [...new Set(componentNames)];

  // Create component definitions
  return uniqueComponentNames.map((componentName) => {
    // Create import path using baseImportPath if provided
    let importPath: string;

    if (config?.baseImportPath) {
      // Use baseImportPath with component name
      const componentPath = componentFile
        ? basename(componentFile).replace(/\.(tsx?|jsx?)$/, '')
        : componentName;
      importPath = `import { ${componentName} } from '${config.baseImportPath}/${componentPath}';`;
    } else {
      // Use relative path as before
      const relativePath = componentFile
        ? `./${basename(componentFile).replace(/\.(tsx?|jsx?)$/, '')}`
        : `./components/${componentName}`;
      importPath = `import { ${componentName} } from '${relativePath}';`;
    }

    const component: ComponentDefinition = {
      name: componentName,
      displayName: componentName,
      description:
        storyMetadata.description || `Component parsed from ${filePath}`,
      framework,
      tags: storyMetadata.tags || ['component'],
      importPath,
      props: [],
      slots: [],
      variants: [],
      examples: [],
      storyFile: filePath,
      componentFile: componentFile || undefined,
    };

    return component;
  });
};

/**
 * Generate MCP output from components and configuration
 */
export const generateMCPOutput = (
  components: ComponentDefinition[],
  config: DesignSystemConfig,
): MCPOutput => {
  const output: MCPOutput = {
    metadata: {
      name: config.name,
      version: config.version || '1.0.0',
      description: config.description || '',
      framework: config.storybook.framework,
      generatedAt: new Date().toISOString(),
      sourceDirectory: config.rootDirectory,
    },
    designSystem: {
      theme: config.theme,
    },
    components: components.map((component) => ({
      id: component.name.toLowerCase().replace(/\s+/g, '-'),
      name: component.name,
      description: component.description,
      category: component.category || 'general',
      tags: component.tags,
      importStatement: component.importPath,
      basicUsage: component.examples[0]?.code || `<${component.name} />`,
      propsSchema: component.props,
      slots: component.slots,
      codeExamples: {
        basic: component.examples[0]?.code || `<${component.name} />`,
        advanced: component.examples[1]?.code,
        withSlots:
          component.slots.length > 0
            ? component.examples.find((ex) =>
                ex.title.toLowerCase().includes('slot'),
              )?.code
            : undefined,
      },
      relatedComponents: component.relatedComponents || [],
      dependencies: component.dependencies || [],
      accessibilityGuidelines: component.a11yNotes,
    })),
    componentIndex: {
      byTag: {},
      byCategory: {},
      alphabetical: components.map((c) => c.name).sort(),
    },
  };

  // Build component index
  components.forEach((component) => {
    // By tag
    component.tags.forEach((tag) => {
      if (!output.componentIndex.byTag[tag]) {
        output.componentIndex.byTag[tag] = [];
      }
      output.componentIndex.byTag[tag].push(component.name);
    });

    // By category
    const category = component.category || 'general';
    if (!output.componentIndex.byCategory[category]) {
      output.componentIndex.byCategory[category] = [];
    }
    output.componentIndex.byCategory[category].push(component.name);
  });

  return output;
};

/**
 * Generate inline context file for a single story file
 */
export const generateInlineContextFile = (
  storyFilePath: string,
  components: ComponentDefinition[],
  config: DesignSystemConfig,
): string => {
  const storyComponents = components.filter(
    (component) => component.storyFile === storyFilePath,
  );

  const inlineContext = {
    metadata: {
      storyFile: storyFilePath,
      generatedAt: new Date().toISOString(),
      framework: config.storybook.framework,
      designLibrary: config.designLibrary,
    },
    components: storyComponents.map((component) => ({
      id: component.name.toLowerCase().replace(/\s+/g, '-'),
      name: component.name,
      description: component.description,
      category: component.category || 'general',
      tags: component.tags,
      importStatement: component.importPath,
      basicUsage: component.examples[0]?.code || `<${component.name} />`,
      propsSchema: component.props,
      slots: component.slots,
      codeExamples: {
        basic: component.examples[0]?.code || `<${component.name} />`,
        advanced: component.examples[1]?.code,
        withSlots:
          component.slots.length > 0
            ? component.examples.find((ex) =>
                ex.title.toLowerCase().includes('slot'),
              )?.code
            : undefined,
      },
      relatedComponents: component.relatedComponents || [],
      dependencies: component.dependencies || [],
      accessibilityGuidelines: component.a11yNotes,
    })),
  };

  return JSON.stringify(inlineContext, null, 2);
};

/**
 * Write inline context files for each story file
 */
export const writeInlineContextFiles = async (
  storyFiles: string[],
  allComponents: ComponentDefinition[],
  config: DesignSystemConfig,
): Promise<number> => {
  let filesWritten = 0;

  for (const storyFile of storyFiles) {
    const components = allComponents.filter(
      (component) => component.storyFile === storyFile,
    );

    if (components.length === 0) continue;

    const contextContent = generateInlineContextFile(
      storyFile,
      components,
      config,
    );

    // Generate inline file path
    const storyDir = storyFile.substring(0, storyFile.lastIndexOf('/'));
    const storyBasename = storyFile
      .substring(storyFile.lastIndexOf('/') + 1)
      .replace(/\.stories\.(js|jsx|ts|tsx|mdx)$/, '');

    const inlineFilePath = join(
      storyDir,
      config.output.inlineFilePrefix
        ? `${config.output.inlineFilePrefix}-${storyBasename}${config.output.inlineFileExtension}`
        : `${storyBasename}${config.output.inlineFileExtension}`,
    );

    writeFileSync(inlineFilePath, contextContent);
    filesWritten++;
  }

  return filesWritten;
};

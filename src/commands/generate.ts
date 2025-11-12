/**
 * Build command - creates a consolidated MCP JSON file for AI agents
 */

import { EasyCLICommand, EasyCLITheme } from "easy-cli-framework";
import { resolve } from "path";
import { writeFileSync } from "fs";
import { findStorybookFiles, parseStorybookFile, generateMCPOutput } from "../utils/storybook";
import type { DesignSystemGlobalFlags, ComponentDefinition } from "../types";
import { loadConfig } from "../utils/config";
import { readFileSync, existsSync } from "fs";
import { dirname, join } from "path";

export const generateCommand = new EasyCLICommand<{}, DesignSystemGlobalFlags>(
  "generate",
  async (flags: DesignSystemGlobalFlags, theme: any) => {
    const logger = (theme as EasyCLITheme).getLogger();
    const config = loadConfig(flags);

    const { output: outputOverride } = flags;

    // Override output path if provided
    if (outputOverride) {
      config.output.outputPath = resolve(outputOverride);
    }

    logger.success(`🏗️  Generating consolidated MCP file from context files...\n`);

    try {
      // Find all Storybook files
      const storyFiles = await findStorybookFiles(config);
      
      if (storyFiles.length === 0) {
        logger.warn("⚠️  No Storybook files found!");
        logger.info("Run 'design-system-mcp scan' to check your configuration.");
        return;
      }

      logger.info(`📁 Looking for existing context files for ${storyFiles.length} story files...`);

      // Read components from existing context files
      const allComponents: ComponentDefinition[] = [];
      let foundContextFiles = 0;
      
      for (const storyFile of storyFiles) {
        // Generate expected context file path
        const storyDir = dirname(storyFile);
        const fileName = storyFile.split("/").pop()?.replace(/\.stories\.(js|jsx|ts|tsx|mdx)$/, '') || 'unknown';
        const contextFileName = config.output.inlineFilePrefix 
          ? `${config.output.inlineFilePrefix}-${fileName}${config.output.inlineFileExtension}`
          : `${fileName}${config.output.inlineFileExtension}`;
        const contextFilePath = join(storyDir, contextFileName);
        
        if (existsSync(contextFilePath)) {
          try {
            const contextContent = JSON.parse(readFileSync(contextFilePath, 'utf-8'));
            if (contextContent.components && Array.isArray(contextContent.components)) {
              // Convert context file format to ComponentDefinition format
              const components = contextContent.components.map((comp: any) => ({
                name: comp.name,
                displayName: comp.name,
                description: comp.description,
                framework: config.storybook.framework,
                tags: comp.tags || [],
                category: comp.category,
                importPath: comp.importStatement,
                props: comp.propsSchema || [],
                slots: comp.slots || [],
                variants: [],
                examples: comp.codeExamples ? [{ title: 'basic', code: comp.codeExamples.basic }] : [],
                storyFile,
                dependencies: comp.dependencies || [],
                relatedComponents: comp.relatedComponents || [],
              }));
              
              allComponents.push(...components);
              foundContextFiles++;
            }
          } catch (error) {
            logger.warn(`⚠️  Failed to read context file: ${contextFilePath}`);
            // Fallback: parse the story file directly
            const components = await parseStorybookFile(storyFile, config.storybook.framework, { baseImportPath: config.baseImportPath });
            allComponents.push(...components);
          }
        } else {
          logger.warn(`⚠️  No context file found for: ${storyFile}`);
          logger.info(`     Expected: ${contextFilePath}`);
          logger.info(`     Run 'design-system-mcp parse' to generate context files first.`);
          
          // Fallback: parse the story file directly
          const components = await parseStorybookFile(storyFile, config.storybook.framework, { baseImportPath: config.baseImportPath });
          allComponents.push(...components);
        }
      }
      
      if (foundContextFiles > 0) {
        logger.info(`✅ Found ${foundContextFiles} existing context files`);
      }

      logger.info(`✨ Found ${allComponents.length} components`);

      // Generate consolidated MCP output
      const mcpOutput = generateMCPOutput(allComponents, config);

      // Write the MCP file
      const outputPath = resolve(config.output.outputPath);
      writeFileSync(outputPath, JSON.stringify(mcpOutput, null, 2), 'utf-8');

      logger.success(`✅ MCP file built successfully!`);
      logger.info(`📄 File: ${outputPath}`);
      logger.info(`🎯 Components: ${allComponents.length}`);
      logger.info(`📊 Categories: ${Object.keys(mcpOutput.componentIndex.byCategory).length}`);
      logger.info(`🏷️  Tags: ${Object.keys(mcpOutput.componentIndex.byTag).length}`);
      
      // Show some stats
      const componentsByCategory = mcpOutput.componentIndex.byCategory;
      if (Object.keys(componentsByCategory).length > 0) {
        logger.info(`\n📋 Component breakdown:`);
        Object.entries(componentsByCategory).forEach(([category, components]) => {
          logger.info(`   ${category}: ${components.length} components`);
        });
      }

    } catch (error) {
      logger.error(`❌ Failed to build MCP file: ${error}`);
      throw error;
    }
  }
);
/**
 * Generate command - processes Storybook files and generates MCP output
 */

import { EasyCLICommand, EasyCLITheme } from "easy-cli-framework";
import { resolve, dirname, join } from "path";
import { writeFileSync, statSync, existsSync } from "fs";
import { loadConfig } from "../utils/config";
import {
  findStorybookFiles,
  parseStorybookFile,
  generateMCPOutput,
  writeInlineContextFiles,
} from "../utils/storybook";
import { OutputMode } from "../models";
import type { DesignSystemGlobalFlags, ComponentDefinition } from "../types";

export const parseCommand = new EasyCLICommand<{ force?: boolean }, DesignSystemGlobalFlags>(
  "parse",
  async (combinedArgs: { force?: boolean } & DesignSystemGlobalFlags, theme: any) => {
    const { force, verbose, output: outputOverride, ...flags } = combinedArgs;
    const logger = (theme as EasyCLITheme).getLogger();
    const config = loadConfig(flags as DesignSystemGlobalFlags);

    // Override output path if provided
    if (outputOverride) {
      config.output.outputPath = resolve(outputOverride);
    }

    logger.success(`🏗️  Generating Design System MCP...\n`);

    try {
      // Find all Storybook files
      const storyFiles = await findStorybookFiles(config);

      if (storyFiles.length === 0) {
        logger.warn("⚠️  No Storybook files found!");
        logger.log("Run 'design-system-mcp scan' to check your configuration.");
        return;
      }

      logger.log(`📁 Processing ${storyFiles.length} Storybook files...`);

      // Parse all Storybook files
      const allComponents: ComponentDefinition[] = [];
      let skippedFiles = 0;
      let processedFiles = 0;

      for (const filePath of storyFiles) {
        const relativePath = filePath.replace(config.rootDirectory + "/", "");
        
        // Check if we should skip this file based on timestamps
        let shouldSkip = false;
        if (!force) {
          // Generate expected context file path
          const storyDir = dirname(filePath);
          const fileName = filePath.split("/").pop()?.replace(/\.stories\.(js|jsx|ts|tsx|mdx)$/, '') || 'unknown';
          const contextFileName = config.output.inlineFilePrefix 
            ? `${config.output.inlineFilePrefix}-${fileName}${config.output.inlineFileExtension}`
            : `${fileName}${config.output.inlineFileExtension}`;
          const contextFilePath = join(storyDir, contextFileName);
          
          if (existsSync(contextFilePath)) {
            try {
              const storyStats = statSync(filePath);
              const contextStats = statSync(contextFilePath);
              
              // Skip if context file is newer than story file
              if (contextStats.mtime > storyStats.mtime) {
                shouldSkip = true;
                skippedFiles++;
                
                if (verbose) {
                  logger.log(`  ⏭️  Skipping: ${relativePath} (already up-to-date)`);
                }
              }
            } catch (error) {
              // If we can't check timestamps, process the file
              shouldSkip = false;
            }
          }
        }
        
        if (!shouldSkip) {
          processedFiles++;
          if (verbose) {
            logger.log(`  • Parsing: ${relativePath}`);
          }

          const components = await parseStorybookFile(
            filePath,
            config.storybook.framework as any,
            { baseImportPath: config.baseImportPath }
          );
          allComponents.push(...components);
        }
      }
      
      if (skippedFiles > 0) {
        logger.info(`⏭️  Skipped ${skippedFiles} up-to-date files (use --force to regenerate all)`);
      }
      logger.info(`✨ Processed ${processedFiles} files, found ${allComponents.length} components`);

      // Add manual components if any
      if (config.manualComponents) {
        allComponents.push(...config.manualComponents);
      }

      // Filter out ignored components
      const filteredComponents = allComponents.filter(
        (component) => !config.ignoreComponents?.includes(component.name)
      );



      if (config.output.mode === OutputMode.INLINE_FILES) {
        // Generate inline context files
        logger.log(`📝 Generating inline context files...`);

        const inlineFilesWritten = await writeInlineContextFiles(
          storyFiles,
          filteredComponents,
          config
        );

        logger.log("");
        logger.success(`✅ Inline context files generated successfully!`);
        logger.log(`📄 Files created: ${inlineFilesWritten}`);
        logger.log(`🎯 Components: ${filteredComponents.length}`);
        logger.log(`📁 Prefix: ${config.output.inlineFilePrefix}`);
        logger.log(`🔧 Extension: ${config.output.inlineFileExtension}`);
      } else {
        // Generate single consolidated MCP file
        logger.log(`📝 Generating consolidated MCP file...`);

        const mcpOutput = generateMCPOutput(filteredComponents, config);
        const outputContent = JSON.stringify(mcpOutput, null, 2);
        writeFileSync(config.output.outputPath, outputContent);

        logger.log("");
        logger.success(`✅ Design System MCP generated successfully!`);
        logger.log(`📄 Output file: ${config.output.outputPath}`);
        logger.log(`🎯 Components: ${filteredComponents.length}`);
        logger.log(
          `🏷️  Tags: ${Object.keys(mcpOutput.componentIndex.byTag).length}`
        );
        logger.log(
          `📋 Categories: ${
            Object.keys(mcpOutput.componentIndex.byCategory).length
          }`
        );

        if (verbose) {
          logger.log("");
          logger.info("Component breakdown:");
          Object.entries(mcpOutput.componentIndex.byCategory).forEach(
            ([category, components]) => {
              logger.log(`  • ${category}: ${components.length} components`);
            }
          );
        }
      }

      if (verbose && config.output.mode === OutputMode.INLINE_FILES) {
        // Show component breakdown for inline mode
        logger.log("");
        logger.info("Component breakdown:");
        const byCategory: Record<string, ComponentDefinition[]> = {};
        filteredComponents.forEach((component) => {
          const category = component.category || "General";
          if (!byCategory[category]) byCategory[category] = [];
          byCategory[category].push(component);
        });

        Object.entries(byCategory).forEach(([category, components]) => {
          logger.log(`  • ${category}: ${components.length} components`);
        });
      }
    } catch (error) {
      logger.error(`❌ Error generating MCP: ${error}`);
    }
  },
  {
    description: "Generate MCP output from Storybook files",
    flags: {
        force: {
            type: "boolean",
            describe: "Force regeneration of all context files, ignoring timestamps",
            default: false,
        }, 
    }
  }
);

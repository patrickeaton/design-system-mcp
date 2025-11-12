/**
 * Parse command - uses configurable parser chain system
 */

import { EasyCLICommand, EasyCLITheme } from 'easy-cli-framework';
import { resolve, dirname, join } from 'path';
import { writeFileSync, statSync, existsSync } from 'fs';
import { loadConfig } from '../utils/config';
import { findStorybookFiles } from '../utils/storybook';
import { ParserChain } from '../parsers/parser-chain';
import { StorybookParser } from '../parsers/implementations/storybook-parser';
import { OpenAIParser } from '../parsers/implementations/openai-parser';
import { CommentParser } from '../parsers/implementations/comment-parser-simple';
import type { DesignSystemGlobalFlags } from '../types';

export const parseCommand = new EasyCLICommand<
  { force?: boolean },
  DesignSystemGlobalFlags
>(
  'parse',
  async (
    combinedArgs: { force?: boolean } & DesignSystemGlobalFlags,
    theme: any,
  ) => {
    const { force, verbose, output: outputOverride, ...flags } = combinedArgs;
    const logger = (theme as EasyCLITheme).getLogger();
    const config = loadConfig(flags as DesignSystemGlobalFlags);

    // Override output path if provided
    if (outputOverride) {
      config.output.outputPath = resolve(outputOverride);
    }

    logger.success(`🔗 Using Parser Chain to Generate Context Files...\n`);

    try {
      // Initialize parser chain
      const parserChain = new ParserChain();

      // Register available parsers
      parserChain.registerParser(new StorybookParser());
      parserChain.registerParser(new OpenAIParser());
      parserChain.registerParser(new CommentParser());

      // Check if parser chain is enabled
      if (!config.parsers?.enabled) {
        logger.warn('⚠️  Parser chain is disabled.');
        logger.info('Enable by setting parsers.enabled: true in your config.');
        return;
      }

      // Get available parsers
      const availableParsers = parserChain.getAvailableParsers();
      const enabledParsers = config.parsers.parsers.filter((p) => p.enabled);

      if (verbose) {
        logger.info(
          `📋 Available parsers: ${availableParsers.map((p) => p.name).join(', ')}`,
        );
        logger.info(
          `✅ Enabled parsers: ${enabledParsers.map((p) => p.name).join(', ')}`,
        );
        logger.info(`🔄 Merge strategy: ${config.parsers.mergeStrategy}`);
        logger.log('');
      }

      // Find all Storybook files
      const storyFiles = await findStorybookFiles(config);

      if (storyFiles.length === 0) {
        logger.warn('⚠️  No Storybook files found!');
        logger.log("Run 'design-system-mcp scan' to check your configuration.");
        return;
      }

      logger.log(
        `📁 Processing ${storyFiles.length} Storybook files with parser chain...`,
      );

      let skippedFiles = 0;
      let processedFiles = 0;
      let totalComponents = 0;

      for (const filePath of storyFiles) {
        const relativePath = filePath.replace(config.rootDirectory + '/', '');

        // Generate expected context file path
        const storyDir = dirname(filePath);
        const fileName =
          filePath
            .split('/')
            .pop()
            ?.replace(/\.stories\.(js|jsx|ts|tsx|mdx)$/, '') || 'unknown';
        const contextFileName = config.output.inlineFilePrefix
          ? `${config.output.inlineFilePrefix}-${fileName}${config.output.inlineFileExtension}`
          : `${fileName}${config.output.inlineFileExtension}`;
        const contextFilePath = join(storyDir, contextFileName);

        // Check if we should skip this file based on timestamps
        let shouldSkip = false;
        if (!force && existsSync(contextFilePath)) {
          try {
            const storyStats = statSync(filePath);
            const contextStats = statSync(contextFilePath);

            // Skip if context file is newer than story file
            if (contextStats.mtime > storyStats.mtime) {
              shouldSkip = true;
              skippedFiles++;

              if (verbose) {
                logger.log(
                  `  ⏭️  Skipping: ${relativePath} (already up-to-date)`,
                );
              }
            }
          } catch (error) {
            // If we can't check timestamps, process the file
            shouldSkip = false;
          }
        }

        if (!shouldSkip) {
          processedFiles++;

          try {
            // Execute parser chain
            const parseContext = {
              storyFilePath: filePath,
              componentFilePath: undefined, // Let parsers infer if needed
              framework: config.storybook.framework,
              designLibrary: config.designLibrary,
              baseImportPath: config.baseImportPath,
              config: {}, // Will be filled by individual parsers
            };

            const results = await parserChain.execute(
              parseContext,
              {
                parsers: config.parsers.parsers,
                mergeStrategy: config.parsers.mergeStrategy,
                continueOnError: config.parsers.continueOnError,
              },
              logger,
              theme,
            );

            if (results.length === 0) {
              logger.warn(`  ⚠️  No parser results for: ${relativePath}`);
              continue;
            }

            // Merge results
            const mergedComponents = parserChain.mergeResults(
              results,
              config.parsers.mergeStrategy,
            );
            totalComponents += mergedComponents.length;

            // Show summary of what was found
            if (mergedComponents.length > 0) {
              logger.log(`    └─ 🎯 Found ${mergedComponents.length} component${mergedComponents.length === 1 ? '' : 's'}: ${mergedComponents.map(c => c.name).join(', ')}`);
            } else {
              logger.log(`    └─ ⚠️  No components found`);
            }

            // Generate context file content
            const contextContent = {
              metadata: {
                storyFile: filePath,
                generatedAt: new Date().toISOString(),
                framework: config.storybook.framework,
                designLibrary: config.designLibrary,
                generatedBy: 'parser-chain',
                parsers: results.map((r) => r.parser),
                mergeStrategy: config.parsers.mergeStrategy,
              },
              components: mergedComponents.map((comp, index) => ({
                id: comp.name.toLowerCase().replace(/\s+/g, '-'),
                name: comp.name,
                description: comp.description,
                category: comp.category || 'general',
                tags: comp.tags || [],
                importStatement: comp.importPath || '',
                basicUsage: comp.examples?.[0]?.code || `<${comp.name} />`,
                propsSchema: comp.props || [],
                slots: comp.slots || [],
                codeExamples: {
                  basic: comp.examples?.[0]?.code || `<${comp.name} />`,
                  advanced: comp.examples?.[1]?.code,
                  withSlots:
                    comp.slots && comp.slots.length > 0
                      ? comp.examples?.find((ex) =>
                          ex.title.toLowerCase().includes('slot'),
                        )?.code
                      : undefined,
                },
                relatedComponents: comp.relatedComponents || [],
                dependencies: comp.dependencies || [],
                accessibility: comp.accessibility
                  ?.map((a) => `${a.type}: ${a.value}`)
                  .join(', '),
                // Include parser-specific data
                parserData: comp.customData,
              })),
              parserResults: results.map((r) => ({
                parser: r.parser,
                timestamp: r.timestamp,
                metadata: r.metadata,
                diagnostics: r.diagnostics,
              })),
            };

            // Write context file
            writeFileSync(
              contextFilePath,
              JSON.stringify(contextContent, null, 2),
            );

            if (verbose) {
              logger.log(
                `    ✅ Generated context with ${mergedComponents.length} component(s)`,
              );
              logger.log(
                `    📝 Used parsers: ${results.map((r) => r.parser).join(', ')}`,
              );
            }
          } catch (error) {
            logger.error(`  ❌ Failed to process ${relativePath}: ${error}`);
            if (!config.parsers.continueOnError) {
              throw error;
            }
          }
        }
      }

      // Summary
      logger.log('');
      if (skippedFiles > 0) {
        logger.info(
          `⏭️  Skipped ${skippedFiles} up-to-date files (use --force to regenerate all)`,
        );
      }
      logger.success(
        `✨ Parser chain processed ${processedFiles} files, generated context for ${totalComponents} components`,
      );

      if (verbose) {
        logger.log('');
        logger.info('Parser chain configuration:');
        logger.log(
          `• Enabled parsers: ${enabledParsers.map((p) => p.name).join(', ')}`,
        );
        logger.log(`• Merge strategy: ${config.parsers.mergeStrategy}`);
        logger.log(`• Continue on error: ${config.parsers.continueOnError}`);
      }
    } catch (error) {
      logger.error(`❌ Parser chain execution failed: ${error}`);
      throw error;
    }
  },
  {
    description:
      'Generate context files using configurable parser chain (storybook, openai, comments)',
    flags: {
      force: {
        type: 'boolean',
        describe: 'Force regeneration even if context files are up-to-date',
        default: false,
      },
    },
  },
);

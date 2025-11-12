/**
 * Parse command - uses AI agent to parse a single Storybook file intelligently
 */

import { EasyCLICommand, EasyCLITheme } from "easy-cli-framework";
import { resolve, dirname, join } from "path";
import { writeFileSync, statSync, existsSync } from "fs";
import { loadConfig } from "../utils/config";
import { StorybookParserAgent } from "../agents";
import { parseStorybookFile } from "../utils/storybook";
import type { DesignSystemGlobalFlags } from "../types";

export const parseAICommand = new EasyCLICommand<
  { storyFile: string; componentFile?: string; force?: boolean },
  DesignSystemGlobalFlags
>(
  "parse:ai",
  async (combinedArgs: { storyFile: string; componentFile?: string; force?: boolean } & DesignSystemGlobalFlags, theme: any) => {
    const { storyFile, componentFile, force, verbose, ...flags } = combinedArgs;
    const logger = (theme as EasyCLITheme).getLogger();
     const config = loadConfig(flags as DesignSystemGlobalFlags);


    const resolvedStoryFile = resolve(storyFile);
    const relativePath = resolvedStoryFile.replace(config.rootDirectory + "/", "");

    logger.success(`🤖 Using AI agent to parse Storybook file...\n`);

    if (verbose) {
      logger.log(`Story file: ${storyFile}`);
      if (componentFile) logger.log(`Component file: ${componentFile}`);
      logger.log(`Framework: ${config.storybook.framework}`);
      logger.log(`Design Library: ${config.designLibrary || "none"}`);
      logger.log("");
    }

    try {
      // Generate expected context file path
      const storyDir = dirname(resolvedStoryFile);
      const fileName = resolvedStoryFile.split("/").pop()?.replace(/\.stories\.(js|jsx|ts|tsx|mdx)$/, '') || 'unknown';
      const contextFileName = config.output.inlineFilePrefix 
        ? `${config.output.inlineFilePrefix}-${fileName}${config.output.inlineFileExtension}`
        : `${fileName}${config.output.inlineFileExtension}`;
      const contextFilePath = join(storyDir, contextFileName);

      // Check if we should skip this file based on timestamps
      let shouldSkip = false;
      if (!force && existsSync(contextFilePath)) {
        try {
          const storyStats = statSync(resolvedStoryFile);
          const contextStats = statSync(contextFilePath);
          
          // Skip if context file is newer than story file
          if (contextStats.mtime > storyStats.mtime) {
            shouldSkip = true;
            
            if (verbose) {
              logger.log(`⏭️  Skipping: ${relativePath} (already up-to-date)`);
            } else {
              logger.log(`⏭️  Context file is up-to-date: ${contextFileName}`);
            }
            logger.info("Use --force to regenerate anyway");
            return;
          }
        } catch (error) {
          // If we can't check timestamps, process the file
          shouldSkip = false;
        }
      }

      // Get context from parseStorybookFile for enhanced analysis
      logger.log(`🔍 Extracting component context...`);
      const components = await parseStorybookFile(
        resolvedStoryFile,
        config.storybook.framework as any,
        { baseImportPath: config.baseImportPath }
      );

      // Create the agent
      const agent = new StorybookParserAgent();

      logger.log(`🤖 Running AI analysis...`);

      // Resolve component file if not provided
      const resolvedComponentFile = componentFile ? resolve(componentFile) : undefined;

      // Parse the component using the agent with enhanced context
      const result = await agent.parseStorybookFile(
        resolvedStoryFile,
        resolvedComponentFile || "",
        config.storybook.framework,
        config.designLibrary,
        components // Pass the parsed component context
      );

      // Generate the inline context file format
      const inlineContext = {
        metadata: {
          storyFile: resolvedStoryFile,
          generatedAt: new Date().toISOString(),
          framework: config.storybook.framework,
          designLibrary: config.designLibrary,
          generatedBy: "ai-agent"
        },
        components: components.map((component) => ({
          id: component.name.toLowerCase().replace(/\s+/g, "-"),
          name: component.name,
          description: component.description,
          category: component.category || "general",
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
                    ex.title.toLowerCase().includes("slot")
                  )?.code
                : undefined,
          },
          relatedComponents: component.relatedComponents || [],
          dependencies: component.dependencies || [],
          accessibilityGuidelines: component.a11yNotes,
          aiAnalysis: result // Include the AI analysis result
        })),
      };

      // Write the context file
      writeFileSync(contextFilePath, JSON.stringify(inlineContext, null, 2));

      logger.log("");
      logger.success(`✅ AI Analysis Complete!`);
      logger.log(`📝 Context file written: ${contextFileName}`);
      logger.log("");
      
      if (verbose) {
        logger.info("Context file contents:");
        logger.log(JSON.stringify(inlineContext, null, 2));
      } else {
        logger.info(`Generated context for ${components.length} component(s)`);
      }

      // Optionally get insights
      if (verbose && componentFile) {
        logger.log("");
        logger.info("🧠 Getting additional insights...");

        const insights = await agent.getParsingInsights(
          resolvedStoryFile,
          resolve(componentFile)
        );

        logger.log("");
        logger.info("Insights and Recommendations:");
        logger.log(insights);
      }
    } catch (error) {
      logger.error(`❌ Error during AI parsing: ${error}`);
    }
  },
  {
    description:
      "Use AI agent to intelligently parse a Storybook file and generate enhanced context",
    args: {
      storyFile: {
        type: "string",
        describe: "Path to the Storybook file",
        prompt: "missing",
      },
      componentFile: {
        type: "string",
        describe: "Path to the component file referenced by the story (optional)",
        prompt: "optional",
      },
    },
    flags: {
      force: {
        type: "boolean",
        describe: "Force regeneration even if context file is up-to-date",
        prompt: "optional",
      },
    },
  }
);

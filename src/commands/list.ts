/**
 * List command - shows all components that would be included
 */

import { EasyCLICommand, EasyCLITheme } from "easy-cli-framework";
import { loadConfig } from "../utils/config";
import { findStorybookFiles, parseStorybookFile } from "../utils/storybook";
import type { DesignSystemGlobalFlags, ComponentDefinition } from "../types";

export const listCommand = new EasyCLICommand<{}, DesignSystemGlobalFlags>(
  "list",
  async (flags: DesignSystemGlobalFlags, theme: any) => {
    const logger = (theme as EasyCLITheme).getLogger();
    const config = loadConfig(flags);

    logger.success(`📋 Components in ${config.name}:\n`);

    try {
      const storyFiles = await findStorybookFiles(config);
      const allComponents: ComponentDefinition[] = [];

      for (const filePath of storyFiles) {
        const components = await parseStorybookFile(
          filePath,
          config.storybook.framework as any,
          { baseImportPath: config.baseImportPath }
        );
        allComponents.push(...components);
      }

      if (config.manualComponents) {
        allComponents.push(...config.manualComponents);
      }

      const filteredComponents = allComponents.filter(
        (component) => !config.ignoreComponents?.includes(component.name)
      );

      if (filteredComponents.length === 0) {
        logger.log("No components found!");
        return;
      }

      // Group by category
      const byCategory: Record<string, ComponentDefinition[]> = {};
      filteredComponents.forEach((component) => {
        const category = component.category || "General";
        if (!byCategory[category]) byCategory[category] = [];
        byCategory[category].push(component);
      });

      // Display components by category
      Object.entries(byCategory).forEach(([category, components]) => {
        logger.info(`${category}:`);
        components.forEach((component) => {
          const tags = component.tags.join(", ");
          logger.log(`  • ${component.name}${tags ? ` (${tags})` : ""}`);
          if (component.description) {
            logger.log(`    ${component.description}`);
          }
        });
        logger.log("");
      });
    } catch (error) {
      logger.error(`❌ Error listing components: ${error}`);
    }
  },
  {
    description: "List all components that would be included in the MCP",
  }
);

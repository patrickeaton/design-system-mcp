import { EasyCLICommand, EasyCLITheme } from 'easy-cli-framework';
import { flagsToConfig } from '../utils/config';
import { findStorybookFiles } from '../utils/storybook';
import type { DesignSystemGlobalFlags } from '../types';

/**
 * Scan command - scans for Storybook files and shows what would be processed
 */
export const scanCommand = new EasyCLICommand<{}, DesignSystemGlobalFlags>(
  'scan',
  async (flags, theme) => {
    const logger = (theme as EasyCLITheme).getLogger();
    const config = flagsToConfig(flags);

    logger.success(`🔍 Scanning for Storybook files...\n`);

    if (flags.verbose) {
      logger.log(`Configuration:`);
      logger.log(`  • Name: ${config.name}`);
      logger.log(`  • Root: ${config.rootDirectory}`);
      logger.log(`  • Framework: ${config.storybook.framework}`);
      logger.log(`  • Design Library: ${config.designLibrary || 'none'}`);
      logger.log(`  • Patterns: ${config.storybook.storiesPattern.join(', ')}`);
      logger.log('');
    }

    try {
      const storyFiles = await findStorybookFiles(config);

      if (storyFiles.length === 0) {
        logger.warn('⚠️  No Storybook files found!');
        logger.log('Check your configuration patterns and root directory.');
        return;
      }

      logger.success(`✅ Found ${storyFiles.length} Storybook files:`);
      logger.log('');

      storyFiles.forEach((file, index) => {
        const relativePath = file.replace(config.rootDirectory + '/', '');
        logger.log(`${index + 1}. ${relativePath}`);
      });

      logger.log('');
      logger.info("💡 Run 'design-system-mcp generate' to process these files");
    } catch (error) {
      logger.error(`❌ Error scanning files: ${error}`);
    }
  },
  {
    description: 'Scan for Storybook files in the configured directory',
  },
);

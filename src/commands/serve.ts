/**
 * MCP Server command - starts the Model Context Protocol server
 */
import { EasyCLICommand, EasyCLITheme } from 'easy-cli-framework';
import type { DesignSystemGlobalFlags, ComponentDefinition } from '../types';
import { loadConfig } from '../utils/config';
import { findStorybookFiles, parseStorybookFile } from '../utils/storybook';

interface ServeFlags extends DesignSystemGlobalFlags {
  transport?: 'stdio' | 'http';
  port?: number;
}

export const serveCommand = new EasyCLICommand<{}, ServeFlags>(
  'serve',
  async (flags: ServeFlags, theme: any) => {
    const logger = (theme as EasyCLITheme).getLogger();
    const config = loadConfig(flags);
    
    const { transport = 'stdio', port = 3000 } = flags;

    logger.info(`🚀 Starting MCP server with ${transport} transport...`);

    try {
      // Try to import MCP SDK dynamically
      const { Server } = await import('@modelcontextprotocol/sdk/server/index.js');
      const { StdioServerTransport } = await import('@modelcontextprotocol/sdk/server/stdio.js');  
      const { CallToolRequestSchema, ListToolsRequestSchema } = await import('@modelcontextprotocol/sdk/types.js');

      logger.success('MCP SDK loaded successfully');

      // Create the MCP server
      const server = new Server(
        {
          name: 'design-system-mcp',
          version: '1.0.0',
        },
        {
          capabilities: {
            tools: {},
          },
        }
      );

      // Helper function to load all components
      const loadAllComponents = async (): Promise<ComponentDefinition[]> => {
        try {
          const storyFiles = await findStorybookFiles(config);
          const allComponents: ComponentDefinition[] = [];

          for (const filePath of storyFiles) {
            try {
              const components = await parseStorybookFile(
                filePath,
                config.storybook.framework as any,
                { baseImportPath: config.baseImportPath },
              );
              allComponents.push(...components);
            } catch (error) {
              logger.warn(`Failed to parse ${filePath}: ${error instanceof Error ? error.message : String(error)}`);
            }
          }

          if (config.manualComponents) {
            allComponents.push(...config.manualComponents);
          }

          return allComponents.filter(
            (component) => !config.ignoreComponents?.includes(component.name),
          );
        } catch (error) {
          logger.error(`Failed to load components: ${error instanceof Error ? error.message : String(error)}`);
          return [];
        }
      };

      // Register the list_tools handler
      server.setRequestHandler(ListToolsRequestSchema, async () => {
        return {
          tools: [
            {
              name: 'analyze_component',
              description: 'Analyze a specific component from the design system',
              inputSchema: {
                type: 'object',
                properties: {
                  componentName: {
                    type: 'string',
                    description: 'Name of the component to analyze',
                  },
                  filePath: {
                    type: 'string',
                    description: 'Optional file path to the component',
                  },
                },
                required: ['componentName'],
              },
            },
            {
              name: 'list_components',
              description: 'List all available components in the design system',
              inputSchema: {
                type: 'object',
                properties: {
                  category: {
                    type: 'string',
                    description: 'Optional category to filter components',
                  },
                },
              },
            },
            {
              name: 'search_components',
              description: 'Search for components by name, description, or tags',
              inputSchema: {
                type: 'object',
                properties: {
                  query: {
                    type: 'string',
                    description: 'Search query',
                  },
                  searchIn: {
                    type: 'array',
                    items: {
                      type: 'string',
                      enum: ['name', 'description', 'tags'],
                    },
                    description: 'Fields to search in',
                    default: ['name', 'description', 'tags'],
                  },
                },
                required: ['query'],
              },
            },
            {
              name: 'get_design_system_info',
              description: 'Get general information about the design system',
              inputSchema: {
                type: 'object',
                properties: {},
              },
            },
          ],
        };
      });

      // Register the call_tool handler
      server.setRequestHandler(CallToolRequestSchema, async (request: any) => {
        const { name, arguments: args } = request.params;

        try {
          switch (name) {
            case 'analyze_component': {
              const components = await loadAllComponents();
              const component = components.find(c => 
                c.name.toLowerCase() === args.componentName.toLowerCase()
              );

              if (!component) {
                return {
                  content: [
                    {
                      type: 'text',
                      text: `Component "${args.componentName}" not found. Available components: ${components.map(c => c.name).join(', ')}`,
                    },
                  ],
                };
              }

              return {
                content: [
                  {
                    type: 'text',
                    text: JSON.stringify(component, null, 2),
                  },
                ],
              };
            }

            case 'list_components': {
              const components = await loadAllComponents();
              let filteredComponents = components;

              if (args.category) {
                filteredComponents = components.filter(c => 
                  c.category?.toLowerCase() === args.category.toLowerCase()
                );
              }

              const componentList = filteredComponents.map(c => ({
                name: c.name,
                description: c.description,
                category: c.category,
                tags: c.tags,
              }));

              return {
                content: [
                  {
                    type: 'text',
                    text: JSON.stringify(componentList, null, 2),
                  },
                ],
              };
            }

            case 'search_components': {
              const components = await loadAllComponents();
              const searchFields = args.searchIn || ['name', 'description', 'tags'];
              const query = args.query.toLowerCase();

              const matchingComponents = components.filter(component => {
                return searchFields.some((field: string) => {
                  switch (field) {
                    case 'name':
                      return component.name.toLowerCase().includes(query);
                    case 'description':
                      return component.description?.toLowerCase().includes(query);
                    case 'tags':
                      return component.tags?.some(tag => tag.toLowerCase().includes(query));
                    default:
                      return false;
                  }
                });
              });

              return {
                content: [
                  {
                    type: 'text',
                    text: JSON.stringify(matchingComponents, null, 2),
                  },
                ],
              };
            }

            case 'get_design_system_info': {
              const components = await loadAllComponents();
              const categories = [...new Set(components.map(c => c.category).filter(Boolean))];
              const frameworks = [...new Set(components.map(c => c.framework).filter(Boolean))];

              const info = {
                name: config.name,
                description: config.description,
                totalComponents: components.length,
                categories,
                frameworks,
                rootDirectory: config.rootDirectory,
                framework: config.storybook?.framework,
                designLibrary: config.designLibrary,
              };

              return {
                content: [
                  {
                    type: 'text',
                    text: JSON.stringify(info, null, 2),
                  },
                ],
              };
            }

            default:
              throw new Error(`Unknown tool: ${name}`);
          }
        } catch (error) {
          return {
            content: [
              {
                type: 'text',
                text: `Error executing tool ${name}: ${error instanceof Error ? error.message : String(error)}`,
              },
            ],
            isError: true,
          };
        }
      });

      // Start the server based on transport type
      if (transport === 'stdio') {
        const stdioTransport = new StdioServerTransport();
        logger.info('MCP server starting with stdio transport...');
        logger.info('Server is ready to accept connections via stdin/stdout');
        
        // Handle graceful shutdown
        process.on('SIGINT', async () => {
          logger.info('Shutting down MCP server...');
          await server.close();
          process.exit(0);
        });

        await server.connect(stdioTransport);
      } else if (transport === 'http') {
        logger.error('HTTP transport not yet implemented');
        logger.info('Please use stdio transport for now: --transport stdio');
        process.exit(1);
      }

    } catch (error) {
      logger.error('Failed to start MCP server:');
      logger.error(`Error: ${error instanceof Error ? error.message : String(error)}`);
      logger.info('');
      logger.info('Make sure @modelcontextprotocol/sdk is properly installed:');
      logger.info('  yarn add @modelcontextprotocol/sdk');
      logger.info('');
      logger.info('For now, you can use other commands like:');
      logger.info('  generate - Generate MCP JSON files');
      logger.info('  list     - List all components');
      process.exit(1);
    }
  },
  {
    description: 'Start the Model Context Protocol server for design system analysis',
    flags: {
      transport: {
        type: 'string',
        describe: 'Transport method for MCP server',
        choices: ['stdio', 'http'],
        default: 'stdio',
      },
      port: {
        type: 'number',
        describe: 'Port to run the server on (for HTTP transport)',
        default: 3000,
      },
    },
  }
);
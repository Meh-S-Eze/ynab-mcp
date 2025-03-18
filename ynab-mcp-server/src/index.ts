#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { HttpServerTransport } from '@modelcontextprotocol/sdk/server/transports/http.js';
import dotenv from 'dotenv';
dotenv.config();

import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';
import axios from 'axios';

const API_TOKEN = process.env.YNAB_API_TOKEN;
const BUDGET_ID = process.env.YNAB_BUDGET_ID;

if (!API_TOKEN) {
  console.error('YNAB_API_TOKEN environment variable is required. Please create a .env file in the ynab-mcp-server directory and add YNAB_API_TOKEN=YOUR_TOKEN_HERE');
  process.exit(1);
}

if (!BUDGET_ID) {
  console.error('YNAB_BUDGET_ID environment variable is recommended. Please add YNAB_BUDGET_ID=YOUR_BUDGET_ID to your .env file to use your default budget.');
}

class YNABServer {
  private server: Server;
  private axiosInstance;

  constructor() {
    console.error('[YNABServer] Constructor called');

    this.server = new Server(
      {
        name: 'ynab-mcp-server-test',
        version: '0.1.0',
      },
      {
        capabilities: {
          resources: {},
          tools: {},
        },
      }
    );

    this.axiosInstance = axios.create({
      baseURL: 'https://api.ynab.com/v1',
      headers: {
        Authorization: `Bearer ${API_TOKEN}`,
      },
    });

    this.setupToolHandlers();

    this.server.onerror = (error) => console.error('[MCP Error]', error);
    process.on('SIGINT', async () => {
      await this.server.close();
      process.exit(0);
    });
  }

  private setupToolHandlers() {
    console.error('[YNABServer] Setting up tool handlers');
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      console.error('[YNABServer] ListTools handler called');
      return {
        tools: [
          {
            name: 'get_transactions',
            description: 'Get transactions for a budget and time period',
            inputSchema: {
              type: 'object',
              properties: {
                budget_id: {
                  type: 'string',
                  description: 'Budget ID ("last-used" for last used budget)',
                },
                since_date: {
                  type: 'string',
                  description: 'Filter transactions since this date (ISO format, e.g., 2024-01-01)',
                  format: 'date',
                },
              },
              required: ['budget_id'],
            },
          },
          {
            name: 'get_scheduled_transactions',
            description: 'Get scheduled transactions for a budget',
            inputSchema: {
              type: 'object',
              properties: {
                budget_id: {
                  type: 'string',
                  description: 'Budget ID ("last-used" for last used budget)',
                },
              },
              required: ['budget_id'],
            },
          },
        ],
      };
    });

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      console.error('[YNABServer] CallTool handler called with request:', JSON.stringify(request));
      const toolName = request.params.name;
      const args = request.params.arguments;

      switch (toolName) {
        case 'get_transactions':
          console.error('[YNABServer] Handling get_transactions request');
          return this.handleGetTransactions(args);
        case 'get_scheduled_transactions':
          console.error('[YNABServer] Handling get_scheduled_transactions request');
          return this.handleGetScheduledTransactions(args);
        default:
          console.error(`[YNABServer] Tool '${toolName}' not found`);
          throw new McpError(ErrorCode.MethodNotFound, `Tool '${toolName}' not found`);
      }
    });
    console.error('[YNABServer] Tool handlers setup complete');
  }

  private async handleGetTransactions(args: any) {
    if (!args || typeof args.budget_id !== 'string') {
      throw new McpError(ErrorCode.InvalidParams, 'budget_id is required');
    }
    const budget_id = args.budget_id;
    const since_date = args.since_date;
    let endpoint = `/budgets/${budget_id}/transactions`;
    if (since_date) {
      endpoint += `?since_date=${since_date}`;
    }

    try {
      console.error(`[API Request] GET ${endpoint}`);
      const response = await this.axiosInstance.get(endpoint);
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(response.data, null, 2),
          },
        ],
      };
    } catch (error: any) {
      console.error('[API Error]', error.message, error.response?.data);
      return {
        content: [
          {
            type: 'text',
            text: `Error fetching transactions: ${error.message}`,
          },
        ],
        isError: true,
      };
    }
  }

  private async handleGetScheduledTransactions(args: any) {
    if (!args || typeof args.budget_id !== 'string') {
      throw new McpError(ErrorCode.InvalidParams, 'budget_id is required');
    }
    const budget_id = args.budget_id;
    const endpoint = `/budgets/${budget_id}/scheduled_transactions`;

    try {
      console.error(`[API Request] GET ${endpoint}`);
      const response = await this.axiosInstance.get(endpoint);
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(response.data, null, 2),
          },
        ],
      };
    } catch (error: any) {
      console.error('[API Error]', error.message, error.response?.data);
      return {
        content: [
          {
            type: 'text',
            text: `Error fetching scheduled transactions: ${error.message}`,
          },
        ],
        isError: true,
      };
    }
  }

  async run() {
    console.error('[YNABServer] run() method called');
    const transport = new HttpServerTransport({ port: 3000 });
    await this.server.connect(transport);
    console.error('YNAB MCP server running on http://localhost:3000');
  }
}

const serverInstance = new YNABServer();
serverInstance.run().catch(console.error);

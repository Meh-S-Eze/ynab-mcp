#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio';
import { Tool } from '@modelcontextprotocol/sdk/types';
import dotenv from 'dotenv';
import axios from 'axios';
dotenv.config();

const API_TOKEN = process.env.YNAB_API_TOKEN;
const BUDGET_ID = process.env.YNAB_BUDGET_ID;

if (!API_TOKEN) {
  console.error('YNAB_API_TOKEN environment variable is required. Please create a .env file in the ynab-mcp-server directory and add YNAB_API_TOKEN=YOUR_TOKEN_HERE');
  process.exit(1);
}

if (!BUDGET_ID) {
  console.error('YNAB_BUDGET_ID environment variable is recommended. Please add YNAB_BUDGET_ID=YOUR_BUDGET_ID to your .env file to use your default budget.');
}

const axiosInstance = axios.create({
  baseURL: 'https://api.ynab.com/v1',
  headers: {
    Authorization: `Bearer ${API_TOKEN}`,
  },
});

// Define our tools
const tools: Tool[] = [
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
];

// Create MCP server
const server = new Server({
  name: 'ynab-mcp-server',
  version: '0.1.0',
  tools,
});

// Register tool handlers
server.setToolHandler('get_transactions', async (args: any) => {
  if (!args || typeof args.budget_id !== 'string') {
    throw new Error('budget_id is required');
  }
  const budget_id = args.budget_id;
  const since_date = args.since_date;
  let endpoint = `/budgets/${budget_id}/transactions`;
  if (since_date) {
    endpoint += `?since_date=${since_date}`;
  }

  try {
    console.error(`[API Request] GET ${endpoint}`);
    const response = await axiosInstance.get(endpoint);
    return response.data;
  } catch (error: any) {
    console.error('[API Error]', error.message, error.response?.data);
    throw new Error(`Error fetching transactions: ${error.message}`);
  }
});

server.setToolHandler('get_scheduled_transactions', async (args: any) => {
  if (!args || typeof args.budget_id !== 'string') {
    throw new Error('budget_id is required');
  }
  const budget_id = args.budget_id;
  const endpoint = `/budgets/${budget_id}/scheduled_transactions`;

  try {
    console.error(`[API Request] GET ${endpoint}`);
    const response = await axiosInstance.get(endpoint);
    return response.data;
  } catch (error: any) {
    console.error('[API Error]', error.message, error.response?.data);
    throw new Error(`Error fetching scheduled transactions: ${error.message}`);
  }
});

// Start server
const transport = new StdioServerTransport();
server.connect(transport).catch((error: Error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});

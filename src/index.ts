#!/usr/bin/env node

import { DownloadMCP } from './tools/download.js';
import { config } from 'dotenv';
import { ProcessManager } from './utils/processManager.js';

// Load environment variables
config();

// Create process manager
const processManager = new ProcessManager();

// Main function
async function main() {
  // Check process mutex
  if (!await processManager.checkAndCreateLock()) {
    console.error('Unable to create lock file, program exiting');
    process.exit(1);
  }

  // Instantiate download MCP
  const downloadMCP = new DownloadMCP();

  // Handle process exit
  process.on('SIGINT', async () => {
    console.log('Shutting down download MCP service...');
    await downloadMCP.close();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    console.log('Shutting down download MCP service...');
    await downloadMCP.close();
    process.exit(0);
  });

  // Handle uncaught exceptions to avoid crashes
  process.on('uncaughtException', (err) => {
    console.error('Uncaught exception:', err);
    // Don't exit process, keep download service running
  });

  process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Promise rejection:', reason);
    // Don't exit process, keep download service running
  });

  console.log('Download MCP service started');
}

// Start program
main().catch(error => {
  console.error('Program startup failed:', error);
  process.exit(1);
});
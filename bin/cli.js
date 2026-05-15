#!/usr/bin/env node

import { main } from '../dist/cli.js';

// Handle uncaught errors
process.on('uncaughtException', error => {
  console.error(`Fatal Error: ${error.message}`);
  process.exit(1);
});

process.on('unhandledRejection', error => {
  console.error(`Unhandled Promise Rejection: ${error.message}`);
  process.exit(1);
});

process.exit(await main());

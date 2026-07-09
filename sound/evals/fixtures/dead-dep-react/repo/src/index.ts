#!/usr/bin/env node

/**
 * Apple Code Assistant - Main entry point
 * A TypeScript CLI tool for code generation using Apple's Foundation Models
 */

import { CLIParser } from './cli/parser';
import { CLIHandler } from './cli/handler';
import { AppLogger } from './utils/logger';
import chalk from 'chalk';

async function main(): Promise<void> {
  const logger = AppLogger.create('info', false);
  
  try {
    // Parse CLI arguments
    const parser = new CLIParser();
    const args = parser.parse(process.argv.slice(2));
    
    // Handle CLI execution
    const handler = new CLIHandler();
    await handler.handle(args);
    
  } catch (error) {
    logger.error(`Application error: ${error}`);
    process.exit(1);
  }
}

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error(chalk.red(`\nUncaught Exception: ${error.message}`));
  console.error(chalk.gray(error.stack));
  process.exit(1);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error(chalk.red(`\nUnhandled Rejection at: ${promise}`));
  console.error(chalk.gray(`Reason: ${reason}`));
  process.exit(1);
});

// Handle SIGINT (Ctrl+C)
process.on('SIGINT', () => {
  console.log(chalk.yellow('\n\nOperation cancelled by user'));
  process.exit(0);
});

// Handle SIGTERM
process.on('SIGTERM', () => {
  console.log(chalk.yellow('\n\nApplication terminated'));
  process.exit(0);
});

// Run the application
if (require.main === module) {
  main().catch((error) => {
    console.error(chalk.red(`\nFatal error: ${error}`));
    process.exit(1);
  });
}

export { CLIParser, CLIHandler, AppLogger };

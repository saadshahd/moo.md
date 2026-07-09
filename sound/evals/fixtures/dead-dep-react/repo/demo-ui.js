#!/usr/bin/env node

/**
 * Demo script to showcase the new Apple Code Assistant UI
 */

const { SimpleTerminalUI } = require('./dist/ui/simple-terminal-ui');
const { AppleFoundationClient } = require('./dist/api/foundation-client');

async function main() {
  console.log('🍎 Starting Apple Code Assistant Demo...\n');
  
  try {
    // Initialize Apple Intelligence client
    const client = new AppleFoundationClient();
    
    // Create and start the modern UI
    const ui = new SimpleTerminalUI(client);
    await ui.start();
    
  } catch (error) {
    console.error('❌ Demo failed:', error.message);
    process.exit(1);
  }
}

main();

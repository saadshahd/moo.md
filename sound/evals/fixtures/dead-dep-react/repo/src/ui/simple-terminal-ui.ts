/**
 * Simple Terminal UI for Apple Code Assistant
 * A modern CLI interface inspired by Gemini CLI
 */

import chalk from 'chalk';
import figlet from 'figlet';
// @ts-ignore - gradient-string doesn't have types
import gradient from 'gradient-string';
import { AppleFoundationClient } from '../api/foundation-client';
import { CodeGenerationOptions, CodeResult } from '../types';
import { SyntaxHighlighter } from '../utils/syntax-highlighter';
import { LanguageDetector } from '../utils/language-detector';
import { ConversationManager } from './conversation-manager';
import { StreamingHandler } from './streaming-handler';
import * as readline from 'readline';

export class SimpleTerminalUI {
  private client: AppleFoundationClient;
  private conversationManager: ConversationManager;
  private streamingHandler: StreamingHandler;
  private rl: readline.Interface;
  private isGenerating: boolean = false;

  constructor(client: AppleFoundationClient) {
    this.client = client;
    this.conversationManager = new ConversationManager();
    this.streamingHandler = new StreamingHandler(client);
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
  }

  /**
   * Start the UI
   */
  public async start(): Promise<void> {
    this.showWelcome();
    this.conversationManager.createSession('Apple Code Assistant Session');
    
    // Start the main loop
    await this.mainLoop();
  }

  /**
   * Create sophisticated header similar to Gemini CLI
   */
  private createHeader(): void {
    // Main title with gradient
    const title = figlet.textSync('Apple Code', { 
      font: 'ANSI Shadow',
      horizontalLayout: 'fitted',
      verticalLayout: 'fitted'
    });
    
    // Create gradient effect
    const gradientTitle = gradient.rainbow(title);
    console.log(gradientTitle);
    
    // Subtitle with Apple branding
    const subtitle = 'ASSISTANT';
    const gradientSubtitle = gradient.rainbow(subtitle);
    console.log(chalk.bold(gradientSubtitle));
    console.log();
    
    // Tagline with professional styling
    const tagline = 'Powered by Apple Intelligence';
    const taglineGradient = gradient.rainbow(tagline);
    console.log(chalk.bold(taglineGradient));
    
    // Version and status info
    console.log(chalk.gray('┌─────────────────────────────────────────────────────────────┐'));
    console.log(chalk.gray('│') + chalk.blue.bold('  🍎 On-Device AI  ') + chalk.gray('│') + chalk.green.bold('  ✅ Ready  ') + chalk.gray('│') + chalk.yellow.bold('  v1.0.0  ') + chalk.gray('│'));
    console.log(chalk.gray('└─────────────────────────────────────────────────────────────┘'));
    console.log();
  }

  /**
   * Show welcome message
   */
  private showWelcome(): void {
    console.clear();
    
    // Create a sophisticated header similar to Gemini CLI
    this.createHeader();
    console.log();
    
    console.log(chalk.yellow('✨ Features:'));
    console.log(chalk.white('  • On-device code generation (no API keys!)'));
    console.log(chalk.white('  • Multi-language support (25+ languages)'));
    console.log(chalk.white('  • Real-time streaming responses'));
    console.log(chalk.white('  • Conversation history & context'));
    console.log(chalk.white('  • File operations & clipboard integration'));
    console.log();
    
    console.log(chalk.green('🚀 Quick Start:'));
    console.log(chalk.white('  • Type your code request and press Enter'));
    console.log(chalk.white('  • Use /help for commands'));
    console.log(chalk.white('  • Use /exit to quit'));
    console.log();
    
    console.log(chalk.cyan('💡 Examples:'));
    console.log(chalk.gray('  "Create a React component for a todo list"'));
    console.log(chalk.gray('  "Write a Python function to sort an array"'));
    console.log(chalk.gray('  "Generate a TypeScript interface for a user"'));
    console.log();
    
    console.log(chalk.magenta('Ready to generate code! 🎯'));
    console.log(chalk.gray('─'.repeat(60)));
    console.log();
  }

  /**
   * Main interaction loop
   */
  private async mainLoop(): Promise<void> {
    while (true) {
      try {
        const input = await this.promptUser();
        
        if (!input.trim()) continue;
        
        // Handle commands
        if (input.startsWith('/')) {
          await this.handleCommand(input);
          continue;
        }
        
        // Handle code generation
        await this.handleCodeGeneration(input);
        
      } catch (error) {
        console.log(chalk.red(`❌ Error: ${error}`));
        // Reset generating flag in case of error
        this.isGenerating = false;
        
        // If readline is closed, break the loop
        if (error instanceof Error && error.message.includes('readline was closed')) {
          console.log(chalk.yellow('Interface closed. Exiting...'));
          break;
        }
      }
    }
  }

  /**
   * Prompt user for input
   */
  private promptUser(): Promise<string> {

// [trimmed]

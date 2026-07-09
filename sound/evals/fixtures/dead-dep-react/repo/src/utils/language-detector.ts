/**
 * Language detection and support utilities
 */

import { SupportedLanguage } from '../types';

export class LanguageDetector {
  private static readonly SUPPORTED_LANGUAGES: SupportedLanguage[] = [
    { name: 'typescript', extensions: ['.ts', '.tsx'], highlightAlias: 'typescript' },
    { name: 'javascript', extensions: ['.js', '.jsx', '.mjs'], highlightAlias: 'javascript' },
    { name: 'python', extensions: ['.py', '.pyw'], highlightAlias: 'python' },
    { name: 'java', extensions: ['.java'], highlightAlias: 'java' },
    { name: 'csharp', extensions: ['.cs'], highlightAlias: 'csharp' },
    { name: 'cpp', extensions: ['.cpp', '.cc', '.cxx', '.c++'], highlightAlias: 'cpp' },
    { name: 'c', extensions: ['.c'], highlightAlias: 'c' },
    { name: 'go', extensions: ['.go'], highlightAlias: 'go' },
    { name: 'rust', extensions: ['.rs'], highlightAlias: 'rust' },
    { name: 'swift', extensions: ['.swift'], highlightAlias: 'swift' },
    { name: 'kotlin', extensions: ['.kt', '.kts'], highlightAlias: 'kotlin' },
    { name: 'php', extensions: ['.php'], highlightAlias: 'php' },
    { name: 'ruby', extensions: ['.rb'], highlightAlias: 'ruby' },
    { name: 'html', extensions: ['.html', '.htm'], highlightAlias: 'html' },
    { name: 'css', extensions: ['.css'], highlightAlias: 'css' },
    { name: 'scss', extensions: ['.scss'], highlightAlias: 'scss' },
    { name: 'json', extensions: ['.json'], highlightAlias: 'json' },
    { name: 'yaml', extensions: ['.yml', '.yaml'], highlightAlias: 'yaml' },
    { name: 'xml', extensions: ['.xml'], highlightAlias: 'xml' },
    { name: 'markdown', extensions: ['.md', '.markdown'], highlightAlias: 'markdown' },
    { name: 'bash', extensions: ['.sh', '.bash'], highlightAlias: 'bash' },
    { name: 'powershell', extensions: ['.ps1'], highlightAlias: 'powershell' },
    { name: 'sql', extensions: ['.sql'], highlightAlias: 'sql' },
    { name: 'dockerfile', extensions: ['.dockerfile', 'Dockerfile'], highlightAlias: 'dockerfile' },
  ];

  /**
   * Detect language from file extension
   */
  public static detectFromExtension(filename: string): string | null {
    const extension = this.getFileExtension(filename);
    const language = this.SUPPORTED_LANGUAGES.find(lang => 
      lang.extensions.includes(extension)
    );
    return language?.name || null;
  }

  /**
   * Detect language from file content (basic heuristics)
   */
  public static detectFromContent(content: string): string | null {
    const trimmedContent = content.trim();
    
    // Check for shebang
    if (trimmedContent.startsWith('#!')) {
      if (trimmedContent.includes('python')) return 'python';
      if (trimmedContent.includes('bash')) return 'bash';
      if (trimmedContent.includes('node')) return 'javascript';
    }

    // Check for common patterns
    if (trimmedContent.includes('import React') || trimmedContent.includes('from "react"')) {
      return 'typescript';
    }
    
    if (trimmedContent.includes('function ') && trimmedContent.includes('{')) {
      return 'javascript';
    }
    
    if (trimmedContent.includes('def ') && trimmedContent.includes(':')) {
      return 'python';
    }
    
    if (trimmedContent.includes('public class ') || trimmedContent.includes('import java.')) {
      return 'java';
    }
    
    if (trimmedContent.includes('using System;') || trimmedContent.includes('namespace ')) {
      return 'csharp';
    }
    
    if (trimmedContent.includes('package main') || trimmedContent.includes('import (')) {
      return 'go';
    }
    
    if (trimmedContent.includes('fn main()') || trimmedContent.includes('use std::')) {
      return 'rust';
    }

    return null;
  }

  /**
   * Get language info by name
   */
  public static getLanguageInfo(name: string): SupportedLanguage | null {
    return this.SUPPORTED_LANGUAGES.find(lang => 
      lang.name.toLowerCase() === name.toLowerCase()
    ) || null;
  }

  /**
   * Get all supported languages
   */
  public static getSupportedLanguages(): SupportedLanguage[] {
    return [...this.SUPPORTED_LANGUAGES];
  }

  /**
   * Check if language is supported
   */
  public static isLanguageSupported(name: string): boolean {
    return this.SUPPORTED_LANGUAGES.some(lang => 
      lang.name.toLowerCase() === name.toLowerCase()
    );
  }

  /**
   * Get file extension from filename
   */
  private static getFileExtension(filename: string): string {
    const lastDot = filename.lastIndexOf('.');
    if (lastDot === -1) return '';
    return filename.substring(lastDot);
  }

  /**
   * Suggest language based on context
   */
  public static suggestLanguage(prompt: string, context?: string): string {
    const combinedText = `${prompt} ${context || ''}`.toLowerCase();
    
    // Check for specific language mentions
    const languageMentions = [
      'typescript', 'javascript', 'python', 'java', 'c#', 'csharp', 'c++', 'cpp',
      'go', 'rust', 'swift', 'kotlin', 'php', 'ruby', 'html', 'css', 'scss',
      'json', 'yaml', 'xml', 'markdown', 'bash', 'shell', 'sql'
    ];
    
    for (const lang of languageMentions) {
      if (combinedText.includes(lang)) {
        // Normalize some common variations
        if (lang === 'c#' || lang === 'csharp') return 'csharp';
        if (lang === 'c++' || lang === 'cpp') return 'cpp';
        if (lang === 'shell') return 'bash';
        return lang;
      }
    }
    
    // Check for framework/library mentions that suggest languages
    if (combinedText.includes('react') || combinedText.includes('vue') || combinedText.includes('angular')) {
      return 'typescript';

// [trimmed]

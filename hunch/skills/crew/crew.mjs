#!/usr/bin/env node
// crew — advisory coordination for concurrent agents. Entry point.
// `crew help` for commands; `crew selftest` to prove the tool on this machine.

import { commands } from './src/commands.mjs';

const [, , name, ...rest] = process.argv;
const cmd = commands[name || 'help'] || commands.help;
await cmd.run(rest);

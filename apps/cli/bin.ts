#!/usr/bin/env node
/**
 * KindScript CLI entry point.
 *
 * This file exists solely to call main(). All logic lives in cli.ts.
 */
import { main, EXIT_ERROR } from './cli.js';

main().then(
  exitCode => process.exit(exitCode),
  err => {
    console.error(`Error: ${err.message || err}`);
    process.exit(EXIT_ERROR);
  },
);

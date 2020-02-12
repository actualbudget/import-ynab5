#!/usr/bin/env node
const { findBudgets, importYNAB5 } = require('./importer');

async function run() {
  let filepath = process.argv[2];
  await importYNAB5(filepath);
}

run();

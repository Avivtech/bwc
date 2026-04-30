#!/usr/bin/env node

const fs = require("node:fs");
const path = require("node:path");
const terser = require("terser");

const rootDir = path.resolve(__dirname, "..");
const sourcePath = path.join(rootDir, "wines-list-view.js");
const targetPath = path.join(rootDir, "wines-list-view.min.js");
const isWatchMode = process.argv.includes("--watch");

let queuedBuild = Promise.resolve();
let debounceTimer = null;

async function minifyWinesListView() {
  const sourceCode = await fs.promises.readFile(sourcePath, "utf8");
  const result = await terser.minify(sourceCode, {
    compress: true,
    mangle: true,
  });

  if (!result.code) {
    throw new Error("Terser did not return minified output.");
  }

  await fs.promises.writeFile(targetPath, result.code);
  console.log(`Updated ${path.relative(rootDir, targetPath)}`);
}

function queueBuild() {
  queuedBuild = queuedBuild
    .then(minifyWinesListView)
    .catch((error) => {
      console.error(error);
      if (!isWatchMode) {
        process.exitCode = 1;
      }
    });
}

if (isWatchMode) {
  console.log(`Watching ${path.relative(rootDir, sourcePath)}`);
  queueBuild();

  fs.watch(sourcePath, () => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(queueBuild, 100);
  });
} else {
  queueBuild();
}

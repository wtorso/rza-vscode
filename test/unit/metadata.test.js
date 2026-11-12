"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { hasCodeComment } = require("./helpers");

const root = path.join(__dirname, "..", "..");
const manifest = require(path.join(root, "package.json"));
const lock = require(path.join(root, "package-lock.json"));

test("manifest and lockfile describe the same extension release", () => {
    assert.equal(manifest.version, "0.5.0");
    assert.equal(lock.version, "0.5.0");
    assert.equal(lock.packages[""].version, "0.5.0");
    assert.equal(manifest.engines.vscode, "^1.82.0");
});

test("test and package commands are present", () => {
    assert.equal(manifest.scripts.test, "node --test test/unit/*.test.js");
    assert.equal(manifest.scripts["test:integration"], "node test/integration/runTests.js");
    assert.equal(manifest.scripts["test:package"], "node --test test/package/*.test.js");
    assert.equal(manifest.scripts.package,
        "node -e \"require('fs').mkdirSync('build',{recursive:true})\" && vsce package --out build/rza-0.5.0.vsix");
    for (const dependency of ["vscode-textmate", "mocha", "@vscode/test-electron", "@vscode/vsce"]) {
        assert.ok(manifest.devDependencies[dependency]);
    }
});

test("production and test JavaScript contain no comments", () => {
    const files = [
        "client.js",
        "compiler_path.js",
        "test/unit/helpers.js",
        "test/unit/grammar.test.js",
        "test/unit/client.test.js",
        "test/unit/metadata.test.js",
        "test/unit/client_lifecycle.test.js",
        "test/unit/integration_config.test.js",
        "test/package/vsix.test.js",
        "test/integration/runTests.js",
        "test/integration/index.js",
        "test/integration/suite.js",
    ];
    for (const file of files) {
        const source = fs.readFileSync(path.join(root, file), "utf8");
        assert.equal(hasCodeComment(source), false, file);
    }
});

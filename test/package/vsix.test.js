"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");
const JSZip = require("jszip");

const root = path.join(__dirname, "..", "..");

test("VSIX contains production files and excludes development artifacts", async () => {
    const npm = process.platform === "win32" ? "npm.cmd" : "npm";
    execFileSync(npm, ["run", "package"], { cwd: root, stdio: "pipe" });
    const archive = path.join(root, "build", "rza-0.5.0.vsix");
    const zip = await JSZip.loadAsync(fs.readFileSync(archive));
    const files = Object.keys(zip.files);
    for (const required of [
        "extension/client.js",
        "extension/compiler_path.js",
        "extension/syntaxes/rza.tmLanguage.json",
        "extension/language-configuration.json",
        "extension/package.json",
        "extension/readme.md",
        "extension/README.ru.md",
        "extension/LICENSE.txt",
        "extension/node_modules/vscode-languageclient/package.json",
    ]) {
        assert.ok(files.includes(required), required);
    }
    for (const file of files) {
        assert.ok(!file.startsWith("extension/test/"), file);
        assert.ok(!file.startsWith("extension/docs/"), file);
        assert.ok(!file.startsWith("extension/.git/"), file);
        assert.ok(!file.startsWith("extension/.vscode-test/"), file);
        assert.ok(!/\.(dll|exe|node|wasm)$/i.test(file), file);
        assert.ok(!file.endsWith(".vsix"), file);
        assert.ok(!file.endsWith(".log"), file);
    }
});

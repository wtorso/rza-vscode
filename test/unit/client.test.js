"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { resolveTranspilerPath, validateTranspilerPath } = require("../../compiler_path");

test("configured compiler path wins over the default", () => {
    const configured = path.resolve("tools", "rez3asm.exe");
    assert.equal(resolveTranspilerPath(configured, path.resolve("extension")), configured);
});

test("default compiler path is resolved from the extension root", () => {
    const root = path.resolve("project", "editors", "vscode");
    assert.equal(resolveTranspilerPath("", root), path.resolve(root, "..", "..", "rez3asm.exe"));
});

test("missing compiler returns a useful error", () => {
    const missing = path.resolve("missing", "rez3asm.exe");
    assert.match(validateTranspilerPath(missing), /RZA compiler was not found/);
});

test("directory is rejected as a compiler", (context) => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "rza-compiler-dir-"));
    context.after(() => fs.rmSync(directory, { recursive: true, force: true }));
    assert.match(validateTranspilerPath(directory), /not a file/);
});

test("real temporary compiler file passes validation", (context) => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "rza-compiler-file-"));
    const compiler = path.join(directory, "rez3asm.exe");
    fs.writeFileSync(compiler, "");
    context.after(() => fs.rmSync(directory, { recursive: true, force: true }));
    assert.equal(validateTranspilerPath(compiler), "");
});

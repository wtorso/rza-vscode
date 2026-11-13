"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { defaultCompilerPath, resolveTranspilerPath, validateTranspilerPath } =
    require("../../compiler_path");

test("configured compiler path wins over the default", () => {
    const configured = path.resolve("tools", "rez3asm.exe");
    assert.equal(resolveTranspilerPath(configured, path.resolve("extension")), configured);
});

test("non-Windows default compiler uses the native name", () => {
    const root = path.resolve("project", "editors", "vscode");
    const expected = path.resolve(root, "..", "..", "rez3asm");
    assert.equal(defaultCompilerPath(root, "linux"), expected);
    assert.equal(resolveTranspilerPath("", root, "linux"), expected);
});

test("Windows default compiler uses the executable suffix", () => {
    const root = path.resolve("project", "editors", "vscode");
    const expected = path.resolve(root, "..", "..", "rez3asm.exe");
    assert.equal(defaultCompilerPath(root, "win32"), expected);
    assert.equal(resolveTranspilerPath("", root, "win32"), expected);
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

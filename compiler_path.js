"use strict";

const fs = require("fs");
const path = require("path");

function defaultCompilerPath(extensionRoot, platform = process.platform) {
    const executable = platform === "win32" ? "rez3asm.exe" : "rez3asm";
    return path.resolve(extensionRoot, "..", "..", "build", "bin", executable);
}

function resolveTranspilerPath(configured, extensionRoot, platform = process.platform) {
    const trimmed = configured.trim();
    if (trimmed) return path.resolve(trimmed);
    return defaultCompilerPath(extensionRoot, platform);
}

function validateTranspilerPath(filePath) {
    try {
        const stat = fs.statSync(filePath);
        if (!stat.isFile()) return `RZA compiler path is not a file: ${filePath}`;
        return "";
    } catch {
        return `RZA compiler was not found: ${filePath}`;
    }
}

module.exports = { defaultCompilerPath, resolveTranspilerPath, validateTranspilerPath };

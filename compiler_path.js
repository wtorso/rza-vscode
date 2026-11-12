"use strict";

const fs = require("fs");
const path = require("path");

function resolveTranspilerPath(configured, extensionRoot) {
    const trimmed = configured.trim();
    if (trimmed) return path.resolve(trimmed);
    return path.resolve(extensionRoot, "..", "..", "rez3asm.exe");
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

module.exports = { resolveTranspilerPath, validateTranspilerPath };

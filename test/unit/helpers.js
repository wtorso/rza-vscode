"use strict";

const fs = require("fs");
const path = require("path");
const oniguruma = require("vscode-oniguruma");
const { parseRawGrammar, Registry } = require("vscode-textmate");

let grammarPromise;

function loadRzaGrammar() {
    if (!grammarPromise) {
        const root = path.join(__dirname, "..", "..");
        const wasm = fs.readFileSync(path.join(root, "node_modules", "vscode-oniguruma",
            "release", "onig.wasm")).buffer;
        const onigLib = oniguruma.loadWASM(wasm).then(() => ({
            createOnigScanner: (patterns) => new oniguruma.OnigScanner(patterns),
            createOnigString: (text) => new oniguruma.OnigString(text),
        }));
        const grammarPath = path.join(root, "syntaxes", "rza.tmLanguage.json");
        const grammarText = fs.readFileSync(grammarPath, "utf8");
        const registry = new Registry({
            onigLib,
            loadGrammar: async (scopeName) => scopeName === "source.rza"
                ? parseRawGrammar(grammarText, grammarPath)
                : null,
        });
        grammarPromise = registry.loadGrammar("source.rza");
    }
    return grammarPromise;
}

async function tokenize(line) {
    const grammar = await loadRzaGrammar();
    return grammar.tokenizeLine(line).tokens.map((token) => ({
        text: line.slice(token.startIndex, token.endIndex),
        scopes: token.scopes,
    }));
}

function tokenScopes(tokens, text) {
    const token = tokens.find((candidate) => candidate.text === text);
    return token ? token.scopes.join(" ") : "";
}

function hasCodeComment(source) {
    let quote = "";
    let escaped = false;
    for (let index = 0; index < source.length; index++) {
        const char = source[index];
        if (escaped) {
            escaped = false;
            continue;
        }
        if (char === "\\") {
            escaped = true;
            continue;
        }
        if (quote) {
            if (char === quote) quote = "";
            continue;
        }
        if (char === "'" || char === '"' || char === "`") {
            quote = char;
            continue;
        }
        if (char === "/" && (source[index + 1] === "/" || source[index + 1] === "*")) {
            return true;
        }
    }
    return false;
}

module.exports = { hasCodeComment, tokenize, tokenScopes };

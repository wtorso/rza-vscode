"use strict";

const vscode = require("vscode");
const { LanguageClient } = require("vscode-languageclient/node");
const { resolveTranspilerPath, validateTranspilerPath } = require("./compiler_path");

let client;

async function stopClient() {
    if (!client) return;
    const running = client;
    client = undefined;
    await running.stop();
}

function transpilerPath(context) {
    const configured = vscode.workspace.getConfiguration("rez3").get("transpilerPath", "");
    return resolveTranspilerPath(configured, context.extensionPath);
}

async function activate(context) {
    const command = transpilerPath(context);
    const problem = validateTranspilerPath(command);
    if (problem) {
        void vscode.window.showErrorMessage(problem, "Open settings").then((choice) => {
            if (choice) {
                return vscode.commands.executeCommand("workbench.action.openSettings",
                    "rez3.transpilerPath");
            }
            return undefined;
        }).catch(() => undefined);
        return;
    }
    const outputChannel = vscode.window.createOutputChannel("RZA");
    const serverOptions = { command, args: ["--lsp"] };
    const clientOptions = {
        documentSelector: [{ scheme: "file", language: "rza" }],
        outputChannel,
    };
    client = new LanguageClient("rza", "RZA Language Server", serverOptions, clientOptions);
    context.subscriptions.push(client, outputChannel);
    try {
        await client.start();
        return { stop: stopClient };
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        await stopClient().catch(() => undefined);
        void vscode.window.showErrorMessage(`RZA language server failed to start: ${message}`);
        return undefined;
    }
}

async function deactivate() {
    try {
        await stopClient();
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error(`RZA language server failed to stop: ${message}`);
    }
}

module.exports = { activate, deactivate };

"use strict";

const path = require("path");
const vscode = require("vscode");
const { LanguageClient, TransportKind } = require("vscode-languageclient/node");

let client;

function activate(context) {
  const serverModule = context.asAbsolutePath(
    path.join("..", "..", "lsp", "rez3-lsp.js")
  );

  const serverOptions = {
    run: { module: serverModule, transport: TransportKind.stdio },
    debug: {
      module: serverModule,
      transport: TransportKind.stdio,
      options: { execArgv: ["--nolazy"] },
    },
  };

  const clientOptions = {
    documentSelector: [{ scheme: "file", language: "rza" }],
    initializationOptions: {
      extensionRoot: context.extensionPath,
      transpilerPath:
        vscode.workspace.getConfiguration("rez3").get("transpilerPath") || undefined,
    },
    synchronize: {
      configurationSection: "rez3",
    },
  };

  client = new LanguageClient(
    "rza",
    "REZ3-ASM Language Server",
    serverOptions,
    clientOptions
  );

  client.start();
  context.subscriptions.push(client);
}

function deactivate() {
  if (!client) return undefined;
  return client.stop();
}

module.exports = { activate, deactivate };

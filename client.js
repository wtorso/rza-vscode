"use strict";

const path = require("path");
const vscode = require("vscode");
const { LanguageClient } = require("vscode-languageclient/node");

let client;

// Путь к транспайлеру: настройка rez3.transpilerPath, иначе
// <extensionRoot>/../../rez3asm.exe (расширение из дерева проекта).
function transpilerPath(context) {
  const configured = vscode.workspace
    .getConfiguration("rez3")
    .get("transpilerPath");
  if (configured) return configured;
  return context.asAbsolutePath(path.join("..", "..", "rez3asm.exe"));
}

function activate(context) {
  // LSP-сервер — внутри транспайлера: rez3asm --lsp (stdio).
  const serverOptions = {
    command: transpilerPath(context),
    args: ["--lsp"],
  };

  const clientOptions = {
    documentSelector: [{ scheme: "file", language: "rza" }],
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

"use strict";

const assert = require("assert");
const path = require("path");
const vscode = require("vscode");

async function waitForDiagnostics(uri, predicate) {
    const deadline = Date.now() + 15000;
    while (Date.now() < deadline) {
        const diagnostics = vscode.languages.getDiagnostics(uri);
        if (predicate(diagnostics)) return diagnostics;
        await new Promise((resolve) => setTimeout(resolve, 50));
    }
    throw new Error(`Timed out waiting for diagnostics: ${JSON.stringify(vscode.languages.getDiagnostics(uri))}`);
}

function waitForEmptyDiagnostics(uri) {
    return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
            listener.dispose();
            reject(new Error("Timed out waiting for empty diagnostics"));
        }, 15000);
        const listener = vscode.languages.onDidChangeDiagnostics((event) => {
            const matches = event.uris.some((candidate) => candidate.toString() === uri.toString());
            if (matches && vscode.languages.getDiagnostics(uri).length === 0) {
                clearTimeout(timeout);
                listener.dispose();
                resolve();
            }
        });
    });
}

async function replaceDocument(document, text) {
    const edit = new vscode.WorkspaceEdit();
    const end = document.positionAt(document.getText().length);
    edit.replace(document.uri, new vscode.Range(document.positionAt(0), end), text);
    await vscode.workspace.applyEdit(edit);
}

describe("RZA extension", function () {
    this.timeout(20000);
    let api;
    let workspace;

    before(async () => {
        workspace = vscode.workspace.workspaceFolders[0].uri;
        await vscode.workspace.getConfiguration("rez3", workspace).update(
            "transpilerPath",
            process.env.RZA_COMPILER,
            vscode.ConfigurationTarget.Workspace,
        );
        api = await vscode.extensions.getExtension("rez3.rza").activate();
    });

    after(async () => {
        if (api) await api.stop();
    });

    it("reports the invalid field through the real language server", async () => {
        const document = await vscode.workspace.openTextDocument(
            path.join(workspace.fsPath, "broken.rza"),
        );
        await vscode.window.showTextDocument(document);
        const diagnostics = await waitForDiagnostics(document.uri,
            (items) => items.length === 1 && items[0].code === "STRUCT");
        assert.equal(diagnostics[0].message, "unknown layout field missing");
        assert.equal(diagnostics[0].range.start.line, 5);
    });

    it("accepts typed layouts after clearing an induced diagnostic", async () => {
        const document = await vscode.workspace.openTextDocument(
            path.join(workspace.fsPath, "typed.rza"),
        );
        await vscode.window.showTextDocument(document);
        const valid = document.getText();
        await replaceDocument(document, valid.replace(".value", ".missing"));
        await waitForDiagnostics(document.uri,
            (items) => items.length === 1 && items[0].code === "STRUCT");
        const empty = waitForEmptyDiagnostics(document.uri);
        await replaceDocument(document, valid);
        await empty;
        assert.deepEqual(vscode.languages.getDiagnostics(document.uri), []);
    });
});

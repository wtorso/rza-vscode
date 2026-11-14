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

    it("provides hover and definitions from the real language model", async () => {
        const document = await vscode.workspace.openTextDocument(
            path.join(workspace.fsPath, "typed.rza"));
        await vscode.window.showTextDocument(document);
        const position = new vscode.Position(1, 22);
        const hover = await vscode.commands.executeCommand(
            "vscode.executeHoverProvider", document.uri, position);
        assert.ok(hover.length > 0);
        const contents = Array.isArray(hover[0].contents) ?
            hover[0].contents : [hover[0].contents];
        const markdown = contents.map((item) =>
            typeof item === "string" ? item : item.value).join("\n");
        assert.match(markdown, /Entry/);
        assert.match(markdown, /16/);
        const layoutDefinition = await vscode.commands.executeCommand(
            "vscode.executeDefinitionProvider", document.uri, position);
        assert.equal(layoutDefinition.length, 1);
        const layoutRange = layoutDefinition[0].range || layoutDefinition[0].targetRange;
        assert.equal(layoutRange.start.line, 0);
        assert.equal(layoutRange.start.character, 7);
        assert.equal(layoutRange.end.character, 12);
        const fieldDefinition = await vscode.commands.executeCommand(
            "vscode.executeDefinitionProvider", document.uri,
            new vscode.Position(7, 26));
        assert.equal(fieldDefinition.length, 1);
        const fieldRange = fieldDefinition[0].range || fieldDefinition[0].targetRange;
        assert.equal(fieldRange.start.line, 0);
        assert.equal(fieldRange.start.character, 23);
        assert.equal(fieldRange.end.character, 28);
        const navigation = await vscode.workspace.openTextDocument(
            path.join(workspace.fsPath, "navigation.rza"));
        const procedureDefinition = await vscode.commands.executeCommand(
            "vscode.executeDefinitionProvider", navigation.uri,
            new vscode.Position(6, 6));
        assert.equal(procedureDefinition.length, 1);
        const procedureRange = procedureDefinition[0].range ||
            procedureDefinition[0].targetRange;
        assert.equal(procedureRange.start.line, 3);
        assert.equal(procedureRange.start.character, 5);
        assert.equal(procedureRange.end.character, 15);
    });

    it("completes fields and visible procedures", async () => {
        const document = await vscode.workspace.openTextDocument(
            path.join(workspace.fsPath, "navigation.rza"));
        await vscode.window.showTextDocument(document);
        const valid = document.getText();
        await replaceDocument(document, valid.replace("[entries_m + 0].value",
            "[entries_m + 0].v"));
        await waitForDiagnostics(document.uri, (items) => items.length === 1 &&
            items[0].message === "unknown layout field v");
        const fieldPosition = document.positionAt(document.getText().indexOf(".v") + 2);
        const fields = await vscode.commands.executeCommand(
            "vscode.executeCompletionItemProvider", document.uri, fieldPosition);
        assert.ok(fields.items.some((item) => item.label === "value"));
        assert.equal(fields.items.some((item) => item.label === "key"), false);
        await replaceDocument(document, valid.replace("call read_first", "call read"));
        await waitForDiagnostics(document.uri, (items) => items.length === 1 &&
            items[0].message === "call of unknown procedure read");
        const procedurePosition = document.positionAt(
            document.getText().indexOf("call read") + "call read".length);
        const procedures = await vscode.commands.executeCommand(
            "vscode.executeCompletionItemProvider", document.uri, procedurePosition);
        assert.ok(procedures.items.some((item) => item.label === "read_first"));
        assert.equal(procedures.items.some((item) => item.label === "missing"), false);
        await replaceDocument(document, valid);
    });

    it("finds references and applies a checked rename", async () => {
        const document = await vscode.workspace.openTextDocument(
            path.join(workspace.fsPath, "navigation.rza"));
        await vscode.window.showTextDocument(document);
        const valid = document.getText();
        const position = new vscode.Position(6, 6);
        const references = await vscode.commands.executeCommand(
            "vscode.executeReferenceProvider", document.uri, position, true);
        assert.equal(references.length, 2);
        assert.deepEqual(references.map((item) => item.range.start.line).sort(), [3, 6]);
        assert.ok(references.every((item) => item.uri.toString() === document.uri.toString()));

        const rename = await vscode.commands.executeCommand(
            "vscode.executeDocumentRenameProvider", document.uri, position, "read_renamed");
        assert.equal(await vscode.workspace.applyEdit(rename), true);
        await waitForDiagnostics(document.uri, (items) => items.length === 0 &&
            document.getText().includes("proc read_renamed:"));
        assert.equal(document.getText().match(/read_renamed/g).length, 2);
        assert.equal(document.getText().includes("read_first"), false);

        const restore = await vscode.commands.executeCommand(
            "vscode.executeDocumentRenameProvider", document.uri, position, "read_first");
        assert.equal(await vscode.workspace.applyEdit(restore), true);
        await waitForDiagnostics(document.uri, (items) => items.length === 0 &&
            document.getText() === valid);
    });
});

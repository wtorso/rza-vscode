"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const Module = require("node:module");

function temporaryCompiler(context) {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "rza-lifecycle-"));
    const compiler = path.join(directory, "rez3asm.exe");
    fs.writeFileSync(compiler, "");
    context.after(() => fs.rmSync(directory, { recursive: true, force: true }));
    return compiler;
}

function loadClient(behavior) {
    const originalLoad = Module._load;
    const vscode = {
        workspace: {
            getConfiguration: () => ({ get: () => behavior.compiler }),
        },
        window: {
            createOutputChannel: () => ({ appendLine() {}, dispose() {} }),
            showErrorMessage: () => new Promise(() => {}),
        },
        commands: { executeCommand: async () => undefined },
    };
    class LanguageClient {
        constructor() {
            behavior.created++;
        }
        async start() {
            return behavior.start();
        }
        async stop() {
            behavior.stops++;
            return behavior.stop();
        }
    }
    Module._load = (request, parent, isMain) => {
        if (request === "vscode") return vscode;
        if (request === "vscode-languageclient/node") return { LanguageClient };
        return originalLoad(request, parent, isMain);
    };
    delete require.cache[require.resolve("../../client.js")];
    const client = require("../../client.js");
    Module._load = originalLoad;
    return client;
}

function behavior(compiler, start, stop) {
    return { compiler, created: 0, stops: 0, start, stop };
}

async function settles(promise) {
    return Promise.race([
        promise,
        new Promise((_, reject) => setTimeout(() => reject(new Error("did not settle")), 100)),
    ]);
}

test("successful activation exposes a single-use stop", async (context) => {
    const fake = behavior(temporaryCompiler(context), async () => undefined, async () => undefined);
    const client = loadClient(fake);
    const contextValue = { extensionPath: "extension", subscriptions: [] };
    const api = await settles(client.activate(contextValue));
    await settles(api.stop());
    await settles(api.stop());
    assert.equal(fake.created, 1);
    assert.equal(fake.stops, 1);
});

test("missing compiler does not block activation on a notification", async () => {
    const fake = behavior(path.resolve("missing-rez3asm.exe"), async () => undefined,
        async () => undefined);
    const client = loadClient(fake);
    await settles(client.activate({ extensionPath: "extension", subscriptions: [] }));
    assert.equal(fake.created, 0);
});

test("start failure stops the client without waiting for a notification", async (context) => {
    const fake = behavior(temporaryCompiler(context), async () => {
        throw new Error("start failed");
    }, async () => undefined);
    const client = loadClient(fake);
    await settles(client.activate({ extensionPath: "extension", subscriptions: [] }));
    assert.equal(fake.stops, 1);
});

test("stop failure is logged without waiting for a notification", async (context) => {
    const fake = behavior(temporaryCompiler(context), async () => undefined, async () => {
        throw new Error("stop failed");
    });
    const client = loadClient(fake);
    await settles(client.activate({ extensionPath: "extension", subscriptions: [] }));
    await settles(client.deactivate());
    assert.equal(fake.stops, 1);
});

"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const integration = require("../integration/runTests");
const { defaultCompilerPath } = require("../../compiler_path");

test("integration runner points at the extension and the real compiler", () => {
    const root = path.resolve(__dirname, "..", "..");
    assert.equal(integration.root, root);
    assert.equal(integration.compiler, defaultCompilerPath(root));
    assert.ok(fs.existsSync(path.join(root, "package.json")));
    assert.ok(fs.existsSync(integration.compiler));
    assert.equal(integration.version, "1.146.0");
});

test("integration workspace is copied and removed", () => {
    const workspace = integration.createWorkspace();
    try {
        assert.notEqual(workspace, path.resolve(__dirname, "..", "fixtures", "workspace"));
        assert.ok(fs.existsSync(path.join(workspace, "typed.rza")));
        assert.ok(fs.existsSync(path.join(workspace, "broken.rza")));
    } finally {
        integration.removeWorkspace(workspace);
    }
    assert.equal(fs.existsSync(workspace), false);
});

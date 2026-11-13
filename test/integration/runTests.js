"use strict";

const fs = require("fs");
const os = require("os");
const path = require("path");
const { runTests } = require("@vscode/test-electron");
const { defaultCompilerPath } = require("../../compiler_path");

const root = path.resolve(__dirname, "..", "..");
const compiler = defaultCompilerPath(root);
const version = "1.146.0";

function createWorkspace() {
    const workspace = fs.mkdtempSync(path.join(os.tmpdir(), "rza-vscode-workspace-"));
    fs.cpSync(path.join(__dirname, "..", "fixtures", "workspace"), workspace,
        { recursive: true });
    return workspace;
}

function removeWorkspace(workspace) {
    fs.rmSync(workspace, { recursive: true, force: true });
}

async function main() {
    const workspace = createWorkspace();
    try {
        await runTests({
            version,
            extensionDevelopmentPath: root,
            extensionTestsPath: path.resolve(__dirname, "index"),
            extensionTestsEnv: { RZA_COMPILER: compiler },
            launchArgs: [workspace],
        });
    } finally {
        removeWorkspace(workspace);
    }
}

module.exports = { compiler, createWorkspace, main, removeWorkspace, root, version };

if (require.main === module) {
    main().catch((error) => {
        console.error(error);
        process.exit(1);
    });
}

"use strict";

const path = require("path");
const Mocha = require("mocha");

async function run() {
    const mocha = new Mocha({ ui: "bdd", color: true, timeout: 20000 });
    mocha.addFile(path.resolve(__dirname, "suite.js"));
    return new Promise((resolve, reject) => {
        mocha.run((failures) => {
            if (failures) reject(new Error(`${failures} integration test failed`));
            else resolve();
        });
    });
}

module.exports = { run };

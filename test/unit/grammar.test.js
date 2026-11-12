"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { tokenize, tokenScopes } = require("./helpers");

test("typed layout tokens use language-specific scopes", async () => {
    const tokens = await tokenize("layout Entry: key:i64, value:i64");
    assert.match(tokenScopes(tokens, "layout"), /keyword\.control\.layout\.rza/);
    assert.match(tokenScopes(tokens, "Entry"), /entity\.name\.type\.layout\.rza/);
    assert.match(tokenScopes(tokens, "key"), /variable\.other\.property\.rza/);
    assert.match(tokenScopes(tokens, "i64"), /support\.type\.primitive\.rza/);
});

test("current instruction keywords are recognized", async () => {
    const tokens = await tokenize("await %r15");
    assert.match(tokenScopes(tokens, "await"), /keyword\.control\.flow\.rza/);
    assert.match(tokenScopes(tokens, "%r15"), /variable\.parameter\.register\.rza/);
    const store = await tokenize("storeb [entries_m + %r0].value, %r0");
    assert.match(tokenScopes(store, "storeb"), /keyword\.control\.ownership\.rza/);
    assert.match(tokenScopes(store, "value"), /variable\.other\.property\.rza/);
    const compare = await tokenize("slt %r0, %r1, %r2");
    assert.match(tokenScopes(compare, "slt"), /keyword\.other\.alu\.rza/);
});

test("array counts and hexadecimal integers are numeric tokens", async () => {
    const tokens = await tokenize("res entries, field, Entry[512]");
    assert.match(tokenScopes(tokens, "Entry"), /entity\.name\.type\.layout\.rza/);
    assert.match(tokenScopes(tokens, "512"), /constant\.numeric\.integer\.rza/);
    const hex = await tokenize("mov %r0, -0xFF");
    assert.match(tokenScopes(hex, "-0xFF"), /constant\.numeric\.integer\.rza/);
});

test("instruction keywords inside comments remain comments", async () => {
    const tokens = await tokenize("; layout storeb await");
    assert.equal(tokens.length, 1);
    assert.match(tokens[0].scopes.join(" "), /comment\.line\.semicolon\.rza/);
});

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
    const view = await tokenize("view payload_m, input_m, %r0, %r1");
    assert.match(tokenScopes(view, "view"), /keyword\.control\.ownership\.rza/);
    const compare = await tokenize("slt %r0, %r1, %r2");
    assert.match(tokenScopes(compare, "slt"), /keyword\.other\.alu\.rza/);
    const shift = await tokenize("ushr %r0, %r0, 1");
    assert.match(tokenScopes(shift, "ushr"), /keyword\.other\.alu\.rza/);
    const checked = await tokenize("cadd %r0, %r0, 1");
    assert.match(tokenScopes(checked, "cadd"), /keyword\.other\.alu\.rza/);
    const crc = await tokenize("crc32c %r0, %r0, %r1");
    assert.match(tokenScopes(crc, "crc32c"), /keyword\.other\.alu\.rza/);
});

test("array counts and hexadecimal integers are numeric tokens", async () => {
    const tokens = await tokenize("res entries, field, Entry[512]");
    assert.match(tokenScopes(tokens, "Entry"), /entity\.name\.type\.layout\.rza/);
    assert.match(tokenScopes(tokens, "512"), /constant\.numeric\.integer\.rza/);
    const hex = await tokenize("mov %r0, -0xFF");
    assert.match(tokenScopes(hex, "-0xFF"), /constant\.numeric\.integer\.rza/);
});

test("active fixed-width typed instructions are complete tokens", async () => {
    const shared = [
        "mov", "load", "store", "add", "sub", "mul", "inc", "dec",
        "cadd", "csub", "cmul", "cinc", "cdec", "and", "or", "xor",
        "div", "mod", "shl", "ushr",
    ];
    const types = ["i8", "u8", "i16", "u16", "i32", "u32"];
    const typed = shared.flatMap((base) => types.map((type) => `${base}.${type}`));
    typed.push("shr.i8", "slt.i8", "ult.u8", "shr.i16", "slt.i16", "ult.u16");
    typed.push("shr.i32", "slt.i32", "ult.u32");
    assert.equal(typed.length, 129);
    for (const instruction of typed) {
        const tokens = await tokenize(instruction);
        assert.match(tokenScopes(tokens, instruction), /keyword\.other\.numeric\.rza/);
        assert.doesNotMatch(tokenScopes(tokens, instruction),
            /variable\.other\.property\.rza/);
    }
    const layout = await tokenize(
        "layout Pair: tag:u8, signed:i8, half:u16, word:i16, dword:i32, tail:u32");
    assert.match(tokenScopes(layout, "u16"), /support\.type\.primitive\.rza/);
    assert.match(tokenScopes(layout, "i16"), /support\.type\.primitive\.rza/);
    assert.match(tokenScopes(layout, "i32"), /support\.type\.primitive\.rza/);
    assert.match(tokenScopes(layout, "u32"), /support\.type\.primitive\.rza/);
});

test("inactive typed instruction pairs do not use numeric scopes", async () => {
    const inactive = [
        "load.i64", "store.i64", "mov.i64", "add.i64", "load.u64",
        "shr.u8", "slt.u8", "ult.i8", "shr.u16", "slt.u16", "ult.i16",
        "shr.u32", "slt.u32", "ult.i32", "ult", "loadb.u8", "loadb.u16",
        "loadb.u32", "crc32c.i32", "print.i32", "cvt.i32", "add.f32",
    ];
    for (const instruction of inactive) {
        const tokens = await tokenize(instruction);
        assert.equal(tokens.some((token) => token.scopes.includes(
            "keyword.other.numeric.rza")), false, instruction);
    }
});

test("instruction keywords inside comments remain comments", async () => {
    const tokens = await tokenize("; layout storeb await");
    assert.equal(tokens.length, 1);
    assert.match(tokens[0].scopes.join(" "), /comment\.line\.semicolon\.rza/);
});

# RZA for VS Code

[Русская версия](README.ru.md)

RZA is a low-level language with explicit memory lifetimes and checked memory
access. This extension adds syntax highlighting, compiler diagnostics, and
language navigation to `.rza` files in Visual Studio Code.

The extension starts the same `rez3asm` compiler that you can use from the
command line. It does not contain a second implementation of the language rules.

## Features

- Highlighting for instructions, registers, layouts, fields, numbers and comments.
- Diagnostics through the real `rez3asm --lsp` language server.
- Hover for layouts, fields, frames, cells, mediators, and procedures.
- Same-document go-to-definition and references with exact identifier ranges.
- Prepare rename and checked rename for layouts, fields, frames, cells, mediators,
  and procedures. Edits carry the document version and are returned only when the
  renamed program passes the compiler checker.
- Context-aware completion for typed fields and visible declaration operands.
- Support for typed layouts, including `layout`, `u8`, `i64` and `.field` access.
- English and Russian documentation.

Each `.rza` file is a self-contained program without cross-file references, so
navigation and rename stay within the current document. Labels are not included.
Rename requires a valid current document. The compiler is not bundled in the VSIX
package.

## Requirements

- VS Code 1.82.0 or newer.
- A working RZA compiler, obtained separately from its source project.
- Node.js 22.14.0 only to develop or test the extension.

Build the compiler using its project's own instructions. No additional runtime
is needed by the extension.

## Install

### From VSIX

Inside the extension directory:

```sh
npm ci
npm run package
code --install-extension build/rza-0.5.0.vsix
```

Restart VS Code after installation.

### From the source tree

Copy or link this directory as `rza-0.5.0` in your VS Code extensions directory,
run `npm ci` there, and restart VS Code. A symlink also works during development.
When the extension is installed outside the source checkout, configure the
compiler path explicitly as described below.

## Configure the compiler

The setting is `rez3.transpilerPath`.

Leave it empty when this extension is located at `editors/vscode` inside the
compiler's source checkout. For any other layout, set an absolute path to the
compiler in user or workspace settings:

```json
{
  "rez3.transpilerPath": "<absolute-path-to-compiler>"
}
```

Reload the VS Code window after changing the setting. If the file is missing or
is not a regular file, the extension explains the problem and offers to open
the setting.

## A typed example

```asm
layout Entry: key:i64, value:i64
res entries, field, Entry[2]
med entries_m, entries, field
mov %r0, 0
mov %r1, 42
store [entries_m + %r0].key, %r1
store [entries_m + %r0].value, %r1
load %r2, [entries_m + 0].value
print %r2
ret
```

The index after a mediator is an element index, not a byte offset. The compiler
computes the record size and field offsets. Invalid fields are shown as `STRUCT`
diagnostics by the real language server.

## Develop and verify

```sh
npm ci
npm test
npm run test:integration
npm run test:package
npm run package
```

- `npm test` checks grammar tokens, compiler paths and public package files.
- `npm run test:integration` downloads VS Code 1.146.0 and runs the real extension
  against the real language server. On a headless Linux host, use
  `xvfb-run -a npm run test:integration`.
- `npm run test:package` verifies the archive contents with a Node ZIP reader.
- `npm run package` writes `build/rza-0.5.0.vsix` without committing it to git.

Generated dependencies, VS Code downloads, logs and packages are ignored.

## Troubleshooting

**The compiler is not found.** Check `rez3.transpilerPath`, build the compiler,
and reload the window.

**There are no diagnostics.** Confirm that the file uses the `rza` language mode,
the compiler exists, and the document is inside the opened workspace. The RZA
output channel in VS Code can show language-server startup errors.

**A typed document is rejected.** Open it with `rez3asm` directly. The extension
and the command-line checker should report the same error; the extension does not
relax compiler rules.

**Memory or host C concerns.** The compiler defines the behavior of `.rza`, but
it does not make arbitrary host C safe.

[Документация на русском](README.ru.md)

#!/usr/bin/env node
/*
 * rez3-lsp.js — LSP-сервер для REZ3-ASM (.rza).
 *
 * Чистый Node.js, без внешних зависимостей: JSON-RPC 2.0 поверх stdio
 * (Content-Length framing). Диагностика делегируется транспайлеру
 * rez3asm: текст документа пишется во временный .rza, запускается
 * `rez3asm <tmp>`, stderr парсится по формату
 * `VIOLATION line N [RULE]: message` (N — 1-based).
 *
 * Настройка пути к транспайлеру (по убыванию приоритета):
 *   1. initializationOptions.transpilerPath
 *   2. workspace/configuration секция "rez3" -> rez3.transpilerPath
 *   3. <extensionRoot>/../../rez3asm.exe (extensionRoot из
 *      initializationOptions.extensionRoot) либо ../rez3asm.exe
 *      относительно этого файла.
 * Если transpilerPath заканчивается на ".py", запускается как
 * `python <path> <file>` (режим разработки без собранного .exe).
 * Дополнительные аргументы: initializationOptions.transpilerArgs (array).
 *
 * Логи и ошибки сервера — только в stderr; stdout строго под протокол.
 */
"use strict";

const { spawn } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");

const DEBOUNCE_MS = 300;
const DIAG_SOURCE = "rez3asm";
const VIOLATION_RE = /^VIOLATION line (\d+) \[([A-Za-z0-9_-]+)\]: (.*)$/;

function logError(msg) {
  process.stderr.write(`[rez3-lsp] ${msg}\n`);
}

// ---------------------------------------------------------------------------
// Content-Length framing
// ---------------------------------------------------------------------------

let inBuf = Buffer.alloc(0);

function sendMessage(obj) {
  const body = Buffer.from(JSON.stringify(obj), "utf8");
  const head = Buffer.from(`Content-Length: ${body.length}\r\n\r\n`, "utf8");
  process.stdout.write(Buffer.concat([head, body]));
}

function sendResponse(id, result) {
  sendMessage({ jsonrpc: "2.0", id, result });
}

function sendErrorResponse(id, code, message) {
  sendMessage({ jsonrpc: "2.0", id, error: { code, message } });
}

function sendNotification(method, params) {
  sendMessage({ jsonrpc: "2.0", method, params });
}

// Server -> client запросы (workspace/configuration)
let nextServerReqId = 1;
const pendingServerReqs = new Map();

function sendRequest(method, params) {
  const id = `rez3-${nextServerReqId++}`;
  pendingServerReqs.set(id, method);
  sendMessage({ jsonrpc: "2.0", id, method, params });
}

function tryParseMessages() {
  for (;;) {
    const headerEnd = inBuf.indexOf("\r\n\r\n");
    if (headerEnd === -1) return;
    const header = inBuf.slice(0, headerEnd).toString("latin1");
    let length = -1;
    for (const line of header.split("\r\n")) {
      const m = /^Content-Length:\s*(\d+)\s*$/i.exec(line);
      if (m) length = parseInt(m[1], 10);
    }
    if (length < 0) {
      // Невалидный заголовок — отбрасываем байт и пытаемся ресинхронизироваться.
      inBuf = inBuf.slice(1);
      continue;
    }
    const bodyStart = headerEnd + 4;
    if (inBuf.length < bodyStart + length) return;
    const body = inBuf.slice(bodyStart, bodyStart + length);
    inBuf = inBuf.slice(bodyStart + length);
    let msg;
    try {
      msg = JSON.parse(body.toString("utf8"));
    } catch (e) {
      logError(`bad JSON-RPC payload: ${e.message}`);
      continue;
    }
    handleMessage(msg);
  }
}

// ---------------------------------------------------------------------------
// Конфигурация
// ---------------------------------------------------------------------------

const config = {
  transpilerPath: null, // явно заданный путь
  transpilerArgs: [], // дополнительные аргументы перед именем файла
  extensionRoot: null, // корень расширения (для default-пути)
  workspaceConfigSupported: false,
};

function defaultTranspilerPath() {
  if (config.extensionRoot) {
    return path.resolve(config.extensionRoot, "..", "..", "rez3asm.exe");
  }
  return path.resolve(__dirname, "..", "rez3asm.exe");
}

function resolveTranspilerCommand() {
  const tp = config.transpilerPath || defaultTranspilerPath();
  const args = [...config.transpilerArgs];
  let cmd = tp;
  if (/\.py$/i.test(tp) && args.length === 0) {
    cmd = process.platform === "win32" ? "python" : "python3";
    args.unshift(tp);
  }
  return { cmd, args };
}

function applyInitializationOptions(opts) {
  if (!opts || typeof opts !== "object") return;
  if (typeof opts.transpilerPath === "string" && opts.transpilerPath) {
    config.transpilerPath = opts.transpilerPath;
  }
  if (Array.isArray(opts.transpilerArgs)) {
    config.transpilerArgs = opts.transpilerArgs.map(String);
  }
  if (typeof opts.extensionRoot === "string" && opts.extensionRoot) {
    config.extensionRoot = opts.extensionRoot;
  }
  // Допускаем вложенную форму: { rez3: { transpilerPath: ... } }
  if (opts.rez3 && typeof opts.rez3.transpilerPath === "string" && opts.rez3.transpilerPath) {
    config.transpilerPath = opts.rez3.transpilerPath;
  }
}

// ---------------------------------------------------------------------------
// Документы и диагностика
// ---------------------------------------------------------------------------

const documents = new Map(); // uri -> { text, version }
const debounceTimers = new Map(); // uri -> timer

function runChecker(filePath) {
  return new Promise((resolve) => {
    const { cmd, args } = resolveTranspilerCommand();
    const child = spawn(cmd, [...args, filePath], {
      windowsHide: true,
    });
    let stderr = "";
    child.stderr.on("data", (d) => {
      stderr += d.toString("utf8");
    });
    child.on("error", (err) => {
      resolve({ spawnError: err, stderr: "" });
    });
    child.on("close", () => {
      resolve({ spawnError: null, stderr });
    });
  });
}

function parseDiagnostics(stderrText) {
  const diags = [];
  for (const line of stderrText.split(/\r?\n/)) {
    const m = VIOLATION_RE.exec(line);
    if (!m) continue;
    const lineNo = Math.max(0, parseInt(m[1], 10) - 1); // 1-based -> 0-based
    diags.push({
      range: {
        start: { line: lineNo, character: 0 },
        end: { line: lineNo, character: 9999 },
      },
      severity: 1, // Error
      source: DIAG_SOURCE,
      code: m[2],
      message: m[3],
    });
  }
  return diags;
}

const validationRuns = new Map(); // uri -> seq, защита от гонок

async function validate(uri) {
  const doc = documents.get(uri);
  if (!doc) return;
  const seq = (validationRuns.get(uri) || 0) + 1;
  validationRuns.set(uri, seq);

  let tmpFile;
  try {
    tmpFile = path.join(
      os.tmpdir(),
      `rez3-lsp-${process.pid}-${seq}-${Date.now()}.rza`
    );
    fs.writeFileSync(tmpFile, doc.text, "utf8");
  } catch (e) {
    logError(`cannot write temp file: ${e.message}`);
    return;
  }

  const { spawnError, stderr } = await runChecker(tmpFile);
  try {
    fs.unlinkSync(tmpFile);
  } catch (_) {
    /* best effort */
  }

  if (validationRuns.get(uri) !== seq || !documents.has(uri)) return; // устарело

  if (spawnError) {
    logError(`failed to run rez3asm: ${spawnError.message}`);
    const { cmd } = resolveTranspilerCommand();
    sendNotification("textDocument/publishDiagnostics", {
      uri,
      diagnostics: [
        {
          range: {
            start: { line: 0, character: 0 },
            end: { line: 0, character: 1 },
          },
          severity: 1,
          source: DIAG_SOURCE,
          message: `cannot run transpiler "${cmd}": ${spawnError.message}`,
        },
      ],
    });
    return;
  }

  sendNotification("textDocument/publishDiagnostics", {
    uri,
    diagnostics: parseDiagnostics(stderr),
  });
}

function scheduleValidation(uri) {
  const old = debounceTimers.get(uri);
  if (old) clearTimeout(old);
  debounceTimers.set(
    uri,
    setTimeout(() => {
      debounceTimers.delete(uri);
      validate(uri).catch((e) => logError(`validate failed: ${e.message}`));
    }, DEBOUNCE_MS)
  );
}

function revalidateAll() {
  for (const uri of documents.keys()) scheduleValidation(uri);
}

// ---------------------------------------------------------------------------
// Обработчики протокола
// ---------------------------------------------------------------------------

let shutdownRequested = false;

const handlers = {
  initialize(id, params) {
    params = params || {};
    applyInitializationOptions(params.initializationOptions);
    const caps = params.capabilities || {};
    config.workspaceConfigSupported = !!(
      caps.workspace && caps.workspace.configuration
    );
    sendResponse(id, {
      capabilities: {
        textDocumentSync: 1, // Full
      },
      serverInfo: { name: "rez3-lsp", version: "0.1.0" },
    });
  },

  initialized() {
    if (config.workspaceConfigSupported) {
      sendRequest("workspace/configuration", {
        items: [{ section: "rez3" }],
      });
    }
  },

  "workspace/didChangeConfiguration"(id, params) {
    const settings = params && params.settings;
    const rez3 = settings && settings.rez3;
    if (rez3 && typeof rez3.transpilerPath === "string" && rez3.transpilerPath) {
      config.transpilerPath = rez3.transpilerPath;
      revalidateAll();
    }
  },

  "textDocument/didOpen"(id, params) {
    const td = params && params.textDocument;
    if (!td || !td.uri) return;
    documents.set(td.uri, { text: td.text || "", version: td.version });
    scheduleValidation(td.uri);
  },

  "textDocument/didChange"(id, params) {
    const td = params && params.textDocument;
    const changes = (params && params.contentChanges) || [];
    if (!td || !td.uri) return;
    const doc = documents.get(td.uri);
    if (!doc) return;
    // textDocumentSync = Full: последнее change содержит весь текст.
    for (const ch of changes) {
      if (typeof ch.text === "string") doc.text = ch.text;
    }
    doc.version = td.version;
    scheduleValidation(td.uri);
  },

  "textDocument/didSave"(id, params) {
    const td = params && params.textDocument;
    if (!td || !td.uri || !documents.has(td.uri)) return;
    const t = debounceTimers.get(td.uri);
    if (t) {
      clearTimeout(t);
      debounceTimers.delete(td.uri);
    }
    validate(td.uri).catch((e) => logError(`validate failed: ${e.message}`));
  },

  "textDocument/didClose"(id, params) {
    const td = params && params.textDocument;
    if (!td || !td.uri) return;
    documents.delete(td.uri);
    const t = debounceTimers.get(td.uri);
    if (t) {
      clearTimeout(t);
      debounceTimers.delete(td.uri);
    }
    sendNotification("textDocument/publishDiagnostics", {
      uri: td.uri,
      diagnostics: [],
    });
  },

  shutdown(id) {
    shutdownRequested = true;
    sendResponse(id, null);
  },

  exit() {
    process.exit(shutdownRequested ? 0 : 1);
  },
};

function handleMessage(msg) {
  // Ответ на server->client запрос (workspace/configuration и т.п.)
  if (msg.id !== undefined && msg.method === undefined) {
    const method = pendingServerReqs.get(msg.id);
    if (method) {
      pendingServerReqs.delete(msg.id);
      if (method === "workspace/configuration") {
        const result = msg.result;
        const rez3 = Array.isArray(result) ? result[0] : result;
        if (rez3 && typeof rez3.transpilerPath === "string" && rez3.transpilerPath) {
          config.transpilerPath = rez3.transpilerPath;
          revalidateAll();
        }
      }
    }
    return;
  }

  const { id, method, params } = msg;
  const handler = handlers[method];
  if (!handler) {
    if (id !== undefined) {
      sendErrorResponse(id, -32601, `method not found: ${method}`);
    }
    return;
  }
  try {
    handler(id, params);
  } catch (e) {
    logError(`handler ${method} failed: ${e.stack || e.message}`);
    if (id !== undefined) {
      sendErrorResponse(id, -32603, `internal error in ${method}`);
    }
  }
}

// ---------------------------------------------------------------------------
// stdio
// ---------------------------------------------------------------------------

process.stdin.on("data", (chunk) => {
  inBuf = Buffer.concat([inBuf, chunk]);
  tryParseMessages();
});

process.stdin.on("end", () => {
  // EOF без exit: корректное завершение.
  process.exit(shutdownRequested ? 0 : 0);
});

process.stdin.on("error", (e) => {
  logError(`stdin error: ${e.message}`);
  process.exit(1);
});

process.on("uncaughtException", (e) => {
  logError(`uncaughtException: ${e.stack || e.message}`);
});

process.on("unhandledRejection", (e) => {
  logError(`unhandledRejection: ${e && e.stack ? e.stack : e}`);
});

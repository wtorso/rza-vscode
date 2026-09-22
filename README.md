# REZ3-ASM — расширение для VS Code

Подсветка синтаксиса и диагностика (I1–I4, DECAY, DUP, STRUCT, SCOPE)
для файлов `.rz3a`. Диагностика выполняется транспайлером `rez3asm`
через LSP-сервер `rez3-asm/lsp/rez3-lsp.js`.

## Структура

```
editors/vscode/
  package.json                    — манифест расширения
  client.js                       — точка входа (vscode-languageclient)
  language-configuration.json     — комментарий ";", скобки
  syntaxes/rz3a.tmLanguage.json   — TextMate-грамматика
../../lsp/rez3-lsp.js             — LSP-сервер (Node.js, без зависимостей)
```

## Установка зависимостей

```sh
cd editors/vscode
npm install
```

## Путь к транспайлеру

Расширение ищет `rez3asm` в следующем порядке:

1. Настройка VS Code `rez3.transpilerPath` (Settings → Extensions →
   REZ3-ASM, либо в `settings.json`):
   ```json
   { "rez3.transpilerPath": "C:/Users/myski/projects/rzn/rez3-asm/rez3asm.exe" }
   ```
2. По умолчанию: `<папка расширения>/../../rez3asm.exe` — т.е.
   `rez3-asm/rez3asm.exe`, если расширение установлено из дерева проекта.

Транспайлер — `rez3asm.exe` (C3 0.8.4); Python-версии больше нет.
Собрать: `c3c compile rez3asm.c3 -o rez3asm` в `rez3-asm/`
(выполняется автоматически шагом 0 в `run_tests.sh`).

## Установка расширения

### Вариант A: пакет .vsix

```sh
cd editors/vscode
npx @vscode/vsce package
```

Получится `rez3a-0.1.0.vsix`. Установка: `Ctrl+Shift+P` →
«Extensions: Install from VSIX…», либо
`code --install-extension rez3a-0.1.0.vsix`.

**Внимание:** LSP-сервер лежит в `../../lsp/` относительно расширения
и в .vsix не входит. После установки .vsix расширение попадает в
`%USERPROFILE%\.vscode\extensions\rez3.rez3a-0.1.0\`, поэтому сервер
должен лежать в `%USERPROFILE%\.vscode\lsp\rez3-lsp.js`:

```sh
mkdir -p "$USERPROFILE/.vscode/lsp"
cp rez3-asm/lsp/rez3-lsp.js "$USERPROFILE/.vscode/lsp/"
```

### Вариант B: копирование папки (рекомендуется при разработке)

Скопируйте папку `editors/vscode` в
`%USERPROFILE%\.vscode\extensions\rez3a-0.1.0` (после `npm install`),
затем скопируйте `rez3-asm/lsp/` в `%USERPROFILE%\.vscode\lsp` —
клиент ищет сервер как `../../lsp/rez3-lsp.js` относительно папки
расширения, т.е. `%USERPROFILE%\.vscode\lsp\rez3-lsp.js`.
Перезапустите VS Code.

Альтернатива без копирования сервера: задайте `rez3.transpilerPath`
и держите расширение прямо в дереве проекта (симлинк папки
`editors/vscode` в `.vscode/extensions` тоже работает).

## Возможности

- Диагностика по сохранению и по набору (debounce 300 мс), severity Error,
  source `rez3asm`, code = правило (I1, I2, I3, I4, DECAY, DUP, STRUCT, SCOPE).
- Подсветка: комментарии `;`, три группы ключевых слов (владение / ALU /
  поток), регистры `%r0`–`%r15`, метки, числа, `field`, медиаторы `*_m`.

Ограничение: completion, hover, go-to-definition не реализованы —
только диагностика и подсветка.

# REZ3-ASM — расширение для VS Code

Подсветка синтаксиса и диагностика (I1–I4, DECAY, DUP, STRUCT, SCOPE)
для файлов `.rza`. Диагностика выполняется транспайлером `rez3asm`
через LSP-сервер (Node.js, без зависимостей): исходник —
`rez3-asm/lsp/rez3-lsp.js`, в расширение входит копия `server/rez3-lsp.js`.

## Структура

```
editors/vscode/
  package.json                    — манифест расширения
  client.js                       — точка входа (vscode-languageclient)
  server/rez3-lsp.js              — LSP-сервер (копия ../../lsp/rez3-lsp.js)
  language-configuration.json     — комментарий ";", скобки
  syntaxes/rza.tmLanguage.json   — TextMate-грамматика
../../lsp/rez3-lsp.js             — исходник сервера (править там,
                                    затем копировать в server/)
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

Получится `rza-0.3.0.vsix`. Установка: `Ctrl+Shift+P` →
«Extensions: Install from VSIX…», либо
`code --install-extension rza-0.3.0.vsix`.

LSP-сервер входит в расширение (`server/`) и упаковывается в .vsix
вместе с ним — копировать его отдельно не нужно. Снаружи нужен только
транспайлер `rez3asm.exe` (см. «Путь к транспайлеру» выше).

### Вариант B: копирование папки (рекомендуется при разработке)

Скопируйте папку `editors/vscode` в
`%USERPROFILE%\.vscode\extensions\rza-0.3.0` (после `npm install`) и
перезапустите VS Code — клиент ищет сервер как `server/rez3-lsp.js`
внутри папки расширения.

Симлинк папки `editors/vscode` в `.vscode/extensions` тоже работает.
При установке вне дерева проекта задайте `rez3.transpilerPath` —
иначе сервер не найдёт `rez3asm.exe` по пути по умолчанию.

## Возможности

- Диагностика по сохранению и по набору (debounce 300 мс), severity Error,
  source `rez3asm`, code = правило (I1, I2, I3, I4, DECAY, DUP, STRUCT, SCOPE).
- Подсветка: комментарии `;`, три группы ключевых слов (владение / ALU /
  поток), регистры `%r0`–`%r15`, метки, числа, `field`, медиаторы `*_m`.

Ограничение: completion, hover, go-to-definition не реализованы —
только диагностика и подсветка.

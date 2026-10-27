# REZ3-ASM — расширение для VS Code

Подсветка синтаксиса и диагностика (I1–I4, DECAY, DUP, STRUCT, SCOPE)
для файлов `.rza`. Диагностика выполняется транспайлером `rez3asm`
напрямую: LSP-сервер встроен в него (`rez3asm --lsp`, stdio) — Node.js
и временные файлы больше не нужны, текст документа проверяется чекером
из памяти.

## Структура

```
editors/vscode/
  package.json                    — манифест расширения
  client.js                       — точка входа (vscode-languageclient,
                                    запускает rez3asm.exe --lsp)
  language-configuration.json     — комментарий ";", скобки
  syntaxes/rza.tmLanguage.json   — TextMate-грамматика
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
   { "rez3.transpilerPath": "C:/Users/myski/projects/rza/rez3asm.exe" }
   ```
2. По умолчанию: `<папка расширения>/../../rez3asm.exe` — т.е.
   `rza/rez3asm.exe`, если расширение установлено из дерева проекта.

Изменение настройки применяется после перезапуска окна VS Code
(сервер стартует вместе с расширением).

Транспайлер — `rez3asm.exe` (C3 0.8.5).
Собрать: `c3c compile rez3asm.c3 lsp_server.c3 -o rez3asm` в `rza/`
(выполняется автоматически шагом 0 в `run_tests.sh`).

## Установка расширения

### Вариант A: пакет .vsix

```sh
cd editors/vscode
npx @vscode/vsce package
```

Получится `rza-0.4.0.vsix`. Установка: `Ctrl+Shift+P` →
«Extensions: Install from VSIX…», либо
`code --install-extension rza-0.4.0.vsix`.

Сервер в .vsix не входит — им является сам транспайлер `rez3asm.exe`
(см. «Путь к транспайлеру» выше).

### Вариант B: копирование папки (рекомендуется при разработке)

Скопируйте папку `editors/vscode` в
`%USERPROFILE%\.vscode\extensions\rza-0.4.0` (после `npm install`) и
перезапустите VS Code — клиент запустит `rez3asm.exe --lsp` по путям
из раздела «Путь к транспайлеру».

Симлинк папки `editors/vscode` в `.vscode/extensions` тоже работает.
При установке вне дерева проекта задайте `rez3.transpilerPath` —
иначе клиент не найдёт `rez3asm.exe` по пути по умолчанию.

## Возможности

- Диагностика по набору (Full sync, синхронная валидация на каждое
  изменение), severity Error,
  source `rez3asm`, code = правило (I1, I2, I3, I4, DECAY, DUP, STRUCT, SCOPE).
- Подсветка: комментарии `;`, три группы ключевых слов (владение / ALU /
  поток), регистры `%r0`–`%r15`, метки, числа, `field`, медиаторы `*_m`.

Ограничение: completion, hover, go-to-definition не реализованы —
только диагностика и подсветка.

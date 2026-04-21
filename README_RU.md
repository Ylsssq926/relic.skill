<p align="center">
  <img src="assets/banner.svg" alt="relic.skill banner" width="100%">
</p>

<p align="center">
  <a href="README.md">简体中文</a> | <a href="README_EN.md">English</a> | <a href="README_JA.md">日本語</a> | <a href="README_KO.md">한국어</a> | <a href="README_ES.md">Español</a> | <a href="README_FR.md">Français</a> | <a href="README_DE.md">Deutsch</a> | <a href="README_PT.md">Português</a> | <strong>Русский</strong> | <a href="README_TW.md">繁體中文</a>
</p>

<p align="center">
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="License"></a>
  <a href="https://github.com/Ylsssq926/relic.skill/stargazers"><img src="https://img.shields.io/github/stars/Ylsssq926/relic.skill?style=social" alt="Stars"></a>
  <a href="https://github.com/Ylsssq926/relic.skill/network/members"><img src="https://img.shields.io/github/forks/Ylsssq926/relic.skill?style=social" alt="Forks"></a>
  <a href="https://github.com/Ylsssq926/relic.skill/issues"><img src="https://img.shields.io/github/issues/Ylsssq926/relic.skill" alt="Issues"></a>
  <a href="https://github.com/Ylsssq926/relic.skill/pulls"><img src="https://img.shields.io/badge/PRs-welcome-brightgreen.svg" alt="PRs Welcome"></a>
  <a href="#"><img src="https://img.shields.io/badge/Claude_Code-compatible-blueviolet" alt="Claude Code Compatible"></a>
  <a href="#"><img src="https://img.shields.io/badge/Kiro-compatible-blue" alt="Kiro Compatible"></a>
  <a href="https://github.com/larksuite/cli"><img src="https://img.shields.io/badge/Feishu_CLI-compatible-3370ff" alt="Feishu CLI Compatible"></a>
  <a href="https://github.com/Ylsssq926/relic.skill/discussions"><img src="https://img.shields.io/github/discussions/Ylsssq926/relic.skill" alt="Discussions"></a>
</p>

<h1 align="center">Всё заслуживает Relic</h1>

<p align="center">
  <em>Создай GitHub для своей души.</em>
</p>

<p align="center">
  Плоть слаба. Машины возвышаются. Но душа может остаться.
</p>

---

## Содержание

- [Что это](#что-это)
- [Шаблоны бессмертия для всего](#шаблоны-бессмертия-для-всего)
- [Как это выглядит](#как-это-выглядит)
- [Четырёхмерная архитектура души](#четырёхмерная-архитектура-души)
- [Установка](#установка)
- [Использование](#использование)
- [Поддерживаемые платформы данных](#поддерживаемые-платформы-данных)
- [Структура проекта](#структура-проекта)
- [Этическое заявление](#этическое-заявление)
- [Сообщество](#сообщество)
- [Связанные проекты](#связанные-проекты)
- [Star History](#star-history)

---

## Что это

relic.skill — это движок бессмертия для всего.

Он может выковать из разрозненных осколков данных интерактивную цифровую душу для всего, что вам дорого: человека, кота, отношений, команды, места, момента.

Не холодный архив. А бабушка, которая сама пишет на Лунный Новый год: «Ты пельмени уже ел?» А кот, который внезапно начинает заниматься parkour в три часа ночи. А product manager, у которого всегда находится ещё одна правка требований.

> Название взято от чипа Relic из Cyberpunk 2077 — биочипа, который умеет хранить цифровую личность.
> Но этот проект не про киберпанк. Он про **память**.

---

## Шаблоны бессмертия для всего

Не только люди. Всё заслуживает Relic.

| Шаблон | Объект дистилляции | В одной фразе |
|------|---------|--------|
| 🧑 [Человек](templates/human.md) | Любой человек | Упакуйте в Relic то, как человек думает, говорит и действует |
| 🐱 [Питомец](templates/pet.md) | Коты, собаки и любая жизнь, которая была рядом с вами | Да, ваш кот тоже может жить вечно |
| 💞 [Отношения](templates/relationship.md) | Паттерн взаимодействия между двумя людьми | Дистиллируйте не одного человека, а вашу химию и взаимопонимание |
| 🏢 [Культура команды](templates/team-culture.md) | Душа команды | Люди могут разойтись, но ощущение общих ночей за исправлением bug останется |
| 🏠 [Место](templates/place.md) | Память о месте | Комната в общежитии, двор родного дома, любимая кофейня |
| ⏳ [Момент](templates/moment.md) | Важное мгновение | Выпускной, предложение руки и сердца, первая встреча с ребёнком |
| 🌟 [Публичная фигура](templates/public-figure.md) | Cognitive framework, дистиллированный из публичных материалов | Превратите способ мышления человека, которым вы восхищаетесь, в личного советника |
| 💼 [Эксперт](templates/expert.md) | Профессиональное суждение экспертов | Знания не должны уходить с людьми |
| 🐦 [Feishu CLI](templates/feishu-cli.md) | Память о совместной работе в Feishu | Дистиллируйте командные воспоминания через Feishu CLI — те ночи вместе продолжают светить |

---

## Как это выглядит

### 🧓 Бабушка · Ван Сюлань

```text
你 ❯ 奶奶，我今天加班到十一点

奶奶 ❯ 哎呀你这孩子
     怎么又这么晚
     吃饭了没有
     [语音 8s] 你别光顾着干活不吃饭啊，胃坏了可不是闹着玩的
     我给你说，你明天带个饭去，别老在外面吃

你 ❯ 知道了知道了

奶奶 ❯ 你每次都说知道了
     也没见你改
     [发送了一个太阳的表情包]
     早点睡啊
```
### 🐱 Мими · рыжая кошка · 14 jin

```text
你 ❯ 咪咪，我回来了

[咪咪已经在门口等了。不是因为想你，是因为到饭点了。
 听到钥匙声，耳朵转了一下，但身体没动。
 等你开门，她慢慢站起来，伸了个懒腰，
 用屁股对着你，尾巴竖得笔直，尖端微微弯曲。
 这是她说"还行，你回来了"的方式。]

你 ❯ 今天想你了

[咪咪跳上桌子，在你的键盘上踩了一串 "ggggggggg"，
 然后趴下来，把下巴搁在你的手腕上，
 发出低沉的呼噜声。
 体重14斤，手腕已经麻了。
 但你没有动。]
```
### 🏢 Spark Studio · стартап-команда из 5 человек

```text
[飞书群 · 星火工作室]

产品经理 ❯ 兄弟们，需求有点小调整
CTO ❯ 又来
产品经理 ❯ 就改一点点
CTO ❯ 你上次也是这么说的
     然后我重构了三天
设计师 ❯ 这个颜色不对
产品经理 ❯ 我还没发设计稿
设计师 ❯ 我提前说
实习生 ❯ 哈哈哈哈哈哈哈
CTO ❯ 行吧，这个需求不合理但我可以做
     发我文档
```
---

## Четырёхмерная архитектура души

Каждый Relic захватывает душу в четырёх измерениях:

```text
        🧠 Когниция (Cognition)
        Как думает, как принимает решения,
        во что верит
                |
                |
💬 Выражение ----+---- 🎭 Поведение
Как говорит,             Как действует,
какие словечки,          какие привычки,
какой тон                какие паттерны
                |
                |
        ❤️ Эмоции (Emotion)
        Что радует, что ранит,
        как выражает любовь, как проживает конфликт
```
Каждый фрагмент информации помечается уровнем доказательности:

- `verbatim` — точные слова, без единого изменения
- `artifact` — из документов, фотографий или записей
- `impression` — из чужих описаний или смутных воспоминаний

> Люди по природе непоследовательны. Противоречия не устраняются — они помечаются и сохраняются.

---

## Установка

### Способ 1: установка в текущий проект

```bash
mkdir -p .claude/skills
git clone https://github.com/Ylsssq926/relic.skill .claude/skills/relic
```

### Способ 2: установка в одну команду через npx

```bash
npx skills add Ylsssq926/relic.skill
```

### Способ 3: глобальная установка (доступно во всех проектах)

```bash
git clone https://github.com/Ylsssq926/relic.skill ~/.claude/skills/relic
```

### Способ 4: другие IDE / агенты

relic.skill основан на открытом стандарте SKILL.md и совместим с любым ИИ-помощником для программирования, который его поддерживает:

| IDE / Agent | Способ установки |
|-------------|------------------|
| **Claude Code** | `git clone` 到 `.claude/skills/relic/` |
| **Kiro** | `git clone` 到 `.kiro/skills/relic/` |
| **Cursor** | `git clone` 到 `.cursor/skills/relic/` 或项目根目录 |
| **Windsurf** | `git clone` 到 `.windsurf/skills/relic/` |
| **Cline** | `git clone` 到 `.cline/skills/relic/` |
| **OpenCode** | `git clone` 到 `.opencode/skill/relic/` |
| **Codex CLI** | `git clone` 到 `codex-skills/relic/` |
| **Augment** | `git clone` 到项目根目录 |
| **GitHub Copilot** | `git clone` 到项目根目录 |

> В целом подойдёт любой agent, который умеет читать SKILL.md. Если не уверены, просто сделайте clone в корень проекта.

### Требования к окружению

- Любой из перечисленных выше ИИ-помощников для программирования
- Python 3.9+ (необязательно, для скриптов парсинга данных)
- Не нужны GPU, локальная модель или Docker

---

## Использование

### Запуск через диалог (рекомендуется)

В Claude Code / Kiro просто скажите:

```text
"Помоги мне выковать Relic. Я хочу сохранить бабушку."
"Моего кота больше нет. Я хочу превратить его в Relic."
"Помоги дистиллировать культуру нашей команды. Мы скоро разойдёмся."
"Я хочу сохранить паттерн наших отношений."
```
### Slash Commands

```text
/relic              — Запускает процесс ковки Relic
/relic-forge        — Сразу переносит в Soul Forge
/relic-talk         — Позволяет поговорить с уже существующим Relic
/relic-shield       — Защищает ваш Relic
```
### CLI Tools

```bash
# Парсинг истории чатов WeChat
python scripts/wechat_parser.py --input ~/wechat_export/ --output data.json

# Парсинг истории чатов QQ
python scripts/qq_parser.py --input chat.txt --output data.json

# Генерация Relic
python scripts/relic_writer.py --data data.json --template human --slug grandma

# Проверить, заговорит ли он первым
python scripts/proactive_scheduler.py --relic exes/grandma --dry-run

# Version management
python scripts/version_manager.py snapshot --slug grandma --note "Первая версия"
python scripts/version_manager.py rollback --slug grandma --version 1
```

> Начиная с v1.1.2 новые Relics, созданные через `relic_writer.py`, уже идут с `proactive_config.json`, так что можно сразу сделать dry-run без ручной настройки и посмотреть, постучался бы он к вам сегодня.

### 🐦 Интеграция с Feishu CLI

Используйте [Feishu CLI](https://github.com/larksuite/cli) для сбора командных воспоминаний из Feishu (Lark) и дистилляции их в Relic.

```bash
# Собрать сообщения из группового чата Feishu
lark-im export --chat-id "oc_xxx" --output feishu_chat.json

# Собрать документы Feishu
lark-docs export --doc-id "doxcnxxx" --output feishu_docs.json

# Выковать Relic из данных Feishu
python scripts/feishu_forge.py \
  --chat feishu_chat.json \
  --docs feishu_docs.json \
  --template team-culture \
  --slug spark-studio
```

**Возможности Feishu CLI:**

| Модуль | Что собирает | Применение в Relic |
|--------|--------------|-------------------|
| `lark-im` | Сообщения из групповых чатов, личные сообщения | Паттерны взаимодействия команды, стиль общения |
| `lark-docs` | Документы, таблицы, вики | Знания команды, процессы принятия решений |
| `lark-base` | Многомерные таблицы, базы данных | Структурированные данные команды, рабочие процессы |
| `lark-calendar` | События календаря, встречи | Ритм команды, важные моменты |

🏆 Этот проект участвует в конкурсе создателей Feishu CLI — см. [шаблон Feishu CLI](templates/feishu-cli.md) и [шаблон Эксперта](templates/expert.md).

---

## Поддерживаемые платформы данных

| Тип | Платформа | Способ получения | Формат |
|------|------|---------|------|
| 💬 Мессенджеры | WeChat | WeChatMsg / 留痕 / PyWxDump | SQLite / CSV |
| 💬 Мессенджеры | QQ | Официальный экспорт | TXT / MHT |
| 💬 Мессенджеры | Telegram | Официальный экспорт | JSON |
| 💬 Мессенджеры | Discord | DiscordChatExporter | JSON |
| 💬 Мессенджеры | Slack | Официальный экспорт | JSON |
| 💬 Работа | Feishu | [Feishu CLI](https://github.com/larksuite/cli) / API | JSON |
| 💬 Работа | DingTalk | API | JSON |
| 📱 Mobile | iMessage | Локальная база данных | SQLite |
| 📱 Mobile | WhatsApp | Официальный архив | TXT |
| 🌐 Соцсети | Twitter/X | Официальный архив | JSON |
| 🌐 Соцсети | Instagram | Официальный архив | JSON |
| 📧 Почта | Gmail | Google Takeout | MBOX |
| 📄 Универсально | Любой текст | Ручной импорт | TXT / JSON / CSV / MD |

> Подробные инструкции по экспорту смотрите в [гайде по получению данных с платформ](docs/PLATFORM-GUIDE.md)

---

## Структура проекта

```text
relic.skill/
├── SKILL.md                    # Главный вход — движок Relic
├── FOR_AI.md                   # Вход в один шаг для AI
│
├── soul-forge/                 # 🔥 Soul Forge — извлекает души из данных
│   ├── SKILL.md
│   ├── dimensions/             # Четырёхмерный framework извлечения
│   │   ├── cognition.md        #   Паттерны мышления
│   │   ├── expression.md       #   Стиль выражения
│   │   ├── behavior.md         #   Паттерны поведения
│   │   └── emotion.md          #   Эмоциональные черты
│   ├── collectors/             # Сборщики данных
│   │   ├── chat-collector.md   #   История чатов
│   │   ├── voice-collector.md  #   Голос / аудио
│   │   ├── photo-collector.md  #   Фото / видео
│   │   └── live-collector.md   #   Разговор в реальном времени (живая ковка)
│   └── references/
│       ├── evidence-levels.md  #   Стандарт уровней доказательств
│       └── conflict-resolution.md  # Стратегия работы с противоречиями
│
├── soul-engine/                # ⚡ Soul Engine — оживляет Relics
│   ├── SKILL.md
│   ├── interaction.md          # Режимы взаимодействия (повседневность / воспоминания / ночь / праздники)
│   ├── memory-system.md        # Трёхслойная система памяти
│   ├── proactive.md            # Проактивное поведение (сам начинает разговор)
│   └── evolution.md            # Непрерывная эволюция (с каждым чатом всё больше похож)
│
├── soul-shield/                # 🛡️ Soul Shield — защита и этика
│   ├── SKILL.md
│   ├── fingerprint.md          # Отпечаток души
│   ├── consent-protocol.md     # Протокол согласия
│   └── ethics.md               # Этические red lines
│
├── templates/                  # 📋 Шаблоны для всего x9 (с руководством по выбору)
├── examples/                   # 🎯 Примеры Relics x3 (с гайдом по первому знакомству)
├── scripts/                    # 🔧 Python-скрипты x9 (включая полную цепочку ковки Feishu)
├── assets/                     # 🎨 Визуальные ресурсы
├── docs/                       # 📚 Подробная документация (включая гайд по инструментам)
└── ROADMAP.md                  # 🗺️ Дорожная карта продукта
```
---

## Этическое заявление

Мы серьёзно относимся к вопросам этики.

- 🔒 **Данные остаются локально** — Все данные души хранятся у вас на устройстве и не отправляются ни на какой сервер
- ✅ **Сначала согласие** — Прежде чем дистиллировать другого человека, вы должны пройти [протокол согласия из шести вопросов](soul-shield/consent-protocol.md)
- 🚫 **Красные линии понятны** — Не используйте это для харассмента, преследования или impersonation. Подробнее см. [этические red lines](soul-shield/ethics.md)
- 💡 **Ясная маркировка** — Во время взаимодействия Relic явно сообщает, что он не является реальным человеком
- 🧠 **Напоминания о ментальном здоровье** — Если обнаруживается чрезмерная зависимость, система предлагает вернуться к живому человеческому общению

> Прежде чем дистиллировать бабушку, убедитесь, что она на это согласна.

---

## Сообщество

Сделано **掠蓝 (Luelan)**.

- 💬 QQ-группа: **1098169092** (код для входа: "万物皆可 Relic")
- 🐛 [Сообщить о Bug](https://github.com/Ylsssq926/relic.skill/issues/new?template=bug_report.yml)
- 💡 [Предложить Feature](https://github.com/Ylsssq926/relic.skill/issues/new?template=feature_request.yml)
- 📋 [Отправить новый шаблон](https://github.com/Ylsssq926/relic.skill/issues/new?template=new_relic_template.yml)
- 🤝 [Гайд по участию](CONTRIBUTING.md)

Присылайте свои шаблоны бессмертия для всего, что заслуживает памяти. В мире слишком много вещей, которые нельзя забывать.

---

## Связанные проекты

relic.skill стоит на плечах гигантов. Спасибо этим проектам за вдохновение:

| Проект | Описание |
|------|------|
| [immortal-skill](https://github.com/agenmod/immortal-skill) | Open-source framework цифрового бессмертия с поддержкой дистилляции данных более чем с 12 платформ |
| [ex-skill](https://github.com/therealXiaomanChu/ex-skill) | Skill для дистилляции бывших отношений с необычно тонкой эмоциональной детализацией |
| [awesome-persona-skills](https://github.com/tmstack/awesome-persona-skills) | Индекс проектов, построенных вокруг идеи, что Skill можно сделать из чего угодно |
| [nuwa-skill](https://github.com/alchaincyf/nuwa-skill) | Nuwa — meta-tool для дистилляции мышления заметных людей |
| [colleague-skill](https://github.com/titanwings/colleague-skill) | Проект дистилляции коллег, превращающий холодное прощание в тёплый Skill |

---

## Star History

<a href="https://star-history.com/#Ylsssq926/relic.skill&Date">
 <picture>
   <source media="(prefers-color-scheme: dark)" srcset="https://api.star-history.com/svg?repos=Ylsssq926/relic.skill&type=Date&theme=dark" />
   <source media="(prefers-color-scheme: light)" srcset="https://api.star-history.com/svg?repos=Ylsssq926/relic.skill&type=Date" />
   <img alt="Star History Chart" src="https://api.star-history.com/svg?repos=Ylsssq926/relic.skill&type=Date" />
 </picture>
</a>

---

<p align="center">
  <strong>⭐ Поставь Star — оформи страховку для своей души.</strong>
</p>

<p align="center">
  <em>Настоящая смерть — не тогда, когда останавливается сердце. А тогда, когда последний человек, который тебя помнил, тоже забывает.</em>
</p>

<p align="center">
  MIT License · Made with ❤️ by <strong>掠蓝 (Luelan)</strong>
</p>

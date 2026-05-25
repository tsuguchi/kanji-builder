---
published: false
---

# Store copy — Kanji Builder

App Store / Google Play 提出用のテキストドラフト。**英語をプライマリ**、日本語はローカライズ用。

各 field の **文字数制限**を超えていないかは提出時に再確認すること。本ファイルは草稿で、ストア入稿時に微調整する想定。

---

## 1. App name

|                               | EN              | JA              |
| ----------------------------- | --------------- | --------------- |
| App Store Name (30 char)      | `Kanji Builder` | `Kanji Builder` |
| Play Store App name (30 char) | `Kanji Builder` | `Kanji Builder` |

英語表記で統一。日本語ストアでも英字アプリ名は許容範囲かつブランドの一貫性が保てる。

---

## 2. Subtitle (App Store, 30 char) / Short description (Play Store, 80 char)

### EN

- **Subtitle**: `Build kanji from radicals.`
- **Short description**: `Build kanji from radicals, then words from kanji. Offline JLPT N5–N1 puzzle app.`

### JA

- **Subtitle**: `部首から漢字を組み立てる。`
- **Short description**: `部首から漢字、漢字から単語へ。JLPT N5〜N1 対応のオフライン漢字パズル。`

---

## 3. Description / Full description (App Store 4000 char / Play 4000 char)

### EN

```
Kanji Builder turns Japanese kanji study into a hands-on puzzle.

▼ Three layers, one loop
- Drag radicals together to build a kanji (木 + 木 = 林).
- Drag kanji together to build a word (学 + 生 = 学生).
- Solve more — the app remembers what you've learned and brings each
  one back at exactly the right interval.

▼ JLPT N5 to N1
- 2,200+ kanji from KANJIDIC2, mapped to modern JLPT N5–N1 levels.
- ~6,900 vocabulary words, filtered to those that contain at least one
  kanji you're learning.
- Switch JLPT level any time — Stages remembers your choice.

▼ Spaced repetition that respects your time
- WaniKani-style 8-stage SRS scheduling, kept separate for kanji and
  for words.
- Reviews surface only what's actually due.
- Daily and streak counts to keep momentum without nagging.

▼ Private by default
- Everything stays on your device — no accounts, no servers, no ads.
- No network permission requested. Works fully offline.
- Suitable for use by children.

Built for foreign Japanese learners by an independent developer.
Source data: KANJIDIC2 (CC BY-SA 4.0), KRADFILE, davidluzgouveia/kanji-data
(MIT), jamsinclair/open-anki-jlpt-decks (MIT).
```

### JA

```
Kanji Builder は、漢字学習を「組み立てるパズル」にしたアプリです。

▼ 3 段構成のコアループ
- 部首をドラッグして漢字を組み立てる (木 + 木 = 林)
- 漢字をドラッグして単語を組み立てる (学 + 生 = 学生)
- 解いた漢字や単語は、忘れた頃にちょうどよく復習に出てきます

▼ JLPT N5 〜 N1 対応
- KANJIDIC2 由来の 2,200+ 漢字を、JLPT N5–N1 にマッピング
- 漢字を含む単語 約 6,900 語を収録
- レベル切替はいつでも可能、選んだレベルは記憶されます

▼ 時間を奪わない SRS
- WaniKani 風の 8 段階スペーシング (漢字と単語で別管理)
- レビュー画面には今やるべきものだけが並びます
- 今日の解いた数 / 連続日数を控えめに表示

▼ プライバシー重視
- すべて端末内で完結 (アカウント・サーバー・広告なし)
- ネットワーク権限を要求しません。完全オフライン動作
- お子様の利用にも適しています

外国人日本語学習者を対象に、個人開発者が作っています。
出典: KANJIDIC2 (CC BY-SA 4.0)、KRADFILE、davidluzgouveia/kanji-data
(MIT)、jamsinclair/open-anki-jlpt-decks (MIT)
```

---

## 4. Keywords (App Store only, 100 char comma-separated)

### EN

```
kanji,JLPT,japanese,learn japanese,vocabulary,radicals,SRS,study,N5,N4,N3,N2,N1,jouyou,puzzle
```

(検索の重複は無駄になるので、"kanji" を name に含めれば description で連呼する必要はない。Apple は name と description の中の語も自動的にインデックスする)

### JA

```
漢字,JLPT,日本語学習,語彙,部首,SRS,N5,N4,N3,N2,N1,常用漢字,パズル
```

---

## 5. What's New (リリースノート、各バージョンで書き換え)

### v0.1.0 (initial release)

```
First release.
- Drag-and-drop radical → kanji and kanji → word puzzles
- WaniKani-style spaced repetition
- JLPT N5–N1 (2,200+ kanji, ~6,900 words)
- Fully offline, no accounts, no ads
```

```
初回リリース。
- 部首 → 漢字、漢字 → 単語のドラッグ&ドロップパズル
- WaniKani 風のスペース反復学習
- JLPT N5〜N1 (2,200+ 漢字、約 6,900 単語)
- 完全オフライン・アカウント不要・広告なし
```

---

## 6. Category

|            | Primary   | Secondary |
| ---------- | --------- | --------- |
| App Store  | Education | Reference |
| Play Store | Education | (none)    |

審査側に「ゲーム要素」を誤解されないよう Reference / Education に倒す。Educational Games のサブカテゴリは付けない (Apple 審査での年齢区分強化を避ける)。

---

## 7. Age rating

- **Apple App Store**: 4+
- **Google Play**: Everyone
- **理由**: No advertising / No in-app social / No data collection / No unrestricted web access

---

## 8. Support / Marketing URL

| Field                | URL (TBD)                                                                    |
| -------------------- | ---------------------------------------------------------------------------- |
| Support URL          | _要決定 — GitHub Issues or 専用メール宛先_                                   |
| Marketing URL        | (任意) リポジトリ README or LP                                               |
| Privacy Policy URL   | `https://tsuguchi.github.io/kanji-builder/privacy` _(GitHub Pages 有効化後)_ |
| Terms of Service URL | `https://tsuguchi.github.io/kanji-builder/terms` _(同上)_                    |

---

## メモ — 提出時の最終確認

- [ ] 文字数制限を超えていないか各 field 毎に確認 (Apple は 1 文字オーバーで弾く)
- [ ] EN / JA で機能の **記述に差分が無い** (Apple は metadata 整合性を見る)
- [ ] スクリーンショットに出ているテキストと description が **矛盾しない**
- [ ] What's New が「マーケティング文」ではなく具体的な変更点 (Apple が嫌う pattern)
- [ ] Keywords に **競合アプリ名 / 第三者商標** を入れていないか (rejection 直行)

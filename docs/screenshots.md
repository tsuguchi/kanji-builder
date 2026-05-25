---
published: false
---

# Screenshots — capture plan

App Store / Google Play 提出用スクリーンショットの **撮影計画と入稿方針**。実際の画像ファイルは `docs/screenshots/` 以下 (まだ作成していない) に置く想定で、本ファイルは要件と手順の見取り図に絞る。

---

## 1. ストア要件

### iOS (App Store Connect)

Apple は **iPhone 6.9" / 6.5" / 6.7"** のいずれか 1 セットを提出 (必須は 6.9"、他は任意で別 displays もサポートする場合)。

| Display         | Resolution (portrait)     | 枚数  | 例                             |
| --------------- | ------------------------- | ----- | ------------------------------ |
| iPhone 6.9"     | 1320 × 2868               | 3〜10 | iPhone 16 Pro Max              |
| iPhone 6.7"     | 1290 × 2796               | 3〜10 | iPhone 14/15 Pro Max           |
| iPhone 6.5"     | 1242 × 2688 / 1284 × 2778 | 3〜10 | iPhone 11 Pro Max / 15 Pro Max |
| iPad 13" (任意) | 2064 × 2752               | 3〜10 | iPad Pro M4                    |

→ **撮影は手元の実機 (1290 × 2796 = 6.7") を主とする**。Apple 側で 6.9" / 6.5" にスケーリング許容 (1 set を再利用可能)。

### Android (Google Play Console)

| 種別                | Resolution                                   | 枚数 | 必須                       |
| ------------------- | -------------------------------------------- | ---- | -------------------------- |
| Phone               | 1080 × 1920 以上 (推奨 1080 × 2400 portrait) | 2〜8 | ✓                          |
| 7" Tablet           | 1024 × 600 以上                              | 1〜8 | (任意)                     |
| 10" Tablet          | 1280 × 800 以上                              | 1〜8 | (任意)                     |
| **Feature graphic** | **1024 × 500 (横長)**                        | 1    | ✓ (ストアカードに使われる) |

iOS スクショ (1290 × 2796) を Phone 用にそのまま流用可能 (Play は **最低解像度を満たせば縦長 OK**)。

---

## 2. 撮影シーン (5–7 枚案、順序が表示順)

| #        | シーン                                                                                              | 訴求                           | 必要状態                                      |
| -------- | --------------------------------------------------------------------------------------------------- | ------------------------------ | --------------------------------------------- |
| 1        | **Onboarding slide 1** "Build kanji from radicals" + 木+木→林 visual                                | 何のアプリか 0.5 秒で伝える    | 初回起動 (AsyncStorage クリア)                |
| 2        | **Stages 一覧** N5 selected、5/79 cleared、"3 kanji · 2 words today · 1-day streak"、Reviews CTA 赤 | コア UI と SRS の存在          | 数日プレイした体 (PR #34/#35 のデータでも可)  |
| 3        | **Stage 詳細** 「学」kanji ヒーロー + radicals chip + Words list (✓ 付き)                           | 学習文脈の豊かさ               | 学を解いた後                                  |
| 4        | **BuildSection 解答後** 「林」を 木+木 で完成、✓ Correct! banner 緑                                 | drag&drop ゲーム性             | パズル解いた瞬間                              |
| 5        | **Reviews 画面** kanji + word の混在 list、複数 Due                                                 | SRS の動線                     | Due が複数ある状態 (時間操作 or 多めにプレイ) |
| 6        | **Word puzzle** 「学生」の puzzle 解答後 (がくせい / student / 学 + 生)                             | 単語パズルも面白い             | 単語パズル中                                  |
| 7 (任意) | **Settings + About 抜粋**                                                                           | プライバシー第一の主張、信頼感 | Settings 画面                                 |

最低 3 枚で提出可、5 枚あれば十分、7 枚目は任意。

---

## 3. 撮影方法

### おすすめ: iOS Simulator (Xcode) + 既存の EAS preview build

最終的な見え方を再現するには **アプリアイコン (「漢」赤) + production splash が反映された build** で撮るのが正確。EAS preview build を実機 install したらそこで撮影、もしくは Simulator に install。

#### A. 実機 (iPhone) で撮る

1. EAS preview build を Apple TestFlight 経由で実機 install
2. 実機で各シーンを開いて 物理ボタン (Side + Volume Up) で screenshot
3. iCloud 同期 or AirDrop で macOS / Windows に転送
4. 解像度を確認 (iPhone 15 Pro Max なら 1290 × 2796 で撮れる、iPhone 13 mini なら 1080 × 2340 で **Apple 提出には足りない** → Simulator 推奨)

#### B. iOS Simulator (要 Mac)

Apple 提出用の **正規 device size に確実に揃えたい** ときは Simulator。Mac が必要なため、Windows 開発者の本プロジェクトでは現実的でない。EAS Build をクラウドで回しているのと同じ理由で、Mac 不要のフローを優先するなら A 案 (実機)。

#### C. Expo Go (現状の dev 環境)

開発中に **ラフなスクショ** を撮る用途では十分。ただし:

- アプリアイコンが Expo Go のもの
- splash が Expo Go のもの
- Onboarding (シーン 1) の見え方は問題なし、他も「内容は正しく見える」

→ **シーン 2〜7 は Expo Go でも実用範囲のスクショが撮れる**。シーン 1 は EAS build がベターだが、Expo Go 上でも内容は確認可能。

---

## 4. 撮影前の状態作り

シーン 2 / 3 / 5 はある程度プレイした状態が必要。clean install からだと「0/79 cleared」になってしまい説得力に欠ける。

### A. 既存の進捗を使う

PR #34 / #35 のデバッグセッションで蓄積した数語の進捗を流用。`__DEV__` モードで `forceOverwrite: false` にすれば残るはず。

### B. デモ用シードを 1 回流す

Settings → Reset all progress でクリアしてから、Stage 詳細でいくつか手動で解く。デモ向けに「5/79 cleared、3 today」程度の数値を作る。

---

## 5. Feature graphic (Android、1024 × 500)

ストアカード上部に大きく表示される横長画像。シンプルな案:

```
┌─────────────────────────────────────────────┐
│                                             │
│         ┌─┐       ┌─┐       ┌─┐             │
│         │木│  +  │木│  →   │林│            │
│         └─┘       └─┘       └─┘             │
│                                             │
│   Build kanji from radicals.                │
│                                             │
└─────────────────────────────────────────────┘
```

scripts/06_generate_icons.py のフォント描画ロジックを流用して PIL で生成可能。本ファイルとは別の PR で `scripts/07_generate_feature_graphic.py` を切り出す想定。

---

## 6. ファイル命名 / 配置 (将来)

```
docs/screenshots/
├ ios/
│  ├ 01_onboarding.png        (1290 × 2796)
│  ├ 02_stages.png
│  ├ 03_stage_detail.png
│  ├ 04_buildsection_solved.png
│  ├ 05_reviews.png
│  ├ 06_word_puzzle.png
│  └ 07_settings_about.png    (optional)
├ android/
│  ├ 01_onboarding.png        (1080 × 2340 or larger)
│  └ ... (同様)
└ feature_graphic.png         (1024 × 500)
```

`docs/screenshots/` は `docs/_config.yml` の exclude に追加して GitHub Pages では公開しない (バイナリアセットなので)。

---

## 7. 入稿時の流れ

1. App Store Connect → My Apps → Kanji Builder → iOS App → 1.0 Prepare for Submission → Screenshots → 6.7" を選択 → 上記 PNG を順序通りドロップ
2. Google Play Console → Production → Store listing → Graphics → Phone screenshots → 同様にドロップ + Feature graphic
3. EN / JA 両言語の Listing がある場合、両方に同じスクショを設定 (テキスト overlay を入れた場合は言語別に作る)

---

## 8. オーバーレイテキストの判断

ストアスクショに「KEY FEATURE」「BUILD KANJI FROM RADICALS」のような **マーケティングテキスト** を画像上に乗せるかどうか。

- 入れる: 競合の Anki / Wanikani 系もみんなやっている、スクロール中の visibility 向上
- 入れない: 純粋な UI スクショ、Apple/Google のレビュー側に「実機状態と乖離」と取られるリスクが低い

→ **MVP の初回入稿は素のスクショで OK**。後でデータが取れたら overlay 版を作ってリプレース。

---

## メモ

- スクショの解像度は Apple/Google 両側で厳密にチェックされる。1 px ずれてもアップロード時に弾かれる
- iOS 6.9" を 1 セット作っておくと、現行の 6.7" / 6.5" devices 用の表示にも自動でスケーリングされる (1 set 投稿で複数 devices をカバー可能)
- スクショ撮影は **production 直前** の build で行う。preview build で撮ったあと UI 変更したら撮り直し
- EAS production build と同じバージョンでスクショを撮ること (バージョン不整合は審査 reject 直行)

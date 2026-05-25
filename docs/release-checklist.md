---
published: false
---

# Release checklist — Kanji Builder

App Store / Google Play 提出までに必要な実務作業を **領域ごとのチェックリスト** にまとめたもの。コード作業はおおむね完了しているため、ここから先は **アカウント登録 / ビルド配布 / 申請書類** が中心になる。

詳しい手順は各項目末尾の公式ドキュメントを参照する前提で、本ファイルは「やること」「成果物」「ブロッカー判定」のみに絞っている。

---

## 1. アカウント / 課金準備

これが無いと提出自体できないので最初に着手する。承認に数日〜数週間かかるものがある。

- [ ] **Apple Developer Program** に登録 (個人 / 法人どちらか) — 年 $99
  - 個人登録 + 2 段階認証必須
  - Apple ID で申込み → 支払い → 24〜48 時間で承認
  - ドキュメント: https://developer.apple.com/programs/enroll/
- [ ] **Google Play Developer Console** に登録 — 一回 $25
  - 本人確認書類 (運転免許証 / マイナンバーカード等) 提出
  - 承認に 1〜2 営業日
  - ドキュメント: https://play.google.com/console/u/0/signup
- [ ] **EAS (Expo Application Services)** アカウント / プラン確認
  - Free tier は月 30 ビルドまで。Hobby / Production プランへのアップグレード判断
  - 現在の projectId / owner は [app.json](../app.json) に登録済み
  - ドキュメント: https://expo.dev/pricing

---

## 2. アプリ仕上げ — コード

App Store / Google Play の提出前に **アプリ自体に最低限必要なもの**。

- [x] アプリアイコン (iOS / Android adaptive / monochrome / favicon / splash) — PR #36
- [x] Onboarding 画面 — PR #37
- [x] Settings 画面 (Replay / Reset / Version) — PR #38
- [x] エラー画面 (ErrorView + Try again) — PR #39
- [x] **利用規約 / プライバシーポリシー** 文面 + In-app About 画面リンク — PR #41
- [x] **About 画面** (Settings から遷移) — 利用規約 / プライバシーポリシー / ライセンス情報を表示 — PR #41
- [x] **GitHub Pages 有効化** — Terms / Privacy が公開 URL で取得可能
  - https://tsuguchi.github.io/kanji-builder/terms (200)
  - https://tsuguchi.github.io/kanji-builder/privacy (200)
  - internal docs (release-checklist / store-copy) は `published: false` で 404
- [ ] (任意) Sentry / Crashlytics 等の **error reporting**
- [ ] **本番ビルド時の `forceOverwrite: __DEV__` 確認** — production で false になっているか
  - 現状 [app/\_layout.tsx](../app/_layout.tsx#L34) で `__DEV__` 制御済み

---

## 3. EAS Build — preview / production

実機で iOS native 動作を初めて確認する段階。

- [ ] **`eas build -p ios --profile preview`** で TestFlight 配布可能なバイナリを作る
  - 初回は Apple のプロビジョニングプロファイル / 証明書を EAS にアップロード or 自動生成
  - ビルド時間: 15〜25 分
- [ ] **`eas build -p android --profile preview`** で APK 生成 (internal distribution)
- [ ] preview build を実機で実動作確認:
  - [ ] ホーム画面アイコンが「漢」表示
  - [ ] Onboarding flow (初回起動 → 3 slides → Get started → Stages)
  - [ ] コアループ全動作 (radical → kanji puzzle / kanji → word puzzle)
  - [ ] Settings reset で実際に進捗が消える
  - [ ] エラー時に ErrorView が機能する (DB 削除等の能動検証)
- [ ] `eas build -p ios --profile production` / `--profile android --profile production` — App Store / Play 提出用ビルド
- [ ] ドキュメント: https://docs.expo.dev/build/setup/

---

## 4. ストア提出書類 — 共通

iOS / Android 両方で要求される。

- [x] **アプリ名 / キャッチコピー / 説明文 / キーワード / カテゴリ / 年齢** のドラフト → [docs/store-copy.md](./store-copy.md) (PR #42)
- [ ] **連絡先メールアドレス** (サポート用) — 確定して store-copy.md に反映
- [x] **利用規約 URL** — `https://tsuguchi.github.io/kanji-builder/terms`
- [x] **プライバシーポリシー URL** — `https://tsuguchi.github.io/kanji-builder/privacy`

### GitHub Pages 公開手順 (一度だけ)

1. GitHub のリポジトリ画面で **Settings → Pages** を開く
2. **Source**: "Deploy from a branch" を選択
3. **Branch**: `main`、**Folder**: `/docs`、**Save**
4. 1〜2 分で初回ビルドが走り、ページ上部に公開 URL が表示される
5. `/terms` と `/privacy` にアクセスして表示確認
6. **store-copy.md** の URL placeholder を実 URL に更新する PR を出す (URL に差分があれば)

Jekyll 設定は [docs/\_config.yml](./_config.yml)。internal docs (release-checklist / store-copy) は frontmatter `published: false` で公開対象から除外している。

---

## 5. ストア提出書類 — iOS (App Store Connect)

- [ ] **App Privacy / Nutrition Label** — 収集するデータの自己申告
  - 現状: AsyncStorage / SQLite に **ローカルにのみ保存**、外部送信なし
  - 「Data Not Collected」で申請可能 (Sentry 入れた場合は要更新)
- [ ] **スクリーンショット** — 各 device size
  - iPhone 6.7" (1290 × 2796): 3 〜 10 枚
  - iPhone 6.5" (1242 × 2688 or 1284 × 2778): 3 〜 10 枚
  - (任意) iPad Pro 12.9" 6th gen (2048 × 2732): 3 〜 10 枚
  - **必須シーン**: Stages 一覧 / Stage 詳細 + パズル中 / Reviews 一覧 / Onboarding 一枚
- [ ] **App Preview (動画)** (任意) — 15〜30秒
- [ ] **Build を TestFlight にアップロード** → 内部テスト → 提出
- [ ] ドキュメント: https://developer.apple.com/help/app-store-connect/

---

## 6. ストア提出書類 — Android (Google Play Console)

- [ ] **Data safety** — Apple App Privacy 相当の申告
  - 同じく「データ収集なし」で申請可能
- [ ] **スクリーンショット** — 各サイズ
  - Phone: 1080 × 1920 以上、2 〜 8 枚
  - 7" Tablet (任意): 1024 × 600 以上
  - 10" Tablet (任意): 1280 × 800 以上
- [ ] **Feature graphic** — 1024 × 500 (ストアで横長カードとして表示)
- [ ] **AAB (Android App Bundle)** を Play Console にアップロード
- [ ] **Internal testing** → Closed testing → Production の段階リリース
- [ ] ドキュメント: https://support.google.com/googleplay/android-developer

---

## 7. 提出後 / 公開後

- [ ] 各ストアの審査ステータス監視 (iOS は 24〜72h、Android は数時間〜1日が目安)
- [ ] **Rejection 時の対応プロセス**
  - 多い rejection: 説明文が機能を正確に説明していない / メタデータ不一致 / プライバシー記述漏れ
- [ ] **Crash / レビュー監視** (初週は毎日確認)
- [ ] **ユーザーレビュー対応** (Apple / Google ともに返信可能)
- [ ] **段階的アップデートリリース** — bug 修正 / 機能追加時の patch リリース手順を確立

---

## 8. ブロッカー判定 — 「今出せるか?」

各セクションの **必須項目** を集約。すべて ✅ になればストア提出に進める。

| 領域                                          | 必須 | 状態            |
| --------------------------------------------- | ---- | --------------- |
| Apple Developer 登録                          | yes  | ⏳              |
| Google Play 登録                              | yes  | ⏳              |
| About 画面 (利用規約 / プライバシー リンク)   | yes  | ✅ PR #41       |
| 利用規約 / プライバシーポリシー 文面          | yes  | ✅ PR #41       |
| 利用規約 / プライバシーポリシー 公開 URL      | yes  | ✅ GitHub Pages |
| アプリ説明文 (日 + 英) ドラフト               | yes  | ✅ PR #42       |
| EAS production build (iOS / Android 各 1 回)  | yes  | ⏳              |
| スクリーンショット (iOS / Android 各 3 枚 〜) | yes  | ⏳              |

ここを満たした時点で App Store Connect / Google Play Console から提出可能。

---

## メモ

- スクリーンショット撮影は実機 (or iOS Simulator / Android Emulator) で撮るのが正確だが、Expo Snack の web preview でも代用可
- EAS Build 無料枠 30 build/月。試行錯誤期は preview profile を多用するので、production まで残しておく
- iOS の sandbox account を作っておくと TestFlight 配布時の挙動確認に便利
- 個人開発者の場合、Apple Developer 個人名で登録すると **ストア表示名がユーザーの本名** になる。気にする場合は屋号 / 法人化を検討

# UI/UX 設計仕様書

**バージョン**: 1.4
**作成日**: 2026-03-01
**更新日**: 2026-03-06

---

## 1. 概要

本システムのUI/UXは、ニールセンのユーザビリティヒューリスティクス、認知負荷理論、
Fitts's Law、ノーマンのデザイン原則に基づいて設計されている。

トップページ（ホーム画面）は Apple Human Interface Guidelines のビジュアルデザイン原則を
取り入れ、洗練されたビジュアル体験を提供する。

本仕様書では、各UI機能の設計意図と実装仕様を定める。

---

## 2. 全体構成

### 2.1 対象ファイル

| ファイル | 役割 |
|----------|------|
| `app_source.hta` | UI全体（CSS + HTML + クライアントJS） |
| `app_logic.js` | 共通ロジック（SQLビルダー等、UI非依存） |

### 2.2 画面遷移方式

CSS クラス切り替え方式。`showPage(pageId)` が `.page` 要素の `.active` を切り替える。
DOM は保持されるため、検索条件・結果はページ遷移後も維持される。

### 2.3 テーマ対応

3テーマ: デフォルト（深紺グラデーション）、ライト（`body.theme-light`）、ダーク（`body.theme-dark`）。
全UIコンポーネントは3テーマで正しく表示されること。

| テーマ | 背景 | テキスト色 | アクセント色 | 設計指針 |
|--------|------|-----------|-------------|---------|
| デフォルト | `linear-gradient(160deg, #0a1930 ... #142a50)` | `#fff` | `rgba(255,255,255,*)` | 深い紺のグラデーション |
| ライト | `#f5f5f7` | `#1d1d1f` | `#007aff` | Apple.com の背景色、SF系カラー |
| ダーク | `#000000` | `#f5f5f7` | `rgba(255,255,255,*)` | Apple Pure Black |

### 2.4 デザインシステム（Apple HIG 準拠）

v1.1 でトップページに適用。v1.3 で検索画面全体に Apple HIG 統一アップデートを適用。
v1.4 で許可・施設の詳細画面を B2 レイアウト化、カードレイアウト・縦タイムラインを導入。

#### 2.4.1 タイポグラフィ

| 要素 | font-weight | letter-spacing | 備考 |
|------|-------------|---------------|------|
| フォントファミリー | - | - | `-apple-system, 'Segoe UI', 'Yu Gothic UI', 'Meiryo UI', 'Helvetica Neue', sans-serif` |
| h1（ページタイトル） | 200 (Ultra Light) | -0.02em | Apple の大見出しスタイル |
| サブタイトル | 400 | 0.08em | `text-transform: uppercase`、控えめな `opacity: 0.5` |
| メニューボタン名 | 500 (Medium) | 0.02em | - |
| メニュー説明文 | 400 | - | `opacity: 0.5`、`font-size: 0.75em` |
| ダッシュボードラベル | 500 | 0.04em | `text-transform: uppercase` |
| ダッシュボード数値 | 300 (Light) | -0.02em | `font-size: 2.2em` |
| B2 タイトル | 700 | -0.025em | `font-size: 1.6em` |
| B2 行ラベル | 400 (0.9em) | - | `flex: 0 0 110px` |
| B2 行値 | 500 (0.9em) | - | `text-align: right` |

#### 2.4.2 角丸（Border Radius）

| 要素 | 値 | 備考 |
|------|-----|------|
| ロゴ | 20px | Apple のスクアークル（角丸四角形） |
| ダッシュボードカード | 16px | - |
| メニューボタン | 18px | - |
| 検索ボックス | 14px | frosted glass カード |
| 検索インプット/ボタン | 10px | 統一角丸 |
| データテーブル | 14px | - |
| B2 グループ | 14px | `.b2-group` |
| カード（許可・施設一覧） | 10px | `.facility-card` |
| 結果件数バナー | 10px | - |
| トースト通知 | 14px | - |
| モーダルダイアログ | 16px | - |
| ローディングスピナー | 18px | - |
| セグメンテッドコントロール（外側） | 10px | - |
| セグメンテッドコントロール（内側） | 8px | - |
| B2 ピル | 50px | `.b2-pill`（完全丸型） |
| 廃止入力欄 | 8px | `.b2-abolish-input` |

#### 2.4.3 マイクロインタラクション

全インタラクティブ要素に `transition` を適用。

| 要素 | transition | hover効果 |
|------|-----------|----------|
| メニューボタン | `all 0.3s cubic-bezier(0.25, 0.1, 0.25, 1)` | `translateY(-3px)` + `box-shadow` 拡大 |
| ダッシュボードカード | `all 0.3s cubic-bezier(0.25, 0.1, 0.25, 1)` | `translateY(-2px)` + 背景明度アップ |
| 検索バー | `all 0.2s ease` | `:focus` で背景・ボーダー変化 |
| 検索ボタン | `all 0.2s ease` | 背景明度アップ |
| セグメンテッドコントロール | `all 0.2s ease` | - |
| カード | `all 0.2s ease` | ボーダー `#007aff`、シャドウ拡大 |
| B2 アクション行 | - | 背景 `rgba(0,122,255,0.04)` |

イージング `cubic-bezier(0.25, 0.1, 0.25, 1)` は Apple の標準アニメーションカーブに準拠。

#### 2.4.4 シャドウ（Elevation）

ボーダーではなくシャドウで奥行きを表現する。

| テーマ | 通常状態 | hover状態 |
|--------|---------|----------|
| デフォルト | なし（半透明背景で分離） | `0 12px 32px rgba(0,0,0,0.25)` |
| ライト | `0 2px 12px rgba(0,0,0,0.06)` | `0 8px 28px rgba(0,0,0,0.12)` |
| ダーク | なし（半透明背景で分離） | `0 8px 24px rgba(0,0,0,0.4)` |

B2 グループ: `0 0.5px 1px rgba(0,0,0,0.05), 0 1px 3px rgba(0,0,0,0.06)`

#### 2.4.5 HTA 互換性の制約

HTA (MSHTML/Trident) エンジンの制約により、以下の Apple HIG 要素は代替手段で実装:

| Apple HIG 要素 | 制約 | 代替実装 |
|----------------|------|---------|
| `backdrop-filter: blur()` | 未サポート | `rgba()` 半透明背景で疑似的なガラス効果 |
| CSS Custom Properties | 未サポート | テーマ別に個別のCSSルールを定義 |
| SF Symbols | 未サポート | Unicode 絵文字で代替 |
| Vibrancy | 未サポート | 半透明背景 + ボーダーで視覚的分離 |
| flexbox `gap` | 未サポート | `> * + * { margin-left: Xpx; }` で代替 |

---

## 3. トップページ（ホーム画面）

**理論的根拠**: Apple HIG（明快さ・敬意・深み）、Nielsen H8（美的で最小限のデザイン）

### 3.1 目的

主要機能へ最短でアクセスできるランチャー画面。
スクロール不要で全要素がファーストビューに収まること（1080p + 150%スケーリングまで対応）。

### 3.2 設計原則

- **ファーストビュー完結**: 全メニューがスクロールなしで見える
- **垂直中央配置**: `.home-container` が `display: flex; justify-content: center` で画面中央に
- **状態の即時把握**: 統計サマリーストリップでシステム状況をワンビューで確認
- **機能グルーピング**: 「検索」「管理」の2グループに分類し、認知負荷を低減
- **黄金比スペーシング**: 余白を黄金比ベースで調整（header margin 26px、logo margin 12px、h1 margin 4px）

### 3.3 構成要素

| 順序 | 要素 | CSSクラス | 説明 |
|------|------|----------|------|
| 1 | ロゴ | `.logo` | 64x64px スクアークル（`border-radius: 18px`）、Unicode 📋 |
| 2 | タイトル | `h1` | 「廃棄物処理業許可管理」、`font-weight: 200` |
| 3 | サブタイトル | `.subtitle` | 「WASTE MANAGEMENT PERMIT SYSTEM」、uppercase |
| 4 | 統計ストリップ | `.stats-strip` | 事業者数・有効許可数・稼働施設数・期限1年以内の4指標 |
| 5 | 検索グループ | `.menu-group` > `.menu-grid.menu-grid-4` | 許可検索・施設検索・車両検索・役員検索（4列） |
| 6 | 管理グループ | `.menu-group` > `.menu-grid` | 事業者一覧・事業者登録・設定 |

### 3.4 統計サマリーストリップ

DB接続後に `loadDashboard()` が値をセットし、`display: none` → `inline-flex` で表示。

| 指標 | 要素ID | データソース | 警告条件 |
|------|--------|-------------|---------|
| 事業者 | `strip-biz` | `buildStatisticsQueries().businessCount` | なし |
| 有効許可 | `strip-permit` | `buildStatisticsQueries().permitCount` | なし |
| 稼働施設 | `strip-facility` | `buildStatisticsQueries().facilityCount` | なし |
| 期限1年以内 | `strip-expiring` | 期限内許可のCOUNT | 0件超でオレンジ色（`.stat-warn`） |

3テーマ対応:
- デフォルト: `rgba(255,255,255,0.08)` 背景
- ライト: `#fff` 背景 + `box-shadow`
- ダーク: `rgba(255,255,255,0.06)` 背景

### 3.5 メニューグルーピング

7ボタンを「検索」（4列）「管理」（3列）の2グループに分類。

**検索グループ** (`.icon-search`: 青系背景 `rgba(0,122,255,0.12)`、`.menu-grid-4` で4列)

| ボタン | アイコン | onclick | 説明テキスト |
|--------|---------|---------|-------------|
| 許可検索 | 📄 | `showPage('search-permit')` | 許可の検索・絞り込み |
| 施設検索 | 🏭 | `showPage('search-facility')` | 施設情報の検索 |
| 車両検索 | 🚚 | `showPage('search-vehicle')` | 車両情報の検索 |
| 役員検索 | 👤 | `showPage('search-officer')` | 役員情報の検索 |

**管理グループ** (`.icon-manage`: 緑系背景 `rgba(52,199,89,0.12)`)

| ボタン | アイコン | onclick | 説明テキスト |
|--------|---------|---------|-------------|
| 事業者一覧 | 📋 | `loadBusinessList()` | 登録事業者の一覧表示 |
| 事業者登録 | ➕ | `openBusinessForm(0)` | 新規事業者の登録 |
| 設定 | ⚙ | `showPage('settings')` | マスタ・テーマ設定 |

グループラベル: `.menu-group-label`（`font-size: 0.7em`、`opacity: 0.35`、`uppercase`）

### 3.6 通知バッジ

「許可検索」ボタン上に期限1年以内の許可件数を赤丸バッジで表示。

| 項目 | 値 |
|------|-----|
| 要素ID | `permitBadge` |
| 背景色 | `#ff3b30`（iOS赤） |
| border-radius | `9px` |
| 表示条件 | 件数 > 0 |
| 99件超 | "99+" と表示 |
| 0件 | `display: none` |

### 3.7 スタガードアニメーション

ホーム画面表示時にメニューボタンが順次フェードインするApple風演出。

- MSHTML は `@keyframes` 未サポートのため、JS `setTimeout` チェーンで実装
- 各ボタン初期状態: `.stagger-init`（`opacity: 0` + `translateY(8px)`）
- アニメーション後: `.stagger-show`（`opacity: 1` + `translateY(0)`）
- `transition: opacity 0.3s ease, transform 0.3s ease`
- 80ms基本遅延 + ボタンごと50ms追加（6ボタンで合計約380ms）
- `showPage("home")` および `window.onload` で `animateHomeEntrance()` を呼び出し

### 3.8 ファーストビュー確認（1080p 150%スケーリング）

| 要素 | 高さ |
|------|------|
| ロゴ + マージン | 76px |
| h1 + subtitle | 52px |
| ヘッダーマージン | 26px |
| 統計ストリップ + マージン | 52px |
| グループラベル + メニュー行1 | 72px |
| グループ間マージン | 10px |
| グループラベル + メニュー行2 | 72px |
| **合計** | **~360px** |

利用可能高さ ~680px に対して余裕あり。

### 3.9 削除した要素

| 要素 | 理由 | 代替手段 |
|------|------|---------|
| ダッシュボードカード | 統計ストリップに集約 | `.stats-strip` で軽量表示 |
| クイック検索バー | 各検索ページで十分 | 許可検索・施設検索の各ページに検索機能あり |
| セグメンテッドコントロール | 検索バーと連動で削除 | 同上 |
| 車両・役員検索メニュー (`page-search-menu`) | 不要な中間ページ | ホームから車両検索・役員検索に直接遷移（4ボタン化） |

---

## 4. ナビゲーション履歴スタック

**理論的根拠**: Nielsen H3（ユーザーの制御と自由）

### 4.1 目的

検索結果→詳細→戻る で、検索結果に正しく復帰できるようにする。
ハードコードされた戻り先ではなく、実際の遷移履歴に基づく動的な「戻る」を実現。

### 4.2 仕様

| 項目 | 値 |
|------|-----|
| スタック変数 | `navStack` (配列) |
| 最大サイズ | `NAV_STACK_MAX = 20` |
| 超過時の動作 | 古いエントリを `shift()` で削除 |
| 空の場合の動作 | `home` に遷移 |

### 4.3 showPage の動作

```
showPage(pageId, skipHistory):
  1. 現在のページのスクロール位置を savedScrollPositions に保存
  2. skipHistory が false の場合:
     - 現在のページをスタックに push
  3. ページ切り替え（.active クラス操作）
  4. パンくず更新
  5. skipHistory が true の場合:
     - 保存されたスクロール位置を復元
```

### 4.4 goBack の動作

```
goBack():
  1. formDirty が true の場合 → 未保存変更の確認ダイアログ
  2. スタックから pop
  3. showPage(popped, skipHistory=true) で遷移
  4. スクロール位置が復元される
```

### 4.5 変更された要素

全12箇所の「戻る」ボタンが `onclick="goBack()"` に統一。
`cancelBusinessForm()`, `cancelMasterForm()` も `goBack()` ベース。
旧 `previousPage` 変数は削除。

---

## 5. パンくずリスト

**理論的根拠**: Nielsen H1（システム状態の視認性）

### 5.1 目的

現在地を常に表示し、ユーザーの迷子を防ぐ。

### 5.2 構成データ

```javascript
PAGE_TITLES = { home: "ホーム", list: "事業者一覧", detail: "事業者詳細", ... }
PAGE_HIERARCHY = { "business-form": "list", master: "settings", ... }
```

### 5.3 表示ルール

| 画面タイプ | パンくず表示 |
|-----------|-------------|
| ホーム | 非表示 |
| トップレベル画面 | `ホーム > 現在のページ` |
| 子画面 | `ホーム > 親ページ > 現在のページ` |
| 詳細/フォーム | ナビスタックを参照し動的に構築 |

### 5.4 位置

画面上部に固定表示（`position: fixed`）。ステータスバーの上。

---

## 6. トースト通知

**理論的根拠**: ノーマンのデザイン原則（フィードバック）

### 6.1 目的

保存・削除などの操作成功時に、自動消去する軽量な通知を表示する。
`alert()` のモーダル中断を排除。

### 6.2 仕様

```javascript
showToast(message, type, duration)
```

| パラメータ | 型 | デフォルト | 説明 |
|-----------|-----|----------|------|
| message | string | - | 表示テキスト |
| type | string | "success" | "success" / "error" / "info" |
| duration | number | 3000 | 表示時間（ms） |

### 6.3 動作

1. `#toast-container` に要素を追加（`opacity: 0` → `opacity: 1` のフェードイン）
2. `duration` ms 後にフェードアウト（IE互換: JS で `opacity` を段階的に減算）
3. `opacity` が 0 になったら DOM から削除

### 6.4 使用箇所

| 操作 | type | メッセージ例 |
|------|------|-------------|
| 事業者保存 | success | "保存しました" |
| 事業者削除 | info | "削除しました" |
| 許可の廃止 | info | "廃止しました" |
| 許可の復活 | success | "復活しました" |
| 車両廃車 | info | "廃車にしました" |
| マスター保存 | success | "保存しました" |

---

## 7. 確認ダイアログ

**理論的根拠**: Nielsen H5（エラー防止）、Fitts's Law

### 7.1 共通関数

```javascript
showConfirmDialog(title, message, options)
```

| パラメータ | 型 | 説明 |
|-----------|-----|------|
| title | string | ダイアログタイトル |
| message | string | 確認メッセージ |
| options.okText | string | OKボタンテキスト（デフォルト "OK"） |
| options.okClass | string | OKボタンCSSクラス（デフォルト "btn-primary"） |
| options.onOk | function | OK押下時のコールバック |

ESCキーでキャンセル可能。

### 7.2 削除ボタンの分離

事業者詳細画面の「編集」と「削除」を `justify-content: space-between` で左右に分離。
削除ボタンは `opacity: 0.7` で視覚的に弱く、サイズも小さめに。

### 7.3 2段階 confirm

事業者削除は2段階の confirm ダイアログ:
1. 「この事業者を削除しますか？関連する許可・施設・車両・役員もすべて削除されます」
2. 「本当に削除しますか？この操作は取り消せません」

### 7.4 未保存変更の警告

| 変数/関数 | 役割 |
|----------|------|
| `formDirty` | boolean フラグ |
| `markFormDirty()` | フォーム入力時に true にする |
| `clearFormDirty()` | フォームオープン・保存時に false にする |
| `checkUnsavedChanges()` | true なら confirm ダイアログを表示 |

**対象フォーム**: 事業者フォーム（6入力要素）、マスター設定フォーム（2入力要素）

**チェックタイミング**: `goBack()`, `cancelBusinessForm()`, `cancelMasterForm()`

---

## 8. 検索状態の保持

**理論的根拠**: Nielsen H6（記憶より認識）

### 8.1 仕組み

DOM保持方式（CSS切り替え）により、検索条件・結果は自動的に保持される。
スクロール位置のみ手動保存・復元が必要。

### 8.2 スクロール位置

```javascript
savedScrollPositions = {}  // pageId -> scrollTop
```

- `showPage()` 遷移前に `document.documentElement.scrollTop` を保存
- `goBack()` 経由（`skipHistory=true`）で戻った場合、`setTimeout` で復元

---

## 9. 許可検索の段階的開示

**理論的根拠**: 認知負荷理論（段階的開示）

### 9.1 目的

7つ以上のフィルターを一度に表示せず、使用頻度に応じて段階的に開示する。

### 9.2 構成

| 領域 | 常時表示 | 内容 |
|------|---------|------|
| 基本 | はい | キーワード + 基準日 + 検索ボタン |
| 詳細フィルター | いいえ | 許可区分 / 期限状態 / 許可状態 / 優良認定 / 品目選択 |

### 9.3 トグルボタン

```
詳細フィルター ▼        ← 閉じた状態
詳細フィルター (3) ▲    ← 開いた状態（3件のフィルターが設定済み）
```

バッジ数は `getActiveFilterCount()` で動的に計算。閉じた状態でもバッジは表示される。

---

## 10. タブ件数バッジ

**理論的根拠**: Nielsen H1（システム状態の視認性）

### 10.1 目的

事業者詳細の各タブにデータ件数を表示し、切り替え前にデータの有無を把握可能にする。

### 10.2 カウントクエリ

| タブ | クエリ条件 | 意味 |
|------|----------|------|
| 許可 | `有効終了日時 IS NULL` | 現行バージョン数 |
| 施設 | `有効終了日時 IS NULL AND 廃止年月日 IS NULL` | 現在有効な施設数 |
| 車両 | 条件なし | 全車両数（廃車含む） |
| 役員 | 条件なし | 全役員数（退任含む） |

### 10.3 実装上の注意

- JET SQL は `COUNT(DISTINCT col)` を**サポートしない**。`COUNT(*)` を使用すること
- 各クエリは個別の `try-catch` で囲むこと（1つの失敗が他に波及しないよう）

---

## 11. 検索結果件数表示の統一

**理論的根拠**: Nielsen H4（一貫性と標準）

### 11.1 共通関数

```javascript
buildResultCountHtml(count, entityName, options)
```

| パラメータ | 説明 |
|-----------|------|
| count | 件数 |
| entityName | エンティティ名 |
| options.prefix | ヘッダー先頭テキスト |
| options.extraClass | 追加CSSクラス |

全検索画面（事業者/許可/施設/車両/役員）で統一されたパターンを使用。

---

## 12. B2 レイアウトシステム (v1.4)

**理論的根拠**: Apple HIG Settings スタイル、Nielsen H8（美的で最小限のデザイン）

### 12.1 目的

詳細画面（許可・施設）を iOS の Settings 風のグループ化されたリストで表現する。
情報を視覚的にグループ化し、アクション行で操作を自然に統合する。

### 12.2 CSS コンポーネント

#### ヘッダー

| クラス | 用途 | スタイル |
|--------|------|---------|
| `.b2-header` | 詳細ヘッダー | `margin-bottom: 24px` |
| `.b2-title` | メインタイトル | `font-size: 1.6em; font-weight: 700; letter-spacing: -0.025em` |
| `.b2-location` | サブ情報 | `font-size: 0.9em; color: #86868b; margin-top: 4px` |
| `.b2-badges` | バッジ行 | `display: flex` + `> * + * { margin-left: 8px }` |

#### ピル（状態バッジ）

| クラス | 背景 | テキスト色 | 用途 |
|--------|------|----------|------|
| `.b2-pill` | - | - | 基本（`border-radius: 50px; font-size: 0.78em; font-weight: 600`） |
| `.b2-pill-green` | `#e8f5e9` | `#1b7a2b` | 有効/稼働中 |
| `.b2-pill-gray` | `#f2f2f7` | `#6e6e73` | 廃止/失効 |
| `.b2-pill-blue` | `#e3f2fd` | `#0a5dc2` | 情報表示 |
| `.b2-pill-orange` | `#fff3e0` | `#c75000` | 期限間近 |
| `.b2-pill-red` | `#fce4ec` | `#c62828` | 取消 |
| `.b2-pill-amber` | `#fff8e1` | `#e65100` | 警告 |

#### グループ・行

| クラス | 用途 | スタイル |
|--------|------|---------|
| `.b2-group` | セクションカード | `background: #fff; border-radius: 14px; box-shadow; margin-bottom: 24px` |
| `.b2-row` | データ行 | `display: flex; padding: 13px 16px; border-bottom: 1px solid rgba(0,0,0,0.06)` |
| `.b2-row-label` | 行ラベル | `font-size: 0.9em; flex: 0 0 110px` |
| `.b2-row-value` | 行値 | `font-size: 0.9em; font-weight: 500; text-align: right; flex: 1` |

#### アクション行

| クラス | 用途 | テキスト色 |
|--------|------|----------|
| `.b2-action-row` | 通常アクション（編集・変更） | `#007aff` |
| `.b2-restore-row` | 復活アクション | `#34c759` |
| `.b2-destructive-row` | 危険アクション（廃止・取消） | `#ff3b30` |

#### 廃止・取消入力行

| クラス | 用途 |
|--------|------|
| `.b2-abolish-row` | 廃止/取消の日付・理由入力行 |
| `.b2-abolish-label` | ラベル（赤字） |
| `.b2-abolish-input` | 入力欄 |
| `.b2-abolish-btn` | 実行ボタン（赤背景） |

---

## 13. カードレイアウト (v1.4)

**理論的根拠**: Apple HIG カードパターン、情報密度の最適化

### 13.1 目的

許可一覧・施設一覧をテーブルからカードレイアウトに変更し、
各レコードの情報量を増やしつつ視認性を維持する。

### 13.2 CSS（`.facility-card`）

許可・施設の両一覧で共用。

| プロパティ | 値 |
|-----------|-----|
| 背景 | `#f8fafc`（ライト）/ `#1a2a40`（ダーク） |
| ボーダー | `1px solid #e2e8f0` |
| 角丸 | `10px` |
| hover | ボーダー `#007aff`、シャドウ `0 2px 8px rgba(0,122,255,0.1)` |

#### カード内部構造

| クラス | 用途 | スタイル |
|--------|------|---------|
| `.facility-card-header` | ヘッダー行 | `display: flex; align-items: center; > * + * { margin-left: 12px }` |
| `.facility-card-title` | タイトル | `font-weight: 600; font-size: 1em` |
| `.facility-card-sub` | サブテキスト | `font-size: 0.82em; color: #86868b` |
| `.facility-card-col-label` | セクションラベル | `font-size: 0.75em; color: #999; text-transform: uppercase; letter-spacing: 0.04em` |

### 13.3 許可一覧カード

```
┌─────────────────────────────────────────────────┐
│ [状態バッジ]  許可区分名  ★優良  許可番号  [詳細] │  ← ヘッダー行
│ 許可日: yyyy/mm/dd    有効期限: yyyy/mm/dd       │  ← 日付行
│ 取扱品目                                         │  ← ラベル
│ [品目バッジ] [品目バッジ] [品目バッジ] ...         │  ← 品目バッジ行
└─────────────────────────────────────────────────┘
```

### 13.4 品目バッジ

| クラス | 背景 | ボーダー | テキスト色 | 意味 |
|--------|------|---------|----------|------|
| `.item-badge.handling` | `#e3f2fd` | `#90caf9` | `#1565c0` | 〇（取り扱い） |
| `.item-badge.transfer` | `#e8f5e9` | `#a5d6a7` | `#2e7d32` | ◎（積替保管） |

### 13.5 施設一覧カード

```
┌──────────────────────────────────────────────────┐
│ [状態バッジ]  施設種別  [方法バッジ] [管理バッジ]  │  ← ヘッダー行
│ 所在地テキスト                           [詳細]   │  ← 所在地行
│ ┌────────────────────────────────────────┐        │
│ │ 品目 | 時間能力 | 日能力（処理能力表）   │        │  ← 中間処理施設のみ
│ └────────────────────────────────────────┘        │
│ 埋立容量: xxx m³  面積: xxx m²                    │  ← 最終処分場のみ
└──────────────────────────────────────────────────┘
```

処理能力テーブル: `.capacity-table`（コンパクト表示、品目名 `#2d5a87`、数値右寄せ）

---

## 14. 縦タイムライン (v1.4)

**理論的根拠**: 時系列情報の直感的な視覚化、ゲシュタルトの連続性の法則

### 14.1 目的

許可・施設の履歴を縦方向のタイムラインで表示し、
バージョン間の変更点を差分表示で明確にする。

### 14.2 CSS コンポーネント

| クラス | 用途 | スタイル |
|--------|------|---------|
| `.vtl` | コンテナ | `position: relative; padding-left: 32px; margin-bottom: 24px` |
| `.vtl-line` | 縦線 | `position: absolute; left: 13px; width: 2px; background: #dde4ec; top: 0; bottom: 0` |
| `.vtl-item` | 各エントリ | `position: relative; padding-bottom: 24px; padding-right: 100px` |
| `.vtl-dot` | 状態ドット | `position: absolute; left: -25px; top: 4px; width: 12px; height: 12px; border-radius: 50%; border: 2px solid #fff` |
| `.vtl-date` | 日付 | `font-size: 0.78em; font-weight: 600; color: #86868b` |
| `.vtl-content` | 内容テキスト | `font-size: 0.88em; color: #1d1d1f; line-height: 1.5` |
| `.vtl-change` | 変更差分 | `font-size: 0.82em; color: #86868b; margin-top: 2px` |
| `.vtl-change-old` | 旧値 | `color: #c62828; text-decoration: line-through` |
| `.vtl-change-new` | 新値 | `color: #1b7a2b; font-weight: 500` |
| `.vtl-actions` | 操作リンク | `position: absolute; right: 0; top: 2px; font-size: 0.82em` |
| `.vtl-edit` | 修正リンク | `color: #007aff; cursor: pointer` |
| `.vtl-delete` | 削除リンク | `color: #ff3b30; cursor: pointer` |

### 14.3 ドットの状態色

| クラス | 背景色 | 状態 |
|--------|--------|------|
| `.vtl-dot.active` | `#4CAF50` | 有効 |
| `.vtl-dot.expired` | `#90CAF9` | 期限切れ |
| `.vtl-dot.abolished` | `#9e9e9e` | 廃止 |
| `.vtl-dot.cancelled` | `#ef5350` | 取消 |

### 14.4 表示ルール

- バージョンは新しい順（DESC）で表示
- 各エントリ間の変更点を自動差分検出して表示（旧値: 取消線赤、新値: 緑太字）
- 操作リンク（修正・削除）は各エントリの右上に配置
- 許可・施設の両方で同一の VTL コンポーネントを使用

---

## 15. 許可タブの構成

**理論的根拠**: 段階的開示、ゲシュタルト近接の法則、Nielsen H2/H6

### 15.1 目的

許可タブ内のビューを整理し、情報の階層構造を明確にする。
「詳細」=閲覧、「編集」=変更というユーザーの期待に一致させる。

### 15.2 画面遷移フロー

```
許可一覧（カードレイアウト）
  ├── [+ 許可追加] → 許可追加フォーム → [保存/キャンセル] → 一覧に戻る
  │
  └── [詳細] → 許可詳細ビュー（B2 レイアウト）
                  ├── B2 ヘッダー: 許可区分名 + ピル（状態・優良・期限）
                  ├── 基本情報グループ（B2 行: 許可番号/日付/有効期限）
                  │     └── [修正] アクション行 → 編集フォーム
                  ├── 取扱品目セクション（インライン、クリック切替可能）
                  ├── 状態・ライフサイクルグループ
                  │     ├── [廃止/取消] 入力行（日付・理由・実行ボタン）
                  │     └── [復活] アクション行
                  ├── 履歴セクション（縦タイムライン + 差分表示）
                  │     ├── VTL タイムライン（各バージョン修正・削除可能）
                  │     └── [更新/変更] アクション行 → フォーム
                  └── タイムラインバー（2バージョン以上の場合）
```

### 15.3 許可一覧カード

カードレイアウト（§13.3 参照）。各カードに以下を表示:

| 要素 | 内容 |
|------|------|
| 状態バッジ | 有効/取消/廃止/期限切れ/期限間近 |
| 許可区分名 | カードタイトル |
| 優良認定 | ★ 優良 バッジ（該当時） |
| 許可番号 | サブテキスト |
| 許可日/有効期限 | 日付行 |
| 取扱品目 | 品目バッジ（§13.4）で〇/◎品目を表示 |
| 詳細ボタン | カードヘッダー右端 |

### 15.4 許可詳細ビュー（B2 レイアウト）

`showPermitDetail(permitId, logicalId, businessId)` が B2 レイアウトで描画。

#### ヘッダー（`.b2-header`）

- タイトル: 許可区分名
- ピル: 状態（有効/廃止/取消/期限切れ）、優良認定、期限情報

#### 基本情報グループ

| B2 行 | 内容 |
|--------|------|
| 許可番号 | テキスト |
| 許可年月日 | yyyy/mm/dd |
| 許可有効年月日 | yyyy/mm/dd |
| アクション行 | 「修正」（`.b2-action-row`） |

#### 取扱品目セクション

`loadPermitItemsInline(permitId, targetId)` でインライン描画。

- 全品目を横一列に表示（縦書きヘッダー）
- ◎ = 積替保管、〇 = 取り扱い、× = なし
- クリックで × → 〇 → ◎ → × のサイクル

#### 状態・ライフサイクルグループ

有効な許可の場合:
- 廃止入力行: 日付 + 理由入力 + 「廃止」ボタン（`.b2-abolish-row`）
- 取消入力行: 日付 + 理由入力 + 「取消」ボタン（`.b2-abolish-row`）

廃止/取消済みの場合:
- 廃止/取消情報の B2 行表示
- 復活アクション行（`.b2-restore-row`）

#### 履歴セクション

- 縦タイムライン（§14）でバージョン履歴を表示
- 各バージョンに「修正」「削除」リンク
- 更新アクション行 + 変更アクション行

### 15.5 許可編集フォーム（統合型）

`showPermitEditForm(permitId, logicalId, businessId, mode)` で3モードを統合。

| モード | トリガー | 動作 |
|--------|---------|------|
| `"edit"` | 詳細の「修正」/ VTL の「修正」 | 既存バージョンを UPDATE |
| `"renewal"` | 履歴の「更新」 | 旧バージョンを閉じ、新バージョンを INSERT |
| `"change"` | 履歴の「変更」 | 同上（有効期限は前バージョンから継承） |

**共通フィールド:**
- 許可番号（必須）
- 許可区分（必須、セレクト — edit モードでは読み取り専用）
- 許可年月日（必須、デートピッカー）
- 許可有効年月日（必須、デートピッカー）
- 優良認定（トグルスイッチ）
- 取扱品目（品目グリッド、インライン表示）

**更新モード専用:**
- 「更新〇年」ヘルパーボタン（`setRenewalYears`）で有効期限を自動計算

**保存後の遷移:** 詳細ビューに戻る（`showPermitDetail`）

### 15.6 サブナビゲーション

許可タブ内のビューにはステップナビゲーション（`buildStepNav`）を表示。

| ビュー | パス表示 |
|--------|---------|
| 詳細 | `許可一覧 > 許可詳細` |
| 編集 | `許可一覧 > 許可詳細 > 編集` |
| 更新 | `許可一覧 > 許可詳細 > 更新` |
| 変更 | `許可一覧 > 許可詳細 > 変更` |

リンク部分はクリックで遷移可能。

---

## 16. 施設タブの構成

**理論的根拠**: Nielsen H4（一貫性と標準）、許可タブとの操作フロー統一

### 16.1 画面遷移フロー

```
施設一覧（カードレイアウト）
  ├── [+ 施設追加] → 施設追加フォーム → [保存/キャンセル] → 一覧に戻る
  │
  └── [詳細] → 施設詳細ビュー（B2 レイアウト）
                  ├── B2 ヘッダー: 施設種別 + ピル（状態・処理方法・管理区分）
                  ├── 基本情報グループ（許可番号/許可日/有効期限/設置日等）
                  ├── 施設種別固有セクション
                  │     ├── 最終処分場: 埋立容量/面積/終了日
                  │     └── 中間処理施設: 処理能力テーブル
                  ├── 保管施設情報（該当時）
                  ├── 品目・処理能力セクション
                  ├── [変更] アクション行 → 変更フォーム
                  ├── 休止/再開セクション（該当時）
                  ├── 状態変更セクション（休止/廃止/取消ボタン）
                  └── 履歴セクション（縦タイムライン）
```

### 16.2 施設一覧カード

カードレイアウト（§13.5 参照）。トグル: 「廃止済みを含む」チェックボックス。

### 16.3 施設詳細ビュー（B2 レイアウト）

許可詳細と同じ B2 レイアウトシステムを使用。

**変更ボタンの配置**: B2 グループ内のアクション行（`.b2-action-row`）として配置。
独立したボタンではなく、コンテンツ内に統合。

### 16.4 施設編集フォーム

`showFacilityEditForm(facilityId, logicalId, businessId, mode)` で2モードを使用。

| モード | トリガー | 動作 |
|--------|---------|------|
| `"edit"` | 新規追加 | INSERT |
| `"renewal"` | 詳細の「変更」 | 旧バージョンを閉じ、新バージョンを INSERT |

---

## 17. 車両タブの構成

### 17.1 一覧表示

テーブルレイアウト（`.data-table`）。

| 列 | 内容 |
|----|------|
| 状態 | 稼働中/廃車 バッジ |
| 登録番号 | 登録番号1〜4を結合表示 |
| 普通 | トグルサークル（●/○、青系 `#1565c0`） |
| 特管 | トグルサークル（●/○、オレンジ系 `#e65100`） |
| 操作 | 編集/廃車にする(or復活)/削除 |

**普通/特管トグル**: クリックでフラグを切替。廃車時はグレーアウト（非操作）。
`toggleVehicleFlag(vehicleId, flagName, newValue, businessId)` で DB 更新後に一覧再描画。

### 17.2 車両追加・編集フォーム

`openVehicleForm(vehicleId, businessId)` で描画。タブ内インライン表示。

**フィールド:**
- 登録番号1〜4（テキスト入力）
- 普通フラグ（チェックボックス）
- 特管フラグ（チェックボックス）

### 17.3 DBマイグレーション

車両テーブルに `普通フラグ`/`特管フラグ` カラムが存在しない場合、
DB接続時のマイグレーションで自動追加（YESNO型、デフォルト False）。
既存の `許可区分ID` からデータを移行:
- 許可区分ID=3（普通収集運搬）→ 普通フラグ=True
- 許可区分ID=2,4（特管）→ 特管フラグ=True

---

## 18. 役員タブの構成

### 18.1 一覧表示

テーブルレイアウト（`.data-table`）。

| 列 | 内容 |
|----|------|
| 状態 | 現任/退任 バッジ |
| 役職名 | テキスト |
| 氏名 | ★代表者マーク + 姓 + 名 |
| 操作 | ⭐代表者指定(or解除)/編集/退任(or復帰)/削除 |

**代表者マーク**: `.primary-star`（グレー `#bbb`）、`.primary-star.active`（ゴールド `#f5a623`）

### 18.2 役員追加・編集フォーム

`openOfficerForm(officerId, businessId)` で描画。タブ内インライン表示。

**フィールド:**
- 役職名（テキスト入力）
- 姓（テキスト入力）
- 名（テキスト入力）

---

## 19. ステータスバッジ体系

### 19.1 共通関数

```javascript
statusBadge(type, text, large)
```

`large` が true の場合、`.badge-status-lg` クラスを追加。

### 19.2 状態バッジ一覧

| type | 背景 | テキスト色 | 使用場面 |
|------|------|----------|---------|
| `active` | `#e8f5e9` | `#2e7d32` | 許可: 有効 |
| `operating` | `#e8f5e9` | `#2e7d32` | 施設: 稼働中、車両: 稼働中 |
| `serving` | `#e8f5e9` | `#2e7d32` | 役員: 現任 |
| `cancelled` | `#ffebee` | `#c62828` | 取消 |
| `abolished` | `#f5f5f5` | `#757575` | 廃止 |
| `scrapped` | `#f5f5f5` | `#757575` | 車両: 廃車 |
| `retired` | `#f5f5f5` | `#757575` | 役員: 退任 |
| `lapsed` | `#f5f5f5` | `#757575` | 許可: 失効 |

### 19.3 期限バッジ

| type | 背景 | テキスト色 | 意味 |
|------|------|----------|------|
| `.badge-expiry.expired` | `#ffebee` | `#c62828` | 期限切れ |
| `.badge-expiry.soon` | `#fff3e0` | `#e65100` | 期限間近 |
| `.badge-expiry.valid` | `#e8f5e9` | `#2e7d32` | 有効期限内 |

---

## 20. 品目表示の共通関数

### 20.1 インライン表示

```javascript
loadPermitItemsInline(permitId, targetId)
```

指定した `targetId` の要素に品目グリッドを描画する。
詳細ビュー（`permit-detail-items`）と編集フォーム（`permit-edit-items`）で共用。

クリック時のコールバック: `cyclePermitItemInline(permitId, itemId, targetId)`
→ DB更新後に同じ `targetId` に再描画。

### 20.2 全画面表示

```javascript
showPermitItemsView(permitId, businessId, fromContext)
```

| fromContext | 戻り先 |
|------------|--------|
| "detail" | `showPermitDetail()` |
| "history" | `showPermitHistory()` |

後方互換ラッパー:
- `showPermitItems(permitId, businessId)` → `showPermitItemsView(..., "detail")`
- `showPermitItemsFromHistory(permitId, logicalId, businessId)` → `showPermitItemsView(..., "history")`

---

## 21. グローバル状態変数一覧

| 変数 | 型 | 用途 |
|------|-----|------|
| `navStack` | Array | ナビゲーション履歴 |
| `savedScrollPositions` | Object | ページごとのスクロール位置 |
| `formDirty` | boolean | 未保存変更フラグ |
| `currentDetailPermitId` | number | 詳細ビュー表示中の許可ID |
| `currentDetailLogicalId` | number | 詳細ビュー表示中の論理ID |
| `currentDetailBusinessId` | number | 詳細ビュー表示中の事業者ID |
| `permitHistorySectionLoaded` | boolean | 履歴セクション読み込み済みフラグ |
| `editingPermitId` | number | 編集中の許可ID |
| `editingPermitLogicalId` | number | 編集中の論理ID |
| `editingPermitBusinessId` | number | 編集中の事業者ID |
| `currentItemsContext` | string | 品目表示のコンテキスト ("detail" / "history") |
| `currentVehicleBusinessId` | number | 車両編集中の事業者ID |
| `currentVehicleEditId` | number | 編集中の車両ID |

---

## 22. DBマイグレーション

DB接続時に `migrateDatabase()` が自動実行。各ステップは独立した `try-catch` で囲む。

| 順序 | 対象 | 内容 |
|------|------|------|
| 1 | 施設.許可番号 | LONG → VARCHAR(255) 型変更 |
| 2 | 役員.代表者フラグ | YESNO カラム追加（デフォルト False） |
| 3 | 車両.普通フラグ | YESNO カラム追加 + 許可区分ID=3 から移行 |
| 4 | 車両.特管フラグ | YESNO カラム追加 + 許可区分ID=2,4 から移行 |
| 5 | 全角→半角補正 | 事業者住所・電話番号の全角英数字を半角に一括変換 |

---

## 23. 検索画面 Apple HIG 統一アップデート (v1.3)

**理論的根拠**: Apple HIG（明快さ・一貫性）、Nielsen H4（一貫性と標準）

### 23.1 目的

全検索画面（事業者/許可/施設/車両/役員）のビジュアルスタイルを Apple HIG に統一し、
トップページとの一貫性を確保する。

### 23.2 検索ボックス（`.search-box`）

frosted glass スタイルのカードコンテナ。

| テーマ | 背景 | ボーダー | 角丸 | シャドウ |
|--------|------|---------|------|---------|
| デフォルト | `rgba(255,255,255,0.06)` | `rgba(255,255,255,0.08)` | 14px | なし |
| ライト | `#fff` | `rgba(0,0,0,0.06)` | 14px | `0 2px 12px rgba(0,0,0,0.06)` |
| ダーク | `rgba(255,255,255,0.06)` | `rgba(255,255,255,0.08)` | 14px | なし |

### 23.3 検索インプット（`input[type='text']`）

| プロパティ | 値 |
|-----------|-----|
| レイアウト | `flex: 1; min-width: 200px` |
| 角丸 | 10px |
| 背景 | frosted glass（テーマ別） |
| フォーカス | `border-color: #007aff` |
| トランジション | `border-color 0.2s ease, background 0.2s ease` |

### 23.4 検索ボタン

| プロパティ | 値 |
|-----------|-----|
| 背景色 | `#007aff`（Apple Blue） |
| ダークモード | `#0a84ff` |
| hover | `#0066d6` |
| 角丸 | 10px |
| font-weight | 500 |

### 23.5 データテーブル

| プロパティ | 値 |
|-----------|-----|
| 角丸 | 14px |
| th font-size | 0.85em |
| th letter-spacing | 0.02em |
| td border | `#eee`（薄く） |
| hover | `rgba(0,122,255,0.06)`（Apple blue tint） |
| ライトモード | `box-shadow: 0 2px 12px rgba(0,0,0,0.06)` |

### 23.6 サブタイトルと初期状態

各検索ページに英語サブタイトル（`.subtitle`）を追加。

| 検索ページ | サブタイトル |
|-----------|-------------|
| 事業者検索 | Business Search |
| 許可検索 | Permit Search |
| 施設検索 | Facility Search |
| 車両検索 | Vehicle Search |
| 役員検索 | Officer Search |

結果エリアの初期状態には `.search-initial-state`（アイコン + ガイドテキスト）を配置。
検索実行時に `innerHTML` で上書きされるため JS 変更不要。

### 23.7 トグルスイッチ

| テーマ | checked 色 |
|--------|-----------|
| デフォルト/ライト | `#007aff` |
| ダーク | `#0a84ff` |

### 23.8 戻るボタン（`.btn-back`）

| プロパティ | 値 |
|-----------|-----|
| 背景 | `rgba(255,255,255,0.08)` |
| 角丸 | 10px |
| hover | `rgba(255,255,255,0.15)` |
| トランジション | `all 0.2s ease` |

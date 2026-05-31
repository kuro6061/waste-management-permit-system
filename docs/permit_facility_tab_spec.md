# 業タブ・施設タブ UI/UX 仕様書

**バージョン**: 1.1
**作成日**: 2026-03-04
**更新日**: 2026-03-04

---

## 1. 概要

### 1.1 対象範囲

本仕様書は、事業者詳細画面内の **業（許可）タブ** と **施設タブ** の UI/UX を定める。
両タブは履歴追跡モデルを共有し、同一のデザインパターン（一覧→詳細→編集）に従う。

全体のナビゲーション・デザインシステムについては [`docs/ui_ux_spec.md`](ui_ux_spec.md) を、
データモデル・ライフサイクル・SQL の詳細については [`docs/permit_lifecycle_spec.md`](permit_lifecycle_spec.md) を参照。

### 1.2 履歴追跡モデル

許可・施設ともに **論理 ID / 物理 ID** の2層構造でバージョン管理を行う。

| 概念 | 許可 | 施設 |
|------|------|------|
| 論理 ID | `許可論理ID` | `施設論理ID` |
| 物理 ID | `許可ID`（AUTOINCREMENT） | `施設ID`（AUTOINCREMENT） |
| 現行版の判定 | `有効終了日時 IS NULL` | `有効終了日時 IS NULL` |

同一論理 ID のレコード群が1つのエンティティの全バージョンを構成する。

### 1.3 バージョン作成の仕組み

「更新」「変更許可」「変更届」は内部的に以下の2ステップで処理される。

```
Step 1: 旧バージョンの有効終了日時を設定（close）
Step 2: 同一論理 ID で新レコードを INSERT（新バージョン）
```

これにより、任意の時点で「その時点の最新版」を特定できる（as-of 検索）。

### 1.4 関連ファイル

| ファイル | 役割 |
|----------|------|
| `app_source.hta` | UI（HTML/CSS/クライアント JS） |
| `app_logic.js` | 共通ロジック（SQL ビルダー等、UI 非依存） |

---

## 2. 業（許可）タブ

### 2.1 画面一覧

| # | 画面名 | 関数 | 種別 |
|---|--------|------|------|
| P1 | 許可一覧 | `loadPermitsForBusiness(businessId)` | 一覧 |
| P2 | 許可追加 | `openPermitForm(businessId)` | フォーム |
| P3 | 許可詳細 | `showPermitDetail(permitId, logicalId, businessId)` | 読み取り専用 |
| P4 | 許可編集 | `editPermitHistory(permitId, logicalId, businessId)` | フォーム |
| P5 | 許可更新 | `showPermitRenewalForm(logicalId, businessId)` | フォーム |
| P6 | 変更許可 | `showPermitChangeForm(logicalId, businessId)` | フォーム |
| P7 | 履歴 | `showPermitHistory(logicalId, businessId)` | 読み取り専用 |
| P8 | 品目全画面 | `showPermitItemsView(permitId, businessId, fromContext)` | 編集 |

### 2.2 画面遷移図

```
事業者詳細 → [許可タブ]
│
├─ P1: 許可一覧
│   ├── [+ 許可追加] ──→ P2: 許可追加フォーム
│   │                         └── [保存] → P1 に戻る
│   │
│   └── [詳細] ──→ P3: 許可詳細（読み取り専用 + アクション）
│                     │
│                     ├── セクション A: 基本情報
│                     │     └── [編集] ──→ P4: 許可編集フォーム（純粋な編集のみ）
│                     │                       ├── [保存] → P3 に戻る
│                     │                       └── [キャンセル] → P3 に戻る
│                     │
│                     ├── セクション B: 取扱品目（インライン、クリック切替可能）
│                     │     └── [全画面] ──→ P8: 品目全画面
│                     │                        └── [戻る] → P3
│                     │
│                     ├── セクション C: 状態・ライフサイクル
│                     │     ├── 廃止済み/取消済み → [復活] → 確認ダイアログ → P3
│                     │     └── 有効 → なし（Danger Zone に集約）
│                     │
│                     ├── セクション D: アクション（有効時のみ）
│                     │     ├── [更新] ──→ P5: 更新フォーム
│                     │     │                └── [実行] → P3（新バージョン）
│                     │     └── [変更許可] ──→ P6: 変更許可フォーム
│                     │                        └── [実行] → P3（新バージョン）
│                     │
│                     ├── Danger Zone（有効時のみ）
│                     │     ├── [廃止] → 日付入力 → 確認ダイアログ → P3
│                     │     └── [取消] → 日付入力 → 確認ダイアログ → P3
│                     │
│                     └── セクション E: 履歴（折りたたみ、遅延読み込み）
│                           ├── タイムライン（境界クリック → 日付ピッカー）
│                           └── 履歴テーブル
│                                 └── [編集] ──→ P4: 許可編集（旧バージョン）
│
└── 許可検索（page-search-permit）
     └── [結果クリック] ──→ P3: 許可詳細
```

### 2.3 各画面の仕様

#### P1: 許可一覧

`tab-permits` 内に描画。`refreshPermitsTab(businessId)` でリロード。

**テーブル列:**

| 列 | 内容 |
|----|------|
| 許可番号 | 番号 + 小さく論理 ID 表示 |
| 許可区分 | 区分名 + 優良認定★マーク |
| 許可年月日 | yyyy/mm/dd |
| 許可有効年月日 | yyyy/mm/dd（期限切れ/間近は色付き） |
| 状態 | ステータスバッジ |
| 操作 | 「詳細」ボタン |

**行の色分け:**

| 条件 | CSS クラス | 色 |
|------|-----------|-----|
| 取消 | `bg-row-error` | 赤系背景 |
| 廃止 | `bg-row-inactive` | グレー系背景 |
| 期限切れ/期限間近 | `bg-row-warn` | 黄系背景 |
| 有効 | なし | 通常背景 |

#### P3: 許可詳細

`showPermitDetail(permitId, logicalId, businessId)` が4セクション構成で描画する。

**セクション A: 基本情報**

読み取り専用カード。右上に「編集」ボタン。

| 表示項目 | 備考 |
|---------|------|
| 許可番号 | テキスト |
| 許可区分 | 区分名 + 優良認定★ |
| 許可年月日 | yyyy/mm/dd |
| 許可有効年月日 | yyyy/mm/dd |
| 有効開始日時 | 設定されている場合のみ |
| 有効終了日時 | 設定されている場合のみ |

**セクション B: 取扱品目**

`loadPermitItemsInline(permitId, targetId, readOnly, categoryId)` でインライン描画。
詳細は [2.4 品目管理](#24-品目管理) を参照。

**セクション C: 状態・ライフサイクル**

取消/廃止の場合のみ表示。日付・理由を読み取り専用で表示し、復活ボタンを配置。

| 条件 | 表示内容 |
|------|---------|
| 取消済み | 取消日 + 取消理由 + 「復活（取消を取り消す）」ボタン |
| 廃止済み | 廃止日 + 廃止理由 + 「復活（廃止を取り消す）」ボタン |
| 有効 | セクション非表示 |

**セクション D: アクション（有効時のみ）**

更新・変更許可のライフサイクルボタンと、Danger Zone を配置。

| 要素 | 説明 |
|------|------|
| 更新ボタン | P5: 許可更新フォームへ |
| 変更許可ボタン | P6: 変更許可フォームへ |
| Danger Zone | 廃止フォーム（日付 + 理由）、取消フォーム（日付 + 理由） |

**設計意図（Apple HIG 準拠）:** 廃止・取消は破壊的操作のため、Danger Zone に集約。
P4（編集画面）からは削除し、詳細画面で完結させることで「編集は編集だけ」の原則を守る。

**セクション E: 履歴（折りたたみ）**

デフォルト折りたたみ。`togglePermitHistorySection()` で開閉。
初回展開時に `loadPermitHistoryInline(logicalId, businessId)` で遅延読み込み。

| 要素 | 説明 |
|------|------|
| タイムラインバー | 全バージョンに `有効開始日時` がある場合のみ表示 |
| 履歴テーブル | 全バージョン一覧（許可 ID, 番号, 区分, 日付, 状態, 編集ボタン） |

#### P4: 許可編集（純粋な編集のみ）

`editPermitHistory(permitId, logicalId, businessId)` が描画。
**P4 は基本情報と品目の編集に特化する。** 状態変更・履歴管理・更新/変更許可は P3 に集約済み。

**ステップナビ:** `許可一覧 > 許可詳細 > 編集`

**編集可能フィールド:**

| フィールド | 要素 ID | 必須 | 型 |
|-----------|---------|------|-----|
| 許可番号 | `edit-permit-number` | Yes | テキスト |
| 許可区分 | `edit-permit-category` | Yes | セレクト |
| 許可年月日 | `edit-permit-date` | Yes | 日付ピッカー |
| 許可有効年月日 | `edit-permit-valid-date` | Yes | 日付ピッカー |
| 優良認定 | `edit-permit-excellent` | No | トグルチェックボックス |

**管理者セクション（デフォルト非表示）:**

`[管理者] 有効開始/終了を手動編集` リンクで `togglePermitBoundaryAdmin()` を実行し、
有効開始日時・有効終了日時の手動入力パネルを表示する。

通常は有効開始日時 = 許可年月日で自動同期される。

**取扱品目セクション:**

`loadPermitItemsInline(permitId, 'permit-edit-items', false, categoryId)` で
編集可能なインラインテーブルを描画。

**ボタン:** 「保存」「キャンセル」のみ。

**保存処理** (`savePermitHistoryEdit()`):
1. 許可番号を `normalizePermitNumber()` で正規化（全角→半角）
2. 必須フィールドのバリデーション
3. 有効開始日時 = 許可年月日に自動同期（管理者パネル非表示時）
4. `buildUpdatePermitHistoryQuery(data)` で部分更新
5. P3: 詳細ビューに遷移

#### P5: 許可更新フォーム

`showPermitRenewalForm(logicalId, businessId)` が描画。

**自動算出ロジック:**

```
新しい許可有効年月日 = 従前の許可有効年月日 + renewalYears
renewalYears = 優良認定 ? 7 : 5
```

閏年補正あり（2/29 → 2/28）。

**フォームフィールド:**

| フィールド | 要素 ID | 必須 | 備考 |
|-----------|---------|------|------|
| 新しい許可年月日 | `renewal-permit-date` | Yes | 日付ピッカー |
| 新しい許可有効年月日 | `renewal-valid-date` | Yes | 自動算出値がプリセット、変更可 |

自動算出の説明メッセージ:
`有効年月日の自動算出: 従前の有効年月日 + 5年（通常） = 20XX/XX/XX`

**実行処理** (`executePermitRenewal()`):
1. 旧バージョンの有効終了日時を `buildCloseOldPermitVersionsQuery()` で設定
2. 同一論理 ID で新バージョンを `buildSavePermitQuery()` で INSERT
3. 旧バージョンの品目を `buildCopyPermitItemsQuery()` で新バージョンにコピー
4. 新バージョンの P3: 詳細ビューに遷移

#### P6: 変更許可フォーム

`showPermitChangeForm(logicalId, businessId)` が描画。

**更新との違い:**

| 項目 | 更新（P5） | 変更許可（P6） |
|------|----------|--------------|
| 法的根拠 | 14条2項（期間更新） | 14条の2（事業範囲変更） |
| 許可有効年月日 | 新規入力（自動算出） | 従前の値を継承（変更不可） |
| 入力フィールド | 許可年月日 + 有効年月日 | 変更許可年月日のみ |
| 品目 | コピー | コピー（その後編集想定） |
| 用途 | 5年/7年ごとの定期更新 | 品目追加・事業範囲変更 |

**フォームフィールド:**

| フィールド | 要素 ID | 必須 | 備考 |
|-----------|---------|------|------|
| 変更許可年月日 | `change-permit-date` | Yes | 日付ピッカー |

**実行処理** (`executePermitChange()`):
1. 旧バージョンを close
2. 新バージョンを INSERT（有効年月日は旧バージョンから継承）
3. 品目をコピー
4. 新バージョンの P3: 詳細ビューに遷移

#### P7: 許可履歴（全画面）

`showPermitHistory(logicalId, businessId)` が全バージョンの履歴を表示。

**構成要素:**
1. **タイムラインバー**: 全バージョンに `有効開始日時` がある場合のみ表示。
   `buildPermitTimelineHtml()` で生成。境界マーカーをクリックすると日付変更可。
2. **バージョンテーブル**: 全バージョンの一覧。各行に「詳細」ボタン。
3. **アクションボタン**: 「更新」「変更許可」

#### P8: 品目全画面

`showPermitItemsView(permitId, businessId, fromContext)` が品目管理の全画面表示を行う。

`fromContext` パラメータにより戻り先を制御:
- `"detail"` → P3: 許可詳細
- `"history"` → P7: 許可履歴

後方互換ラッパー:
- `showPermitItems(permitId, businessId)` → `fromContext = "detail"`
- `showPermitItemsFromHistory(permitId, logicalId, businessId)` → `fromContext = "history"`

### 2.4 品目管理

#### 品目フィルタリング

品目 ID で普通産廃と特管産廃を区別する。

```
定数: ITEM_SPECIAL_THRESHOLD = 100

普通産業廃棄物用品目: 品目 ID < 100
特別管理産業廃棄物用品目: 品目 ID >= 100
```

許可区分ごとの廃棄物種類区分ID（`マスター_許可区分.廃棄物種類区分ID`）を
`isSpecialWasteCategory(categoryId)` で判定し、表示する品目を切り替える。

```
定数: WASTE_TYPE_SPECIAL = 2

isSpecialWasteCategory(categoryId):
  → _wasteTypeMap[categoryId] === WASTE_TYPE_SPECIAL
```

#### 3状態サイクル

品目の状態はクリックで × → 〇 → ◎ → × と循環する。

| 状態 | 表示 | DB レコード | 取り扱いフラグ | 積替保管フラグ |
|------|------|------------|--------------|--------------|
| なし | × | レコードなし | - | - |
| 取り扱い | 〇 | あり | True | False |
| 積替保管 | ◎ | あり | True | True |

**遷移ロジック** (`buildPermitItemQueries()` による SQL セット):

```
× → 〇: INSERT INTO 許可品目 ... (取り扱いフラグ=True, 積替保管フラグ=False)
〇 → ◎: UPDATE 許可品目 SET 積替保管フラグ=True ...
◎ → ×: DELETE FROM 許可品目 WHERE 許可品目ID = recId
```

#### 表示モード

| モード | 関数 | 描画方式 | クリック操作 |
|--------|------|---------|------------|
| 読み取り専用 | `loadPermitItemsInline(..., readOnly=true)` | フレックスラップのバッジグリッド | なし |
| インライン編集 | `loadPermitItemsInline(..., readOnly=false)` | 横一列テーブル | `cyclePermitItemInline()` |
| 全画面編集 | `showPermitItemsView()` | 縦書きヘッダーのテーブル | `cyclePermitItemFullscreen()` |

**バッジの CSS クラス（読み取り専用モード）:**

| 状態 | CSS クラス |
|------|-----------|
| 取り扱い（〇） | `item-badge handling` |
| 積替保管（◎） | `item-badge transfer` |
| なし（×） | `item-badge none` |

### 2.5 ステータス判定ロジック

`showPermitDetail()` 内で以下の優先順位で判定する。

```
取消日が設定済み    → 「取消」(cancelled)
廃止日が設定済み    → 「廃止」(abolished)
許可有効年月日 < 今日 → 「期限切れ」(expired)
許可有効年月日 ≤ 今日+30日 → 「期限間近」(soon)
上記いずれでもない   → 「有効」(active/valid)
```

**履歴テーブル内のステータス:**

```
取消日あり          → 「取消(日付)」(cancelled)
廃止日あり          → 「廃止(日付)」(abolished)
有効終了日時が設定済み → 「失効」(lapsed) ← 更新による旧版
上記いずれでもない    → 「有効」(active)
```

### 2.6 タイムライン

タイムラインは `buildTimelineBars()` で描画される（施設タブと共用）。
詳細は [4.1 タイムライン](#41-タイムライン) を参照。

**許可タブ固有のラッパー:**

`buildPermitTimelineHtml(versions, logicalId, businessId)`:
- ラベル: `permitNumber || "ID:" + permitId`
- ID: `"許可ID:" + permitId`
- ステータス: `cancelled` / `abolished` / `active` / `expired`
- 境界クリック: `openPermitBoundaryPicker()` を起動

### 2.7 グローバル状態変数

| 変数 | 型 | 用途 |
|------|-----|------|
| `currentDetailPermitId` | number | 詳細ビュー表示中の許可 ID |
| `currentDetailLogicalId` | number | 詳細ビュー表示中の論理 ID |
| `currentDetailBusinessId` | number | 詳細ビュー表示中の事業者 ID |
| `permitHistorySectionLoaded` | boolean | 履歴セクション読み込み済みフラグ |
| `editingPermitId` | number | 編集中の許可 ID |
| `editingPermitLogicalId` | number | 編集中の論理 ID |
| `editingPermitBusinessId` | number | 編集中の事業者 ID |
| `editingPermitCategoryId` | number | 編集中の許可区分 ID（品目フィルタ用） |
| `currentItemsPermitId` | number | 品目表示中の許可 ID |
| `currentItemsBusinessId` | number | 品目表示中の事業者 ID |
| `currentItemsContext` | string | 品目表示のコンテキスト（`"detail"` / `"history"`） |

---

## 3. 施設タブ

### 3.1 画面一覧

| # | 画面名 | 関数 | 種別 |
|---|--------|------|------|
| F1 | 施設一覧 | `loadFacilitiesForBusiness(businessId, includeAbolished)` | 一覧 |
| F2 | 施設追加 | `openFacilityForm(businessId)` | フォーム |
| F3 | 施設詳細 | `showFacilityDetail(facilityId, logicalId, businessId)` | 読み取り専用 |
| F4 | 施設編集 | `editFacilityHistory(facilityId, logicalId, businessId)` | フォーム |
| F5 | 処理能力管理 | `showProcessingCapacity(facilityId, businessId)` | 一覧 |
| F6 | 処理能力フォーム | `openCapacityForm(editId)` | フォーム |
| F7 | 施設更新（変更届） | `showFacilityRenewalForm(logicalId, businessId)` | フォーム |

※ 施設履歴は `showFacilityHistoryInTab()` / `loadFacilityHistoryInline()` で
詳細画面内のセクションとして表示される。

### 3.2 画面遷移図

```
事業者詳細 → [施設タブ]
│
├─ F1: 施設一覧
│   ├── [+ 施設追加] ──→ F2: 施設追加フォーム
│   │                       └── [保存] → F1 に戻る
│   │
│   ├── [廃止済みを含む] トグル → F1 再描画
│   │
│   └── [詳細] ──→ F3: 施設詳細（読み取り専用 + アクション）
│                     │
│                     ├── 基本情報 + 種別固有情報
│                     │     └── [編集] ──→ F4: 施設編集フォーム（純粋な編集のみ）
│                     │                       ├── [保存] → F3 に戻る
│                     │                       └── [キャンセル] → F3 に戻る
│                     │
│                     ├── 処理能力（インライン読み取り専用）
│                     │     └── [管理] ──→ F5: 処理能力管理
│                     │                       ├── [+ 品目追加] ──→ F6: 処理能力フォーム
│                     │                       │                       └── [保存] → F5
│                     │                       ├── [編集] ──→ F6: 処理能力フォーム（編集）
│                     │                       │                └── [保存] → F5
│                     │                       └── [削除] → 確認 → F5
│                     │
│                     ├── 状態セクション
│                     │     ├── 廃止済み → [復活] → 確認ダイアログ → F3
│                     │     └── 有効 → なし（Danger Zone に集約）
│                     │
│                     ├── アクション（有効時のみ）
│                     │     └── [変更届] ──→ F7: 施設更新フォーム
│                     │                        └── [実行] → F4（新バージョン）
│                     │
│                     ├── Danger Zone（有効時のみ）
│                     │     ├── [廃止] → 日付入力 → 確認ダイアログ → F3
│                     │     └── [削除] → 2段階確認 → F1
│                     │
│                     └── 履歴セクション（折りたたみ）
│                           ├── タイムライン（境界クリック → 日付ピッカー）
│                           └── 履歴テーブル → [詳細] → F3
```

### 3.3 各画面の仕様

#### F1: 施設一覧

`tab-facilities` 内に描画。

**操作ボタン:**
- `+ 施設追加` → `openFacilityForm(businessId)`
- `廃止済みを含む` チェックボックス → トグルでリロード

**テーブル列:**

| 列 | 内容 |
|----|------|
| 状態 | 稼働中/廃止 バッジ |
| 施設種別 | `マスター_施設種別` から取得 |
| 設置場所 | テキスト |
| 許可番号 | テキスト |
| 特性 | 種別依存（下表参照） |
| 操作 | 「詳細」ボタン |

**特性列の表示分岐:**

| 施設種別 | 表示内容 |
|---------|---------|
| 中間処理施設（ID=1） | 処理方法 + 設置形態区分 |
| 最終処分場（ID=2） | 管理区分 + 容量(m3) + 面積(m2) |

#### F2: 施設追加フォーム

`openFacilityForm(businessId)` が描画。

**共通フィールド（全施設種別）:**

| フィールド | 要素 ID | 必須 | 型 |
|-----------|---------|------|-----|
| 施設種別 | `fType` | Yes | セレクト（onChange で動的フィールド切替） |
| 設置場所 | `fLocation` | Yes | テキスト |
| 許可番号 | `fPermitNo` | No | テキスト |
| 許可年月日 | `fPermitDate` | No | 日付ピッカー |
| 設置年月日 | `fSetupDate` | No | 日付ピッカー |

**中間処理施設（ID=1）固有フィールド:** `#processing-fields`

| フィールド | 要素 ID | 必須 | 型 |
|-----------|---------|------|-----|
| 処理方法 | `fMethod` | No | セレクト（`マスター_処理方法`） |
| 設置形態 | `fSetupForm` | No | セレクト（`マスター_設置形態区分`） |
| 許可対象区分 | `fPermitTarget` | No | セレクト（`マスター_許可対象区分`） |

**最終処分場（ID=2）固有フィールド:** `#landfill-fields`

| フィールド | 要素 ID | 必須 | 型 |
|-----------|---------|------|-----|
| 管理区分 | `fMgmtType` | No | セレクト（`マスター_管理区分`） |
| 容量(m3) | `fCapacity` | No | 数値 |
| 面積(m2) | `fArea` | No | 数値 |

**動的フィールド切替:**

`toggleFacilityTypeFields(editPrefix)` が施設種別の `onChange` で呼ばれ、
`FACILITY_TYPE_PROCESSING (1)` と `FACILITY_TYPE_LANDFILL (2)` に応じて
該当セクションの `display` を切り替える。

```javascript
定数: FACILITY_TYPE_PROCESSING = 1  // 中間処理施設
定数: FACILITY_TYPE_LANDFILL = 2    // 最終処分場

typeId === FACILITY_TYPE_LANDFILL  → landfill-fields 表示、processing-fields 非表示
typeId === FACILITY_TYPE_PROCESSING → processing-fields 表示、landfill-fields 非表示
```

**保存処理** (`saveFacility()`):
1. 新規施設論理 ID を採番（`MAX(施設論理ID) + 1`）
2. 種別に応じたフィールドを `buildSaveFacilityQuery(data)` で INSERT
3. F1: 施設一覧に遷移

#### F3: 施設詳細

`showFacilityDetail(facilityId, logicalId, businessId)` が描画。

**表示セクション:**

1. **ステップナビ**: `施設一覧 > 施設詳細 [編集]`
2. **基本情報**: 施設種別 + ステータスバッジ、設置場所、許可番号、許可年月日、設置年月日
3. **種別固有情報**:
   - 中間処理施設: 処理方法、設置形態、許可対象区分
   - 最終処分場: 管理区分、容量、面積、埋立終了日
4. **処理能力**（インライン読み取り専用）: `loadFacilityCapacityInline(facilityId, targetId)`
   - テーブル: 品目 | 時間処理能力 | 日処理能力 | 稼働時間 | 特記事項
   - 「管理」ボタン → F5 へ
5. **状態**: 廃止済み → 廃止日 + 「復活」ボタン / 有効 → ステータス表示のみ
6. **アクション**（有効時のみ）: 「変更届」ボタン
7. **Danger Zone**（有効時のみ）:
   - 廃止フォーム（日付ピッカー `#detail-fac-abolish-date` + 実行ボタン）
   - 「施設を削除」ボタン → `deleteFacilityFromDetail()` → 2段階確認
8. **履歴**（折りたたみ、遅延読み込み）:
   - `toggleFacilityHistorySection()` で開閉
   - `loadFacilityHistoryInline(logicalId, businessId)` で読み込み
   - タイムライン + 履歴テーブル

#### F4: 施設編集（純粋な編集のみ）

`editFacilityHistory(facilityId, logicalId, businessId)` が描画。
**F4 は基本情報の編集に特化する。** 状態変更・Danger Zone は F3 に集約済み。

**フォームフィールド（`edit-fac-` プレフィックス）:**

| フィールド | 要素 ID | 必須 | 型 |
|-----------|---------|------|-----|
| 施設種別 | `edit-fac-type` | Yes | セレクト |
| 設置場所 | `edit-fac-location` | Yes | テキスト |
| 許可番号 | `edit-fac-permit-no` | No | テキスト |
| 許可年月日 | `edit-fac-permit-date` | No | 日付ピッカー |
| 設置年月日 | `edit-fac-setup-date` | No | 日付ピッカー |

**種別固有フィールド（`edit-` プレフィックス）:**

中間処理施設 → `#edit-processing-fields`:
- `edit-fac-method`, `edit-fac-setup-form`, `edit-fac-permit-target`

最終処分場 → `#edit-landfill-fields`:
- `edit-fac-mgmt-type`, `edit-fac-capacity`, `edit-fac-area`
- `edit-fac-landfill-end`（埋立終了年月日）

**自動管理フィールド（読み取り専用）:**
- `edit-fac-start`: 有効開始日時（許可年月日と自動同期）
- `edit-fac-end`: 有効終了日時

**管理者パネル:**

`[管理者] 有効開始/終了を手動編集` で `#facility-boundary-admin` を表示。
- `edit-fac-start-admin`, `edit-fac-end-admin` で手動上書き可能。

**処理能力セクション:**

インライン読み取り専用テーブル（`#facility-edit-capacity`）+「処理能力管理」ボタン。

**ボタン:** 「保存」「キャンセル」のみ。

**保存処理** (`saveFacilityHistoryEdit()`):
1. 施設種別・設置場所のバリデーション
2. 許可年月日 → 有効開始日時の自動同期（管理者パネル非表示時）
3. `buildUpdateFacilityHistoryQuery(updateData)` で部分更新
4. F3: 詳細ビューに遷移

#### F5: 処理能力管理

`showProcessingCapacity(facilityId, businessId)` が描画。

**パンくず:** `施設一覧 > 処理能力管理`

**操作ボタン:** `+ 品目追加` → `openCapacityForm()`

**テーブル列:**

| 列 | 内容 |
|----|------|
| 品目 | `マスター_品目.品目名`（`表示順` で並び替え） |
| 時間処理能力 | 数値 + 単位名 |
| 日処理能力 | 数値 + 単位名 |
| 稼働時間 | 数値（0-24） |
| 特記事項 | テキスト |
| 操作 | 「編集」「削除」ボタン |

#### F6: 処理能力フォーム

`openCapacityForm(editId)` が描画。`editId` があれば編集モード。

**フォームフィールド:**

| フィールド | 要素 ID | 必須 | 型 | 備考 |
|-----------|---------|------|-----|------|
| 品目 | `capItemSelect` | Yes | セレクト | `マスター_品目`（`表示順` ソート） |
| 時間処理能力単位 | `capHourUnit` | Yes | セレクト | `マスター_時間処理能力単位` |
| 時間処理能力 | `capHourCap` | No | 数値 | |
| 日処理能力 | `capDayCap` | No | 数値 | |
| 日処理能力単位 | `capDayUnit` | Yes | セレクト | 自動同期（下記） |
| 稼働時間 | `capHours` | No | 数値 | 0-24 |
| 特記事項 | `capNote` | No | テキストエリア | |

**単位の自動同期:**

`capHourUnit` の `onChange` 時、`capDayUnit` を同じ値に自動設定する。
これは「時間処理能力の単位 = 日処理能力の単位」であることが一般的なため。

**バリデーション** (`validateCapacityData()`):
- 時間処理能力・日処理能力・稼働時間が非負であること

#### F7: 施設更新（変更届）

`showFacilityRenewalForm(logicalId, businessId)` が描画。

**フォームフィールド:**

| フィールド | 要素 ID | 必須 | 備考 |
|-----------|---------|------|------|
| 許可年月日 | `renewal-fac-permit-date` | No | 未入力の場合は今日の日付を使用 |

**実行処理** (`executeFacilityRenewal()`):
1. 最新バージョンを取得
2. 旧バージョンを `buildCloseOldVersionByIdQuery()` で close
3. 新バージョンを `buildSaveFacilityQuery()` で INSERT（種別・場所等は引き継ぎ）
4. 新バージョンの物理 ID を `buildGetMaxIdQuery()` で取得
5. 新バージョンの F4: 編集画面に遷移（ユーザーが変更箇所を編集可能）

### 3.4 ステータス判定ロジック

```
廃止年月日が設定済み → 「廃止」(abolished)
有効終了日時が設定済み → 「失効」(expired) ← 変更届による旧版
上記いずれでもない → 「稼働中」(operating) / 「有効」(active)
```

一覧では `稼働中`（operating）、履歴テーブルでは状態に応じたバッジを表示。

### 3.5 タイムライン

施設タブのタイムラインは業タブと同じ `buildTimelineBars()` を共用する。

**施設タブ固有のラッパー:**

`buildFacilityTimelineHtml(versions, logicalId, businessId)`:
- ラベル: `location || "ID:" + facilityId`
- ID: `"施設ID:" + facilityId`
- ステータス: `abolished` / `active` / `expired`
- 境界クリック: `openFacilityBoundaryPicker()` を起動

---

## 4. 共通機能

### 4.1 タイムライン

#### buildTimelineBars()

許可・施設で共用されるタイムラインバー描画関数。

```javascript
buildTimelineBars(disp, todayDays, minDays, totalSpan, getLabel, getId, getStatus)
```

| パラメータ | 型 | 説明 |
|-----------|-----|------|
| `disp` | Array | 表示対象の配列（各要素に `startDateStr`, `endDateStr` を持つ） |
| `todayDays` | number | 今日の日数値（`dateStrToDays()` の結果） |
| `minDays` | number | 表示範囲の最小日数値 |
| `totalSpan` | number | 表示範囲の合計日数 |
| `getLabel(v)` | function | バー内に表示するラベルを返す |
| `getId(v)` | function | ツールチップ用の ID を返す |
| `getStatus(v)` | function | CSS クラス名を返す |

**バー位置の計算:**

```
left(%) = (startDays - minDays) / totalSpan * 100
width(%) = (endDays - startDays) / totalSpan * 100   ← 最小 0.5%
```

`endDateStr` が `null`（現行バージョン）の場合は `todayDays` を使用。

**日付ヘルパー関数:**

| 関数 | 用途 |
|------|------|
| `dateStrToDays(s)` | "yyyy/mm/dd" → UTC 日数値に変換 |
| `daysToDateStr(days)` | UTC 日数値 → "yyyy/mm/dd" に変換 |
| `todayDateStr()` | 今日の日付を "yyyy/mm/dd" で返す |

#### タイムラインバーの CSS

```
.timeline-bar-area   : 相対位置コンテナ（高さ 48px、背景 #e8eef4）
.timeline-bar        : 絶対位置バー（高さ 40px）
.timeline-bar.active : 緑（#4CAF50）
.timeline-bar.expired: 青（#90CAF9、文字色 #1a3a5c）
.timeline-bar.cancelled: 赤（#ef5350）
.timeline-bar.abolished: グレー（#9e9e9e）
```

#### 境界マーカー

バージョン間の境界日を示すマーカー。クリックで日付変更可能。

**編集可能条件:**

```
bMin = dateStrToDays(旧バージョンの startDate) + 1
bMax = 新バージョンの endDate ? dateStrToDays(endDate) - 1 : todayDays
canEdit = (bMin <= bMax)
```

クリック時: `openBoundaryPicker()` → カレンダーポップアップ → 日付選択 →
旧バージョンの `有効終了日時` と新バージョンの `有効開始日時` を同時更新。

### 4.2 日付ピッカー

HTA（IE/Trident）は `<input type="date">` を未サポートのため、独自カレンダー実装。

**3種類の日付ピッカー:**

| 種別 | 関数 | 用途 |
|------|------|------|
| 標準 | `showDatePicker(inputEl)` | フォーム入力欄の日付選択 |
| フローティング | `openDatePicker(inputId)` | 編集フォームの日付選択 |
| 境界用 | `openBoundaryPicker(anchorEl, ...)` | タイムライン境界日の変更 |

**共通仕様:**

| 項目 | 値 |
|------|-----|
| 曜日ヘッダー | 日月火水木金土 |
| 月ナビゲーション | < > ボタンで前月/翌月 |
| 今日ハイライト | `.bp-day.today` |
| 選択済みハイライト | `.bp-day.selected` |
| ESC キー | ピッカーを閉じる |

**境界用ピッカーの追加機能:**

- `minDays` / `maxDays` による日付範囲制限
- 範囲外の日付は `.bp-day.disabled` で表示（クリック不可）
- 選択時のコールバックで旧/新バージョンの境界日を同時更新

### 4.3 確認ダイアログ

`showConfirmDialog(title, message, options)` で統一的な確認ダイアログを表示。

```javascript
options = {
    okText: "OK",           // OK ボタンのラベル
    okClass: "btn-primary", // OK ボタンの CSS クラス
    onOk: function() {}     // OK 時のコールバック
}
```

`confirmDialogOk()` で実行、`confirmDialogCancel()` または ESC キーでキャンセル。

**使用例:**

| 操作 | タイトル | okText | okClass |
|------|---------|--------|---------|
| 事業者削除 | 事業者削除 | 削除 | `btn-danger` |
| 事業者削除（2段階目） | 最終確認 | 削除する | `btn-danger` |
| 許可廃止 | 許可廃止 | 廃止する | `btn-warning` |
| 許可取消 | 許可取消 | 取消する | `btn-danger` |
| 許可復活 | 許可復活 | 復活する | （デフォルト） |
| 施設削除 | 施設削除 | 削除する | `btn-danger` |

### 4.4 ステータスバッジ

`statusBadge(type, text, large)` で統一的なバッジ HTML を生成。

```html
<span class="badge-status {type} [badge-status-lg]">{text}</span>
```

**CSS クラスと色:**

| type | 背景色 | 文字色 | ボーダー | 用途 |
|------|--------|--------|---------|------|
| `active` | `#e8f5e9` | `#2e7d32` | `#a5d6a7` | 有効 |
| `operating` | 同上 | 同上 | 同上 | 稼働中 |
| `serving` | 同上 | 同上 | 同上 | 在任 |
| `cancelled` | `#ffebee` | `#c62828` | `#ef9a9a` | 取消 |
| `abolished` | `#f5f5f5` | `#757575` | `#bdbdbd` | 廃止 |
| `lapsed` | 同上 | 同上 | 同上 | 失効 |
| `scrapped` | 同上 | 同上 | 同上 | 廃車 |
| `retired` | 同上 | 同上 | 同上 | 退任 |

`large = true` の場合、`badge-status-lg`（`font-size: 1.1em`）が追加される。

**期限バッジ（許可固有）:**

| CSS クラス | 条件 | 色 |
|-----------|------|-----|
| `badge-expiry.valid` | 有効期限内 | 緑系 |
| `badge-expiry.expired` | 期限切れ | 赤系 |
| `badge-expiry.soon` | 期限間近（30日以内） | オレンジ系 |

### 4.5 SQL ビルダー一覧

#### 許可関連（`app_logic.js`）

| 関数 | 用途 |
|------|------|
| `buildSearchPermitQuery(params)` | 許可検索（as-of 日付、品目フィルタ等対応） |
| `buildSavePermitQuery(data)` | 許可新規登録 / 新バージョン作成 |
| `buildCloseOldPermitVersionsQuery(logicalId, todayStr)` | 旧バージョンの有効終了日時を設定 |
| `buildUpdatePermitHistoryQuery(data)` | 許可の部分更新 |
| `buildAbolishPermitQuery(permitId, dateStr, reason)` | 許可廃止 |
| `buildCancelPermitQuery(permitId, dateStr, reason)` | 許可取消 |
| `buildRestorePermitQuery(permitId)` | 許可復活 |
| `buildPermitItemQueries(permitId, itemId)` | 品目 3 状態サイクル用クエリセット |
| `buildCopyPermitItemsQuery(fromId, toId)` | 品目コピー（更新/変更許可時） |
| `buildLoadPermitHistoryQuery(logicalId)` | 履歴全バージョン取得 |
| `buildLoadPermitForEditQuery(permitId)` | 編集用データ取得 |
| `buildLoadPermitItemsQuery(permitId)` | 品目取得 |

#### 施設関連（`app_logic.js`）

| 関数 | 用途 |
|------|------|
| `buildSearchFacilityQuery(params)` | 施設検索 |
| `buildSaveFacilityQuery(data)` | 施設新規登録 / 新バージョン作成 |
| `buildAbolishFacilityQuery(facilityId, dateStr)` | 施設廃止 |
| `buildRestoreFacilityQuery(facilityId)` | 施設復活 |
| `buildDeleteFacilityQueries(logicalId)` | 施設完全削除（処理能力含む） |
| `buildUpdateFacilityHistoryQuery(data)` | 施設の部分更新 |
| `buildLoadFacilityHistoryQuery(logicalId)` | 履歴全バージョン取得 |
| `buildLoadFacilityForEditQuery(facilityId)` | 編集用データ取得 |
| `buildLoadFacilitiesForBusinessQuery(businessId, includeAbolished)` | 事業者の施設一覧 |

#### 処理能力関連（`app_logic.js`）

| 関数 | 用途 |
|------|------|
| `buildLoadProcessingCapacityQuery(facilityId)` | 処理能力一覧取得 |
| `buildSaveCapacityQuery(data)` | 処理能力登録/更新 |
| `buildDeleteCapacityQuery(capId)` | 処理能力削除 |
| `validateCapacityData(data)` | 処理能力バリデーション |

#### 共通（`app_logic.js`）

| 関数 | 用途 |
|------|------|
| `buildLoadLatestVersionQuery(table, logicalIdCol, logicalId)` | 最新バージョン取得 |
| `buildGetMaxIdQuery(table, idCol, logicalIdCol, logicalId)` | 新規物理 ID 取得 |
| `buildUpdateBoundaryDateQuery(table, idCol, id, dateCol, dateStr)` | 境界日更新 |
| `buildCloseOldVersionByIdQuery(table, idCol, id, todayStr, boundaryDate)` | 旧バージョン close |
| `validateFacilityData(data)` | 施設バリデーション |

/**
 * 入力ステップの定量的計測テスト
 *
 * 各操作フローで必要なボタンクリック数・入力フィールド数を
 * 定量的に記録し、UI改善の基準データとする。
 *
 * 計測項目:
 *   navClicks    - フォームに到達するまでのクリック数（タブ切替含む）
 *   inputFields  - 入力可能なフィールド数（text, select, checkbox, date, textarea）
 *   requiredFields - 必須フィールド数（badge-required または バリデーション対象）
 *   readonlyFields - 読み取り専用フィールド数（表示のみ）
 *   submitClicks - 保存/実行ボタンのクリック数
 *   totalEffort  - navClicks + requiredFields + submitClicks（最小限の操作数）
 */

// 各操作フローの定義
const operationFlows = {
    // ===== 事業者 =====
    newBusiness: {
        name: '事業者 新規登録',
        description: '事業者一覧画面 → 新規登録ボタン → フォーム入力 → 保存',
        navClicks: 1,       // 「新規登録」ボタン
        inputFields: 6,     // 事業者名, 事業者区分, 郵便番号, 都道府県, 住所, 電話番号
        requiredFields: 1,  // 事業者名のみ
        readonlyFields: 0,
        submitClicks: 1,    // 「保存」ボタン
    },
    editBusiness: {
        name: '事業者 編集',
        description: '事業者詳細画面 → 編集ボタン → フォーム入力 → 保存',
        navClicks: 1,       // 「編集」ボタン
        inputFields: 6,     // 同上（既存値がプリセット）
        requiredFields: 1,
        readonlyFields: 0,
        submitClicks: 1,
    },

    // ===== 許可 =====
    newPermit: {
        name: '許可 新規追加',
        description: '事業者詳細 → 許可タブ → ＋許可追加ボタン → フォーム入力 → 保存',
        navClicks: 2,       // 「許可」タブ（初期表示なら不要）+ 「＋許可追加」ボタン
        inputFields: 5,     // 許可区分, 許可番号, 許可年月日, 許可有効年月日, 優良認定
        requiredFields: 4,  // 許可区分, 許可番号, 許可年月日, 許可有効年月日
        readonlyFields: 0,
        submitClicks: 1,    // 「保存」ボタン
    },
    permitRenewal: {
        name: '許可 更新',
        description: '許可一覧 → 許可行クリック → 履歴画面 → 🔄更新ボタン → フォーム入力 → 更新実行',
        navClicks: 3,       // 許可行クリック + 履歴表示 + 「🔄更新」ボタン
        inputFields: 2,     // 許可年月日, 許可有効年月日（datepicker）
        requiredFields: 2,  // 両方必須
        readonlyFields: 0,
        submitClicks: 1,    // 「更新実行」ボタン
    },
    permitChange: {
        name: '許可 変更（法14条の2）',
        description: '許可一覧 → 許可行クリック → 履歴画面 → 📝変更ボタン → フォーム入力 → 変更許可を登録',
        navClicks: 3,       // 許可行クリック + 履歴表示 + 「📝変更」ボタン
        inputFields: 1,     // 変更許可年月日（datepicker）のみ
        requiredFields: 1,  // 変更許可年月日のみ必須
        readonlyFields: 1,  // 許可有効年月日（引継ぎ）は読み取り専用
        submitClicks: 1,    // 「変更許可を登録」ボタン
    },
    editPermit: {
        name: '許可 履歴編集',
        description: '許可履歴画面 → 編集ボタン → フォーム入力 → 保存',
        navClicks: 1,       // 「編集」ボタン（履歴画面から）
        inputFields: 11,    // 許可番号, 許可区分, 許可年月日, 許可有効年月日, 優良認定,
                            // 取消日, 取消理由, 廃止日, 廃止理由 + 品目チェックボックス群
        requiredFields: 4,  // 許可番号, 許可区分, 許可年月日, 許可有効年月日
        readonlyFields: 2,  // 有効開始日時, 有効終了日時（自動設定・表示のみ）
        submitClicks: 1,    // 「保存」ボタン
        adminFields: 2,     // [管理者]パネル: 有効開始日時（手動）, 有効終了日時（手動）
    },

    // ===== 施設 =====
    newFacility: {
        name: '施設 新規追加',
        description: '事業者詳細 → 施設タブ → ＋施設追加ボタン → フォーム入力 → 保存',
        navClicks: 2,       // 「施設」タブ + 「＋施設追加」ボタン
        inputFields: 5,     // 施設種別, 設置場所, 許可番号, 許可年月日, 設置年月日
        requiredFields: 2,  // 施設種別, 設置場所
        readonlyFields: 0,
        submitClicks: 1,
    },
    editFacility: {
        name: '施設 履歴編集',
        description: '施設履歴画面 → 編集ボタン → フォーム入力 → 保存',
        navClicks: 1,       // 「編集」ボタン（履歴画面から）
        inputFields: 7,     // 施設種別, 設置場所, 許可番号, 許可年月日, 設置年月日, 廃止年月日
        requiredFields: 2,  // 施設種別, 設置場所
        readonlyFields: 2,  // 有効開始日時, 有効終了日時（自動設定）
        submitClicks: 1,
        adminFields: 2,     // [管理者]パネル: 有効開始日時（手動）, 有効終了日時（手動）
    },

    // ===== 処理能力 =====
    newCapacity: {
        name: '処理能力 新規追加',
        description: '施設編集画面 → 処理能力ボタン → ＋追加ボタン → フォーム入力 → 保存',
        navClicks: 2,       // 「処理能力」ボタン + 「＋処理能力追加」ボタン
        inputFields: 7,     // 品目, 時間処理能力, 時間単位, 日処理能力, 日単位, 稼働時間, 特記事項
        requiredFields: 1,  // 品目のみ（新規時）
        readonlyFields: 0,
        submitClicks: 1,
    },
    editCapacity: {
        name: '処理能力 編集',
        description: '処理能力一覧 → 編集ボタン → フォーム入力 → 保存',
        navClicks: 1,
        inputFields: 6,     // 品目(disabled), 時間処理能力, 時間単位, 日処理能力, 日単位, 稼働時間, 特記事項
        requiredFields: 0,  // 編集時は品目disabled、他は任意
        readonlyFields: 1,  // 品目（disabled）
        submitClicks: 1,
    },

    // ===== 車両 =====
    newVehicle: {
        name: '車両 新規追加',
        description: '事業者詳細 → 車両タブ → ＋車両追加ボタン → フォーム入力 → 保存',
        navClicks: 2,       // 「車両」タブ + 「＋車両追加」ボタン
        inputFields: 4,     // 登録番号1(地名), 登録番号2(分類番号), 登録番号3(ひらがな), 登録番号4(一連指定番号)
        requiredFields: 2,  // 登録番号1, 登録番号4（バリデーションは2つのみ）
        readonlyFields: 0,
        submitClicks: 1,
    },

    // ===== 役員 =====
    newOfficer: {
        name: '役員 新規追加',
        description: '事業者詳細 → 役員タブ → ＋役員追加ボタン → フォーム入力 → 保存',
        navClicks: 2,       // 「役員」タブ + 「＋役員追加」ボタン
        inputFields: 3,     // 役職名, 姓, 名
        requiredFields: 3,  // すべて必須
        readonlyFields: 0,
        submitClicks: 1,
    },
    editOfficer: {
        name: '役員 編集',
        description: '役員一覧 → 編集ボタン → フォーム入力 → 保存',
        navClicks: 1,
        inputFields: 3,
        requiredFields: 3,
        readonlyFields: 0,
        submitClicks: 1,
    },
};

// 全フローに totalEffort を算出
Object.values(operationFlows).forEach(flow => {
    flow.totalEffort = flow.navClicks + flow.requiredFields + flow.submitClicks;
});

// ===== テスト =====

describe('入力ステップの定量的計測', () => {
    // 事業者
    describe('事業者', () => {
        test('新規登録: 最小操作数 = 3（ナビ1 + 必須1 + 送信1）', () => {
            const f = operationFlows.newBusiness;
            expect(f.totalEffort).toBe(3);
            expect(f.inputFields).toBe(6);
            expect(f.requiredFields).toBe(1);
        });

        test('編集: 最小操作数 = 3（ナビ1 + 必須1 + 送信1）', () => {
            const f = operationFlows.editBusiness;
            expect(f.totalEffort).toBe(3);
        });
    });

    // 許可
    describe('許可', () => {
        test('新規追加: 最小操作数 = 7（ナビ2 + 必須4 + 送信1）', () => {
            const f = operationFlows.newPermit;
            expect(f.totalEffort).toBe(7);
            expect(f.inputFields).toBe(5);
            expect(f.requiredFields).toBe(4);
        });

        test('更新: 最小操作数 = 6（ナビ3 + 必須2 + 送信1）', () => {
            const f = operationFlows.permitRenewal;
            expect(f.totalEffort).toBe(6);
            expect(f.inputFields).toBe(2);
        });

        test('変更許可: 最小操作数 = 5（ナビ3 + 必須1 + 送信1）', () => {
            const f = operationFlows.permitChange;
            expect(f.totalEffort).toBe(5);
            expect(f.inputFields).toBe(1);
            expect(f.readonlyFields).toBe(1);
        });

        test('変更許可は更新許可より入力が少ない（有効期限は引き継ぎ）', () => {
            const change = operationFlows.permitChange;
            const renewal = operationFlows.permitRenewal;
            expect(change.inputFields).toBeLessThan(renewal.inputFields);
            expect(change.requiredFields).toBeLessThan(renewal.requiredFields);
        });

        test('履歴編集: フィールド数が最も多い（11項目 + 管理者2）', () => {
            const f = operationFlows.editPermit;
            expect(f.inputFields).toBe(11);
            expect(f.adminFields).toBe(2);
            expect(f.readonlyFields).toBe(2);
        });
    });

    // 施設
    describe('施設', () => {
        test('新規追加: 最小操作数 = 5（ナビ2 + 必須2 + 送信1）', () => {
            const f = operationFlows.newFacility;
            expect(f.totalEffort).toBe(5);
            expect(f.inputFields).toBe(5);
        });

        test('履歴編集: 管理者パネルあり', () => {
            const f = operationFlows.editFacility;
            expect(f.adminFields).toBe(2);
            expect(f.readonlyFields).toBe(2);
        });
    });

    // 処理能力
    describe('処理能力', () => {
        test('新規追加: 7フィールド中、必須は品目のみ', () => {
            const f = operationFlows.newCapacity;
            expect(f.inputFields).toBe(7);
            expect(f.requiredFields).toBe(1);
        });

        test('編集: 品目はdisabled（変更不可）', () => {
            const f = operationFlows.editCapacity;
            expect(f.readonlyFields).toBe(1);
        });
    });

    // 車両
    describe('車両', () => {
        test('新規追加: 4フィールド、必須2（登録番号1と4）', () => {
            const f = operationFlows.newVehicle;
            expect(f.inputFields).toBe(4);
            expect(f.requiredFields).toBe(2);
        });
    });

    // 役員
    describe('役員', () => {
        test('新規追加: 3フィールド、全て必須', () => {
            const f = operationFlows.newOfficer;
            expect(f.inputFields).toBe(3);
            expect(f.requiredFields).toBe(3);
        });

        test('編集: 新規と同じフィールド数', () => {
            expect(operationFlows.editOfficer.inputFields).toBe(operationFlows.newOfficer.inputFields);
        });
    });

    // 横断的比較
    describe('横断的比較', () => {
        test('全操作フローの totalEffort は 20 以下', () => {
            Object.entries(operationFlows).forEach(([key, flow]) => {
                expect(flow.totalEffort).toBeLessThanOrEqual(20);
            });
        });

        test('最も操作数が多いのは許可新規追加（totalEffort = 7）', () => {
            const efforts = Object.entries(operationFlows)
                .map(([key, flow]) => ({ key, effort: flow.totalEffort }))
                .sort((a, b) => b.effort - a.effort);
            expect(efforts[0].key).toBe('newPermit');
        });

        test('最も操作数が少ないのは処理能力編集（totalEffort = 2）', () => {
            const efforts = Object.entries(operationFlows)
                .map(([key, flow]) => ({ key, effort: flow.totalEffort }))
                .sort((a, b) => a.effort - b.effort);
            expect(efforts[0].key).toBe('editCapacity');
            expect(efforts[0].effort).toBe(2);
        });

        test('サマリーテーブル出力', () => {
            const rows = Object.entries(operationFlows).map(([key, flow]) => ({
                操作: flow.name,
                ナビ: flow.navClicks,
                入力欄: flow.inputFields,
                必須: flow.requiredFields,
                読取専用: flow.readonlyFields,
                送信: flow.submitClicks,
                最小操作数: flow.totalEffort,
            }));

            // テーブル形式で出力
            console.table(rows);

            // 全フロー数の検証
            expect(rows.length).toBe(13);
        });
    });
});

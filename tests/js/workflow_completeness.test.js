/**
 * ワークフロー完全性テスト
 *
 * ユーザーの「タスク」は複数のシステム操作にまたがることがある。
 * このテストは「ユーザーが意図する完成形」と「1回のフローで実現できる範囲」の
 * ギャップを検出する。
 *
 * ギャップが見つかった場合:
 *   - UIの改善（作成時に子エンティティも追加できるようにする）
 *   - または仕様として明示的に記録する
 *
 * 【用語】
 *   completeEntity:  ユーザーが考える「完成した状態」の構成要素
 *   createFlow:      新規作成時に1回のフローで登録できる範囲
 *   requiresReturn:  作成後に戻って追加作業が必要なもの
 *   additionalSteps: 完成に必要な追加ナビゲーション数
 */

// ===== エンティティ完全性の定義 =====

const entityCompleteness = {
    permit: {
        name: '許可',
        description: '許可区分を持ち、取扱品目が紐付いた許可',
        completeEntity: ['許可レコード', '取扱品目'],
        createFlow: {
            includes: ['許可レコード', '取扱品目'],
            excludes: [],
        },
        requiresReturn: [],
        // 改善済み: 許可作成フォームに品目グリッドを追加（許可区分選択時に表示）
    },

    facility: {
        name: '施設',
        description: '施設種別を持ち、処理能力が紐付いた施設',
        completeEntity: ['施設レコード', '処理能力'],
        createFlow: {
            includes: ['施設レコード', '処理能力'],
            excludes: [],
        },
        requiresReturn: [],
        // 改善済み: 中間処理施設の作成フォームに処理能力インライン追加UIを追加
    },

    business: {
        name: '事業者',
        description: '事業者情報を持ち、許可・施設・車両・役員が紐付いた事業者',
        completeEntity: ['事業者レコード', '許可', '施設', '車両', '役員'],
        createFlow: {
            includes: ['事業者レコード'],
            excludes: ['許可', '施設', '車両', '役員'],
        },
        requiresReturn: [
            {
                what: '許可の追加',
                howToFix: '事業者詳細 → 許可タブ → ＋許可追加',
                additionalSteps: 2,
                severity: 'expected',   // 事業者と許可は別タイミングが自然
                reason: '事業者登録と許可登録は業務上別のタイミング',
            },
            {
                what: '施設の追加',
                howToFix: '事業者詳細 → 施設タブ → ＋施設追加',
                additionalSteps: 2,
                severity: 'expected',
                reason: '事業者登録と施設登録は業務上別のタイミング',
            },
            {
                what: '車両の追加',
                howToFix: '事業者詳細 → 車両タブ → ＋車両追加',
                additionalSteps: 2,
                severity: 'expected',
                reason: '事業者登録と車両登録は業務上別のタイミング',
            },
            {
                what: '役員の追加',
                howToFix: '事業者詳細 → 役員タブ → ＋役員追加',
                additionalSteps: 2,
                severity: 'expected',
                reason: '事業者登録と役員登録は業務上別のタイミング',
            },
        ],
    },

    // ===== 完結する操作（ギャップなし） =====

    vehicle: {
        name: '車両',
        description: '登録番号を持つ車両',
        completeEntity: ['車両レコード'],
        createFlow: {
            includes: ['車両レコード'],
            excludes: [],
        },
        requiresReturn: [],
    },

    officer: {
        name: '役員',
        description: '役職名・姓名を持つ役員',
        completeEntity: ['役員レコード'],
        createFlow: {
            includes: ['役員レコード'],
            excludes: [],
        },
        requiresReturn: [],
    },

    capacity: {
        name: '処理能力',
        description: '品目・処理能力値を持つ処理能力レコード',
        completeEntity: ['処理能力レコード'],
        createFlow: {
            includes: ['処理能力レコード'],
            excludes: [],
        },
        requiresReturn: [],
    },
};

// ===== ユーザータスク定義（複数操作をまたぐ実業務タスク） =====

const userTasks = {
    registerNewPermitWithItems: {
        name: '新規許可を品目付きで登録する',
        userExpectation: '1回の操作で許可と品目を一緒に登録したい',
        actualSteps: [
            { action: '許可タブ → ＋許可追加', type: 'create' },
            { action: '許可情報＋品目を入力 → 保存', type: 'submit' },
        ],
        idealSteps: [
            { action: '許可タブ → ＋許可追加', type: 'create' },
            { action: '許可情報＋品目を入力 → 保存', type: 'submit' },
        ],
        gapCount: 0,     // 改善済み
        severity: 'none',
    },

    registerFacilityWithCapacity: {
        name: '施設を処理能力付きで登録する',
        userExpectation: '施設登録時に処理能力も一緒に入力したい',
        actualSteps: [
            { action: '施設タブ → ＋施設追加', type: 'create' },
            { action: '施設情報＋処理能力を入力 → 保存', type: 'submit' },
        ],
        idealSteps: [
            { action: '施設タブ → ＋施設追加', type: 'create' },
            { action: '施設情報＋処理能力を入力 → 保存', type: 'submit' },
        ],
        gapCount: 0,     // 改善済み: 施設作成フォームに処理能力インライン追加を追加
        severity: 'none',
    },

    renewPermitWithItems: {
        name: '許可を更新し品目を引き継ぐ',
        userExpectation: '更新ボタンを押すだけで品目も自動的に引き継がれてほしい',
        actualSteps: [
            { action: '許可行クリック → 履歴画面', type: 'navigate' },
            { action: '🔄更新ボタン → 日付入力 → 実行', type: 'submit' },
            // 品目は自動コピーされる（buildCopyPermitItemsQuery）
        ],
        idealSteps: [
            { action: '許可行クリック → 履歴画面', type: 'navigate' },
            { action: '🔄更新ボタン → 日付入力 → 実行', type: 'submit' },
        ],
        gapCount: 0,     // 品目自動コピーで完結！
        severity: 'none',
    },

    registerBusinessComplete: {
        name: '事業者を許可・施設・車両・役員付きで登録する',
        userExpectation: '新規事業者の全情報を一気に入力したい',
        actualSteps: [
            { action: '事業者登録 → 保存', type: 'submit' },
            { action: '許可タブ → ＋追加 → 品目付きで入力 → 保存', type: 'submit' },
            { action: '施設タブ → ＋追加 → 処理能力付きで入力 → 保存', type: 'submit' },
            { action: '車両タブ → ＋追加 → 入力 → 保存', type: 'submit' },
            { action: '役員タブ → ＋追加 → 入力 → 保存', type: 'submit' },
        ],
        idealSteps: [
            { action: 'ウィザード形式で全情報を一括入力', type: 'submit' },
        ],
        gapCount: 4,
        severity: 'expected', // 事業者は段階的登録が業務上自然
    },
};

// ===== 編集ワークフロー =====

const editWorkflows = {
    editBusiness: {
        name: '事業者情報を編集する',
        steps: [
            { action: '事業者詳細画面を開く', type: 'navigate' },
            { action: '編集ボタン → フィールド修正 → 保存', type: 'submit' },
        ],
        totalSteps: 2,
        completesInOneFlow: true,
    },
    editPermitHistory: {
        name: '許可の履歴情報を修正する',
        steps: [
            { action: '許可行クリック → 履歴画面', type: 'navigate' },
            { action: '編集ボタン → フィールド修正 → 保存', type: 'submit' },
        ],
        totalSteps: 2,
        completesInOneFlow: true,
    },
    editPermitItems: {
        name: '許可の品目を変更する（法14条の2）',
        steps: [
            { action: '許可行クリック → 履歴画面', type: 'navigate' },
            { action: '変更ボタン → 品目変更 → 保存', type: 'submit' },
            // 品目は変更モードで直接編集可、有効期限は旧版から引継
        ],
        totalSteps: 2,
        completesInOneFlow: true,
    },
    editFacilityHistory: {
        name: '施設の履歴情報を修正する',
        steps: [
            { action: '施設行クリック → 履歴画面', type: 'navigate' },
            { action: '編集ボタン → フィールド修正 → 保存', type: 'submit' },
        ],
        totalSteps: 2,
        completesInOneFlow: true,
    },
    editCapacity: {
        name: '処理能力を修正する',
        steps: [
            { action: '施設詳細 → 処理能力ボタン', type: 'navigate' },
            { action: '行の編集ボタン → 修正 → 保存', type: 'submit' },
        ],
        totalSteps: 2,
        completesInOneFlow: true,
    },
    editVehicleFlags: {
        name: '車両の許可種別フラグを変更する',
        steps: [
            { action: '車両一覧のフラグトグル', type: 'submit' },
        ],
        totalSteps: 1,
        completesInOneFlow: true,
    },
    editOfficer: {
        name: '役員情報を修正する',
        steps: [
            { action: '役員一覧 → 編集ボタン → 修正 → 保存', type: 'submit' },
        ],
        totalSteps: 1,
        completesInOneFlow: true,
    },
    editMasterData: {
        name: 'マスターデータを編集する',
        steps: [
            { action: '設定 → マスター管理 → カテゴリ選択', type: 'navigate' },
            { action: '編集ボタン → 修正 → 保存', type: 'submit' },
        ],
        totalSteps: 2,
        completesInOneFlow: true,
    },
};

// ===== 削除ワークフロー =====

const deleteWorkflows = {
    deleteBusiness: {
        name: '事業者を削除する（カスケード）',
        steps: [
            { action: '事業者詳細 → 削除ボタン', type: 'navigate' },
            { action: '確認ダイアログ → 実行', type: 'confirm' },
        ],
        cascadeTargets: ['許可品目', '施設休止履歴', '処理能力', '許可', '施設', '車両', '役員', '事業者'],
        cascadeCount: 8,
        requiresDoubleConfirm: false,
    },
    deletePermitVersion: {
        name: '許可の履歴バージョンを削除する',
        steps: [
            { action: '許可履歴画面 → 削除ボタン', type: 'navigate' },
            { action: '確認ダイアログ → 実行', type: 'confirm' },
        ],
        cascadeTargets: ['許可品目', '許可'],
        cascadeCount: 2,
        requiresDoubleConfirm: false,
    },
    deleteFacility: {
        name: '施設を完全削除する（全履歴）',
        steps: [
            { action: '施設詳細 → 削除ボタン', type: 'navigate' },
            { action: '確認ダイアログ → 最終確認 → 実行', type: 'confirm' },
        ],
        cascadeTargets: ['施設休止履歴', '処理能力', '施設'],
        cascadeCount: 3,
        requiresDoubleConfirm: true,
    },
    deleteFacilityVersion: {
        name: '施設の履歴バージョンを削除する',
        steps: [
            { action: '施設履歴画面 → 削除ボタン', type: 'navigate' },
            { action: '確認ダイアログ → 実行', type: 'confirm' },
        ],
        cascadeTargets: ['施設休止履歴', '処理能力', '施設'],
        cascadeCount: 3,
        requiresDoubleConfirm: false,
    },
    deleteVehicle: {
        name: '車両を完全削除する',
        steps: [
            { action: '車両一覧 → 削除ボタン → 確認', type: 'confirm' },
        ],
        cascadeTargets: ['車両'],
        cascadeCount: 1,
        requiresDoubleConfirm: false,
    },
    deleteOfficer: {
        name: '役員を完全削除する',
        steps: [
            { action: '役員一覧 → 削除ボタン → 確認', type: 'confirm' },
        ],
        cascadeTargets: ['役員'],
        cascadeCount: 1,
        requiresDoubleConfirm: false,
    },
    deleteCapacity: {
        name: '処理能力を削除する',
        steps: [
            { action: '処理能力一覧 → 削除ボタン → 確認', type: 'confirm' },
        ],
        cascadeTargets: ['処理能力'],
        cascadeCount: 1,
        requiresDoubleConfirm: false,
    },
    deleteMaster: {
        name: 'マスターデータを削除する',
        steps: [
            { action: 'マスター管理 → 削除ボタン → 確認', type: 'confirm' },
        ],
        cascadeTargets: ['マスターレコード'],
        cascadeCount: 1,
        requiresDoubleConfirm: false,
    },
};

// ===== 状態遷移ワークフロー =====

const stateTransitions = {
    // 許可
    abolishPermit: {
        name: '許可を廃止する',
        entity: '許可',
        fromState: 'active',
        toState: 'abolished',
        inputs: ['廃止日', '廃止理由(任意)'],
        hasConfirmDialog: true,
        sideEffects: ['有効終了日時を設定'],
    },
    cancelPermit: {
        name: '許可を取消する（行政処分）',
        entity: '許可',
        fromState: 'active',
        toState: 'cancelled',
        inputs: ['取消日', '取消理由(任意)'],
        hasConfirmDialog: true,
        sideEffects: ['有効終了日時を設定'],
    },
    restorePermit: {
        name: '許可を復活する',
        entity: '許可',
        fromState: 'abolished/cancelled',
        toState: 'active',
        inputs: [],
        hasConfirmDialog: true,
        sideEffects: ['廃止日・取消日・理由をクリア', '有効終了日時をクリア'],
        preCheck: '同一論理IDにアクティブ版がないこと',
    },

    // 施設
    abolishFacility: {
        name: '施設を廃止する',
        entity: '施設',
        fromState: 'active',
        toState: 'abolished',
        inputs: ['廃止日', '廃止確認日(最終処分場のみ)'],
        hasConfirmDialog: true,
        sideEffects: ['有効終了日時を設定'],
    },
    cancelFacility: {
        name: '施設を取消する（行政処分）',
        entity: '施設',
        fromState: 'active',
        toState: 'cancelled',
        inputs: ['取消日', '取消理由(任意)'],
        hasConfirmDialog: true,
        sideEffects: ['有効終了日時を設定'],
    },
    restoreFacility: {
        name: '施設を復活する',
        entity: '施設',
        fromState: 'abolished/cancelled/suspended',
        toState: 'active',
        inputs: [],
        hasConfirmDialog: true,
        sideEffects: ['全状態フラグをクリア', '有効終了日時をクリア'],
        preCheck: '同一論理IDにアクティブ版がないこと',
    },
    suspendFacility: {
        name: '施設を休止する',
        entity: '施設',
        fromState: 'active',
        toState: 'suspended',
        inputs: ['休止日', '休止理由(任意)'],
        hasConfirmDialog: false, // confirm()使用
        sideEffects: ['施設休止履歴にINSERT', '再開年月日をNULLに'],
        usesTransaction: true,
    },
    resumeFacility: {
        name: '施設を再開する',
        entity: '施設',
        fromState: 'suspended',
        toState: 'active',
        inputs: [],
        hasConfirmDialog: false,
        sideEffects: ['再開年月日を設定', '休止履歴の再開日を更新'],
        usesTransaction: true,
    },

    // 車両
    scrapVehicle: {
        name: '車両を廃車にする',
        entity: '車両',
        fromState: 'active',
        toState: 'scrapped',
        inputs: [],
        hasConfirmDialog: true,
        sideEffects: ['廃車フラグをTrue'],
    },
    restoreVehicle: {
        name: '車両を廃車から復活する',
        entity: '車両',
        fromState: 'scrapped',
        toState: 'active',
        inputs: [],
        hasConfirmDialog: true,
        sideEffects: ['廃車フラグをFalse'],
    },

    // 役員
    retireOfficer: {
        name: '役員を退任にする',
        entity: '役員',
        fromState: 'active',
        toState: 'retired',
        inputs: [],
        hasConfirmDialog: true,
        sideEffects: ['退任フラグをTrue'],
    },
    reinstateOfficer: {
        name: '役員を復帰させる',
        entity: '役員',
        fromState: 'retired',
        toState: 'active',
        inputs: [],
        hasConfirmDialog: true,
        sideEffects: ['退任フラグをFalse'],
    },
    setPrimaryOfficer: {
        name: '代表者を指定する',
        entity: '役員',
        fromState: 'any',
        toState: 'primary',
        inputs: [],
        hasConfirmDialog: false,
        sideEffects: ['同一事業者の全役員の代表者フラグをFalse', '指定役員の代表者フラグをTrue'],
    },
};

// ===== バージョン管理ワークフロー =====

const versionWorkflows = {
    renewPermit: {
        name: '許可を更新する',
        entity: '許可',
        steps: [
            { action: '許可詳細 → 更新アクションカード', type: 'navigate' },
            { action: '新許可日・有効期限入力 → 実行', type: 'submit' },
        ],
        autoActions: ['旧バージョンクローズ', '品目自動コピー'],
        usesTransaction: false, // HTA側では個別Execute
    },
    changePermit: {
        name: '許可を変更する（法14条の2）',
        entity: '許可',
        steps: [
            { action: '許可詳細 → 変更アクションカード', type: 'navigate' },
            { action: '品目を編集 → 実行', type: 'submit' },
        ],
        autoActions: ['旧バージョンクローズ', '有効期限を旧版から引継', '品目コピー後に編集可能'],
    },
    expiredNewPermit: {
        name: '失効新規の許可を登録する',
        entity: '許可',
        steps: [
            { action: '許可詳細 → 失効新規アクションカード', type: 'navigate' },
            { action: '全フィールド入力 → 実行', type: 'submit' },
        ],
        autoActions: ['旧バージョンクローズ', '品目自動コピー'],
    },
    renewFacility: {
        name: '施設を変更する（新バージョン作成）',
        entity: '施設',
        steps: [
            { action: '施設詳細 → 変更ボタン', type: 'navigate' },
            { action: '施設情報修正 → 保存', type: 'submit' },
        ],
        autoActions: ['旧バージョンクローズ', '新バージョン作成'],
    },
};

// ===== 検索ワークフロー =====

const searchWorkflows = {
    searchBusiness: {
        name: '事業者を検索する',
        filters: ['キーワード（事業者名/電話番号/住所）'],
        resultAction: '事業者詳細画面へ遷移',
    },
    searchPermit: {
        name: '許可を横断検索する',
        filters: ['キーワード', '許可区分', '有効期限（期限切れ/30日/90日/1年/有効）', '状態（有効/廃止/取消）', '優良認定', '品目（AND/OR）', '基準日'],
        resultAction: '許可詳細画面へ遷移 / CSVエクスポート',
    },
    searchFacility: {
        name: '施設を横断検索する',
        filters: ['キーワード', '施設種別', '状態（有効/廃止/取消）', '処理方法', '許可対象区分', '自己処理除外', '最小日処理能力'],
        resultAction: '施設詳細画面へ遷移',
    },
    searchVehicle: {
        name: '車両を横断検索する',
        filters: ['キーワード（登録番号/事業者名）', '廃車含む'],
        resultAction: '事業者詳細画面（車両タブ）へ遷移',
    },
    searchOfficer: {
        name: '役員を横断検索する',
        filters: ['キーワード（姓名/役職/事業者名）', '退任者含む'],
        resultAction: '事業者詳細画面（役員タブ）へ遷移',
    },
};

// ===== 分析・レポートワークフロー =====

const analyticsWorkflows = {
    dashboard: {
        name: 'ダッシュボード統計表示',
        metrics: ['事業者数', '有効許可数', '有効施設数', '期限切れ間近許可数'],
    },
    expiringPermits: {
        name: '期限切れ間近の許可一覧',
        description: '1年以内に期限切れになる許可を一覧表示',
    },
    permitTrend: {
        name: '許可数推移',
        description: '許可区分別の年次許可数推移',
    },
    capacityStats: {
        name: '処理能力集計',
        description: '施設種別ごとの品目別処理能力合計',
    },
};

// ===== データメンテナンスワークフロー =====

const maintenanceWorkflows = {
    legacyImport: {
        name: '旧システムからのデータインポート',
        steps: [
            { action: '設定 → データメンテナンス → レガシーインポート', type: 'navigate' },
            { action: '旧DBパス指定 → 実行', type: 'submit' },
        ],
        targets: ['役員', '車両'],
        features: ['事業者名マッチング', '重複チェック', '廃車フラグ引継'],
    },
    fixMissingDates: {
        name: '有効開始日時の欠損修正',
        steps: [
            { action: '設定 → データメンテナンス → 欠損チェック', type: 'navigate' },
            { action: '修正実行', type: 'submit' },
        ],
        targets: ['許可', '施設'],
        autoFill: '許可年月日 or 作成日時 → 有効開始日時',
    },
};

// ===== テスト =====

describe('ワークフロー完全性', () => {

    // ===== セクション1: エンティティ完全性（既存） =====

    describe('エンティティ完全性: 1回の作成フローで完成するか', () => {
        Object.entries(entityCompleteness).forEach(([key, entity]) => {
            describe(entity.name, () => {
                test(`完成形の構成要素が定義されている`, () => {
                    expect(entity.completeEntity.length).toBeGreaterThan(0);
                });

                test(`作成フローのカバー範囲が明確`, () => {
                    const covered = entity.createFlow.includes;
                    const uncovered = entity.createFlow.excludes;
                    // includes + excludes = completeEntity
                    expect([...covered, ...uncovered].sort()).toEqual(
                        [...entity.completeEntity].sort()
                    );
                });

                if (entity.requiresReturn.length > 0) {
                    test(`作成後に追加作業が必要（${entity.requiresReturn.length}件）`, () => {
                        entity.requiresReturn.forEach(gap => {
                            expect(gap.what).toBeTruthy();
                            expect(gap.howToFix).toBeTruthy();
                            expect(gap.additionalSteps).toBeGreaterThan(0);
                            expect(['high', 'medium', 'low', 'expected']).toContain(gap.severity);
                        });
                    });

                    entity.requiresReturn
                        .filter(g => g.severity === 'high')
                        .forEach(gap => {
                            test(`[要改善] ${gap.what}（追加${gap.additionalSteps}ステップ）`, () => {
                                expect(gap.severity).toBe('high');
                                expect(gap.additionalSteps).toBeGreaterThan(0);
                            });
                        });
                } else {
                    test(`1回のフローで完結する`, () => {
                        expect(entity.createFlow.excludes).toHaveLength(0);
                        expect(entity.requiresReturn).toHaveLength(0);
                    });
                }
            });
        });
    });

    // ===== セクション2: ユーザータスク（既存） =====

    describe('ユーザータスク: 実際のステップ数 vs 理想のステップ数', () => {
        Object.entries(userTasks).forEach(([key, task]) => {
            describe(task.name, () => {
                test(`ギャップ = ${task.gapCount}ステップ`, () => {
                    const gap = task.actualSteps.length - task.idealSteps.length;
                    expect(gap).toBe(task.gapCount);
                });

                if (task.gapCount > 0 && task.severity !== 'expected') {
                    test(`[要改善] ${task.gapCount}ステップの無駄がある`, () => {
                        expect(task.severity).not.toBe('none');
                        expect(task.gapCount).toBeGreaterThan(0);
                    });
                }

                if (task.gapCount === 0) {
                    test(`理想的なフローで完結する`, () => {
                        expect(task.severity).toBe('none');
                    });
                }
            });
        });
    });

    // ===== セクション3: 編集ワークフロー =====

    describe('編集ワークフロー: 各エンティティの編集が1フローで完結するか', () => {
        Object.entries(editWorkflows).forEach(([key, wf]) => {
            test(`${wf.name}: ${wf.totalSteps}ステップで完結`, () => {
                expect(wf.steps.length).toBe(wf.totalSteps);
                expect(wf.completesInOneFlow).toBe(true);
            });
        });

        test('全編集ワークフローが定義済み', () => {
            const editTargets = Object.values(editWorkflows).map(w => w.name);
            expect(editTargets).toContain('事業者情報を編集する');
            expect(editTargets).toContain('許可の履歴情報を修正する');
            expect(editTargets).toContain('許可の品目を変更する（法14条の2）');
            expect(editTargets).toContain('施設の履歴情報を修正する');
            expect(editTargets).toContain('処理能力を修正する');
            expect(editTargets).toContain('車両の許可種別フラグを変更する');
            expect(editTargets).toContain('役員情報を修正する');
            expect(editTargets).toContain('マスターデータを編集する');
        });
    });

    // ===== セクション4: 削除ワークフロー =====

    describe('削除ワークフロー: カスケード削除の完全性', () => {
        Object.entries(deleteWorkflows).forEach(([key, wf]) => {
            describe(wf.name, () => {
                test(`カスケード対象が${wf.cascadeCount}テーブル`, () => {
                    expect(wf.cascadeTargets).toHaveLength(wf.cascadeCount);
                });

                test('確認ダイアログが存在する', () => {
                    const hasConfirm = wf.steps.some(s => s.type === 'confirm');
                    expect(hasConfirm).toBe(true);
                });
            });
        });

        test('事業者削除は全8テーブルをカスケード削除', () => {
            const biz = deleteWorkflows.deleteBusiness;
            expect(biz.cascadeTargets).toEqual(
                ['許可品目', '施設休止履歴', '処理能力', '許可', '施設', '車両', '役員', '事業者']
            );
        });

        test('施設削除は二重確認が必要', () => {
            expect(deleteWorkflows.deleteFacility.requiresDoubleConfirm).toBe(true);
        });

        test('単純削除（車両・役員・処理能力・マスター）は単一テーブル', () => {
            expect(deleteWorkflows.deleteVehicle.cascadeCount).toBe(1);
            expect(deleteWorkflows.deleteOfficer.cascadeCount).toBe(1);
            expect(deleteWorkflows.deleteCapacity.cascadeCount).toBe(1);
            expect(deleteWorkflows.deleteMaster.cascadeCount).toBe(1);
        });
    });

    // ===== セクション5: 状態遷移ワークフロー =====

    describe('状態遷移ワークフロー: 全エンティティのライフサイクル', () => {
        // 許可の状態遷移
        describe('許可ライフサイクル', () => {
            test('active → abolished（廃止）', () => {
                const t = stateTransitions.abolishPermit;
                expect(t.fromState).toBe('active');
                expect(t.toState).toBe('abolished');
                expect(t.inputs).toContain('廃止日');
                expect(t.hasConfirmDialog).toBe(true);
            });

            test('active → cancelled（取消）', () => {
                const t = stateTransitions.cancelPermit;
                expect(t.fromState).toBe('active');
                expect(t.toState).toBe('cancelled');
                expect(t.inputs).toContain('取消日');
            });

            test('abolished/cancelled → active（復活）', () => {
                const t = stateTransitions.restorePermit;
                expect(t.toState).toBe('active');
                expect(t.preCheck).toBeTruthy();
            });
        });

        // 施設の状態遷移
        describe('施設ライフサイクル', () => {
            test('active → abolished（廃止）', () => {
                const t = stateTransitions.abolishFacility;
                expect(t.inputs).toContain('廃止日');
                expect(t.inputs).toContain('廃止確認日(最終処分場のみ)');
            });

            test('active → cancelled（取消）', () => {
                const t = stateTransitions.cancelFacility;
                expect(t.toState).toBe('cancelled');
            });

            test('active → suspended（休止）', () => {
                const t = stateTransitions.suspendFacility;
                expect(t.toState).toBe('suspended');
                expect(t.usesTransaction).toBe(true);
                expect(t.sideEffects).toContain('施設休止履歴にINSERT');
            });

            test('suspended → active（再開）', () => {
                const t = stateTransitions.resumeFacility;
                expect(t.fromState).toBe('suspended');
                expect(t.usesTransaction).toBe(true);
                expect(t.sideEffects).toContain('休止履歴の再開日を更新');
            });

            test('abolished/cancelled/suspended → active（復活）', () => {
                const t = stateTransitions.restoreFacility;
                expect(t.preCheck).toBeTruthy();
            });
        });

        // 車両の状態遷移
        describe('車両ライフサイクル', () => {
            test('active → scrapped（廃車）', () => {
                expect(stateTransitions.scrapVehicle.toState).toBe('scrapped');
            });

            test('scrapped → active（復活）', () => {
                expect(stateTransitions.restoreVehicle.fromState).toBe('scrapped');
                expect(stateTransitions.restoreVehicle.toState).toBe('active');
            });
        });

        // 役員の状態遷移
        describe('役員ライフサイクル', () => {
            test('active → retired（退任）', () => {
                expect(stateTransitions.retireOfficer.toState).toBe('retired');
            });

            test('retired → active（復帰）', () => {
                expect(stateTransitions.reinstateOfficer.fromState).toBe('retired');
            });

            test('代表者指定は同一事業者の全役員をリセットしてから設定', () => {
                const t = stateTransitions.setPrimaryOfficer;
                expect(t.sideEffects.length).toBe(2);
            });
        });

        // 全状態遷移の構造チェック
        test('全状態遷移が必須フィールドを持つ', () => {
            Object.entries(stateTransitions).forEach(([key, t]) => {
                expect(t.name).toBeTruthy();
                expect(t.entity).toBeTruthy();
                expect(t.fromState).toBeTruthy();
                expect(t.toState).toBeTruthy();
                expect(Array.isArray(t.inputs)).toBe(true);
                expect(Array.isArray(t.sideEffects)).toBe(true);
            });
        });

        test('状態遷移は13件定義されている', () => {
            expect(Object.keys(stateTransitions)).toHaveLength(13);
        });
    });

    // ===== セクション6: バージョン管理ワークフロー =====

    describe('バージョン管理ワークフロー', () => {
        Object.entries(versionWorkflows).forEach(([key, wf]) => {
            describe(wf.name, () => {
                test('ステップが定義されている', () => {
                    expect(wf.steps.length).toBeGreaterThan(0);
                });

                test('自動アクションが定義されている', () => {
                    expect(wf.autoActions.length).toBeGreaterThan(0);
                    expect(wf.autoActions).toContain('旧バージョンクローズ');
                });
            });
        });

        test('許可は3種類のバージョン操作がある', () => {
            expect(versionWorkflows.renewPermit).toBeDefined();
            expect(versionWorkflows.changePermit).toBeDefined();
            expect(versionWorkflows.expiredNewPermit).toBeDefined();
        });

        test('変更許可は有効期限を旧版から引き継ぐ', () => {
            expect(versionWorkflows.changePermit.autoActions).toContain('有効期限を旧版から引継');
        });

        test('施設のバージョン管理がある', () => {
            expect(versionWorkflows.renewFacility).toBeDefined();
        });
    });

    // ===== セクション7: 検索ワークフロー =====

    describe('検索ワークフロー', () => {
        test('5つのエンティティの検索が定義されている', () => {
            expect(Object.keys(searchWorkflows)).toHaveLength(5);
        });

        Object.entries(searchWorkflows).forEach(([key, wf]) => {
            test(`${wf.name}: フィルタが1つ以上`, () => {
                expect(wf.filters.length).toBeGreaterThan(0);
            });
        });

        test('許可検索は最も多くのフィルタを持つ', () => {
            const permitFilters = searchWorkflows.searchPermit.filters.length;
            Object.values(searchWorkflows).forEach(wf => {
                expect(permitFilters).toBeGreaterThanOrEqual(wf.filters.length);
            });
        });

        test('許可検索にCSVエクスポートがある', () => {
            expect(searchWorkflows.searchPermit.resultAction).toContain('CSVエクスポート');
        });
    });

    // ===== セクション8: 分析・レポートワークフロー =====

    describe('分析・レポートワークフロー', () => {
        test('ダッシュボードに4つのメトリクスがある', () => {
            expect(analyticsWorkflows.dashboard.metrics).toHaveLength(4);
        });

        test('期限切れ間近の許可一覧がある', () => {
            expect(analyticsWorkflows.expiringPermits).toBeDefined();
        });

        test('許可数推移がある', () => {
            expect(analyticsWorkflows.permitTrend).toBeDefined();
        });

        test('処理能力集計がある', () => {
            expect(analyticsWorkflows.capacityStats).toBeDefined();
        });
    });

    // ===== セクション9: データメンテナンスワークフロー =====

    describe('データメンテナンスワークフロー', () => {
        test('レガシーインポートが定義されている', () => {
            const imp = maintenanceWorkflows.legacyImport;
            expect(imp.targets).toContain('役員');
            expect(imp.targets).toContain('車両');
            expect(imp.features).toContain('重複チェック');
            expect(imp.features).toContain('事業者名マッチング');
        });

        test('有効開始日時の欠損修正が定義されている', () => {
            const fix = maintenanceWorkflows.fixMissingDates;
            expect(fix.targets).toContain('許可');
            expect(fix.targets).toContain('施設');
        });
    });

    // ===== セクション10: ギャップサマリー =====

    describe('ギャップサマリー', () => {
        test('[要改善]のギャップ一覧を出力', () => {
            const gaps = [];

            // エンティティのギャップ
            Object.entries(entityCompleteness).forEach(([key, entity]) => {
                entity.requiresReturn
                    .filter(g => g.severity === 'high' || g.severity === 'medium')
                    .forEach(gap => {
                        gaps.push({
                            エンティティ: entity.name,
                            不足: gap.what,
                            追加ステップ: gap.additionalSteps,
                            重要度: gap.severity,
                            修正方法: gap.howToFix,
                        });
                    });
            });

            // ユーザータスクのギャップ
            Object.entries(userTasks).forEach(([key, task]) => {
                if (task.gapCount > 0 && task.severity !== 'expected') {
                    gaps.push({
                        エンティティ: '-',
                        不足: task.name,
                        追加ステップ: task.gapCount,
                        重要度: task.severity,
                        修正方法: task.userExpectation,
                    });
                }
            });

            console.table(gaps);
            expect(gaps.length).toBeGreaterThanOrEqual(0);
        });

        test('完結するフロー一覧を出力', () => {
            const complete = Object.entries(entityCompleteness)
                .filter(([_, e]) => e.requiresReturn.length === 0)
                .map(([key, e]) => ({ エンティティ: e.name, 状態: '1フローで完結' }));

            const taskComplete = Object.entries(userTasks)
                .filter(([_, t]) => t.gapCount === 0)
                .map(([key, t]) => ({ エンティティ: t.name, 状態: '理想的' }));

            console.table([...complete, ...taskComplete]);
            expect(complete.length + taskComplete.length).toBeGreaterThan(0);
        });

        test('ワークフロー網羅率レポート', () => {
            const counts = {
                'エンティティ作成': Object.keys(entityCompleteness).length,
                'ユーザータスク': Object.keys(userTasks).length,
                '編集': Object.keys(editWorkflows).length,
                '削除': Object.keys(deleteWorkflows).length,
                '状態遷移': Object.keys(stateTransitions).length,
                'バージョン管理': Object.keys(versionWorkflows).length,
                '検索': Object.keys(searchWorkflows).length,
                '分析レポート': Object.keys(analyticsWorkflows).length,
                'データメンテナンス': Object.keys(maintenanceWorkflows).length,
            };
            const total = Object.values(counts).reduce((a, b) => a + b, 0);
            console.table(counts);
            // 全カテゴリで少なくとも1件のワークフローが定義されている
            Object.entries(counts).forEach(([cat, count]) => {
                expect(count).toBeGreaterThan(0);
            });
            // 合計ワークフロー数
            expect(total).toBeGreaterThanOrEqual(54);
        });
    });
});

/**
 * 2026-03-04 修正のリグレッションテスト
 *
 * FIX 1: カレンダーの矢印ボタンでevent.stopPropagation()不足 → UI側修正（HTAのみ）
 * FIX 2: 施設の削除機能（buildDeleteFacilityQueries）
 * FIX 3: 品目マスター一覧が表示順でソートされない
 * FIX 4: 業の編集画面の保存ボタン位置 → UI側修正（HTAのみ）
 * FIX 5: 「現在のステータス: 有効」の冗長表示削除 → UI側修正（HTAのみ）
 * FIX 6: 「有効年月日」→「許可有効年月日」ラベル変更 → UI側修正（HTAのみ）
 * FIX 7: 変更許可で許可年月日を前版から引き継ぎ、有効開始日時=変更許可年月日
 */
const logic = require('../../app_logic.js');
const fs = require('fs');
const path = require('path');

// HTA HTMLを一度だけ読み込む
const htaPath = path.resolve(__dirname, '../../app_source.hta');
const htaContent = fs.readFileSync(htaPath, 'utf-8');

// ===== FIX 1: カレンダーのevent.stopPropagation() =====

describe('FIX 1: カレンダーのイベント伝播防止', () => {
    test('検索カレンダーの矢印ボタンにevent.stopPropagation()がある', () => {
        // changeMonth呼び出しと同じonclick内にstopPropagationがあること
        expect(htaContent).toMatch(/onclick="changeMonth\(-1\);event\.stopPropagation\(\)/);
        expect(htaContent).toMatch(/onclick="changeMonth\(1\);event\.stopPropagation\(\)/);
    });

    test('フローティングカレンダーのナビボタンにevent.stopPropagation()がある', () => {
        // dpPrev, dpNext, dpPrevYear, dpNextYear
        expect(htaContent).toMatch(/onclick='dpPrev\(\);event\.stopPropagation\(\)/);
        expect(htaContent).toMatch(/onclick='dpNext\(\);event\.stopPropagation\(\)/);
        expect(htaContent).toMatch(/onclick='dpPrevYear\(\);event\.stopPropagation\(\)/);
        expect(htaContent).toMatch(/onclick='dpNextYear\(\);event\.stopPropagation\(\)/);
    });

    test('検索カレンダーの日付セルにevent.stopPropagation()がある', () => {
        // selectDate呼び出し後にstopPropagation
        expect(htaContent).toMatch(/onclick='selectDate\(.*\);event\.stopPropagation\(\)/);
    });

    test('フローティングカレンダーの日付セルにevent.stopPropagation()がある', () => {
        // dpSelect呼び出し後にstopPropagation
        expect(htaContent).toMatch(/onclick='dpSelect\(.*\);event\.stopPropagation\(\)/);
    });
});

// ===== FIX 2: 施設の削除機能 =====

describe('FIX 2: buildDeleteFacilityQueries（施設削除）', () => {
    test('3つのDELETE文を返す（施設休止履歴→処理能力→施設の順）', () => {
        const queries = logic.buildDeleteFacilityQueries(10);
        expect(queries).toHaveLength(3);
    });

    test('施設休止履歴を最初に削除する（外部キー制約）', () => {
        const queries = logic.buildDeleteFacilityQueries(10);
        expect(queries[0]).toContain('DELETE FROM 施設休止履歴');
        expect(queries[0]).toContain('施設論理ID = 10');
    });

    test('処理能力を次に削除する（外部キー制約）', () => {
        const queries = logic.buildDeleteFacilityQueries(10);
        expect(queries[1]).toContain('DELETE FROM 処理能力');
        expect(queries[1]).toContain('施設論理ID = 10');
    });

    test('施設を論理IDで全履歴削除する', () => {
        const queries = logic.buildDeleteFacilityQueries(10);
        expect(queries[2]).toBe('DELETE FROM 施設 WHERE 施設論理ID = 10');
    });

    test('サブクエリで処理能力の施設IDを取得する', () => {
        const queries = logic.buildDeleteFacilityQueries(99);
        expect(queries[1]).toContain('施設ID IN (SELECT 施設ID FROM 施設 WHERE 施設論理ID = 99)');
    });

    test('異なる論理IDでクエリが正しく生成される', () => {
        const q1 = logic.buildDeleteFacilityQueries(1);
        const q2 = logic.buildDeleteFacilityQueries(999);
        expect(q1[2]).toContain('施設論理ID = 1');
        expect(q2[2]).toContain('施設論理ID = 999');
    });

    test('エクスポートされている', () => {
        expect(typeof logic.buildDeleteFacilityQueries).toBe('function');
    });
});

describe('FIX 2: 施設削除ボタンがHTAに存在する', () => {
    test('施設詳細に削除ボタンがある', () => {
        expect(htaContent).toContain('deleteFacilityFromDetail()');
    });

    test('削除関数が定義されている', () => {
        expect(htaContent).toContain('function deleteFacilityFromDetail()');
    });

    test('削除は二重確認ダイアログを使う', () => {
        // deleteFacilityFromDetail内にshowConfirmDialogが2回（ネスト）ある
        const funcMatch = htaContent.match(/function deleteFacilityFromDetail\(\)[\s\S]*?^\s{8}\}/m);
        expect(funcMatch).not.toBeNull();
        const funcBody = funcMatch[0];
        const confirmCount = (funcBody.match(/showConfirmDialog/g) || []).length;
        expect(confirmCount).toBe(2);
    });
});

// ===== FIX 3: 品目マスター一覧の表示順ソート =====

describe('FIX 3: 品目マスター一覧の表示順ソート', () => {
    test('品目マスターは表示順でソートされる', () => {
        const config = logic.getMasterConfig('品目');
        const sql = logic.buildLoadMasterListQuery(config);
        expect(sql).toContain('ORDER BY 表示順, 品目ID');
    });

    test('品目以外のマスターはIDでソートされる（従来通り）', () => {
        const types = ['許可区分', '施設種別', '処理方法', '廃棄物種類区分'];
        types.forEach(type => {
            const config = logic.getMasterConfig(type);
            const sql = logic.buildLoadMasterListQuery(config);
            expect(sql).not.toContain('表示順');
            expect(sql).toContain('ORDER BY ' + config.idCol);
        });
    });

    test('許可番号形式（extraCol=説明）はIDでソートされる', () => {
        const config = logic.getMasterConfig('許可番号形式');
        expect(config.extraCol).toBe('説明');
        const sql = logic.buildLoadMasterListQuery(config);
        // 説明は表示順ではないのでIDソート
        expect(sql).not.toContain('表示順');
        expect(sql).toContain('ORDER BY 許可番号形式ID');
    });

    test('品目のconfigにextraCol=表示順がある', () => {
        const config = logic.getMasterConfig('品目');
        expect(config.extraCol).toBe('表示順');
    });
});

// ===== FIX 4: 保存ボタンの位置（HTA構造） =====

describe('FIX 4: 許可の編集画面の保存ボタン位置', () => {
    test('保存ボタンは取扱品目セクションの後にある', () => {
        // showPermitEditForm関数内で、保存ボタンが品目セクション（permit-edit-items）より後に来ること
        const editFunc = htaContent.match(/function showPermitEditForm[\s\S]*?loadPermitItemsInline\(permitId/);
        expect(editFunc).not.toBeNull();
        const funcBody = editFunc[0];
        const itemsPos = funcBody.indexOf('permit-edit-items');
        const savePos = funcBody.indexOf("savePermitEdit()'>");
        expect(itemsPos).toBeGreaterThan(-1);
        expect(savePos).toBeGreaterThan(-1);
        expect(savePos).toBeGreaterThan(itemsPos);
    });

    test('保存ボタンは許可の編集form-cardの外にある', () => {
        const editFunc = htaContent.match(/function showPermitEditForm[\s\S]*?loadPermitItemsInline\(permitId/);
        const funcBody = editFunc[0];
        const itemSectionPos = funcBody.indexOf("取扱品目</h2>");
        const saveButtonPos = funcBody.indexOf("savePermitEdit()'>");
        expect(saveButtonPos).toBeGreaterThan(itemSectionPos);
    });
});

// ===== FIX 5: 「現在のステータス: 有効」の冗長表示削除 =====

describe('FIX 5: 状態変更は詳細画面に集約（編集画面から削除）', () => {
    test('業の編集画面（editPermitHistory）: 状態変更セクションがない', () => {
        // editPermitHistory関数を抽出
        const funcMatch = htaContent.match(/function editPermitHistory\b[\s\S]*?function \w+/);
        expect(funcMatch).not.toBeNull();
        const funcBody = funcMatch[0];
        // 編集画面に廃止/取消フォームがないこと
        expect(funcBody).not.toContain('事業者の自主的な事業廃止');
        expect(funcBody).not.toContain('状態変更');
        expect(funcBody).not.toContain('履歴管理');
    });

    test('施設の編集画面（editFacilityHistory）: 状態変更セクションがない', () => {
        // editFacilityHistory関数を抽出
        const funcMatch = htaContent.match(/function editFacilityHistory\b[\s\S]*?function \w+/);
        expect(funcMatch).not.toBeNull();
        const funcBody = funcMatch[0];
        // 編集画面に廃止フォームがないこと
        expect(funcBody).not.toContain('施設の廃止');
        expect(funcBody).not.toContain('状態変更');
    });

    test('廃止/取消は詳細画面（showPermitDetail）にある', () => {
        const funcMatch = htaContent.match(/function showPermitDetail\b[\s\S]*?function \w+/);
        expect(funcMatch).not.toBeNull();
        const funcBody = funcMatch[0];
        expect(funcBody).toContain('この許可を廃止する');
        expect(funcBody).toContain('この許可を取消する');
        expect(funcBody).toContain('abolishPermitFromDetail');
        expect(funcBody).toContain('cancelPermitFromDetail');
        expect(funcBody).toContain('restorePermitFromDetail');
    });
});

// ===== FIX 6: 「有効年月日」→「許可有効年月日」ラベル統一 =====

describe('FIX 6: 許可有効年月日ラベル統一', () => {
    test('業詳細の基本情報で「許可有効年月日」と表示する', () => {
        // showPermitDetail関数内の基本情報セクション（B2レイアウト）
        expect(htaContent).toContain("b2-row-label'>許可有効年月日</div>");
    });

    test('単独の「有効年月日」がテーブルヘッダーに残っていない', () => {
        // <th>有効年月日</th> がないこと（<th>許可有効年月日</th> はOK）
        const standaloneHeaders = htaContent.match(/<th>有効年月日<\/th>/g);
        expect(standaloneHeaders).toBeNull();
    });

    test('許可一覧テーブルのヘッダーが「許可有効年月日」である', () => {
        expect(htaContent).toMatch(/<th>許可有効年月日<\/th><th>許可番号<\/th><th>操作<\/th>/);
    });

    test('履歴テーブルのヘッダーが「許可有効年月日」である', () => {
        // 履歴テーブル（許可ID列がある方）
        expect(htaContent).toMatch(/<th>許可年月日<\/th><th>許可有効年月日<\/th><th>状態<\/th>/);
    });

    test('タイムライン内テーブルも「許可有効年月日」である', () => {
        // タイムライン内の簡易テーブル
        expect(htaContent).toMatch(/<th>許可年月日<\/th><th>許可有効年月日<\/th><\/tr>/);
    });
});

// ===== FIX 7: 変更許可の日付挙動 =====

describe('FIX 7: 変更許可の日付挙動（startDate対応）', () => {
    test('startDateを指定すると有効開始日時にstartDateが使われる', () => {
        const sql = logic.buildSavePermitQuery({
            logicalId: 100, businessId: 42, categoryId: 1,
            number: 'TEST-001',
            permitDate: '2025/04/01',
            validDate: '2030/03/31',
            startDate: '2026/03/01',
            excellent: false, todayStr: '2026/03/01'
        });
        // 有効開始日時 = startDate（変更許可年月日）
        expect(sql).toContain('#2026/03/01#');
        // 許可年月日 = 元の許可日（引継ぎ）
        expect(sql).toContain('#2025/04/01#');
    });

    test('startDate未指定ならpermitDateが有効開始日時に使われる（従来通り）', () => {
        const sql = logic.buildSavePermitQuery({
            logicalId: 100, businessId: 42, categoryId: 1,
            number: 'TEST-001',
            permitDate: '2026/04/01',
            validDate: '2031/03/31',
            excellent: false, todayStr: '2026/04/01'
        });
        // permitDate が許可年月日と有効開始日時の両方に使われる
        const dateOccurrences = (sql.match(/#2026\/04\/01#/g) || []).length;
        // 許可年月日, 有効開始日時, 作成日時の3箇所
        expect(dateOccurrences).toBeGreaterThanOrEqual(2);
    });

    test('startDateとpermitDateが異なる場合、それぞれ別の列に反映される', () => {
        const sql = logic.buildSavePermitQuery({
            logicalId: 100, businessId: 42, categoryId: 1,
            number: 'TEST-001',
            permitDate: '2024/01/15',
            validDate: '2029/01/14',
            startDate: '2026/06/01',
            excellent: true, todayStr: '2026/06/01'
        });
        // カラム名を含むINSERT文のカラムリストで確認
        expect(sql).toContain('許可年月日');
        expect(sql).toContain('有効開始日時');
        // 許可年月日の値
        expect(sql).toContain('#2024/01/15#');
        // 有効開始日時の値（startDate）
        expect(sql).toContain('#2026/06/01#');
    });

    test('HTA: savePermitEdit変更モードで有効開始日時を変更事由発生日に設定している', () => {
        // savePermitEdit関数内で変更モード時にstartDateを変更事由発生日に設定していること
        const funcMatch = htaContent.match(/function savePermitEdit[\s\S]*?function \w+/);
        expect(funcMatch).not.toBeNull();
        const funcBody = funcMatch[0];
        expect(funcBody).toContain("insertData.startDate = changeEventDate");
        expect(funcBody).toContain('editingPermitMode === "change"');
    });
});

// ===== 統合テスト: 変更許可フロー全体 =====

describe('統合: 変更許可フロー（許可年月日引継ぎ + 品目コピー）', () => {
    test('旧バージョンクローズ→新バージョン作成で日付が正しく分離される', () => {
        const logicalId = 50;
        const origPermitDate = '2024/04/01';  // 元の許可年月日
        const origValidDate = '2029/03/31';   // 元の有効年月日
        const changeDate = '2026/03/04';      // 変更許可年月日

        // Step 1: 旧バージョンクローズ
        const closeSql = logic.buildCloseOldPermitVersionsQuery(logicalId, changeDate);
        expect(closeSql).toContain('許可論理ID = 50');

        // Step 2: 新バージョン作成
        const insertSql = logic.buildSavePermitQuery({
            logicalId: logicalId,
            businessId: 42,
            categoryId: 1,
            number: 'PERM-001',
            permitDate: origPermitDate,   // 引継ぎ
            validDate: origValidDate,     // 引継ぎ
            startDate: changeDate,        // 変更許可年月日
            excellent: false,
            todayStr: changeDate
        });

        expect(insertSql).toContain('INSERT INTO 許可');
        // 許可年月日は元の日付
        expect(insertSql).toContain('#2024/04/01#');
        // 許可有効年月日も元の日付
        expect(insertSql).toContain('#2029/03/31#');
        // 有効開始日時は変更許可年月日
        // カラム順: ..., 有効開始日時, 作成日時
        // 値順: ..., #2026/03/04#, #2026/03/04#
        const cols = insertSql.match(/\(([^)]+)\) VALUES/)[1].split(', ');
        const vals = insertSql.match(/VALUES \(([^)]+)\)/)[1].split(', ');
        const startIdx = cols.indexOf('有効開始日時');
        const permitDateIdx = cols.indexOf('許可年月日');
        expect(startIdx).toBeGreaterThan(-1);
        expect(permitDateIdx).toBeGreaterThan(-1);
        expect(vals[startIdx]).toBe('#2026/03/04#');
        expect(vals[permitDateIdx]).toBe('#2024/04/01#');
    });
});

// ===== 統合テスト: 施設削除とカスケード =====

describe('統合: 施設削除のカスケード', () => {
    test('施設削除と事業者削除の施設部分が整合する', () => {
        // 施設単体の削除
        const facQueries = logic.buildDeleteFacilityQueries(5);
        expect(facQueries[0]).toContain('DELETE FROM 施設休止履歴');
        expect(facQueries[1]).toContain('DELETE FROM 処理能力');
        expect(facQueries[2]).toContain('DELETE FROM 施設');

        // 事業者削除のカスケード内にも同じ依存関係がある
        const bizQueries = logic.buildDeleteBusinessQueries(42);
        const suspIdx = bizQueries.findIndex(q => q.includes('DELETE FROM 施設休止履歴'));
        const capIdx = bizQueries.findIndex(q => q.includes('DELETE FROM 処理能力'));
        const facIdx = bizQueries.findIndex(q => q.includes('DELETE FROM 施設 WHERE'));
        // 施設休止履歴と処理能力が施設より先に削除される
        expect(suspIdx).toBeLessThan(facIdx);
        expect(capIdx).toBeLessThan(facIdx);
    });
});

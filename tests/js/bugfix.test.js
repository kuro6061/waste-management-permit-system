/**
 * バグ修正の検証テスト
 * 発見された4つのバグに対する修正が正しく動作することを検証する
 *
 * BUG 1/2: buildUpdatePermitHistoryQuery の部分更新対応
 * BUG 3: buildSearchPermitQuery の abolished/cancelled フィルタ修正
 * BUG 4: buildDeleteBusinessQueries のカスケード削除
 * BUG 5: buildCloseOldPermitVersionsQuery の旧バージョンクローズ
 */
const logic = require('../../app_logic.js');

// ===== BUG 1/2: buildUpdatePermitHistoryQuery 部分更新 =====

describe('BUG 1/2: buildUpdatePermitHistoryQuery 部分更新対応', () => {
    test('必須フィールド（permitNumber, categoryId）のみ指定した場合、他のフィールドはSETに含まれない', () => {
        const sql = logic.buildUpdatePermitHistoryQuery({
            permitId: 100,
            permitNumber: 'TEST-001',
            categoryId: 1
        });
        expect(sql).toContain("許可番号 = 'TEST-001'");
        expect(sql).toContain("許可区分ID = 1");
        expect(sql).toContain("WHERE 許可ID = 100");
        // undefinedのフィールドはSET句に含まれない
        expect(sql).not.toContain('許可年月日');
        expect(sql).not.toContain('許可有効年月日');
        expect(sql).not.toContain('有効開始日時');
        expect(sql).not.toContain('有効終了日時');
        expect(sql).not.toContain('優良認定');
        expect(sql).not.toContain('取消日');
        expect(sql).not.toContain('取消理由');
        expect(sql).not.toContain('廃止日');
        expect(sql).not.toContain('廃止理由');
    });

    test('excellent=false を明示的に指定するとSET句に含まれる', () => {
        const sql = logic.buildUpdatePermitHistoryQuery({
            permitId: 100,
            permitNumber: 'TEST-001',
            categoryId: 1,
            excellent: false
        });
        expect(sql).toContain('優良認定 = False');
    });

    test('excellent=true を指定するとSET句にTrueが含まれる', () => {
        const sql = logic.buildUpdatePermitHistoryQuery({
            permitId: 100,
            permitNumber: 'TEST-001',
            categoryId: 1,
            excellent: true
        });
        expect(sql).toContain('優良認定 = True');
    });

    test('excellentがundefinedの場合は優良認定をSET句に含めない（既存値を保持）', () => {
        const sql = logic.buildUpdatePermitHistoryQuery({
            permitId: 100,
            permitNumber: 'TEST-001',
            categoryId: 1
            // excellent は undefined
        });
        expect(sql).not.toContain('優良認定');
    });

    test('permitDateのみ指定した場合、許可年月日だけが追加される', () => {
        const sql = logic.buildUpdatePermitHistoryQuery({
            permitId: 100,
            permitNumber: 'TEST-001',
            categoryId: 1,
            permitDate: '2026/04/01'
        });
        expect(sql).toContain('許可年月日 = #2026/04/01#');
        expect(sql).not.toContain('許可有効年月日');
        expect(sql).not.toContain('有効開始日時');
    });

    test('validDateを空文字で指定するとNULLが設定される', () => {
        const sql = logic.buildUpdatePermitHistoryQuery({
            permitId: 100,
            permitNumber: 'TEST-001',
            categoryId: 1,
            validDate: ''
        });
        expect(sql).toContain('許可有効年月日 = NULL');
    });

    test('全フィールド指定した場合、すべてのSET句が含まれる', () => {
        const sql = logic.buildUpdatePermitHistoryQuery({
            permitId: 100,
            permitNumber: 'TEST-002',
            categoryId: 2,
            permitDate: '2026/04/01',
            validDate: '2031/03/31',
            startDate: '2026/04/01',
            endDate: '2031/03/31',
            excellent: true,
            cancelDate: '2026/06/01',
            cancelReason: '法令違反',
            abolishDate: '2026/07/01',
            abolishReason: '事業廃止'
        });
        expect(sql).toContain("許可番号 = 'TEST-002'");
        expect(sql).toContain("許可区分ID = 2");
        expect(sql).toContain('許可年月日 = #2026/04/01#');
        expect(sql).toContain('許可有効年月日 = #2031/03/31#');
        expect(sql).toContain('有効開始日時 = #2026/04/01#');
        expect(sql).toContain('有効終了日時 = #2031/03/31#');
        expect(sql).toContain('優良認定 = True');
        expect(sql).toContain('取消日 = #2026/06/01#');
        expect(sql).toContain("取消理由 = '法令違反'");
        expect(sql).toContain('廃止日 = #2026/07/01#');
        expect(sql).toContain("廃止理由 = '事業廃止'");
    });

    test('廃止日のみクリアする場合（他のフィールドに影響しない）', () => {
        const sql = logic.buildUpdatePermitHistoryQuery({
            permitId: 100,
            permitNumber: 'TEST-001',
            categoryId: 1,
            abolishDate: '',
            abolishReason: ''
        });
        expect(sql).toContain('廃止日 = NULL');
        expect(sql).toContain('廃止理由 = NULL');
        // 他のフィールドは含まれない
        expect(sql).not.toContain('取消日');
        expect(sql).not.toContain('有効終了日時');
        expect(sql).not.toContain('優良認定');
    });

    test('シングルクォートを含む理由文がエスケープされる', () => {
        const sql = logic.buildUpdatePermitHistoryQuery({
            permitId: 100,
            permitNumber: 'TEST-001',
            categoryId: 1,
            cancelReason: "it's a reason"
        });
        expect(sql).toContain("it''s a reason");
    });
});

// ===== BUG 3: buildSearchPermitQuery abolished/cancelled フィルタ =====

describe('BUG 3: buildSearchPermitQuery abolished/cancelled フィルタ修正', () => {
    const baseParams = {
        asOfDateSql: '#2026/02/28 23:59:59#'
    };

    test('status=active の場合、有効終了日時のフィルタが含まれる（従来通り）', () => {
        const sql = logic.buildSearchPermitQuery({ ...baseParams, status: 'active' });
        expect(sql).toContain('有効終了日時 IS NULL OR 許可.有効終了日時 >');
        expect(sql).toContain('廃止日 IS NULL AND 許可.取消日 IS NULL');
    });

    test('status=abolished の場合、有効終了日時のフィルタが緩和される', () => {
        const sql = logic.buildSearchPermitQuery({ ...baseParams, status: 'abolished' });
        // 有効開始日時のフィルタはある
        expect(sql).toContain('許可.有効開始日時 <=');
        // 有効終了日時のフィルタは含まれない（廃止済み許可は有効終了日時が過去に設定されるため）
        expect(sql).not.toContain('有効終了日時 IS NULL OR');
        expect(sql).not.toContain('有効終了日時 >');
        // 廃止日フィルタは含まれる
        expect(sql).toContain('廃止日 IS NOT NULL');
    });

    test('status=cancelled の場合、有効終了日時のフィルタが緩和される', () => {
        const sql = logic.buildSearchPermitQuery({ ...baseParams, status: 'cancelled' });
        // 有効開始日時のフィルタはある
        expect(sql).toContain('許可.有効開始日時 <=');
        // 有効終了日時のフィルタは含まれない
        expect(sql).not.toContain('有効終了日時 IS NULL OR');
        expect(sql).not.toContain('有効終了日時 >');
        // 取消日フィルタは含まれる
        expect(sql).toContain('取消日 IS NOT NULL');
    });

    test('statusなしの場合、有効終了日時のフィルタが含まれる（従来通り）', () => {
        const sql = logic.buildSearchPermitQuery(baseParams);
        expect(sql).toContain('有効終了日時 IS NULL OR 許可.有効終了日時 >');
    });

    test('status=abolished + AND品目検索でも有効終了日時フィルタが緩和される', () => {
        const sql = logic.buildSearchPermitQuery({
            ...baseParams,
            status: 'abolished',
            selectedItemIds: ['1', '3'],
            itemMode: 'AND'
        });
        expect(sql).not.toContain('有効終了日時 IS NULL OR');
        expect(sql).toContain('廃止日 IS NOT NULL');
        expect(sql).toContain('EXISTS');
    });

    test('status=cancelled + OR品目検索でも有効終了日時フィルタが緩和される', () => {
        const sql = logic.buildSearchPermitQuery({
            ...baseParams,
            status: 'cancelled',
            selectedItemIds: ['2'],
            itemMode: 'OR'
        });
        expect(sql).not.toContain('有効終了日時 IS NULL OR');
        expect(sql).toContain('取消日 IS NOT NULL');
        expect(sql).toContain('INNER JOIN 許可品目');
    });
});

// ===== BUG 4: buildDeleteBusinessQueries カスケード削除 =====

describe('BUG 4: buildDeleteBusinessQueries カスケード削除', () => {
    test('8つのDELETE文を返す', () => {
        const queries = logic.buildDeleteBusinessQueries(42);
        expect(queries).toHaveLength(8);
    });

    test('正しい順序で削除する（子テーブル→親テーブル）', () => {
        const queries = logic.buildDeleteBusinessQueries(42);
        // 許可品目（許可の子）が最初
        expect(queries[0]).toContain('DELETE FROM 許可品目');
        expect(queries[0]).toContain('許可ID IN (SELECT 許可ID FROM 許可 WHERE 事業者ID = 42)');
        // 施設休止履歴（施設の子）が2番目
        expect(queries[1]).toContain('DELETE FROM 施設休止履歴');
        expect(queries[1]).toContain('施設ID IN (SELECT 施設ID FROM 施設 WHERE 事業者ID = 42)');
        // 処理能力（施設の子）が3番目
        expect(queries[2]).toContain('DELETE FROM 処理能力');
        expect(queries[2]).toContain('施設ID IN (SELECT 施設ID FROM 施設 WHERE 事業者ID = 42)');
        // 許可が4番目
        expect(queries[3]).toBe('DELETE FROM 許可 WHERE 事業者ID = 42');
        // 施設が5番目
        expect(queries[4]).toBe('DELETE FROM 施設 WHERE 事業者ID = 42');
        // 車両が6番目
        expect(queries[5]).toBe('DELETE FROM 車両 WHERE 事業者ID = 42');
        // 役員が7番目
        expect(queries[6]).toBe('DELETE FROM 役員 WHERE 事業者ID = 42');
        // 事業者本体が最後
        expect(queries[7]).toBe('DELETE FROM 事業者 WHERE 事業者ID = 42');
    });

    test('事業者IDがクエリに正しく埋め込まれる', () => {
        const queries = logic.buildDeleteBusinessQueries(999);
        queries.forEach(sql => {
            expect(sql).toContain('999');
        });
    });

    test('旧関数buildDeleteBusinessQueryも引き続き動作する（後方互換性）', () => {
        const sql = logic.buildDeleteBusinessQuery(42);
        expect(sql).toBe('DELETE FROM 事業者 WHERE 事業者ID = 42');
    });
});

// ===== BUG 5: buildCloseOldPermitVersionsQuery 旧バージョンクローズ =====

describe('BUG 5: buildCloseOldPermitVersionsQuery 旧バージョンクローズ', () => {
    test('新許可日の前日でクローズする（DateAdd方式）', () => {
        const sql = logic.buildCloseOldPermitVersionsQuery(50, '2026/03/01');
        expect(sql).toContain('UPDATE 許可 SET');
        expect(sql).toContain("有効終了日時 = DateAdd('d', -1, #2026/03/01#)");
        expect(sql).toContain('WHERE 許可論理ID = 50');
        expect(sql).toContain('有効終了日時 IS NULL');
    });

    test('異なる論理IDと日付でクエリが正しく生成される', () => {
        const sql = logic.buildCloseOldPermitVersionsQuery(100, '2026/06/15');
        expect(sql).toBe(
            "UPDATE 許可 SET 有効終了日時 = DateAdd('d', -1, #2026/06/15#) WHERE 許可論理ID = 100 AND 有効終了日時 IS NULL"
        );
    });

    test('既にクローズ済み（有効終了日時が設定済み）のレコードは影響しない', () => {
        const sql = logic.buildCloseOldPermitVersionsQuery(50, '2026/03/01');
        // WHERE句に「有効終了日時 IS NULL」があるので、クローズ済みは対象外
        expect(sql).toContain('AND 有効終了日時 IS NULL');
    });
});

// ===== 業務フロー統合テスト =====

describe('業務フロー: 許可更新（バージョン管理）', () => {
    test('旧バージョンクローズ→新バージョン作成の一連操作', () => {
        const logicalId = 50;
        const todayStr = '2026/03/01';

        // Step 1: 旧バージョンをクローズ（許可有効年月日で閉じる）
        const closeSql = logic.buildCloseOldPermitVersionsQuery(logicalId, todayStr);
        expect(closeSql).toContain('許可論理ID = 50');
        expect(closeSql).toContain("DateAdd('d', -1, #2026/03/01#)");

        // Step 2: 新バージョンを作成
        const insertSql = logic.buildSavePermitQuery({
            logicalId: logicalId,
            businessId: 42,
            categoryId: 1,
            number: 'RENEWED-001',
            permitDate: '2026/03/01',
            validDate: '2031/02/28',
            excellent: false,
            todayStr: todayStr
        });
        expect(insertSql).toContain('INSERT INTO 許可');
        expect(insertSql).toContain(logicalId.toString());
    });
});

describe('業務フロー: 許可の部分更新後も既存値が保持される', () => {
    test('優良認定のみ変更（他のフィールドは既存値保持）', () => {
        const sql = logic.buildUpdatePermitHistoryQuery({
            permitId: 200,
            permitNumber: 'EXIST-001',
            categoryId: 3,
            excellent: true
        });
        // 変更対象
        expect(sql).toContain('優良認定 = True');
        // 変更しないフィールドは含まれない
        expect(sql).not.toContain('許可年月日');
        expect(sql).not.toContain('廃止日');
        expect(sql).not.toContain('取消日');
    });
});

describe('業務フロー: 事業者の完全削除', () => {
    test('許可品目→処理能力→許可→施設→車両→役員→事業者の順に削除', () => {
        const queries = logic.buildDeleteBusinessQueries(100);

        // テーブル名の順序を検証
        const tableOrder = queries.map(sql => {
            var match = sql.match(/DELETE FROM (\S+)/);
            return match ? match[1] : '';
        });
        expect(tableOrder).toEqual([
            '許可品目', '施設休止履歴', '処理能力', '許可', '施設', '車両', '役員', '事業者'
        ]);
    });
});

describe('業務フロー: 廃止済み許可の検索', () => {
    test('廃止済み許可を検索するSQLが有効終了日時でフィルタしない', () => {
        const sql = logic.buildSearchPermitQuery({
            asOfDateSql: '#2026/03/01 23:59:59#',
            status: 'abolished'
        });
        // 廃止日フィルタがある
        expect(sql).toContain('廃止日 IS NOT NULL');
        // 有効開始日時フィルタはある
        expect(sql).toContain('有効開始日時 <=');
        // 有効終了日時によるフィルタはない（これが修正のポイント）
        const endDateFilterRegex = /有効終了日時 IS NULL OR.*有効終了日時 >/;
        expect(sql).not.toMatch(endDateFilterRegex);
    });
});

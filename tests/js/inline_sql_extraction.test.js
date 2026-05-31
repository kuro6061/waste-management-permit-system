/**
 * インラインSQL抽出テスト
 * HTA内にハードコードされていたSQL文をapp_logic.jsのビルダー関数に抽出した結果を検証する。
 * 処理能力クエリ、施設操作クエリ、ID採番クエリの正しさをテストする。
 */
const logic = require('../../app_logic');

describe('インラインSQL抽出: 処理能力クエリ', () => {
    test('buildUpdateCapacityInlineQuery: 全フィールド指定', () => {
        const sql = logic.buildUpdateCapacityInlineQuery(10, {
            itemId: 5, hourCap: 100, hourUnitId: 2, dayCap: 800, dayUnitId: 3
        });
        expect(sql).toMatch(/UPDATE 処理能力 SET/);
        expect(sql).toMatch(/品目ID = 5/);
        expect(sql).toMatch(/時間処理能力 = 100/);
        expect(sql).toMatch(/時間処理能力単位ID = 2/);
        expect(sql).toMatch(/日処理能力 = 800/);
        expect(sql).toMatch(/日処理能力単位ID = 3/);
        expect(sql).toMatch(/WHERE 処理能力ID = 10/);
    });

    test('buildUpdateCapacityInlineQuery: NULL値の処理', () => {
        const sql = logic.buildUpdateCapacityInlineQuery(10, {
            itemId: 5, hourCap: null, hourUnitId: null, dayCap: '', dayUnitId: null
        });
        expect(sql).toMatch(/時間処理能力 = NULL/);
        expect(sql).toMatch(/時間処理能力単位ID = 1/);  // default
        expect(sql).toMatch(/日処理能力 = NULL/);
        expect(sql).toMatch(/日処理能力単位ID = 1/);  // default
    });

    test('buildInsertCapacityInlineQuery: 全フィールド指定', () => {
        const sql = logic.buildInsertCapacityInlineQuery(20, {
            itemId: 3, hourCap: 50, hourUnitId: 2, dayCap: 400, dayUnitId: 2
        });
        expect(sql).toMatch(/INSERT INTO 処理能力/);
        expect(sql).toMatch(/施設ID/);
        expect(sql).toContain('20, 3');
        expect(sql).toContain('50');
        expect(sql).toContain('400');
    });

    test('buildInsertCapacityInlineQuery: NULL値の処理', () => {
        const sql = logic.buildInsertCapacityInlineQuery(20, {
            itemId: 3, hourCap: null, hourUnitId: 1, dayCap: null, dayUnitId: 1
        });
        expect(sql).toMatch(/NULL.*1.*NULL.*1\)/);
    });
});

describe('インラインSQL抽出: 施設操作クエリ', () => {
    test('buildSuspendFacilityQuery: 正常系', () => {
        const sql = logic.buildSuspendFacilityQuery(5, '2026/03/09');
        expect(sql).toBe("UPDATE 施設 SET 休止年月日 = #2026/03/09#, 再開年月日 = NULL WHERE 施設ID = 5");
    });

    test('buildSuspendFacilityQuery: 理由付き', () => {
        const sql = logic.buildSuspendFacilityQuery(5, '2026/03/09', '設備点検のため');
        expect(sql).toContain("休止理由 = '設備点検のため'");
    });

    test('buildResumeFacilityQuery: 正常系', () => {
        const sql = logic.buildResumeFacilityQuery(5, '2026/03/10');
        expect(sql).toBe("UPDATE 施設 SET 再開年月日 = #2026/03/10#, 休止理由 = NULL WHERE 施設ID = 5");
    });

    test('buildDeleteFacilityVersionQueries: CASCADE順序', () => {
        const queries = logic.buildDeleteFacilityVersionQueries(10);
        expect(queries).toHaveLength(3);
        expect(queries[0]).toMatch(/DELETE FROM 施設休止履歴 WHERE 施設ID = 10/);
        expect(queries[1]).toMatch(/DELETE FROM 処理能力 WHERE 施設ID = 10/);
        expect(queries[2]).toMatch(/DELETE FROM 施設 WHERE 施設ID = 10/);
        // 施設休止履歴→処理能力→施設の順（FK制約の順序）
    });

    test('buildCountFacilityVersionsQuery: 正常系', () => {
        const sql = logic.buildCountFacilityVersionsQuery(7);
        expect(sql).toMatch(/COUNT\(\*\) AS cnt/);
        expect(sql).toMatch(/施設論理ID = 7/);
    });
});

describe('インラインSQL抽出: ID採番クエリ', () => {
    test('buildGetNextLogicalIdQuery: 許可論理ID', () => {
        const sql = logic.buildGetNextLogicalIdQuery("許可", "許可論理ID");
        expect(sql).toBe("SELECT MAX(許可論理ID) AS maxId FROM 許可");
    });

    test('buildGetNextLogicalIdQuery: 施設論理ID', () => {
        const sql = logic.buildGetNextLogicalIdQuery("施設", "施設論理ID");
        expect(sql).toBe("SELECT MAX(施設論理ID) AS maxId FROM 施設");
    });

    test('buildGetNextMasterIdQuery: 一般マスター', () => {
        const config = logic.getMasterConfig("処理方法");
        const sql = logic.buildGetNextMasterIdQuery(config);
        expect(sql).toMatch(/SELECT MAX\(/);
        expect(sql).toMatch(/FROM \[/);
    });

    test('buildGetNextMasterIdQuery: 品目（特管）', () => {
        const config = logic.getMasterConfig("品目");
        const sql = logic.buildGetNextMasterIdQuery(config, "special");
        expect(sql).toMatch(/>= /);
        expect(sql).toContain(String(logic.ITEM_SPECIAL_THRESHOLD));
    });

    test('buildGetNextMasterIdQuery: 品目（普通）', () => {
        const config = logic.getMasterConfig("品目");
        const sql = logic.buildGetNextMasterIdQuery(config, "normal");
        expect(sql).toMatch(/< /);
        expect(sql).toContain(String(logic.ITEM_SPECIAL_THRESHOLD));
    });
});

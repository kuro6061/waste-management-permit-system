/**
 * 編集フォーム用ビルダー関数のテスト
 * HTA内のインラインSQLをapp_logic.jsに移行した新規ビルダーの検証
 *
 * 背景: 編集フォームがインラインSQLとJS側日付変換を使っていたため、
 * テスト・MCPでカバーできない「空白地帯」が存在していた。
 * SQL側のFormat()で日付を文字列化するビルダーに統一することで解消。
 */
const logic = require('../../app_logic.js');

// ===== buildLoadPermitForEditQuery =====

describe('buildLoadPermitForEditQuery（許可編集フォーム用SELECT）', () => {
    test('指定した許可IDのSELECT文を生成する', () => {
        const sql = logic.buildLoadPermitForEditQuery(37498);
        expect(sql).toContain('FROM 許可 WHERE 許可ID = 37498');
    });

    test('全日付カラムにFormat()が適用されている', () => {
        const sql = logic.buildLoadPermitForEditQuery(100);
        expect(sql).toContain("Format(許可年月日, 'yyyy/mm/dd') AS 許可年月日文字列");
        expect(sql).toContain("Format(許可有効年月日, 'yyyy/mm/dd') AS 許可有効年月日文字列");
        expect(sql).toContain("Format(有効開始日時, 'yyyy/mm/dd') AS 有効開始文字列");
        expect(sql).toContain("Format(有効終了日時, 'yyyy/mm/dd') AS 有効終了文字列");
        expect(sql).toContain("Format(取消日, 'yyyy/mm/dd') AS 取消日文字列");
        expect(sql).toContain("Format(廃止日, 'yyyy/mm/dd') AS 廃止日文字列");
    });

    test('非日付フィールドも含まれている', () => {
        const sql = logic.buildLoadPermitForEditQuery(100);
        expect(sql).toContain('許可ID');
        expect(sql).toContain('許可番号');
        expect(sql).toContain('許可区分ID');
        expect(sql).toContain('優良認定');
        expect(sql).toContain('取消理由');
        expect(sql).toContain('廃止理由');
    });
});

// ===== buildLoadFacilityForEditQuery =====

describe('buildLoadFacilityForEditQuery（施設編集フォーム用SELECT）', () => {
    test('指定した施設IDのSELECT文を生成する', () => {
        const sql = logic.buildLoadFacilityForEditQuery(500);
        expect(sql).toContain('FROM 施設 WHERE 施設ID = 500');
    });

    test('全日付カラムにFormat()が適用されている', () => {
        const sql = logic.buildLoadFacilityForEditQuery(100);
        expect(sql).toContain("Format(許可年月日, 'yyyy/mm/dd') AS 許可年月日文字列");
        expect(sql).toContain("Format(設置年月日, 'yyyy/mm/dd') AS 設置年月日文字列");
        expect(sql).toContain("Format(有効開始日時, 'yyyy/mm/dd') AS 有効開始文字列");
        expect(sql).toContain("Format(有効終了日時, 'yyyy/mm/dd') AS 有効終了文字列");
        expect(sql).toContain("Format(廃止年月日, 'yyyy/mm/dd') AS 廃止日文字列");
    });

    test('非日付フィールドも含まれている', () => {
        const sql = logic.buildLoadFacilityForEditQuery(100);
        expect(sql).toContain('施設ID');
        expect(sql).toContain('施設種別ID');
        expect(sql).toContain('設置場所');
        expect(sql).toContain('許可番号');
    });
});

// ===== buildUpdateFacilityHistoryQuery =====

describe('buildUpdateFacilityHistoryQuery（施設履歴更新）', () => {
    test('必須フィールドのみでUPDATE文を生成', () => {
        const sql = logic.buildUpdateFacilityHistoryQuery({
            facilityId: 200,
            typeId: 3,
            location: '東京都千代田区1-1'
        });
        expect(sql).toContain('UPDATE 施設 SET');
        expect(sql).toContain('施設種別ID = 3');
        expect(sql).toContain("設置場所 = '東京都千代田区1-1'");
        expect(sql).toContain('WHERE 施設ID = 200');
        // undefined のフィールドはSET句に含まれない
        expect(sql).not.toContain('許可番号');
        expect(sql).not.toContain('許可年月日');
        expect(sql).not.toContain('設置年月日');
        expect(sql).not.toContain('有効開始日時');
        expect(sql).not.toContain('有効終了日時');
        expect(sql).not.toContain('廃止年月日');
    });

    test('全フィールドを指定した場合すべてSET句に含まれる', () => {
        const sql = logic.buildUpdateFacilityHistoryQuery({
            facilityId: 200,
            typeId: 3,
            location: '東京都',
            permitNo: 'FAC-001',
            permitDate: '2026/01/01',
            setupDate: '2026/02/01',
            startDate: '2026/01/01',
            endDate: '2026/12/31',
            abolishDate: '2026/06/15'
        });
        expect(sql).toContain("許可番号 = 'FAC-001'");
        expect(sql).toContain('許可年月日 = #2026/01/01#');
        expect(sql).toContain('設置年月日 = #2026/02/01#');
        expect(sql).toContain('有効開始日時 = #2026/01/01#');
        expect(sql).toContain('有効終了日時 = #2026/12/31#');
        expect(sql).toContain('廃止年月日 = #2026/06/15#');
    });

    test('空文字列のフィールドはNULLになる', () => {
        const sql = logic.buildUpdateFacilityHistoryQuery({
            facilityId: 200,
            typeId: 3,
            location: '東京都',
            permitNo: '',
            permitDate: '',
            endDate: '',
            abolishDate: ''
        });
        expect(sql).toContain('許可番号 = NULL');
        expect(sql).toContain('許可年月日 = NULL');
        expect(sql).toContain('有効終了日時 = NULL');
        expect(sql).toContain('廃止年月日 = NULL');
    });

    test('SQLインジェクション対策（シングルクォートがエスケープされる）', () => {
        const sql = logic.buildUpdateFacilityHistoryQuery({
            facilityId: 200,
            typeId: 3,
            location: "東京都O'Brien通り"
        });
        expect(sql).toContain("設置場所 = '東京都O''Brien通り'");
    });
});

// ===== buildUpdateBoundaryDateQuery =====

describe('buildUpdateBoundaryDateQuery（境界日更新）', () => {
    test('許可テーブルの有効終了日時を更新', () => {
        const sql = logic.buildUpdateBoundaryDateQuery('許可', '許可ID', 100, '有効終了日時', '2026/03/01');
        expect(sql).toBe('UPDATE 許可 SET 有効終了日時 = #2026/03/01# WHERE 許可ID = 100');
    });

    test('許可テーブルの有効開始日時を更新', () => {
        const sql = logic.buildUpdateBoundaryDateQuery('許可', '許可ID', 200, '有効開始日時', '2026/03/01');
        expect(sql).toBe('UPDATE 許可 SET 有効開始日時 = #2026/03/01# WHERE 許可ID = 200');
    });

    test('施設テーブルの有効終了日時を更新', () => {
        const sql = logic.buildUpdateBoundaryDateQuery('施設', '施設ID', 300, '有効終了日時', '2026/06/15');
        expect(sql).toBe('UPDATE 施設 SET 有効終了日時 = #2026/06/15# WHERE 施設ID = 300');
    });

    test('施設テーブルの有効開始日時を更新', () => {
        const sql = logic.buildUpdateBoundaryDateQuery('施設', '施設ID', 400, '有効開始日時', '2026/06/15');
        expect(sql).toBe('UPDATE 施設 SET 有効開始日時 = #2026/06/15# WHERE 施設ID = 400');
    });
});

// ===== buildLoadLatestVersionQuery =====

describe('buildLoadLatestVersionQuery（最新バージョン取得）', () => {
    test('許可テーブルの最新バージョンを取得', () => {
        const sql = logic.buildLoadLatestVersionQuery('許可', '許可論理ID', 50);
        expect(sql).toBe('SELECT TOP 1 * FROM 許可 WHERE 許可論理ID = 50 ORDER BY 有効開始日時 DESC');
    });

    test('施設テーブルの最新バージョンを取得', () => {
        const sql = logic.buildLoadLatestVersionQuery('施設', '施設論理ID', 30);
        expect(sql).toBe('SELECT TOP 1 * FROM 施設 WHERE 施設論理ID = 30 ORDER BY 有効開始日時 DESC');
    });
});

// ===== buildGetMaxIdQuery =====

describe('buildGetMaxIdQuery（最大ID取得）', () => {
    test('許可テーブルの最大許可IDを取得', () => {
        const sql = logic.buildGetMaxIdQuery('許可', '許可ID', '許可論理ID', 50);
        expect(sql).toBe('SELECT MAX(許可ID) AS newId FROM 許可 WHERE 許可論理ID = 50');
    });

    test('施設テーブルの最大施設IDを取得', () => {
        const sql = logic.buildGetMaxIdQuery('施設', '施設ID', '施設論理ID', 30);
        expect(sql).toBe('SELECT MAX(施設ID) AS newId FROM 施設 WHERE 施設論理ID = 30');
    });
});

// ===== buildCloseOldVersionByIdQuery =====

describe('buildCloseOldVersionByIdQuery（物理ID指定で旧バージョンクローズ）', () => {
    test('許可テーブルの旧バージョンをクローズ', () => {
        const sql = logic.buildCloseOldVersionByIdQuery('許可', '許可ID', 100, '2026/03/01');
        expect(sql).toBe('UPDATE 許可 SET 有効終了日時 = #2026/03/01# WHERE 許可ID = 100 AND 有効終了日時 IS NULL');
    });

    test('施設テーブルの旧バージョンをクローズ', () => {
        const sql = logic.buildCloseOldVersionByIdQuery('施設', '施設ID', 200, '2026/03/01');
        expect(sql).toBe('UPDATE 施設 SET 有効終了日時 = #2026/03/01# WHERE 施設ID = 200 AND 有効終了日時 IS NULL');
    });
});

// ===== buildLoadOfficerForEditQuery =====

describe('buildLoadOfficerForEditQuery（役員編集フォーム用SELECT）', () => {
    test('指定した役員IDのSELECT文を生成する', () => {
        const sql = logic.buildLoadOfficerForEditQuery(42);
        expect(sql).toBe('SELECT 役職名, 姓, 名 FROM 役員 WHERE 役員ID = 42');
    });
});

// ===== buildSavePermitQuery の修正（permitDate/validDate任意化）=====

describe('buildSavePermitQuery（許可保存 - permitDate/validDate任意化）', () => {
    test('permitDate/validDateを指定した場合はINSERTに含まれる', () => {
        const sql = logic.buildSavePermitQuery({
            logicalId: 10, businessId: 1, categoryId: 2,
            number: 'TEST-001', permitDate: '2026/01/01',
            validDate: '2031/01/01', excellent: true, todayStr: '2026/03/01'
        });
        expect(sql).toContain('許可年月日');
        expect(sql).toContain('#2026/01/01#');
        expect(sql).toContain('許可有効年月日');
        expect(sql).toContain('#2031/01/01#');
    });

    test('permitDate/validDateを省略した場合はINSERTに含まれない', () => {
        const sql = logic.buildSavePermitQuery({
            logicalId: 10, businessId: 1, categoryId: 2,
            number: 'TEST-001', excellent: false, todayStr: '2026/03/01'
        });
        expect(sql).not.toContain('許可年月日');
        expect(sql).not.toContain('許可有効年月日');
        expect(sql).toContain('許可論理ID');
        expect(sql).toContain('事業者ID');
        expect(sql).toContain('許可区分ID');
        expect(sql).toContain("'TEST-001'");
        expect(sql).toContain('False');
        expect(sql).toContain('#2026/03/01#');
    });

    test('permitDateのみ指定した場合', () => {
        const sql = logic.buildSavePermitQuery({
            logicalId: 10, businessId: 1, categoryId: 2,
            number: 'TEST-001', permitDate: '2026/05/01',
            excellent: true, todayStr: '2026/03/01'
        });
        expect(sql).toContain('許可年月日');
        expect(sql).not.toContain('許可有効年月日');
    });
});

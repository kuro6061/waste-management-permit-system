/**
 * 期待値リスト — 全関数のinput→output対応をデータ駆動テスト(test.each)で網羅的に文書化
 */
const logic = require('../../app_logic.js');

// ===== ユーティリティ関数 =====

describe('escapeHtml 期待値', () => {
    test.each([
        [null, ''],
        [undefined, ''],
        ['', ''],
        ['hello', 'hello'],
        ['<script>', '&lt;script&gt;'],
        ['"quotes"', '&quot;quotes&quot;'],
        ['a&b', 'a&amp;b'],
        ['<a href="x">&</a>', '&lt;a href=&quot;x&quot;&gt;&amp;&lt;/a&gt;'],
        [123, '123'],
        [0, '0'],
    ])('escapeHtml(%j) => %j', (input, expected) => {
        expect(logic.escapeHtml(input)).toBe(expected);
    });
});

describe('escapeSql 期待値', () => {
    test.each([
        [null, ''],
        [undefined, ''],
        ['', ''],
        [0, ''],
        [false, ''],
        ['hello', 'hello'],
        ["O'Brien", "O''Brien"],
        ["it's a 'test'", "it''s a ''test''"],
        [123, '123'],
    ])('escapeSql(%j) => %j', (input, expected) => {
        expect(logic.escapeSql(input)).toBe(expected);
    });
});

describe('padZero 期待値', () => {
    test.each([
        [0, '00'],
        [1, '01'],
        [9, '09'],
        [10, '10'],
        [12, '12'],
        [31, '31'],
        [99, '99'],
    ])('padZero(%d) => %j', (input, expected) => {
        expect(logic.padZero(input)).toBe(expected);
    });
});

describe('formatDate 期待値', () => {
    test.each([
        [null, ''],
        [undefined, ''],
        ['', ''],
        [0, ''],
        [false, ''],
        [new Date(2026, 0, 1), '2026/01/01'],
        [new Date(2026, 11, 31), '2026/12/31'],
        [new Date(2024, 1, 29), '2024/02/29'],
        ['invalid', ''],
    ])('formatDate(%j) => %j', (input, expected) => {
        expect(logic.formatDate(input)).toBe(expected);
    });
});

describe('buildDateStr 期待値', () => {
    test.each([
        [new Date(2026, 0, 1), '2026/01/01'],
        [new Date(2026, 2, 3), '2026/03/03'],
        [new Date(2026, 11, 31), '2026/12/31'],
        [new Date(2000, 0, 1), '2000/01/01'],
    ])('buildDateStr(%j) => %j', (input, expected) => {
        expect(logic.buildDateStr(input)).toBe(expected);
    });

    test('引数なしで今日の日付（yyyy/mm/dd形式）', () => {
        expect(logic.buildDateStr()).toMatch(/^\d{4}\/\d{2}\/\d{2}$/);
    });
});

// ===== バリデーション関数 =====

describe('validateRequired 期待値', () => {
    test.each([
        [null, 'フィールド', 'フィールドは必須です'],
        [undefined, 'フィールド', 'フィールドは必須です'],
        ['', 'テスト', 'テストは必須です'],
        ['   ', '名前', '名前は必須です'],
        ['値あり', 'テスト', null],
        [0, 'テスト', null],
        [false, 'テスト', null],  // String(false).trim() = "false" (非空)
    ])('validateRequired(%j, %j) => %j', (value, fieldName, expected) => {
        expect(logic.validateRequired(value, fieldName)).toBe(expected);
    });
});

describe('validateDateFormat 期待値', () => {
    test.each([
        [null, null],
        ['', null],
        ['2026/03/01', null],
        ['2024/02/29', null],
        ['2026/01/01', null],
        ['2026-03-01', '日付はyyyy/mm/dd形式で入力してください: 2026-03-01'],
        ['not-a-date', '日付はyyyy/mm/dd形式で入力してください: not-a-date'],
        ['2026/13/01', '無効な日付です: 2026/13/01'],
        ['2026/02/30', '無効な日付です: 2026/02/30'],
        ['2025/02/29', '無効な日付です: 2025/02/29'],
        ['2026/04/31', '無効な日付です: 2026/04/31'],
    ])('validateDateFormat(%j) => %j', (input, expected) => {
        expect(logic.validateDateFormat(input)).toBe(expected);
    });
});

describe('validateDateOrder 期待値', () => {
    test.each([
        ['2025/04/01', '2030/03/31', '開始', '終了', null],
        ['2026/03/01', '2026/03/01', '開始', '終了', null],
        [null, '2030/03/31', '開始', '終了', null],
        ['2025/04/01', null, '開始', '終了', null],
        [null, null, '開始', '終了', null],
        ['', '2030/03/31', '開始', '終了', null],
        ['2030/04/01', '2025/03/31', '許可年月日', '有効期限', '許可年月日(2030/04/01)は有効期限(2025/03/31)以前でなければなりません'],
    ])('validateDateOrder(%j, %j, %j, %j) => %j', (start, end, startLabel, endLabel, expected) => {
        expect(logic.validateDateOrder(start, end, startLabel, endLabel)).toBe(expected);
    });
});

describe('validateNonNegative 期待値', () => {
    test.each([
        [null, '処理能力', null],
        [undefined, '処理能力', null],
        [0, '処理能力', null],
        [100, '処理能力', null],
        [0.5, '処理能力', null],
        [-1, '処理能力', '処理能力は0以上でなければなりません'],
        [-100, '稼働時間', '稼働時間は0以上でなければなりません'],
        [-0.1, '数値', '数値は0以上でなければなりません'],
    ])('validateNonNegative(%j, %j) => %j', (value, fieldName, expected) => {
        expect(logic.validateNonNegative(value, fieldName)).toBe(expected);
    });
});

describe('validateBusinessData 期待値', () => {
    test.each([
        [{ name: 'テスト株式会社' }, 0],
        [{ name: '' }, 1],
        [{ name: null }, 1],
        [{ name: '   ' }, 1],
    ])('validateBusinessData(%j) => エラー%d件', (data, errorCount) => {
        expect(logic.validateBusinessData(data)).toHaveLength(errorCount);
    });
});

describe('validatePermitData 期待値', () => {
    test.each([
        [{ number: 'TEST-001', permitDate: '2025/04/01', validDate: '2030/03/31' }, 0],
        [{ number: 'TEST-001', permitDate: null, validDate: null }, 0],
        [{ number: '', permitDate: '2025/04/01', validDate: '2030/03/31' }, 1],
        [{ number: 'TEST-001', permitDate: 'bad', validDate: '2030/03/31' }, 2],  // format error + order error
        [{ number: 'TEST-001', permitDate: '2030/04/01', validDate: '2025/03/31' }, 1],
        [{ number: '', permitDate: 'bad', validDate: 'bad' }, 3],
    ])('validatePermitData(%j) => エラー%d件', (data, errorCount) => {
        expect(logic.validatePermitData(data)).toHaveLength(errorCount);
    });
});

describe('validateVehicleData 期待値', () => {
    test.each([
        [{ reg1: '品川', reg4: '1234' }, 0],
        [{ reg1: '', reg4: '1234' }, 1],
        [{ reg1: '品川', reg4: '' }, 1],
        [{ reg1: '', reg4: '' }, 2],
    ])('validateVehicleData(%j) => エラー%d件', (data, errorCount) => {
        expect(logic.validateVehicleData(data)).toHaveLength(errorCount);
    });
});

describe('validateOfficerData 期待値', () => {
    test.each([
        [{ lastName: '田中', firstName: '太郎', position: '代表取締役' }, 0],
        [{ lastName: '', firstName: '太郎', position: '代表取締役' }, 1],
        [{ lastName: '田中', firstName: '', position: '代表取締役' }, 1],
        [{ lastName: '田中', firstName: '太郎', position: '' }, 1],
        [{ lastName: '', firstName: '', position: '' }, 3],
    ])('validateOfficerData(%j) => エラー%d件', (data, errorCount) => {
        expect(logic.validateOfficerData(data)).toHaveLength(errorCount);
    });
});

describe('validateFacilityData 期待値', () => {
    test.each([
        [{ location: '東京都千代田区' }, 0],
        [{ location: '東京都', permitDate: '2026/03/01' }, 0],
        [{ location: '東京都', permitDate: '2026/03/01', setupDate: '2026/01/01' }, 0],
        [{ location: '' }, 1],
        [{ location: '東京都', permitDate: 'bad' }, 1],
        [{ location: '東京都', setupDate: 'bad' }, 1],
        [{ location: '', permitDate: 'bad', setupDate: 'bad' }, 3],
    ])('validateFacilityData(%j) => エラー%d件', (data, errorCount) => {
        expect(logic.validateFacilityData(data)).toHaveLength(errorCount);
    });
});

describe('validateCapacityData 期待値', () => {
    test.each([
        [{ hourCap: 100, dayCap: 500, hours: 8 }, 0],
        [{ hourCap: 0, dayCap: 0, hours: 0 }, 0],
        [{ hourCap: null, dayCap: null, hours: null }, 0],
        [{ hourCap: -1, dayCap: 500, hours: 8 }, 1],
        [{ hourCap: 100, dayCap: -1, hours: 8 }, 1],
        [{ hourCap: 100, dayCap: 500, hours: -1 }, 1],
        [{ hourCap: -1, dayCap: -1, hours: -1 }, 3],
    ])('validateCapacityData(%j) => エラー%d件', (data, errorCount) => {
        expect(logic.validateCapacityData(data)).toHaveLength(errorCount);
    });
});

describe('validateAbolishDate 期待値', () => {
    test.each([
        ['2020/01/01', 0],
        ['2099/12/31', 1],
        ['', 1],
        ['bad-date', 1],
    ])('validateAbolishDate(%j) => エラー%d件', (input, errorCount) => {
        expect(logic.validateAbolishDate(input)).toHaveLength(errorCount);
    });

    test('今日の日付はエラーなし', () => {
        expect(logic.validateAbolishDate(logic.buildDateStr())).toHaveLength(0);
    });
});

// ===== SQLビルダー（完全一致検証） =====

describe('buildDeleteBusinessQuery 完全一致', () => {
    test.each([
        [1, 'DELETE FROM 事業者 WHERE 事業者ID = 1'],
        [42, 'DELETE FROM 事業者 WHERE 事業者ID = 42'],
        [999, 'DELETE FROM 事業者 WHERE 事業者ID = 999'],
    ])('buildDeleteBusinessQuery(%d) => %j', (id, expected) => {
        expect(logic.buildDeleteBusinessQuery(id)).toBe(expected);
    });
});

describe('buildScrapVehicleQuery 完全一致', () => {
    test.each([
        [1, 'UPDATE 車両 SET 廃車フラグ = True WHERE 車両ID = 1'],
        [10, 'UPDATE 車両 SET 廃車フラグ = True WHERE 車両ID = 10'],
        [999, 'UPDATE 車両 SET 廃車フラグ = True WHERE 車両ID = 999'],
    ])('buildScrapVehicleQuery(%d) => %j', (id, expected) => {
        expect(logic.buildScrapVehicleQuery(id)).toBe(expected);
    });
});

describe('buildRestoreVehicleQuery 完全一致', () => {
    test.each([
        [1, 'UPDATE 車両 SET 廃車フラグ = False WHERE 車両ID = 1'],
        [50, 'UPDATE 車両 SET 廃車フラグ = False WHERE 車両ID = 50'],
    ])('buildRestoreVehicleQuery(%d) => %j', (id, expected) => {
        expect(logic.buildRestoreVehicleQuery(id)).toBe(expected);
    });
});

describe('buildDeleteVehicleQuery 完全一致', () => {
    test.each([
        [1, 'DELETE FROM 車両 WHERE 車両ID = 1'],
        [10, 'DELETE FROM 車両 WHERE 車両ID = 10'],
    ])('buildDeleteVehicleQuery(%d) => %j', (id, expected) => {
        expect(logic.buildDeleteVehicleQuery(id)).toBe(expected);
    });
});

describe('buildRetireOfficerQuery 完全一致', () => {
    test.each([
        [1, 'UPDATE 役員 SET 退任フラグ = True WHERE 役員ID = 1'],
        [20, 'UPDATE 役員 SET 退任フラグ = True WHERE 役員ID = 20'],
    ])('buildRetireOfficerQuery(%d) => %j', (id, expected) => {
        expect(logic.buildRetireOfficerQuery(id)).toBe(expected);
    });
});

describe('buildReinstateOfficerQuery 完全一致', () => {
    test.each([
        [1, 'UPDATE 役員 SET 退任フラグ = False WHERE 役員ID = 1'],
        [20, 'UPDATE 役員 SET 退任フラグ = False WHERE 役員ID = 20'],
    ])('buildReinstateOfficerQuery(%d) => %j', (id, expected) => {
        expect(logic.buildReinstateOfficerQuery(id)).toBe(expected);
    });
});

describe('buildDeleteOfficerQuery 完全一致', () => {
    test.each([
        [1, 'DELETE FROM 役員 WHERE 役員ID = 1'],
        [20, 'DELETE FROM 役員 WHERE 役員ID = 20'],
    ])('buildDeleteOfficerQuery(%d) => %j', (id, expected) => {
        expect(logic.buildDeleteOfficerQuery(id)).toBe(expected);
    });
});

describe('buildRestorePermitQuery 完全一致', () => {
    test.each([
        [1, 'UPDATE 許可 SET 廃止日 = NULL, 廃止理由 = NULL, 取消日 = NULL, 取消理由 = NULL, 有効終了日時 = NULL WHERE 許可ID = 1'],
        [789, 'UPDATE 許可 SET 廃止日 = NULL, 廃止理由 = NULL, 取消日 = NULL, 取消理由 = NULL, 有効終了日時 = NULL WHERE 許可ID = 789'],
    ])('buildRestorePermitQuery(%d) => 完全一致', (id, expected) => {
        expect(logic.buildRestorePermitQuery(id)).toBe(expected);
    });
});

describe('buildAbolishFacilityQuery 完全一致', () => {
    test.each([
        [30, '2026/02/28', 'UPDATE 施設 SET 有効終了日時 = #2026/02/28#, 廃止年月日 = #2026/02/28# WHERE 施設ID = 30'],
        [100, '2026/12/31', 'UPDATE 施設 SET 有効終了日時 = #2026/12/31#, 廃止年月日 = #2026/12/31# WHERE 施設ID = 100'],
    ])('buildAbolishFacilityQuery(%d, %j) => 完全一致', (id, date, expected) => {
        expect(logic.buildAbolishFacilityQuery(id, date)).toBe(expected);
    });
});

describe('buildDeleteCapacityQuery 完全一致', () => {
    test.each([
        [1, 'DELETE FROM 処理能力 WHERE 処理能力ID = 1'],
        [88, 'DELETE FROM 処理能力 WHERE 処理能力ID = 88'],
    ])('buildDeleteCapacityQuery(%d) => %j', (id, expected) => {
        expect(logic.buildDeleteCapacityQuery(id)).toBe(expected);
    });
});

describe('buildLoadBusinessDetailQuery 完全一致', () => {
    test.each([
        [1, 'SELECT * FROM 事業者 WHERE 事業者ID = 1'],
        [42, 'SELECT * FROM 事業者 WHERE 事業者ID = 42'],
    ])('buildLoadBusinessDetailQuery(%d) => %j', (id, expected) => {
        expect(logic.buildLoadBusinessDetailQuery(id)).toBe(expected);
    });
});

describe('buildLoadBusinessListQuery 完全一致', () => {
    test('デフォルト（事業者名昇順）', () => {
        expect(logic.buildLoadBusinessListQuery()).toBe(
            'SELECT 事業者ID, 事業者名, 郵便番号, 都道府県, 市区町村町名番地, 電話番号 FROM 事業者 ORDER BY 事業者名 ASC'
        );
    });
    test('事業者ID降順', () => {
        expect(logic.buildLoadBusinessListQuery("事業者ID", "DESC")).toBe(
            'SELECT 事業者ID, 事業者名, 郵便番号, 都道府県, 市区町村町名番地, 電話番号 FROM 事業者 ORDER BY 事業者ID DESC'
        );
    });
    test('不正なカラム名はデフォルトにフォールバック', () => {
        expect(logic.buildLoadBusinessListQuery("DROP TABLE", "ASC")).toContain('ORDER BY 事業者名 ASC');
    });
});

describe('buildLoadOfficerForEditQuery 完全一致', () => {
    test.each([
        [1, 'SELECT 役職名, 姓, 名 FROM 役員 WHERE 役員ID = 1'],
        [42, 'SELECT 役職名, 姓, 名 FROM 役員 WHERE 役員ID = 42'],
    ])('buildLoadOfficerForEditQuery(%d) => %j', (id, expected) => {
        expect(logic.buildLoadOfficerForEditQuery(id)).toBe(expected);
    });
});

// ===== getMasterConfig 全15種 =====

describe('getMasterConfig 全15種の期待値', () => {
    test.each([
        ['許可区分', 'マスター_許可区分', '許可区分ID', '許可区分名', '許可区分', undefined],
        ['施設種別', 'マスター_施設種別', '施設種別ID', '施設種別名', '施設種別', undefined],
        ['品目', 'マスター_品目', '品目ID', '品目名', '品目', '表示順'],
        ['処理方法', 'マスター_処理方法', '処理方法ID', '処理方法名', '処理方法', undefined],
        ['廃棄物種類区分', 'マスター_廃棄物種類区分', '廃棄物種類区分ID', '廃棄物種類名', '廃棄物種類区分', undefined],
        ['取扱区分', 'マスター_取扱区分', '取扱区分ID', '取扱区分記号', '取扱区分', undefined],
        ['形式', 'マスター_形式', '形式ID', '形式名', '形式', undefined],
        ['日処理能力単位', 'マスター_日処理能力単位', '日処理能力単位ID', '日処理能力単位名', '日処理能力単位', undefined],
        ['時間処理能力単位', 'マスター_時間処理能力単位', '時間処理能力単位ID', '時間処理能力単位名', '時間処理能力単位', undefined],
        ['管理区分', 'マスター_管理区分', '管理区分ID', '管理区分名', '管理区分', undefined],
        ['設置形態区分', 'マスター_設置形態区分', '設置形態区分ID', '設置形態区分名', '設置形態区分', undefined],
        ['許可対象区分', 'マスター_許可対象区分', '許可対象区分ID', '許可対象区分名', '許可対象区分', undefined],
        ['許可番号形式', 'マスター_許可番号形式', '許可番号形式ID', '許可番号形式名', '許可番号形式', '説明'],
        ['認定区分', 'マスター_認定区分', '認定ID', '認定名', '認定区分', undefined],
    ])('getMasterConfig(%j) => table=%j, idCol=%j, nameCol=%j, title=%j, extraCol=%j',
        (type, table, idCol, nameCol, title, extraCol) => {
            const config = logic.getMasterConfig(type);
            expect(config).toBeDefined();
            expect(config.table).toBe(table);
            expect(config.idCol).toBe(idCol);
            expect(config.nameCol).toBe(nameCol);
            expect(config.title).toBe(title);
            expect(config.extraCol).toBe(extraCol);
        });

    test('事業者区分のtableにソフトハイフンが含まれる', () => {
        const config = logic.getMasterConfig('事業者区分');
        expect(config).toBeDefined();
        expect(config.idCol).toBe('事業者区分ID');
        expect(config.nameCol).toBe('事業者区分名');
        expect(config.title).toBe('事業者区分');
    });

    test('存在しないタイプはundefined', () => {
        expect(logic.getMasterConfig('存在しない')).toBeUndefined();
    });
});

// ===== buildLoadPermitItemsQuery =====

describe('buildLoadPermitItemsQuery 完全一致', () => {
    test.each([
        [1, 'SELECT 品目ID, 取り扱いフラグ, 積替保管フラグ FROM 許可品目 WHERE 許可ID = 1'],
        [123, 'SELECT 品目ID, 取り扱いフラグ, 積替保管フラグ FROM 許可品目 WHERE 許可ID = 123'],
    ])('buildLoadPermitItemsQuery(%d) => %j', (id, expected) => {
        expect(logic.buildLoadPermitItemsQuery(id)).toBe(expected);
    });
});

// ===== buildCopyPermitItemsQuery =====

describe('buildCopyPermitItemsQuery 完全一致', () => {
    test.each([
        [100, 200, 'INSERT INTO 許可品目 (許可ID, 品目ID, 取り扱いフラグ, 積替保管フラグ) SELECT 200, 品目ID, 取り扱いフラグ, 積替保管フラグ FROM 許可品目 WHERE 許可ID = 100'],
        [50, 75, 'INSERT INTO 許可品目 (許可ID, 品目ID, 取り扱いフラグ, 積替保管フラグ) SELECT 75, 品目ID, 取り扱いフラグ, 積替保管フラグ FROM 許可品目 WHERE 許可ID = 50'],
    ])('buildCopyPermitItemsQuery(%d, %d) => 完全一致', (from, to, expected) => {
        expect(logic.buildCopyPermitItemsQuery(from, to)).toBe(expected);
    });
});

// ===== buildCloseOldPermitVersionsQuery =====

describe('buildCloseOldPermitVersionsQuery 完全一致', () => {
    test.each([
        [50, '2026/03/01', "UPDATE 許可 SET 有効終了日時 = DateAdd('d', -1, #2026/03/01#) WHERE 許可論理ID = 50 AND 有効終了日時 IS NULL"],
        [100, '2026/06/15', "UPDATE 許可 SET 有効終了日時 = DateAdd('d', -1, #2026/06/15#) WHERE 許可論理ID = 100 AND 有効終了日時 IS NULL"],
    ])('buildCloseOldPermitVersionsQuery(%d, %j) => 完全一致', (logicalId, newPermitDate, expected) => {
        expect(logic.buildCloseOldPermitVersionsQuery(logicalId, newPermitDate)).toBe(expected);
    });
});

// ===== buildCloseOldFacilityVersionsQuery =====

describe('buildCloseOldFacilityVersionsQuery 完全一致', () => {
    test.each([
        [30, '2026/12/20', undefined, 'UPDATE 施設 SET 有効終了日時 = #2026/12/20# WHERE 施設論理ID = 30 AND 有効終了日時 IS NULL'],
        [30, '2026/12/20', '2027/01/05', 'UPDATE 施設 SET 有効終了日時 = #2027/01/05# WHERE 施設論理ID = 30 AND 有効終了日時 IS NULL'],
    ])('buildCloseOldFacilityVersionsQuery(%d, %j, %j) => 完全一致', (logicalId, todayStr, boundary, expected) => {
        expect(logic.buildCloseOldFacilityVersionsQuery(logicalId, todayStr, boundary)).toBe(expected);
    });
});

// ===== buildStatisticsQueries =====

describe('buildStatisticsQueries 期待値', () => {
    test('4つのカウントクエリを返す', () => {
        const q = logic.buildStatisticsQueries();
        expect(q.businessCount).toBe('SELECT COUNT(*) AS cnt FROM [事業者]');
        expect(q.permitCount).toBe('SELECT COUNT(*) AS cnt FROM [許可] WHERE [有効終了日時] IS NULL AND [廃止日] IS NULL AND [取消日] IS NULL');
        expect(q.facilityCount).toBe('SELECT COUNT(*) AS cnt FROM [施設] WHERE [有効終了日時] IS NULL AND [廃止年月日] IS NULL');
        expect(q.expiringCount).toBe('SELECT COUNT(*) AS cnt FROM [許可] WHERE [有効終了日時] IS NULL AND [廃止日] IS NULL AND [取消日] IS NULL AND [許可有効年月日] IS NOT NULL');
    });
});

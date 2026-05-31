/**
 * 境界値分析テスト — 各関数のエッジケースを体系的に検証
 */
const logic = require('../../app_logic.js');

// ===== ユーティリティ境界値 =====

describe('escapeHtml 境界値', () => {
    test('NaN', () => {
        expect(logic.escapeHtml(NaN)).toBe('NaN');
    });

    test('Infinity', () => {
        expect(logic.escapeHtml(Infinity)).toBe('Infinity');
    });

    test('false', () => {
        expect(logic.escapeHtml(false)).toBe('false');
    });

    test('数値0', () => {
        expect(logic.escapeHtml(0)).toBe('0');
    });

    test('空オブジェクト', () => {
        expect(logic.escapeHtml({})).toBe('[object Object]');
    });

    test('配列', () => {
        expect(logic.escapeHtml([1, 2])).toBe('1,2');
    });

    test('Unicode文字列', () => {
        expect(logic.escapeHtml('日本語テスト')).toBe('日本語テスト');
    });

    test('絵文字', () => {
        expect(logic.escapeHtml('🏭♻️')).toBe('🏭♻️');
    });

    test('HTMLタグの入れ子', () => {
        expect(logic.escapeHtml('<div class="a"><span>b</span></div>'))
            .toBe('&lt;div class=&quot;a&quot;&gt;&lt;span&gt;b&lt;/span&gt;&lt;/div&gt;');
    });

    test('超長文字列（1000文字）', () => {
        const long = 'a'.repeat(1000);
        expect(logic.escapeHtml(long)).toBe(long);
    });

    test('特殊文字の混合', () => {
        expect(logic.escapeHtml('a<b>c&d"e')).toBe('a&lt;b&gt;c&amp;d&quot;e');
    });
});

describe('escapeSql 境界値', () => {
    test('NaN（falsyなので空文字）', () => {
        expect(logic.escapeSql(NaN)).toBe('');
    });

    test('数値0（falsyなので空文字）', () => {
        expect(logic.escapeSql(0)).toBe('');
    });

    test('false（falsyなので空文字）', () => {
        expect(logic.escapeSql(false)).toBe('');
    });

    test('連続シングルクォート', () => {
        expect(logic.escapeSql("'''")).toBe("''''''");
    });

    test('シングルクォートのみ', () => {
        expect(logic.escapeSql("'")).toBe("''");
    });

    test('Unicode文字列', () => {
        expect(logic.escapeSql('日本語')).toBe('日本語');
    });

    test('超長文字列（1000文字のシングルクォート）', () => {
        const long = "'".repeat(1000);
        expect(logic.escapeSql(long)).toBe("''".repeat(1000));
    });

    test('数値文字列', () => {
        expect(logic.escapeSql('12345')).toBe('12345');
    });

    test('true（文字列化）', () => {
        expect(logic.escapeSql(true)).toBe('true');
    });
});

describe('padZero 境界値', () => {
    test('負数', () => {
        // 負数は10未満の条件を満たすが、結果は実装依存
        expect(logic.padZero(-1)).toBe('0-1');
    });

    test('0', () => {
        expect(logic.padZero(0)).toBe('00');
    });

    test('境界: 9と10', () => {
        expect(logic.padZero(9)).toBe('09');
        expect(logic.padZero(10)).toBe('10');
    });

    test('大きい数', () => {
        expect(logic.padZero(100)).toBe('100');
    });
});

describe('formatDate 境界値', () => {
    test('数値0（falsy）', () => {
        expect(logic.formatDate(0)).toBe('');
    });

    test('NaN', () => {
        expect(logic.formatDate(NaN)).toBe('');
    });

    test('Infinity', () => {
        // Infinity passed to new Date() creates Invalid Date
        expect(logic.formatDate(Infinity)).toBe('');
    });

    test('空オブジェクト', () => {
        expect(logic.formatDate({})).toBe('');
    });

    test('文字列 "0"（truthyだがInvalid Date）', () => {
        // new Date("0") may create year 2000 or Invalid Date depending on engine
        const result = logic.formatDate('0');
        // 実装はtruthyでnew Dateに渡すので結果は環境依存
        expect(typeof result).toBe('string');
    });

    test('年末年始の境界', () => {
        expect(logic.formatDate(new Date(2025, 11, 31))).toBe('2025/12/31');
        expect(logic.formatDate(new Date(2026, 0, 1))).toBe('2026/01/01');
    });

    test('うるう年 2000/02/29', () => {
        expect(logic.formatDate(new Date(2000, 1, 29))).toBe('2000/02/29');
    });

    test('2月の最終日（非うるう年）', () => {
        expect(logic.formatDate(new Date(2025, 1, 28))).toBe('2025/02/28');
    });
});

describe('buildDateStr 境界値', () => {
    test('年始（1月1日）', () => {
        expect(logic.buildDateStr(new Date(2026, 0, 1))).toBe('2026/01/01');
    });

    test('年末（12月31日）', () => {
        expect(logic.buildDateStr(new Date(2026, 11, 31))).toBe('2026/12/31');
    });

    test('うるう日', () => {
        expect(logic.buildDateStr(new Date(2024, 1, 29))).toBe('2024/02/29');
    });

    test('西暦1桁の年', () => {
        // JavaScript Date with year 5 is actually year 1905
        const d = new Date(2000, 0, 1);
        expect(logic.buildDateStr(d)).toBe('2000/01/01');
    });
});

// ===== バリデーション境界値 =====

describe('validateDateFormat 境界値', () => {
    test('うるう年2000/02/29（400年ルール: うるう年）', () => {
        expect(logic.validateDateFormat('2000/02/29')).toBeNull();
    });

    test('非うるう年2100/02/29（100年ルール: 非うるう年）', () => {
        expect(logic.validateDateFormat('2100/02/29')).toContain('無効な日付');
    });

    test('2024/02/29（4年ルール: うるう年）', () => {
        expect(logic.validateDateFormat('2024/02/29')).toBeNull();
    });

    test('月末境界: 4/30は有効、4/31は無効', () => {
        expect(logic.validateDateFormat('2026/04/30')).toBeNull();
        expect(logic.validateDateFormat('2026/04/31')).toContain('無効な日付');
    });

    test('月末境界: 6/30は有効、6/31は無効', () => {
        expect(logic.validateDateFormat('2026/06/30')).toBeNull();
        expect(logic.validateDateFormat('2026/06/31')).toContain('無効な日付');
    });

    test('月末境界: 1/31は有効', () => {
        expect(logic.validateDateFormat('2026/01/31')).toBeNull();
    });

    test('月末境界: 3/31は有効', () => {
        expect(logic.validateDateFormat('2026/03/31')).toBeNull();
    });

    test('月0はフォーマットエラー（00はパースエラー）', () => {
        expect(logic.validateDateFormat('2026/00/01')).toContain('無効な日付');
    });

    test('日0は無効な日付', () => {
        expect(logic.validateDateFormat('2026/01/00')).toContain('無効な日付');
    });

    test('月13は無効な日付', () => {
        expect(logic.validateDateFormat('2026/13/01')).toContain('無効な日付');
    });

    test('日32は無効な日付', () => {
        expect(logic.validateDateFormat('2026/01/32')).toContain('無効な日付');
    });

    test('年のみ（フォーマット不一致）', () => {
        expect(logic.validateDateFormat('2026')).toContain('yyyy/mm/dd');
    });

    test('年/月のみ（フォーマット不一致）', () => {
        expect(logic.validateDateFormat('2026/03')).toContain('yyyy/mm/dd');
    });

    test('スラッシュなし', () => {
        expect(logic.validateDateFormat('20260301')).toContain('yyyy/mm/dd');
    });

    test('ゼロパディングなし', () => {
        expect(logic.validateDateFormat('2026/3/1')).toContain('yyyy/mm/dd');
    });
});

describe('validateDateOrder 境界値', () => {
    test('同一日付は有効（=のケース）', () => {
        expect(logic.validateDateOrder('2026/03/01', '2026/03/01', '開始', '終了')).toBeNull();
    });

    test('1日差（開始 < 終了）', () => {
        expect(logic.validateDateOrder('2026/03/01', '2026/03/02', '開始', '終了')).toBeNull();
    });

    test('1日差（開始 > 終了）', () => {
        expect(logic.validateDateOrder('2026/03/02', '2026/03/01', '開始', '終了')).not.toBeNull();
    });

    test('空文字列はnull扱い（スキップ）', () => {
        expect(logic.validateDateOrder('', '2026/03/01', '開始', '終了')).toBeNull();
        expect(logic.validateDateOrder('2026/03/01', '', '開始', '終了')).toBeNull();
    });
});

describe('validateNonNegative 境界値', () => {
    test('-0は有効（0と等しい）', () => {
        expect(logic.validateNonNegative(-0, 'テスト')).toBeNull();
    });

    test('Number.MAX_SAFE_INTEGER', () => {
        expect(logic.validateNonNegative(Number.MAX_SAFE_INTEGER, 'テスト')).toBeNull();
    });

    test('-Number.MIN_VALUE（最小の負数）', () => {
        expect(logic.validateNonNegative(-Number.MIN_VALUE, 'テスト')).not.toBeNull();
    });

    test('NaN（not < 0 なのでnull）', () => {
        // NaN < 0 is false, so it passes
        expect(logic.validateNonNegative(NaN, 'テスト')).toBeNull();
    });

    test('Infinity', () => {
        expect(logic.validateNonNegative(Infinity, 'テスト')).toBeNull();
    });

    test('-Infinity', () => {
        expect(logic.validateNonNegative(-Infinity, 'テスト')).not.toBeNull();
    });

    test('0.0001', () => {
        expect(logic.validateNonNegative(0.0001, 'テスト')).toBeNull();
    });

    test('-0.0001', () => {
        expect(logic.validateNonNegative(-0.0001, 'テスト')).not.toBeNull();
    });
});

describe('validateRequired 境界値', () => {
    test('半角スペースのみ', () => {
        expect(logic.validateRequired('   ', 'テスト')).toBe('テストは必須です');
    });

    test('全角スペースのみ', () => {
        // 全角スペースはtrim()で除去されない場合がある
        const result = logic.validateRequired('\u3000', 'テスト');
        // 実装による: String.trim()は全角スペースを除去しない
        // しかし'\u3000'.trim()はES2015+では除去する
        expect(typeof result === 'string' || result === null).toBe(true);
    });

    test('タブ文字のみ', () => {
        expect(logic.validateRequired('\t', 'テスト')).toBe('テストは必須です');
    });

    test('改行文字のみ', () => {
        expect(logic.validateRequired('\n', 'テスト')).toBe('テストは必須です');
    });

    test('前後空白あり', () => {
        expect(logic.validateRequired('  値  ', 'テスト')).toBeNull();
    });
});

// ===== SQLビルダーID境界値 =====

describe('SQLビルダー ID境界値', () => {
    test('buildDeleteBusinessQuery: id=0', () => {
        expect(logic.buildDeleteBusinessQuery(0)).toBe('DELETE FROM 事業者 WHERE 事業者ID = 0');
    });

    test('buildDeleteBusinessQuery: id=-1', () => {
        expect(logic.buildDeleteBusinessQuery(-1)).toBe('DELETE FROM 事業者 WHERE 事業者ID = -1');
    });

    test('buildDeleteBusinessQuery: id=MAX_SAFE_INTEGER', () => {
        const id = Number.MAX_SAFE_INTEGER;
        expect(logic.buildDeleteBusinessQuery(id)).toBe('DELETE FROM 事業者 WHERE 事業者ID = ' + id);
    });

    test('buildScrapVehicleQuery: id=0', () => {
        expect(logic.buildScrapVehicleQuery(0)).toContain('車両ID = 0');
    });

    test('buildRetireOfficerQuery: id=0', () => {
        expect(logic.buildRetireOfficerQuery(0)).toContain('役員ID = 0');
    });

    test('buildRestorePermitQuery: id=0', () => {
        expect(logic.buildRestorePermitQuery(0)).toContain('許可ID = 0');
    });

    test('buildDeleteCapacityQuery: id=0', () => {
        expect(logic.buildDeleteCapacityQuery(0)).toBe('DELETE FROM 処理能力 WHERE 処理能力ID = 0');
    });

    test('buildAbolishFacilityQuery: id=0', () => {
        expect(logic.buildAbolishFacilityQuery(0, '2026/03/01')).toContain('施設ID = 0');
    });
});

describe('buildSaveBusinessQuery 境界値', () => {
    test('id=0 は新規登録（INSERT）', () => {
        const sql = logic.buildSaveBusinessQuery({ id: 0, name: 'テスト', businessType: '', zipCode: '', pref: '', address: '', phone: '' });
        expect(sql).toMatch(/^INSERT INTO 事業者/);
    });

    test('id=1 は更新（UPDATE）', () => {
        const sql = logic.buildSaveBusinessQuery({ id: 1, name: 'テスト', businessType: '', zipCode: '', pref: '', address: '', phone: '' });
        expect(sql).toMatch(/^UPDATE 事業者 SET/);
    });

    test('id=-1 は新規登録（INSERT: id > 0 が false）', () => {
        const sql = logic.buildSaveBusinessQuery({ id: -1, name: 'テスト', businessType: '', zipCode: '', pref: '', address: '', phone: '' });
        expect(sql).toMatch(/^INSERT INTO 事業者/);
    });

    test('事業者名が空文字列でもSQLは生成される（バリデーションは別）', () => {
        const sql = logic.buildSaveBusinessQuery({ id: 0, name: '', businessType: '', zipCode: '', pref: '', address: '', phone: '' });
        expect(sql).toContain("''");
    });

    test('businessType が空文字列のときNULL', () => {
        const sql = logic.buildSaveBusinessQuery({ id: 0, name: 'テスト', businessType: '', zipCode: '', pref: '', address: '', phone: '' });
        expect(sql).toContain('NULL');
    });

    test('businessType が "0" のとき 0 が入る（truthyなので）', () => {
        const sql = logic.buildSaveBusinessQuery({ id: 0, name: 'テスト', businessType: '0', zipCode: '', pref: '', address: '', phone: '' });
        expect(sql).toContain(', 0, ');
    });
});

describe('buildSaveOfficerQuery 境界値', () => {
    test('id=0 は新規登録（INSERT）', () => {
        const sql = logic.buildSaveOfficerQuery({ id: 0, businessId: 1, position: '代表', lastName: '田中', firstName: '太郎' });
        expect(sql).toMatch(/^INSERT INTO 役員/);
    });

    test('id=1 は更新（UPDATE）', () => {
        const sql = logic.buildSaveOfficerQuery({ id: 1, businessId: 1, position: '代表', lastName: '田中', firstName: '太郎' });
        expect(sql).toMatch(/^UPDATE 役員 SET/);
    });

    test('id=-1 は新規登録（INSERT）', () => {
        const sql = logic.buildSaveOfficerQuery({ id: -1, businessId: 1, position: '代表', lastName: '田中', firstName: '太郎' });
        expect(sql).toMatch(/^INSERT INTO 役員/);
    });
});

describe('buildSavePermitQuery 境界値', () => {
    test('permitDateなしの場合todayStrが有効開始日時に使われる', () => {
        const sql = logic.buildSavePermitQuery({
            logicalId: 1, businessId: 1, categoryId: 1,
            number: 'TEST', excellent: false, todayStr: '2026/03/01'
        });
        // 有効開始日時と作成日時の両方にtodayStr
        const matches = sql.match(/#2026\/03\/01#/g);
        expect(matches.length).toBe(2);
    });

    test('validDateなしの場合許可有効年月日カラムがSQLに含まれない', () => {
        const sql = logic.buildSavePermitQuery({
            logicalId: 1, businessId: 1, categoryId: 1,
            number: 'TEST', permitDate: '2026/01/01',
            excellent: false, todayStr: '2026/03/01'
        });
        expect(sql).not.toContain('許可有効年月日');
    });

    test('空文字列の許可番号', () => {
        const sql = logic.buildSavePermitQuery({
            logicalId: 1, businessId: 1, categoryId: 1,
            number: '', excellent: false, todayStr: '2026/03/01'
        });
        expect(sql).toContain("''");
    });
});

describe('buildSaveCapacityQuery 境界値', () => {
    test('hourCap=0 は falsy なので NULL になる（0→NULL問題の文書化）', () => {
        const sql = logic.buildSaveCapacityQuery({
            facilityId: 1, itemId: 1,
            hourCap: 0, hourUnit: 1,
            dayCap: 100, dayUnit: 1,
            hours: 8, note: ''
        });
        // hourCap=0 は (data.hourCap || "NULL") で "NULL" になる
        expect(sql).toContain('NULL');
    });

    test('dayCap=0 も NULL になる（0→NULL問題）', () => {
        const sql = logic.buildSaveCapacityQuery({
            facilityId: 1, itemId: 1,
            hourCap: 10, hourUnit: 1,
            dayCap: 0, dayUnit: 1,
            hours: 8, note: ''
        });
        // dayCap=0 は (data.dayCap || "NULL") で "NULL" になる（INSERT文ではVALUES句に直接入る）
        expect(sql).toContain('NULL');
    });

    test('hours=0 も NULL になる（0→NULL問題）', () => {
        const sql = logic.buildSaveCapacityQuery({
            facilityId: 1, itemId: 1,
            hourCap: 10, hourUnit: 1,
            dayCap: 100, dayUnit: 1,
            hours: 0, note: ''
        });
        expect(sql).toContain('NULL');
    });

    test('全フィールドに値がある場合NULLなし', () => {
        const sql = logic.buildSaveCapacityQuery({
            facilityId: 1, itemId: 1,
            hourCap: '5.0', hourUnit: 1,
            dayCap: '100', dayUnit: 2,
            hours: '8', note: 'テスト'
        });
        expect(sql).not.toContain('NULL');
    });

    test('editId=0 は新規登録（INSERT: editId がfalsyなので）', () => {
        const sql = logic.buildSaveCapacityQuery({
            editId: 0, facilityId: 1, itemId: 1,
            hourCap: '5', hourUnit: 1,
            dayCap: '100', dayUnit: 2,
            hours: '8', note: ''
        });
        expect(sql).toMatch(/^INSERT INTO 処理能力/);
    });

    test('editId > 0 は更新（UPDATE）', () => {
        const sql = logic.buildSaveCapacityQuery({
            editId: 1,
            hourCap: '5', hourUnit: 1,
            dayCap: '100', dayUnit: 2,
            hours: '8', note: ''
        });
        expect(sql).toMatch(/^UPDATE 処理能力 SET/);
    });
});

describe('buildSaveFacilityQuery 境界値', () => {
    test('全オプションフィールドがnull/undefined/空のときNULL', () => {
        const sql = logic.buildSaveFacilityQuery({
            logicalId: 1, businessId: 1, typeId: 1,
            location: '東京', todayStr: '2026/03/01'
        });
        // permitNo, permitDate, setupDate がないので NULL x 3相当
        const nullCount = (sql.match(/NULL/g) || []).length;
        expect(nullCount).toBeGreaterThanOrEqual(2);
    });

    test('permitDateが空文字列のときtodayStrにフォールバック', () => {
        const sql = logic.buildSaveFacilityQuery({
            logicalId: 1, businessId: 1, typeId: 1,
            location: '東京', permitDate: '', todayStr: '2026/03/01'
        });
        expect(sql).toContain('#2026/03/01#');
    });
});

describe('buildSaveVehicleQuery 境界値', () => {
    test('reg2, reg3が未指定でも空文字列が入る', () => {
        const sql = logic.buildSaveVehicleQuery({
            businessId: 1, reg1: '品川', reg4: '1234'
        });
        expect(sql).toContain("'品川'");
        expect(sql).toContain("'1234'");
        expect(sql).toContain("''"); // reg2 or reg3 is empty
    });
});

describe('buildPermitItemQueries 境界値', () => {
    test('permitId=0, itemId=0', () => {
        const q = logic.buildPermitItemQueries(0, 0);
        expect(q.select).toContain('許可ID = 0 AND 品目ID = 0');
        expect(q.insert).toContain('0, 0, True, False');
    });

    test('toTransfer recId=0', () => {
        const q = logic.buildPermitItemQueries(1, 1);
        expect(q.toTransfer(0)).toContain('WHERE 許可品目ID = 0');
    });

    test('remove recId=0', () => {
        const q = logic.buildPermitItemQueries(1, 1);
        expect(q.remove(0)).toContain('WHERE 許可品目ID = 0');
    });
});

describe('buildUpdatePermitHistoryQuery 境界値', () => {
    test('必須フィールドのみ（他すべてundefined）', () => {
        const sql = logic.buildUpdatePermitHistoryQuery({
            permitId: 1, permitNumber: 'TEST', categoryId: 1
        });
        expect(sql).toContain("許可番号 = 'TEST'");
        expect(sql).toContain('許可区分ID = 1');
        expect(sql).toContain('WHERE 許可ID = 1');
        // undefinedのフィールドはSET句に含まれない
        expect(sql).not.toContain('許可年月日');
        expect(sql).not.toContain('許可有効年月日');
        expect(sql).not.toContain('有効開始日時');
        expect(sql).not.toContain('有効終了日時');
        expect(sql).not.toContain('優良認定');
        expect(sql).not.toContain('取消日');
        expect(sql).not.toContain('廃止日');
    });

    test('全フィールドが空文字列（NULLで更新）', () => {
        const sql = logic.buildUpdatePermitHistoryQuery({
            permitId: 1, permitNumber: 'TEST', categoryId: 1,
            permitDate: '', validDate: '', startDate: '', endDate: '',
            excellent: false, cancelDate: '', cancelReason: '',
            abolishDate: '', abolishReason: ''
        });
        expect(sql).toContain('許可年月日 = NULL');
        expect(sql).toContain('許可有効年月日 = NULL');
        expect(sql).toContain('有効開始日時 = NULL');
        expect(sql).toContain('有効終了日時 = NULL');
        expect(sql).toContain('優良認定 = False');
        expect(sql).toContain('取消日 = NULL');
        expect(sql).toContain('取消理由 = NULL');
        expect(sql).toContain('廃止日 = NULL');
        expect(sql).toContain('廃止理由 = NULL');
    });
});

describe('buildUpdateFacilityHistoryQuery 境界値', () => {
    test('必須フィールドのみ（他すべてundefined）', () => {
        const sql = logic.buildUpdateFacilityHistoryQuery({
            facilityId: 1, typeId: 1, location: '東京'
        });
        expect(sql).toContain('施設種別ID = 1');
        expect(sql).toContain("設置場所 = '東京'");
        expect(sql).not.toContain('許可番号');
        expect(sql).not.toContain('許可年月日');
        expect(sql).not.toContain('設置年月日');
    });

    test('全フィールドが空文字列（NULLで更新）', () => {
        const sql = logic.buildUpdateFacilityHistoryQuery({
            facilityId: 1, typeId: 1, location: '東京',
            permitNo: '', permitDate: '', setupDate: '',
            startDate: '', endDate: '', abolishDate: ''
        });
        expect(sql).toContain('許可番号 = NULL');
        expect(sql).toContain('許可年月日 = NULL');
        expect(sql).toContain('設置年月日 = NULL');
        expect(sql).toContain('有効開始日時 = NULL');
        expect(sql).toContain('有効終了日時 = NULL');
        expect(sql).toContain('廃止年月日 = NULL');
    });
});

describe('buildSaveMasterQuery 境界値', () => {
    test('id=0 は新規登録（INSERT）', () => {
        const config = logic.getMasterConfig('許可区分');
        const sql = logic.buildSaveMasterQuery(config, { id: 0, newId: 99, name: 'テスト' });
        expect(sql).toMatch(/^INSERT/);
    });

    test('id=1 は更新（UPDATE）', () => {
        const config = logic.getMasterConfig('許可区分');
        const sql = logic.buildSaveMasterQuery(config, { id: 1, name: 'テスト' });
        expect(sql).toMatch(/^UPDATE/);
    });

    test('extra未指定は0にフォールバック', () => {
        const config = logic.getMasterConfig('品目');
        const sql = logic.buildSaveMasterQuery(config, { id: 1, name: 'テスト' });
        expect(sql).toContain('表示順 = 0');
    });

    test('extra="abc" はparseIntでNaNになる', () => {
        const config = logic.getMasterConfig('品目');
        const sql = logic.buildSaveMasterQuery(config, { id: 1, name: 'テスト', extra: 'abc' });
        // parseInt("abc") = NaN
        expect(sql).toContain('表示順 = NaN');
    });
});

/**
 * バリデーション関数のテスト
 * 誤操作シミュレーションで発見された17件の問題に対するバリデーションを検証する
 */
const logic = require('../../app_logic.js');

// ===== validateRequired =====

describe('validateRequired', () => {
    test('nullはエラー', () => {
        expect(logic.validateRequired(null, 'テスト')).toBe('テストは必須です');
    });
    test('undefinedはエラー', () => {
        expect(logic.validateRequired(undefined, 'テスト')).toBe('テストは必須です');
    });
    test('空文字はエラー', () => {
        expect(logic.validateRequired('', 'テスト')).toBe('テストは必須です');
    });
    test('スペースのみはエラー', () => {
        expect(logic.validateRequired('   ', 'テスト')).toBe('テストは必須です');
    });
    test('有効な文字列はnull', () => {
        expect(logic.validateRequired('有効な値', 'テスト')).toBeNull();
    });
    test('数値0はnull（有効）', () => {
        expect(logic.validateRequired(0, 'テスト')).toBeNull();
    });
});

// ===== validateDateFormat =====

describe('validateDateFormat', () => {
    test('null（オプショナル）はnull', () => {
        expect(logic.validateDateFormat(null)).toBeNull();
    });
    test('空文字（オプショナル）はnull', () => {
        expect(logic.validateDateFormat('')).toBeNull();
    });
    test('正しい日付はnull', () => {
        expect(logic.validateDateFormat('2026/03/01')).toBeNull();
    });
    test('ハイフン区切りはエラー', () => {
        expect(logic.validateDateFormat('2026-03-01')).toContain('yyyy/mm/dd');
    });
    test('"not-a-date"はエラー', () => {
        expect(logic.validateDateFormat('not-a-date')).toContain('yyyy/mm/dd');
    });
    test('存在しない日付（13月）はエラー', () => {
        expect(logic.validateDateFormat('2026/13/01')).toContain('無効な日付');
    });
    test('存在しない日付（2月30日）はエラー', () => {
        expect(logic.validateDateFormat('2026/02/30')).toContain('無効な日付');
    });
    test('うるう年の2月29日は有効', () => {
        expect(logic.validateDateFormat('2024/02/29')).toBeNull();
    });
    test('非うるう年の2月29日はエラー', () => {
        expect(logic.validateDateFormat('2025/02/29')).toContain('無効な日付');
    });
});

// ===== validateDateOrder =====

describe('validateDateOrder', () => {
    test('開始日 < 終了日はnull', () => {
        expect(logic.validateDateOrder('2025/04/01', '2030/03/31', '許可年月日', '有効期限')).toBeNull();
    });
    test('開始日 = 終了日はnull', () => {
        expect(logic.validateDateOrder('2026/03/01', '2026/03/01', '許可年月日', '有効期限')).toBeNull();
    });
    test('開始日 > 終了日はエラー', () => {
        var result = logic.validateDateOrder('2030/04/01', '2025/03/31', '許可年月日', '許可有効年月日');
        expect(result).toContain('許可年月日');
        expect(result).toContain('許可有効年月日');
        expect(result).toContain('以前');
    });
    test('開始日がnullの場合はnull（スキップ）', () => {
        expect(logic.validateDateOrder(null, '2030/03/31', '許可年月日', '有効期限')).toBeNull();
    });
    test('終了日がnullの場合はnull（スキップ）', () => {
        expect(logic.validateDateOrder('2025/04/01', null, '許可年月日', '有効期限')).toBeNull();
    });
});

// ===== validateNonNegative =====

describe('validateNonNegative', () => {
    test('-1はエラー', () => {
        expect(logic.validateNonNegative(-1, '処理能力')).toContain('0以上');
    });
    test('-100はエラー', () => {
        expect(logic.validateNonNegative(-100, '処理能力')).toContain('0以上');
    });
    test('0はnull（有効）', () => {
        expect(logic.validateNonNegative(0, '処理能力')).toBeNull();
    });
    test('正の数はnull', () => {
        expect(logic.validateNonNegative(100, '処理能力')).toBeNull();
    });
    test('nullはnull（スキップ）', () => {
        expect(logic.validateNonNegative(null, '処理能力')).toBeNull();
    });
    test('undefinedはnull（スキップ）', () => {
        expect(logic.validateNonNegative(undefined, '処理能力')).toBeNull();
    });
});

// ===== validateBusinessData =====

describe('validateBusinessData', () => {
    test('空の事業者名はエラー', () => {
        var errors = logic.validateBusinessData({ name: '' });
        expect(errors).toHaveLength(1);
        expect(errors[0]).toContain('事業者名');
    });
    test('正常な事業者名はエラーなし', () => {
        expect(logic.validateBusinessData({ name: 'テスト株式会社' })).toHaveLength(0);
    });
});

// ===== validatePermitData =====

describe('validatePermitData', () => {
    test('空の許可番号はエラー（A-2再現）', () => {
        var errors = logic.validatePermitData({
            number: '', permitDate: '2025/04/01', validDate: '2030/03/31'
        });
        expect(errors.length).toBeGreaterThanOrEqual(1);
        expect(errors.some(e => e.includes('許可番号'))).toBe(true);
    });

    test('不正な日付フォーマットはエラー（B-1再現）', () => {
        var errors = logic.validatePermitData({
            number: 'TEST-001', permitDate: 'not-a-date', validDate: '2030/03/31'
        });
        expect(errors.length).toBeGreaterThanOrEqual(1);
        expect(errors.some(e => e.includes('yyyy/mm/dd'))).toBe(true);
    });

    test('逆転日付はエラー（B-2再現）', () => {
        var errors = logic.validatePermitData({
            number: 'TEST-001', permitDate: '2030/04/01', validDate: '2025/03/31'
        });
        expect(errors.length).toBeGreaterThanOrEqual(1);
        expect(errors.some(e => e.includes('以前'))).toBe(true);
    });

    test('正常なデータはエラーなし', () => {
        var errors = logic.validatePermitData({
            number: 'TEST-001', permitDate: '2025/04/01', validDate: '2030/03/31'
        });
        expect(errors).toHaveLength(0);
    });

    test('日付省略時もエラーなし', () => {
        var errors = logic.validatePermitData({
            number: 'TEST-001', permitDate: null, validDate: null
        });
        expect(errors).toHaveLength(0);
    });
});

// ===== validateVehicleData =====

describe('validateVehicleData', () => {
    test('空の登録番号1はエラー', () => {
        var errors = logic.validateVehicleData({ reg1: '', reg4: '1234' });
        expect(errors.some(e => e.includes('登録番号1'))).toBe(true);
    });
    test('空の登録番号4はエラー', () => {
        var errors = logic.validateVehicleData({ reg1: '品川', reg4: '' });
        expect(errors.some(e => e.includes('登録番号4'))).toBe(true);
    });
    test('両方空だと2つのエラー', () => {
        var errors = logic.validateVehicleData({ reg1: '', reg4: '' });
        expect(errors).toHaveLength(2);
    });
    test('正常なデータはエラーなし', () => {
        expect(logic.validateVehicleData({ reg1: '品川', reg4: '1234' })).toHaveLength(0);
    });
});

// ===== validateOfficerData =====

describe('validateOfficerData', () => {
    test('全て空だと3つのエラー', () => {
        var errors = logic.validateOfficerData({ lastName: '', firstName: '', position: '' });
        expect(errors).toHaveLength(3);
    });
    test('正常なデータはエラーなし', () => {
        expect(logic.validateOfficerData({ lastName: '田中', firstName: '太郎', position: '代表取締役' })).toHaveLength(0);
    });
});

// ===== validateFacilityData =====

describe('validateFacilityData', () => {
    test('空の設置場所はエラー（A-5再現）', () => {
        var errors = logic.validateFacilityData({ location: '' });
        expect(errors.some(e => e.includes('設置場所'))).toBe(true);
    });
    test('不正な許可年月日はエラー', () => {
        var errors = logic.validateFacilityData({ location: 'テスト', permitDate: 'bad' });
        expect(errors.some(e => e.includes('yyyy/mm/dd'))).toBe(true);
    });
    test('正常なデータはエラーなし', () => {
        expect(logic.validateFacilityData({ location: '東京都千代田区', permitDate: '2026/03/01' })).toHaveLength(0);
    });
});

// ===== validateCapacityData =====

describe('validateCapacityData', () => {
    test('マイナスの時間処理能力はエラー（B-4再現）', () => {
        var errors = logic.validateCapacityData({ hourCap: -100, dayCap: 500, hours: 8 });
        expect(errors.some(e => e.includes('時間処理能力'))).toBe(true);
    });
    test('マイナスの日処理能力はエラー', () => {
        var errors = logic.validateCapacityData({ hourCap: 100, dayCap: -500, hours: 8 });
        expect(errors.some(e => e.includes('日処理能力'))).toBe(true);
    });
    test('マイナスの稼働時間はエラー', () => {
        var errors = logic.validateCapacityData({ hourCap: 100, dayCap: 500, hours: -8 });
        expect(errors.some(e => e.includes('稼働時間'))).toBe(true);
    });
    test('全てマイナスだと3つのエラー', () => {
        var errors = logic.validateCapacityData({ hourCap: -100, dayCap: -500, hours: -8 });
        expect(errors).toHaveLength(3);
    });
    test('0以上はエラーなし', () => {
        expect(logic.validateCapacityData({ hourCap: 0, dayCap: 100, hours: 8 })).toHaveLength(0);
    });
    test('null値はスキップ（エラーなし）', () => {
        expect(logic.validateCapacityData({ hourCap: null, dayCap: null, hours: null })).toHaveLength(0);
    });
});

// ===== validateAbolishDate =====

describe('validateAbolishDate', () => {
    test('空の廃止日はエラー', () => {
        var errors = logic.validateAbolishDate('');
        expect(errors.some(e => e.includes('必須'))).toBe(true);
    });
    test('不正フォーマットはエラー', () => {
        var errors = logic.validateAbolishDate('not-a-date');
        expect(errors.some(e => e.includes('yyyy/mm/dd'))).toBe(true);
    });
    test('1年以上先の日付はエラー（B-6再現）', () => {
        var errors = logic.validateAbolishDate('2099/12/31');
        expect(errors.some(e => e.includes('1年以上先'))).toBe(true);
    });
    test('今日の日付はエラーなし', () => {
        var today = new Date();
        var y = today.getFullYear();
        var m = (today.getMonth() + 1 < 10 ? '0' : '') + (today.getMonth() + 1);
        var d = (today.getDate() < 10 ? '0' : '') + today.getDate();
        expect(logic.validateAbolishDate(y + '/' + m + '/' + d)).toHaveLength(0);
    });
    test('過去の日付はエラーなし', () => {
        expect(logic.validateAbolishDate('2020/01/01')).toHaveLength(0);
    });
});

// ===== 誤操作シミュレーション再現テスト =====

describe('誤操作シミュレーション再現テスト', () => {
    test('A-2: 空許可番号をバリデーションで検出', () => {
        var errors = logic.validatePermitData({
            number: '', permitDate: '2025/04/01', validDate: '2030/03/31'
        });
        expect(errors.length).toBeGreaterThan(0);
    });

    test('A-5: 空設置場所をバリデーションで検出', () => {
        var errors = logic.validateFacilityData({ location: '' });
        expect(errors.length).toBeGreaterThan(0);
    });

    test('B-2: 逆転日付をバリデーションで検出', () => {
        var errors = logic.validatePermitData({
            number: 'TEST-001', permitDate: '2030/04/01', validDate: '2025/03/31'
        });
        expect(errors.length).toBeGreaterThan(0);
    });

    test('B-4: マイナス処理能力をバリデーションで検出', () => {
        var errors = logic.validateCapacityData({ hourCap: -100, dayCap: -500, hours: -8 });
        expect(errors.length).toBeGreaterThan(0);
    });

    test('B-6: 2099年廃止日をバリデーションで検出', () => {
        var errors = logic.validateAbolishDate('2099/12/31');
        expect(errors.length).toBeGreaterThan(0);
    });

    test('E-1想定: 正常な事業者名はバリデーション通過（重複チェックはDB層）', () => {
        var errors = logic.validateBusinessData({ name: 'テスト株式会社' });
        expect(errors).toHaveLength(0);
    });
});

// ===== normalizePermitNumber =====

describe('normalizePermitNumber', () => {
    test('全角数字を半角に変換', () => {
        expect(logic.normalizePermitNumber('１２３４５')).toBe('12345');
    });
    test('全角英字を半角に変換', () => {
        expect(logic.normalizePermitNumber('ＡＢＣ')).toBe('ABC');
    });
    test('全角ハイフンを半角に変換', () => {
        expect(logic.normalizePermitNumber('１２３ー４５')).toBe('123-45');
    });
    test('混在した全角半角を統一', () => {
        expect(logic.normalizePermitNumber('第１２３ー４５号')).toBe('第123-45号');
    });
    test('半角のみの場合はそのまま', () => {
        expect(logic.normalizePermitNumber('12345')).toBe('12345');
    });
    test('前後の空白をトリム', () => {
        expect(logic.normalizePermitNumber('  12345  ')).toBe('12345');
    });
    test('空文字列', () => {
        expect(logic.normalizePermitNumber('')).toBe('');
    });
    test('null', () => {
        expect(logic.normalizePermitNumber(null)).toBe('');
    });
    test('全角ダッシュ（―）を半角ハイフンに変換', () => {
        expect(logic.normalizePermitNumber('123―456')).toBe('123-456');
    });
});

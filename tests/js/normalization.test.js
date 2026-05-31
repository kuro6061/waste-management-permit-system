/**
 * 正規化関数・ユーティリティテスト
 * numOrNull, normalizeToHankaku, normalizePermitNumber, normalizeBusinessName
 */
const logic = require('../../app_logic.js');

describe('正規化・ユーティリティ', () => {
    describe('numOrNull', () => {
        test('nullは"NULL"を返す', () => {
            expect(logic.numOrNull(null)).toBe('NULL');
        });

        test('undefinedは"NULL"を返す', () => {
            expect(logic.numOrNull(undefined)).toBe('NULL');
        });

        test('空文字列は"NULL"を返す', () => {
            expect(logic.numOrNull('')).toBe('NULL');
        });

        test('0はそのまま返す', () => {
            expect(logic.numOrNull(0)).toBe(0);
        });

        test('正の数はそのまま返す', () => {
            expect(logic.numOrNull(42)).toBe(42);
        });

        test('負の数はそのまま返す', () => {
            expect(logic.numOrNull(-5)).toBe(-5);
        });

        test('小数はそのまま返す', () => {
            expect(logic.numOrNull(3.14)).toBe(3.14);
        });

        test('文字列の数値はそのまま返す', () => {
            expect(logic.numOrNull('123')).toBe('123');
        });
    });

    describe('normalizeToHankaku', () => {
        test('null/undefined/空文字列は空文字列', () => {
            expect(logic.normalizeToHankaku(null)).toBe('');
            expect(logic.normalizeToHankaku(undefined)).toBe('');
            expect(logic.normalizeToHankaku('')).toBe('');
        });

        test('全角英字→半角', () => {
            expect(logic.normalizeToHankaku('ＡＢＣ')).toBe('ABC');
        });

        test('全角数字→半角', () => {
            expect(logic.normalizeToHankaku('１２３')).toBe('123');
        });

        test('全角英数混在→半角', () => {
            expect(logic.normalizeToHankaku('ＡＢＣ１２３')).toBe('ABC123');
        });

        test('全角ハイフン類→半角ハイフン', () => {
            expect(logic.normalizeToHankaku('ー')).toBe('-');  // U+30FC
            expect(logic.normalizeToHankaku('－')).toBe('-');  // U+FF0D
            expect(logic.normalizeToHankaku('‐')).toBe('-');  // U+2010
        });

        test('前後の空白をトリム', () => {
            expect(logic.normalizeToHankaku('  hello  ')).toBe('hello');
        });

        test('半角はそのまま', () => {
            expect(logic.normalizeToHankaku('abc123')).toBe('abc123');
        });

        test('日本語はそのまま', () => {
            expect(logic.normalizeToHankaku('東京都')).toBe('東京都');
        });
    });

    describe('normalizePermitNumber', () => {
        test('normalizeToHankakuと同じ関数', () => {
            expect(logic.normalizePermitNumber).toBe(logic.normalizeToHankaku);
        });

        test('全角許可番号を半角に', () => {
            expect(logic.normalizePermitNumber('０１２３４５６７８９０')).toBe('01234567890');
        });
    });

    describe('normalizeBusinessName', () => {
        test('null/空文字列は空文字列', () => {
            expect(logic.normalizeBusinessName(null)).toBe('');
            expect(logic.normalizeBusinessName('')).toBe('');
        });

        test('全角英数→半角', () => {
            expect(logic.normalizeBusinessName('ＡＢＣ１２３')).toBe('ABC123');
        });

        test('㈱→除去（法人格除去）', () => {
            const result = logic.normalizeBusinessName('㈱テスト');
            expect(result).toBe('テスト');
        });

        test('株式会社→除去', () => {
            const result = logic.normalizeBusinessName('株式会社テスト');
            expect(result).toBe('テスト');
        });

        test('(株)→除去', () => {
            const result = logic.normalizeBusinessName('(株)テスト');
            expect(result).toBe('テスト');
        });

        test('（株）→除去', () => {
            const result = logic.normalizeBusinessName('（株）テスト');
            expect(result).toBe('テスト');
        });

        test('有限会社→除去', () => {
            expect(logic.normalizeBusinessName('有限会社テスト')).toBe('テスト');
        });

        test('㈲→除去', () => {
            expect(logic.normalizeBusinessName('㈲テスト')).toBe('テスト');
        });

        test('合同会社→除去', () => {
            expect(logic.normalizeBusinessName('合同会社テスト')).toBe('テスト');
        });

        test('スペース除去', () => {
            expect(logic.normalizeBusinessName('テ ス ト')).toBe('テスト');
            expect(logic.normalizeBusinessName('テ　ス　ト')).toBe('テスト');
        });

        test('中黒除去', () => {
            expect(logic.normalizeBusinessName('テ・スト')).toBe('テスト');
        });

        test('半角カナ→全角カナ', () => {
            expect(logic.normalizeBusinessName('ﾃｽﾄ')).toBe('テスト');
        });

        test('半角カナ濁音→全角', () => {
            expect(logic.normalizeBusinessName('ｶﾞﾊﾞ')).toBe('ガバ');
        });

        test('半角カナ半濁音→全角', () => {
            expect(logic.normalizeBusinessName('ﾊﾟﾋﾟﾌﾟﾍﾟﾎﾟ')).toBe('パピプペポ');
        });

        test('括弧付き注記を除去', () => {
            expect(logic.normalizeBusinessName('テスト（廃止）')).toBe('テスト');
        });

        test('ハイフン系をー（長音）に統一', () => {
            const result = logic.normalizeBusinessName('テスト-商事');
            expect(result).toBe('テストー商事');
        });

        test('旧）以降を除去', () => {
            expect(logic.normalizeBusinessName('テスト旧）旧名前')).toBe('テスト');
        });

        test('法人格の前後どちらでも除去', () => {
            expect(logic.normalizeBusinessName('テスト株式会社')).toBe('テスト');
            expect(logic.normalizeBusinessName('株式会社テスト')).toBe('テスト');
        });

        test('複合ケース: ㈱＋全角＋スペース', () => {
            const result = logic.normalizeBusinessName('㈱ テスト　ＡＢＣ');
            expect(result).toBe('テストABC');
        });
    });

    describe('buildBusinessNameMap', () => {
        test('名前が一致する事業者をマッピング', () => {
            const current = [
                { '事業者ID': 1, '事業者名': '株式会社テスト' },
                { '事業者ID': 2, '事業者名': '有限会社サンプル' },
            ];
            const legacy = [
                { 'ID': 100, '業者名': '㈱テスト' },
                { 'ID': 200, '業者名': '㈲ｻﾝﾌﾟﾙ' },
            ];
            const result = logic.buildBusinessNameMap(current, legacy);
            expect(result.map[100]).toBe(1);
            expect(result.map[200]).toBe(2);
            expect(result.unmatched).toHaveLength(0);
        });

        test('マッチしない事業者をunmatchedに記録', () => {
            const current = [{ '事業者ID': 1, '事業者名': '株式会社テスト' }];
            const legacy = [
                { 'ID': 100, '業者名': '㈱テスト' },
                { 'ID': 200, '業者名': '全く別の会社' },
            ];
            const result = logic.buildBusinessNameMap(current, legacy);
            expect(result.map[100]).toBe(1);
            expect(result.unmatched).toHaveLength(1);
            expect(result.unmatched[0].legacyId).toBe(200);
        });
    });
});

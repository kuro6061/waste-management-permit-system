/**
 * app_logic.js のテスト
 * HTAで使用されるユーティリティ関数とSQLビルダー関数をテストする
 */
const logic = require('../../app_logic.js');

// ===== ユーティリティ関数テスト =====

describe('escapeHtml', () => {
    test('HTML特殊文字をエスケープする', () => {
        expect(logic.escapeHtml('<script>alert("xss")</script>')).toBe(
            '&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;'
        );
    });

    test('&記号をエスケープする', () => {
        expect(logic.escapeHtml('A & B')).toBe('A &amp; B');
    });

    test('null/undefinedは空文字を返す', () => {
        expect(logic.escapeHtml(null)).toBe('');
        expect(logic.escapeHtml(undefined)).toBe('');
        expect(logic.escapeHtml('')).toBe('');
    });

    test('数値は文字列に変換してそのまま返す', () => {
        expect(logic.escapeHtml(123)).toBe('123');
    });

    test('日本語はそのまま返す', () => {
        expect(logic.escapeHtml('テスト事業者')).toBe('テスト事業者');
    });
});

describe('escapeSql', () => {
    test('シングルクォートを二重にする', () => {
        expect(logic.escapeSql("O'Brien")).toBe("O''Brien");
    });

    test('複数のシングルクォート', () => {
        expect(logic.escapeSql("it's a test's value")).toBe("it''s a test''s value");
    });

    test('null/undefinedは空文字を返す', () => {
        expect(logic.escapeSql(null)).toBe('');
        expect(logic.escapeSql(undefined)).toBe('');
        expect(logic.escapeSql('')).toBe('');
    });

    test('シングルクォートのない文字列はそのまま', () => {
        expect(logic.escapeSql('テスト')).toBe('テスト');
    });
});

describe('padZero', () => {
    test('1桁の数値にゼロパディング', () => {
        expect(logic.padZero(1)).toBe('01');
        expect(logic.padZero(9)).toBe('09');
    });

    test('2桁の数値はそのまま', () => {
        expect(logic.padZero(10)).toBe('10');
        expect(logic.padZero(12)).toBe('12');
    });
});

describe('padZero2', () => {
    test('padZeroと同じ動作', () => {
        expect(logic.padZero2(1)).toBe('01');
        expect(logic.padZero2(10)).toBe('10');
    });
});

describe('formatDate', () => {
    test('Dateオブジェクトをyyyy/mm/dd形式にフォーマット', () => {
        const d = new Date(2026, 0, 15); // 2026/01/15
        expect(logic.formatDate(d)).toBe('2026/01/15');
    });

    test('月と日にゼロパディング', () => {
        const d = new Date(2026, 1, 3); // 2026/02/03
        expect(logic.formatDate(d)).toBe('2026/02/03');
    });

    test('日付文字列からフォーマット', () => {
        expect(logic.formatDate('2026/06/15')).toBe('2026/06/15');
    });

    test('null/undefinedは空文字', () => {
        expect(logic.formatDate(null)).toBe('');
        expect(logic.formatDate(undefined)).toBe('');
        expect(logic.formatDate('')).toBe('');
    });

    test('不正な日付は空文字', () => {
        expect(logic.formatDate('invalid')).toBe('');
    });
});

// ===== getMasterConfig テスト =====

describe('getMasterConfig', () => {
    const masterTypes = [
        { type: '許可区分', table: 'マスター_許可区分', idCol: '許可区分ID', nameCol: '許可区分名' },
        { type: '施設種別', table: 'マスター_施設種別', idCol: '施設種別ID', nameCol: '施設種別名' },
        { type: '品目', table: 'マスター_品目', idCol: '品目ID', nameCol: '品目名', extraCol: '表示順' },
        { type: '処理方法', table: 'マスター_処理方法', idCol: '処理方法ID', nameCol: '処理方法名' },
        { type: '廃棄物種類区分', table: 'マスター_廃棄物種類区分', idCol: '廃棄物種類区分ID', nameCol: '廃棄物種類名' },
        { type: '取扱区分', table: 'マスター_取扱区分', idCol: '取扱区分ID', nameCol: '取扱区分記号' },
        { type: '形式', table: 'マスター_形式', idCol: '形式ID', nameCol: '形式名' },
        { type: '日処理能力単位', table: 'マスター_日処理能力単位', idCol: '日処理能力単位ID', nameCol: '日処理能力単位名' },
        { type: '時間処理能力単位', table: 'マスター_時間処理能力単位', idCol: '時間処理能力単位ID', nameCol: '時間処理能力単位名' },
        { type: '管理区分', table: 'マスター_管理区分', idCol: '管理区分ID', nameCol: '管理区分名' },
        { type: '設置形態区分', table: 'マスター_設置形態区分', idCol: '設置形態区分ID', nameCol: '設置形態区分名' },
        { type: '許可対象区分', table: 'マスター_許可対象区分', idCol: '許可対象区分ID', nameCol: '許可対象区分名' },
        { type: '許可番号形式', table: 'マスター_許可番号形式', idCol: '許可番号形式ID', nameCol: '許可番号形式名', extraCol: '説明' },
        { type: '認定区分', table: 'マスター_認定区分', idCol: '認定ID', nameCol: '認定名' },
    ];

    test.each(masterTypes)('$type のテーブル・カラム設定が正しい', ({ type, table, idCol, nameCol, extraCol }) => {
        const config = logic.getMasterConfig(type);
        expect(config).toBeDefined();
        expect(config.table).toBe(table);
        expect(config.idCol).toBe(idCol);
        expect(config.nameCol).toBe(nameCol);
        if (extraCol) {
            expect(config.extraCol).toBe(extraCol);
        }
    });

    test('事業者区分の特殊文字テーブル名を処理', () => {
        const config = logic.getMasterConfig('事業者区分');
        expect(config).toBeDefined();
        expect(config.idCol).toBe('事業者区分ID');
        expect(config.nameCol).toBe('事業者区分名');
    });

    test('存在しないタイプはundefinedを返す', () => {
        expect(logic.getMasterConfig('存在しない')).toBeUndefined();
    });
});

// ===== SQLビルダー関数テスト =====

describe('buildSearchBusinessQuery', () => {
    test('キーワードでLIKE検索するSQLを生成', () => {
        const sql = logic.buildSearchBusinessQuery('テスト');
        expect(sql).toContain('SELECT');
        expect(sql).toContain('事業者ID');
        expect(sql).toContain('事業者名');
        expect(sql).toContain("LIKE '%テスト%'");
        expect(sql).toContain('ORDER BY 事業者ID');
    });

    test('シングルクォートを含むキーワードがエスケープされる', () => {
        const sql = logic.buildSearchBusinessQuery("O'Brien");
        expect(sql).toContain("O''Brien");
        expect(sql).not.toContain("O'Brien");
    });

    test('必要なカラムがすべて含まれる', () => {
        const sql = logic.buildSearchBusinessQuery('test');
        expect(sql).toContain('事業者ID');
        expect(sql).toContain('事業者名');
        expect(sql).toContain('郵便番号');
        expect(sql).toContain('都道府県');
        expect(sql).toContain('市区町村町名番地');
        expect(sql).toContain('電話番号');
    });
});

describe('buildSearchPermitQuery', () => {
    const baseParams = {
        asOfDateSql: '#2026/02/28 23:59:59#'
    };

    test('基本的な許可検索クエリを生成（条件なし）', () => {
        const sql = logic.buildSearchPermitQuery(baseParams);
        expect(sql).toContain('SELECT DISTINCT');
        expect(sql).toContain('許可.許可ID');
        expect(sql).toContain('事業者.事業者名');
        expect(sql).toContain('マスター_許可区分.許可区分名');
        expect(sql).toContain('有効開始日時');
        expect(sql).toContain('ORDER BY 許可.許可ID DESC');
    });

    test('キーワード条件が追加される', () => {
        const sql = logic.buildSearchPermitQuery({ ...baseParams, keyword: 'テスト' });
        expect(sql).toContain("許可.許可番号 LIKE '%テスト%'");
        expect(sql).toContain("事業者.事業者名 LIKE '%テスト%'");
    });

    test('許可区分フィルタが追加される', () => {
        const sql = logic.buildSearchPermitQuery({ ...baseParams, categoryId: '3' });
        expect(sql).toContain('許可.許可区分ID = 3');
    });

    test('有効期限フィルタ - 期限切れ', () => {
        const sql = logic.buildSearchPermitQuery({ ...baseParams, expiry: 'expired' });
        expect(sql).toContain('許可.許可有効年月日 <');
    });

    test('有効期限フィルタ - 30日以内', () => {
        const sql = logic.buildSearchPermitQuery({ ...baseParams, expiry: '30days' });
        expect(sql).toContain('BETWEEN');
        expect(sql).toContain("DateAdd('d', 30,");
    });

    test('有効期限フィルタ - 1年以内', () => {
        const sql = logic.buildSearchPermitQuery({ ...baseParams, expiry: '1year' });
        expect(sql).toContain("DateAdd('yyyy', 1,");
    });

    test('状態フィルタ - 有効', () => {
        const sql = logic.buildSearchPermitQuery({ ...baseParams, status: 'active' });
        expect(sql).toContain('廃止日 IS NULL AND 許可.取消日 IS NULL');
    });

    test('状態フィルタ - 廃止', () => {
        const sql = logic.buildSearchPermitQuery({ ...baseParams, status: 'abolished' });
        expect(sql).toContain('廃止日 IS NOT NULL');
    });

    test('状態フィルタ - 取消', () => {
        const sql = logic.buildSearchPermitQuery({ ...baseParams, status: 'cancelled' });
        expect(sql).toContain('取消日 IS NOT NULL');
    });

    test('優良認定フィルタ', () => {
        const sql = logic.buildSearchPermitQuery({ ...baseParams, excellentOnly: true });
        expect(sql).toContain('優良認定 = True');
    });

    test('品目OR検索', () => {
        const sql = logic.buildSearchPermitQuery({
            ...baseParams,
            selectedItemIds: ['1', '3'],
            itemMode: 'OR'
        });
        expect(sql).toContain('INNER JOIN 許可品目');
        expect(sql).toContain('品目ID IN (1,3)');
        expect(sql).toContain('取り扱いフラグ = True');
    });

    test('品目AND検索', () => {
        const sql = logic.buildSearchPermitQuery({
            ...baseParams,
            selectedItemIds: ['1', '3'],
            itemMode: 'AND'
        });
        expect(sql).not.toContain('SELECT DISTINCT');
        expect(sql).toContain('EXISTS');
        expect(sql).toContain('品目ID = 1');
        expect(sql).toContain('品目ID = 3');
    });

    test('複合条件', () => {
        const sql = logic.buildSearchPermitQuery({
            ...baseParams,
            keyword: 'テスト',
            categoryId: '2',
            expiry: 'valid',
            status: 'active',
            excellentOnly: true
        });
        expect(sql).toContain("LIKE '%テスト%'");
        expect(sql).toContain('許可区分ID = 2');
        expect(sql).toContain('許可有効年月日 >=');
        expect(sql).toContain('廃止日 IS NULL');
        expect(sql).toContain('優良認定 = True');
    });
});

describe('buildSearchFacilityQuery', () => {
    test('条件なしで基本クエリを生成', () => {
        const sql = logic.buildSearchFacilityQuery('', '');
        expect(sql).toContain('施設.施設ID');
        expect(sql).toContain('施設種別名');
        expect(sql).toContain('有効終了日時 IS NULL');
        expect(sql).toContain('廃止年月日 IS NULL');
        expect(sql).toContain('ORDER BY 施設.施設ID DESC');
    });

    test('キーワード検索', () => {
        const sql = logic.buildSearchFacilityQuery('東京', '');
        expect(sql).toContain("設置場所 LIKE '%東京%'");
        expect(sql).toContain("許可番号 LIKE '%東京%'");
        expect(sql).toContain("事業者名 LIKE '%東京%'");
    });

    test('施設種別フィルタ', () => {
        const sql = logic.buildSearchFacilityQuery('', '5');
        expect(sql).toContain('施設種別ID = 5');
    });
});

describe('buildSearchVehicleQuery', () => {
    test('廃車を除外する（デフォルト）', () => {
        const sql = logic.buildSearchVehicleQuery('品川', false);
        expect(sql).toContain("登録番号1 LIKE '%品川%'");
        expect(sql).toContain('廃車フラグ = False OR 車両.廃車フラグ IS NULL');
    });

    test('廃車を含む', () => {
        const sql = logic.buildSearchVehicleQuery('品川', true);
        expect(sql).toContain("登録番号1 LIKE '%品川%'");
        expect(sql).not.toContain('廃車フラグ = False');
    });
});

describe('buildSearchOfficerQuery', () => {
    test('退任者を除外する（デフォルト）', () => {
        const sql = logic.buildSearchOfficerQuery('田中', false);
        expect(sql).toContain("姓 LIKE '%田中%'");
        expect(sql).toContain('退任フラグ = False OR 役員.退任フラグ IS NULL');
    });

    test('退任者を含む', () => {
        const sql = logic.buildSearchOfficerQuery('田中', true);
        expect(sql).toContain("姓 LIKE '%田中%'");
        expect(sql).not.toContain('退任フラグ = False');
    });
});

describe('buildLoadPermitsQuery', () => {
    test('事業者IDで許可を検索するクエリを生成', () => {
        const sql = logic.buildLoadPermitsQuery(42);
        expect(sql).toContain('許可.許可ID');
        expect(sql).toContain('許可.許可論理ID');
        expect(sql).toContain('許可区分名');
        expect(sql).toContain('事業者ID = 42');
        expect(sql).toContain("Format(許可.許可年月日, 'yyyy/mm/dd')");
        expect(sql).toContain('ORDER BY 許可.許可区分ID, 許可.有効開始日時 DESC');
    });
});

describe('buildStatisticsQueries', () => {
    test('4つの統計クエリを返す', () => {
        const queries = logic.buildStatisticsQueries();
        expect(queries.businessCount).toContain('COUNT(*)');
        expect(queries.businessCount).toContain('事業者');
        expect(queries.permitCount).toContain('許可');
        expect(queries.permitCount).toContain('有効終了日時');
        expect(queries.facilityCount).toContain('施設');
        expect(queries.expiringCount).toContain('許可有効年月日');
    });

    test('各クエリにcntエイリアスがある', () => {
        const queries = logic.buildStatisticsQueries();
        Object.values(queries).forEach(sql => {
            expect(sql).toContain('AS cnt');
        });
    });

    test('許可数は廃止・取消を二重フィルタリングで除外する', () => {
        const queries = logic.buildStatisticsQueries();
        expect(queries.permitCount).toContain('[有効終了日時] IS NULL');
        expect(queries.permitCount).toContain('[廃止日] IS NULL');
        expect(queries.permitCount).toContain('[取消日] IS NULL');
    });

    test('施設数は廃止を二重フィルタリングで除外する', () => {
        const queries = logic.buildStatisticsQueries();
        expect(queries.facilityCount).toContain('[有効終了日時] IS NULL');
        expect(queries.facilityCount).toContain('[廃止年月日] IS NULL');
    });

    test('期限切れ間近クエリは廃止・取消を除外する', () => {
        const queries = logic.buildStatisticsQueries();
        expect(queries.expiringCount).toContain('[廃止日] IS NULL');
        expect(queries.expiringCount).toContain('[取消日] IS NULL');
    });
});

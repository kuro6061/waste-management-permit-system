/**
 * 廃棄物対策課 職員操作シミュレーションテスト
 *
 * 職員が1日の業務で行う典型的な操作を再現し、
 * SQLビルダーが正しいクエリを生成するか検証する
 */
const logic = require('../../app_logic.js');

// ===== シナリオ1: 朝の業務開始 - ダッシュボード確認 =====

describe('シナリオ1: ダッシュボード統計確認', () => {
    test('統計クエリが4つ返され、それぞれSQLとして有効', () => {
        const q = logic.buildStatisticsQueries();
        expect(Object.keys(q)).toHaveLength(4);
        // 各クエリがSELECT COUNT(*)を含む
        Object.entries(q).forEach(([key, sql]) => {
            expect(sql).toMatch(/SELECT COUNT\(\*\) AS cnt FROM/);
        });
    });

    test('統計クエリのテーブル名が正しい', () => {
        const q = logic.buildStatisticsQueries();
        expect(q.businessCount).toContain('[事業者]');
        expect(q.permitCount).toContain('[許可]');
        expect(q.facilityCount).toContain('[施設]');
        expect(q.expiringCount).toContain('[許可]');
    });
});

// ===== シナリオ2: 電話問い合わせ対応 - 事業者検索 =====

describe('シナリオ2: 事業者検索（電話問い合わせ対応）', () => {
    test('「株式会社山田環境」で検索', () => {
        const sql = logic.buildSearchBusinessQuery('株式会社山田環境');
        expect(sql).toContain("LIKE '%株式会社山田環境%'");
        expect(sql).toContain('ORDER BY 事業者ID');
    });

    test('電話番号「048-123」で検索', () => {
        const sql = logic.buildSearchBusinessQuery('048-123');
        expect(sql).toContain("LIKE '%048-123%'");
        expect(sql).toContain('電話番号');
    });

    test('住所「さいたま市」で検索', () => {
        const sql = logic.buildSearchBusinessQuery('さいたま市');
        expect(sql).toContain("LIKE '%さいたま市%'");
        expect(sql).toContain('市区町村町名番地');
    });

    test('事業者名にシングルクォートを含む（O\'Brien Waste Co.）', () => {
        const sql = logic.buildSearchBusinessQuery("O'Brien Waste Co.");
        // SQLインジェクション対策: シングルクォートが二重化される
        expect(sql).toContain("O''Brien");
        expect(sql).not.toMatch(/O'B/);  // エスケープされていないシングルクォートがない
    });

    test('空白のみの検索キーワード', () => {
        // 空白のみの場合、LIKE '% %' になるが、
        // HTAのsearchBusiness()側でバリデーションすべき
        const sql = logic.buildSearchBusinessQuery('   ');
        // SQLとしては有効（ただし意図しない結果になる可能性がある）
        expect(sql).toContain("LIKE '%   %'");
    });

    test('空文字の場合もSQLとして構文エラーにならない', () => {
        const sql = logic.buildSearchBusinessQuery('');
        expect(sql).toContain("LIKE '%%'");
        expect(sql).toContain('SELECT');
    });
});

// ===== シナリオ3: 新規許可申請の受付 =====

describe('シナリオ3: 新規許可申請 - 許可検索', () => {
    const baseDate = '#2026/02/28 23:59:59#';

    test('申請者名で既存許可を検索', () => {
        const sql = logic.buildSearchPermitQuery({
            keyword: '山田環境サービス',
            asOfDateSql: baseDate
        });
        expect(sql).toContain("事業者.事業者名 LIKE '%山田環境サービス%'");
        expect(sql).toContain("許可.許可番号 LIKE '%山田環境サービス%'");
    });

    test('許可番号で検索', () => {
        const sql = logic.buildSearchPermitQuery({
            keyword: '01100012345',
            asOfDateSql: baseDate
        });
        expect(sql).toContain("LIKE '%01100012345%'");
    });

    test('産業廃棄物収集運搬業（許可区分ID=1）の有効な許可を検索', () => {
        const sql = logic.buildSearchPermitQuery({
            categoryId: '1',
            status: 'active',
            asOfDateSql: baseDate
        });
        expect(sql).toContain('許可区分ID = 1');
        expect(sql).toContain('廃止日 IS NULL AND 許可.取消日 IS NULL');
    });

    test('30日以内に期限切れの許可を検索（更新勧奨用）', () => {
        const sql = logic.buildSearchPermitQuery({
            expiry: '30days',
            status: 'active',
            asOfDateSql: baseDate
        });
        expect(sql).toContain('BETWEEN');
        expect(sql).toContain("DateAdd('d', 30,");
        expect(sql).toContain('廃止日 IS NULL');
    });

    test('1年以内に期限が来る優良認定業者を検索', () => {
        const sql = logic.buildSearchPermitQuery({
            expiry: '1year',
            excellentOnly: true,
            asOfDateSql: baseDate
        });
        expect(sql).toContain("DateAdd('yyyy', 1,");
        expect(sql).toContain('優良認定 = True');
    });
});

// ===== シナリオ4: 品目条件付き許可検索 =====

describe('シナリオ4: 品目指定の許可検索', () => {
    const baseDate = '#2026/02/28 23:59:59#';

    test('「燃え殻」と「廃プラ」のいずれかを扱える業者をOR検索', () => {
        const sql = logic.buildSearchPermitQuery({
            selectedItemIds: ['1', '5'],
            itemMode: 'OR',
            asOfDateSql: baseDate
        });
        expect(sql).toContain('INNER JOIN 許可品目');
        expect(sql).toContain('品目ID IN (1,5)');
        expect(sql).toContain('SELECT DISTINCT');
    });

    test('「燃え殻」と「廃プラ」の両方を扱える業者をAND検索', () => {
        const sql = logic.buildSearchPermitQuery({
            selectedItemIds: ['1', '5'],
            itemMode: 'AND',
            asOfDateSql: baseDate
        });
        expect(sql).toContain('EXISTS');
        expect(sql).toContain('品目ID = 1');
        expect(sql).toContain('品目ID = 5');
        // AND検索時はDISTINCTなし
        expect(sql).not.toContain('SELECT DISTINCT');
    });

    test('品目AND検索 + キーワード + 有効のみの複合条件', () => {
        const sql = logic.buildSearchPermitQuery({
            keyword: '山田',
            selectedItemIds: ['1', '3', '5'],
            itemMode: 'AND',
            status: 'active',
            asOfDateSql: baseDate
        });
        // 3つのEXISTS句
        const existsCount = (sql.match(/EXISTS/g) || []).length;
        expect(existsCount).toBe(3);
        expect(sql).toContain("事業者.事業者名 LIKE '%山田%'");
        expect(sql).toContain('廃止日 IS NULL');
    });

    test('品目OR検索 + 許可区分 + 期限切れの複合条件', () => {
        const sql = logic.buildSearchPermitQuery({
            selectedItemIds: ['2'],
            itemMode: 'OR',
            categoryId: '3',
            expiry: 'expired',
            asOfDateSql: baseDate
        });
        expect(sql).toContain('品目ID IN (2)');
        expect(sql).toContain('許可区分ID = 3');
        expect(sql).toContain('許可有効年月日 <');
    });
});

// ===== シナリオ5: 事業者詳細 - 許可一覧表示 =====

describe('シナリオ5: 事業者の許可一覧を表示', () => {
    test('事業者ID=42の許可一覧を取得', () => {
        const sql = logic.buildLoadPermitsQuery(42);
        expect(sql).toContain('事業者ID = 42');
        expect(sql).toContain('許可区分名');
        expect(sql).toContain("Format(許可.許可年月日, 'yyyy/mm/dd')");
    });

    test('事業者ID=0でもSQLエラーにならない', () => {
        const sql = logic.buildLoadPermitsQuery(0);
        expect(sql).toContain('事業者ID = 0');
        expect(sql).toContain('SELECT');
    });

    test('事業者IDが大きな数値でも問題ない', () => {
        const sql = logic.buildLoadPermitsQuery(99999);
        expect(sql).toContain('事業者ID = 99999');
    });
});

// ===== シナリオ6: 施設の検索 =====

describe('シナリオ6: 施設検索', () => {
    test('キーワード「埼玉県」で施設を検索', () => {
        const sql = logic.buildSearchFacilityQuery('埼玉県', '');
        expect(sql).toContain("設置場所 LIKE '%埼玉県%'");
        expect(sql).toContain("許可番号 LIKE '%埼玉県%'");
        expect(sql).toContain("事業者名 LIKE '%埼玉県%'");
        expect(sql).toContain('有効終了日時 IS NULL');
    });

    test('施設種別「焼却施設」（種別ID=1）で絞り込み', () => {
        const sql = logic.buildSearchFacilityQuery('', '1');
        expect(sql).toContain('施設種別ID = 1');
        expect(sql).not.toContain('LIKE');
    });

    test('キーワード + 施設種別の複合検索', () => {
        const sql = logic.buildSearchFacilityQuery('川越市', '3');
        expect(sql).toContain("LIKE '%川越市%'");
        expect(sql).toContain('施設種別ID = 3');
    });

    test('条件なしで全施設一覧', () => {
        const sql = logic.buildSearchFacilityQuery('', '');
        expect(sql).toContain('有効終了日時 IS NULL');
        expect(sql).not.toContain('LIKE');
        // WHERE句に施設種別IDの絞り込み条件がないことを確認
        // （JOINのON句にはあるが、WHERE/ANDでの絞り込みはない）
        expect(sql).not.toMatch(/AND\s+施設\.施設種別ID\s*=/);
    });
});

// ===== シナリオ7: 車両の検索・登録 =====

describe('シナリオ7: 車両検索', () => {
    test('「大宮」ナンバーで車両を検索（廃車除外）', () => {
        const sql = logic.buildSearchVehicleQuery('大宮', false);
        expect(sql).toContain("登録番号1 LIKE '%大宮%'");
        expect(sql).toContain('廃車フラグ = False OR 車両.廃車フラグ IS NULL');
    });

    test('「大宮」ナンバーで車両を検索（廃車含む）', () => {
        const sql = logic.buildSearchVehicleQuery('大宮', true);
        expect(sql).toContain("登録番号1 LIKE '%大宮%'");
        expect(sql).not.toContain('廃車フラグ = False');
    });

    test('事業者名で車両を検索', () => {
        const sql = logic.buildSearchVehicleQuery('山田運輸', false);
        expect(sql).toContain("事業者.事業者名 LIKE '%山田運輸%'");
    });

    test('車両番号の部分一致（4桁部分）', () => {
        const sql = logic.buildSearchVehicleQuery('1234', false);
        expect(sql).toContain("登録番号4 LIKE '%1234%'");
    });
});

// ===== シナリオ8: 役員の検索・変更 =====

describe('シナリオ8: 役員検索', () => {
    test('姓「田中」で役員検索（退任者除外）', () => {
        const sql = logic.buildSearchOfficerQuery('田中', false);
        expect(sql).toContain("姓 LIKE '%田中%'");
        expect(sql).toContain('退任フラグ = False OR 役員.退任フラグ IS NULL');
    });

    test('「代表取締役」で役職名検索', () => {
        const sql = logic.buildSearchOfficerQuery('代表取締役', false);
        expect(sql).toContain("役職名 LIKE '%代表取締役%'");
    });

    test('退任者含めて全件検索', () => {
        const sql = logic.buildSearchOfficerQuery('', true);
        expect(sql).not.toContain('退任フラグ = False');
        expect(sql).toContain("LIKE '%%'");
    });
});

// ===== シナリオ9: エッジケース・異常系 =====

describe('シナリオ9: エッジケース', () => {

    test('SQLインジェクション試行 - 事業者検索', () => {
        const sql = logic.buildSearchBusinessQuery("'; DROP TABLE 事業者; --");
        // シングルクォートが二重化されている（'→''）
        expect(sql).toContain("''; DROP TABLE");
        // LIKE句の構造が壊されていない（文字列リテラルが正しく閉じている）
        // escapeSqlにより ' が '' になるので、LIKE '%''...%' の形で安全
        const likePattern = "LIKE '%''; DROP TABLE";
        expect(sql).toContain(likePattern);
    });

    test('SQLインジェクション試行 - 許可検索', () => {
        const sql = logic.buildSearchPermitQuery({
            keyword: "' OR 1=1; --",
            asOfDateSql: '#2026/02/28 23:59:59#'
        });
        expect(sql).toContain("'' OR 1=1; --");
    });

    test('非常に長いキーワード', () => {
        const longKeyword = 'あ'.repeat(500);
        const sql = logic.buildSearchBusinessQuery(longKeyword);
        expect(sql).toContain(longKeyword);
        expect(sql).toContain('SELECT');
    });

    test('特殊文字を含む検索（%や_）', () => {
        // AccessのLIKE句では%と*が異なるが、ADODB経由では%がワイルドカード
        // ユーザーが%を入力した場合、ワイルドカードとして扱われる
        const sql = logic.buildSearchBusinessQuery('50%オフ');
        expect(sql).toContain("LIKE '%50%オフ%'");
    });

    test('カテゴリIDに不正な値が渡された場合', () => {
        // HTMLのselectで通常は数値のみだが、念のため
        const sql = logic.buildSearchPermitQuery({
            categoryId: '1 OR 1=1',
            asOfDateSql: '#2026/02/28 23:59:59#'
        });
        // categoryIdがそのまま埋め込まれる（数値チェックなし）
        expect(sql).toContain('許可区分ID = 1 OR 1=1');
    });
});

// ===== シナリオ10: 日付フォーマットのテスト =====

describe('シナリオ10: 日付処理', () => {
    test('1月1日のフォーマット（ゼロパディング必須）', () => {
        const d = new Date(2026, 0, 1);
        expect(logic.formatDate(d)).toBe('2026/01/01');
    });

    test('12月31日のフォーマット', () => {
        const d = new Date(2026, 11, 31);
        expect(logic.formatDate(d)).toBe('2026/12/31');
    });

    test('2月の日付', () => {
        const d = new Date(2026, 1, 3);
        expect(logic.formatDate(d)).toBe('2026/02/03');
    });

    test('年末年始の境界', () => {
        expect(logic.formatDate(new Date(2025, 11, 31))).toBe('2025/12/31');
        expect(logic.formatDate(new Date(2026, 0, 1))).toBe('2026/01/01');
    });

    test('null/undefinedは空文字', () => {
        expect(logic.formatDate(null)).toBe('');
        expect(logic.formatDate(undefined)).toBe('');
        expect(logic.formatDate('')).toBe('');
    });

    test('不正な日付文字列は空文字', () => {
        expect(logic.formatDate('abc')).toBe('');
        expect(logic.formatDate('9999/99/99')).toBe('');
    });
});

// ===== シナリオ11: マスター設定の網羅性 =====

describe('シナリオ11: マスター設定', () => {
    test('全マスターテーブルの設定が揃っている', () => {
        const types = [
            '許可区分', '施設種別', '品目', '処理方法', '廃棄物種類区分',
            '事業者区分', '取扱区分', '形式', '日処理能力単位', '時間処理能力単位',
            '管理区分', '設置形態区分', '許可対象区分', '許可番号形式', '認定区分'
        ];
        types.forEach(type => {
            const config = logic.getMasterConfig(type);
            expect(config).toBeDefined();
            expect(config.table).toBeTruthy();
            expect(config.idCol).toBeTruthy();
            expect(config.nameCol).toBeTruthy();
        });
    });

    test('品目マスターに表示順カラムがある', () => {
        const config = logic.getMasterConfig('品目');
        expect(config.extraCol).toBe('表示順');
    });

    test('許可番号形式マスターに説明カラムがある', () => {
        const config = logic.getMasterConfig('許可番号形式');
        expect(config.extraCol).toBe('説明');
    });
});

// ===== シナリオ12: 許可検索の有効開始日時条件 =====

describe('シナリオ12: 履歴管理の時点指定', () => {
    const baseDate = '#2026/02/28 23:59:59#';

    test('有効開始日時の条件が正しく設定される', () => {
        const sql = logic.buildSearchPermitQuery({ asOfDateSql: baseDate });
        expect(sql).toContain('許可.有効開始日時 <= ' + baseDate);
        expect(sql).toContain('許可.有効終了日時 IS NULL OR 許可.有効終了日時 > ' + baseDate);
    });

    test('過去時点での検索（2025年4月1日時点の許可状況）', () => {
        const pastDate = '#2025/04/01 23:59:59#';
        const sql = logic.buildSearchPermitQuery({ asOfDateSql: pastDate });
        expect(sql).toContain('有効開始日時 <= ' + pastDate);
        expect(sql).toContain('有効終了日時 > ' + pastDate);
    });
});

// ===== シナリオ13: escapeHtml の表示保護 =====

describe('シナリオ13: HTML表示保護', () => {
    test('事業者名にHTMLタグが含まれる場合', () => {
        const name = '<script>alert("xss")</script>株式会社';
        const safe = logic.escapeHtml(name);
        expect(safe).not.toContain('<script>');
        expect(safe).toContain('&lt;script&gt;');
        expect(safe).toContain('株式会社');
    });

    test('住所に&記号が含まれる場合', () => {
        const addr = 'A&B通り1丁目';
        expect(logic.escapeHtml(addr)).toBe('A&amp;B通り1丁目');
    });

    test('数値0はそのまま表示される', () => {
        // escapeHtml(0) が空文字にならないこと
        expect(logic.escapeHtml(0)).toBe('0');
    });
});

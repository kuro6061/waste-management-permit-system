/**
 * 検索フィルタ組み合わせ — 全検索関数のフィルタ組み合わせを体系的に検証
 */
const logic = require('../../app_logic.js');

const asOfDateSql = '#2026/03/01 23:59:59#';

// ===== buildSearchPermitQuery: 単一フィルタ =====

describe('buildSearchPermitQuery 単一フィルタ', () => {
    test('フィルタなし（デフォルト）', () => {
        const sql = logic.buildSearchPermitQuery({ asOfDateSql });
        expect(sql).toContain('SELECT DISTINCT');
        expect(sql).toContain('ORDER BY 許可.許可ID DESC');
        expect(sql).not.toContain('AND (許可.許可番号 LIKE');
        expect(sql).not.toContain('AND 許可.許可区分ID');
        expect(sql).not.toContain('AND 許可.許可有効年月日');
        expect(sql).not.toContain('AND (許可.廃止日');
        expect(sql).not.toContain('AND 許可.優良認定');
    });

    test('keyword のみ', () => {
        const sql = logic.buildSearchPermitQuery({ keyword: 'テスト', asOfDateSql });
        expect(sql).toContain("許可.許可番号 LIKE '%テスト%'");
        expect(sql).toContain("事業者.事業者名 LIKE '%テスト%'");
    });

    test('keyword にシングルクォート', () => {
        const sql = logic.buildSearchPermitQuery({ keyword: "O'Brien", asOfDateSql });
        expect(sql).toContain("O''Brien");
    });

    test('categoryId のみ', () => {
        const sql = logic.buildSearchPermitQuery({ categoryId: '1', asOfDateSql });
        expect(sql).toContain('AND 許可.許可区分ID = 1');
    });

    test('expiry=expired', () => {
        const sql = logic.buildSearchPermitQuery({ expiry: 'expired', asOfDateSql });
        expect(sql).toContain('許可.許可有効年月日 < ' + asOfDateSql);
    });

    test('expiry=30days', () => {
        const sql = logic.buildSearchPermitQuery({ expiry: '30days', asOfDateSql });
        expect(sql).toContain("許可.許可有効年月日 BETWEEN " + asOfDateSql + " AND DateAdd('d', 30, " + asOfDateSql + ")");
    });

    test('expiry=90days', () => {
        const sql = logic.buildSearchPermitQuery({ expiry: '90days', asOfDateSql });
        expect(sql).toContain("許可.許可有効年月日 BETWEEN " + asOfDateSql + " AND DateAdd('d', 90, " + asOfDateSql + ")");
    });

    test('expiry=1year', () => {
        const sql = logic.buildSearchPermitQuery({ expiry: '1year', asOfDateSql });
        expect(sql).toContain("許可.許可有効年月日 BETWEEN " + asOfDateSql + " AND DateAdd('yyyy', 1, " + asOfDateSql + ")");
    });

    test('expiry=valid', () => {
        const sql = logic.buildSearchPermitQuery({ expiry: 'valid', asOfDateSql });
        expect(sql).toContain('許可.許可有効年月日 >= ' + asOfDateSql);
    });

    test('status=active', () => {
        const sql = logic.buildSearchPermitQuery({ status: 'active', asOfDateSql });
        expect(sql).toContain('許可.廃止日 IS NULL AND 許可.取消日 IS NULL');
    });

    test('status=abolished', () => {
        const sql = logic.buildSearchPermitQuery({ status: 'abolished', asOfDateSql });
        expect(sql).toContain('許可.廃止日 IS NOT NULL');
    });

    test('status=cancelled', () => {
        const sql = logic.buildSearchPermitQuery({ status: 'cancelled', asOfDateSql });
        expect(sql).toContain('許可.取消日 IS NOT NULL');
    });

    test('excellentOnly=true', () => {
        const sql = logic.buildSearchPermitQuery({ excellentOnly: true, asOfDateSql });
        expect(sql).toContain('許可.優良認定 = True');
    });

    test('excellentOnly=false（フィルタ条件なし）', () => {
        const sql = logic.buildSearchPermitQuery({ excellentOnly: false, asOfDateSql });
        // SELECT句に許可.優良認定は含まれるが、WHERE句にフィルタ条件はない
        expect(sql).not.toContain('許可.優良認定 = True');
    });

    test('品目OR検索（1品目）', () => {
        const sql = logic.buildSearchPermitQuery({ selectedItemIds: ['3'], itemMode: 'OR', asOfDateSql });
        expect(sql).toContain('INNER JOIN 許可品目');
        expect(sql).toContain('許可品目.品目ID IN (3)');
        expect(sql).toContain('許可品目.取り扱いフラグ = True');
    });

    test('品目OR検索（複数品目）', () => {
        const sql = logic.buildSearchPermitQuery({ selectedItemIds: ['1', '3', '5'], itemMode: 'OR', asOfDateSql });
        expect(sql).toContain('許可品目.品目ID IN (1,3,5)');
    });
});

// ===== buildSearchPermitQuery: 品目AND検索 =====

describe('buildSearchPermitQuery 品目AND検索', () => {
    test('AND検索（1品目）', () => {
        const sql = logic.buildSearchPermitQuery({ selectedItemIds: ['3'], itemMode: 'AND', asOfDateSql });
        expect(sql).not.toContain('DISTINCT');
        expect(sql).toContain('EXISTS (SELECT 1 FROM 許可品目 WHERE 許可品目.許可ID = 許可.許可ID AND 許可品目.品目ID = 3 AND 許可品目.取り扱いフラグ = True)');
    });

    test('AND検索（複数品目: 全てにEXISTS）', () => {
        const sql = logic.buildSearchPermitQuery({ selectedItemIds: ['1', '3', '5'], itemMode: 'AND', asOfDateSql });
        expect(sql).toContain('許可品目.品目ID = 1');
        expect(sql).toContain('許可品目.品目ID = 3');
        expect(sql).toContain('許可品目.品目ID = 5');
        const existsCount = (sql.match(/EXISTS/g) || []).length;
        expect(existsCount).toBe(3);
    });

    test('AND検索ではINNER JOINは使わない', () => {
        const sql = logic.buildSearchPermitQuery({ selectedItemIds: ['1', '3'], itemMode: 'AND', asOfDateSql });
        expect(sql).not.toContain('INNER JOIN 許可品目');
    });
});

// ===== buildSearchPermitQuery: 2フィルタ組み合わせ =====

describe('buildSearchPermitQuery 2フィルタ組み合わせ', () => {
    test('keyword + categoryId', () => {
        const sql = logic.buildSearchPermitQuery({ keyword: 'テスト', categoryId: '1', asOfDateSql });
        expect(sql).toContain("許可.許可番号 LIKE '%テスト%'");
        expect(sql).toContain('AND 許可.許可区分ID = 1');
    });

    test('keyword + status=active', () => {
        const sql = logic.buildSearchPermitQuery({ keyword: 'テスト', status: 'active', asOfDateSql });
        expect(sql).toContain("LIKE '%テスト%'");
        expect(sql).toContain('許可.廃止日 IS NULL AND 許可.取消日 IS NULL');
    });

    test('keyword + expiry=expired', () => {
        const sql = logic.buildSearchPermitQuery({ keyword: 'テスト', expiry: 'expired', asOfDateSql });
        expect(sql).toContain("LIKE '%テスト%'");
        expect(sql).toContain('許可.許可有効年月日 <');
    });

    test('keyword + excellentOnly', () => {
        const sql = logic.buildSearchPermitQuery({ keyword: 'テスト', excellentOnly: true, asOfDateSql });
        expect(sql).toContain("LIKE '%テスト%'");
        expect(sql).toContain('許可.優良認定 = True');
    });

    test('categoryId + status=abolished', () => {
        const sql = logic.buildSearchPermitQuery({ categoryId: '2', status: 'abolished', asOfDateSql });
        expect(sql).toContain('AND 許可.許可区分ID = 2');
        expect(sql).toContain('許可.廃止日 IS NOT NULL');
    });

    test('categoryId + expiry=30days', () => {
        const sql = logic.buildSearchPermitQuery({ categoryId: '3', expiry: '30days', asOfDateSql });
        expect(sql).toContain('AND 許可.許可区分ID = 3');
        expect(sql).toContain("DateAdd('d', 30,");
    });

    test('categoryId + excellentOnly', () => {
        const sql = logic.buildSearchPermitQuery({ categoryId: '1', excellentOnly: true, asOfDateSql });
        expect(sql).toContain('AND 許可.許可区分ID = 1');
        expect(sql).toContain('許可.優良認定 = True');
    });

    test('status=active + expiry=valid', () => {
        const sql = logic.buildSearchPermitQuery({ status: 'active', expiry: 'valid', asOfDateSql });
        expect(sql).toContain('許可.廃止日 IS NULL AND 許可.取消日 IS NULL');
        expect(sql).toContain('許可.許可有効年月日 >=');
    });

    test('status=active + excellentOnly', () => {
        const sql = logic.buildSearchPermitQuery({ status: 'active', excellentOnly: true, asOfDateSql });
        expect(sql).toContain('許可.廃止日 IS NULL AND 許可.取消日 IS NULL');
        expect(sql).toContain('許可.優良認定 = True');
    });

    test('expiry=valid + excellentOnly', () => {
        const sql = logic.buildSearchPermitQuery({ expiry: 'valid', excellentOnly: true, asOfDateSql });
        expect(sql).toContain('許可.許可有効年月日 >=');
        expect(sql).toContain('許可.優良認定 = True');
    });

    test('keyword + 品目OR検索', () => {
        const sql = logic.buildSearchPermitQuery({ keyword: 'テスト', selectedItemIds: ['3'], itemMode: 'OR', asOfDateSql });
        expect(sql).toContain("LIKE '%テスト%'");
        expect(sql).toContain('INNER JOIN 許可品目');
        expect(sql).toContain('許可品目.品目ID IN (3)');
    });

    test('keyword + 品目AND検索', () => {
        const sql = logic.buildSearchPermitQuery({ keyword: 'テスト', selectedItemIds: ['1', '3'], itemMode: 'AND', asOfDateSql });
        expect(sql).toContain("LIKE '%テスト%'");
        expect(sql).toContain('EXISTS');
    });

    test('categoryId + 品目OR検索', () => {
        const sql = logic.buildSearchPermitQuery({ categoryId: '2', selectedItemIds: ['5'], itemMode: 'OR', asOfDateSql });
        expect(sql).toContain('AND 許可.許可区分ID = 2');
        expect(sql).toContain('許可品目.品目ID IN (5)');
    });

    test('status=active + 品目OR検索', () => {
        const sql = logic.buildSearchPermitQuery({ status: 'active', selectedItemIds: ['1', '2'], itemMode: 'OR', asOfDateSql });
        expect(sql).toContain('許可.廃止日 IS NULL AND 許可.取消日 IS NULL');
        expect(sql).toContain('許可品目.品目ID IN (1,2)');
    });

    test('excellentOnly + 品目OR検索', () => {
        const sql = logic.buildSearchPermitQuery({ excellentOnly: true, selectedItemIds: ['3'], itemMode: 'OR', asOfDateSql });
        expect(sql).toContain('許可.優良認定 = True');
        expect(sql).toContain('許可品目.品目ID IN (3)');
    });

    test('expiry + 品目AND検索', () => {
        const sql = logic.buildSearchPermitQuery({ expiry: 'valid', selectedItemIds: ['1', '2'], itemMode: 'AND', asOfDateSql });
        expect(sql).toContain('許可.許可有効年月日 >=');
        expect(sql).toContain('EXISTS');
    });

    test('status=abolished + 品目AND検索', () => {
        const sql = logic.buildSearchPermitQuery({ status: 'abolished', selectedItemIds: ['3'], itemMode: 'AND', asOfDateSql });
        expect(sql).toContain('許可.廃止日 IS NOT NULL');
        expect(sql).toContain('EXISTS');
    });
});

// ===== buildSearchPermitQuery: 3フィルタ以上 =====

describe('buildSearchPermitQuery 3フィルタ以上', () => {
    test('keyword + categoryId + status', () => {
        const sql = logic.buildSearchPermitQuery({
            keyword: 'テスト', categoryId: '1', status: 'active', asOfDateSql
        });
        expect(sql).toContain("LIKE '%テスト%'");
        expect(sql).toContain('AND 許可.許可区分ID = 1');
        expect(sql).toContain('許可.廃止日 IS NULL AND 許可.取消日 IS NULL');
    });

    test('keyword + categoryId + expiry + excellentOnly', () => {
        const sql = logic.buildSearchPermitQuery({
            keyword: 'テスト', categoryId: '2', expiry: 'valid', excellentOnly: true, asOfDateSql
        });
        expect(sql).toContain("LIKE '%テスト%'");
        expect(sql).toContain('AND 許可.許可区分ID = 2');
        expect(sql).toContain('許可.許可有効年月日 >=');
        expect(sql).toContain('許可.優良認定 = True');
    });

    test('全フィルタ指定', () => {
        const sql = logic.buildSearchPermitQuery({
            keyword: 'テスト', categoryId: '1', expiry: 'valid',
            status: 'active', excellentOnly: true,
            selectedItemIds: ['3', '5'], itemMode: 'AND', asOfDateSql
        });
        expect(sql).toContain("LIKE '%テスト%'");
        expect(sql).toContain('AND 許可.許可区分ID = 1');
        expect(sql).toContain('許可.許可有効年月日 >=');
        expect(sql).toContain('許可.廃止日 IS NULL AND 許可.取消日 IS NULL');
        expect(sql).toContain('許可.優良認定 = True');
        expect(sql).toContain('EXISTS');
    });

    test('categoryId + status + expiry + 品目OR', () => {
        const sql = logic.buildSearchPermitQuery({
            categoryId: '3', status: 'active', expiry: '1year',
            selectedItemIds: ['1'], itemMode: 'OR', asOfDateSql
        });
        expect(sql).toContain('AND 許可.許可区分ID = 3');
        expect(sql).toContain('許可.廃止日 IS NULL');
        expect(sql).toContain("DateAdd('yyyy', 1,");
        expect(sql).toContain('許可品目.品目ID IN (1)');
    });

    test('keyword + excellentOnly + 品目AND', () => {
        const sql = logic.buildSearchPermitQuery({
            keyword: 'テスト', excellentOnly: true,
            selectedItemIds: ['1', '2', '3'], itemMode: 'AND', asOfDateSql
        });
        expect(sql).toContain("LIKE '%テスト%'");
        expect(sql).toContain('許可.優良認定 = True');
        const existsCount = (sql.match(/EXISTS/g) || []).length;
        expect(existsCount).toBe(3);
    });
});

// ===== buildSearchPermitQuery: フィルタ間相互作用 =====

describe('buildSearchPermitQuery フィルタ間相互作用', () => {
    test('status=abolished の場合historyConditionが緩和される', () => {
        const sql = logic.buildSearchPermitQuery({ status: 'abolished', asOfDateSql });
        // 有効終了日時のIS NULLフィルタがない
        expect(sql).toContain('許可.有効開始日時 <= ' + asOfDateSql);
        expect(sql).not.toContain('有効終了日時 IS NULL OR 許可.有効終了日時 >');
    });

    test('status=cancelled の場合もhistoryConditionが緩和される', () => {
        const sql = logic.buildSearchPermitQuery({ status: 'cancelled', asOfDateSql });
        expect(sql).toContain('許可.有効開始日時 <= ' + asOfDateSql);
        expect(sql).not.toContain('有効終了日時 IS NULL OR 許可.有効終了日時 >');
    });

    test('status=active の場合historyConditionに有効終了日時がある', () => {
        const sql = logic.buildSearchPermitQuery({ status: 'active', asOfDateSql });
        expect(sql).toContain('許可.有効終了日時 IS NULL OR 許可.有効終了日時 > ' + asOfDateSql);
    });

    test('statusなしの場合もhistoryConditionに有効終了日時がある', () => {
        const sql = logic.buildSearchPermitQuery({ asOfDateSql });
        expect(sql).toContain('許可.有効終了日時 IS NULL OR 許可.有効終了日時 > ' + asOfDateSql);
    });

    test('品目OR検索ではDISTINCTが使われる', () => {
        const sql = logic.buildSearchPermitQuery({ selectedItemIds: ['1', '2'], itemMode: 'OR', asOfDateSql });
        expect(sql).toContain('SELECT DISTINCT');
    });

    test('品目AND検索ではDISTINCTが使われない', () => {
        const sql = logic.buildSearchPermitQuery({ selectedItemIds: ['1', '2'], itemMode: 'AND', asOfDateSql });
        expect(sql).not.toContain('DISTINCT');
    });

    test('品目指定なし+itemMode=AND: DISTINCTが使われる（ORパスに入る）', () => {
        const sql = logic.buildSearchPermitQuery({ itemMode: 'AND', asOfDateSql });
        expect(sql).toContain('SELECT DISTINCT');
        expect(sql).not.toContain('EXISTS');
    });
});

// ===== buildSearchPermitQuery: 空・無効フィルタ =====

describe('buildSearchPermitQuery 空・無効フィルタ', () => {
    test('keyword=""（フィルタなし扱い）', () => {
        const sql = logic.buildSearchPermitQuery({ keyword: '', asOfDateSql });
        expect(sql).not.toContain('LIKE');
    });

    test('categoryId=""（フィルタ条件なし）', () => {
        const sql = logic.buildSearchPermitQuery({ categoryId: '', asOfDateSql });
        // AND 許可.許可区分ID = のフィルタ条件がない（SELECT/JOIN句には出る）
        expect(sql).not.toContain('AND 許可.許可区分ID = ');
    });

    test('expiry=""（フィルタ条件なし）', () => {
        const sql = logic.buildSearchPermitQuery({ expiry: '', asOfDateSql });
        // 許可有効年月日のフィルタ条件がない（SELECT句には出る）
        expect(sql).not.toContain('AND 許可.許可有効年月日');
    });

    test('status=""（フィルタなし扱い）', () => {
        const sql = logic.buildSearchPermitQuery({ status: '', asOfDateSql });
        expect(sql).not.toContain('廃止日 IS NULL');
        expect(sql).not.toContain('廃止日 IS NOT NULL');
    });

    test('selectedItemIds=[]（品目フィルタなし）', () => {
        const sql = logic.buildSearchPermitQuery({ selectedItemIds: [], asOfDateSql });
        expect(sql).not.toContain('許可品目');
    });

    test('excellentOnly=false（フィルタ条件なし）', () => {
        const sql = logic.buildSearchPermitQuery({ excellentOnly: false, asOfDateSql });
        // WHERE句に優良認定のフィルタ条件がない
        expect(sql).not.toContain('許可.優良認定 = True');
    });

    test('不明なexpiry値はフィルタなし', () => {
        const sql = logic.buildSearchPermitQuery({ expiry: 'unknown', asOfDateSql });
        // WHERE句に許可有効年月日のフィルタ条件がない
        expect(sql).not.toContain('AND 許可.許可有効年月日');
    });
});

// ===== buildSearchFacilityQuery =====

describe('buildSearchFacilityQuery フィルタ組み合わせ', () => {
    test('keyword なし, typeId なし', () => {
        const sql = logic.buildSearchFacilityQuery('', '');
        expect(sql).toContain('施設.有効終了日時 IS NULL AND 施設.廃止年月日 IS NULL');
        // keyword='' は falsy なのでLIKE条件が追加されない
        expect(sql).not.toContain("LIKE '%");
        expect(sql).not.toContain('AND 施設.施設種別ID =');
    });

    test('keyword あり, typeId なし', () => {
        const sql = logic.buildSearchFacilityQuery('東京', '');
        expect(sql).toContain("施設.設置場所 LIKE '%東京%'");
        expect(sql).toContain("施設.許可番号 LIKE '%東京%'");
        expect(sql).toContain("事業者.事業者名 LIKE '%東京%'");
        expect(sql).not.toContain('AND 施設.施設種別ID =');
    });

    test('keyword なし, typeId あり', () => {
        const sql = logic.buildSearchFacilityQuery('', '3');
        expect(sql).not.toContain('LIKE');
        expect(sql).toContain('AND 施設.施設種別ID = 3');
    });

    test('keyword あり, typeId あり', () => {
        const sql = logic.buildSearchFacilityQuery('東京', '3');
        expect(sql).toContain("LIKE '%東京%'");
        expect(sql).toContain('AND 施設.施設種別ID = 3');
    });

    test('keyword にシングルクォート', () => {
        const sql = logic.buildSearchFacilityQuery("O'Brien", '');
        expect(sql).toContain("O''Brien");
    });

    test('常に有効終了日時IS NULLかつ廃止年月日IS NULL', () => {
        const sql1 = logic.buildSearchFacilityQuery('テスト', '1');
        const sql2 = logic.buildSearchFacilityQuery('', '');
        expect(sql1).toContain('施設.有効終了日時 IS NULL AND 施設.廃止年月日 IS NULL');
        expect(sql2).toContain('施設.有効終了日時 IS NULL AND 施設.廃止年月日 IS NULL');
    });

    test('ORDER BY 施設.施設ID DESC', () => {
        const sql = logic.buildSearchFacilityQuery('', '');
        expect(sql).toContain('ORDER BY 施設.施設ID DESC');
    });

    test('処理方法名がSELECTに含まれる', () => {
        const sql = logic.buildSearchFacilityQuery('', '');
        expect(sql).toContain('マスター_処理方法.処理方法名');
        expect(sql).toContain('LEFT JOIN マスター_処理方法');
    });

    test('options.processingMethodId で処理方法フィルタ', () => {
        const sql = logic.buildSearchFacilityQuery('', '', false, 'active', { processingMethodId: 3 });
        expect(sql).toContain('AND 施設.処理方法ID = 3');
    });

    test('options.permitTargetId で許可対象区分フィルタ', () => {
        const sql = logic.buildSearchFacilityQuery('', '', false, 'active', { permitTargetId: 1 });
        expect(sql).toContain('AND 施設.許可対象区分ID = 1');
    });

    test('options.excludeSelf で自己処理除外', () => {
        const sql = logic.buildSearchFacilityQuery('', '', false, 'active', { excludeSelf: true });
        expect(sql).toContain('施設.許可対象区分ID <> 2');
    });

    test('options.minDayCapacity で日処理能力フィルタ', () => {
        const sql = logic.buildSearchFacilityQuery('', '1', false, 'active', { minDayCapacity: 5 });
        expect(sql).toContain('INNER JOIN 処理能力 ON 施設.施設ID = 処理能力.施設ID');
        expect(sql).toContain('処理能力.日処理能力 >= 5');
    });

    test('options なしで後方互換', () => {
        const sql = logic.buildSearchFacilityQuery('テスト', '1');
        expect(sql).toContain("LIKE '%テスト%'");
        expect(sql).toContain('施設.施設種別ID = 1');
        expect(sql).not.toContain('INNER JOIN 処理能力');
        expect(sql).not.toContain('AND 施設.処理方法ID =');
    });

    test('複合フィルタ: 処理方法 + 日処理能力 + 自己処理除外', () => {
        const sql = logic.buildSearchFacilityQuery('', '1', false, 'active', {
            processingMethodId: 2, minDayCapacity: 100, excludeSelf: true
        });
        expect(sql).toContain('施設.処理方法ID = 2');
        expect(sql).toContain('処理能力.日処理能力 >= 100');
        expect(sql).toContain('施設.許可対象区分ID <> 2');
    });
});

// ===== buildSearchVehicleQuery =====

describe('buildSearchVehicleQuery フィルタ組み合わせ', () => {
    test('keyword あり, includeScrapped=false', () => {
        const sql = logic.buildSearchVehicleQuery('品川', false);
        expect(sql).toContain("登録番号1 LIKE '%品川%'");
        expect(sql).toContain('車両.廃車フラグ = False OR 車両.廃車フラグ IS NULL');
    });

    test('keyword あり, includeScrapped=true', () => {
        const sql = logic.buildSearchVehicleQuery('品川', true);
        expect(sql).toContain("登録番号1 LIKE '%品川%'");
        expect(sql).not.toContain('廃車フラグ = False');
    });

    test('keyword 空, includeScrapped=false', () => {
        const sql = logic.buildSearchVehicleQuery('', false);
        expect(sql).toContain("登録番号1 LIKE '%%'");
        expect(sql).toContain('車両.廃車フラグ = False OR 車両.廃車フラグ IS NULL');
    });

    test('keyword 空, includeScrapped=true', () => {
        const sql = logic.buildSearchVehicleQuery('', true);
        expect(sql).toContain("登録番号1 LIKE '%%'");
        expect(sql).not.toContain('廃車フラグ = False');
    });

    test('キーワードは全4フィールド+事業者名を検索', () => {
        const sql = logic.buildSearchVehicleQuery('テスト', false);
        expect(sql).toContain('車両.登録番号1 LIKE');
        expect(sql).toContain('車両.登録番号2 LIKE');
        expect(sql).toContain('車両.登録番号3 LIKE');
        expect(sql).toContain('車両.登録番号4 LIKE');
        expect(sql).toContain('事業者.事業者名 LIKE');
    });

    test('ORDER BY 車両.車両ID DESC', () => {
        const sql = logic.buildSearchVehicleQuery('', false);
        expect(sql).toContain('ORDER BY 車両.車両ID DESC');
    });
});

// ===== buildSearchOfficerQuery =====

describe('buildSearchOfficerQuery フィルタ組み合わせ', () => {
    test('keyword あり, includeRetired=false', () => {
        const sql = logic.buildSearchOfficerQuery('田中', false);
        expect(sql).toContain("役員.姓 LIKE '%田中%'");
        expect(sql).toContain('役員.退任フラグ = False OR 役員.退任フラグ IS NULL');
    });

    test('keyword あり, includeRetired=true', () => {
        const sql = logic.buildSearchOfficerQuery('田中', true);
        expect(sql).toContain("役員.姓 LIKE '%田中%'");
        expect(sql).not.toContain('退任フラグ = False');
    });

    test('keyword 空, includeRetired=false', () => {
        const sql = logic.buildSearchOfficerQuery('', false);
        expect(sql).toContain("役員.姓 LIKE '%%'");
        expect(sql).toContain('役員.退任フラグ = False OR 役員.退任フラグ IS NULL');
    });

    test('keyword 空, includeRetired=true', () => {
        const sql = logic.buildSearchOfficerQuery('', true);
        expect(sql).toContain("役員.姓 LIKE '%%'");
        expect(sql).not.toContain('退任フラグ = False');
    });

    test('キーワードは姓・名・役職名・事業者名を検索', () => {
        const sql = logic.buildSearchOfficerQuery('テスト', false);
        expect(sql).toContain('役員.姓 LIKE');
        expect(sql).toContain('役員.名 LIKE');
        expect(sql).toContain('役員.役職名 LIKE');
        expect(sql).toContain('事業者.事業者名 LIKE');
    });

    test('ORDER BY 役員.役員ID DESC', () => {
        const sql = logic.buildSearchOfficerQuery('', false);
        expect(sql).toContain('ORDER BY 役員.役員ID DESC');
    });
});

// ===== buildSearchBusinessQuery =====

describe('buildSearchBusinessQuery フィルタ', () => {
    test('キーワードで事業者名・電話番号・住所を検索', () => {
        const sql = logic.buildSearchBusinessQuery('テスト');
        expect(sql).toContain("事業者名 LIKE '%テスト%'");
        expect(sql).toContain("電話番号 LIKE '%テスト%'");
        expect(sql).toContain("市区町村町名番地 LIKE '%テスト%'");
    });

    test('空キーワード', () => {
        const sql = logic.buildSearchBusinessQuery('');
        expect(sql).toContain("事業者名 LIKE '%%'");
    });

    test('シングルクォートエスケープ', () => {
        const sql = logic.buildSearchBusinessQuery("O'Brien");
        expect(sql).toContain("O''Brien");
    });

    test('ORDER BY 事業者ID', () => {
        const sql = logic.buildSearchBusinessQuery('テスト');
        expect(sql).toContain('ORDER BY 事業者ID');
    });
});

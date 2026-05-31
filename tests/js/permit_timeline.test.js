/**
 * 許可タイムラインテスト
 *
 * 許可を追加・更新・変更していったとき、過去の任意の時点を検索して
 * 正しいバージョンが抽出されるかを徹底的に検証する。
 * 職員の誤操作があっても大丈夫なように、復旧シナリオも含む。
 *
 * テストカテゴリ:
 *   S1〜S5: 時点検索（as-of）の基本〜複雑パターン
 *   S6〜S10: 変更許可のタイムライン
 *   S11〜S20: 誤操作と復旧のシナリオ
 */
const logic = require('../../app_logic.js');

// ===== ヘルパー関数 =====
function asOf(dateStr) {
    return '#' + dateStr + ' 23:59:59#';
}

// 許可検索SQLを生成し、historyCondition（時点フィルタ）の正しさを検証するためのヘルパー
function searchAt(dateStr, extraParams) {
    return logic.buildSearchPermitQuery(Object.assign({
        asOfDateSql: asOf(dateStr)
    }, extraParams || {}));
}

// ========================================================================
// S1: 単一許可の時点検索 - 最も基本的なケース
// ========================================================================
describe('S1: 単一許可の時点検索（新規登録のみ）', () => {
    // 業者A: 2021/04/01に産廃収集運搬業の許可取得
    // 許可ID=1, 論理ID=100
    // 許可年月日=2021/04/01, 許可有効年月日=2026/03/31
    // 有効開始日時=2021/04/01, 有効終了日時=NULL
    var logicalId = 100;
    var businessId = 10;

    test('許可登録のINSERTが正しい有効開始日時を持つ', () => {
        var sql = logic.buildSavePermitQuery({
            logicalId: logicalId, businessId: businessId, categoryId: 1,
            number: '01100010001',
            permitDate: '2021/04/01', validDate: '2026/03/31',
            excellent: false, todayStr: '2021/04/01'
        });
        expect(sql).toContain('有効開始日時');
        expect(sql).toContain('#2021/04/01#');
    });

    test('登録前日（2021/03/31）に検索 → ヒットしない条件', () => {
        var sql = searchAt('2021/03/31');
        // 条件: 有効開始日時 <= 2021/03/31 → 2021/04/01 <= 2021/03/31 は false
        expect(sql).toContain('許可.有効開始日時 <= #2021/03/31 23:59:59#');
    });

    test('登録日（2021/04/01）に検索 → ヒットする条件', () => {
        var sql = searchAt('2021/04/01');
        // 条件: 有効開始日時 <= 2021/04/01 → true
        // AND (有効終了日時 IS NULL OR 有効終了日時 > ...) → NULL → true
        expect(sql).toContain('許可.有効開始日時 <= #2021/04/01 23:59:59#');
        expect(sql).toContain('許可.有効終了日時 IS NULL OR 許可.有効終了日時 > #2021/04/01 23:59:59#');
    });

    test('許可有効期限当日（2026/03/31）に検索 → ヒットする条件', () => {
        // 許可有効年月日が過ぎていても、有効終了日時がNULLなら最新版として表示
        var sql = searchAt('2026/03/31');
        expect(sql).toContain('許可.有効終了日時 IS NULL OR 許可.有効終了日時 > #2026/03/31 23:59:59#');
    });

    test('許可有効期限翌日（2026/04/01）に検索 → まだヒットする（みなし有効、未更新）', () => {
        // 有効終了日時がNULLのままなので、システム上はまだ最新版
        // 14条3項: 更新申請中は従前の許可がなお効力を有する
        var sql = searchAt('2026/04/01');
        expect(sql).toContain('許可.有効終了日時 IS NULL');
    });

    test('5年後（2031/04/01）に検索 → まだヒットする（有効終了日時がNULLなら永続）', () => {
        var sql = searchAt('2031/04/01');
        expect(sql).toContain('許可.有効開始日時 <= #2031/04/01 23:59:59#');
        expect(sql).toContain('許可.有効終了日時 IS NULL');
    });
});

// ========================================================================
// S2: 許可更新（1回）の時点検索
// ========================================================================
describe('S2: 許可更新（1回）の時点検索', () => {
    // 旧許可: 許可ID=1, 論理ID=100
    //   許可年月日=2021/04/01, 許可有効年月日=2026/03/31
    //   有効開始日時=2021/04/01, 有効終了日時=2026/05/14（新許可発行前日）
    // 新許可: 許可ID=2, 論理ID=100
    //   許可年月日=2026/05/15, 許可有効年月日=2031/03/31
    //   有効開始日時=2026/05/15, 有効終了日時=NULL
    var logicalId = 100;
    var oldPermitId = 1;

    test('Step1: 旧許可の有効終了日時を設定（新許可の前日）', () => {
        var sql = logic.buildUpdatePermitHistoryQuery({
            permitId: oldPermitId,
            permitNumber: '01100010001', categoryId: 1,
            permitDate: '2021/04/01', validDate: '2026/03/31',
            startDate: '2021/04/01', endDate: '2026/05/14',
            excellent: false,
            cancelDate: '', cancelReason: '', abolishDate: '', abolishReason: ''
        });
        expect(sql).toContain('有効終了日時 = #2026/05/14#');
    });

    test('Step2: 新許可を同じ論理IDで登録', () => {
        var sql = logic.buildSavePermitQuery({
            logicalId: logicalId, businessId: 10, categoryId: 1,
            number: '01100010001',
            permitDate: '2026/05/15', validDate: '2031/03/31',
            excellent: false, todayStr: '2026/05/15'
        });
        expect(sql).toContain('#2026/05/15#');
        expect(sql).toContain('#2031/03/31#');
    });

    test('旧許可期間中（2023/06/01）の検索 → 旧許可がヒット', () => {
        // 旧許可: 有効開始=2021/04/01 <= 2023/06/01 ✓
        //         有効終了=2026/05/14 > 2023/06/01 ✓ → ヒット
        // 新許可: 有効開始=2026/05/15 <= 2023/06/01 ✗ → ヒットしない
        var sql = searchAt('2023/06/01');
        expect(sql).toContain('許可.有効開始日時 <= #2023/06/01 23:59:59#');
        expect(sql).toContain('許可.有効終了日時 > #2023/06/01 23:59:59#');
    });

    test('みなし有効期間中（2026/04/15）の検索 → 旧許可がヒット', () => {
        // 旧許可: 有効終了=2026/05/14 > 2026/04/15 ✓ → ヒット
        // 新許可: 有効開始=2026/05/15 <= 2026/04/15 ✗ → ヒットしない
        var sql = searchAt('2026/04/15');
        expect(sql).toContain('許可.有効開始日時 <= #2026/04/15 23:59:59#');
    });

    test('旧許可の有効終了日当日（2026/05/14）の検索 → 旧許可がヒット', () => {
        // 旧許可: 有効終了=2026/05/14, 条件: 有効終了 > 2026/05/14
        // 23:59:59 と日付の比較: #2026/05/14# > #2026/05/14 23:59:59# → false
        // ただし、Accessでの実際の比較はDate型同士。ここではSQL文字列の構造のみ検証
        var sql = searchAt('2026/05/14');
        expect(sql).toContain('有効終了日時 > #2026/05/14 23:59:59#');
    });

    test('新許可の有効開始日（2026/05/15）の検索 → 新許可がヒット', () => {
        // 旧許可: 有効終了=2026/05/14, 条件: > 2026/05/15 → false
        // 新許可: 有効開始=2026/05/15 <= 2026/05/15 ✓, 有効終了=NULL ✓ → ヒット
        var sql = searchAt('2026/05/15');
        expect(sql).toContain('許可.有効開始日時 <= #2026/05/15 23:59:59#');
    });

    test('新許可期間中（2028/01/01）の検索 → 新許可のみヒット', () => {
        var sql = searchAt('2028/01/01');
        expect(sql).toContain('許可.有効開始日時 <= #2028/01/01 23:59:59#');
        expect(sql).toContain('許可.有効終了日時 IS NULL OR 許可.有効終了日時 > #2028/01/01 23:59:59#');
    });

    test('許可履歴で新旧両方のレコードが見える（有効終了日時フィルタなし）', () => {
        var sql = logic.buildLoadPermitHistoryQuery(logicalId);
        expect(sql).toContain('許可論理ID = 100');
        expect(sql).not.toContain('有効終了日時 IS NULL');
        expect(sql).toContain('ORDER BY 許可.有効開始日時 ASC');
    });
});

// ========================================================================
// S3: 許可の複数回更新（3バージョン）
// ========================================================================
describe('S3: 許可の複数回更新（3バージョン）', () => {
    // v1: 許可ID=1, 有効開始=2016/04/01, 有効終了=2021/05/14
    // v2: 許可ID=2, 有効開始=2021/05/15, 有効終了=2026/04/14
    // v3: 許可ID=3, 有効開始=2026/04/15, 有効終了=NULL
    var logicalId = 200;

    test('v1登録', () => {
        var sql = logic.buildSavePermitQuery({
            logicalId: logicalId, businessId: 20, categoryId: 1,
            number: '01100020001',
            permitDate: '2016/04/01', validDate: '2021/03/31',
            excellent: false, todayStr: '2016/04/01'
        });
        expect(sql).toContain('#2016/04/01#');
    });

    test('v1をクローズしv2を登録', () => {
        // v1の有効終了日時 = 2021/05/14
        var closeV1 = logic.buildUpdatePermitHistoryQuery({
            permitId: 1, permitNumber: '01100020001', categoryId: 1,
            endDate: '2021/05/14'
        });
        expect(closeV1).toContain('有効終了日時 = #2021/05/14#');

        var v2 = logic.buildSavePermitQuery({
            logicalId: logicalId, businessId: 20, categoryId: 1,
            number: '01100020001',
            permitDate: '2021/05/15', validDate: '2026/03/31',
            excellent: false, todayStr: '2021/05/15'
        });
        expect(v2).toContain('#2021/05/15#');
    });

    test('v2をクローズしv3を登録', () => {
        var closeV2 = logic.buildUpdatePermitHistoryQuery({
            permitId: 2, permitNumber: '01100020001', categoryId: 1,
            endDate: '2026/04/14'
        });
        expect(closeV2).toContain('有効終了日時 = #2026/04/14#');

        var v3 = logic.buildSavePermitQuery({
            logicalId: logicalId, businessId: 20, categoryId: 1,
            number: '01100020001',
            permitDate: '2026/04/15', validDate: '2031/03/31',
            excellent: true, todayStr: '2026/04/15'
        });
        expect(v3).toContain('True'); // 優良認定
    });

    test('v1期間中（2018/01/01）の検索条件', () => {
        var sql = searchAt('2018/01/01');
        expect(sql).toContain('許可.有効開始日時 <= #2018/01/01 23:59:59#');
        expect(sql).toContain('許可.有効終了日時 > #2018/01/01 23:59:59#');
    });

    test('v1→v2境界（2021/05/14）の検索条件', () => {
        // v1: 有効終了=2021/05/14, 条件: > 2021/05/14 → DB上でAccessの日付比較に依存
        var sql = searchAt('2021/05/14');
        expect(sql).toContain('有効終了日時 > #2021/05/14 23:59:59#');
    });

    test('v2期間中（2023/07/01）の検索条件', () => {
        var sql = searchAt('2023/07/01');
        expect(sql).toContain('許可.有効開始日時 <= #2023/07/01 23:59:59#');
    });

    test('v2→v3境界（2026/04/14）の検索条件', () => {
        var sql = searchAt('2026/04/14');
        expect(sql).toContain('有効終了日時 > #2026/04/14 23:59:59#');
    });

    test('v3期間中（2028/10/01）の検索条件', () => {
        var sql = searchAt('2028/10/01');
        expect(sql).toContain('許可.有効開始日時 <= #2028/10/01 23:59:59#');
        expect(sql).toContain('有効終了日時 IS NULL');
    });

    test('全バージョンより前（2010/01/01）の検索条件', () => {
        // v1の有効開始=2016/04/01 > 2010/01/01 → どのバージョンもヒットしない
        var sql = searchAt('2010/01/01');
        expect(sql).toContain('許可.有効開始日時 <= #2010/01/01 23:59:59#');
    });
});

// ========================================================================
// S4: 同一事業者が複数の許可区分を持つ場合
// ========================================================================
describe('S4: 同一事業者の複数許可区分の時点検索', () => {
    // 業者B: 事業者ID=30
    // 許可A（収集運搬）: 論理ID=300, 有効開始=2020/04/01, 有効終了=NULL
    // 許可B（処分業）:   論理ID=301, 有効開始=2022/10/01, 有効終了=NULL
    var businessId = 30;

    test('両方の許可をINSERT', () => {
        var sqlA = logic.buildSavePermitQuery({
            logicalId: 300, businessId: businessId, categoryId: 1,
            number: '01100030001', permitDate: '2020/04/01', validDate: '2025/03/31',
            excellent: false, todayStr: '2020/04/01'
        });
        var sqlB = logic.buildSavePermitQuery({
            logicalId: 301, businessId: businessId, categoryId: 3,
            number: '01200030001', permitDate: '2022/10/01', validDate: '2027/09/30',
            excellent: false, todayStr: '2022/10/01'
        });
        expect(sqlA).toContain('許可区分ID');
        expect(sqlB).toContain('許可区分ID');
    });

    test('許可A取得後・許可B取得前（2021/06/01）: 許可Aのみヒット条件', () => {
        // 許可A: 有効開始=2020/04/01 <= 2021/06/01 ✓
        // 許可B: 有効開始=2022/10/01 <= 2021/06/01 ✗
        var sql = searchAt('2021/06/01');
        expect(sql).toContain('許可.有効開始日時 <= #2021/06/01 23:59:59#');
    });

    test('両方取得後（2023/01/01）: 両方ヒット条件', () => {
        var sql = searchAt('2023/01/01');
        expect(sql).toContain('許可.有効開始日時 <= #2023/01/01 23:59:59#');
    });

    test('許可区分で絞り込み + 時点指定の複合条件', () => {
        var sql = searchAt('2023/01/01', { categoryId: '1' });
        expect(sql).toContain('許可.有効開始日時 <= #2023/01/01 23:59:59#');
        expect(sql).toContain('許可区分ID = 1');
    });

    test('キーワード + 時点指定の複合条件', () => {
        var sql = searchAt('2023/01/01', { keyword: '01100030001' });
        expect(sql).toContain("LIKE '%01100030001%'");
        expect(sql).toContain('許可.有効開始日時 <= #2023/01/01 23:59:59#');
    });
});

// ========================================================================
// S5: 期限フィルタ + 時点検索の組み合わせ
// ========================================================================
describe('S5: 期限フィルタ + 時点検索の組み合わせ', () => {
    test('30日以内期限切れ + 時点=2026/03/01: 正しいBETWEEN条件', () => {
        var sql = searchAt('2026/03/01', { expiry: '30days', status: 'active' });
        expect(sql).toContain("DateAdd('d', 30, #2026/03/01 23:59:59#)");
        expect(sql).toContain('廃止日 IS NULL AND 許可.取消日 IS NULL');
    });

    test('90日以内期限切れ + 時点=2025/12/01', () => {
        var sql = searchAt('2025/12/01', { expiry: '90days', status: 'active' });
        expect(sql).toContain("DateAdd('d', 90, #2025/12/01 23:59:59#)");
    });

    test('1年以内期限切れ + 時点=2025/04/01', () => {
        var sql = searchAt('2025/04/01', { expiry: '1year' });
        expect(sql).toContain("DateAdd('yyyy', 1, #2025/04/01 23:59:59#)");
    });

    test('期限切れ + 時点=2026/04/01: 許可有効年月日 < 基準日', () => {
        var sql = searchAt('2026/04/01', { expiry: 'expired' });
        expect(sql).toContain('許可有効年月日 < #2026/04/01 23:59:59#');
    });

    test('有効のみ + 時点=2025/01/01', () => {
        var sql = searchAt('2025/01/01', { expiry: 'valid' });
        expect(sql).toContain('許可有効年月日 >= #2025/01/01 23:59:59#');
    });

    test('優良認定 + 期限 + 有効 + 時点 の4重条件', () => {
        var sql = searchAt('2026/02/01', {
            excellentOnly: true, expiry: '1year', status: 'active'
        });
        expect(sql).toContain('優良認定 = True');
        expect(sql).toContain("DateAdd('yyyy', 1,");
        expect(sql).toContain('廃止日 IS NULL AND 許可.取消日 IS NULL');
        expect(sql).toContain('許可.有効開始日時 <=');
    });
});

// ========================================================================
// S6: 変更許可の基本パターン
// ========================================================================
describe('S6: 変更許可 — 品目変更で新バージョン作成', () => {
    // 変更許可: 許可年月日が変わるが、許可有効年月日（有効期限）は旧許可を引き継ぐ
    // 原許可: 許可ID=10, 論理ID=400
    //   許可年月日=2023/04/01, 許可有効年月日=2028/03/31
    //   有効開始=2023/04/01, 有効終了=2025/07/14
    // 変更許可: 許可ID=11, 論理ID=400
    //   許可年月日=2025/07/15, 許可有効年月日=2028/03/31（同じ！）
    //   有効開始=2025/07/15, 有効終了=NULL
    var logicalId = 400;
    var originalPermitId = 10;

    test('原許可の登録', () => {
        var sql = logic.buildSavePermitQuery({
            logicalId: logicalId, businessId: 40, categoryId: 1,
            number: '01100040001',
            permitDate: '2023/04/01', validDate: '2028/03/31',
            excellent: false, todayStr: '2023/04/01'
        });
        expect(sql).toContain('#2023/04/01#');
        expect(sql).toContain('#2028/03/31#');
    });

    test('原許可の有効終了日時を設定（変更許可の前日）', () => {
        var sql = logic.buildUpdatePermitHistoryQuery({
            permitId: originalPermitId,
            permitNumber: '01100040001', categoryId: 1,
            endDate: '2025/07/14'
        });
        expect(sql).toContain('有効終了日時 = #2025/07/14#');
        expect(sql).toContain('WHERE 許可ID = 10');
    });

    test('変更許可の登録（有効期限は原許可と同じ）', () => {
        var sql = logic.buildSavePermitQuery({
            logicalId: logicalId, businessId: 40, categoryId: 1,
            number: '01100040001',
            permitDate: '2025/07/15', validDate: '2028/03/31', // 同じ有効期限
            excellent: false, todayStr: '2025/07/15'
        });
        expect(sql).toContain('#2025/07/15#');
        expect(sql).toContain('#2028/03/31#'); // 有効期限は同じ
    });

    test('品目コピー（原許可→変更許可）', () => {
        var sql = logic.buildCopyPermitItemsQuery(10, 11);
        expect(sql).toContain('SELECT 11, 品目ID, 取り扱いフラグ, 積替保管フラグ');
        expect(sql).toContain('FROM 許可品目 WHERE 許可ID = 10');
    });

    test('原許可期間中（2024/01/01）の検索 → 原許可がヒット', () => {
        // 原許可: 有効開始=2023/04/01 <= 2024/01/01 ✓, 有効終了=2025/07/14 > 2024/01/01 ✓
        var sql = searchAt('2024/01/01');
        expect(sql).toContain('許可.有効開始日時 <= #2024/01/01 23:59:59#');
    });

    test('変更許可前日（2025/07/14）の検索 → 原許可がヒット', () => {
        var sql = searchAt('2025/07/14');
        expect(sql).toContain('有効終了日時 > #2025/07/14 23:59:59#');
    });

    test('変更許可日（2025/07/15）の検索 → 変更許可がヒット', () => {
        var sql = searchAt('2025/07/15');
        expect(sql).toContain('許可.有効開始日時 <= #2025/07/15 23:59:59#');
    });

    test('有効期限直前（2028/03/30）の検索 → 変更許可がヒット', () => {
        var sql = searchAt('2028/03/30');
        expect(sql).toContain('許可.有効開始日時 <= #2028/03/30 23:59:59#');
        expect(sql).toContain('有効終了日時 IS NULL');
    });
});

// ========================================================================
// S7: 変更許可の連続（原許可→変更1→変更2）
// ========================================================================
describe('S7: 変更許可の連続（原許可→変更1→変更2）', () => {
    // 原許可: 許可ID=20, 論理ID=500
    //   許可年月日=2022/04/01, 許可有効年月日=2027/03/31
    //   有効開始=2022/04/01, 有効終了=2023/09/30
    // 変更1: 許可ID=21, 論理ID=500
    //   許可年月日=2023/10/01, 許可有効年月日=2027/03/31（同じ）
    //   有効開始=2023/10/01, 有効終了=2025/02/28
    // 変更2: 許可ID=22, 論理ID=500
    //   許可年月日=2025/03/01, 許可有効年月日=2027/03/31（同じ）
    //   有効開始=2025/03/01, 有効終了=NULL

    test('3バージョンの登録とクローズの一連のSQL生成', () => {
        // 原許可登録
        var v1 = logic.buildSavePermitQuery({
            logicalId: 500, businessId: 50, categoryId: 2,
            number: '01200050001',
            permitDate: '2022/04/01', validDate: '2027/03/31',
            excellent: false, todayStr: '2022/04/01'
        });
        expect(v1).toContain('INSERT INTO 許可');

        // 原許可クローズ + 変更1登録
        var closeV1 = logic.buildUpdatePermitHistoryQuery({
            permitId: 20, permitNumber: '01200050001', categoryId: 2,
            endDate: '2023/09/30'
        });
        expect(closeV1).toContain('有効終了日時 = #2023/09/30#');

        var v2 = logic.buildSavePermitQuery({
            logicalId: 500, businessId: 50, categoryId: 2,
            number: '01200050001',
            permitDate: '2023/10/01', validDate: '2027/03/31',
            excellent: false, todayStr: '2023/10/01'
        });
        expect(v2).toContain('#2023/10/01#');

        // 変更1クローズ + 変更2登録
        var closeV2 = logic.buildUpdatePermitHistoryQuery({
            permitId: 21, permitNumber: '01200050001', categoryId: 2,
            endDate: '2025/02/28'
        });
        expect(closeV2).toContain('有効終了日時 = #2025/02/28#');

        var v3 = logic.buildSavePermitQuery({
            logicalId: 500, businessId: 50, categoryId: 2,
            number: '01200050001',
            permitDate: '2025/03/01', validDate: '2027/03/31',
            excellent: true, todayStr: '2025/03/01'
        });
        expect(v3).toContain('True'); // 変更2で優良認定取得
    });

    test('品目コピーのチェーン: 原許可→変更1, 変更1→変更2', () => {
        var copy1 = logic.buildCopyPermitItemsQuery(20, 21);
        expect(copy1).toContain('SELECT 21');
        expect(copy1).toContain('WHERE 許可ID = 20');

        var copy2 = logic.buildCopyPermitItemsQuery(21, 22);
        expect(copy2).toContain('SELECT 22');
        expect(copy2).toContain('WHERE 許可ID = 21');
    });

    test.each([
        ['2022/06/01', '原許可期間中'],
        ['2023/09/30', '原許可→変更1境界（原許可側）'],
        ['2023/10/01', '変更1開始日'],
        ['2024/06/01', '変更1期間中'],
        ['2025/02/28', '変更1→変更2境界（変更1側）'],
        ['2025/03/01', '変更2開始日'],
        ['2026/12/01', '変更2期間中'],
    ])('%s: 検索条件が正しく生成される（%s）', (date) => {
        var sql = searchAt(date);
        expect(sql).toContain('許可.有効開始日時 <= #' + date + ' 23:59:59#');
        expect(sql).toContain('有効終了日時');
    });
});

// ========================================================================
// S8: 変更許可の後に更新許可
// ========================================================================
describe('S8: 変更許可→更新許可の時系列', () => {
    // 原許可(v1): 論理ID=600, 有効開始=2020/04/01, 有効終了=2022/11/30
    // 変更(v2): 論理ID=600, 有効開始=2022/12/01, 有効終了=2025/04/14
    //   許可有効年月日=2025/03/31（原許可と同じ有効期限）
    // 更新(v3): 論理ID=600, 有効開始=2025/04/15, 有効終了=NULL
    //   許可有効年月日=2030/03/31（新しい有効期限）

    test('変更→更新の流れで、有効期限が変わることを確認', () => {
        // 変更許可: 有効期限は原許可と同じ
        var change = logic.buildSavePermitQuery({
            logicalId: 600, businessId: 60, categoryId: 1,
            number: '01100060001',
            permitDate: '2022/12/01', validDate: '2025/03/31', // 同じ有効期限
            excellent: false, todayStr: '2022/12/01'
        });
        expect(change).toContain('#2025/03/31#');

        // 更新許可: 新しい有効期限
        var renewal = logic.buildSavePermitQuery({
            logicalId: 600, businessId: 60, categoryId: 1,
            number: '01100060001',
            permitDate: '2025/04/15', validDate: '2030/03/31', // 新しい有効期限
            excellent: true, todayStr: '2025/04/15'
        });
        expect(renewal).toContain('#2030/03/31#');
    });

    test('変更許可期間中に期限フィルタ: 2024年の検索で有効期限2025/03/31が対象', () => {
        var sql = searchAt('2024/01/01', { expiry: '1year' });
        // 許可有効年月日 BETWEEN 基準日 AND 基準日+1年
        expect(sql).toContain("DateAdd('yyyy', 1, #2024/01/01 23:59:59#)");
    });

    test('更新許可後に期限フィルタ: 2026年の検索で有効期限2030/03/31が対象', () => {
        var sql = searchAt('2026/01/01', { expiry: '1year' });
        expect(sql).toContain("DateAdd('yyyy', 1, #2026/01/01 23:59:59#)");
    });
});

// ========================================================================
// S9: buildCloseOldPermitVersionsQueryによる一括クローズ
// ========================================================================
describe('S9: buildCloseOldPermitVersionsQuery（旧バージョン一括クローズ）', () => {
    test('論理IDで有効な旧バージョンをすべてクローズ', () => {
        var sql = logic.buildCloseOldPermitVersionsQuery(700, '2026/04/01');
        expect(sql).toContain("UPDATE 許可 SET 有効終了日時 = DateAdd('d', -1, #2026/04/01#)");
        expect(sql).toContain('WHERE 許可論理ID = 700');
        expect(sql).toContain('AND 有効終了日時 IS NULL');
    });

    test('新許可日がクエリに含まれる', () => {
        var sql = logic.buildCloseOldPermitVersionsQuery(700, '2025/12/31');
        expect(sql).toContain('#2025/12/31#');
        expect(sql).toContain("DateAdd('d', -1,");
    });

    test('既にクローズ済みのバージョンは影響しない（有効終了日時 IS NULL条件）', () => {
        var sql = logic.buildCloseOldPermitVersionsQuery(700, '2026/04/01');
        expect(sql).toContain('AND 有効終了日時 IS NULL');
    });
});

// ========================================================================
// S10: 変更許可と品目の整合性
// ========================================================================
describe('S10: 変更許可と品目の整合性', () => {
    test('品目コピーのSQLが正しいINSERT-SELECT構造', () => {
        var sql = logic.buildCopyPermitItemsQuery(100, 200);
        expect(sql).toBe(
            'INSERT INTO 許可品目 (許可ID, 品目ID, 取り扱いフラグ, 積替保管フラグ) ' +
            'SELECT 200, 品目ID, 取り扱いフラグ, 積替保管フラグ ' +
            'FROM 許可品目 WHERE 許可ID = 100'
        );
    });

    test('コピー後に品目を追加（変更許可の目的: 取扱品目の追加）', () => {
        // コピー元の品目はそのまま、新たに品目を追加
        var addItem = logic.buildPermitItemQueries(200, 5);
        expect(addItem.insert).toContain('VALUES (200, 5, True, False)');
    });

    test('コピー後に品目を削除（変更許可の目的: 取扱品目の削除）', () => {
        var removeItem = logic.buildPermitItemQueries(200, 3);
        var sql = removeItem.remove(999);
        expect(sql).toContain('DELETE FROM 許可品目 WHERE 許可品目ID = 999');
    });

    test('コピー後に積替保管を追加（変更許可の目的: 積替保管の追加）', () => {
        var upgradeItem = logic.buildPermitItemQueries(200, 2);
        var sql = upgradeItem.toTransfer(888);
        expect(sql).toContain('積替保管フラグ = True');
        expect(sql).toContain('WHERE 許可品目ID = 888');
    });

    test('原許可の品目を確認するクエリは原許可IDを使う', () => {
        var sql = logic.buildLoadPermitItemsQuery(100);
        expect(sql).toContain('WHERE 許可ID = 100');
    });

    test('変更許可の品目を確認するクエリは変更許可IDを使う', () => {
        var sql = logic.buildLoadPermitItemsQuery(200);
        expect(sql).toContain('WHERE 許可ID = 200');
    });
});

// ========================================================================
// S11: 誤操作 — 廃止を誤って実行→復活
// ========================================================================
describe('S11: 誤操作 — 間違えて廃止→復活で元に戻す', () => {
    var permitId = 50;

    test('1. 職員が誤って廃止を実行', () => {
        var sql = logic.buildAbolishPermitQuery(permitId, '2026/02/01', '誤操作');
        expect(sql).toContain('廃止日 = #2026/02/01#');
        expect(sql).toContain('有効終了日時 = #2026/02/01#');
    });

    test('2. 廃止後: 有効な許可の検索でヒットしない条件', () => {
        var sql = searchAt('2026/02/15', { status: 'active' });
        // 有効終了日時=2026/02/01, 条件: > 2026/02/15 → false → 除外
        expect(sql).toContain('廃止日 IS NULL AND 許可.取消日 IS NULL');
    });

    test('3. 廃止状態の許可は「廃止」ステータスで検索可能', () => {
        var sql = searchAt('2026/02/15', { status: 'abolished' });
        expect(sql).toContain('許可.廃止日 IS NOT NULL');
        // 廃止時は有効終了日時の制限を緩和
        expect(sql).toContain('許可.有効開始日時 <= #2026/02/15 23:59:59#');
        expect(sql).not.toContain('有効終了日時 IS NULL OR');
    });

    test('4. 復活で全フィールドをNULLに戻す', () => {
        var sql = logic.buildRestorePermitQuery(permitId);
        expect(sql).toContain('廃止日 = NULL');
        expect(sql).toContain('廃止理由 = NULL');
        expect(sql).toContain('取消日 = NULL');
        expect(sql).toContain('取消理由 = NULL');
        expect(sql).toContain('有効終了日時 = NULL');
        expect(sql).toContain('WHERE 許可ID = 50');
    });

    test('5. 復活後: 有効な許可の検索で再びヒット', () => {
        // 有効終了日時=NULL → IS NULLに合致
        var sql = searchAt('2026/02/15', { status: 'active' });
        expect(sql).toContain('有効終了日時 IS NULL');
        expect(sql).toContain('廃止日 IS NULL');
    });

    test('6. 復活後: 統計でもカウントされる', () => {
        var q = logic.buildStatisticsQueries();
        expect(q.permitCount).toContain('[有効終了日時] IS NULL');
        expect(q.permitCount).toContain('[廃止日] IS NULL');
    });
});

// ========================================================================
// S12: 誤操作 — 取消を誤って実行→復活
// ========================================================================
describe('S12: 誤操作 — 間違えて取消→復活で元に戻す', () => {
    var permitId = 60;

    test('1. 職員が誤って取消を実行', () => {
        var sql = logic.buildCancelPermitQuery(permitId, '2026/03/01', '誤操作による取消');
        expect(sql).toContain('取消日 = #2026/03/01#');
        expect(sql).toContain('有効終了日時 = #2026/03/01#');
        expect(sql).toContain("取消理由 = '誤操作による取消'");
    });

    test('2. 取消状態で検索', () => {
        var sql = searchAt('2026/03/15', { status: 'cancelled' });
        expect(sql).toContain('許可.取消日 IS NOT NULL');
    });

    test('3. 復活でNULLに戻す', () => {
        var sql = logic.buildRestorePermitQuery(permitId);
        expect(sql).toContain('取消日 = NULL');
        expect(sql).toContain('取消理由 = NULL');
        expect(sql).toContain('有効終了日時 = NULL');
    });

    test('4. 復活後: 有効として検索可能', () => {
        var sql = searchAt('2026/03/15', { status: 'active' });
        expect(sql).toContain('廃止日 IS NULL AND 許可.取消日 IS NULL');
        expect(sql).toContain('有効終了日時 IS NULL');
    });
});

// ========================================================================
// S13: 誤操作 — 日付の入力ミスを修正
// ========================================================================
describe('S13: 誤操作 — 許可年月日・有効期限の入力ミスを修正', () => {
    test('1. 許可年月日を誤入力（2026/04/01→正しくは2026/05/01）', () => {
        var sql = logic.buildUpdatePermitHistoryQuery({
            permitId: 70,
            permitNumber: '01100070001', categoryId: 1,
            permitDate: '2026/05/01' // 修正
        });
        expect(sql).toContain('許可年月日 = #2026/05/01#');
        expect(sql).toContain('WHERE 許可ID = 70');
    });

    test('2. 許可有効年月日を誤入力（2031/03/31→正しくは2031/04/30）', () => {
        var sql = logic.buildUpdatePermitHistoryQuery({
            permitId: 70,
            permitNumber: '01100070001', categoryId: 1,
            validDate: '2031/04/30'
        });
        expect(sql).toContain('許可有効年月日 = #2031/04/30#');
    });

    test('3. 有効開始日時を誤入力（2026/04/01→正しくは2026/05/01）', () => {
        var sql = logic.buildUpdatePermitHistoryQuery({
            permitId: 70,
            permitNumber: '01100070001', categoryId: 1,
            startDate: '2026/05/01'
        });
        expect(sql).toContain('有効開始日時 = #2026/05/01#');
    });

    test('4. 有効終了日時を誤入力（修正: 2026/05/14→2026/05/15）', () => {
        var sql = logic.buildUpdatePermitHistoryQuery({
            permitId: 70,
            permitNumber: '01100070001', categoryId: 1,
            endDate: '2026/05/15'
        });
        expect(sql).toContain('有効終了日時 = #2026/05/15#');
    });

    test('5. 有効終了日時をNULLに戻す（誤クローズの取り消し）', () => {
        var sql = logic.buildUpdatePermitHistoryQuery({
            permitId: 70,
            permitNumber: '01100070001', categoryId: 1,
            endDate: '' // 空文字→NULL
        });
        expect(sql).toContain('有効終了日時 = NULL');
    });

    test('6. buildUpdateBoundaryDateQueryで境界日を直接修正', () => {
        var sql = logic.buildUpdateBoundaryDateQuery('許可', '許可ID', 70, '有効開始日時', '2026/05/01');
        expect(sql).toBe('UPDATE 許可 SET 有効開始日時 = #2026/05/01# WHERE 許可ID = 70');
    });

    test('7. buildUpdateBoundaryDateQueryで有効終了日時を修正', () => {
        var sql = logic.buildUpdateBoundaryDateQuery('許可', '許可ID', 70, '有効終了日時', '2026/05/15');
        expect(sql).toBe('UPDATE 許可 SET 有効終了日時 = #2026/05/15# WHERE 許可ID = 70');
    });
});

// ========================================================================
// S14: 誤操作 — 許可番号の誤入力を修正
// ========================================================================
describe('S14: 誤操作 — 許可番号の誤入力を修正', () => {
    test('許可番号を修正（updatePermitHistory経由）', () => {
        var sql = logic.buildUpdatePermitHistoryQuery({
            permitId: 80,
            permitNumber: '01100080002', // 修正後の番号
            categoryId: 1
        });
        expect(sql).toContain("許可番号 = '01100080002'");
    });

    test('許可区分を修正（収集運搬→処分業）', () => {
        var sql = logic.buildUpdatePermitHistoryQuery({
            permitId: 80,
            permitNumber: '01200080001',
            categoryId: 3 // 修正後の区分
        });
        expect(sql).toContain('許可区分ID = 3');
    });

    test('優良認定を修正（false→true）', () => {
        var sql = logic.buildUpdatePermitHistoryQuery({
            permitId: 80,
            permitNumber: '01100080001', categoryId: 1,
            excellent: true
        });
        expect(sql).toContain('優良認定 = True');
    });

    test('優良認定を修正（true→false）', () => {
        var sql = logic.buildUpdatePermitHistoryQuery({
            permitId: 80,
            permitNumber: '01100080001', categoryId: 1,
            excellent: false
        });
        expect(sql).toContain('優良認定 = False');
    });
});

// ========================================================================
// S15: 誤操作 — 複数フィールドを同時に修正
// ========================================================================
describe('S15: 誤操作 — 複数フィールドを同時に修正', () => {
    test('全フィールドを一度に修正', () => {
        var sql = logic.buildUpdatePermitHistoryQuery({
            permitId: 90,
            permitNumber: '01100090001', categoryId: 2,
            permitDate: '2026/04/01', validDate: '2031/03/31',
            startDate: '2026/04/01', endDate: '',
            excellent: true,
            cancelDate: '', cancelReason: '',
            abolishDate: '', abolishReason: ''
        });
        expect(sql).toContain("許可番号 = '01100090001'");
        expect(sql).toContain('許可区分ID = 2');
        expect(sql).toContain('許可年月日 = #2026/04/01#');
        expect(sql).toContain('許可有効年月日 = #2031/03/31#');
        expect(sql).toContain('有効開始日時 = #2026/04/01#');
        expect(sql).toContain('有効終了日時 = NULL');
        expect(sql).toContain('優良認定 = True');
        expect(sql).toContain('取消日 = NULL');
        expect(sql).toContain('取消理由 = NULL');
        expect(sql).toContain('廃止日 = NULL');
        expect(sql).toContain('廃止理由 = NULL');
    });

    test('部分更新: 許可番号と区分のみ（他のフィールドは変更しない）', () => {
        var sql = logic.buildUpdatePermitHistoryQuery({
            permitId: 90,
            permitNumber: '01100090002', categoryId: 3
            // 他のフィールドはundefined→SET句に含まれない
        });
        expect(sql).toContain("許可番号 = '01100090002'");
        expect(sql).toContain('許可区分ID = 3');
        // undefinedのフィールドはSET句に含まれない
        expect(sql).not.toContain('許可年月日');
        expect(sql).not.toContain('有効開始日時');
        expect(sql).not.toContain('優良認定');
    });
});

// ========================================================================
// S16: 誤操作 — 更新時に旧バージョンを閉じ忘れた場合
// ========================================================================
describe('S16: 誤操作 — 旧バージョンのクローズ忘れ対策', () => {
    test('buildCloseOldPermitVersionsQueryで一括クローズ可能', () => {
        // 論理ID=800の旧バージョンをすべてクローズ
        var sql = logic.buildCloseOldPermitVersionsQuery(800, '2026/04/01');
        expect(sql).toContain('許可論理ID = 800');
        expect(sql).toContain('有効終了日時 IS NULL');
        // 新許可日の前日でクローズ
        expect(sql).toContain("DateAdd('d', -1, #2026/04/01#)");
    });

    test('buildCloseOldVersionByIdQueryで特定レコードのみクローズ', () => {
        var sql = logic.buildCloseOldVersionByIdQuery('許可', '許可ID', 15, '2026/04/01');
        expect(sql).toContain('有効終了日時 = #2026/04/01#');
        expect(sql).toContain('WHERE 許可ID = 15');
        expect(sql).toContain('AND 有効終了日時 IS NULL');
    });

    test('既にクローズ済みのレコードは二重クローズされない', () => {
        var sql = logic.buildCloseOldVersionByIdQuery('許可', '許可ID', 15, '2026/04/01');
        // AND 有効終了日時 IS NULL → 既にクローズ済みなら0行更新
        expect(sql).toContain('AND 有効終了日時 IS NULL');
    });

    test('境界日を指定してクローズ（一括クローズのboundaryDateStr）', () => {
        var sql = logic.buildCloseOldVersionByIdQuery('許可', '許可ID', 15, '2026/04/01', '2026/05/14');
        expect(sql).toContain('有効終了日時 = #2026/05/14#');
    });
});

// ========================================================================
// S17: 誤操作 — 廃止と取消の日付入力ミス
// ========================================================================
describe('S17: 誤操作 — 廃止・取消の日付や理由の修正', () => {
    test('廃止日を修正（updatePermitHistory経由）', () => {
        var sql = logic.buildUpdatePermitHistoryQuery({
            permitId: 100,
            permitNumber: '01100100001', categoryId: 1,
            abolishDate: '2026/07/01', // 修正後
            abolishReason: '事業廃止届出に基づく'
        });
        expect(sql).toContain('廃止日 = #2026/07/01#');
        expect(sql).toContain("廃止理由 = '事業廃止届出に基づく'");
    });

    test('取消日を修正', () => {
        var sql = logic.buildUpdatePermitHistoryQuery({
            permitId: 100,
            permitNumber: '01100100001', categoryId: 1,
            cancelDate: '2026/08/15',
            cancelReason: '法第14条の3の2第1項に基づく'
        });
        expect(sql).toContain('取消日 = #2026/08/15#');
        expect(sql).toContain("取消理由 = '法第14条の3の2第1項に基づく'");
    });

    test('廃止日をNULLに戻す（取り消し）', () => {
        var sql = logic.buildUpdatePermitHistoryQuery({
            permitId: 100,
            permitNumber: '01100100001', categoryId: 1,
            abolishDate: '', abolishReason: ''
        });
        expect(sql).toContain('廃止日 = NULL');
        expect(sql).toContain('廃止理由 = NULL');
    });

    test('取消日をNULLに戻す（取り消し）', () => {
        var sql = logic.buildUpdatePermitHistoryQuery({
            permitId: 100,
            permitNumber: '01100100001', categoryId: 1,
            cancelDate: '', cancelReason: ''
        });
        expect(sql).toContain('取消日 = NULL');
        expect(sql).toContain('取消理由 = NULL');
    });
});

// ========================================================================
// S18: 廃止された許可のas-of検索の境界値
// ========================================================================
describe('S18: 廃止許可のas-of検索境界値テスト', () => {
    // 許可ID=110, 有効開始=2021/04/01, 廃止日=2025/09/30, 有効終了=2025/09/30
    var permitId = 110;

    test('廃止日にbuildAbolishPermitQueryが有効終了日時も設定する', () => {
        var sql = logic.buildAbolishPermitQuery(permitId, '2025/09/30', '自主廃止');
        expect(sql).toContain('廃止日 = #2025/09/30#');
        expect(sql).toContain('有効終了日時 = #2025/09/30#');
    });

    test('廃止日の1日前（2025/09/29）の検索 → ヒットする', () => {
        // 有効終了=2025/09/30 > 2025/09/29 → ヒット
        var sql = searchAt('2025/09/29');
        expect(sql).toContain('有効終了日時 > #2025/09/29 23:59:59#');
    });

    test('廃止日当日（2025/09/30）の検索 → ヒットしない', () => {
        // 有効終了=2025/09/30, 条件: > #2025/09/30 23:59:59#
        // #2025/09/30# > #2025/09/30 23:59:59# → false（Accessでは日付 < 日付時刻）
        var sql = searchAt('2025/09/30');
        expect(sql).toContain('有効終了日時 > #2025/09/30 23:59:59#');
    });

    test('廃止日翌日（2025/10/01）の検索 → ヒットしない', () => {
        var sql = searchAt('2025/10/01');
        expect(sql).toContain('有効終了日時 > #2025/10/01 23:59:59#');
    });

    test('「廃止」ステータスで検索 → 有効終了日時の制限が緩和される', () => {
        var sql = searchAt('2025/10/01', { status: 'abolished' });
        // abolished の場合、historyCondition は有効開始日時のみ
        expect(sql).toContain('許可.有効開始日時 <= #2025/10/01 23:59:59#');
        expect(sql).not.toContain('有効終了日時 IS NULL OR');
        expect(sql).toContain('許可.廃止日 IS NOT NULL');
    });

    test('「廃止」ステータスで廃止前の時点を検索 → 有効開始日時のみチェック', () => {
        var sql = searchAt('2024/01/01', { status: 'abolished' });
        expect(sql).toContain('許可.有効開始日時 <= #2024/01/01 23:59:59#');
        expect(sql).toContain('許可.廃止日 IS NOT NULL');
    });
});

// ========================================================================
// S19: 取消された許可のas-of検索の境界値
// ========================================================================
describe('S19: 取消許可のas-of検索境界値テスト', () => {
    var permitId = 120;

    test('buildCancelPermitQueryが有効終了日時も設定する', () => {
        var sql = logic.buildCancelPermitQuery(permitId, '2025/11/15', '14条の3の2');
        expect(sql).toContain('取消日 = #2025/11/15#');
        expect(sql).toContain('有効終了日時 = #2025/11/15#');
    });

    test('取消日の1日前のactiveステータス検索 → ヒット', () => {
        var sql = searchAt('2025/11/14', { status: 'active' });
        expect(sql).toContain('廃止日 IS NULL AND 許可.取消日 IS NULL');
        expect(sql).toContain('有効終了日時 > #2025/11/14 23:59:59#');
    });

    test('取消日当日のactiveステータス検索 → ヒットしない', () => {
        // 有効終了=2025/11/15, 条件: > #2025/11/15 23:59:59# → false
        var sql = searchAt('2025/11/15', { status: 'active' });
        expect(sql).toContain('有効終了日時 > #2025/11/15 23:59:59#');
    });

    test('「取消」ステータスで検索 → 有効終了日時の制限が緩和される', () => {
        var sql = searchAt('2025/12/01', { status: 'cancelled' });
        expect(sql).toContain('許可.有効開始日時 <= #2025/12/01 23:59:59#');
        expect(sql).not.toContain('有効終了日時 IS NULL OR');
        expect(sql).toContain('許可.取消日 IS NOT NULL');
    });
});

// ========================================================================
// S20: 復活後の時点検索の整合性
// ========================================================================
describe('S20: 復活後の時点検索の整合性', () => {
    // 許可ID=130
    // 2021/04/01に許可取得
    // 2025/06/30に誤って廃止 → 2025/07/01に復活
    var permitId = 130;

    test('復活SQLが全関連フィールドをNULLにする', () => {
        var sql = logic.buildRestorePermitQuery(permitId);
        var nullCount = (sql.match(/= NULL/g) || []).length;
        expect(nullCount).toBe(5); // 廃止日, 廃止理由, 取消日, 取消理由, 有効終了日時
    });

    test('復活後: 現在のas-of検索でヒット', () => {
        var sql = searchAt('2025/07/15', { status: 'active' });
        expect(sql).toContain('有効終了日時 IS NULL');
        expect(sql).toContain('廃止日 IS NULL AND 許可.取消日 IS NULL');
    });

    test('復活後: 統計カウントに含まれる', () => {
        var q = logic.buildStatisticsQueries();
        // 有効終了日時=NULL → IS NULLでカウント対象
        expect(q.permitCount).toContain('[有効終了日時] IS NULL');
        expect(q.permitCount).toContain('[廃止日] IS NULL');
        expect(q.permitCount).toContain('[取消日] IS NULL');
    });

    test('復活後: 期限切れ間近リストに含まれる条件', () => {
        var sql = logic.buildLoadExpiringPermitsQuery();
        expect(sql).toContain('有効終了日時 IS NULL');
        expect(sql).toContain('廃止日 IS NULL');
        expect(sql).toContain('取消日 IS NULL');
    });
});

// ========================================================================
// S21: 施設の時点検索とバージョン管理
// ========================================================================
describe('S21: 施設のバージョン管理と廃止', () => {
    // 施設v1: 施設ID=301, 論理ID=700, 有効開始=2022/04/01, 有効終了=2025/06/30
    // 施設v2: 施設ID=302, 論理ID=700, 有効開始=2025/07/01, 有効終了=NULL

    test('施設v1の登録', () => {
        var sql = logic.buildSaveFacilityQuery({
            logicalId: 700, businessId: 70, typeId: 1,
            location: '埼玉県さいたま市桜区1-1',
            permitNo: '01100070001', permitDate: '2022/04/01',
            setupDate: '2022/03/01', todayStr: '2022/04/01'
        });
        expect(sql).toContain('INSERT INTO 施設');
        expect(sql).toContain('#2022/04/01#');
    });

    test('施設v1のクローズとv2の登録', () => {
        var closeV1 = logic.buildCloseOldFacilityVersionsQuery(700, '2025/07/01', '2025/06/30');
        expect(closeV1).toContain('有効終了日時 = #2025/06/30#');
        expect(closeV1).toContain('施設論理ID = 700');

        var v2 = logic.buildSaveFacilityQuery({
            logicalId: 700, businessId: 70, typeId: 1,
            location: '埼玉県さいたま市中央区2-2', // 移転
            permitNo: '01100070001', permitDate: '2025/07/01',
            setupDate: '2025/06/15', todayStr: '2025/07/01'
        });
        expect(v2).toContain("'埼玉県さいたま市中央区2-2'");
    });

    test('施設v2の廃止', () => {
        var sql = logic.buildAbolishFacilityQuery(302, '2026/12/31');
        expect(sql).toContain('有効終了日時 = #2026/12/31#');
        expect(sql).toContain('廃止年月日 = #2026/12/31#');
    });

    test('施設検索は有効終了日時と廃止年月日の両方をチェック', () => {
        var sql = logic.buildSearchFacilityQuery('さいたま', '');
        expect(sql).toContain('施設.有効終了日時 IS NULL');
        expect(sql).toContain('施設.廃止年月日 IS NULL');
    });

    test('施設履歴で全バージョンが見える', () => {
        var sql = logic.buildLoadFacilityHistoryQuery(700);
        expect(sql).toContain('施設論理ID = 700');
        expect(sql).not.toContain('有効終了日時 IS NULL');
    });
});

// ========================================================================
// S22: 施設の誤操作と修正
// ========================================================================
describe('S22: 施設の誤操作と修正', () => {
    test('施設の設置場所を誤入力→修正', () => {
        var sql = logic.buildUpdateFacilityHistoryQuery({
            facilityId: 310,
            typeId: 2,
            location: '正しい住所: 埼玉県川越市1-2-3'
        });
        expect(sql).toContain("設置場所 = '正しい住所: 埼玉県川越市1-2-3'");
    });

    test('施設種別を誤入力→修正', () => {
        var sql = logic.buildUpdateFacilityHistoryQuery({
            facilityId: 310,
            typeId: 3, // 修正後
            location: '埼玉県川越市1-2-3'
        });
        expect(sql).toContain('施設種別ID = 3');
    });

    test('施設の許可番号を修正', () => {
        var sql = logic.buildUpdateFacilityHistoryQuery({
            facilityId: 310,
            typeId: 2,
            location: '埼玉県川越市1-2-3',
            permitNo: '01100310002' // 修正後
        });
        expect(sql).toContain("許可番号 = '01100310002'");
    });

    test('施設の有効終了日時をNULLに戻す（誤廃止の取り消し）', () => {
        var sql = logic.buildUpdateFacilityHistoryQuery({
            facilityId: 310,
            typeId: 2,
            location: '埼玉県川越市1-2-3',
            endDate: '',
            abolishDate: ''
        });
        expect(sql).toContain('有効終了日時 = NULL');
        expect(sql).toContain('廃止年月日 = NULL');
    });
});

// ========================================================================
// S23: 大規模タイムライン — 10年間の許可履歴シミュレーション
// ========================================================================
describe('S23: 10年間の許可履歴シミュレーション', () => {
    // 業者X: 事業者ID=80
    // 2016年: 新規許可取得
    // 2018年: 変更許可（品目追加）
    // 2021年: 更新許可
    // 2023年: 変更許可（積替保管追加）
    // 2025年: 一時的に誤廃止→即日復活
    // 2026年: 更新許可
    var logicalId = 900;
    var businessId = 80;

    test('Step1: 2016年新規許可', () => {
        var sql = logic.buildSavePermitQuery({
            logicalId: logicalId, businessId: businessId, categoryId: 1,
            number: '01100080001',
            permitDate: '2016/04/01', validDate: '2021/03/31',
            excellent: false, todayStr: '2016/04/01'
        });
        expect(sql).toContain('#2016/04/01#');
    });

    test('Step2: 2018年変更許可（原許可クローズ + 変更許可作成）', () => {
        var close = logic.buildUpdatePermitHistoryQuery({
            permitId: 1, permitNumber: '01100080001', categoryId: 1,
            endDate: '2018/09/30'
        });
        expect(close).toContain('有効終了日時 = #2018/09/30#');

        var change = logic.buildSavePermitQuery({
            logicalId: logicalId, businessId: businessId, categoryId: 1,
            number: '01100080001',
            permitDate: '2018/10/01', validDate: '2021/03/31', // 同じ有効期限
            excellent: false, todayStr: '2018/10/01'
        });
        expect(change).toContain('#2021/03/31#');
    });

    test('Step3: 2021年更新許可（変更許可クローズ + 更新許可作成）', () => {
        var close = logic.buildUpdatePermitHistoryQuery({
            permitId: 2, permitNumber: '01100080001', categoryId: 1,
            endDate: '2021/05/14'
        });
        expect(close).toContain('有効終了日時 = #2021/05/14#');

        var renewal = logic.buildSavePermitQuery({
            logicalId: logicalId, businessId: businessId, categoryId: 1,
            number: '01100080001',
            permitDate: '2021/05/15', validDate: '2026/03/31',
            excellent: false, todayStr: '2021/05/15'
        });
        expect(renewal).toContain('#2026/03/31#');
    });

    test('Step4: 2023年変更許可', () => {
        var close = logic.buildUpdatePermitHistoryQuery({
            permitId: 3, permitNumber: '01100080001', categoryId: 1,
            endDate: '2023/11/30'
        });
        expect(close).toContain('有効終了日時 = #2023/11/30#');

        var change = logic.buildSavePermitQuery({
            logicalId: logicalId, businessId: businessId, categoryId: 1,
            number: '01100080001',
            permitDate: '2023/12/01', validDate: '2026/03/31', // 同じ有効期限
            excellent: true, todayStr: '2023/12/01'
        });
        expect(change).toContain('True'); // 2023年に優良認定
    });

    test('Step5: 2025年3月に誤廃止→即日復活', () => {
        var abolish = logic.buildAbolishPermitQuery(4, '2025/03/01', '誤操作');
        expect(abolish).toContain('廃止日 = #2025/03/01#');

        var restore = logic.buildRestorePermitQuery(4);
        expect(restore).toContain('廃止日 = NULL');
        expect(restore).toContain('有効終了日時 = NULL');
    });

    test('Step6: 2026年更新許可', () => {
        var close = logic.buildUpdatePermitHistoryQuery({
            permitId: 4, permitNumber: '01100080001', categoryId: 1,
            endDate: '2026/04/14'
        });
        expect(close).toContain('有効終了日時 = #2026/04/14#');

        var renewal = logic.buildSavePermitQuery({
            logicalId: logicalId, businessId: businessId, categoryId: 1,
            number: '01100080001',
            permitDate: '2026/04/15', validDate: '2031/03/31',
            excellent: true, todayStr: '2026/04/15'
        });
        expect(renewal).toContain('#2031/03/31#');
    });

    test.each([
        ['2016/06/01', '原許可期間中'],
        ['2017/12/31', '原許可の年末'],
        ['2018/10/01', '変更許可1の初日'],
        ['2020/01/01', '変更許可1の期間中'],
        ['2021/04/01', 'みなし有効期間中（更新待ち）'],
        ['2021/05/15', '更新許可の初日'],
        ['2023/06/01', '更新許可の期間中'],
        ['2023/12/01', '変更許可2の初日'],
        ['2025/01/01', '変更許可2の期間中'],
        ['2026/03/01', '変更許可2の末期'],
        ['2026/04/15', '更新許可2の初日'],
        ['2028/01/01', '更新許可2の期間中'],
    ])('%s: as-of検索条件が正しく生成される（%s）', (date) => {
        var sql = searchAt(date);
        expect(sql).toContain('許可.有効開始日時 <= #' + date + ' 23:59:59#');
        expect(sql).toContain('有効終了日時');
    });
});

// ========================================================================
// S24: バリデーション — 職員の入力ミスを事前に防止
// ========================================================================
describe('S24: バリデーション — 許可データの入力ミス検出', () => {
    test('許可番号が空 → エラー', () => {
        var errors = logic.validatePermitData({
            number: '', permitDate: '2026/04/01', validDate: '2031/03/31'
        });
        expect(errors.length).toBeGreaterThan(0);
        expect(errors[0]).toContain('許可番号');
    });

    test('許可年月日のフォーマットが不正 → エラー', () => {
        var errors = logic.validatePermitData({
            number: '01100010001', permitDate: '2026-04-01', validDate: '2031/03/31'
        });
        expect(errors.length).toBeGreaterThan(0);
        expect(errors.some(function(e) { return e.indexOf('yyyy/mm/dd') >= 0; })).toBe(true);
    });

    test('許可年月日 > 許可有効年月日 → エラー', () => {
        var errors = logic.validatePermitData({
            number: '01100010001', permitDate: '2031/04/01', validDate: '2026/03/31'
        });
        expect(errors.some(function(e) { return e.indexOf('以前') >= 0; })).toBe(true);
    });

    test('正常な許可データ → エラーなし', () => {
        var errors = logic.validatePermitData({
            number: '01100010001', permitDate: '2026/04/01', validDate: '2031/03/31'
        });
        expect(errors).toEqual([]);
    });

    test('日付が空（任意）→ エラーなし', () => {
        var errors = logic.validatePermitData({
            number: '01100010001', permitDate: '', validDate: ''
        });
        expect(errors).toEqual([]);
    });
});

// ========================================================================
// S25: バリデーション — 廃止日の入力ミス検出
// ========================================================================
describe('S25: バリデーション — 廃止日の入力ミス検出', () => {
    test('廃止日が空 → エラー（必須）', () => {
        var errors = logic.validateAbolishDate('');
        expect(errors.length).toBe(1);
        expect(errors[0]).toContain('廃止日');
    });

    test('廃止日のフォーマットが不正 → エラー', () => {
        var errors = logic.validateAbolishDate('2026-01-01');
        expect(errors.length).toBe(1);
        expect(errors[0]).toContain('yyyy/mm/dd');
    });

    test('無効な日付（2月30日）→ エラー', () => {
        var errors = logic.validateAbolishDate('2026/02/30');
        expect(errors.length).toBe(1);
        expect(errors[0]).toContain('無効な日付');
    });

    test('1年以上先の日付 → エラー', () => {
        var futureDate = new Date();
        futureDate.setFullYear(futureDate.getFullYear() + 2);
        var dateStr = logic.buildDateStr(futureDate);
        var errors = logic.validateAbolishDate(dateStr);
        expect(errors.length).toBe(1);
        expect(errors[0]).toContain('1年以上先');
    });

    test('今日の日付 → エラーなし', () => {
        var today = logic.buildDateStr(new Date());
        var errors = logic.validateAbolishDate(today);
        expect(errors).toEqual([]);
    });

    test('過去の日付 → エラーなし', () => {
        var errors = logic.validateAbolishDate('2020/01/01');
        expect(errors).toEqual([]);
    });
});

// ========================================================================
// S26: 廃止・取消のステータス検索における historyCondition の分岐
// ========================================================================
describe('S26: ステータス別の historyCondition 分岐テスト', () => {
    test('status なし（デフォルト）: 有効開始+有効終了の両方チェック', () => {
        var sql = searchAt('2026/03/01');
        expect(sql).toContain('許可.有効開始日時 <= #2026/03/01 23:59:59#');
        expect(sql).toContain('許可.有効終了日時 IS NULL OR 許可.有効終了日時 > #2026/03/01 23:59:59#');
    });

    test('status=active: 有効開始+有効終了の両方チェック', () => {
        var sql = searchAt('2026/03/01', { status: 'active' });
        expect(sql).toContain('許可.有効開始日時 <= #2026/03/01 23:59:59#');
        expect(sql).toContain('許可.有効終了日時 IS NULL OR 許可.有効終了日時 > #2026/03/01 23:59:59#');
    });

    test('status=abolished: 有効開始のみチェック（有効終了フィルタなし）', () => {
        var sql = searchAt('2026/03/01', { status: 'abolished' });
        expect(sql).toContain('許可.有効開始日時 <= #2026/03/01 23:59:59#');
        expect(sql).not.toContain('有効終了日時 IS NULL OR');
        expect(sql).not.toContain('有効終了日時 >');
    });

    test('status=cancelled: 有効開始のみチェック（有効終了フィルタなし）', () => {
        var sql = searchAt('2026/03/01', { status: 'cancelled' });
        expect(sql).toContain('許可.有効開始日時 <= #2026/03/01 23:59:59#');
        expect(sql).not.toContain('有効終了日時 IS NULL OR');
        expect(sql).not.toContain('有効終了日時 >');
    });

    test('status=abolished + keyword: 両方の条件が含まれる', () => {
        var sql = searchAt('2026/03/01', { status: 'abolished', keyword: 'テスト' });
        expect(sql).toContain('許可.有効開始日時 <=');
        expect(sql).toContain("LIKE '%テスト%'");
        expect(sql).toContain('許可.廃止日 IS NOT NULL');
    });
});

// ========================================================================
// S27: 品目検索 + 時点指定の複合シナリオ
// ========================================================================
describe('S27: 品目検索 + 時点指定の複合テスト', () => {
    test('品目OR検索 + 時点指定', () => {
        var sql = searchAt('2025/06/01', {
            selectedItemIds: ['1', '3', '5'],
            itemMode: 'OR'
        });
        expect(sql).toContain('SELECT DISTINCT');
        expect(sql).toContain('INNER JOIN 許可品目');
        expect(sql).toContain('品目ID IN (1,3,5)');
        expect(sql).toContain('許可.有効開始日時 <= #2025/06/01 23:59:59#');
    });

    test('品目AND検索 + 時点指定', () => {
        var sql = searchAt('2025/06/01', {
            selectedItemIds: ['1', '3'],
            itemMode: 'AND'
        });
        expect(sql).not.toContain('SELECT DISTINCT');
        expect(sql).toContain('EXISTS (SELECT 1 FROM 許可品目');
        expect(sql).toContain('品目ID = 1');
        expect(sql).toContain('品目ID = 3');
        expect(sql).toContain('許可.有効開始日時 <= #2025/06/01 23:59:59#');
    });

    test('品目AND検索 + 時点指定 + ステータス(active)', () => {
        var sql = searchAt('2025/06/01', {
            selectedItemIds: ['2'],
            itemMode: 'AND',
            status: 'active'
        });
        expect(sql).toContain('EXISTS');
        expect(sql).toContain('品目ID = 2');
        expect(sql).toContain('廃止日 IS NULL AND 許可.取消日 IS NULL');
    });

    test('品目OR検索 + 時点指定 + 期限フィルタ + 優良認定', () => {
        var sql = searchAt('2025/06/01', {
            selectedItemIds: ['1'],
            itemMode: 'OR',
            expiry: '1year',
            excellentOnly: true,
            status: 'active'
        });
        expect(sql).toContain('品目ID IN (1)');
        expect(sql).toContain("DateAdd('yyyy', 1,");
        expect(sql).toContain('優良認定 = True');
        expect(sql).toContain('廃止日 IS NULL');
    });
});

// ========================================================================
// S28: 最新バージョン取得・最大ID取得ヘルパー
// ========================================================================
describe('S28: 最新バージョン取得・最大ID取得ヘルパー', () => {
    test('許可の最新バージョン取得', () => {
        var sql = logic.buildLoadLatestVersionQuery('許可', '許可論理ID', 100);
        expect(sql).toBe('SELECT TOP 1 * FROM 許可 WHERE 許可論理ID = 100 ORDER BY 有効開始日時 DESC');
    });

    test('施設の最新バージョン取得', () => {
        var sql = logic.buildLoadLatestVersionQuery('施設', '施設論理ID', 200);
        expect(sql).toBe('SELECT TOP 1 * FROM 施設 WHERE 施設論理ID = 200 ORDER BY 有効開始日時 DESC');
    });

    test('許可の最大ID取得', () => {
        var sql = logic.buildGetMaxIdQuery('許可', '許可ID', '許可論理ID', 100);
        expect(sql).toBe('SELECT MAX(許可ID) AS newId FROM 許可 WHERE 許可論理ID = 100');
    });

    test('施設の最大ID取得', () => {
        var sql = logic.buildGetMaxIdQuery('施設', '施設ID', '施設論理ID', 200);
        expect(sql).toBe('SELECT MAX(施設ID) AS newId FROM 施設 WHERE 施設論理ID = 200');
    });
});

// ========================================================================
// S29: 編集フォーム用クエリの全日付フィールド検証
// ========================================================================
describe('S29: 編集フォーム用クエリ — 全日付フィールドがFormat()で文字列化', () => {
    test('許可編集フォーム: 全日付カラムにFormat()適用', () => {
        var sql = logic.buildLoadPermitForEditQuery(50);
        // 6つの日付フィールドすべてにFormat()が適用されている
        expect(sql).toContain("Format(許可年月日, 'yyyy/mm/dd')");
        expect(sql).toContain("Format(許可有効年月日, 'yyyy/mm/dd')");
        expect(sql).toContain("Format(有効開始日時, 'yyyy/mm/dd')");
        expect(sql).toContain("Format(有効終了日時, 'yyyy/mm/dd')");
        expect(sql).toContain("Format(取消日, 'yyyy/mm/dd')");
        expect(sql).toContain("Format(廃止日, 'yyyy/mm/dd')");
        expect(sql).toContain('WHERE 許可ID = 50');
    });

    test('施設編集フォーム: 全日付カラムにFormat()適用', () => {
        var sql = logic.buildLoadFacilityForEditQuery(60);
        expect(sql).toContain("Format(許可年月日, 'yyyy/mm/dd')");
        expect(sql).toContain("Format(設置年月日, 'yyyy/mm/dd')");
        expect(sql).toContain("Format(有効開始日時, 'yyyy/mm/dd')");
        expect(sql).toContain("Format(有効終了日時, 'yyyy/mm/dd')");
        expect(sql).toContain("Format(廃止年月日, 'yyyy/mm/dd')");
        expect(sql).toContain('WHERE 施設ID = 60');
    });
});

// ========================================================================
// S30: エッジケース — 同日の操作
// ========================================================================
describe('S30: 同日に複数操作が発生するケース', () => {
    test('同日に廃止→復活した場合のSQL', () => {
        // 廃止
        var abolish = logic.buildAbolishPermitQuery(140, '2026/03/01', '誤操作');
        expect(abolish).toContain('廃止日 = #2026/03/01#');

        // 即座に復活
        var restore = logic.buildRestorePermitQuery(140);
        expect(restore).toContain('廃止日 = NULL');
        expect(restore).toContain('有効終了日時 = NULL');
    });

    test('同日に旧バージョンクローズ→新バージョン作成', () => {
        var close = logic.buildCloseOldVersionByIdQuery('許可', '許可ID', 150, '2026/03/01', '2026/02/28');
        expect(close).toContain('有効終了日時 = #2026/02/28#');

        var insert = logic.buildSavePermitQuery({
            logicalId: 1000, businessId: 90, categoryId: 1,
            number: '01100090001',
            permitDate: '2026/03/01', validDate: '2031/03/31',
            excellent: false, todayStr: '2026/03/01'
        });
        expect(insert).toContain('#2026/03/01#');
    });

    test('同日に変更許可→さらに修正（updatePermitHistory）', () => {
        // 変更許可作成
        var change = logic.buildSavePermitQuery({
            logicalId: 1100, businessId: 91, categoryId: 1,
            number: '01100091001',
            permitDate: '2026/03/01', validDate: '2030/03/31',
            excellent: false, todayStr: '2026/03/01'
        });
        expect(change).toContain('INSERT INTO 許可');

        // 即座に修正（番号の入力ミス）
        var fix = logic.buildUpdatePermitHistoryQuery({
            permitId: 160, // 新しく作成された許可ID
            permitNumber: '01100091002', categoryId: 1
        });
        expect(fix).toContain("許可番号 = '01100091002'");
    });
});

// ========================================================================
// S31: 全ステータス×時点×フィルタ の網羅テスト
// ========================================================================
describe('S31: ステータス×期限フィルタの全組み合わせ', () => {
    var statuses = ['active', 'abolished', 'cancelled'];
    var expiries = ['expired', '30days', '90days', '1year', 'valid'];
    var date = '2026/03/01';

    statuses.forEach(function(status) {
        expiries.forEach(function(expiry) {
            test(status + ' × ' + expiry + ' の検索条件が正しく生成される', () => {
                var sql = searchAt(date, { status: status, expiry: expiry });
                // 必ず有効開始日時の条件がある
                expect(sql).toContain('許可.有効開始日時 <=');

                // ステータス条件
                if (status === 'active') {
                    expect(sql).toContain('廃止日 IS NULL AND 許可.取消日 IS NULL');
                } else if (status === 'abolished') {
                    expect(sql).toContain('許可.廃止日 IS NOT NULL');
                } else if (status === 'cancelled') {
                    expect(sql).toContain('許可.取消日 IS NOT NULL');
                }

                // 期限条件
                if (expiry === 'expired') {
                    expect(sql).toContain('許可有効年月日 <');
                } else if (expiry === '30days') {
                    expect(sql).toContain("DateAdd('d', 30,");
                } else if (expiry === '90days') {
                    expect(sql).toContain("DateAdd('d', 90,");
                } else if (expiry === '1year') {
                    expect(sql).toContain("DateAdd('yyyy', 1,");
                } else if (expiry === 'valid') {
                    expect(sql).toContain('許可有効年月日 >=');
                }
            });
        });
    });
});

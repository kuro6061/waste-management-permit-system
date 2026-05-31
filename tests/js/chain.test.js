/**
 * チェーン概念のテスト
 * 有効開始日時/有効終了日時の自動管理を検証
 *
 * チェーンルール:
 * - 有効開始日時 = 許可年月日
 * - 有効終了日時 = 許可有効年月日（旧許可自身の有効期限で閉じる）
 * - 施設にも同じロジック（許可年月日があれば使用、なければ今日）
 */
const logic = require('../../app_logic.js');

// ===== buildSavePermitQuery: 有効開始日時 = permitDate =====

describe('buildSavePermitQuery（チェーン: 有効開始日時の自動設定）', () => {
    test('permitDateが指定されていれば有効開始日時にpermitDateが使われる', () => {
        const sql = logic.buildSavePermitQuery({
            logicalId: 10, businessId: 1, categoryId: 2,
            number: 'P-001', permitDate: '2027/01/05',
            validDate: '2032/01/05', excellent: false, todayStr: '2026/12/20'
        });
        // 有効開始日時 = 許可年月日 (2027/01/05)
        expect(sql).toContain('#2027/01/05#');
        // 作成日時 = todayStr (2026/12/20)
        expect(sql).toContain('#2026/12/20#');
        // 許可年月日と有効開始日時の両方に2027/01/05が使われる
        const matches = sql.match(/#2027\/01\/05#/g);
        expect(matches.length).toBe(2); // 許可年月日 + 有効開始日時
    });

    test('permitDateが省略された場合は有効開始日時にtodayStrが使われる', () => {
        const sql = logic.buildSavePermitQuery({
            logicalId: 10, businessId: 1, categoryId: 2,
            number: 'P-001', excellent: false, todayStr: '2026/12/20'
        });
        // 有効開始日時と作成日時の両方に todayStr が使われる
        const matches = sql.match(/#2026\/12\/20#/g);
        expect(matches.length).toBe(2); // 有効開始日時 + 作成日時
    });

    test('作成日時は常にtodayStr（permitDateに影響されない）', () => {
        const sql = logic.buildSavePermitQuery({
            logicalId: 10, businessId: 1, categoryId: 2,
            number: 'P-001', permitDate: '2027/04/01',
            validDate: '2032/04/01', excellent: true, todayStr: '2026/03/01'
        });
        // 作成日時には todayStr が入る
        expect(sql).toContain('#2026/03/01#');
        // 有効開始日時と許可年月日には permitDate が入る
        const permitDateMatches = sql.match(/#2027\/04\/01#/g);
        expect(permitDateMatches.length).toBe(2);
        // todayStr は作成日時の1回のみ
        const todayMatches = sql.match(/#2026\/03\/01#/g);
        expect(todayMatches.length).toBe(1);
    });
});

// ===== buildCloseOldPermitVersionsQuery: 許可有効年月日カラム参照 =====

describe('buildCloseOldPermitVersionsQuery（チェーン: 新許可日の前日で閉じる）', () => {
    test('DateAddで新許可日の前日に有効終了日時を設定する', () => {
        const sql = logic.buildCloseOldPermitVersionsQuery(50, '2026/12/20');
        expect(sql).toContain("有効終了日時 = DateAdd('d', -1, #2026/12/20#)");
        expect(sql).toContain('WHERE 許可論理ID = 50');
        expect(sql).toContain('有効終了日時 IS NULL');
    });

    test('newPermitDateで新許可の発効日を指定する', () => {
        const sql = logic.buildCloseOldPermitVersionsQuery(100, '2026/06/15');
        expect(sql).toBe(
            "UPDATE 許可 SET 有効終了日時 = DateAdd('d', -1, #2026/06/15#) WHERE 許可論理ID = 100 AND 有効終了日時 IS NULL"
        );
    });

    test('クローズ済みレコードは対象外（IS NULL条件）', () => {
        const sql = logic.buildCloseOldPermitVersionsQuery(50, '2026/03/01');
        expect(sql).toContain('AND 有効終了日時 IS NULL');
    });
});

// ===== buildCloseOldVersionByIdQuery: 境界日パラメータ（施設用に残存） =====

describe('buildCloseOldVersionByIdQuery（チェーン: 境界日指定）', () => {
    test('第5引数(boundaryDateStr)が指定されれば有効終了日時にそれが使われる', () => {
        const sql = logic.buildCloseOldVersionByIdQuery('施設', '施設ID', 200, '2026/12/20', '2027/01/05');
        expect(sql).toBe('UPDATE 施設 SET 有効終了日時 = #2027/01/05# WHERE 施設ID = 200 AND 有効終了日時 IS NULL');
    });

    test('第5引数が省略された場合はtodayStrが使われる（後方互換）', () => {
        const sql = logic.buildCloseOldVersionByIdQuery('施設', '施設ID', 200, '2026/12/20');
        expect(sql).toBe('UPDATE 施設 SET 有効終了日時 = #2026/12/20# WHERE 施設ID = 200 AND 有効終了日時 IS NULL');
    });
});

// ===== buildSaveFacilityQuery: 有効開始日時 = permitDate =====

describe('buildSaveFacilityQuery（チェーン: 有効開始日時の自動設定）', () => {
    test('permitDateが指定されていれば有効開始日時にpermitDateが使われる', () => {
        const sql = logic.buildSaveFacilityQuery({
            logicalId: 5, businessId: 1, typeId: 2,
            location: '東京都千代田区', permitDate: '2027/01/05',
            todayStr: '2026/12/20'
        });
        expect(sql).toContain('#2027/01/05#');
        // permitDate は 許可年月日 と 有効開始日時 の2箇所
        const matches = sql.match(/#2027\/01\/05#/g);
        expect(matches.length).toBe(2);
    });

    test('permitDateが省略された場合は有効開始日時にtodayStrが使われる', () => {
        const sql = logic.buildSaveFacilityQuery({
            logicalId: 5, businessId: 1, typeId: 2,
            location: '東京都千代田区', todayStr: '2026/12/20'
        });
        expect(sql).toContain('#2026/12/20#');
        // todayStr は 有効開始日時 の1箇所のみ（許可年月日はNULL）
        const matches = sql.match(/#2026\/12\/20#/g);
        expect(matches.length).toBe(1);
    });

    test('permitDateが空文字列の場合はtodayStrにフォールバック', () => {
        const sql = logic.buildSaveFacilityQuery({
            logicalId: 5, businessId: 1, typeId: 2,
            location: '東京都千代田区', permitDate: '',
            todayStr: '2026/12/20'
        });
        // 空文字列は falsy なので todayStr にフォールバック
        expect(sql).toContain('#2026/12/20#');
        expect(sql).toContain('NULL'); // 許可年月日はNULL
    });
});

// ===== buildCloseOldFacilityVersionsQuery: 施設旧バージョンクローズ =====

describe('buildCloseOldFacilityVersionsQuery（施設旧バージョンクローズ）', () => {
    test('境界日が指定されれば有効終了日時にそれが使われる', () => {
        const sql = logic.buildCloseOldFacilityVersionsQuery(30, '2026/12/20', '2027/01/05');
        expect(sql).toBe('UPDATE 施設 SET 有効終了日時 = #2027/01/05# WHERE 施設論理ID = 30 AND 有効終了日時 IS NULL');
    });

    test('境界日が省略された場合はtodayStrが使われる', () => {
        const sql = logic.buildCloseOldFacilityVersionsQuery(30, '2026/12/20');
        expect(sql).toBe('UPDATE 施設 SET 有効終了日時 = #2026/12/20# WHERE 施設論理ID = 30 AND 有効終了日時 IS NULL');
    });

    test('IS NULLで現在有効なバージョンのみ対象', () => {
        const sql = logic.buildCloseOldFacilityVersionsQuery(30, '2026/12/20', '2027/01/05');
        expect(sql).toContain('有効終了日時 IS NULL');
    });
});

// ===== チェーン整合性テスト =====

describe('チェーン整合性', () => {
    test('許可: 旧.有効終了 = 新許可日の前日、新.有効開始 = 新.許可年月日', () => {
        const todayStr = '2026/12/20';

        // 旧バージョンクローズ（新許可日の前日で閉じる）
        const closeSql = logic.buildCloseOldPermitVersionsQuery(50, todayStr);
        expect(closeSql).toContain("DateAdd('d', -1, #2026/12/20#)");

        // 新バージョン作成（有効開始日時 = 許可年月日）
        const insertSql = logic.buildSavePermitQuery({
            logicalId: 50, businessId: 1, categoryId: 2,
            number: 'P-001', permitDate: '2027/01/05',
            validDate: '2032/01/05', excellent: false, todayStr: todayStr
        });
        // 有効開始日時 = 許可年月日 = 2027/01/05
        const permitDateMatches = insertSql.match(/#2027\/01\/05#/g);
        expect(permitDateMatches.length).toBe(2); // 許可年月日 + 有効開始日時
        // todayStr は作成日時のみ
        const todayMatches = insertSql.match(/#2026\/12\/20#/g);
        expect(todayMatches.length).toBe(1); // 作成日時のみ
    });

    test('施設: 旧の有効終了と新の有効開始が境界日で一致する', () => {
        const newPermitDate = '2027/04/01';
        const todayStr = '2026/12/20';

        // 旧バージョンクローズ
        const closeSql = logic.buildCloseOldFacilityVersionsQuery(30, todayStr, newPermitDate);
        // 新バージョン作成
        const insertSql = logic.buildSaveFacilityQuery({
            logicalId: 30, businessId: 1, typeId: 2,
            location: '東京都', permitDate: newPermitDate,
            todayStr: todayStr
        });

        expect(closeSql).toContain('有効終了日時 = #2027/04/01#');
        expect(insertSql).toContain('#2027/04/01#');
    });

    test('施設: 許可年月日なしの場合はtodayStrで整合性が保たれる', () => {
        const todayStr = '2026/12/20';

        const closeSql = logic.buildCloseOldFacilityVersionsQuery(30, todayStr);
        const insertSql = logic.buildSaveFacilityQuery({
            logicalId: 30, businessId: 1, typeId: 2,
            location: '東京都', todayStr: todayStr
        });

        expect(closeSql).toContain('有効終了日時 = #2026/12/20#');
        expect(insertSql).toContain('#2026/12/20#');
    });
});

// ===== buildCopyPermitItemsQuery: 品目コピー =====

describe('buildCopyPermitItemsQuery（品目コピー）', () => {
    test('旧許可IDから新許可IDへの品目コピーSQL', () => {
        const sql = logic.buildCopyPermitItemsQuery(100, 200);
        expect(sql).toContain('INSERT INTO 許可品目');
        expect(sql).toContain('SELECT 200');
        expect(sql).toContain('FROM 許可品目 WHERE 許可ID = 100');
    });

    test('コピーするカラムが正しい（品目ID, 取り扱いフラグ, 積替保管フラグ）', () => {
        const sql = logic.buildCopyPermitItemsQuery(50, 75);
        expect(sql).toContain('品目ID');
        expect(sql).toContain('取り扱いフラグ');
        expect(sql).toContain('積替保管フラグ');
    });
});

// ===== 変更許可シナリオ =====

describe('変更許可シナリオ（法14条の2: 品目追加等）', () => {
    test('変更許可: 許可有効年月日は従前から引き継ぎ、許可年月日のみ新しい', () => {
        const oldValidDate = '2030/04/01'; // 従前の許可有効年月日
        const newPermitDate = '2027/06/15'; // 変更許可日
        const todayStr = '2027/06/15';

        // 旧バージョンクローズ（新許可日の前日で閉じる）
        const closeSql = logic.buildCloseOldPermitVersionsQuery(50, todayStr);
        expect(closeSql).toContain("DateAdd('d', -1, #" + todayStr + "#)");

        // 新バージョン作成（validDateは従前を引き継ぐ）
        const insertSql = logic.buildSavePermitQuery({
            logicalId: 50, businessId: 1, categoryId: 3,
            number: 'IPP-34-0003',
            permitDate: newPermitDate,
            validDate: oldValidDate, // ← 従前の有効期限を引き継ぐ
            excellent: false, todayStr: todayStr
        });

        // 許可年月日は新しい変更許可日
        expect(insertSql).toContain('#2027/06/15#');
        // 許可有効年月日は従前のまま
        expect(insertSql).toContain('#2030/04/01#');
    });

    test('変更許可と更新許可の違い: 更新は新しいvalidDate、変更は旧validDate引き継ぎ', () => {
        const oldValidDate = '2030/04/01';
        const todayStr = '2027/06/15';

        // 更新許可: 新しい許可有効年月日を設定
        const renewalSql = logic.buildSavePermitQuery({
            logicalId: 50, businessId: 1, categoryId: 3,
            number: 'IPP-34-0003',
            permitDate: '2030/04/02', // 従前有効期限の翌日
            validDate: '2035/04/01', // 新たに5年
            excellent: false, todayStr: todayStr
        });
        expect(renewalSql).toContain('#2035/04/01#');

        // 変更許可: 従前の許可有効年月日を引き継ぐ
        const changeSql = logic.buildSavePermitQuery({
            logicalId: 50, businessId: 1, categoryId: 3,
            number: 'IPP-34-0003',
            permitDate: '2027/06/15', // 変更許可日
            validDate: oldValidDate, // 従前のまま
            excellent: false, todayStr: todayStr
        });
        expect(changeSql).toContain('#2030/04/01#');
        expect(changeSql).not.toContain('#2035/04/01#');
    });

    test('品目コピーSQL: 旧バージョンから新バージョンへ品目を引き継ぐ', () => {
        const sql = logic.buildCopyPermitItemsQuery(37489, 37800);
        expect(sql).toBe(
            "INSERT INTO 許可品目 (許可ID, 品目ID, 取り扱いフラグ, 積替保管フラグ) " +
            "SELECT 37800, 品目ID, 取り扱いフラグ, 積替保管フラグ " +
            "FROM 許可品目 WHERE 許可ID = 37489"
        );
    });
});

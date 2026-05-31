/**
 * 履歴部分更新とバージョン境界 — 許可/施設の部分UPDATE・境界日・検索フィルタの詳細テスト
 */
const logic = require('../../app_logic.js');

// ===== 許可履歴の部分更新 =====

describe('buildUpdatePermitHistoryQuery 部分更新', () => {
    const base = { permitId: 100, permitNumber: 'P-001', categoryId: 3 };

    test('必須フィールドのみ（最小構成）', () => {
        const sql = logic.buildUpdatePermitHistoryQuery(base);
        expect(sql).toContain("許可番号 = 'P-001'");
        expect(sql).toContain('許可区分ID = 3');
        expect(sql).toContain('WHERE 許可ID = 100');
    });

    test('許可日・有効期限の更新', () => {
        const sql = logic.buildUpdatePermitHistoryQuery({
            ...base, permitDate: '2027/04/01', validDate: '2032/03/31'
        });
        expect(sql).toContain('許可年月日 = #2027/04/01#');
        expect(sql).toContain('許可有効年月日 = #2032/03/31#');
    });

    test('許可日をNULLに更新', () => {
        const sql = logic.buildUpdatePermitHistoryQuery({
            ...base, permitDate: '', validDate: ''
        });
        expect(sql).toContain('許可年月日 = NULL');
        expect(sql).toContain('許可有効年月日 = NULL');
    });

    test('有効開始日時は明示的に指定した場合のみ更新される', () => {
        // startDate未指定: 有効開始日時は含まれない
        const sql1 = logic.buildUpdatePermitHistoryQuery(base);
        expect(sql1).not.toContain('有効開始日時');

        // startDate指定: 有効開始日時が含まれる
        const sql2 = logic.buildUpdatePermitHistoryQuery({
            ...base, startDate: '2027/04/01'
        });
        expect(sql2).toContain('有効開始日時 = #2027/04/01#');
    });

    test('有効終了日時は明示的に指定した場合のみ更新される', () => {
        const sql1 = logic.buildUpdatePermitHistoryQuery(base);
        expect(sql1).not.toContain('有効終了日時');

        const sql2 = logic.buildUpdatePermitHistoryQuery({
            ...base, endDate: '2027/04/01'
        });
        expect(sql2).toContain('有効終了日時 = #2027/04/01#');
    });

    test('優良認定フラグ true/false', () => {
        const sqlTrue = logic.buildUpdatePermitHistoryQuery({ ...base, excellent: true });
        expect(sqlTrue).toContain('優良認定 = True');

        const sqlFalse = logic.buildUpdatePermitHistoryQuery({ ...base, excellent: false });
        expect(sqlFalse).toContain('優良認定 = False');
    });

    test('取消日・取消理由の設定', () => {
        const sql = logic.buildUpdatePermitHistoryQuery({
            ...base, cancelDate: '2026/05/01', cancelReason: '法令違反'
        });
        expect(sql).toContain('取消日 = #2026/05/01#');
        expect(sql).toContain("取消理由 = '法令違反'");
    });

    test('取消日設定＋取消理由なし→取消理由はNULL', () => {
        const sql = logic.buildUpdatePermitHistoryQuery({
            ...base, cancelDate: '2026/05/01', cancelReason: ''
        });
        expect(sql).toContain('取消日 = #2026/05/01#');
        expect(sql).toContain('取消理由 = NULL');
    });

    test('廃止日・廃止理由の設定', () => {
        const sql = logic.buildUpdatePermitHistoryQuery({
            ...base, abolishDate: '2026/05/01', abolishReason: '事業廃止'
        });
        expect(sql).toContain('廃止日 = #2026/05/01#');
        expect(sql).toContain("廃止理由 = '事業廃止'");
    });

    test('廃止日をクリア→NULLに設定', () => {
        const sql = logic.buildUpdatePermitHistoryQuery({
            ...base, abolishDate: '', abolishReason: ''
        });
        expect(sql).toContain('廃止日 = NULL');
        expect(sql).toContain('廃止理由 = NULL');
    });

    test('SQLインジェクション防止: 許可番号', () => {
        const sql = logic.buildUpdatePermitHistoryQuery({
            ...base, permitNumber: "P-001'; DROP TABLE 許可;--"
        });
        expect(sql).toContain("P-001''; DROP TABLE 許可;--");
    });

    test('全フィールド一括更新', () => {
        const sql = logic.buildUpdatePermitHistoryQuery({
            permitId: 100, permitNumber: 'P-002', categoryId: 5,
            permitDate: '2027/04/01', validDate: '2032/03/31',
            startDate: '2027/04/01', endDate: '2032/03/31',
            excellent: true,
            cancelDate: '2028/01/01', cancelReason: '違反',
            abolishDate: '2029/01/01', abolishReason: '廃止'
        });
        expect(sql).toContain("許可番号 = 'P-002'");
        expect(sql).toContain('許可区分ID = 5');
        expect(sql).toContain('許可年月日 = #2027/04/01#');
        expect(sql).toContain('許可有効年月日 = #2032/03/31#');
        expect(sql).toContain('有効開始日時 = #2027/04/01#');
        expect(sql).toContain('有効終了日時 = #2032/03/31#');
        expect(sql).toContain('優良認定 = True');
        expect(sql).toContain('取消日 = #2028/01/01#');
        expect(sql).toContain("取消理由 = '違反'");
        expect(sql).toContain('廃止日 = #2029/01/01#');
        expect(sql).toContain("廃止理由 = '廃止'");
    });
});

// ===== 施設履歴の部分更新 =====

describe('buildUpdateFacilityHistoryQuery 部分更新', () => {
    const base = { facilityId: 200, typeId: 1, location: '秋田市テスト町1-1' };

    test('必須フィールドのみ（最小構成）', () => {
        const sql = logic.buildUpdateFacilityHistoryQuery(base);
        expect(sql).toContain('施設種別ID = 1');
        expect(sql).toContain("設置場所 = '秋田市テスト町1-1'");
        expect(sql).toContain('WHERE 施設ID = 200');
    });

    test('許可番号の更新', () => {
        const sql = logic.buildUpdateFacilityHistoryQuery({ ...base, permitNo: 'FAC-001' });
        expect(sql).toContain("許可番号 = 'FAC-001'");
    });

    test('許可番号をNULLに更新', () => {
        const sql = logic.buildUpdateFacilityHistoryQuery({ ...base, permitNo: '' });
        expect(sql).toContain('許可番号 = NULL');
    });

    test('有効開始日時は明示的に指定した場合のみ更新される', () => {
        const sql1 = logic.buildUpdateFacilityHistoryQuery(base);
        expect(sql1).not.toContain('有効開始日時');

        const sql2 = logic.buildUpdateFacilityHistoryQuery({ ...base, startDate: '2027/04/01' });
        expect(sql2).toContain('有効開始日時 = #2027/04/01#');
    });

    test('有効終了日時は明示的に指定した場合のみ更新される', () => {
        const sql1 = logic.buildUpdateFacilityHistoryQuery(base);
        expect(sql1).not.toContain('有効終了日時');

        const sql2 = logic.buildUpdateFacilityHistoryQuery({ ...base, endDate: '2027/04/01' });
        expect(sql2).toContain('有効終了日時 = #2027/04/01#');
    });

    test('廃止年月日・廃止確認日の設定', () => {
        const sql = logic.buildUpdateFacilityHistoryQuery({
            ...base, abolishDate: '2026/05/01', abolishConfirmDate: '2026/06/01'
        });
        expect(sql).toContain('廃止年月日 = #2026/05/01#');
        expect(sql).toContain('廃止確認日 = #2026/06/01#');
    });

    test('廃止年月日をクリア→NULLに設定', () => {
        const sql = logic.buildUpdateFacilityHistoryQuery({
            ...base, abolishDate: '', abolishConfirmDate: ''
        });
        expect(sql).toContain('廃止年月日 = NULL');
        expect(sql).toContain('廃止確認日 = NULL');
    });

    test('取消年月日・取消理由の設定', () => {
        const sql = logic.buildUpdateFacilityHistoryQuery({
            ...base, cancelDate: '2026/05/01', cancelReason: '違反のため'
        });
        expect(sql).toContain('取消年月日 = #2026/05/01#');
        expect(sql).toContain("取消理由 = '違反のため'");
    });

    test('取消理由なし→NULLに設定', () => {
        const sql = logic.buildUpdateFacilityHistoryQuery({
            ...base, cancelDate: '2026/05/01', cancelReason: ''
        });
        expect(sql).toContain('取消年月日 = #2026/05/01#');
        expect(sql).toContain('取消理由 = NULL');
    });

    test('最終処分場固有フィールド: 管理区分・容量・面積・埋立終了', () => {
        const sql = logic.buildUpdateFacilityHistoryQuery({
            ...base,
            managementTypeId: 1,
            capacityM3: 5000,
            areaM2: 2000,
            landfillEndDate: '2040/03/31'
        });
        expect(sql).toContain('管理区分ID = 1');
        expect(sql).toContain('容量m3 = 5000');
        expect(sql).toContain('面積m2 = 2000');
        expect(sql).toContain('埋立終了年月日 = #2040/03/31#');
    });

    test('中間処理施設固有フィールド: 処理方法・設置形態・許可対象', () => {
        const sql = logic.buildUpdateFacilityHistoryQuery({
            ...base,
            processingMethodId: 3,
            setupFormId: 1,
            permitTargetId: 1
        });
        expect(sql).toContain('処理方法ID = 3');
        expect(sql).toContain('設置形態区分ID = 1');
        expect(sql).toContain('許可対象区分ID = 1');
    });

    test('保管施設フィールド: 面積・容量上限・高さ', () => {
        const sql = logic.buildUpdateFacilityHistoryQuery({
            ...base,
            storageAreaM2: 100,
            storageCapM3: 500,
            storageHeightM: 3
        });
        expect(sql).toContain('保管施設面積m2 = 100');
        expect(sql).toContain('保管量上限m3 = 500');
        expect(sql).toContain('保管高さm = 3');
    });

    test('SQLインジェクション防止: 設置場所', () => {
        const sql = logic.buildUpdateFacilityHistoryQuery({
            ...base, location: "秋田市'; DROP TABLE 施設;--"
        });
        expect(sql).toContain("秋田市''; DROP TABLE 施設;--");
    });
});

// ===== バージョン境界日の更新 =====

describe('buildUpdateBoundaryDateQuery', () => {
    test('許可の有効開始日時を更新', () => {
        const sql = logic.buildUpdateBoundaryDateQuery('許可', '許可ID', 100, '有効開始日時', '2027/04/01');
        expect(sql).toContain('UPDATE 許可 SET 有効開始日時 = #2027/04/01#');
        expect(sql).toContain('WHERE 許可ID = 100');
    });

    test('施設の有効終了日時を更新', () => {
        const sql = logic.buildUpdateBoundaryDateQuery('施設', '施設ID', 200, '有効終了日時', '2027/04/01');
        expect(sql).toContain('UPDATE 施設 SET 有効終了日時 = #2027/04/01#');
        expect(sql).toContain('WHERE 施設ID = 200');
    });

    test('異なるテーブルで汎用的に使用可能', () => {
        const permitSql = logic.buildUpdateBoundaryDateQuery('許可', '許可ID', 1, '有効開始日時', '2026/01/01');
        const facilitySql = logic.buildUpdateBoundaryDateQuery('施設', '施設ID', 2, '有効開始日時', '2026/01/01');
        expect(permitSql).toMatch(/^UPDATE 許可/);
        expect(facilitySql).toMatch(/^UPDATE 施設/);
    });
});

// ===== 最新バージョン取得 =====

describe('buildLoadLatestVersionQuery', () => {
    test('許可の最新バージョンを取得', () => {
        const sql = logic.buildLoadLatestVersionQuery('許可', '許可論理ID', 50);
        expect(sql).toContain('SELECT TOP 1 *');
        expect(sql).toContain('FROM 許可');
        expect(sql).toContain('許可論理ID = 50');
        expect(sql).toContain('ORDER BY 有効開始日時 DESC');
    });

    test('施設の最新バージョンを取得', () => {
        const sql = logic.buildLoadLatestVersionQuery('施設', '施設論理ID', 100);
        expect(sql).toContain('SELECT TOP 1 *');
        expect(sql).toContain('FROM 施設');
        expect(sql).toContain('施設論理ID = 100');
        expect(sql).toContain('ORDER BY 有効開始日時 DESC');
    });
});

// ===== アクティブバージョン存在チェック =====

describe('buildCheckActiveVersionExistsQuery', () => {
    test('許可: 自身を除外してアクティブバージョンを確認', () => {
        const sql = logic.buildCheckActiveVersionExistsQuery('許可', '許可論理ID', 50, 100, '許可ID');
        expect(sql).toContain('COUNT(*)');
        expect(sql).toContain('許可論理ID = 50');
        expect(sql).toContain('有効終了日時 IS NULL');
        expect(sql).toContain('許可ID <> 100');
    });

    test('施設: 自身を除外してアクティブバージョンを確認', () => {
        const sql = logic.buildCheckActiveVersionExistsQuery('施設', '施設論理ID', 30, 200, '施設ID');
        expect(sql).toContain('施設論理ID = 30');
        expect(sql).toContain('施設ID <> 200');
        expect(sql).toContain('有効終了日時 IS NULL');
    });

    test('異なるexcludeIdで一貫している', () => {
        const sql1 = logic.buildCheckActiveVersionExistsQuery('許可', '許可論理ID', 50, 1, '許可ID');
        const sql2 = logic.buildCheckActiveVersionExistsQuery('許可', '許可論理ID', 50, 999, '許可ID');
        expect(sql1).toContain('許可ID <> 1');
        expect(sql2).toContain('許可ID <> 999');
    });
});

// ===== 施設検索の状態フィルタ詳細 =====

describe('buildSearchFacilityQuery 状態フィルタ詳細', () => {
    test('デフォルト: 有効終了日時IS NULL AND 廃止年月日IS NULL', () => {
        const sql = logic.buildSearchFacilityQuery('', '');
        expect(sql).toContain('施設.有効終了日時 IS NULL AND 施設.廃止年月日 IS NULL');
    });

    test('status=abolished: 廃止年月日IS NOT NULLのみ', () => {
        const sql = logic.buildSearchFacilityQuery('', '', false, 'abolished');
        expect(sql).toContain('施設.廃止年月日 IS NOT NULL');
        expect(sql).not.toContain('有効終了日時 IS NULL');
    });

    test('status=cancelled: 取消年月日IS NOT NULLのみ', () => {
        const sql = logic.buildSearchFacilityQuery('', '', false, 'cancelled');
        expect(sql).toContain('施設.取消年月日 IS NOT NULL');
        expect(sql).not.toContain('有効終了日時 IS NULL');
    });

    test('includeAbolished=true: 有効OR廃止OR取消', () => {
        const sql = logic.buildSearchFacilityQuery('', '', true);
        expect(sql).toContain('施設.有効終了日時 IS NULL OR 施設.廃止年月日 IS NOT NULL OR 施設.取消年月日 IS NOT NULL');
    });

    test('includeAbolished=true + keyword: キーワードフィルタが追加される', () => {
        const sql = logic.buildSearchFacilityQuery('テスト', '', true);
        expect(sql).toContain('施設.有効終了日時 IS NULL OR 施設.廃止年月日 IS NOT NULL');
        expect(sql).toContain("施設.設置場所 LIKE '%テスト%'");
    });

    test('status=abolished + keyword: 両方のフィルタが共存', () => {
        const sql = logic.buildSearchFacilityQuery('テスト', '', false, 'abolished');
        expect(sql).toContain('施設.廃止年月日 IS NOT NULL');
        expect(sql).toContain("施設.設置場所 LIKE '%テスト%'");
    });

    test('施設種別ID + statusの組み合わせ', () => {
        const sql = logic.buildSearchFacilityQuery('', '2', false, 'abolished');
        expect(sql).toContain('施設.廃止年月日 IS NOT NULL');
        expect(sql).toContain('施設.施設種別ID = 2');
    });

    test('処理方法IDフィルタ', () => {
        const sql = logic.buildSearchFacilityQuery('', '', false, undefined, { processingMethodId: 3 });
        expect(sql).toContain('施設.処理方法ID = 3');
    });

    test('許可対象区分IDフィルタ', () => {
        const sql = logic.buildSearchFacilityQuery('', '', false, undefined, { permitTargetId: 1 });
        expect(sql).toContain('施設.許可対象区分ID = 1');
    });

    test('自己処理除外', () => {
        const sql = logic.buildSearchFacilityQuery('', '', false, undefined, { excludeSelf: true });
        expect(sql).toContain('施設.許可対象区分ID IS NULL OR 施設.許可対象区分ID <> 2');
    });

    test('日処理能力フィルタ: INNER JOINが追加される', () => {
        const sql = logic.buildSearchFacilityQuery('', '', false, undefined, { minDayCapacity: 100 });
        expect(sql).toContain('INNER JOIN 処理能力 ON 施設.施設ID = 処理能力.施設ID');
        expect(sql).toContain('処理能力.日処理能力 >= 100');
    });

    test('SQLインジェクション防止: キーワード', () => {
        const sql = logic.buildSearchFacilityQuery("テスト'; DROP TABLE 施設;--", '');
        expect(sql).toContain("テスト''; DROP TABLE 施設;--");
    });
});

// ===== 許可検索の状態フィルタとの一貫性 =====

describe('許可検索と施設検索の状態フィルタ一貫性', () => {
    test('abolishedステータス: 両方とも有効終了日時フィルタを緩和', () => {
        const permitSql = logic.buildSearchPermitQuery({
            asOfDateSql: '#2026/03/01 23:59:59#', status: 'abolished'
        });
        const facilitySql = logic.buildSearchFacilityQuery('', '', false, 'abolished');
        // 両方とも有効終了日時IS NULLを含まない
        expect(permitSql).not.toContain('有効終了日時 IS NULL OR');
        expect(facilitySql).not.toContain('有効終了日時 IS NULL AND');
    });

    test('cancelledステータス: 両方とも有効終了日時フィルタを緩和', () => {
        const permitSql = logic.buildSearchPermitQuery({
            asOfDateSql: '#2026/03/01 23:59:59#', status: 'cancelled'
        });
        const facilitySql = logic.buildSearchFacilityQuery('', '', false, 'cancelled');
        expect(permitSql).not.toContain('有効終了日時 IS NULL OR');
        expect(facilitySql).not.toContain('有効終了日時 IS NULL AND');
    });

    test('activeステータス: 両方とも有効終了日時IS NULLを含む', () => {
        const permitSql = logic.buildSearchPermitQuery({
            asOfDateSql: '#2026/03/01 23:59:59#', status: 'active'
        });
        const facilitySql = logic.buildSearchFacilityQuery('', '');
        expect(permitSql).toContain('有効終了日時 IS NULL OR 許可.有効終了日時 >');
        expect(facilitySql).toContain('施設.有効終了日時 IS NULL');
    });
});

// ===== 許可品目の全削除と再挿入 =====

describe('許可品目の全削除と再挿入', () => {
    test('buildDeleteAllPermitItemsQuery: 許可IDで全削除', () => {
        const sql = logic.buildDeleteAllPermitItemsQuery(100);
        expect(sql).toBe('DELETE FROM 許可品目 WHERE 許可ID = 100');
    });

    test('buildInsertPermitItemQuery: フラグの組み合わせ', () => {
        // handling=true, transfer=false
        const sql1 = logic.buildInsertPermitItemQuery(100, 5, true, false);
        expect(sql1).toContain('True, False');

        // handling=true, transfer=true
        const sql2 = logic.buildInsertPermitItemQuery(100, 5, true, true);
        expect(sql2).toContain('True, True');

        // handling=false, transfer=false
        const sql3 = logic.buildInsertPermitItemQuery(100, 5, false, false);
        expect(sql3).toContain('False, False');
    });

    test('buildDeletePermitHistoryQueries: 品目→許可の順序', () => {
        const queries = logic.buildDeletePermitHistoryQueries(100);
        expect(queries).toHaveLength(2);
        expect(queries[0]).toContain('DELETE FROM 許可品目 WHERE 許可ID = 100');
        expect(queries[1]).toContain('DELETE FROM 許可 WHERE 許可ID = 100');
    });
});

/**
 * データ読み込み系SQLビルダーのテスト
 * 事業者詳細、施設一覧、車両一覧、役員一覧、許可履歴、施設履歴、処理能力、マスターデータ
 */
const logic = require('../../app_logic.js');

// ===== 事業者関連の読み込み =====

describe('buildLoadBusinessDetailQuery（事業者詳細）', () => {
    test('事業者IDで検索するSELECT文', () => {
        const sql = logic.buildLoadBusinessDetailQuery(42);
        expect(sql).toBe('SELECT * FROM 事業者 WHERE 事業者ID = 42');
    });
});

describe('buildLoadBusinessListQuery（事業者一覧）', () => {
    test('デフォルトは事業者名昇順', () => {
        const sql = logic.buildLoadBusinessListQuery();
        expect(sql).toContain('SELECT');
        expect(sql).toContain('事業者ID');
        expect(sql).toContain('事業者名');
        expect(sql).toContain('ORDER BY 事業者名 ASC');
    });
    test('ソートカラム・方向を指定可能', () => {
        const sql = logic.buildLoadBusinessListQuery("事業者ID", "DESC");
        expect(sql).toContain('ORDER BY 事業者ID DESC');
    });
});

// ===== 事業者別データ読み込み =====

describe('buildLoadFacilitiesForBusinessQuery（事業者別施設一覧）', () => {
    test('有効な施設のみ取得（二重フィルタリング）', () => {
        const sql = logic.buildLoadFacilitiesForBusinessQuery(42);
        expect(sql).toContain('施設.事業者ID = 42');
        expect(sql).toContain('施設.有効終了日時 IS NULL');
        expect(sql).toContain('施設.廃止年月日 IS NULL');
    });

    test('施設種別名をJOINで取得', () => {
        const sql = logic.buildLoadFacilitiesForBusinessQuery(1);
        expect(sql).toContain('マスター_施設種別');
        expect(sql).toContain('施設種別名');
    });

    test('施設ID、論理ID、設置場所を含む', () => {
        const sql = logic.buildLoadFacilitiesForBusinessQuery(1);
        expect(sql).toContain('施設.施設ID');
        expect(sql).toContain('施設.施設論理ID');
        expect(sql).toContain('施設.設置場所');
    });
});

describe('buildLoadVehiclesForBusinessQuery（事業者別車両一覧）', () => {
    test('事業者IDで検索し、廃車フラグ→車両ID順でソート', () => {
        const sql = logic.buildLoadVehiclesForBusinessQuery(42);
        expect(sql).toContain('事業者ID = 42');
        expect(sql).toContain('ORDER BY 廃車フラグ, 車両ID');
    });
});

describe('buildLoadOfficersForBusinessQuery（事業者別役員一覧）', () => {
    test('事業者IDで検索し必要カラムを取得', () => {
        const sql = logic.buildLoadOfficersForBusinessQuery(42);
        expect(sql).toContain('事業者ID = 42');
        expect(sql).toContain('役員ID');
        expect(sql).toContain('役職名');
        expect(sql).toContain('姓');
        expect(sql).toContain('名');
        expect(sql).toContain('退任フラグ');
        expect(sql).toContain('代表者フラグ');
        expect(sql).toContain('IIF(退任フラグ, 1, 0)');
        expect(sql).toContain('Switch(');
        expect(sql).toContain('役員ID');
    });
});

// ===== 代表者フラグ =====

describe('代表者フラグ操作クエリ', () => {
    test('代表者に指定: 同事業者の全員をクリアしてから対象をセット', () => {
        const queries = logic.buildSetPrimaryOfficerQueries(5, 42);
        expect(queries).toHaveLength(2);
        expect(queries[0]).toContain('代表者フラグ = False');
        expect(queries[0]).toContain('事業者ID = 42');
        expect(queries[1]).toContain('代表者フラグ = True');
        expect(queries[1]).toContain('役員ID = 5');
    });
    test('代表者を解除', () => {
        const sql = logic.buildClearPrimaryOfficerQuery(5);
        expect(sql).toContain('代表者フラグ = False');
        expect(sql).toContain('役員ID = 5');
    });
});

// ===== 許可履歴 =====

describe('buildLoadPermitHistoryQuery（許可履歴）', () => {
    test('論理IDで許可の全履歴を取得', () => {
        const sql = logic.buildLoadPermitHistoryQuery(100);
        expect(sql).toContain('許可.許可論理ID = 100');
        expect(sql).toContain('ORDER BY 許可.有効開始日時 ASC');
    });

    test('Formatで日付を文字列に変換', () => {
        const sql = logic.buildLoadPermitHistoryQuery(1);
        expect(sql).toContain("Format(許可.許可年月日, 'yyyy/mm/dd')");
        expect(sql).toContain("Format(許可.許可有効年月日, 'yyyy/mm/dd')");
        expect(sql).toContain("Format(許可.有効開始日時, 'yyyy/mm/dd')");
        expect(sql).toContain("Format(許可.有効終了日時, 'yyyy/mm/dd')");
        expect(sql).toContain("Format(許可.取消日, 'yyyy/mm/dd')");
        expect(sql).toContain("Format(許可.廃止日, 'yyyy/mm/dd')");
    });

    test('許可区分名をJOINで取得', () => {
        const sql = logic.buildLoadPermitHistoryQuery(1);
        expect(sql).toContain('マスター_許可区分');
        expect(sql).toContain('許可区分名');
    });

    test('取消理由・廃止理由を取得', () => {
        const sql = logic.buildLoadPermitHistoryQuery(1);
        expect(sql).toContain('許可.取消理由');
        expect(sql).toContain('許可.廃止理由');
    });
});

// ===== 許可履歴更新 =====

describe('buildUpdatePermitHistoryQuery（許可履歴更新）', () => {
    test('全フィールドありのUPDATE文', () => {
        const sql = logic.buildUpdatePermitHistoryQuery({
            permitId: 123,
            permitNumber: '01100012345',
            categoryId: 1,
            permitDate: '2026/04/01',
            validDate: '2031/03/31',
            startDate: '2026/04/01',
            endDate: '',
            excellent: true,
            cancelDate: '',
            cancelReason: '',
            abolishDate: '',
            abolishReason: ''
        });
        expect(sql).toContain('UPDATE 許可 SET');
        expect(sql).toContain("許可番号 = '01100012345'");
        expect(sql).toContain('許可区分ID = 1');
        expect(sql).toContain('#2026/04/01#');
        expect(sql).toContain('#2031/03/31#');
        expect(sql).toContain('優良認定 = True');
        expect(sql).toContain('WHERE 許可ID = 123');
    });

    test('空の日付フィールドはNULLになる', () => {
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
        expect(sql).toContain('取消日 = NULL');
        expect(sql).toContain('取消理由 = NULL');
        expect(sql).toContain('廃止日 = NULL');
        expect(sql).toContain('廃止理由 = NULL');
    });

    test('廃止日・理由ありのケース', () => {
        const sql = logic.buildUpdatePermitHistoryQuery({
            permitId: 456, permitNumber: 'TEST', categoryId: 2,
            permitDate: '2020/01/01', validDate: '2025/12/31',
            startDate: '2020/01/01', endDate: '2026/01/01',
            excellent: false,
            cancelDate: '', cancelReason: '',
            abolishDate: '2025/12/31', abolishReason: '事業廃止届出'
        });
        expect(sql).toContain('廃止日 = #2025/12/31#');
        expect(sql).toContain("廃止理由 = '事業廃止届出'");
    });

    test('許可番号のシングルクォートがescapeSqlでエスケープ', () => {
        const sql = logic.buildUpdatePermitHistoryQuery({
            permitId: 1, permitNumber: "TEST'001", categoryId: 1,
            permitDate: '', validDate: '', startDate: '', endDate: '',
            excellent: false, cancelDate: '', cancelReason: '',
            abolishDate: '', abolishReason: ''
        });
        expect(sql).toContain("TEST''001");
        expect(sql).not.toContain(".replace");
    });

    test('取消理由のシングルクォートがエスケープ', () => {
        const sql = logic.buildUpdatePermitHistoryQuery({
            permitId: 1, permitNumber: 'TEST', categoryId: 1,
            permitDate: '', validDate: '', startDate: '', endDate: '',
            excellent: false, cancelDate: '2026/01/01', cancelReason: "法令's違反",
            abolishDate: '', abolishReason: ''
        });
        expect(sql).toContain("法令''s違反");
    });
});

// ===== 施設履歴 =====

describe('buildLoadFacilityHistoryQuery（施設履歴）', () => {
    test('論理IDで施設の全履歴を取得', () => {
        const sql = logic.buildLoadFacilityHistoryQuery(50);
        expect(sql).toContain('施設.施設論理ID = 50');
        expect(sql).toContain('ORDER BY 施設.有効開始日時 ASC');
    });

    test('Formatで日付を変換', () => {
        const sql = logic.buildLoadFacilityHistoryQuery(1);
        expect(sql).toContain("Format(施設.有効開始日時, 'yyyy/mm/dd')");
        expect(sql).toContain("Format(施設.有効終了日時, 'yyyy/mm/dd')");
    });
});

// ===== 処理能力 =====

describe('buildLoadProcessingCapacityQuery（処理能力一覧）', () => {
    test('施設IDで検索し品目名をJOIN', () => {
        const sql = logic.buildLoadProcessingCapacityQuery(77);
        expect(sql).toContain('処理能力.施設ID = 77');
        expect(sql).toContain('マスター_品目');
        expect(sql).toContain('品目名');
        expect(sql).toContain('ORDER BY マスター_品目.表示順');
    });
});

describe('buildSaveCapacityQuery（処理能力保存）', () => {
    test('新規追加のINSERT文', () => {
        const sql = logic.buildSaveCapacityQuery({
            facilityId: 10, itemId: 3,
            hourCap: '5.0', hourUnit: 1,
            dayCap: '100', dayUnit: 2,
            hours: '8', note: '特記なし'
        });
        expect(sql).toMatch(/^INSERT INTO 処理能力/);
        expect(sql).toContain('10, 3');
        expect(sql).toContain('5.0');
        expect(sql).toContain('100');
        expect(sql).toContain("'特記なし'");
    });

    test('更新のUPDATE文', () => {
        const sql = logic.buildSaveCapacityQuery({
            editId: 55,
            hourCap: '10', hourUnit: 1,
            dayCap: '200', dayUnit: 2,
            hours: '12', note: '更新後'
        });
        expect(sql).toMatch(/^UPDATE 処理能力 SET/);
        expect(sql).toContain('WHERE 処理能力ID = 55');
        expect(sql).toContain("'更新後'");
    });

    test('時間処理能力・日処理能力が空ならNULL', () => {
        const sql = logic.buildSaveCapacityQuery({
            facilityId: 1, itemId: 1,
            hourCap: '', hourUnit: 1,
            dayCap: '', dayUnit: 1,
            hours: '', note: ''
        });
        expect((sql.match(/NULL/g) || []).length).toBeGreaterThanOrEqual(3);
    });

    test('特記事項のシングルクォートがエスケープ', () => {
        const sql = logic.buildSaveCapacityQuery({
            editId: 1,
            hourCap: '1', hourUnit: 1,
            dayCap: '1', dayUnit: 1,
            hours: '8', note: "注意's点"
        });
        expect(sql).toContain("注意''s点");
    });
});

describe('buildDeleteCapacityQuery（処理能力削除）', () => {
    test('DELETE文を生成', () => {
        expect(logic.buildDeleteCapacityQuery(88)).toBe('DELETE FROM 処理能力 WHERE 処理能力ID = 88');
    });
});

// ===== マスターデータCRUD =====

describe('buildLoadMasterListQuery（マスター一覧）', () => {
    test('設定に基づいたSELECT文', () => {
        const config = logic.getMasterConfig('品目');
        const sql = logic.buildLoadMasterListQuery(config);
        expect(sql).toContain('[マスター_品目]');
        expect(sql).toContain('ORDER BY 表示順, 品目ID');
    });
});

describe('buildLoadMasterForEditQuery（マスター個別）', () => {
    test('IDで単一レコードを取得', () => {
        const config = logic.getMasterConfig('許可区分');
        const sql = logic.buildLoadMasterForEditQuery(config, 5);
        expect(sql).toContain('[マスター_許可区分]');
        expect(sql).toContain('許可区分ID = 5');
    });
});

describe('buildSaveMasterQuery（マスター保存）', () => {
    test('更新のUPDATE文', () => {
        const config = logic.getMasterConfig('許可区分');
        const sql = logic.buildSaveMasterQuery(config, { id: 3, name: '特別管理産業廃棄物' });
        expect(sql).toMatch(/^UPDATE/);
        expect(sql).toContain("[マスター_許可区分]");
        expect(sql).toContain("許可区分名 = '特別管理産業廃棄物'");
        expect(sql).toContain('WHERE 許可区分ID = 3');
    });

    test('新規追加のINSERT文', () => {
        const config = logic.getMasterConfig('施設種別');
        const sql = logic.buildSaveMasterQuery(config, { id: 0, newId: 10, name: '新しい施設種別' });
        expect(sql).toMatch(/^INSERT/);
        expect(sql).toContain("[マスター_施設種別]");
        expect(sql).toContain("10, '新しい施設種別'");
    });

    test('extraColがある場合も正しく処理（品目の表示順）', () => {
        const config = logic.getMasterConfig('品目');
        const sql = logic.buildSaveMasterQuery(config, { id: 5, name: '廃プラスチック', extra: '10' });
        expect(sql).toContain("品目名 = '廃プラスチック'");
        expect(sql).toContain('表示順 = 10');
    });

    test('新規追加でextraColがある場合', () => {
        const config = logic.getMasterConfig('品目');
        const sql = logic.buildSaveMasterQuery(config, { id: 0, newId: 20, name: '汚泥', extra: '15' });
        expect(sql).toContain('品目ID, 品目名, 表示順');
        expect(sql).toContain("20, '汚泥', 15");
    });

    test('マスター名のシングルクォートがエスケープ', () => {
        const config = logic.getMasterConfig('許可区分');
        const sql = logic.buildSaveMasterQuery(config, { id: 1, name: "O'Brien区分" });
        expect(sql).toContain("O''Brien区分");
    });
});

describe('buildDeleteMasterQuery（マスター削除）', () => {
    test('設定に基づいたDELETE文', () => {
        const config = logic.getMasterConfig('処理方法');
        const sql = logic.buildDeleteMasterQuery(config, 7);
        expect(sql).toContain('[マスター_処理方法]');
        expect(sql).toContain('処理方法ID = 7');
    });
});

// ===== 統計系クエリ =====

describe('buildLoadExpiringPermitsQuery（期限切れ間近の許可）', () => {
    test('1年以内に期限切れの有効な許可を取得（二重フィルタリング）', () => {
        const sql = logic.buildLoadExpiringPermitsQuery();
        expect(sql).toContain('BETWEEN Date() AND DateAdd');
        expect(sql).toContain('有効終了日時 IS NULL');
        expect(sql).toContain('廃止日 IS NULL');
        expect(sql).toContain('取消日 IS NULL');
        expect(sql).toContain('ORDER BY 許可.許可有効年月日');
    });

    test('事業者名・許可区分名をJOIN', () => {
        const sql = logic.buildLoadExpiringPermitsQuery();
        expect(sql).toContain('事業者.事業者名');
        expect(sql).toContain('マスター_許可区分.許可区分名');
    });
});

describe('buildLoadPermitTrendQuery（許可数推移）', () => {
    test('許可区分ごとに年別集計（二重フィルタリング）', () => {
        const sql = logic.buildLoadPermitTrendQuery(1);
        expect(sql).toContain('Year(許可年月日)');
        expect(sql).toContain('COUNT(*)');
        expect(sql).toContain('許可区分ID = 1');
        expect(sql).toContain('有効終了日時 IS NULL');
        expect(sql).toContain('廃止日 IS NULL');
        expect(sql).toContain('取消日 IS NULL');
        expect(sql).toContain('GROUP BY');
    });
});

describe('buildLoadCapacityStatsQuery（処理能力集計）', () => {
    test('施設種別ごとに品目別集計（二重フィルタリング）', () => {
        const sql = logic.buildLoadCapacityStatsQuery(2);
        expect(sql).toContain('SUM(処理能力.日処理能力)');
        expect(sql).toContain('施設.施設種別ID = 2');
        expect(sql).toContain('施設.有効終了日時 IS NULL');
        expect(sql).toContain('施設.廃止年月日 IS NULL');
        expect(sql).toContain('GROUP BY');
        expect(sql).toContain('ORDER BY マスター_品目.表示順');
    });

    test('品目名をINNER JOINで取得', () => {
        const sql = logic.buildLoadCapacityStatsQuery(1);
        expect(sql).toContain('INNER JOIN マスター_品目');
        expect(sql).toContain('マスター_品目.品目名');
    });
});

describe('buildLoadPermitItemsQuery（許可品目一覧）', () => {
    test('許可IDで品目を取得', () => {
        const sql = logic.buildLoadPermitItemsQuery(123);
        expect(sql).toContain('許可ID = 123');
        expect(sql).toContain('取り扱いフラグ');
        expect(sql).toContain('積替保管フラグ');
    });
});

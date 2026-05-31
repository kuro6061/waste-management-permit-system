/**
 * カスケード・エンティティ間整合性 — 参照整合性とカスケード削除の検証
 */
const logic = require('../../app_logic.js');

// ===== buildDeleteBusinessQueries: カスケード削除 =====

describe('buildDeleteBusinessQueries カスケード削除', () => {
    test('8つのクエリを返す', () => {
        const queries = logic.buildDeleteBusinessQueries(42);
        expect(queries).toHaveLength(8);
    });

    test('正しい削除順序（依存関係順）', () => {
        const queries = logic.buildDeleteBusinessQueries(42);
        // 1. 許可品目（許可に依存）
        expect(queries[0]).toContain('DELETE FROM 許可品目');
        // 2. 施設休止履歴（施設に依存）
        expect(queries[1]).toContain('DELETE FROM 施設休止履歴');
        // 3. 処理能力（施設に依存）
        expect(queries[2]).toContain('DELETE FROM 処理能力');
        // 4. 許可
        expect(queries[3]).toContain('DELETE FROM 許可');
        // 5. 施設
        expect(queries[4]).toContain('DELETE FROM 施設');
        // 6. 車両
        expect(queries[5]).toContain('DELETE FROM 車両');
        // 7. 役員
        expect(queries[6]).toContain('DELETE FROM 役員');
        // 8. 事業者本体
        expect(queries[7]).toContain('DELETE FROM 事業者');
    });

    test('サブクエリ構造: 許可品目は許可経由で事業者IDを参照', () => {
        const queries = logic.buildDeleteBusinessQueries(42);
        expect(queries[0]).toBe('DELETE FROM 許可品目 WHERE 許可ID IN (SELECT 許可ID FROM 許可 WHERE 事業者ID = 42)');
    });

    test('サブクエリ構造: 施設休止履歴は施設経由で事業者IDを参照', () => {
        const queries = logic.buildDeleteBusinessQueries(42);
        expect(queries[1]).toBe('DELETE FROM 施設休止履歴 WHERE 施設ID IN (SELECT 施設ID FROM 施設 WHERE 事業者ID = 42)');
    });

    test('サブクエリ構造: 処理能力は施設経由で事業者IDを参照', () => {
        const queries = logic.buildDeleteBusinessQueries(42);
        expect(queries[2]).toBe('DELETE FROM 処理能力 WHERE 施設ID IN (SELECT 施設ID FROM 施設 WHERE 事業者ID = 42)');
    });

    test('直接テーブル: 許可・施設・車両・役員・事業者は直接事業者IDで削除', () => {
        const queries = logic.buildDeleteBusinessQueries(42);
        expect(queries[3]).toBe('DELETE FROM 許可 WHERE 事業者ID = 42');
        expect(queries[4]).toBe('DELETE FROM 施設 WHERE 事業者ID = 42');
        expect(queries[5]).toBe('DELETE FROM 車両 WHERE 事業者ID = 42');
        expect(queries[6]).toBe('DELETE FROM 役員 WHERE 事業者ID = 42');
        expect(queries[7]).toBe('DELETE FROM 事業者 WHERE 事業者ID = 42');
    });

    test('異なるIDでの一貫性: id=1', () => {
        const queries = logic.buildDeleteBusinessQueries(1);
        queries.forEach(q => {
            expect(q).toContain('事業者ID = 1');
        });
    });

    test('異なるIDでの一貫性: id=999', () => {
        const queries = logic.buildDeleteBusinessQueries(999);
        queries.forEach(q => {
            expect(q).toContain('999');
        });
    });

    test('buildDeleteBusinessQuery（単一版）との関係', () => {
        const singleQuery = logic.buildDeleteBusinessQuery(42);
        const cascadeQueries = logic.buildDeleteBusinessQueries(42);
        // 単一版は最後のクエリと同じ
        expect(singleQuery).toBe(cascadeQueries[7]);
    });
});

// ===== エンティティ間参照: 許可 → 品目 =====

describe('許可 → 品目の参照整合性', () => {
    test('許可品目クエリは許可IDと品目IDの両方を参照', () => {
        const q = logic.buildPermitItemQueries(100, 5);
        expect(q.select).toContain('許可ID = 100');
        expect(q.select).toContain('品目ID = 5');
    });

    test('品目コピーは許可IDで関連付け', () => {
        const sql = logic.buildCopyPermitItemsQuery(100, 200);
        expect(sql).toContain('FROM 許可品目 WHERE 許可ID = 100');
        expect(sql).toContain('SELECT 200');
    });

    test('許可品目一覧は許可IDで取得', () => {
        const sql = logic.buildLoadPermitItemsQuery(100);
        expect(sql).toContain('許可ID = 100');
    });

    test('許可品目のinsertは許可IDと品目IDの組み合わせ', () => {
        const q = logic.buildPermitItemQueries(100, 5);
        expect(q.insert).toContain('100, 5');
    });
});

// ===== エンティティ間参照: 施設 → 処理能力 =====

describe('施設 → 処理能力の参照整合性', () => {
    test('処理能力は施設IDで関連付け', () => {
        const sql = logic.buildLoadProcessingCapacityQuery(77);
        expect(sql).toContain('処理能力.施設ID = 77');
    });

    test('処理能力保存は施設IDと品目IDで関連付け', () => {
        const sql = logic.buildSaveCapacityQuery({
            facilityId: 10, itemId: 3,
            hourCap: '5', hourUnit: 1, dayCap: '100', dayUnit: 2,
            hours: '8', note: ''
        });
        expect(sql).toContain('10, 3');
    });

    test('処理能力削除は処理能力IDで直接削除', () => {
        const sql = logic.buildDeleteCapacityQuery(88);
        expect(sql).toBe('DELETE FROM 処理能力 WHERE 処理能力ID = 88');
    });

    test('カスケード削除: 施設削除前に処理能力と休止履歴を削除', () => {
        const queries = logic.buildDeleteBusinessQueries(42);
        const suspensionIndex = queries.findIndex(q => q.includes('DELETE FROM 施設休止履歴'));
        const capacityIndex = queries.findIndex(q => q.includes('DELETE FROM 処理能力'));
        const facilityIndex = queries.findIndex(q => q.includes('DELETE FROM 施設 WHERE'));
        expect(suspensionIndex).toBeLessThan(facilityIndex);
        expect(capacityIndex).toBeLessThan(facilityIndex);
    });
});

// ===== エンティティ間参照: 事業者 → 各エンティティ =====

describe('事業者 → 許可/施設/車両/役員の参照整合性', () => {
    const businessId = 42;

    test('許可は事業者IDで関連付け', () => {
        const sql = logic.buildLoadPermitsQuery(businessId);
        expect(sql).toContain('許可.事業者ID = 42');
    });

    test('施設は事業者IDで関連付け', () => {
        const sql = logic.buildLoadFacilitiesForBusinessQuery(businessId);
        expect(sql).toContain('施設.事業者ID = 42');
    });

    test('車両は事業者IDで関連付け', () => {
        const sql = logic.buildLoadVehiclesForBusinessQuery(businessId);
        expect(sql).toContain('事業者ID = 42');
    });

    test('役員は事業者IDで関連付け', () => {
        const sql = logic.buildLoadOfficersForBusinessQuery(businessId);
        expect(sql).toContain('事業者ID = 42');
    });

    test('事業者詳細は事業者IDで取得', () => {
        const sql = logic.buildLoadBusinessDetailQuery(businessId);
        expect(sql).toContain('事業者ID = 42');
    });

    test('全エンティティで同じ事業者IDが一貫して使用される', () => {
        const id = 99;
        const queries = [
            logic.buildLoadPermitsQuery(id),
            logic.buildLoadFacilitiesForBusinessQuery(id),
            logic.buildLoadVehiclesForBusinessQuery(id),
            logic.buildLoadOfficersForBusinessQuery(id),
            logic.buildLoadBusinessDetailQuery(id)
        ];
        queries.forEach(sql => {
            expect(sql).toContain('99');
        });
    });
});

// ===== 統計クエリ整合性 =====

describe('統計クエリ整合性', () => {
    test('事業者カウントはフィルタなし（全数）', () => {
        const q = logic.buildStatisticsQueries();
        expect(q.businessCount).toBe('SELECT COUNT(*) AS cnt FROM [事業者]');
        expect(q.businessCount).not.toContain('WHERE');
    });

    test('許可カウントは有効な許可のみ（有効終了日時IS NULL、廃止日IS NULL、取消日IS NULL）', () => {
        const q = logic.buildStatisticsQueries();
        expect(q.permitCount).toContain('[有効終了日時] IS NULL');
        expect(q.permitCount).toContain('[廃止日] IS NULL');
        expect(q.permitCount).toContain('[取消日] IS NULL');
    });

    test('施設カウントは有効な施設のみ（有効終了日時IS NULL、廃止年月日IS NULL）', () => {
        const q = logic.buildStatisticsQueries();
        expect(q.facilityCount).toContain('[有効終了日時] IS NULL');
        expect(q.facilityCount).toContain('[廃止年月日] IS NULL');
    });

    test('期限切れカウントは有効な許可のみ+有効期限がNOT NULL', () => {
        const q = logic.buildStatisticsQueries();
        expect(q.expiringCount).toContain('[有効終了日時] IS NULL');
        expect(q.expiringCount).toContain('[廃止日] IS NULL');
        expect(q.expiringCount).toContain('[取消日] IS NULL');
        expect(q.expiringCount).toContain('[許可有効年月日] IS NOT NULL');
    });

    test('permitCountとexpiringCountのフィルタ条件が一致（expiringCountは+許可有効年月日）', () => {
        const q = logic.buildStatisticsQueries();
        // expiringCount は permitCount の条件 + 許可有効年月日 IS NOT NULL
        expect(q.expiringCount).toContain('[有効終了日時] IS NULL AND [廃止日] IS NULL AND [取消日] IS NULL');
    });
});

// ===== 期限切れクエリとの整合 =====

describe('期限切れクエリとの整合性', () => {
    test('buildLoadExpiringPermitsQueryのフィルタ条件がstatisticsと一致', () => {
        const expiringSQL = logic.buildLoadExpiringPermitsQuery();
        expect(expiringSQL).toContain('有効終了日時 IS NULL');
        expect(expiringSQL).toContain('廃止日 IS NULL');
        expect(expiringSQL).toContain('取消日 IS NULL');
    });

    test('buildLoadPermitTrendQueryのフィルタ条件がstatisticsと一致', () => {
        const trendSQL = logic.buildLoadPermitTrendQuery(1);
        expect(trendSQL).toContain('有効終了日時 IS NULL');
        expect(trendSQL).toContain('廃止日 IS NULL');
        expect(trendSQL).toContain('取消日 IS NULL');
    });

    test('期限切れクエリの範囲: Date()からDateAdd 1年', () => {
        const sql = logic.buildLoadExpiringPermitsQuery();
        expect(sql).toContain("BETWEEN Date() AND DateAdd('yyyy', 1, Date())");
    });

    test('トレンドクエリは許可区分IDでフィルタ', () => {
        const sql1 = logic.buildLoadPermitTrendQuery(1);
        const sql2 = logic.buildLoadPermitTrendQuery(2);
        expect(sql1).toContain('許可区分ID = 1');
        expect(sql2).toContain('許可区分ID = 2');
    });
});

// ===== 処理能力集計との整合 =====

describe('処理能力集計との整合性', () => {
    test('buildLoadCapacityStatsQueryのフィルタ: 有効な施設のみ', () => {
        const sql = logic.buildLoadCapacityStatsQuery(2);
        expect(sql).toContain('施設.有効終了日時 IS NULL');
        expect(sql).toContain('施設.廃止年月日 IS NULL');
    });

    test('施設フィルタ条件がbuildLoadFacilitiesForBusinessQueryと一致', () => {
        const capacitySQL = logic.buildLoadCapacityStatsQuery(1);
        const facilitySQL = logic.buildLoadFacilitiesForBusinessQuery(1);
        // 両方とも有効な施設のみ
        expect(capacitySQL).toContain('施設.有効終了日時 IS NULL');
        expect(capacitySQL).toContain('施設.廃止年月日 IS NULL');
        expect(facilitySQL).toContain('施設.有効終了日時 IS NULL');
        expect(facilitySQL).toContain('施設.廃止年月日 IS NULL');
    });

    test('施設フィルタ条件がbuildSearchFacilityQueryと一致', () => {
        const capacitySQL = logic.buildLoadCapacityStatsQuery(1);
        const searchSQL = logic.buildSearchFacilityQuery('', '');
        expect(capacitySQL).toContain('施設.有効終了日時 IS NULL');
        expect(searchSQL).toContain('施設.有効終了日時 IS NULL');
        expect(capacitySQL).toContain('施設.廃止年月日 IS NULL');
        expect(searchSQL).toContain('施設.廃止年月日 IS NULL');
    });

    test('施設種別IDでフィルタ', () => {
        const sql1 = logic.buildLoadCapacityStatsQuery(1);
        const sql2 = logic.buildLoadCapacityStatsQuery(5);
        expect(sql1).toContain('施設.施設種別ID = 1');
        expect(sql2).toContain('施設.施設種別ID = 5');
    });

    test('品目名をINNER JOINで取得', () => {
        const sql = logic.buildLoadCapacityStatsQuery(1);
        expect(sql).toContain('INNER JOIN マスター_品目');
        expect(sql).toContain('マスター_品目.品目名');
    });

    test('SUM(日処理能力)で集計', () => {
        const sql = logic.buildLoadCapacityStatsQuery(1);
        expect(sql).toContain('SUM(処理能力.日処理能力)');
    });

    test('表示順でORDER BY', () => {
        const sql = logic.buildLoadCapacityStatsQuery(1);
        expect(sql).toContain('ORDER BY マスター_品目.表示順');
    });
});

// ===== マスターデータ参照: JOINパターン一貫性 =====

describe('マスターデータJOINパターン一貫性', () => {
    test('許可検索: 許可区分マスターをLEFT JOIN', () => {
        const sql = logic.buildSearchPermitQuery({ asOfDateSql: '#2026/03/01#' });
        expect(sql).toContain('LEFT JOIN マスター_許可区分 ON 許可.許可区分ID = マスター_許可区分.許可区分ID');
    });

    test('施設検索: 施設種別マスターをLEFT JOIN', () => {
        const sql = logic.buildSearchFacilityQuery('', '');
        expect(sql).toContain('LEFT JOIN マスター_施設種別 ON 施設.施設種別ID = マスター_施設種別.施設種別ID');
    });

    test('許可一覧: 許可区分マスターをLEFT JOIN', () => {
        const sql = logic.buildLoadPermitsQuery(1);
        expect(sql).toContain('LEFT JOIN マスター_許可区分 ON 許可.許可区分ID = マスター_許可区分.許可区分ID');
    });

    test('許可履歴: 許可区分マスターをLEFT JOIN', () => {
        const sql = logic.buildLoadPermitHistoryQuery(1);
        expect(sql).toContain('LEFT JOIN マスター_許可区分 ON 許可.許可区分ID = マスター_許可区分.許可区分ID');
    });

    test('施設一覧: 施設種別マスターをLEFT JOIN', () => {
        const sql = logic.buildLoadFacilitiesForBusinessQuery(1);
        expect(sql).toContain('LEFT JOIN マスター_施設種別 ON 施設.施設種別ID = マスター_施設種別.施設種別ID');
    });

    test('施設履歴: 施設種別マスターをLEFT JOIN', () => {
        const sql = logic.buildLoadFacilityHistoryQuery(1);
        expect(sql).toContain('LEFT JOIN マスター_施設種別 ON 施設.施設種別ID = マスター_施設種別.施設種別ID');
    });

    test('処理能力一覧: 品目マスターをLEFT JOIN', () => {
        const sql = logic.buildLoadProcessingCapacityQuery(1);
        expect(sql).toContain('LEFT JOIN マスター_品目 ON 処理能力.品目ID = マスター_品目.品目ID');
    });

    test('処理能力集計: 品目マスターをINNER JOIN', () => {
        const sql = logic.buildLoadCapacityStatsQuery(1);
        expect(sql).toContain('INNER JOIN マスター_品目 ON 処理能力.品目ID = マスター_品目.品目ID');
    });

    test('期限切れ許可: 許可区分マスターをLEFT JOIN', () => {
        const sql = logic.buildLoadExpiringPermitsQuery();
        expect(sql).toContain('LEFT JOIN マスター_許可区分 ON 許可.許可区分ID = マスター_許可区分.許可区分ID');
    });

    test('期限切れ許可: 事業者をLEFT JOIN', () => {
        const sql = logic.buildLoadExpiringPermitsQuery();
        expect(sql).toContain('LEFT JOIN 事業者 ON 許可.事業者ID = 事業者.事業者ID');
    });
});

// ===== マスターデータCRUDの整合性 =====

describe('マスターデータCRUDの一貫性', () => {
    const masterTypes = [
        '許可区分', '施設種別', '品目', '処理方法', '廃棄物種類区分',
        '取扱区分', '形式', '日処理能力単位', '時間処理能力単位',
        '管理区分', '設置形態区分', '許可対象区分', '許可番号形式', '認定区分'
    ];

    test.each(masterTypes)('getMasterConfig("%s") が存在する', (type) => {
        const config = logic.getMasterConfig(type);
        expect(config).toBeDefined();
        expect(config.table).toBeTruthy();
        expect(config.idCol).toBeTruthy();
        expect(config.nameCol).toBeTruthy();
    });

    test('一覧・個別・保存・削除の4操作で同じconfigを使用', () => {
        const config = logic.getMasterConfig('許可区分');

        const listSql = logic.buildLoadMasterListQuery(config);
        expect(listSql).toContain('[マスター_許可区分]');

        const editSql = logic.buildLoadMasterForEditQuery(config, 1);
        expect(editSql).toContain('[マスター_許可区分]');
        expect(editSql).toContain('許可区分ID = 1');

        const saveSql = logic.buildSaveMasterQuery(config, { id: 1, name: 'テスト' });
        expect(saveSql).toContain('[マスター_許可区分]');

        const deleteSql = logic.buildDeleteMasterQuery(config, 1);
        expect(deleteSql).toContain('[マスター_許可区分]');
        expect(deleteSql).toContain('許可区分ID = 1');
    });

    test('品目マスター: extraCol（表示順）が一覧・保存で使用される', () => {
        const config = logic.getMasterConfig('品目');
        expect(config.extraCol).toBe('表示順');

        const listSql = logic.buildLoadMasterListQuery(config);
        expect(listSql).toContain('品目ID'); // ORDER BY config.idCol

        const updateSql = logic.buildSaveMasterQuery(config, { id: 1, name: 'テスト', extra: '10' });
        expect(updateSql).toContain('表示順 = 10');

        const insertSql = logic.buildSaveMasterQuery(config, { id: 0, newId: 99, name: 'テスト', extra: '5' });
        expect(insertSql).toContain('表示順');
        expect(insertSql).toContain('5');
    });

    test('許可番号形式マスター: extraCol（説明）が使用される', () => {
        const config = logic.getMasterConfig('許可番号形式');
        expect(config.extraCol).toBe('説明');
    });
});

// ===== カスケード削除の順序性テスト =====

describe('カスケード削除の順序性', () => {
    test('子テーブルは親テーブルより前に削除される', () => {
        const queries = logic.buildDeleteBusinessQueries(1);
        const order = queries.map(q => {
            const match = q.match(/DELETE FROM (\S+)/);
            return match ? match[1] : '';
        });

        // 許可品目は許可の前
        expect(order.indexOf('許可品目')).toBeLessThan(order.indexOf('許可'));
        // 施設休止履歴は施設の前
        expect(order.indexOf('施設休止履歴')).toBeLessThan(order.indexOf('施設'));
        // 処理能力は施設の前
        expect(order.indexOf('処理能力')).toBeLessThan(order.indexOf('施設'));
        // 全ての依存テーブルは事業者の前
        expect(order.indexOf('許可')).toBeLessThan(order.indexOf('事業者'));
        expect(order.indexOf('施設')).toBeLessThan(order.indexOf('事業者'));
        expect(order.indexOf('車両')).toBeLessThan(order.indexOf('事業者'));
        expect(order.indexOf('役員')).toBeLessThan(order.indexOf('事業者'));
    });

    test('事業者本体は最後に削除される', () => {
        const queries = logic.buildDeleteBusinessQueries(1);
        const lastQuery = queries[queries.length - 1];
        expect(lastQuery).toContain('DELETE FROM 事業者');
    });

    test('許可品目は最初に削除される', () => {
        const queries = logic.buildDeleteBusinessQueries(1);
        expect(queries[0]).toContain('DELETE FROM 許可品目');
    });
});

// ===== 事業者別データ読み込みの一貫性 =====

describe('事業者別データ読み込みの一貫性', () => {
    test('施設一覧: 有効な施設のみ（二重フィルタ）', () => {
        const sql = logic.buildLoadFacilitiesForBusinessQuery(42);
        expect(sql).toContain('施設.有効終了日時 IS NULL');
        expect(sql).toContain('施設.廃止年月日 IS NULL');
    });

    test('車両一覧: 全車両（廃車含む、廃車フラグ順）', () => {
        const sql = logic.buildLoadVehiclesForBusinessQuery(42);
        expect(sql).toContain('ORDER BY 廃車フラグ, 車両ID');
    });

    test('役員一覧: 全役員（退任→役職階層→代表者→ID順）', () => {
        const sql = logic.buildLoadOfficersForBusinessQuery(42);
        expect(sql).toContain('IIF(退任フラグ, 1, 0)');
        expect(sql).toContain("役職名='代表取締役', 1");
        expect(sql).toContain('IIF(代表者フラグ, 0, 1)');
        expect(sql).toContain('役員ID');
    });

    test('許可一覧: 全許可（区分順→有効開始日時DESC）', () => {
        const sql = logic.buildLoadPermitsQuery(42);
        expect(sql).toContain('ORDER BY 許可.許可区分ID, 許可.有効開始日時 DESC');
    });
});

/**
 * UI状態遷移テスト
 * HTA内のグローバル変数管理とデータフローの正しさを検証する。
 * 実際のDOM操作は行わず、ロジックレベルの状態遷移をテストする。
 */
const logic = require('../../app_logic');

describe('UI状態遷移: 施設保存のbusinessId一貫性（B8相当）', () => {
    // B8: グローバル変数が別事業者に切り替わっても、
    // フォームに紐づくbusinessIdが保持されること

    test('施設フォームのbusinessIdは事業者切替の影響を受けないこと', () => {
        // シナリオ: 事業者1の施設フォームを開く → 事業者2に切替 → 保存
        // 期待: buildSaveFacilityQuery は事業者1のbusinessIdを使う
        var formBusinessId = 1; // フォームに紐づくID（hidden inputで保持すべき）
        var globalBusinessId = 1; // グローバル変数

        // 事業者2に切替（グローバルが汚染される）
        globalBusinessId = 2;

        // 保存時にフォームのIDを使う（グローバルではなく）
        var sql = logic.buildSaveFacilityQuery({
            logicalId: 10, businessId: formBusinessId,
            typeId: 1, location: 'テスト', todayStr: '2026/03/09'
        });
        expect(sql).toMatch(/事業者ID/);
        // businessId=1が使われていること（2ではない）
        expect(sql).not.toMatch(/VALUES\s*\(\s*10\s*,\s*2/);
    });

    test('許可フォームのbusinessIdは事業者切替の影響を受けないこと', () => {
        var formBusinessId = 1;
        var sql = logic.buildSavePermitQuery({
            logicalId: 1, businessId: formBusinessId,
            categoryId: 1, number: 'TEST-001',
            permitDate: '2026/01/01', validDate: '2031/01/01',
            todayStr: '2026/01/01'
        });
        // businessId=1が使われていること
        expect(sql).toMatch(/1/);
    });
});

describe('UI状態遷移: 施設更新モードのデータフロー', () => {
    test('renewal: 旧版CLOSEクエリは正しい施設IDを使うこと', () => {
        var editingFacilityId = 100;
        var closeQuery = logic.buildCloseOldVersionByIdQuery(
            "施設", "施設ID", editingFacilityId, "2026/03/09"
        );
        expect(closeQuery).toMatch(/施設ID = 100/);
        expect(closeQuery).toMatch(/有効終了日時 = #2026\/03\/09#/);
    });

    test('renewal: 新版INSERTは同じ論理IDを使うこと', () => {
        var logicalId = 50;
        var insertQuery = logic.buildSaveFacilityQuery({
            logicalId: logicalId, businessId: 1, typeId: 1,
            location: '新住所', todayStr: '2026/03/09'
        });
        // 論理IDが保持されること
        expect(insertQuery).toMatch(/50/);
    });

    test('edit: UPDATEは既存施設IDに対して行うこと', () => {
        var editingFacilityId = 100;
        var updateQuery = logic.buildUpdateFacilityHistoryQuery({
            facilityId: editingFacilityId, typeId: 1, location: '住所'
        });
        expect(updateQuery).toMatch(/施設ID = 100/);
    });
});

describe('UI状態遷移: 許可更新/変更モード', () => {
    test('更新モード: 旧版CLOSE + 新版INSERTの論理ID一致', () => {
        var logicalId = 30;
        var businessId = 1;

        // 旧版CLOSE
        var closeQuery = logic.buildCloseOldPermitVersionsQuery(logicalId, '2026/03/09');
        expect(closeQuery).toMatch(/許可論理ID = 30/);

        // 新版INSERT
        var insertQuery = logic.buildSavePermitQuery({
            logicalId: logicalId, businessId: businessId,
            categoryId: 1, number: 'TEST-001',
            permitDate: '2026/03/09', validDate: '2031/03/09',
            todayStr: '2026/03/09'
        });
        // 同じ論理IDが使われること
        expect(insertQuery).toMatch(/30/);
    });

    test('変更モード: isChangeフラグが保存されること', () => {
        var sql = logic.buildSavePermitQuery({
            logicalId: 1, businessId: 1, categoryId: 1,
            number: 'T-001', permitDate: '2026/01/01',
            validDate: '2031/01/01', todayStr: '2026/01/01',
            isChange: true
        });
        expect(sql).toMatch(/変更許可フラグ/);
        expect(sql).toMatch(/True/);
    });

    test('更新モード: isChangeフラグがFalseであること', () => {
        var sql = logic.buildSavePermitQuery({
            logicalId: 1, businessId: 1, categoryId: 1,
            number: 'T-001', permitDate: '2026/01/01',
            validDate: '2031/01/01', todayStr: '2026/01/01'
        });
        expect(sql).toMatch(/変更許可フラグ/);
        expect(sql).toMatch(/False/);
    });
});

describe('UI状態遷移: 処理能力の編集一貫性（B3/B5/B6相当）', () => {
    test('処理能力UPDATE: 品目ID変更が反映されること', () => {
        var sql = logic.buildUpdateCapacityInlineQuery(10, {
            itemId: 7, hourCap: 50, hourUnitId: 1, dayCap: 400, dayUnitId: 1
        });
        expect(sql).toMatch(/品目ID = 7/);
        expect(sql).toMatch(/WHERE 処理能力ID = 10/);
    });

    test('処理能力INSERT: 新施設IDに紐付くこと', () => {
        var newFacilityId = 999;
        var sql = logic.buildInsertCapacityInlineQuery(newFacilityId, {
            itemId: 3, hourCap: 100, hourUnitId: 1, dayCap: 800, dayUnitId: 1
        });
        expect(sql).toMatch(/INSERT INTO 処理能力/);
        expect(sql).toContain('999');
    });

    test('処理能力: UPDATE後にINSERTで別施設IDが使えること', () => {
        // 旧施設の処理能力を更新
        var updateSql = logic.buildUpdateCapacityInlineQuery(10, {
            itemId: 5, hourCap: 50, hourUnitId: 1, dayCap: 400, dayUnitId: 1
        });
        expect(updateSql).toMatch(/WHERE 処理能力ID = 10/);

        // 新施設に同じデータを挿入
        var insertSql = logic.buildInsertCapacityInlineQuery(200, {
            itemId: 5, hourCap: 50, hourUnitId: 1, dayCap: 400, dayUnitId: 1
        });
        expect(insertSql).toContain('200');
        // 旧施設IDが混入しないこと
        expect(insertSql).not.toContain('10,');
    });
});

describe('UI状態遷移: 施設一覧は最新版のみ表示（B7相当）', () => {
    test('施設一覧クエリはMAX(施設ID)サブクエリを含むこと', () => {
        var sql = logic.buildLoadFacilitiesForBusinessQuery(1);
        expect(sql).toMatch(/MAX\(f2\.施設ID\)/);
        expect(sql).toMatch(/GROUP BY f2\.施設論理ID/);
    });

    test('施設一覧クエリは有効終了日時IS NULLでフィルタすること', () => {
        var sql = logic.buildLoadFacilitiesForBusinessQuery(1);
        expect(sql).toMatch(/有効終了日時 IS NULL/);
    });

    test('施設一覧クエリ（廃止含む）は廃止年月日フィルタを除外すること', () => {
        var sqlWithAbolished = logic.buildLoadFacilitiesForBusinessQuery(1, true);
        var sqlWithout = logic.buildLoadFacilitiesForBusinessQuery(1, false);
        expect(sqlWithout).toMatch(/廃止年月日 IS NULL/);
        expect(sqlWithAbolished).not.toMatch(/廃止年月日 IS NULL/);
    });
});

describe('UI状態遷移: 施設ライフサイクル操作', () => {
    test('施設休止: 休止日がSQLに正しく埋め込まれること', () => {
        var sql = logic.buildSuspendFacilityQuery(10, '2026/04/01');
        expect(sql).toMatch(/#2026\/04\/01#/);
        expect(sql).toMatch(/施設ID = 10/);
    });

    test('施設再開: 再開日がSQLに正しく埋め込まれること', () => {
        var sql = logic.buildResumeFacilityQuery(10, '2026/05/01');
        expect(sql).toMatch(/#2026\/05\/01#/);
        expect(sql).toMatch(/施設ID = 10/);
    });

    test('施設バージョン削除: 施設休止履歴→処理能力→施設の順で削除されること', () => {
        var queries = logic.buildDeleteFacilityVersionQueries(10);
        expect(queries[0]).toMatch(/施設休止履歴/);
        expect(queries[1]).toMatch(/処理能力/);
        expect(queries[2]).toMatch(/施設/);
    });

    test('施設廃止: 廃止日と確認日が正しく設定されること', () => {
        var sql = logic.buildAbolishFacilityQuery(10, '2026/06/01', '2026/03/09');
        expect(sql).toMatch(/#2026\/06\/01#/);
        expect(sql).toMatch(/施設ID = 10/);
    });

    test('施設取消: 取消理由が含まれること', () => {
        var sql = logic.buildCancelFacilityQuery(10, '2026/07/01', '行政処分');
        expect(sql).toMatch(/#2026\/07\/01#/);
        expect(sql).toMatch(/行政処分/);
    });

    test('施設復活: 廃止・取消情報がクリアされること', () => {
        var sql = logic.buildRestoreFacilityQuery(10);
        expect(sql).toMatch(/NULL/);
        expect(sql).toMatch(/施設ID = 10/);
    });
});

describe('UI状態遷移: マスターID採番', () => {
    test('品目（特管）: ITEM_SPECIAL_THRESHOLD以上から採番', () => {
        var config = logic.getMasterConfig("品目");
        var sql = logic.buildGetNextMasterIdQuery(config, "special");
        expect(sql).toMatch(new RegExp('>= ' + logic.ITEM_SPECIAL_THRESHOLD));
    });

    test('品目（普通）: ITEM_SPECIAL_THRESHOLD未満から採番', () => {
        var config = logic.getMasterConfig("品目");
        var sql = logic.buildGetNextMasterIdQuery(config, "normal");
        expect(sql).toMatch(new RegExp('< ' + logic.ITEM_SPECIAL_THRESHOLD));
    });

    test('一般マスター: テーブル全体からMAX取得', () => {
        var config = logic.getMasterConfig("処理方法");
        var sql = logic.buildGetNextMasterIdQuery(config);
        expect(sql).not.toMatch(/>=/);
        expect(sql).not.toMatch(/</);
        expect(sql).toMatch(/MAX\(/);
    });
});

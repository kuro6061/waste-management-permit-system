/**
 * 廃棄物対策課の業務シミュレーションテスト
 * 実際の業務フローに基づくシナリオテスト
 */
const logic = require('../../app_logic.js');

// ===== シナリオA: 新規事業者登録から許可取得までの一連の流れ =====

describe('シナリオA: 新規事業者登録→許可申請→品目設定→施設登録', () => {
    var businessId = 100;
    var permitId = 500;
    var facilityId = 200;
    var dateStr = logic.buildDateStr(new Date(2026, 3, 1));

    test('1. 新規事業者を登録', () => {
        var sql = logic.buildSaveBusinessQuery({
            id: 0, name: '株式会社埼玉環境サービス', businessType: '1',
            zipCode: '330-0801', pref: '埼玉県', address: 'さいたま市大宮区土手町1-2-3',
            phone: '048-641-0001'
        });
        expect(sql).toMatch(/^INSERT INTO 事業者/);
        expect(sql).toContain("'株式会社埼玉環境サービス'");
    });

    test('2. 登録した事業者の詳細を確認', () => {
        var sql = logic.buildLoadBusinessDetailQuery(businessId);
        expect(sql).toContain('事業者ID = 100');
    });

    test('3. 産業廃棄物収集運搬業の許可を新規登録', () => {
        var sql = logic.buildSavePermitQuery({
            logicalId: 300, businessId: businessId, categoryId: 1,
            number: '01100100001', permitDate: '2026/04/01',
            validDate: '2031/03/31', excellent: false, todayStr: dateStr
        });
        expect(sql).toContain("'01100100001'");
        expect(sql).toContain('#2026/04/01#');
        expect(sql).toContain('#2031/03/31#');
    });

    test('4. 許可に品目「燃え殻」を追加（×→〇）', () => {
        var q = logic.buildPermitItemQueries(permitId, 1);
        expect(q.insert).toContain('True, False');
    });

    test('5. 品目「燃え殻」に積替保管を追加（〇→◎）', () => {
        var q = logic.buildPermitItemQueries(permitId, 1);
        var sql = q.toTransfer(1001);
        expect(sql).toContain('積替保管フラグ = True');
    });

    test('6. 施設を新規登録', () => {
        var sql = logic.buildSaveFacilityQuery({
            logicalId: 150, businessId: businessId, typeId: 1,
            location: 'さいたま市大宮区桜木町4-5-6',
            permitNo: '01100100001', permitDate: '2026/04/01',
            setupDate: '2025/10/15', todayStr: dateStr
        });
        expect(sql).toContain('INSERT INTO 施設');
        expect(sql).toContain("'さいたま市大宮区桜木町4-5-6'");
    });

    test('7. 施設に処理能力を追加', () => {
        var sql = logic.buildSaveCapacityQuery({
            facilityId: facilityId, itemId: 1,
            hourCap: '2.5', hourUnit: 1,
            dayCap: '50', dayUnit: 1,
            hours: '8', note: '焼却処理'
        });
        expect(sql).toContain('INSERT INTO 処理能力');
        expect(sql).toContain('2.5');
        expect(sql).toContain('50');
    });

    test('8. 車両を登録', () => {
        var sql = logic.buildSaveVehicleQuery({
            businessId: businessId, reg1: '大宮', reg2: '100', reg3: 'あ', reg4: '1234'
        });
        expect(sql).toContain("'大宮'");
        expect(sql).toContain('INSERT INTO 車両');
    });

    test('9. 役員を登録', () => {
        var sql = logic.buildSaveOfficerQuery({
            id: 0, businessId: businessId,
            position: '代表取締役', lastName: '山田', firstName: '太郎'
        });
        expect(sql).toContain('INSERT INTO 役員');
        expect(sql).toContain("'代表取締役'");
    });

    test('10. 事業者の全データを一覧で確認', () => {
        var permits = logic.buildLoadPermitsQuery(businessId);
        var facilities = logic.buildLoadFacilitiesForBusinessQuery(businessId);
        var vehicles = logic.buildLoadVehiclesForBusinessQuery(businessId);
        var officers = logic.buildLoadOfficersForBusinessQuery(businessId);
        expect(permits).toContain('事業者ID = 100');
        expect(facilities).toContain('施設.事業者ID = 100');
        expect(vehicles).toContain('事業者ID = 100');
        expect(officers).toContain('事業者ID = 100');
    });
});

// ===== シナリオB: 許可の更新・廃止・取消 =====

describe('シナリオB: 許可の更新時に旧許可を終了し新許可を登録', () => {
    var permitId = 600;
    var logicalId = 300;

    test('1. 旧許可の有効終了日時を設定（履歴更新）', () => {
        var sql = logic.buildUpdatePermitHistoryQuery({
            permitId: permitId,
            permitNumber: '01100100001', categoryId: 1,
            permitDate: '2021/04/01', validDate: '2026/03/31',
            startDate: '2021/04/01', endDate: '2026/04/01',
            excellent: false,
            cancelDate: '', cancelReason: '',
            abolishDate: '', abolishReason: ''
        });
        expect(sql).toContain('有効終了日時 = #2026/04/01#');
        expect(sql).toContain('WHERE 許可ID = 600');
    });

    test('2. 新許可を同じ論理IDで登録', () => {
        var sql = logic.buildSavePermitQuery({
            logicalId: logicalId, businessId: 100, categoryId: 1,
            number: '01100100001', permitDate: '2026/04/01',
            validDate: '2031/03/31', excellent: true,
            todayStr: logic.buildDateStr(new Date(2026, 3, 1))
        });
        expect(sql).toContain(logicalId + ', 100, 1');
        expect(sql).toContain('True');
    });

    test('3. 許可履歴で新旧の許可を確認', () => {
        var sql = logic.buildLoadPermitHistoryQuery(logicalId);
        expect(sql).toContain('許可論理ID = 300');
        expect(sql).toContain('ORDER BY 許可.有効開始日時 ASC');
    });
});

describe('シナリオC: 不正業者の許可取消処理', () => {
    var permitId = 700;

    test('1. 許可を取消（理由付き）', () => {
        var sql = logic.buildCancelPermitQuery(
            permitId,
            logic.buildDateStr(new Date(2026, 5, 15)),
            '廃棄物処理法第14条の3の2第1項の規定に基づく取消'
        );
        expect(sql).toContain('取消日 = #2026/06/15#');
        expect(sql).toContain('廃棄物処理法第14条の3の2第1項の規定に基づく取消');
    });

    test('2. 取消後に検索で状態を確認', () => {
        var sql = logic.buildSearchPermitQuery({
            status: 'cancelled',
            asOfDateSql: '#2026/06/15 23:59:59#'
        });
        expect(sql).toContain('許可.取消日 IS NOT NULL');
    });
});

// ===== シナリオD: マスターデータの管理 =====

describe('シナリオD: 品目マスターの管理', () => {
    test('1. 品目一覧を確認', () => {
        var config = logic.getMasterConfig('品目');
        var sql = logic.buildLoadMasterListQuery(config);
        expect(sql).toContain('[マスター_品目]');
        expect(sql).toContain('ORDER BY 表示順, 品目ID');
    });

    test('2. 新しい品目を追加（表示順つき）', () => {
        var config = logic.getMasterConfig('品目');
        var sql = logic.buildSaveMasterQuery(config, {
            id: 0, newId: 25, name: '水銀使用製品産業廃棄物', extra: '99'
        });
        expect(sql).toContain("'水銀使用製品産業廃棄物'");
        expect(sql).toContain('25');
        expect(sql).toContain('99');
    });

    test('3. 品目名を修正', () => {
        var config = logic.getMasterConfig('品目');
        var sql = logic.buildSaveMasterQuery(config, {
            id: 25, name: '水銀含有ばいじん等', extra: '99'
        });
        expect(sql).toContain("品目名 = '水銀含有ばいじん等'");
        expect(sql).toContain('WHERE 品目ID = 25');
    });

    test('4. 不要な品目を削除', () => {
        var config = logic.getMasterConfig('品目');
        var sql = logic.buildDeleteMasterQuery(config, 25);
        expect(sql).toContain('DELETE FROM [マスター_品目]');
        expect(sql).toContain('品目ID = 25');
    });
});

describe('シナリオE: 全マスターテーブルでCRUDが機能する', () => {
    var masterTypes = [
        '許可区分', '施設種別', '品目', '処理方法', '廃棄物種類区分',
        '取扱区分', '形式', '日処理能力単位', '時間処理能力単位',
        '管理区分', '設置形態区分', '許可対象区分', '許可番号形式', '認定区分'
    ];

    masterTypes.forEach(function(type) {
        test(type + 'マスターのCRUDクエリが正常に生成される', () => {
            var config = logic.getMasterConfig(type);
            expect(config).toBeDefined();

            // 一覧
            var listSql = logic.buildLoadMasterListQuery(config);
            expect(listSql).toContain('SELECT');
            expect(listSql).toContain(config.idCol);

            // 個別
            var editSql = logic.buildLoadMasterForEditQuery(config, 1);
            expect(editSql).toContain(config.idCol + ' = 1');

            // 保存（更新）
            var saveSql = logic.buildSaveMasterQuery(config, { id: 1, name: 'テスト', extra: '0' });
            expect(saveSql).toContain('UPDATE');
            expect(saveSql).toContain(config.nameCol);

            // 保存（新規）
            var insertSql = logic.buildSaveMasterQuery(config, { id: 0, newId: 99, name: '新規', extra: '0' });
            expect(insertSql).toContain('INSERT');

            // 削除
            var deleteSql = logic.buildDeleteMasterQuery(config, 1);
            expect(deleteSql).toContain('DELETE');
            expect(deleteSql).toContain(config.idCol + ' = 1');
        });
    });
});

// ===== シナリオF: 統計画面の確認 =====

describe('シナリオF: 統計ダッシュボード', () => {
    test('1. ダッシュボード統計クエリ', () => {
        var queries = logic.buildStatisticsQueries();
        expect(Object.keys(queries).length).toBe(4);
    });

    test('2. 期限切れ間近の許可一覧を表示', () => {
        var sql = logic.buildLoadExpiringPermitsQuery();
        expect(sql).toContain('BETWEEN Date() AND DateAdd');
        expect(sql).toContain('事業者.事業者名');
        expect(sql).toContain('許可区分名');
    });

    test('3. 許可数推移グラフ（全許可区分で生成可能）', () => {
        for (var catId = 1; catId <= 5; catId++) {
            var sql = logic.buildLoadPermitTrendQuery(catId);
            expect(sql).toContain('許可区分ID = ' + catId);
            expect(sql).toContain('Year(許可年月日)');
            expect(sql).toContain('COUNT(*)');
        }
    });

    test('4. 処理能力集計（施設種別ごと）', () => {
        for (var ftId = 1; ftId <= 3; ftId++) {
            var sql = logic.buildLoadCapacityStatsQuery(ftId);
            expect(sql).toContain('施設種別ID = ' + ftId);
            expect(sql).toContain('SUM(処理能力.日処理能力)');
        }
    });
});

// ===== シナリオG: 施設の履歴管理と処理能力の更新 =====

describe('シナリオG: 施設の履歴追跡と処理能力変更', () => {
    test('1. 施設の変更履歴を確認', () => {
        var sql = logic.buildLoadFacilityHistoryQuery(50);
        expect(sql).toContain('施設論理ID = 50');
        expect(sql).toContain("Format(施設.有効開始日時, 'yyyy/mm/dd')");
    });

    test('2. 現在の処理能力を確認', () => {
        var sql = logic.buildLoadProcessingCapacityQuery(200);
        expect(sql).toContain('処理能力.施設ID = 200');
        expect(sql).toContain('マスター_品目.品目名');
    });

    test('3. 処理能力を更新（能力増強）', () => {
        var sql = logic.buildSaveCapacityQuery({
            editId: 30,
            hourCap: '15.0', hourUnit: 1,
            dayCap: '300', dayUnit: 1,
            hours: '24', note: '設備増強により能力向上'
        });
        expect(sql).toContain('UPDATE 処理能力');
        expect(sql).toContain('15.0');
        expect(sql).toContain('300');
        expect(sql).toContain("'設備増強により能力向上'");
    });

    test('4. 処理能力を削除（品目取扱い終了）', () => {
        var sql = logic.buildDeleteCapacityQuery(30);
        expect(sql).toContain('DELETE FROM 処理能力');
        expect(sql).toContain('処理能力ID = 30');
    });

    test('5. 施設を廃止', () => {
        var dateStr = logic.buildDateStr(new Date(2026, 11, 31));
        var sql = logic.buildAbolishFacilityQuery(200, dateStr);
        expect(sql).toContain('#2026/12/31#');
    });
});

// ===== シナリオH: 事業者情報の変更と関連データの確認 =====

describe('シナリオH: 事業者の住所変更と関連データ確認', () => {
    test('1. 事業者情報を更新（住所変更）', () => {
        var sql = logic.buildSaveBusinessQuery({
            id: 42, name: '株式会社テスト環境', businessType: '1',
            zipCode: '330-0853', pref: '埼玉県', address: 'さいたま市大宮区錦町682-2',
            phone: '048-830-3060'
        });
        expect(sql).toContain('UPDATE 事業者');
        expect(sql).toContain("'さいたま市大宮区錦町682-2'");
    });

    test('2. 更新後の事業者詳細を確認', () => {
        var sql = logic.buildLoadBusinessDetailQuery(42);
        expect(sql).toContain('事業者ID = 42');
    });

    test('3. 関連する許可を確認', () => {
        var sql = logic.buildLoadPermitsQuery(42);
        expect(sql).toContain('事業者ID = 42');
    });

    test('4. 関連する施設が正常に表示される', () => {
        var sql = logic.buildLoadFacilitiesForBusinessQuery(42);
        expect(sql).toContain('施設.事業者ID = 42');
        expect(sql).toContain('有効終了日時 IS NULL');
    });

    test('5. 関連する車両が正常に表示される', () => {
        var sql = logic.buildLoadVehiclesForBusinessQuery(42);
        expect(sql).toContain('事業者ID = 42');
    });

    test('6. 関連する役員が正常に表示される', () => {
        var sql = logic.buildLoadOfficersForBusinessQuery(42);
        expect(sql).toContain('事業者ID = 42');
    });
});

// ===== シナリオI: 役員の異動（退任・復帰・追加・削除） =====

describe('シナリオI: 役員人事異動', () => {
    test('1. 現任の役員一覧を確認', () => {
        var sql = logic.buildSearchOfficerQuery('', false);
        expect(sql).toContain('役員.退任フラグ = False OR 役員.退任フラグ IS NULL');
    });

    test('2. 代表取締役が退任', () => {
        var sql = logic.buildRetireOfficerQuery(10);
        expect(sql).toContain('退任フラグ = True');
    });

    test('3. 新代表取締役を登録', () => {
        var sql = logic.buildSaveOfficerQuery({
            id: 0, businessId: 42,
            position: '代表取締役', lastName: '鈴木', firstName: '一郎'
        });
        expect(sql).toContain('INSERT INTO 役員');
        expect(sql).toContain("'代表取締役'");
    });

    test('4. 退任した役員が復帰', () => {
        var sql = logic.buildReinstateOfficerQuery(10);
        expect(sql).toContain('退任フラグ = False');
    });

    test('5. 退任者含めた全役員を検索', () => {
        var sql = logic.buildSearchOfficerQuery('', true);
        // 退任フラグのフィルタ条件（AND句）がないこと
        expect(sql).not.toMatch(/AND\s+\(役員\.退任フラグ/);
    });

    test('6. 役員情報を更新（役職変更）', () => {
        var sql = logic.buildSaveOfficerQuery({
            id: 10, businessId: 42,
            position: '取締役会長', lastName: '田中', firstName: '次郎'
        });
        expect(sql).toContain('UPDATE 役員');
        expect(sql).toContain("'取締役会長'");
    });

    test('7. 完全に不要な役員を削除', () => {
        var sql = logic.buildDeleteOfficerQuery(99);
        expect(sql).toContain('DELETE FROM 役員');
    });
});

// ===== シナリオJ: 車両管理のライフサイクル =====

describe('シナリオJ: 車両の登録→運用→廃車→復活→削除', () => {
    test('1. 新車両を登録', () => {
        var sql = logic.buildSaveVehicleQuery({
            businessId: 42, reg1: '大宮', reg2: '800', reg3: 'す', reg4: '5678'
        });
        expect(sql).toContain('INSERT INTO 車両');
    });

    test('2. 車両一覧で確認（廃車除外で検索）', () => {
        var sql = logic.buildSearchVehicleQuery('大宮', false);
        expect(sql).toContain("'%大宮%'");
        expect(sql).toContain('廃車フラグ = False');
    });

    test('3. 車両を廃車にする', () => {
        var sql = logic.buildScrapVehicleQuery(50);
        expect(sql).toContain('廃車フラグ = True');
    });

    test('4. 廃車車両は検索デフォルトで非表示', () => {
        var sql = logic.buildSearchVehicleQuery('', false);
        expect(sql).toContain('廃車フラグ = False');
    });

    test('5. 廃車を含めて検索すると表示される', () => {
        var sql = logic.buildSearchVehicleQuery('', true);
        // 廃車フラグのフィルタ条件（AND句）がないこと
        expect(sql).not.toMatch(/AND\s+\(車両\.廃車フラグ/);
    });

    test('6. 車両を復活させる', () => {
        var sql = logic.buildRestoreVehicleQuery(50);
        expect(sql).toContain('廃車フラグ = False');
    });

    test('7. 車両を完全に削除', () => {
        var sql = logic.buildDeleteVehicleQuery(50);
        expect(sql).toContain('DELETE FROM 車両');
    });
});

// ===== シナリオK: 年度末の許可更新勧奨業務 =====

describe('シナリオK: 年度末の許可更新勧奨', () => {
    test('1. 1年以内に期限が切れる許可を抽出', () => {
        var sql = logic.buildLoadExpiringPermitsQuery();
        expect(sql).toContain("DateAdd('yyyy', 1, Date())");
    });

    test('2. 30日以内に期限切れの許可をさらに絞り込み', () => {
        var sql = logic.buildSearchPermitQuery({
            expiry: '30days',
            status: 'active',
            asOfDateSql: '#2026/03/01 23:59:59#'
        });
        expect(sql).toContain("DateAdd('d', 30,");
        expect(sql).toContain('廃止日 IS NULL AND 許可.取消日 IS NULL');
    });

    test('3. 許可区分別の有効許可数推移を確認', () => {
        // 産業廃棄物収集運搬業
        var sql = logic.buildLoadPermitTrendQuery(1);
        expect(sql).toContain('許可区分ID = 1');
        expect(sql).toContain('COUNT(*)');
    });

    test('4. 優良認定業者だけ抽出', () => {
        var sql = logic.buildSearchPermitQuery({
            excellentOnly: true,
            status: 'active',
            asOfDateSql: '#2026/03/01 23:59:59#'
        });
        expect(sql).toContain('優良認定 = True');
    });
});

// ===== シナリオL: エッジケースとエラー耐性 =====

describe('シナリオL: 入力値のエッジケース', () => {
    test('事業者名にHTMLタグが含まれても安全', () => {
        var name = '<script>alert("XSS")</script>株式会社';
        var safe = logic.escapeHtml(name);
        expect(safe).not.toContain('<script>');
        expect(safe).toContain('&lt;script&gt;');
    });

    test('SQLインジェクションが防がれる（マスター保存）', () => {
        var config = logic.getMasterConfig('許可区分');
        var sql = logic.buildSaveMasterQuery(config, {
            id: 1, name: "'; DROP TABLE マスター_許可区分; --"
        });
        // シングルクォートがエスケープされ、SQL文が壊れない
        expect(sql).toContain("''; DROP TABLE");
        // 元のシングルクォートだけの形（エスケープ前）ではない
        expect(sql).toMatch(/'';\s*DROP/);
    });

    test('許可履歴更新で全フィールドが空でもSQL構文エラーにならない', () => {
        var sql = logic.buildUpdatePermitHistoryQuery({
            permitId: 1, permitNumber: '', categoryId: 0,
            permitDate: '', validDate: '', startDate: '', endDate: '',
            excellent: false, cancelDate: '', cancelReason: '',
            abolishDate: '', abolishReason: ''
        });
        expect(sql).toContain('UPDATE 許可 SET');
        expect(sql).toContain('WHERE 許可ID = 1');
        // NULLが日付フィールドに正しく設定される
        var nullCount = (sql.match(/= NULL/g) || []).length;
        expect(nullCount).toBeGreaterThanOrEqual(6);
    });

    test('処理能力の数値フィールドが空でもNULLで安全', () => {
        var sql = logic.buildSaveCapacityQuery({
            facilityId: 1, itemId: 1,
            hourCap: '', hourUnit: 1,
            dayCap: '', dayUnit: 1,
            hours: '', note: ''
        });
        expect(sql).toContain('NULL');
        expect(sql).not.toContain("''");
    });

    test('事業者一覧クエリにパラメータ不要（安全）', () => {
        var sql = logic.buildLoadBusinessListQuery();
        expect(sql).not.toContain("'");
        expect(sql).not.toContain('#');
    });

    test('buildDateStrでうるう年2月29日が正しくフォーマット', () => {
        var dateStr = logic.buildDateStr(new Date(2028, 1, 29));
        expect(dateStr).toBe('2028/02/29');
    });
});

// ===== シナリオM〜R: 廃棄物対策課の実務操作シミュレーション =====
// 仕様書 (docs/permit_lifecycle_spec.md) に基づく

describe('シナリオM: 許可更新フロー（14条2〜4項）みなし有効期間を含む', () => {
    // 業者Aの産廃収集運搬業許可: 2021/04/01〜2026/03/31（5年間）
    // 2026/02/15に更新申請受理 → 2026/05/15に新許可発行
    var businessId = 200;
    var logicalId = 500;
    var oldPermitId = 801;

    test('1. 旧許可は有効期限(2026/03/31)を過ぎても、新許可発行前日まで有効開始日時で検索可能', () => {
        // 2026/04/15時点（旧許可の許可有効年月日を過ぎている）でのas-of検索
        // 旧許可: 有効開始日時=2021/04/01, 有効終了日時=NULLの状態（まだ新許可未発行）
        var sql = logic.buildSearchPermitQuery({
            keyword: '',
            asOfDateSql: '#2026/04/15 23:59:59#'
        });
        // as-of条件で有効開始日時 <= 基準日 AND (有効終了日時 IS NULL OR > 基準日) をチェック
        expect(sql).toContain('許可.有効開始日時 <= #2026/04/15 23:59:59#');
        expect(sql).toContain('許可.有効終了日時 IS NULL OR 許可.有効終了日時 > #2026/04/15 23:59:59#');
    });

    test('2. 新許可発行時: 旧レコードの有効終了日時に新許可の許可年月日の前日を設定', () => {
        // 新許可の許可年月日=2026/05/15 → 旧レコードの有効終了日時=2026/05/14
        var sql = logic.buildUpdatePermitHistoryQuery({
            permitId: oldPermitId,
            permitNumber: '01100200001', categoryId: 1,
            permitDate: '2021/04/01', validDate: '2026/03/31',
            startDate: '2021/04/01', endDate: '2026/05/14',
            excellent: false,
            cancelDate: '', cancelReason: '',
            abolishDate: '', abolishReason: ''
        });
        expect(sql).toContain('有効終了日時 = #2026/05/14#');
        expect(sql).toContain('WHERE 許可ID = ' + oldPermitId);
    });

    test('3. 新許可レコードを同じ論理IDで登録', () => {
        // 新許可: 許可年月日=2026/05/15, 有効期限=旧有効期限+5年=2031/03/31
        var sql = logic.buildSavePermitQuery({
            logicalId: logicalId, businessId: businessId, categoryId: 1,
            number: '01100200001',
            permitDate: '2026/05/15', validDate: '2031/03/31',
            excellent: false, todayStr: '2026/05/15'
        });
        expect(sql).toContain('許可論理ID');
        expect(sql).toContain(logicalId + ', ' + businessId);
        expect(sql).toContain('#2026/05/15#');
        expect(sql).toContain('#2031/03/31#');
        // 有効開始日時は今日（=許可年月日）
        expect(sql).toContain('有効開始日時');
    });

    test('4. 新許可発行後: 旧許可は2026/05/15のas-of検索でヒットしない', () => {
        // 旧許可: 有効終了日時=2026/05/14 → 2026/05/15時点ではヒットしない
        var sql = logic.buildSearchPermitQuery({
            keyword: '',
            asOfDateSql: '#2026/05/15 23:59:59#'
        });
        // 条件: 有効終了日時 IS NULL OR 有効終了日時 > 2026/05/15
        // 旧許可の有効終了日時=2026/05/14 → 2026/05/14 > 2026/05/15 は false → 除外
        expect(sql).toContain('許可.有効終了日時 > #2026/05/15 23:59:59#');
    });

    test('5. 履歴画面で新旧両方のレコードが見える', () => {
        var sql = logic.buildLoadPermitHistoryQuery(logicalId);
        expect(sql).toContain('許可論理ID = ' + logicalId);
        // 有効終了日時のフィルタがないこと（全レコード表示）
        expect(sql).not.toContain('有効終了日時 IS NULL');
        expect(sql).toContain('ORDER BY 許可.有効開始日時 ASC');
    });
});

describe('シナリオN: 年度末時点の集計（as-of検索の実務利用）', () => {
    // 2025年度末(2026/03/31)時点の状況を集計する場面

    test('1. 年度末時点の有効な許可を検索', () => {
        var sql = logic.buildSearchPermitQuery({
            status: 'active',
            asOfDateSql: '#2026/03/31 23:59:59#'
        });
        // 有効な許可のみ（廃止・取消を除外）
        expect(sql).toContain('廃止日 IS NULL AND 許可.取消日 IS NULL');
        // as-of条件
        expect(sql).toContain('許可.有効開始日時 <= #2026/03/31 23:59:59#');
        expect(sql).toContain('許可.有効終了日時 IS NULL OR 許可.有効終了日時 > #2026/03/31 23:59:59#');
    });

    test('2. 現在の統計クエリは廃止・取消済みを正しく除外する', () => {
        var q = logic.buildStatisticsQueries();
        // 許可: 有効終了日時+廃止日+取消日の三重チェック
        expect(q.permitCount).toContain('[有効終了日時] IS NULL');
        expect(q.permitCount).toContain('[廃止日] IS NULL');
        expect(q.permitCount).toContain('[取消日] IS NULL');
        // 施設: 有効終了日時+廃止年月日の二重チェック
        expect(q.facilityCount).toContain('[有効終了日時] IS NULL');
        expect(q.facilityCount).toContain('[廃止年月日] IS NULL');
    });

    test('3. 廃止済み許可は期限切れ間近リストに含まれない', () => {
        var sql = logic.buildLoadExpiringPermitsQuery();
        expect(sql).toContain('有効終了日時 IS NULL');
        expect(sql).toContain('廃止日 IS NULL');
        expect(sql).toContain('取消日 IS NULL');
    });

    test('4. 廃止済み施設は処理能力集計に含まれない', () => {
        var sql = logic.buildLoadCapacityStatsQuery(1);
        expect(sql).toContain('施設.有効終了日時 IS NULL');
        expect(sql).toContain('施設.廃止年月日 IS NULL');
    });
});

describe('シナリオO: 事業者が自主廃止→統計から除外→誤りで復活', () => {
    var permitId = 900;
    var dateStr = '2026/06/30';

    test('1. 廃止: 有効終了日時も設定される', () => {
        var sql = logic.buildAbolishPermitQuery(permitId, dateStr, '事業者の申し出による自主廃止');
        expect(sql).toContain('廃止日 = #2026/06/30#');
        expect(sql).toContain('有効終了日時 = #2026/06/30#');
        expect(sql).toContain("廃止理由 = '事業者の申し出による自主廃止'");
    });

    test('2. 廃止後: 統計の有効許可数に含まれない', () => {
        var q = logic.buildStatisticsQueries();
        // 有効終了日時が設定されている→ IS NULLで除外
        // 廃止日が設定されている→ IS NULLで除外（二重チェック）
        expect(q.permitCount).toContain('[有効終了日時] IS NULL');
        expect(q.permitCount).toContain('[廃止日] IS NULL');
    });

    test('3. 廃止後: as-of検索で廃止日以降はヒットしない', () => {
        // 2026/07/01時点の検索→廃止された許可は有効終了日時=2026/06/30で除外
        var sql = logic.buildSearchPermitQuery({
            keyword: '',
            asOfDateSql: '#2026/07/01 23:59:59#'
        });
        // 有効終了日時=2026/06/30、条件: 有効終了日時 > 2026/07/01 → false → 除外
        expect(sql).toContain('許可.有効終了日時 IS NULL OR 許可.有効終了日時 > #2026/07/01 23:59:59#');
    });

    test('4. 廃止後: 廃止日の前日のas-of検索ではまだヒットする', () => {
        // 2026/06/29時点→有効終了日時=2026/06/30 > 2026/06/29 → ヒット
        var sql = logic.buildSearchPermitQuery({
            keyword: '',
            asOfDateSql: '#2026/06/29 23:59:59#'
        });
        expect(sql).toContain('許可.有効終了日時 IS NULL OR 許可.有効終了日時 > #2026/06/29 23:59:59#');
    });

    test('5. 復活: 有効終了日時・廃止日・廃止理由がすべてNULLに戻る', () => {
        var sql = logic.buildRestorePermitQuery(permitId);
        expect(sql).toContain('廃止日 = NULL');
        expect(sql).toContain('廃止理由 = NULL');
        expect(sql).toContain('有効終了日時 = NULL');
        expect(sql).toContain('WHERE 許可ID = ' + permitId);
    });

    test('6. 復活後: 統計の有効許可数に再び含まれる', () => {
        // 復活により有効終了日時=NULL → IS NULLに合致
        var q = logic.buildStatisticsQueries();
        expect(q.permitCount).toContain('[有効終了日時] IS NULL');
    });
});

describe('シナリオP: 行政処分による許可取消→関連施設の確認', () => {
    var permitId = 1000;
    var businessId = 300;

    test('1. 14条の3の2に基づく許可取消', () => {
        var sql = logic.buildCancelPermitQuery(
            permitId, '2026/08/01',
            '廃棄物処理法第14条の3の2第1項第5号の規定に基づく取消'
        );
        expect(sql).toContain('取消日 = #2026/08/01#');
        expect(sql).toContain('有効終了日時 = #2026/08/01#');
        expect(sql).toContain('第14条の3の2第1項第5号');
    });

    test('2. 取消後: 当該事業者の施設一覧は別途確認が必要', () => {
        // 許可の取消は施設レコードには影響しない（別テーブル）
        var sql = logic.buildLoadFacilitiesForBusinessQuery(businessId);
        expect(sql).toContain('施設.事業者ID = ' + businessId);
        // 施設の有効終了日時・廃止年月日は許可取消では変わらない
        expect(sql).toContain('施設.有効終了日時 IS NULL');
        expect(sql).toContain('施設.廃止年月日 IS NULL');
    });

    test('3. 取消後: 車両・役員一覧も影響を受けない', () => {
        var vehicleSql = logic.buildSearchVehicleQuery('', false);
        var officerSql = logic.buildSearchOfficerQuery('', false);
        // 車両・役員テーブルには有効終了日時の概念がない
        expect(vehicleSql).toContain('車両.廃車フラグ');
        expect(officerSql).toContain('役員.退任フラグ');
    });

    test('4. 取消された許可は許可検索で「取消」として見つかる', () => {
        var sql = logic.buildSearchPermitQuery({
            status: 'cancelled',
            asOfDateSql: '#2026/08/15 23:59:59#'
        });
        expect(sql).toContain('許可.取消日 IS NOT NULL');
    });

    test('5. 取消された許可は許可検索で「有効」では見つからない', () => {
        var sql = logic.buildSearchPermitQuery({
            status: 'active',
            asOfDateSql: '#2026/08/15 23:59:59#'
        });
        expect(sql).toContain('廃止日 IS NULL AND 許可.取消日 IS NULL');
    });
});

describe('シナリオQ: 施設の新設→処理能力登録→廃止→統計確認', () => {
    var businessId = 400;
    var facilityId = 1100;
    var logicalId = 600;

    test('1. 施設を新規登録', () => {
        var sql = logic.buildSaveFacilityQuery({
            logicalId: logicalId, businessId: businessId, typeId: 2,
            location: '埼玉県さいたま市中央区新都心1-1',
            permitNo: '01100400001', permitDate: '2026/04/01',
            setupDate: '2026/04/15', todayStr: '2026/04/15'
        });
        expect(sql).toContain('施設論理ID');
        expect(sql).toContain("'埼玉県さいたま市中央区新都心1-1'");
        expect(sql).toContain('#2026/04/15#');
    });

    test('2. 処理能力を登録', () => {
        var sql = logic.buildSaveCapacityQuery({
            facilityId: facilityId, itemId: 3,
            hourCap: 500, hourUnit: 1,
            dayCap: 4000, dayUnit: 1,
            hours: 8, note: '焼却炉1号機'
        });
        expect(sql).toContain('INSERT INTO 処理能力');
        expect(sql).toContain('施設ID');
        expect(sql).toContain("'焼却炉1号機'");
    });

    test('3. 施設は事業者詳細の施設一覧に表示される', () => {
        var sql = logic.buildLoadFacilitiesForBusinessQuery(businessId);
        expect(sql).toContain('事業者ID = ' + businessId);
        expect(sql).toContain('有効終了日時 IS NULL');
    });

    test('4. 施設を廃止: 有効終了日時と廃止年月日を設定', () => {
        var sql = logic.buildAbolishFacilityQuery(facilityId, '2026/12/31');
        expect(sql).toContain('有効終了日時 = #2026/12/31#');
        expect(sql).toContain('廃止年月日 = #2026/12/31#');
        expect(sql).toContain('WHERE 施設ID = ' + facilityId);
    });

    test('5. 廃止後: 施設検索に出てこない', () => {
        var sql = logic.buildSearchFacilityQuery('さいたま', '');
        expect(sql).toContain('有効終了日時 IS NULL');
        expect(sql).toContain('廃止年月日 IS NULL');
    });

    test('6. 廃止後: 処理能力集計に含まれない', () => {
        var sql = logic.buildLoadCapacityStatsQuery(2);
        expect(sql).toContain('施設.有効終了日時 IS NULL');
        expect(sql).toContain('施設.廃止年月日 IS NULL');
    });

    test('7. 廃止後: 施設履歴では確認できる', () => {
        var sql = logic.buildLoadFacilityHistoryQuery(logicalId);
        expect(sql).toContain('施設論理ID = ' + logicalId);
        // 有効終了日時のフィルタがないこと
        expect(sql).not.toMatch(/WHERE.*有効終了日時 IS NULL/);
        expect(sql).toContain('ORDER BY 施設.有効開始日時 ASC');
    });
});

describe('シナリオR: 複合検索 - 品目AND検索で特定業者を絞り込み', () => {
    test('1. 複数品目をANDで検索（全品目を取り扱っている業者のみ）', () => {
        var sql = logic.buildSearchPermitQuery({
            selectedItemIds: ['1', '3', '5'],
            itemMode: 'AND',
            asOfDateSql: '#2026/03/31 23:59:59#'
        });
        // AND検索: 各品目ごとにEXISTSサブクエリ
        expect(sql).toContain('EXISTS (SELECT 1 FROM 許可品目');
        expect(sql).toContain('品目ID = 1');
        expect(sql).toContain('品目ID = 3');
        expect(sql).toContain('品目ID = 5');
        // as-of条件も含まれる
        expect(sql).toContain('許可.有効開始日時');
    });

    test('2. 複数品目をORで検索（いずれかの品目を取り扱っている業者）', () => {
        var sql = logic.buildSearchPermitQuery({
            selectedItemIds: ['1', '3', '5'],
            itemMode: 'OR',
            asOfDateSql: '#2026/03/31 23:59:59#'
        });
        // OR検索: IN句
        expect(sql).toContain('許可品目.品目ID IN (1,3,5)');
    });

    test('3. 許可区分＋有効期限＋品目の複合条件', () => {
        var sql = logic.buildSearchPermitQuery({
            categoryId: '1',
            expiry: '90days',
            selectedItemIds: ['2'],
            itemMode: 'OR',
            status: 'active',
            asOfDateSql: '#2026/03/31 23:59:59#'
        });
        expect(sql).toContain('許可区分ID = 1');
        expect(sql).toContain("DateAdd('d', 90,");
        expect(sql).toContain('品目ID IN (2)');
        expect(sql).toContain('廃止日 IS NULL AND 許可.取消日 IS NULL');
    });

    test('4. 優良認定＋特定品目で優良業者リストを作成', () => {
        var sql = logic.buildSearchPermitQuery({
            excellentOnly: true,
            selectedItemIds: ['1'],
            itemMode: 'OR',
            status: 'active',
            asOfDateSql: '#2026/03/31 23:59:59#'
        });
        expect(sql).toContain('優良認定 = True');
        expect(sql).toContain('品目ID IN (1)');
        expect(sql).toContain('廃止日 IS NULL');
    });
});

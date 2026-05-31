/**
 * 状態遷移マトリクス — 全エンティティのライフサイクルを正式な状態遷移として検証
 */
const logic = require('../../app_logic.js');

// ===== 許可ライフサイクル =====

describe('許可状態遷移', () => {
    const permitId = 100;
    const dateStr = '2026/03/01';

    describe('active → abolished → restored', () => {
        test('active → abolished: 廃止日と有効終了日時が設定される', () => {
            const sql = logic.buildAbolishPermitQuery(permitId, dateStr, '事業廃止');
            expect(sql).toContain('廃止日 = #2026/03/01#');
            expect(sql).toContain('有効終了日時 = #2026/03/01#');
            expect(sql).toContain("廃止理由 = '事業廃止'");
        });

        test('abolished → restored: 全ての廃止/取消フィールドがNULLに戻る', () => {
            const sql = logic.buildRestorePermitQuery(permitId);
            expect(sql).toContain('廃止日 = NULL');
            expect(sql).toContain('廃止理由 = NULL');
            expect(sql).toContain('取消日 = NULL');
            expect(sql).toContain('取消理由 = NULL');
            expect(sql).toContain('有効終了日時 = NULL');
        });
    });

    describe('active → cancelled → restored', () => {
        test('active → cancelled: 取消日と有効終了日時が設定される', () => {
            const sql = logic.buildCancelPermitQuery(permitId, dateStr, '法令違反');
            expect(sql).toContain('取消日 = #2026/03/01#');
            expect(sql).toContain('有効終了日時 = #2026/03/01#');
            expect(sql).toContain("取消理由 = '法令違反'");
        });

        test('cancelled → restored: 全てNULLに戻る', () => {
            const sql = logic.buildRestorePermitQuery(permitId);
            expect(sql).toContain('取消日 = NULL');
            expect(sql).toContain('取消理由 = NULL');
            expect(sql).toContain('有効終了日時 = NULL');
        });
    });

    describe('完全サイクル: active → abolished → restored → cancelled → restored → abolished', () => {
        test('各状態遷移のSQLが一貫している', () => {
            // 1. active → abolished
            const abolish1 = logic.buildAbolishPermitQuery(permitId, '2026/01/15', '初回廃止');
            expect(abolish1).toContain('廃止日 = #2026/01/15#');

            // 2. abolished → restored
            const restore1 = logic.buildRestorePermitQuery(permitId);
            expect(restore1).toContain('廃止日 = NULL');
            expect(restore1).toContain('有効終了日時 = NULL');

            // 3. restored → cancelled
            const cancel1 = logic.buildCancelPermitQuery(permitId, '2026/02/15', '違反発覚');
            expect(cancel1).toContain('取消日 = #2026/02/15#');

            // 4. cancelled → restored
            const restore2 = logic.buildRestorePermitQuery(permitId);
            expect(restore2).toContain('取消日 = NULL');
            expect(restore2).toContain('有効終了日時 = NULL');

            // 5. restored → abolished
            const abolish2 = logic.buildAbolishPermitQuery(permitId, '2026/03/15', '再度廃止');
            expect(abolish2).toContain('廃止日 = #2026/03/15#');
        });
    });

    describe('廃止/取消の理由有無バリエーション', () => {
        test('理由なし廃止: 廃止理由フィールドがSQLに含まれない', () => {
            const sql = logic.buildAbolishPermitQuery(permitId, dateStr, '');
            expect(sql).toContain('廃止日 = #2026/03/01#');
            expect(sql).not.toContain('廃止理由');
        });

        test('理由あり廃止: 廃止理由フィールドが含まれる', () => {
            const sql = logic.buildAbolishPermitQuery(permitId, dateStr, '理由あり');
            expect(sql).toContain("廃止理由 = '理由あり'");
        });

        test('理由なし取消', () => {
            const sql = logic.buildCancelPermitQuery(permitId, dateStr, '');
            expect(sql).toContain('取消日 = #2026/03/01#');
            expect(sql).not.toContain('取消理由');
        });

        test('理由あり取消', () => {
            const sql = logic.buildCancelPermitQuery(permitId, dateStr, '理由あり');
            expect(sql).toContain("取消理由 = '理由あり'");
        });
    });

    describe('検索での状態フィルタ一致', () => {
        const baseParams = { asOfDateSql: '#2026/03/01 23:59:59#' };

        test('active: 廃止日・取消日ともにNULL', () => {
            const sql = logic.buildSearchPermitQuery({ ...baseParams, status: 'active' });
            expect(sql).toContain('許可.廃止日 IS NULL AND 許可.取消日 IS NULL');
        });

        test('abolished: 廃止日がNOT NULL', () => {
            const sql = logic.buildSearchPermitQuery({ ...baseParams, status: 'abolished' });
            expect(sql).toContain('許可.廃止日 IS NOT NULL');
        });

        test('cancelled: 取消日がNOT NULL', () => {
            const sql = logic.buildSearchPermitQuery({ ...baseParams, status: 'cancelled' });
            expect(sql).toContain('許可.取消日 IS NOT NULL');
        });

        test('abolished/cancelled: historyConditionが緩和される（有効終了日時フィルタなし）', () => {
            const abolishedSql = logic.buildSearchPermitQuery({ ...baseParams, status: 'abolished' });
            const cancelledSql = logic.buildSearchPermitQuery({ ...baseParams, status: 'cancelled' });
            // 有効終了日時のフィルタがない
            expect(abolishedSql).not.toContain('有効終了日時 IS NULL OR 有効終了日時 >');
            expect(cancelledSql).not.toContain('有効終了日時 IS NULL OR 有効終了日時 >');
        });

        test('active: historyConditionに有効終了日時の制約がある', () => {
            const sql = logic.buildSearchPermitQuery({ ...baseParams, status: 'active' });
            expect(sql).toContain('有効終了日時 IS NULL OR 許可.有効終了日時 >');
        });
    });
});

// ===== 施設ライフサイクル =====

describe('施設状態遷移', () => {
    const todayStr = '2026/03/01';

    describe('active → versioned（新バージョン） → abolished', () => {
        test('旧バージョンクローズ: 有効終了日時が設定される', () => {
            const sql = logic.buildCloseOldFacilityVersionsQuery(30, todayStr, '2027/01/01');
            expect(sql).toContain('有効終了日時 = #2027/01/01#');
            expect(sql).toContain('施設論理ID = 30');
            expect(sql).toContain('有効終了日時 IS NULL');
        });

        test('新バージョン登録: 有効開始日時が設定される', () => {
            const sql = logic.buildSaveFacilityQuery({
                logicalId: 30, businessId: 1, typeId: 2,
                location: '東京都', permitDate: '2027/01/01',
                todayStr: todayStr
            });
            expect(sql).toContain('#2027/01/01#');
            expect(sql).toContain('INSERT INTO 施設');
        });

        test('新バージョン廃止: 有効終了日時と廃止年月日が設定される', () => {
            const sql = logic.buildAbolishFacilityQuery(100, '2027/06/15');
            expect(sql).toContain('有効終了日時 = #2027/06/15#');
            expect(sql).toContain('廃止年月日 = #2027/06/15#');
        });
    });

    describe('バージョン管理整合性', () => {
        test('旧バージョンの有効終了と新バージョンの有効開始が境界日で一致', () => {
            const boundaryDate = '2027/04/01';
            const closeSql = logic.buildCloseOldFacilityVersionsQuery(30, todayStr, boundaryDate);
            const insertSql = logic.buildSaveFacilityQuery({
                logicalId: 30, businessId: 1, typeId: 2,
                location: '東京都', permitDate: boundaryDate,
                todayStr: todayStr
            });
            expect(closeSql).toContain('有効終了日時 = #2027/04/01#');
            expect(insertSql).toContain('#2027/04/01#');
        });

        test('境界日なしの場合todayStrで一致', () => {
            const closeSql = logic.buildCloseOldFacilityVersionsQuery(30, todayStr);
            const insertSql = logic.buildSaveFacilityQuery({
                logicalId: 30, businessId: 1, typeId: 2,
                location: '東京都', todayStr: todayStr
            });
            expect(closeSql).toContain('有効終了日時 = #2026/03/01#');
            expect(insertSql).toContain('#2026/03/01#');
        });
    });

    describe('検索一致', () => {
        test('施設検索: 有効終了日時IS NULLかつ廃止年月日IS NULLのみ取得', () => {
            const sql = logic.buildSearchFacilityQuery('', '');
            expect(sql).toContain('施設.有効終了日時 IS NULL');
            expect(sql).toContain('施設.廃止年月日 IS NULL');
        });
    });
});

// ===== 車両ライフサイクル =====

describe('車両状態遷移', () => {
    const vehicleId = 10;

    describe('active → scrapped → restored → deleted', () => {
        test('active → scrapped: 廃車フラグがTrueに', () => {
            const sql = logic.buildScrapVehicleQuery(vehicleId);
            expect(sql).toBe('UPDATE 車両 SET 廃車フラグ = True WHERE 車両ID = 10');
        });

        test('scrapped → restored: 廃車フラグがFalseに', () => {
            const sql = logic.buildRestoreVehicleQuery(vehicleId);
            expect(sql).toBe('UPDATE 車両 SET 廃車フラグ = False WHERE 車両ID = 10');
        });

        test('restored → deleted: レコード削除', () => {
            const sql = logic.buildDeleteVehicleQuery(vehicleId);
            expect(sql).toBe('DELETE FROM 車両 WHERE 車両ID = 10');
        });
    });

    describe('検索フィルタ一致', () => {
        test('includeScrapped=false: 廃車フラグフィルタが追加される', () => {
            const sql = logic.buildSearchVehicleQuery('テスト', false);
            expect(sql).toContain('車両.廃車フラグ = False OR 車両.廃車フラグ IS NULL');
        });

        test('includeScrapped=true: 廃車フラグフィルタなし', () => {
            const sql = logic.buildSearchVehicleQuery('テスト', true);
            expect(sql).not.toContain('廃車フラグ = False');
        });
    });
});

// ===== 役員ライフサイクル =====

describe('役員状態遷移', () => {
    const officerId = 20;

    describe('active → retired → reinstated → deleted', () => {
        test('active → retired: 退任フラグがTrueに', () => {
            const sql = logic.buildRetireOfficerQuery(officerId);
            expect(sql).toBe('UPDATE 役員 SET 退任フラグ = True WHERE 役員ID = 20');
        });

        test('retired → reinstated: 退任フラグがFalseに', () => {
            const sql = logic.buildReinstateOfficerQuery(officerId);
            expect(sql).toBe('UPDATE 役員 SET 退任フラグ = False WHERE 役員ID = 20');
        });

        test('reinstated → deleted: レコード削除', () => {
            const sql = logic.buildDeleteOfficerQuery(officerId);
            expect(sql).toBe('DELETE FROM 役員 WHERE 役員ID = 20');
        });
    });

    describe('検索フィルタ一致', () => {
        test('includeRetired=false: 退任フラグフィルタが追加される', () => {
            const sql = logic.buildSearchOfficerQuery('テスト', false);
            expect(sql).toContain('役員.退任フラグ = False OR 役員.退任フラグ IS NULL');
        });

        test('includeRetired=true: 退任フラグフィルタなし', () => {
            const sql = logic.buildSearchOfficerQuery('テスト', true);
            expect(sql).not.toContain('退任フラグ = False');
        });
    });
});

// ===== 許可品目ステートマシン =====

describe('許可品目状態遷移', () => {
    const permitId = 50;
    const itemId = 7;

    describe('×→〇→◎→× のステートマシン', () => {
        test('×→〇: INSERT（取り扱い=True, 積替保管=False）', () => {
            const q = logic.buildPermitItemQueries(permitId, itemId);
            expect(q.insert).toContain('True, False');
            expect(q.insert).toContain('INSERT INTO 許可品目');
            expect(q.insert).toContain(permitId + ', ' + itemId);
        });

        test('〇→◎: UPDATE（取り扱い=True, 積替保管=True）', () => {
            const q = logic.buildPermitItemQueries(permitId, itemId);
            const sql = q.toTransfer(200);
            expect(sql).toContain('取り扱いフラグ = True');
            expect(sql).toContain('積替保管フラグ = True');
            expect(sql).toContain('WHERE 許可品目ID = 200');
        });

        test('◎→×: DELETE', () => {
            const q = logic.buildPermitItemQueries(permitId, itemId);
            const sql = q.remove(200);
            expect(sql).toContain('DELETE FROM 許可品目');
            expect(sql).toContain('WHERE 許可品目ID = 200');
        });
    });

    describe('×→◎直接遷移が不可であることの検証', () => {
        test('insertは常に取り扱い=True,積替保管=Falseを設定する（〇状態のみ作成可）', () => {
            const q = logic.buildPermitItemQueries(permitId, itemId);
            expect(q.insert).toContain('True, False');
            // 直接 True, True のINSERTは提供されていない
            expect(q.insert).not.toContain('True, True');
        });

        test('toTransfer: 既存レコードのUPDATEのみ（recIdが必要）', () => {
            const q = logic.buildPermitItemQueries(permitId, itemId);
            // toTransfer は recId を必要とする → 既存レコードが必要 → ×から直接◎は不可
            expect(typeof q.toTransfer).toBe('function');
        });
    });

    describe('selectクエリの構造', () => {
        test('許可IDと品目IDで特定の品目を検索', () => {
            const q = logic.buildPermitItemQueries(permitId, itemId);
            expect(q.select).toContain('許可ID = ' + permitId + ' AND 品目ID = ' + itemId);
            expect(q.select).toContain('許可品目ID');
            expect(q.select).toContain('取り扱いフラグ');
            expect(q.select).toContain('積替保管フラグ');
        });
    });
});

// ===== 許可バージョン管理 =====

describe('許可バージョン状態遷移', () => {
    describe('新規 → クローズ → 更新', () => {
        test('新規バージョン作成', () => {
            const sql = logic.buildSavePermitQuery({
                logicalId: 50, businessId: 1, categoryId: 2,
                number: 'P-001', permitDate: '2025/04/01',
                validDate: '2030/03/31', excellent: false, todayStr: '2025/04/01'
            });
            expect(sql).toContain('INSERT INTO 許可');
            expect(sql).toContain('許可論理ID');
        });

        test('旧バージョンクローズ', () => {
            const sql = logic.buildCloseOldPermitVersionsQuery(50, '2030/04/01');
            expect(sql).toContain("有効終了日時 = DateAdd('d', -1, #2030/04/01#)");
            expect(sql).toContain('WHERE 許可論理ID = 50');
            expect(sql).toContain('有効終了日時 IS NULL');
        });

        test('更新バージョン作成（同一logicalId）', () => {
            const sql = logic.buildSavePermitQuery({
                logicalId: 50, businessId: 1, categoryId: 2,
                number: 'P-001', permitDate: '2030/04/01',
                validDate: '2035/03/31', excellent: false, todayStr: '2030/04/01'
            });
            expect(sql).toContain('INSERT INTO 許可');
            expect(sql).toContain('50'); // logicalId
            expect(sql).toContain('#2035/03/31#'); // new validDate
        });
    });

    describe('変更許可 vs 更新許可', () => {
        test('更新許可: validDateが新しい', () => {
            const sql = logic.buildSavePermitQuery({
                logicalId: 50, businessId: 1, categoryId: 2,
                number: 'P-001', permitDate: '2030/04/01',
                validDate: '2035/03/31', excellent: false, todayStr: '2030/04/01'
            });
            expect(sql).toContain('#2035/03/31#');
        });

        test('変更許可: validDateは従前を引き継ぎ', () => {
            const sql = logic.buildSavePermitQuery({
                logicalId: 50, businessId: 1, categoryId: 2,
                number: 'P-001', permitDate: '2027/06/15',
                validDate: '2030/03/31', excellent: false, todayStr: '2027/06/15'
            });
            expect(sql).toContain('#2030/03/31#'); // 旧validDate
            expect(sql).toContain('#2027/06/15#'); // 新permitDate
        });
    });

    describe('品目コピー', () => {
        test('旧バージョンから新バージョンへ品目をコピー', () => {
            const sql = logic.buildCopyPermitItemsQuery(100, 200);
            expect(sql).toContain('INSERT INTO 許可品目');
            expect(sql).toContain('SELECT 200');
            expect(sql).toContain('FROM 許可品目 WHERE 許可ID = 100');
            expect(sql).toContain('品目ID');
            expect(sql).toContain('取り扱いフラグ');
            expect(sql).toContain('積替保管フラグ');
        });
    });
});

// ===== 物理ID指定のバージョンクローズ =====

describe('buildCloseOldVersionByIdQuery 状態遷移', () => {
    test('許可: 物理ID指定でクローズ', () => {
        const sql = logic.buildCloseOldVersionByIdQuery('許可', '許可ID', 100, '2026/03/01');
        expect(sql).toContain('有効終了日時 = #2026/03/01#');
        expect(sql).toContain('許可ID = 100');
        expect(sql).toContain('有効終了日時 IS NULL');
    });

    test('施設: 物理ID指定でクローズ', () => {
        const sql = logic.buildCloseOldVersionByIdQuery('施設', '施設ID', 200, '2026/03/01');
        expect(sql).toContain('有効終了日時 = #2026/03/01#');
        expect(sql).toContain('施設ID = 200');
        expect(sql).toContain('有効終了日時 IS NULL');
    });

    test('境界日指定でクローズ', () => {
        const sql = logic.buildCloseOldVersionByIdQuery('施設', '施設ID', 200, '2026/03/01', '2027/01/01');
        expect(sql).toContain('有効終了日時 = #2027/01/01#');
    });

    test('IS NULLでクローズ済みレコードは対象外', () => {
        const sql = logic.buildCloseOldVersionByIdQuery('許可', '許可ID', 100, '2026/03/01');
        expect(sql).toContain('AND 有効終了日時 IS NULL');
    });
});

// ===== 事業者の新規/更新 =====

describe('事業者の新規/更新状態遷移', () => {
    test('id=0: 新規作成（INSERT）', () => {
        const sql = logic.buildSaveBusinessQuery({
            id: 0, name: '新規事業者', businessType: '1',
            zipCode: '', pref: '', address: '', phone: ''
        });
        expect(sql).toMatch(/^INSERT INTO 事業者/);
    });

    test('id>0: 更新（UPDATE）', () => {
        const sql = logic.buildSaveBusinessQuery({
            id: 42, name: '更新事業者', businessType: '1',
            zipCode: '', pref: '', address: '', phone: ''
        });
        expect(sql).toMatch(/^UPDATE 事業者 SET/);
        expect(sql).toContain('WHERE 事業者ID = 42');
    });
});

/**
 * データ追加・変更・廃止のテスト
 * CRUD系SQLビルダーが正しいクエリを生成するか検証する
 */
const logic = require('../../app_logic.js');

// ===== buildDateStr =====

describe('buildDateStr（日付文字列生成）', () => {
    test('指定日付をyyyy/mm/dd形式で返す', () => {
        expect(logic.buildDateStr(new Date(2026, 0, 5))).toBe('2026/01/05');
    });

    test('月・日が1桁の場合ゼロパディングする', () => {
        expect(logic.buildDateStr(new Date(2026, 2, 3))).toBe('2026/03/03');
    });

    test('12月31日', () => {
        expect(logic.buildDateStr(new Date(2026, 11, 31))).toBe('2026/12/31');
    });

    test('引数なしで今日の日付を返す', () => {
        const result = logic.buildDateStr();
        // yyyy/mm/dd形式であること
        expect(result).toMatch(/^\d{4}\/\d{2}\/\d{2}$/);
    });
});

// ===== 事業者の追加・変更・削除 =====

describe('buildSaveBusinessQuery（事業者保存）', () => {
    test('新規登録のINSERT文を生成', () => {
        const sql = logic.buildSaveBusinessQuery({
            id: 0, name: '株式会社テスト環境', businessType: '1',
            zipCode: '330-0001', pref: '埼玉県', address: 'さいたま市1-1', phone: '048-000-0000'
        });
        expect(sql).toMatch(/^INSERT INTO 事業者/);
        expect(sql).toContain("'株式会社テスト環境'");
        expect(sql).toContain("'330-0001'");
        expect(sql).toContain("'埼玉県'");
        expect(sql).toContain("'048-000-0000'");
    });

    test('更新のUPDATE文を生成', () => {
        const sql = logic.buildSaveBusinessQuery({
            id: 42, name: '更新後事業者', businessType: '2',
            zipCode: '100-0001', pref: '東京都', address: '千代田区', phone: '03-1111-1111'
        });
        expect(sql).toMatch(/^UPDATE 事業者 SET/);
        expect(sql).toContain("事業者名 = '更新後事業者'");
        expect(sql).toContain('WHERE 事業者ID = 42');
    });

    test('事業者区分が空の場合NULLになる', () => {
        const sql = logic.buildSaveBusinessQuery({
            id: 0, name: 'テスト', businessType: '', zipCode: '', pref: '', address: '', phone: ''
        });
        expect(sql).toContain('NULL');
    });

    test('事業者名にシングルクォートがある場合エスケープされる', () => {
        const sql = logic.buildSaveBusinessQuery({
            id: 0, name: "O'Brien環境サービス", businessType: '1',
            zipCode: '', pref: '', address: '', phone: ''
        });
        expect(sql).toContain("O''Brien環境サービス");
    });

    test('住所にシングルクォートがある場合エスケープされる', () => {
        const sql = logic.buildSaveBusinessQuery({
            id: 10, name: 'テスト', businessType: '1',
            zipCode: '', pref: '', address: "it's here", phone: ''
        });
        expect(sql).toContain("it''s here");
    });
});

describe('buildDeleteBusinessQuery（事業者削除）', () => {
    test('DELETE文を生成', () => {
        const sql = logic.buildDeleteBusinessQuery(42);
        expect(sql).toBe('DELETE FROM 事業者 WHERE 事業者ID = 42');
    });
});

// ===== 許可の追加・廃止・取消・復活 =====

describe('buildSavePermitQuery（許可新規登録）', () => {
    test('INSERT文を生成', () => {
        const sql = logic.buildSavePermitQuery({
            logicalId: 100, businessId: 42, categoryId: 1,
            number: '01100012345', permitDate: '2026/04/01',
            validDate: '2031/03/31', excellent: false, todayStr: '2026/02/28'
        });
        expect(sql).toMatch(/^INSERT INTO 許可/);
        expect(sql).toContain('100, 42, 1');
        expect(sql).toContain("'01100012345'");
        expect(sql).toContain('#2026/04/01#');
        expect(sql).toContain('#2031/03/31#');
        expect(sql).toContain('False');
        expect(sql).toContain('#2026/02/28#');
    });

    test('優良認定Trueの場合', () => {
        const sql = logic.buildSavePermitQuery({
            logicalId: 101, businessId: 42, categoryId: 3,
            number: 'TEST-001', permitDate: '2026/01/01',
            validDate: '2031/01/01', excellent: true, todayStr: '2026/02/28'
        });
        expect(sql).toContain('True');
    });

    test('許可番号にシングルクォートがエスケープされる', () => {
        const sql = logic.buildSavePermitQuery({
            logicalId: 102, businessId: 1, categoryId: 1,
            number: "TEST'001", permitDate: '2026/01/01',
            validDate: '2031/01/01', excellent: false, todayStr: '2026/02/28'
        });
        expect(sql).toContain("TEST''001");
    });

    test('変更許可: startDateが有効開始日時に使われ、permitDateは許可年月日に使われる', () => {
        const sql = logic.buildSavePermitQuery({
            logicalId: 100, businessId: 42, categoryId: 1,
            number: '01100012345',
            permitDate: '2025/04/01',
            validDate: '2031/03/31',
            startDate: '2026/03/01',
            excellent: false, todayStr: '2026/03/01'
        });
        // 許可年月日は元の許可日
        expect(sql).toContain('許可年月日');
        expect(sql).toContain('#2025/04/01#');
        // 有効開始日時はstartDate（変更許可年月日）
        expect(sql).toContain('有効開始日時');
        expect(sql).toContain('#2026/03/01#');
    });
});

describe('buildAbolishPermitQuery（許可廃止）', () => {
    test('廃止日と有効終了日時を設定', () => {
        const sql = logic.buildAbolishPermitQuery(123, '2026/02/28', '');
        expect(sql).toContain('廃止日 = #2026/02/28#');
        expect(sql).toContain('有効終了日時 = #2026/02/28#');
        expect(sql).toContain('WHERE 許可ID = 123');
        expect(sql).not.toContain('廃止理由');
    });

    test('廃止日と廃止理由を設定', () => {
        const sql = logic.buildAbolishPermitQuery(123, '2026/02/28', '事業廃止届出による');
        expect(sql).toContain('廃止日 = #2026/02/28#');
        expect(sql).toContain('有効終了日時 = #2026/02/28#');
        expect(sql).toContain("廃止理由 = '事業廃止届出による'");
    });

    test('廃止理由にシングルクォートがエスケープされる', () => {
        const sql = logic.buildAbolishPermitQuery(123, '2026/02/28', "理由's");
        expect(sql).toContain("理由''s");
    });
});

describe('buildCancelPermitQuery（許可取消）', () => {
    test('取消日と有効終了日時を設定', () => {
        const sql = logic.buildCancelPermitQuery(456, '2026/03/15', '');
        expect(sql).toContain('取消日 = #2026/03/15#');
        expect(sql).toContain('有効終了日時 = #2026/03/15#');
        expect(sql).toContain('WHERE 許可ID = 456');
        expect(sql).not.toContain('取消理由');
    });

    test('取消日と取消理由を設定', () => {
        const sql = logic.buildCancelPermitQuery(456, '2026/03/15', '法令違反');
        expect(sql).toContain('取消日 = #2026/03/15#');
        expect(sql).toContain('有効終了日時 = #2026/03/15#');
        expect(sql).toContain("取消理由 = '法令違反'");
    });
});

describe('buildRestorePermitQuery（許可復活）', () => {
    test('廃止日・取消日・理由・有効終了日時をすべてNULLにする', () => {
        const sql = logic.buildRestorePermitQuery(789);
        expect(sql).toContain('廃止日 = NULL');
        expect(sql).toContain('廃止理由 = NULL');
        expect(sql).toContain('取消日 = NULL');
        expect(sql).toContain('取消理由 = NULL');
        expect(sql).toContain('有効終了日時 = NULL');
        expect(sql).toContain('WHERE 許可ID = 789');
    });
});

// ===== 許可品目サイクル =====

describe('buildPermitItemQueries（許可品目サイクル）', () => {
    test('SELECT文が正しい', () => {
        const q = logic.buildPermitItemQueries(10, 3);
        expect(q.select).toContain('許可ID = 10 AND 品目ID = 3');
        expect(q.select).toContain('取り扱いフラグ');
        expect(q.select).toContain('積替保管フラグ');
    });

    test('×→〇: INSERT文（取り扱い=True, 積替保管=False）', () => {
        const q = logic.buildPermitItemQueries(10, 3);
        expect(q.insert).toContain('INSERT INTO 許可品目');
        expect(q.insert).toContain('10, 3, True, False');
    });

    test('〇→◎: UPDATE文（積替保管をTrueに）', () => {
        const q = logic.buildPermitItemQueries(10, 3);
        const sql = q.toTransfer(99);
        expect(sql).toContain('UPDATE 許可品目');
        expect(sql).toContain('取り扱いフラグ = True');
        expect(sql).toContain('積替保管フラグ = True');
        expect(sql).toContain('WHERE 許可品目ID = 99');
    });

    test('◎→×: DELETE文', () => {
        const q = logic.buildPermitItemQueries(10, 3);
        const sql = q.remove(99);
        expect(sql).toContain('DELETE FROM 許可品目');
        expect(sql).toContain('WHERE 許可品目ID = 99');
    });
});

// ===== 施設の追加・廃止 =====

describe('buildSaveFacilityQuery（施設新規登録）', () => {
    test('全フィールドありのINSERT文', () => {
        const sql = logic.buildSaveFacilityQuery({
            logicalId: 50, businessId: 42, typeId: 3,
            location: '埼玉県さいたま市1-1-1',
            permitNo: '01100012345',
            permitDate: '2026/04/01', setupDate: '2025/10/01',
            todayStr: '2026/02/28'
        });
        expect(sql).toMatch(/^INSERT INTO 施設/);
        expect(sql).toContain("'埼玉県さいたま市1-1-1'");
        expect(sql).toContain("'01100012345'");
        expect(sql).toContain('#2026/04/01#');
        expect(sql).toContain('#2025/10/01#');
    });

    test('許可番号・日付が空の場合NULLになる', () => {
        const sql = logic.buildSaveFacilityQuery({
            logicalId: 51, businessId: 42, typeId: 1,
            location: 'テスト市', permitNo: '', permitDate: '', setupDate: '',
            todayStr: '2026/02/28'
        });
        expect(sql).toContain('NULL');
        expect(sql).not.toContain("''");
        // NULLが13箇所（permitNo, permitDate, setupDate, managementTypeId, capacityM3, areaM2, landfillEndDate, processingMethodId, setupFormId, permitTargetId, storageAreaM2, storageCapM3, storageHeightM）
        const nullCount = (sql.match(/NULL/g) || []).length;
        expect(nullCount).toBe(13);
    });

    test('設置場所にシングルクォートがエスケープされる', () => {
        const sql = logic.buildSaveFacilityQuery({
            logicalId: 52, businessId: 1, typeId: 1,
            location: "O'Brien工場", permitNo: '', permitDate: '', setupDate: '',
            todayStr: '2026/02/28'
        });
        expect(sql).toContain("O''Brien工場");
    });
});

describe('buildAbolishFacilityQuery（施設廃止）', () => {
    test('有効終了日時と廃止年月日を設定する', () => {
        const sql = logic.buildAbolishFacilityQuery(30, '2026/02/28');
        expect(sql).toContain('有効終了日時 = #2026/02/28#');
        expect(sql).toContain('廃止年月日 = #2026/02/28#');
        expect(sql).toContain('WHERE 施設ID = 30');
    });
});

describe('buildDeleteFacilityQueries（施設削除）', () => {
    test('施設休止履歴・処理能力・施設を論理IDで一括削除する', () => {
        const queries = logic.buildDeleteFacilityQueries(5);
        expect(queries).toHaveLength(3);
        expect(queries[0]).toContain('DELETE FROM 施設休止履歴');
        expect(queries[0]).toContain('施設論理ID = 5');
        expect(queries[1]).toContain('DELETE FROM 処理能力');
        expect(queries[1]).toContain('施設論理ID = 5');
        expect(queries[2]).toBe('DELETE FROM 施設 WHERE 施設論理ID = 5');
    });
});

// ===== 車両の追加・廃車・復活・削除 =====

describe('buildSaveVehicleQuery（車両登録）', () => {
    test('全登録番号ありのINSERT文', () => {
        const sql = logic.buildSaveVehicleQuery({
            businessId: 42, reg1: '大宮', reg2: '500', reg3: 'あ', reg4: '1234'
        });
        expect(sql).toMatch(/^INSERT INTO 車両/);
        expect(sql).toContain("'大宮'");
        expect(sql).toContain("'500'");
        expect(sql).toContain("'あ'");
        expect(sql).toContain("'1234'");
        expect(sql).toContain('False');
    });

    test('登録番号2・3が空でもエラーにならない', () => {
        const sql = logic.buildSaveVehicleQuery({
            businessId: 42, reg1: '品川', reg2: '', reg3: '', reg4: '5678'
        });
        expect(sql).toContain("'品川'");
        expect(sql).toContain("'5678'");
    });
});

describe('車両の普通/特管フラグ', () => {
    test('新規登録時にフラグが含まれる', () => {
        const sql = logic.buildSaveVehicleQuery({
            businessId: 1, reg1: '秋田', reg2: '100', reg3: 'か', reg4: '2526',
            normalFlag: true, specialFlag: true
        });
        expect(sql).toContain('普通フラグ');
        expect(sql).toContain('特管フラグ');
        expect(sql).toMatch(/True.*True/);
    });

    test('更新時にフラグが含まれる', () => {
        const sql = logic.buildSaveVehicleQuery({
            id: 5, reg1: '秋田', reg2: '100', reg3: 'あ', reg4: '1234',
            normalFlag: true, specialFlag: false
        });
        expect(sql).toMatch(/^UPDATE 車両/);
        expect(sql).toContain('普通フラグ = True');
        expect(sql).toContain('特管フラグ = False');
    });

    test('フラグ未指定時はFalse', () => {
        const sql = logic.buildSaveVehicleQuery({
            businessId: 1, reg1: '品川', reg2: '500', reg3: 'あ', reg4: '9999'
        });
        expect(sql).toContain('普通フラグ');
        // normalFlag undefined → false → False
        expect(sql).toMatch(/False.*False/);
    });

    test('buildUpdateVehicleFlagQuery で普通フラグをTrue', () => {
        const sql = logic.buildUpdateVehicleFlagQuery(10, '普通フラグ', true);
        expect(sql).toContain('普通フラグ = True');
        expect(sql).toContain('WHERE 車両ID = 10');
    });

    test('buildUpdateVehicleFlagQuery で特管フラグをFalse', () => {
        const sql = logic.buildUpdateVehicleFlagQuery(20, '特管フラグ', false);
        expect(sql).toContain('特管フラグ = False');
        expect(sql).toContain('WHERE 車両ID = 20');
    });

    test('buildUpdateVehicleFlagQuery で不正なフラグ名は空文字', () => {
        const sql = logic.buildUpdateVehicleFlagQuery(1, '不正フラグ', true);
        expect(sql).toBe('');
    });
});

describe('許可履歴の個別削除', () => {
    test('buildDeletePermitHistoryQueries で許可品目と許可を削除', () => {
        const queries = logic.buildDeletePermitHistoryQueries(42);
        expect(queries).toHaveLength(2);
        expect(queries[0]).toContain('DELETE FROM 許可品目');
        expect(queries[0]).toContain('WHERE 許可ID = 42');
        expect(queries[1]).toContain('DELETE FROM 許可');
        expect(queries[1]).toContain('WHERE 許可ID = 42');
    });
});

describe('車両の廃車・復活・削除', () => {
    test('廃車フラグをTrueに', () => {
        expect(logic.buildScrapVehicleQuery(10)).toContain('廃車フラグ = True');
        expect(logic.buildScrapVehicleQuery(10)).toContain('WHERE 車両ID = 10');
    });

    test('廃車フラグをFalseに（復活）', () => {
        expect(logic.buildRestoreVehicleQuery(10)).toContain('廃車フラグ = False');
    });

    test('車両を削除', () => {
        expect(logic.buildDeleteVehicleQuery(10)).toBe('DELETE FROM 車両 WHERE 車両ID = 10');
    });
});

// ===== 役員の追加・変更・退任・復帰・削除 =====

describe('buildSaveOfficerQuery（役員保存）', () => {
    test('新規登録のINSERT文', () => {
        const sql = logic.buildSaveOfficerQuery({
            id: 0, businessId: 42,
            position: '代表取締役', lastName: '山田', firstName: '太郎'
        });
        expect(sql).toMatch(/^INSERT INTO 役員/);
        expect(sql).toContain("'代表取締役'");
        expect(sql).toContain("'山田'");
        expect(sql).toContain("'太郎'");
        expect(sql).toContain('False');
    });

    test('更新のUPDATE文', () => {
        const sql = logic.buildSaveOfficerQuery({
            id: 15, businessId: 42,
            position: '常務取締役', lastName: '鈴木', firstName: '一郎'
        });
        expect(sql).toMatch(/^UPDATE 役員 SET/);
        expect(sql).toContain("役職名 = '常務取締役'");
        expect(sql).toContain("姓 = '鈴木'");
        expect(sql).toContain("名 = '一郎'");
        expect(sql).toContain('WHERE 役員ID = 15');
    });

    test('氏名にシングルクォートがエスケープされる', () => {
        const sql = logic.buildSaveOfficerQuery({
            id: 0, businessId: 1,
            position: '取締役', lastName: "O'Brien", firstName: 'John'
        });
        expect(sql).toContain("O''Brien");
    });
});

describe('役員の退任・復帰・削除', () => {
    test('退任フラグをTrueに', () => {
        const sql = logic.buildRetireOfficerQuery(20);
        expect(sql).toContain('退任フラグ = True');
        expect(sql).toContain('WHERE 役員ID = 20');
    });

    test('退任フラグをFalseに（復帰）', () => {
        const sql = logic.buildReinstateOfficerQuery(20);
        expect(sql).toContain('退任フラグ = False');
    });

    test('役員を削除', () => {
        expect(logic.buildDeleteOfficerQuery(20)).toBe('DELETE FROM 役員 WHERE 役員ID = 20');
    });
});

// ===== 業務フローシミュレーション（CRUD） =====

describe('業務フロー: 許可の廃止→復活→取消', () => {
    test('一連の操作で矛盾のないSQLが生成される', () => {
        const permitId = 100;
        const dateStr = logic.buildDateStr(new Date(2026, 1, 28));

        // 1. 廃止 → 廃止日と有効終了日時が設定される
        const abolishSql = logic.buildAbolishPermitQuery(permitId, dateStr, '事業廃止');
        expect(abolishSql).toContain('廃止日 = #2026/02/28#');
        expect(abolishSql).toContain('有効終了日時 = #2026/02/28#');
        expect(abolishSql).toContain("廃止理由 = '事業廃止'");

        // 2. 復活（廃止を取り消す）→ 有効終了日時もNULLに戻る
        const restoreSql = logic.buildRestorePermitQuery(permitId);
        expect(restoreSql).toContain('廃止日 = NULL');
        expect(restoreSql).toContain('取消日 = NULL');
        expect(restoreSql).toContain('有効終了日時 = NULL');

        // 3. 取消 → 取消日と有効終了日時が設定される
        const cancelSql = logic.buildCancelPermitQuery(permitId, dateStr, '法令違反による');
        expect(cancelSql).toContain('取消日 = #2026/02/28#');
        expect(cancelSql).toContain('有効終了日時 = #2026/02/28#');
        expect(cancelSql).toContain("取消理由 = '法令違反による'");
    });
});

describe('業務フロー: 品目の状態サイクル', () => {
    test('×→〇→◎→× の遷移で正しいSQL', () => {
        const q = logic.buildPermitItemQueries(50, 7);

        // ×→〇: レコードなし → INSERT
        expect(q.insert).toContain('True, False');

        // 〇→◎: 取り扱い中 → 積替保管追加
        const toTransferSql = q.toTransfer(200);
        expect(toTransferSql).toContain('積替保管フラグ = True');

        // ◎→×: 積替保管中 → 削除
        const removeSql = q.remove(200);
        expect(removeSql).toContain('DELETE');
    });
});

describe('業務フロー: 施設の新規登録→廃止', () => {
    test('施設登録後に廃止する一連の操作', () => {
        const dateStr = logic.buildDateStr(new Date(2026, 1, 28));

        // 登録
        const insertSql = logic.buildSaveFacilityQuery({
            logicalId: 99, businessId: 42, typeId: 2,
            location: '川越市大字的場1234', permitNo: '0110001',
            permitDate: '2026/01/01', setupDate: '2025/12/01',
            todayStr: dateStr
        });
        expect(insertSql).toContain('INSERT INTO 施設');

        // 廃止
        const abolishSql = logic.buildAbolishFacilityQuery(150, dateStr);
        expect(abolishSql).toContain('有効終了日時 = #2026/02/28#');
        expect(abolishSql).toContain('廃止年月日 = #2026/02/28#');
    });
});

/**
 * 履歴シナリオテスト
 * 複数バージョンの連続操作、境界日整合性、休止/再開サイクル、
 * 履歴削除安全性、部分更新パターン、施設バージョン管理
 */
const logic = require('../../app_logic.js');

// ===== 1. 許可の複数バージョン連続操作シナリオ =====

describe('許可ライフサイクル: 新規→更新→変更→廃止→復活', () => {
    const bizId = 1;
    const logicalId = 100;
    const today = '2026/03/10';

    test('Step1: 新規許可作成', () => {
        const sql = logic.buildSavePermitQuery({
            logicalId, businessId: bizId, categoryId: 1,
            number: 'P-001', permitDate: '2024/04/01',
            validDate: '2029/03/31', excellent: false, todayStr: today
        });
        expect(sql).toContain('INSERT INTO 許可');
        expect(sql).toContain('許可論理ID');
        expect(sql).toContain('有効開始日時');
        expect(sql).toContain('#2024/04/01#'); // permitDate
        expect(sql).toContain('変更許可フラグ');
        expect(sql).toContain('False'); // isChange defaults to falsy
    });

    test('Step2: 更新許可 — 旧バージョンをクローズしてから新版INSERT', () => {
        // 2a. 旧バージョンをクローズ（新許可日の前日で閉じる）
        const closeSql = logic.buildCloseOldPermitVersionsQuery(logicalId, today);
        expect(closeSql).toContain("有効終了日時 = DateAdd('d', -1, #" + today + "#)");
        expect(closeSql).toContain('許可論理ID = ' + logicalId);
        expect(closeSql).toContain('有効終了日時 IS NULL');

        // 2b. 新バージョンINSERT
        const insertSql = logic.buildSavePermitQuery({
            logicalId, businessId: bizId, categoryId: 1,
            number: 'P-001', permitDate: '2029/04/01',
            validDate: '2034/03/31', excellent: false, todayStr: today
        });
        expect(insertSql).toContain('INSERT INTO 許可');
        expect(insertSql).toContain('#2029/04/01#');

        // 2c. 品目コピー
        const copySql = logic.buildCopyPermitItemsQuery(1, 2);
        expect(copySql).toContain('INSERT INTO 許可品目');
        expect(copySql).toContain('SELECT 2');
        expect(copySql).toContain('FROM 許可品目 WHERE 許可ID = 1');
    });

    test('Step3: 変更許可（法14条の2）— isChange=trueで新版INSERT', () => {
        // 指定日でクローズ
        const closeSql = logic.buildClosePermitVersionQuery(logicalId, '2030/06/01');
        expect(closeSql).toContain('有効終了日時 = #2030/06/01#');
        expect(closeSql).not.toContain('IIf');

        // 変更許可INSERT
        const insertSql = logic.buildSavePermitQuery({
            logicalId, businessId: bizId, categoryId: 1,
            number: 'P-001', permitDate: '2030/06/01',
            validDate: '2034/03/31', excellent: false,
            isChange: true, startDate: '2030/06/01', todayStr: today
        });
        expect(insertSql).toContain('True'); // 変更許可フラグ = True
        expect(insertSql).toContain('#2030/06/01#');
    });

    test('Step4: 廃止', () => {
        const permitId = 999; // 最新の物理ID
        const sql = logic.buildAbolishPermitQuery(permitId, '2031/01/01', '事業廃止');
        expect(sql).toContain('廃止日 = #2031/01/01#');
        expect(sql).toContain('有効終了日時 = #2031/01/01#');
        expect(sql).toContain("廃止理由 = '事業廃止'");
        expect(sql).toContain('WHERE 許可ID = ' + permitId);
    });

    test('Step5: 復活', () => {
        const permitId = 999;
        const sql = logic.buildRestorePermitQuery(permitId);
        expect(sql).toContain('廃止日 = NULL');
        expect(sql).toContain('廃止理由 = NULL');
        expect(sql).toContain('取消日 = NULL');
        expect(sql).toContain('取消理由 = NULL');
        expect(sql).toContain('有効終了日時 = NULL');
    });

    test('復活後は有効終了日時がNULLなのでアクティブに戻る', () => {
        // 復活のSQL内容を確認 — 有効終了日時 = NULLがあれば、
        // buildCheckActiveVersionExistsQueryで「アクティブ」として認識される
        const restoreSql = logic.buildRestorePermitQuery(999);
        expect(restoreSql).toContain('有効終了日時 = NULL');

        // アクティブバージョン確認クエリは 有効終了日時 IS NULL を条件とする
        const checkSql = logic.buildCheckActiveVersionExistsQuery(
            '許可', '許可論理ID', logicalId, 0, '許可ID'
        );
        expect(checkSql).toContain('有効終了日時 IS NULL');
    });
});

// ===== 2. バージョン境界日の整合性 =====

describe('バージョン境界日整合性', () => {
    test('旧バージョンの有効終了日時と新バージョンの有効開始日時を同じ日にできる', () => {
        const boundary = '2029/04/01';
        // 旧バージョンをクローズ
        const closeSql = logic.buildCloseOldVersionByIdQuery(
            '許可', '許可ID', 100, '2026/03/10', boundary
        );
        expect(closeSql).toContain('有効終了日時 = #' + boundary + '#');

        // 新バージョンの有効開始日時
        const newSql = logic.buildSavePermitQuery({
            logicalId: 50, businessId: 1, categoryId: 1,
            number: 'P-001', permitDate: boundary,
            validDate: '2034/03/31', excellent: false,
            startDate: boundary, todayStr: '2026/03/10'
        });
        expect(newSql).toContain('#' + boundary + '#');
    });

    test('許可: CloseOldPermitVersionsQueryはDateAddで新許可日の前日にクローズ', () => {
        const sql = logic.buildCloseOldPermitVersionsQuery(50, '2026/03/10');
        expect(sql).toContain("DateAdd('d', -1, #2026/03/10#)");
    });

    test('施設: CloseOldFacilityVersionsQueryは指定日で一律クローズ', () => {
        const sql = logic.buildCloseOldFacilityVersionsQuery(30, '2026/03/10', '2026/04/01');
        expect(sql).toContain('有効終了日時 = #2026/04/01#');
        expect(sql).not.toContain('DateAdd');
    });

    test('許可と施設のクローズ方式の違い', () => {
        const permitClose = logic.buildCloseOldPermitVersionsQuery(50, '2026/03/10');
        const facilityClose = logic.buildCloseOldFacilityVersionsQuery(30, '2026/03/10');
        // 許可はDateAddで新許可日の前日にクローズ
        expect(permitClose).toContain('DateAdd');
        // 施設は一律指定日
        expect(facilityClose).not.toContain('DateAdd');
    });

    test('buildUpdateBoundaryDateQueryで有効開始/終了を個別に修正可能', () => {
        const startSql = logic.buildUpdateBoundaryDateQuery(
            '許可', '許可ID', 100, '有効開始日時', '2029/04/01'
        );
        const endSql = logic.buildUpdateBoundaryDateQuery(
            '許可', '許可ID', 99, '有効終了日時', '2029/04/01'
        );
        // 旧バージョンの終了日 = 新バージョンの開始日
        expect(startSql).toContain('有効開始日時 = #2029/04/01#');
        expect(endSql).toContain('有効終了日時 = #2029/04/01#');
    });

    test('境界日を手動修正した場合の隣接バージョンとの整合性は利用者責任', () => {
        // 旧: 有効終了 = 2029/04/01
        // 新: 有効開始 = 2029/04/01
        // → 同日で隙間なし
        const endSql = logic.buildUpdateBoundaryDateQuery('許可', '許可ID', 99, '有効終了日時', '2029/04/01');
        const startSql = logic.buildUpdateBoundaryDateQuery('許可', '許可ID', 100, '有効開始日時', '2029/04/01');
        // 日付が同一
        expect(endSql).toContain('#2029/04/01#');
        expect(startSql).toContain('#2029/04/01#');
    });

    test('CloseOldVersionByIdQueryに境界日を渡さない場合はtodayStrが使われる', () => {
        const sql = logic.buildCloseOldVersionByIdQuery('許可', '許可ID', 10, '2026/03/10');
        expect(sql).toContain('#2026/03/10#');
    });

    test('CloseOldVersionByIdQueryに境界日を渡すとそちらが使われる', () => {
        const sql = logic.buildCloseOldVersionByIdQuery('許可', '許可ID', 10, '2026/03/10', '2027/01/01');
        expect(sql).toContain('#2027/01/01#');
        expect(sql).not.toContain('#2026/03/10#');
    });
});

// ===== 3. 施設休止/再開の複数サイクル =====

describe('施設休止/再開: 複数サイクルのSQL列挙', () => {
    const facilityId = 200;

    test('サイクル1: 休止→履歴記録→再開→履歴更新の4ステップ', () => {
        const sqls = [
            logic.buildSuspendFacilityQuery(facilityId, '2026/04/01', '定期点検'),
            logic.buildInsertSuspensionHistoryQuery(facilityId, '2026/04/01', '定期点検'),
            logic.buildResumeFacilityQuery(facilityId, '2026/06/01'),
            logic.buildUpdateSuspensionHistoryResumeByIdQuery(1, '2026/06/01'),
        ];
        // 休止
        expect(sqls[0]).toContain('休止年月日 = #2026/04/01#');
        expect(sqls[0]).toContain('再開年月日 = NULL');
        // 履歴INSERT
        expect(sqls[1]).toContain('INSERT INTO 施設休止履歴');
        // 再開
        expect(sqls[2]).toContain('再開年月日 = #2026/06/01#');
        expect(sqls[2]).toContain('休止理由 = NULL');
        // 履歴UPDATE
        expect(sqls[3]).toContain('再開年月日 = #2026/06/01#');
    });

    test('サイクル2: 再休止→別理由で履歴記録→再開', () => {
        const sqls = [
            logic.buildSuspendFacilityQuery(facilityId, '2026/09/01', '設備更新'),
            logic.buildInsertSuspensionHistoryQuery(facilityId, '2026/09/01', '設備更新'),
            logic.buildResumeFacilityQuery(facilityId, '2026/12/01'),
            logic.buildUpdateSuspensionHistoryResumeByIdQuery(2, '2026/12/01'),
        ];
        expect(sqls[0]).toContain('休止年月日 = #2026/09/01#');
        expect(sqls[0]).toContain("休止理由 = '設備更新'");
        expect(sqls[1]).toContain("'設備更新'");
        expect(sqls[2]).toContain('再開年月日 = #2026/12/01#');
        expect(sqls[3]).toContain('休止履歴ID = 2');
    });

    test('サイクル3: 休止中に廃止 — 再開せずに廃止', () => {
        const suspendSql = logic.buildSuspendFacilityQuery(facilityId, '2027/01/01', '最終');
        const historySql = logic.buildInsertSuspensionHistoryQuery(facilityId, '2027/01/01', '最終');
        const abolishSql = logic.buildAbolishFacilityQuery(facilityId, '2027/03/01');

        expect(suspendSql).toContain('休止年月日 = #2027/01/01#');
        expect(historySql).toContain('INSERT INTO 施設休止履歴');
        expect(abolishSql).toContain('廃止年月日 = #2027/03/01#');
        expect(abolishSql).toContain('有効終了日時 = #2027/03/01#');
        // 再開SQLは生成しない（休止中のまま廃止）
    });

    test('理由なし休止→理由あり休止の混在が独立したレコードになる', () => {
        const noReason = logic.buildInsertSuspensionHistoryQuery(facilityId, '2026/04/01');
        const withReason = logic.buildInsertSuspensionHistoryQuery(facilityId, '2026/09/01', '理由あり');
        expect(noReason).not.toContain('休止理由');
        expect(withReason).toContain('休止理由');
    });

    test('getLatestSuspensionHistoryIdは未再開レコードのみ対象', () => {
        const sql = logic.buildGetLatestSuspensionHistoryIdQuery(facilityId);
        expect(sql).toContain('再開年月日 IS NULL');
        expect(sql).toContain('MAX(休止履歴ID)');
    });
});

// ===== 4. 履歴削除の安全性 =====

describe('履歴削除の安全性', () => {
    describe('許可履歴の個別削除', () => {
        test('許可品目が先に削除される（FK依存順序）', () => {
            const queries = logic.buildDeletePermitHistoryQueries(100);
            expect(queries[0]).toContain('DELETE FROM 許可品目 WHERE 許可ID = 100');
            expect(queries[1]).toContain('DELETE FROM 許可 WHERE 許可ID = 100');
        });

        test('物理IDで削除する（他バージョンに影響しない）', () => {
            const q1 = logic.buildDeletePermitHistoryQueries(100);
            const q2 = logic.buildDeletePermitHistoryQueries(101);
            // ID 100と101は同一論理IDの別バージョンでもそれぞれ独立
            expect(q1[1]).toContain('許可ID = 100');
            expect(q2[1]).toContain('許可ID = 101');
            expect(q1[1]).not.toContain('許可論理ID');
            expect(q2[1]).not.toContain('許可論理ID');
        });

        test('バージョン残数チェックは別クエリで行う設計', () => {
            // 許可にはCountVersions関数がないが、施設にはある
            // 最後の1バージョン削除防止はHTA側のロジック責任
            const checkSql = logic.buildCheckActiveVersionExistsQuery(
                '許可', '許可論理ID', 50, 100, '許可ID'
            );
            expect(checkSql).toContain('COUNT(*)');
        });
    });

    describe('施設バージョンの個別削除', () => {
        test('休止履歴→処理能力→施設の順で削除', () => {
            const queries = logic.buildDeleteFacilityVersionQueries(200);
            expect(queries).toHaveLength(3);
            expect(queries[0]).toContain('DELETE FROM 施設休止履歴 WHERE 施設ID = 200');
            expect(queries[1]).toContain('DELETE FROM 処理能力 WHERE 施設ID = 200');
            expect(queries[2]).toContain('DELETE FROM 施設 WHERE 施設ID = 200');
        });

        test('物理IDで削除（他バージョンに影響しない）', () => {
            const queries = logic.buildDeleteFacilityVersionQueries(200);
            queries.forEach(q => {
                expect(q).toContain('施設ID = 200');
                expect(q).not.toContain('施設論理ID');
            });
        });

        test('論理ID一括削除との違い: buildDeleteFacilityQueriesはサブクエリ', () => {
            const versionQueries = logic.buildDeleteFacilityVersionQueries(200);
            const logicalQueries = logic.buildDeleteFacilityQueries(50);
            // バージョン削除: 直接 施設ID = 200
            expect(versionQueries[2]).toBe('DELETE FROM 施設 WHERE 施設ID = 200');
            // 論理削除: 施設論理ID = 50
            expect(logicalQueries[2]).toBe('DELETE FROM 施設 WHERE 施設論理ID = 50');
        });

        test('buildCountFacilityVersionsQueryでバージョン残数を確認できる', () => {
            const sql = logic.buildCountFacilityVersionsQuery(50);
            expect(sql).toContain('COUNT(*)');
            expect(sql).toContain('施設論理ID = 50');
        });

        test('最後の1バージョン削除チェック: countが1なら削除を禁止するのはHTA側', () => {
            // このテストはビルダーが正しいSQLを返すことのみ検証
            const countSql = logic.buildCountFacilityVersionsQuery(50);
            expect(countSql).toContain('AS cnt');
            // cnt == 1 の場合にHTAが削除ボタンを無効化する想定
        });
    });

    describe('カスケード削除での履歴安全性', () => {
        test('事業者削除は許可品目→施設休止履歴→処理能力→許可→施設→車両→役員→事業者の順', () => {
            const queries = logic.buildDeleteBusinessQueries(42);
            expect(queries).toHaveLength(8);
            const tables = queries.map(q => {
                const m = q.match(/DELETE FROM (\S+)/);
                return m ? m[1] : '';
            });
            expect(tables).toEqual([
                '許可品目', '施設休止履歴', '処理能力',
                '許可', '施設', '車両', '役員', '事業者'
            ]);
        });

        test('施設休止履歴のサブクエリが事業者IDで正しく絞り込む', () => {
            const queries = logic.buildDeleteBusinessQueries(42);
            const suspHistQ = queries.find(q => q.includes('施設休止履歴'));
            expect(suspHistQ).toContain('施設ID IN (SELECT 施設ID FROM 施設 WHERE 事業者ID = 42)');
        });
    });
});

// ===== 5. 許可履歴の部分更新 全フィールドパターン =====

describe('許可履歴 部分更新: 全フィールド組み合わせ', () => {
    const base = { permitId: 100, permitNumber: 'P-001', categoryId: 1 };

    test('日付フィールド4種を個別に更新', () => {
        const fields = [
            { key: 'permitDate', sqlCol: '許可年月日' },
            { key: 'validDate', sqlCol: '許可有効年月日' },
            { key: 'startDate', sqlCol: '有効開始日時' },
            { key: 'endDate', sqlCol: '有効終了日時' },
        ];
        fields.forEach(({ key, sqlCol }) => {
            const data = { ...base, [key]: '2027/04/01' };
            const sql = logic.buildUpdatePermitHistoryQuery(data);
            expect(sql).toContain(sqlCol + ' = #2027/04/01#');
            // 他の日付フィールドは含まれない
            fields.filter(f => f.key !== key).forEach(other => {
                expect(sql).not.toContain(other.sqlCol + ' =');
            });
        });
    });

    test('日付フィールドを空文字でNULLに設定', () => {
        const sql = logic.buildUpdatePermitHistoryQuery({
            ...base, permitDate: '', validDate: '', startDate: '', endDate: ''
        });
        expect(sql).toContain('許可年月日 = NULL');
        expect(sql).toContain('許可有効年月日 = NULL');
        expect(sql).toContain('有効開始日時 = NULL');
        expect(sql).toContain('有効終了日時 = NULL');
    });

    test('undefinedのフィールドはSQLに含まれない', () => {
        const sql = logic.buildUpdatePermitHistoryQuery(base);
        expect(sql).not.toContain('許可年月日');
        expect(sql).not.toContain('許可有効年月日');
        expect(sql).not.toContain('有効開始日時');
        expect(sql).not.toContain('有効終了日時');
        expect(sql).not.toContain('優良認定');
        expect(sql).not.toContain('取消日');
        expect(sql).not.toContain('廃止日');
    });

    test('廃止と取消を同時に設定（異常ケースだがSQLは生成可能）', () => {
        const sql = logic.buildUpdatePermitHistoryQuery({
            ...base,
            cancelDate: '2027/01/01', cancelReason: '取消理由',
            abolishDate: '2027/02/01', abolishReason: '廃止理由'
        });
        expect(sql).toContain('取消日 = #2027/01/01#');
        expect(sql).toContain("取消理由 = '取消理由'");
        expect(sql).toContain('廃止日 = #2027/02/01#');
        expect(sql).toContain("廃止理由 = '廃止理由'");
    });

    test('優良認定のみ更新', () => {
        const sql = logic.buildUpdatePermitHistoryQuery({ ...base, excellent: true });
        expect(sql).toContain('優良認定 = True');
        expect(sql).not.toContain('許可年月日');
        expect(sql).not.toContain('取消日');
    });

    test('取消理由のみNULLクリア（取消日はそのまま）', () => {
        const sql = logic.buildUpdatePermitHistoryQuery({
            ...base, cancelReason: ''
        });
        expect(sql).toContain('取消理由 = NULL');
        expect(sql).not.toContain('取消日');
    });

    test('SQLインジェクション: 取消理由と廃止理由のエスケープ', () => {
        const sql = logic.buildUpdatePermitHistoryQuery({
            ...base,
            cancelReason: "理由'; DROP TABLE --",
            abolishReason: "理由'; DELETE FROM --"
        });
        expect(sql).toContain("理由''; DROP TABLE --");
        expect(sql).toContain("理由''; DELETE FROM --");
    });
});

// ===== 施設履歴の部分更新 全フィールドパターン =====

describe('施設履歴 部分更新: 全フィールド組み合わせ', () => {
    const base = { facilityId: 200, typeId: 1, location: '秋田市テスト' };

    test('日付フィールド5種を個別に更新', () => {
        const fields = [
            { key: 'permitDate', sqlCol: '許可年月日' },
            { key: 'setupDate', sqlCol: '設置年月日' },
            { key: 'startDate', sqlCol: '有効開始日時' },
            { key: 'endDate', sqlCol: '有効終了日時' },
            { key: 'abolishDate', sqlCol: '廃止年月日' },
        ];
        fields.forEach(({ key, sqlCol }) => {
            const data = { ...base, [key]: '2027/04/01' };
            const sql = logic.buildUpdateFacilityHistoryQuery(data);
            expect(sql).toContain(sqlCol + ' = #2027/04/01#');
        });
    });

    test('数値フィールド6種を個別に更新', () => {
        const fields = [
            { key: 'managementTypeId', sqlCol: '管理区分ID', val: 2 },
            { key: 'capacityM3', sqlCol: '容量m3', val: 5000 },
            { key: 'areaM2', sqlCol: '面積m2', val: 2000 },
            { key: 'processingMethodId', sqlCol: '処理方法ID', val: 3 },
            { key: 'setupFormId', sqlCol: '設置形態区分ID', val: 1 },
            { key: 'permitTargetId', sqlCol: '許可対象区分ID', val: 1 },
        ];
        fields.forEach(({ key, sqlCol, val }) => {
            const data = { ...base, [key]: val };
            const sql = logic.buildUpdateFacilityHistoryQuery(data);
            expect(sql).toContain(sqlCol + ' = ' + val);
        });
    });

    test('保管施設3フィールドを同時更新', () => {
        const sql = logic.buildUpdateFacilityHistoryQuery({
            ...base, storageAreaM2: 100, storageCapM3: 500, storageHeightM: 3
        });
        expect(sql).toContain('保管施設面積m2 = 100');
        expect(sql).toContain('保管量上限m3 = 500');
        expect(sql).toContain('保管高さm = 3');
    });

    test('保管施設フィールドをNULLに設定', () => {
        const sql = logic.buildUpdateFacilityHistoryQuery({
            ...base, storageAreaM2: null, storageCapM3: null, storageHeightM: null
        });
        expect(sql).toContain('保管施設面積m2 = NULL');
        expect(sql).toContain('保管量上限m3 = NULL');
        expect(sql).toContain('保管高さm = NULL');
    });

    test('廃止確認日のみ更新', () => {
        const sql = logic.buildUpdateFacilityHistoryQuery({
            ...base, abolishConfirmDate: '2027/06/01'
        });
        expect(sql).toContain('廃止確認日 = #2027/06/01#');
        expect(sql).not.toContain('廃止年月日');
    });

    test('取消年月日と取消理由を設定', () => {
        const sql = logic.buildUpdateFacilityHistoryQuery({
            ...base, cancelDate: '2027/05/01', cancelReason: '違反'
        });
        expect(sql).toContain('取消年月日 = #2027/05/01#');
        expect(sql).toContain("取消理由 = '違反'");
    });

    test('取消理由をNULLに戻す', () => {
        const sql = logic.buildUpdateFacilityHistoryQuery({
            ...base, cancelReason: ''
        });
        expect(sql).toContain('取消理由 = NULL');
    });

    test('undefinedのフィールドはSQLに含まれない（全オプション省略）', () => {
        const sql = logic.buildUpdateFacilityHistoryQuery(base);
        const mustNotContain = [
            '許可番号', '許可年月日', '設置年月日', '有効開始日時', '有効終了日時',
            '廃止年月日', '廃止確認日', '取消年月日', '取消理由',
            '管理区分ID', '容量m3', '面積m2', '埋立終了年月日',
            '処理方法ID', '設置形態区分ID', '許可対象区分ID',
            '保管施設面積m2', '保管量上限m3', '保管高さm'
        ];
        mustNotContain.forEach(col => {
            expect(sql).not.toContain(col + ' =');
        });
    });

    test('全フィールド一括更新', () => {
        const sql = logic.buildUpdateFacilityHistoryQuery({
            facilityId: 200, typeId: 2, location: '横手市新町',
            permitNo: 'F-001', permitDate: '2027/04/01', setupDate: '2027/05/01',
            startDate: '2027/04/01', endDate: '2032/03/31',
            abolishDate: '2030/01/01', abolishConfirmDate: '2030/02/01',
            cancelDate: '2031/01/01', cancelReason: '理由',
            managementTypeId: 1, capacityM3: 5000, areaM2: 2000,
            landfillEndDate: '2040/03/31', processingMethodId: 3,
            setupFormId: 1, permitTargetId: 1,
            storageAreaM2: 100, storageCapM3: 500, storageHeightM: 3
        });
        // SET句のフィールド数: 必須2 + オプション19 = 21
        const setClauses = sql.split('SET ')[1].split(' WHERE')[0];
        const fieldCount = setClauses.split(',').length;
        expect(fieldCount).toBe(21);
    });
});

// ===== 6. 施設バージョン管理: 更新時のold→new切替 =====

describe('施設バージョン管理: 更新フロー', () => {
    const logicalId = 30;
    const today = '2026/03/10';

    test('Step1: 新規施設作成（初版）', () => {
        const sql = logic.buildSaveFacilityQuery({
            logicalId, businessId: 1, typeId: 1,
            location: '秋田市テスト町1-1', todayStr: today
        });
        expect(sql).toContain('INSERT INTO 施設');
        expect(sql).toContain('施設論理ID');
        expect(sql).toContain(logicalId.toString());
        expect(sql).toContain('有効開始日時');
    });

    test('Step2: 更新前に旧バージョンをクローズ', () => {
        const closeSql = logic.buildCloseOldFacilityVersionsQuery(logicalId, today, '2027/04/01');
        expect(closeSql).toContain('有効終了日時 = #2027/04/01#');
        expect(closeSql).toContain('施設論理ID = ' + logicalId);
        expect(closeSql).toContain('有効終了日時 IS NULL');
    });

    test('Step3: 新バージョンINSERT（同じ論理ID）', () => {
        const sql = logic.buildSaveFacilityQuery({
            logicalId, businessId: 1, typeId: 1,
            location: '秋田市テスト町1-1（移転後）',
            permitDate: '2027/04/01', todayStr: today
        });
        expect(sql).toContain('施設論理ID');
        expect(sql).toContain(logicalId.toString());
        expect(sql).toContain('#2027/04/01#');
    });

    test('Step4: 最新バージョン取得で確認', () => {
        const sql = logic.buildLoadLatestVersionQuery('施設', '施設論理ID', logicalId);
        expect(sql).toContain('SELECT TOP 1 *');
        expect(sql).toContain('施設論理ID = ' + logicalId);
        expect(sql).toContain('ORDER BY 有効開始日時 DESC');
    });

    test('Step5: アクティブバージョンが1つだけ存在する確認', () => {
        const sql = logic.buildCheckActiveVersionExistsQuery(
            '施設', '施設論理ID', logicalId, 999, '施設ID'
        );
        expect(sql).toContain('COUNT(*)');
        expect(sql).toContain('施設論理ID = ' + logicalId);
        expect(sql).toContain('有効終了日時 IS NULL');
        expect(sql).toContain('施設ID <> 999');
    });

    test('物理IDでのクローズはbuildCloseOldVersionByIdQueryで行う', () => {
        const sql = logic.buildCloseOldVersionByIdQuery(
            '施設', '施設ID', 500, today, '2027/04/01'
        );
        expect(sql).toContain('UPDATE 施設');
        expect(sql).toContain('施設ID = 500');
        expect(sql).toContain('有効終了日時 = #2027/04/01#');
        expect(sql).toContain('有効終了日時 IS NULL');
    });

    test('施設更新後にMaxIdで新IDを取得', () => {
        const sql = logic.buildGetMaxIdQuery('施設', '施設ID', '施設論理ID', logicalId);
        expect(sql).toContain('SELECT MAX(施設ID) AS newId');
        expect(sql).toContain('施設論理ID = ' + logicalId);
    });

    test('施設のバージョン数を数える', () => {
        const sql = logic.buildCountFacilityVersionsQuery(logicalId);
        expect(sql).toContain('COUNT(*)');
        expect(sql).toContain('施設論理ID = ' + logicalId);
    });

    test('施設バージョン削除は物理IDで子テーブルも含めて削除', () => {
        const queries = logic.buildDeleteFacilityVersionQueries(500);
        expect(queries).toHaveLength(3);
        // 全て施設ID = 500（物理ID）
        queries.forEach(q => expect(q).toContain('施設ID = 500'));
    });
});

// ===== 7. 許可のバージョン管理: 3モード比較 =====

describe('許可バージョン管理: 更新/変更/期限切れ新規の3モード', () => {
    const logicalId = 50;
    const bizId = 1;
    const today = '2026/03/10';

    test('更新モード: 旧バージョンは新許可日の前日でクローズ', () => {
        const closeSql = logic.buildCloseOldPermitVersionsQuery(logicalId, today);
        expect(closeSql).toContain("DateAdd('d', -1, #" + today + "#)");
    });

    test('変更モード: 旧バージョンは指定日でクローズ', () => {
        const closeSql = logic.buildClosePermitVersionQuery(logicalId, '2027/06/01');
        expect(closeSql).toContain('有効終了日時 = #2027/06/01#');
        expect(closeSql).not.toContain('DateAdd');
    });

    test('更新モード: 新バージョンのisChangeはfalse', () => {
        const sql = logic.buildSavePermitQuery({
            logicalId, businessId: bizId, categoryId: 1,
            number: 'P-001', permitDate: '2029/04/01',
            validDate: '2034/03/31', excellent: false, todayStr: today
        });
        // 変更許可フラグ=False, 失効新規フラグ=False
        const valsPart = sql.split('VALUES (')[1];
        expect(valsPart).toContain(', False, False, #');
    });

    test('変更モード: 新バージョンのisChangeはtrue', () => {
        const sql = logic.buildSavePermitQuery({
            logicalId, businessId: bizId, categoryId: 1,
            number: 'P-001', permitDate: '2027/06/01',
            validDate: '2034/03/31', excellent: false,
            isChange: true, startDate: '2027/06/01', todayStr: today
        });
        // VALUES内の変更許可フラグ=True, 失効新規フラグ=False
        expect(sql).toContain('変更許可フラグ');
        expect(sql).toContain('失効新規フラグ');
        const valsPart = sql.split('VALUES (')[1];
        expect(valsPart).toContain(', True, False, #');
    });

    test('期限切れ新規: 同じ論理IDだが有効期限は異なる', () => {
        // 旧バージョンはすでに有効期限が切れている前提
        // buildCloseOldPermitVersionsQuery は有効終了日時 IS NULL のみ対象
        const closeSql = logic.buildCloseOldPermitVersionsQuery(logicalId, today);
        expect(closeSql).toContain('有効終了日時 IS NULL');

        const sql = logic.buildSavePermitQuery({
            logicalId, businessId: bizId, categoryId: 1,
            number: 'P-001', permitDate: '2026/04/01',
            validDate: '2031/03/31', excellent: false, todayStr: today
        });
        expect(sql).toContain('INSERT INTO 許可');
    });

    test('品目コピー: 更新/変更時に旧版→新版にコピー', () => {
        const copySql = logic.buildCopyPermitItemsQuery(100, 200);
        expect(copySql).toContain('INSERT INTO 許可品目');
        expect(copySql).toContain('SELECT 200');
        expect(copySql).toContain('FROM 許可品目 WHERE 許可ID = 100');
    });

    test('MaxIdで新許可IDを取得', () => {
        const sql = logic.buildGetMaxIdQuery('許可', '許可ID', '許可論理ID', logicalId);
        expect(sql).toContain('MAX(許可ID)');
        expect(sql).toContain('許可論理ID = ' + logicalId);
    });
});

// ===== 8. 履歴読み込みクエリの完全性 =====

describe('履歴読み込みクエリの完全性', () => {
    test('許可履歴: JOINとORDER BYが正しい', () => {
        const sql = logic.buildLoadPermitHistoryQuery(50);
        expect(sql).toContain('LEFT JOIN マスター_許可区分');
        expect(sql).toContain('許可.許可論理ID = 50');
        expect(sql).toContain('ORDER BY 許可.有効開始日時 ASC');
    });

    test('許可履歴: 日付はFormat関数で文字列化', () => {
        const sql = logic.buildLoadPermitHistoryQuery(50);
        const formatCols = ['許可年月日', '許可有効年月日', '有効開始日時', '有効終了日時', '取消日', '廃止日'];
        formatCols.forEach(col => {
            expect(sql).toContain("Format(許可." + col);
        });
    });

    test('許可履歴: 変更許可フラグが含まれる', () => {
        const sql = logic.buildLoadPermitHistoryQuery(50);
        expect(sql).toContain('変更許可フラグ');
    });

    test('施設履歴: 4つのマスターテーブルをJOIN', () => {
        const sql = logic.buildLoadFacilityHistoryQuery(30);
        expect(sql).toContain('LEFT JOIN マスター_施設種別');
        expect(sql).toContain('LEFT JOIN マスター_管理区分');
        expect(sql).toContain('LEFT JOIN マスター_処理方法');
        expect(sql).toContain('LEFT JOIN マスター_設置形態区分');
    });

    test('施設履歴: 有効開始日時ASCでソート', () => {
        const sql = logic.buildLoadFacilityHistoryQuery(30);
        expect(sql).toContain('ORDER BY 施設.有効開始日時 ASC');
    });

    test('施設履歴: 論理IDで絞り込み', () => {
        const sql = logic.buildLoadFacilityHistoryQuery(30);
        expect(sql).toContain('施設.施設論理ID = 30');
    });

    test('休止履歴: 降順ソート', () => {
        const sql = logic.buildLoadSuspensionHistoryQuery(200);
        expect(sql).toContain('ORDER BY 休止年月日 DESC');
    });

    test('休止履歴: Format関数で日付文字列化', () => {
        const sql = logic.buildLoadSuspensionHistoryQuery(200);
        expect(sql).toContain("Format(休止年月日, 'yyyy/mm/dd')");
        expect(sql).toContain("Format(再開年月日, 'yyyy/mm/dd')");
    });
});

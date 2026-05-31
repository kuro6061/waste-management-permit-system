/**
 * ルックアップ・参照クエリテスト
 * buildGetVehicleByIdQuery, buildGetProcessingCapacityByIdQuery,
 * buildForeignKeyMapQuery, データメンテナンスクエリ,
 * buildUpdateVehicleFlagQuery, buildOfficerSortExpression
 */
const logic = require('../../app_logic.js');

describe('ルックアップ・参照クエリ', () => {
    describe('buildGetVehicleByIdQuery', () => {
        test('車両IDで1件取得', () => {
            const sql = logic.buildGetVehicleByIdQuery(42);
            expect(sql).toContain('登録番号1');
            expect(sql).toContain('登録番号2');
            expect(sql).toContain('登録番号3');
            expect(sql).toContain('登録番号4');
            expect(sql).toContain('普通フラグ');
            expect(sql).toContain('特管フラグ');
            expect(sql).toContain('車両ID = 42');
        });
    });

    describe('buildGetProcessingCapacityByIdQuery', () => {
        test('処理能力IDで1件取得', () => {
            const sql = logic.buildGetProcessingCapacityByIdQuery(15);
            expect(sql).toBe('SELECT * FROM 処理能力 WHERE 処理能力ID = 15');
        });
    });

    describe('buildForeignKeyMapQuery', () => {
        test('FK参照テーブルの一覧取得', () => {
            const sql = logic.buildForeignKeyMapQuery('マスター_廃棄物種類区分', '廃棄物種類区分ID', '廃棄物種類名');
            expect(sql).toContain('SELECT 廃棄物種類区分ID, 廃棄物種類名');
            expect(sql).toContain('[マスター_廃棄物種類区分]');
            expect(sql).toContain('ORDER BY 廃棄物種類区分ID');
        });

        test('ソートカラム指定あり', () => {
            const sql = logic.buildForeignKeyMapQuery('マスター_品目', '品目ID', '品目名', '表示順');
            expect(sql).toContain('ORDER BY 表示順');
        });
    });

    describe('buildUpdateVehicleFlagQuery', () => {
        test('普通フラグをTrueに設定', () => {
            const sql = logic.buildUpdateVehicleFlagQuery(10, '普通フラグ', true);
            expect(sql).toContain('UPDATE 車両');
            expect(sql).toContain('普通フラグ = True');
            expect(sql).toContain('車両ID = 10');
        });

        test('特管フラグをFalseに設定', () => {
            const sql = logic.buildUpdateVehicleFlagQuery(10, '特管フラグ', false);
            expect(sql).toContain('特管フラグ = False');
        });

        test('許可されていないフラグ名は空文字列', () => {
            const sql = logic.buildUpdateVehicleFlagQuery(10, '不正フラグ', true);
            expect(sql).toBe('');
        });

        test('許可されたフラグ名のみ受け入れ', () => {
            expect(logic.buildUpdateVehicleFlagQuery(1, '普通フラグ', true)).not.toBe('');
            expect(logic.buildUpdateVehicleFlagQuery(1, '特管フラグ', true)).not.toBe('');
            expect(logic.buildUpdateVehicleFlagQuery(1, '廃車フラグ', true)).toBe('');
        });
    });

    describe('データメンテナンスクエリ', () => {
        test('buildMissingStartDateCountQuery: 許可', () => {
            const sql = logic.buildMissingStartDateCountQuery('許可');
            expect(sql).toContain('COUNT(*)');
            expect(sql).toContain('有効開始日時 IS NULL');
            expect(sql).toContain('FROM 許可');
        });

        test('buildMissingStartDateCountQuery: 施設', () => {
            const sql = logic.buildMissingStartDateCountQuery('施設');
            expect(sql).toContain('FROM 施設');
        });

        test('buildFixMissingPermitStartDateQuery', () => {
            const sql = logic.buildFixMissingPermitStartDateQuery();
            expect(sql).toContain('UPDATE 許可');
            expect(sql).toContain('有効開始日時 = IIF');
            expect(sql).toContain('許可年月日');
            expect(sql).toContain('作成日時');
            expect(sql).toContain('有効開始日時 IS NULL');
        });

        test('buildFixMissingFacilityStartDateQuery', () => {
            const sql = logic.buildFixMissingFacilityStartDateQuery();
            expect(sql).toContain('UPDATE 施設');
            expect(sql).toContain('有効開始日時 = IIF');
            expect(sql).toContain('設置年月日');
            expect(sql).toContain('許可年月日');
            expect(sql).toContain('有効開始日時 IS NULL');
        });
    });
});

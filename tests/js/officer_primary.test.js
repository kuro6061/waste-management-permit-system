/**
 * 役員主担当管理テスト
 * buildSetPrimaryOfficerQueries, buildClearPrimaryOfficerQuery
 */
const logic = require('../../app_logic.js');

describe('役員主担当管理', () => {
    describe('buildSetPrimaryOfficerQueries', () => {
        test('2つのクエリを返す', () => {
            const queries = logic.buildSetPrimaryOfficerQueries(10, 5);
            expect(queries).toHaveLength(2);
        });

        test('最初に全役員のフラグをFalseにする', () => {
            const queries = logic.buildSetPrimaryOfficerQueries(10, 5);
            expect(queries[0]).toContain('UPDATE 役員');
            expect(queries[0]).toContain('代表者フラグ = False');
            expect(queries[0]).toContain('事業者ID = 5');
        });

        test('次に指定役員のフラグをTrueにする', () => {
            const queries = logic.buildSetPrimaryOfficerQueries(10, 5);
            expect(queries[1]).toContain('UPDATE 役員');
            expect(queries[1]).toContain('代表者フラグ = True');
            expect(queries[1]).toContain('役員ID = 10');
        });

        test('順序が重要: まずクリア→次にセット', () => {
            const queries = logic.buildSetPrimaryOfficerQueries(10, 5);
            // 1番目はbusinessId条件でクリア
            expect(queries[0]).toContain('事業者ID');
            expect(queries[0]).not.toContain('役員ID = 10');
            // 2番目はofficerId条件でセット
            expect(queries[1]).toContain('役員ID');
        });

        test('異なるIDで正しく動作', () => {
            const q1 = logic.buildSetPrimaryOfficerQueries(100, 50);
            expect(q1[0]).toContain('事業者ID = 50');
            expect(q1[1]).toContain('役員ID = 100');
        });
    });

    describe('buildClearPrimaryOfficerQuery', () => {
        test('指定役員の代表者フラグをFalseにする', () => {
            const sql = logic.buildClearPrimaryOfficerQuery(15);
            expect(sql).toContain('UPDATE 役員');
            expect(sql).toContain('代表者フラグ = False');
            expect(sql).toContain('役員ID = 15');
        });

        test('事業者IDは含まない（個別指定）', () => {
            const sql = logic.buildClearPrimaryOfficerQuery(15);
            expect(sql).not.toContain('事業者ID');
        });
    });
});

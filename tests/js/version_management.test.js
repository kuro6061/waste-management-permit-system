/**
 * バージョン管理テスト
 * buildCloseOldPermitVersionsQuery, buildClosePermitVersionQuery,
 * buildCloseOldFacilityVersionsQuery, buildCheckActiveVersionExistsQuery,
 * buildUpdateBoundaryDateQuery, buildGetLatestVersionQuery,
 * buildCloseOldVersionByIdQuery, buildLoadLatestVersionQuery
 */
const logic = require('../../app_logic.js');

describe('バージョン管理', () => {
    describe('buildCloseOldPermitVersionsQuery', () => {
        test('DateAddで新許可日の前日にクローズ', () => {
            const sql = logic.buildCloseOldPermitVersionsQuery(5, '2026/03/10');
            expect(sql).toContain('UPDATE 許可');
            expect(sql).toContain("有効終了日時 = DateAdd('d', -1, #2026/03/10#)");
            expect(sql).toContain('許可論理ID = 5');
            expect(sql).toContain('有効終了日時 IS NULL');
        });

        test('新許可日がクエリに含まれる', () => {
            const sql = logic.buildCloseOldPermitVersionsQuery(5, '2026/03/10');
            expect(sql).toContain('#2026/03/10#');
        });

        test('既にクローズ済みのレコードは更新しない', () => {
            const sql = logic.buildCloseOldPermitVersionsQuery(5, '2026/03/10');
            expect(sql).toContain('有効終了日時 IS NULL');
        });
    });

    describe('buildClosePermitVersionQuery', () => {
        test('指定日でクローズする', () => {
            const sql = logic.buildClosePermitVersionQuery(10, '2026/04/01');
            expect(sql).toContain('UPDATE 許可');
            expect(sql).toContain('有効終了日時 = #2026/04/01#');
            expect(sql).toContain('許可論理ID = 10');
            expect(sql).toContain('有効終了日時 IS NULL');
        });

        test('buildCloseOldPermitVersionsQueryとの違い: DateAddなし', () => {
            const sql = logic.buildClosePermitVersionQuery(10, '2026/04/01');
            expect(sql).not.toContain('DateAdd');
        });
    });

    describe('buildCloseOldFacilityVersionsQuery', () => {
        test('施設の旧バージョンをクローズ', () => {
            const sql = logic.buildCloseOldFacilityVersionsQuery(3, '2026/03/10');
            expect(sql).toContain('UPDATE 施設');
            expect(sql).toContain('施設論理ID = 3');
            expect(sql).toContain('有効終了日時 IS NULL');
        });

        test('境界日指定あり', () => {
            const sql = logic.buildCloseOldFacilityVersionsQuery(3, '2026/03/10', '2026/04/01');
            expect(sql).toContain('#2026/04/01#');
        });

        test('境界日省略時はtodayStrを使用', () => {
            const sql = logic.buildCloseOldFacilityVersionsQuery(3, '2026/03/10');
            expect(sql).toContain('#2026/03/10#');
        });
    });

    describe('buildCheckActiveVersionExistsQuery', () => {
        test('許可のアクティブバージョン確認', () => {
            const sql = logic.buildCheckActiveVersionExistsQuery('許可', '許可論理ID', 5, 10, '許可ID');
            expect(sql).toContain('SELECT COUNT(*)');
            expect(sql).toContain('許可論理ID = 5');
            expect(sql).toContain('有効終了日時 IS NULL');
            expect(sql).toContain('許可ID <> 10');
        });

        test('施設のアクティブバージョン確認', () => {
            const sql = logic.buildCheckActiveVersionExistsQuery('施設', '施設論理ID', 3, 7, '施設ID');
            expect(sql).toContain('FROM 施設');
            expect(sql).toContain('施設論理ID = 3');
            expect(sql).toContain('施設ID <> 7');
        });

        test('自分自身を除外する', () => {
            const sql = logic.buildCheckActiveVersionExistsQuery('許可', '許可論理ID', 5, 10, '許可ID');
            expect(sql).toContain('許可ID <> 10');
        });
    });

    describe('buildUpdateBoundaryDateQuery', () => {
        test('許可の有効開始日時更新', () => {
            const sql = logic.buildUpdateBoundaryDateQuery('許可', '許可ID', 10, '有効開始日時', '2026/01/01');
            expect(sql).toBe('UPDATE 許可 SET 有効開始日時 = #2026/01/01# WHERE 許可ID = 10');
        });

        test('施設の有効終了日時更新', () => {
            const sql = logic.buildUpdateBoundaryDateQuery('施設', '施設ID', 5, '有効終了日時', '2026/12/31');
            expect(sql).toBe('UPDATE 施設 SET 有効終了日時 = #2026/12/31# WHERE 施設ID = 5');
        });
    });

    describe('buildLoadLatestVersionQuery', () => {
        test('TOP 1で最新バージョンを取得', () => {
            const sql = logic.buildLoadLatestVersionQuery('許可', '許可論理ID', 5);
            expect(sql).toContain('SELECT TOP 1 *');
            expect(sql).toContain('許可論理ID = 5');
            expect(sql).toContain('ORDER BY 有効開始日時 DESC');
        });

        test('施設でも動作', () => {
            const sql = logic.buildLoadLatestVersionQuery('施設', '施設論理ID', 3);
            expect(sql).toContain('FROM 施設');
            expect(sql).toContain('施設論理ID = 3');
        });
    });

    describe('buildCloseOldVersionByIdQuery', () => {
        test('物理IDでクローズ', () => {
            const sql = logic.buildCloseOldVersionByIdQuery('許可', '許可ID', 10, '2026/03/10');
            expect(sql).toContain('UPDATE 許可');
            expect(sql).toContain('許可ID = 10');
            expect(sql).toContain('有効終了日時 IS NULL');
            expect(sql).toContain('#2026/03/10#');
        });

        test('境界日指定あり', () => {
            const sql = logic.buildCloseOldVersionByIdQuery('施設', '施設ID', 5, '2026/03/10', '2026/04/01');
            expect(sql).toContain('#2026/04/01#');
        });

        test('境界日省略時はtodayStrを使用', () => {
            const sql = logic.buildCloseOldVersionByIdQuery('施設', '施設ID', 5, '2026/03/10');
            expect(sql).toContain('#2026/03/10#');
        });
    });

    describe('buildGetMaxIdQuery', () => {
        test('論理ID指定でMAX取得', () => {
            const sql = logic.buildGetMaxIdQuery('許可', '許可ID', '許可論理ID', 5);
            expect(sql).toContain('SELECT MAX(許可ID) AS newId');
            expect(sql).toContain('許可論理ID = 5');
        });

        test('施設でも動作', () => {
            const sql = logic.buildGetMaxIdQuery('施設', '施設ID', '施設論理ID', 3);
            expect(sql).toContain('SELECT MAX(施設ID) AS newId');
            expect(sql).toContain('施設論理ID = 3');
        });
    });
});

/**
 * 統計・レポートクエリテスト
 * buildStatisticsQueries, buildLoadExpiringPermitsQuery, buildLoadPermitTrendQuery,
 * buildLoadCapacityStatsQuery, カウントクエリ群
 */
const logic = require('../../app_logic.js');

describe('統計・レポートクエリ', () => {
    describe('buildStatisticsQueries', () => {
        const stats = logic.buildStatisticsQueries();

        test('businessCountクエリ', () => {
            expect(stats.businessCount).toContain('COUNT(*)');
            expect(stats.businessCount).toContain('事業者');
        });

        test('permitCountクエリ: 有効な許可のみ', () => {
            expect(stats.permitCount).toContain('COUNT(*)');
            expect(stats.permitCount).toContain('有効終了日時] IS NULL');
            expect(stats.permitCount).toContain('廃止日] IS NULL');
            expect(stats.permitCount).toContain('取消日] IS NULL');
        });

        test('facilityCountクエリ: 有効な施設のみ', () => {
            expect(stats.facilityCount).toContain('COUNT(*)');
            expect(stats.facilityCount).toContain('有効終了日時] IS NULL');
            expect(stats.facilityCount).toContain('廃止年月日] IS NULL');
        });

        test('expiringCountクエリ: 有効な許可のうち期限切れ間近', () => {
            expect(stats.expiringCount).toContain('COUNT(*)');
            expect(stats.expiringCount).toContain('許可有効年月日');
        });

        test('4つのキーが全て存在する', () => {
            expect(Object.keys(stats)).toHaveLength(4);
            expect(stats).toHaveProperty('businessCount');
            expect(stats).toHaveProperty('permitCount');
            expect(stats).toHaveProperty('facilityCount');
            expect(stats).toHaveProperty('expiringCount');
        });
    });

    describe('buildLoadExpiringPermitsQuery', () => {
        const sql = logic.buildLoadExpiringPermitsQuery();

        test('SELECT文にID・番号・日付・事業者情報を含む', () => {
            expect(sql).toContain('許可ID');
            expect(sql).toContain('許可論理ID');
            expect(sql).toContain('許可番号');
            expect(sql).toContain('事業者名');
            expect(sql).toContain('許可区分名');
        });

        test('Date()とDateAddで1年以内を指定', () => {
            expect(sql).toContain('Date()');
            expect(sql).toContain("DateAdd('yyyy', 1, Date())");
        });

        test('廃止・取消を除外する', () => {
            expect(sql).toContain('廃止日 IS NULL');
            expect(sql).toContain('取消日 IS NULL');
        });

        test('有効終了日時がNULLのもののみ', () => {
            expect(sql).toContain('有効終了日時 IS NULL');
        });

        test('許可有効年月日でソートする', () => {
            expect(sql).toContain('ORDER BY 許可.許可有効年月日');
        });
    });

    describe('buildLoadPermitTrendQuery', () => {
        test('カテゴリ別の年次集計', () => {
            const sql = logic.buildLoadPermitTrendQuery(3);
            expect(sql).toContain('Year(許可年月日)');
            expect(sql).toContain('COUNT(*)');
            expect(sql).toContain('GROUP BY');
            expect(sql).toContain('許可区分ID = 3');
        });

        test('有効な許可のみ集計', () => {
            const sql = logic.buildLoadPermitTrendQuery(1);
            expect(sql).toContain('有効終了日時 IS NULL');
            expect(sql).toContain('廃止日 IS NULL');
            expect(sql).toContain('取消日 IS NULL');
        });

        test('年でソートする', () => {
            const sql = logic.buildLoadPermitTrendQuery(1);
            expect(sql).toContain('ORDER BY Year(許可年月日)');
        });
    });

    describe('buildLoadCapacityStatsQuery', () => {
        test('施設種別ごとの処理能力集計', () => {
            const sql = logic.buildLoadCapacityStatsQuery(1);
            expect(sql).toContain('SUM(処理能力.日処理能力)');
            expect(sql).toContain('施設種別ID = 1');
            expect(sql).toContain('GROUP BY');
        });

        test('有効な施設のみ集計', () => {
            const sql = logic.buildLoadCapacityStatsQuery(2);
            expect(sql).toContain('有効終了日時 IS NULL');
            expect(sql).toContain('廃止年月日 IS NULL');
        });

        test('品目名・単位も含む', () => {
            const sql = logic.buildLoadCapacityStatsQuery(1);
            expect(sql).toContain('品目名');
            expect(sql).toContain('日処理能力単位ID');
        });

        test('表示順でソートする', () => {
            const sql = logic.buildLoadCapacityStatsQuery(1);
            expect(sql).toContain('ORDER BY マスター_品目.表示順');
        });
    });

    describe('カウントクエリ', () => {
        test('buildActivePermitCountQuery', () => {
            const sql = logic.buildActivePermitCountQuery(5);
            expect(sql).toContain('COUNT(*)');
            expect(sql).toContain('事業者ID = 5');
            expect(sql).toContain('有効終了日時 IS NULL');
        });

        test('buildActiveFacilityCountQuery', () => {
            const sql = logic.buildActiveFacilityCountQuery(5);
            expect(sql).toContain('COUNT(*)');
            expect(sql).toContain('事業者ID = 5');
            expect(sql).toContain('有効終了日時 IS NULL');
            expect(sql).toContain('廃止年月日 IS NULL');
        });

        test('buildVehicleCountQuery', () => {
            const sql = logic.buildVehicleCountQuery(5);
            expect(sql).toContain('COUNT(*)');
            expect(sql).toContain('事業者ID = 5');
        });

        test('buildOfficerCountQuery', () => {
            const sql = logic.buildOfficerCountQuery(5);
            expect(sql).toContain('COUNT(*)');
            expect(sql).toContain('事業者ID = 5');
        });

        test('buildExpiringPermitsCountQuery', () => {
            const sql = logic.buildExpiringPermitsCountQuery();
            expect(sql).toContain('COUNT(*)');
            expect(sql).toContain('Date()');
            expect(sql).toContain("DateAdd('yyyy', 1, Date())");
            expect(sql).toContain('有効終了日時] IS NULL');
        });

        test('カウントクエリはすべてcntエイリアスを返す', () => {
            expect(logic.buildActivePermitCountQuery(1)).toContain('AS cnt');
            expect(logic.buildActiveFacilityCountQuery(1)).toContain('AS cnt');
            expect(logic.buildVehicleCountQuery(1)).toContain('AS cnt');
            expect(logic.buildOfficerCountQuery(1)).toContain('AS cnt');
            expect(logic.buildExpiringPermitsCountQuery()).toContain('AS cnt');
        });
    });
});

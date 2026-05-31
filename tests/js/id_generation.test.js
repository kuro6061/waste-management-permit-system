/**
 * ID採番テスト
 * buildGetNextLogicalIdQuery, buildGetNextMasterIdQuery,
 * buildCountFacilityVersionsQuery, buildGetMaxBusinessIdQuery
 */
const logic = require('../../app_logic.js');

describe('ID採番', () => {
    describe('buildGetNextLogicalIdQuery', () => {
        test('許可の論理ID最大値取得', () => {
            const sql = logic.buildGetNextLogicalIdQuery('許可', '許可論理ID');
            expect(sql).toBe('SELECT MAX(許可論理ID) AS maxId FROM 許可');
        });

        test('施設の論理ID最大値取得', () => {
            const sql = logic.buildGetNextLogicalIdQuery('施設', '施設論理ID');
            expect(sql).toBe('SELECT MAX(施設論理ID) AS maxId FROM 施設');
        });

        test('maxIdエイリアスを返す', () => {
            const sql = logic.buildGetNextLogicalIdQuery('許可', '許可論理ID');
            expect(sql).toContain('AS maxId');
        });
    });

    describe('buildGetNextMasterIdQuery', () => {
        test('通常のマスターID最大値', () => {
            const config = logic.getMasterConfig('施設種別');
            const sql = logic.buildGetNextMasterIdQuery(config);
            expect(sql).toContain('SELECT MAX(施設種別ID) AS maxId');
            expect(sql).toContain('[マスター_施設種別]');
        });

        test('品目: special範囲', () => {
            const config = logic.getMasterConfig('品目');
            const sql = logic.buildGetNextMasterIdQuery(config, 'special');
            expect(sql).toContain('>= ' + logic.ITEM_SPECIAL_THRESHOLD);
        });

        test('品目: normal範囲', () => {
            const config = logic.getMasterConfig('品目');
            const sql = logic.buildGetNextMasterIdQuery(config, 'normal');
            expect(sql).toContain('< ' + logic.ITEM_SPECIAL_THRESHOLD);
        });

        test('品目: カテゴリなし（全件）', () => {
            const config = logic.getMasterConfig('品目');
            const sql = logic.buildGetNextMasterIdQuery(config);
            expect(sql).not.toContain('>=');
            expect(sql).not.toContain('<');
        });

        test('maxIdエイリアスを返す', () => {
            const config = logic.getMasterConfig('許可区分');
            const sql = logic.buildGetNextMasterIdQuery(config);
            expect(sql).toContain('AS maxId');
        });
    });

    describe('buildCountFacilityVersionsQuery', () => {
        test('施設論理IDでバージョン数カウント', () => {
            const sql = logic.buildCountFacilityVersionsQuery(7);
            expect(sql).toBe('SELECT COUNT(*) AS cnt FROM 施設 WHERE 施設論理ID = 7');
        });

        test('cntエイリアスを返す', () => {
            const sql = logic.buildCountFacilityVersionsQuery(1);
            expect(sql).toContain('AS cnt');
        });
    });

    describe('buildGetMaxBusinessIdQuery', () => {
        test('事業者の最大ID取得', () => {
            const sql = logic.buildGetMaxBusinessIdQuery();
            expect(sql).toBe('SELECT MAX(事業者ID) AS newId FROM 事業者');
        });

        test('newIdエイリアスを返す', () => {
            const sql = logic.buildGetMaxBusinessIdQuery();
            expect(sql).toContain('AS newId');
        });
    });
});

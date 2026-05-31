/**
 * レガシーインポートテスト
 * buildImportOfficersQueries, buildImportVehiclesQueries,
 * buildReadLegacyBusinessesQuery, buildReadLegacyOfficersQuery, buildReadLegacyVehiclesQuery,
 * buildLoadAllOfficersQuery, buildLoadAllVehiclesQuery
 */
const logic = require('../../app_logic.js');

describe('レガシーインポート', () => {
    describe('buildReadLegacyBusinessesQuery', () => {
        test('旧DB事業者テーブルからSELECT', () => {
            const sql = logic.buildReadLegacyBusinessesQuery();
            expect(sql).toContain('SELECT ID, 業者名');
            expect(sql).toContain('０．T 全処理業');
            expect(sql).toContain('ORDER BY ID');
        });
    });

    describe('buildReadLegacyOfficersQuery', () => {
        test('旧DB役員テーブルからSELECT', () => {
            const sql = logic.buildReadLegacyOfficersQuery();
            expect(sql).toContain('ＩＤ番号');
            expect(sql).toContain('役職名');
            expect(sql).toContain('姓');
            expect(sql).toContain('名');
            expect(sql).toContain('５０．T 全役員');
        });
    });

    describe('buildReadLegacyVehiclesQuery', () => {
        test('テーブル名を指定してSELECT', () => {
            const sql = logic.buildReadLegacyVehiclesQuery('車両テーブル');
            expect(sql).toContain('登録№１');
            expect(sql).toContain('廃車');
            expect(sql).toContain('車両テーブル');
        });

        test('SQLインジェクション対策', () => {
            const sql = logic.buildReadLegacyVehiclesQuery("test'; DROP TABLE --");
            expect(sql).toContain("test''; DROP TABLE --");
        });
    });

    describe('buildLoadAllOfficersQuery', () => {
        test('既存全役員を取得', () => {
            const sql = logic.buildLoadAllOfficersQuery();
            expect(sql).toContain('事業者ID');
            expect(sql).toContain('役職名');
            expect(sql).toContain('姓');
            expect(sql).toContain('名');
            expect(sql).toContain('FROM 役員');
        });
    });

    describe('buildLoadAllVehiclesQuery', () => {
        test('既存全車両を取得', () => {
            const sql = logic.buildLoadAllVehiclesQuery();
            expect(sql).toContain('事業者ID');
            expect(sql).toContain('登録番号1');
            expect(sql).toContain('FROM 車両');
        });
    });

    describe('buildImportOfficersQueries', () => {
        const baseOfficers = [
            { 'ＩＤ番号': 100, '役職名': '代表取締役', '姓': '田中', '名': '太郎' },
            { 'ＩＤ番号': 100, '役職名': '取締役', '姓': '鈴木', '名': '花子' },
        ];
        const bizMap = { 100: 1 };

        test('正常インポート', () => {
            const result = logic.buildImportOfficersQueries(baseOfficers, bizMap, []);
            expect(result.insertCount).toBe(2);
            expect(result.queries).toHaveLength(2);
            expect(result.skippedCount).toBe(0);
            expect(result.unmatchedBizCount).toBe(0);
        });

        test('重複スキップ', () => {
            const existing = [{ '事業者ID': 1, '役職名': '代表取締役', '姓': '田中', '名': '太郎' }];
            const result = logic.buildImportOfficersQueries(baseOfficers, bizMap, existing);
            expect(result.insertCount).toBe(1);
            expect(result.skippedCount).toBe(1);
        });

        test('事業者マッチなし', () => {
            const officers = [{ 'ＩＤ番号': 999, '役職名': '取締役', '姓': '山田', '名': '次郎' }];
            const result = logic.buildImportOfficersQueries(officers, bizMap, []);
            expect(result.insertCount).toBe(0);
            expect(result.unmatchedBizCount).toBe(1);
        });

        test('空の姓名にデフォルト値', () => {
            const officers = [{ 'ＩＤ番号': 100, '役職名': '', '姓': '', '名': '' }];
            const result = logic.buildImportOfficersQueries(officers, bizMap, []);
            expect(result.insertCount).toBe(1);
            expect(result.queries[0]).toContain('（不明）');
        });

        test('同バッチ内の重複も防止', () => {
            const officers = [
                { 'ＩＤ番号': 100, '役職名': '取締役', '姓': '同名', '名': '太郎' },
                { 'ＩＤ番号': 100, '役職名': '取締役', '姓': '同名', '名': '太郎' },
            ];
            const result = logic.buildImportOfficersQueries(officers, bizMap, []);
            expect(result.insertCount).toBe(1);
            expect(result.skippedCount).toBe(1);
        });
    });

    describe('buildImportVehiclesQueries', () => {
        const baseVehicles = [
            { 'ＩＤ番号': 100, '登録№１': '品川', '登録№２': '100', '登録№３': 'あ', '登録№４': '1234', '廃車': false },
        ];
        const bizMap = { 100: 1 };

        test('正常インポート', () => {
            const result = logic.buildImportVehiclesQueries(baseVehicles, bizMap, []);
            expect(result.insertCount).toBe(1);
            expect(result.queries).toHaveLength(1);
            expect(result.skippedCount).toBe(0);
        });

        test('重複スキップ', () => {
            const existing = [{ '事業者ID': 1, '登録番号1': '品川', '登録番号2': '100', '登録番号3': 'あ', '登録番号4': '1234' }];
            const result = logic.buildImportVehiclesQueries(baseVehicles, bizMap, existing);
            expect(result.insertCount).toBe(0);
            expect(result.skippedCount).toBe(1);
        });

        test('事業者マッチなし', () => {
            const vehicles = [{ 'ＩＤ番号': 999, '登録№１': '品川', '登録№２': '100', '登録№３': 'あ', '登録№４': '1234' }];
            const result = logic.buildImportVehiclesQueries(vehicles, bizMap, []);
            expect(result.unmatchedBizCount).toBe(1);
        });

        test('廃車フラグTrue', () => {
            const vehicles = [{ 'ＩＤ番号': 100, '登録№１': '品川', '登録№２': '', '登録№３': '', '登録№４': '5678', '廃車': true }];
            const result = logic.buildImportVehiclesQueries(vehicles, bizMap, []);
            expect(result.insertCount).toBe(1);
            expect(result.scrappedCount).toBe(1);
            expect(result.queries[0]).toContain('True');
        });

        test('廃車フラグ-1（Access的True）', () => {
            const vehicles = [{ 'ＩＤ番号': 100, '登録№１': '品川', '登録№２': '', '登録№３': '', '登録№４': '5678', '廃車': -1 }];
            const result = logic.buildImportVehiclesQueries(vehicles, bizMap, []);
            expect(result.scrappedCount).toBe(1);
        });

        test('必須フィールド欠損は除外', () => {
            const vehicles = [
                { 'ＩＤ番号': 100, '登録№１': '', '登録№２': '', '登録№３': '', '登録№４': '1234' },
                { 'ＩＤ番号': 100, '登録№１': '品川', '登録№２': '', '登録№３': '', '登録№４': '' },
            ];
            const result = logic.buildImportVehiclesQueries(vehicles, bizMap, []);
            expect(result.insertCount).toBe(0);
        });

        test('ＩＤ番号がnullの場合', () => {
            const vehicles = [{ 'ＩＤ番号': null, '登録№１': '品川', '登録№２': '', '登録№３': '', '登録№４': '1234' }];
            const result = logic.buildImportVehiclesQueries(vehicles, bizMap, []);
            expect(result.unmatchedBizCount).toBe(1);
        });
    });
});

/**
 * 許可品目操作テスト
 * buildPermitItemQueries, buildCopyPermitItemsQuery, buildDeleteAllPermitItemsQuery,
 * buildInsertPermitItemQuery, buildLoadPermitItemsQuery, buildLoadPermitItemsFlagsQuery
 */
const logic = require('../../app_logic.js');

describe('許可品目操作', () => {
    describe('buildPermitItemQueries', () => {
        test('select文が正しい', () => {
            const q = logic.buildPermitItemQueries(10, 5);
            expect(q.select).toContain('許可品目');
            expect(q.select).toContain('許可ID = 10');
            expect(q.select).toContain('品目ID = 5');
        });

        test('insert文が正しい', () => {
            const q = logic.buildPermitItemQueries(10, 5);
            expect(q.insert).toContain('INSERT INTO 許可品目');
            expect(q.insert).toContain('10, 5');
            expect(q.insert).toContain('True, False');
        });

        test('toTransfer文が正しい', () => {
            const q = logic.buildPermitItemQueries(10, 5);
            const sql = q.toTransfer(99);
            expect(sql).toContain('UPDATE 許可品目');
            expect(sql).toContain('積替保管フラグ = True');
            expect(sql).toContain('許可品目ID = 99');
        });

        test('remove文が正しい', () => {
            const q = logic.buildPermitItemQueries(10, 5);
            const sql = q.remove(99);
            expect(sql).toContain('DELETE FROM 許可品目');
            expect(sql).toContain('許可品目ID = 99');
        });

        test('異なるIDで別クエリが生成される', () => {
            const q1 = logic.buildPermitItemQueries(1, 1);
            const q2 = logic.buildPermitItemQueries(2, 3);
            expect(q1.select).not.toBe(q2.select);
            expect(q1.insert).not.toBe(q2.insert);
        });

        test('toTransferとremoveは関数である', () => {
            const q = logic.buildPermitItemQueries(1, 1);
            expect(typeof q.toTransfer).toBe('function');
            expect(typeof q.remove).toBe('function');
        });
    });

    describe('buildCopyPermitItemsQuery', () => {
        test('INSERT INTO ... SELECT形式', () => {
            const sql = logic.buildCopyPermitItemsQuery(100, 200);
            expect(sql).toContain('INSERT INTO 許可品目');
            expect(sql).toContain('SELECT 200');
            expect(sql).toContain('FROM 許可品目 WHERE 許可ID = 100');
        });

        test('品目ID, 取り扱いフラグ, 積替保管フラグをコピーする', () => {
            const sql = logic.buildCopyPermitItemsQuery(1, 2);
            expect(sql).toContain('品目ID');
            expect(sql).toContain('取り扱いフラグ');
            expect(sql).toContain('積替保管フラグ');
        });

        test('コピー先IDがSELECTの先頭にある', () => {
            const sql = logic.buildCopyPermitItemsQuery(50, 60);
            expect(sql).toMatch(/SELECT 60, 品目ID/);
        });
    });

    describe('buildDeleteAllPermitItemsQuery', () => {
        test('正しいDELETE文', () => {
            const sql = logic.buildDeleteAllPermitItemsQuery(42);
            expect(sql).toBe('DELETE FROM 許可品目 WHERE 許可ID = 42');
        });

        test('別IDで別SQL', () => {
            expect(logic.buildDeleteAllPermitItemsQuery(1)).not.toBe(logic.buildDeleteAllPermitItemsQuery(2));
        });
    });

    describe('buildInsertPermitItemQuery', () => {
        test('取り扱いTrue, 積替保管False', () => {
            const sql = logic.buildInsertPermitItemQuery(10, 5, true, false);
            expect(sql).toContain('INSERT INTO 許可品目');
            expect(sql).toContain('10, 5, True, False');
        });

        test('取り扱いTrue, 積替保管True', () => {
            const sql = logic.buildInsertPermitItemQuery(10, 5, true, true);
            expect(sql).toContain('True, True');
        });

        test('取り扱いFalse, 積替保管False', () => {
            const sql = logic.buildInsertPermitItemQuery(10, 5, false, false);
            expect(sql).toContain('False, False');
        });

        test('全フラグパターン網羅', () => {
            const patterns = [
                [true, true, 'True, True'],
                [true, false, 'True, False'],
                [false, true, 'False, True'],
                [false, false, 'False, False'],
            ];
            patterns.forEach(([h, t, expected]) => {
                const sql = logic.buildInsertPermitItemQuery(1, 1, h, t);
                expect(sql).toContain(expected);
            });
        });
    });

    describe('buildLoadPermitItemsQuery', () => {
        test('正しいSELECT文', () => {
            const sql = logic.buildLoadPermitItemsQuery(77);
            expect(sql).toContain('SELECT');
            expect(sql).toContain('品目ID');
            expect(sql).toContain('許可ID = 77');
        });
    });

    describe('buildLoadPermitItemsFlagsQuery', () => {
        test('正しいSELECT文', () => {
            const sql = logic.buildLoadPermitItemsFlagsQuery(88);
            expect(sql).toContain('品目ID');
            expect(sql).toContain('取り扱いフラグ');
            expect(sql).toContain('積替保管フラグ');
            expect(sql).toContain('許可ID = 88');
        });
    });

    describe('buildWasteTypeMapQuery', () => {
        test('許可区分→廃棄物種類のマッピング取得', () => {
            const sql = logic.buildWasteTypeMapQuery();
            expect(sql).toContain('許可区分ID');
            expect(sql).toContain('廃棄物種類区分ID');
            expect(sql).toContain('マスター_許可区分');
        });
    });
});

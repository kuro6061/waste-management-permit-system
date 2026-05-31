/**
 * マスターデータCRUDテスト
 * buildMasterListQuery, buildMasterAllQuery, buildMasterNameQuery,
 * buildLoadMasterListQuery, buildLoadMasterForEditQuery,
 * buildSaveMasterQuery, buildDeleteMasterQuery
 */
const logic = require('../../app_logic.js');

describe('マスターデータCRUD', () => {
    describe('buildMasterListQuery', () => {
        test('指定カラムのみ取得', () => {
            const sql = logic.buildMasterListQuery('マスター_品目', '品目ID', '品目名');
            expect(sql).toBe("SELECT 品目ID, 品目名 FROM [マスター_品目] ORDER BY 品目ID");
        });

        test('ソートカラム指定あり', () => {
            const sql = logic.buildMasterListQuery('マスター_品目', '品目ID', '品目名', '表示順');
            expect(sql).toContain('ORDER BY 表示順');
        });

        test('ソートカラム省略時はIDでソート', () => {
            const sql = logic.buildMasterListQuery('マスター_施設種別', '施設種別ID', '施設種別名');
            expect(sql).toContain('ORDER BY 施設種別ID');
        });
    });

    describe('buildMasterAllQuery', () => {
        test('全カラム取得（ソートなし）', () => {
            const sql = logic.buildMasterAllQuery('マスター_品目');
            expect(sql).toBe("SELECT * FROM [マスター_品目]");
        });

        test('ソートカラム指定あり', () => {
            const sql = logic.buildMasterAllQuery('マスター_品目', '表示順');
            expect(sql).toBe("SELECT * FROM [マスター_品目] ORDER BY 表示順");
        });
    });

    describe('buildMasterNameQuery', () => {
        test('単一レコードの名前取得', () => {
            const sql = logic.buildMasterNameQuery('マスター_許可区分', '許可区分ID', '許可区分名', 3);
            expect(sql).toBe("SELECT 許可区分名 FROM [マスター_許可区分] WHERE 許可区分ID = 3");
        });
    });

    describe('buildLoadMasterListQuery', () => {
        test('通常マスターの一覧取得', () => {
            const config = logic.getMasterConfig('施設種別');
            const sql = logic.buildLoadMasterListQuery(config);
            expect(sql).toContain('SELECT *');
            expect(sql).toContain('[マスター_施設種別]');
            expect(sql).toContain('ORDER BY 施設種別ID');
        });

        test('品目マスター: extraColが表示順の場合', () => {
            const config = logic.getMasterConfig('品目');
            const sql = logic.buildLoadMasterListQuery(config);
            expect(sql).toContain('ORDER BY 表示順');
        });
    });

    describe('buildLoadMasterForEditQuery', () => {
        test('IDで1件取得', () => {
            const config = logic.getMasterConfig('許可区分');
            const sql = logic.buildLoadMasterForEditQuery(config, 5);
            expect(sql).toContain('SELECT *');
            expect(sql).toContain('[マスター_許可区分]');
            expect(sql).toContain('許可区分ID = 5');
        });
    });

    describe('buildSaveMasterQuery', () => {
        test('新規INSERT（基本）', () => {
            const config = logic.getMasterConfig('施設種別');
            const sql = logic.buildSaveMasterQuery(config, { id: 0, newId: 10, name: 'テスト' });
            expect(sql).toContain('INSERT INTO [マスター_施設種別]');
            expect(sql).toContain("'テスト'");
            expect(sql).toContain('10');
        });

        test('更新UPDATE（基本）', () => {
            const config = logic.getMasterConfig('施設種別');
            const sql = logic.buildSaveMasterQuery(config, { id: 5, name: '更新テスト' });
            expect(sql).toContain('UPDATE [マスター_施設種別]');
            expect(sql).toContain("'更新テスト'");
            expect(sql).toContain('施設種別ID = 5');
        });

        test('extraCol（表示順）あり: INSERT', () => {
            const config = logic.getMasterConfig('品目');
            const sql = logic.buildSaveMasterQuery(config, { id: 0, newId: 50, name: 'テスト品目', extra: '10' });
            expect(sql).toContain('表示順');
            expect(sql).toContain('10');
        });

        test('extraCol（表示順）あり: UPDATE', () => {
            const config = logic.getMasterConfig('品目');
            const sql = logic.buildSaveMasterQuery(config, { id: 5, name: 'テスト品目', extra: '20' });
            expect(sql).toContain('表示順 = 20');
        });

        test('FK（廃棄物種類区分ID）あり: INSERT', () => {
            const config = logic.getMasterConfig('許可区分');
            const sql = logic.buildSaveMasterQuery(config, { id: 0, newId: 10, name: '新区分', fk: '2' });
            expect(sql).toContain('廃棄物種類区分ID');
            expect(sql).toContain('2');
        });

        test('FK（廃棄物種類区分ID）あり: UPDATE', () => {
            const config = logic.getMasterConfig('許可区分');
            const sql = logic.buildSaveMasterQuery(config, { id: 3, name: '更新区分', fk: '1' });
            expect(sql).toContain('廃棄物種類区分ID = 1');
        });

        test('FKがnullの場合はNULL', () => {
            const config = logic.getMasterConfig('許可区分');
            const sql = logic.buildSaveMasterQuery(config, { id: 3, name: '更新区分', fk: null });
            expect(sql).toContain('廃棄物種類区分ID = NULL');
        });

        test('SQLインジェクション対策', () => {
            const config = logic.getMasterConfig('施設種別');
            const sql = logic.buildSaveMasterQuery(config, { id: 0, newId: 1, name: "テスト'; DROP TABLE --" });
            expect(sql).toContain("テスト''; DROP TABLE --");
            expect(sql).not.toContain("テスト';");
        });
    });

    describe('buildDeleteMasterQuery', () => {
        test('IDで削除', () => {
            const config = logic.getMasterConfig('施設種別');
            const sql = logic.buildDeleteMasterQuery(config, 5);
            expect(sql).toBe("DELETE FROM [マスター_施設種別] WHERE 施設種別ID = 5");
        });

        test('全マスタータイプで動作', () => {
            const types = ['許可区分', '施設種別', '品目', '処理方法'];
            types.forEach(type => {
                const config = logic.getMasterConfig(type);
                const sql = logic.buildDeleteMasterQuery(config, 1);
                expect(sql).toContain('DELETE FROM');
                expect(sql).toContain('= 1');
            });
        });
    });

    describe('getMasterConfig', () => {
        test('全マスタータイプが定義されている', () => {
            const types = [
                '許可区分', '施設種別', '品目', '処理方法', '廃棄物種類区分',
                '事業者区分', '取扱区分', '形式', '日処理能力単位', '時間処理能力単位',
                '管理区分', '設置形態区分', '許可対象区分', '許可番号形式', '認定区分', '役職'
            ];
            types.forEach(type => {
                const config = logic.getMasterConfig(type);
                expect(config).toBeDefined();
                expect(config.table).toBeDefined();
                expect(config.idCol).toBeDefined();
                expect(config.nameCol).toBeDefined();
            });
        });

        test('許可区分にFK定義がある', () => {
            const config = logic.getMasterConfig('許可区分');
            expect(config.fkCol).toBeDefined();
            expect(config.fkCol.col).toBe('廃棄物種類区分ID');
        });

        test('品目にextraCol（表示順）がある', () => {
            const config = logic.getMasterConfig('品目');
            expect(config.extraCol).toBe('表示順');
        });

        test('存在しないタイプはundefined', () => {
            expect(logic.getMasterConfig('存在しない')).toBeUndefined();
        });
    });
});

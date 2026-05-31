/**
 * 施設休止履歴 — 休止/再開ライフサイクルの検証
 */
const logic = require('../../app_logic.js');

// ===== 施設休止 =====

describe('buildSuspendFacilityQuery', () => {
    test('休止日と再開日NULLが設定される', () => {
        const sql = logic.buildSuspendFacilityQuery(100, '2026/04/01', '定期点検');
        expect(sql).toContain('休止年月日 = #2026/04/01#');
        expect(sql).toContain('再開年月日 = NULL');
        expect(sql).toContain("休止理由 = '定期点検'");
        expect(sql).toContain('WHERE 施設ID = 100');
    });

    test('理由なし: 休止理由フィールドがSQLに含まれない', () => {
        const sql = logic.buildSuspendFacilityQuery(100, '2026/04/01');
        expect(sql).toContain('休止年月日 = #2026/04/01#');
        expect(sql).toContain('再開年月日 = NULL');
        expect(sql).not.toContain('休止理由');
    });

    test('空文字理由: 休止理由フィールドが含まれない', () => {
        const sql = logic.buildSuspendFacilityQuery(100, '2026/04/01', '');
        expect(sql).not.toContain('休止理由');
    });

    test('SQLインジェクション防止: シングルクォートがエスケープされる', () => {
        const sql = logic.buildSuspendFacilityQuery(100, '2026/04/01', "テスト'理由");
        expect(sql).toContain("テスト''理由");
        expect(sql).not.toMatch(/テスト'理由[^']/);
    });
});

// ===== 施設休止履歴INSERT =====

describe('buildInsertSuspensionHistoryQuery', () => {
    test('施設IDと休止日がINSERTされる', () => {
        const sql = logic.buildInsertSuspensionHistoryQuery(100, '2026/04/01', '定期点検');
        expect(sql).toContain('INSERT INTO 施設休止履歴');
        expect(sql).toContain('施設ID');
        expect(sql).toContain('休止年月日');
        expect(sql).toContain('100');
        expect(sql).toContain('#2026/04/01#');
        expect(sql).toContain("'定期点検'");
    });

    test('理由なし: 休止理由カラムが含まれない', () => {
        const sql = logic.buildInsertSuspensionHistoryQuery(100, '2026/04/01');
        expect(sql).toContain('INSERT INTO 施設休止履歴');
        expect(sql).toContain('100');
        expect(sql).toContain('#2026/04/01#');
        expect(sql).not.toContain('休止理由');
    });

    test('理由ありとなしでカラム数が異なる', () => {
        const withReason = logic.buildInsertSuspensionHistoryQuery(100, '2026/04/01', '理由あり');
        const withoutReason = logic.buildInsertSuspensionHistoryQuery(100, '2026/04/01');
        expect(withReason).toContain('休止理由');
        expect(withoutReason).not.toContain('休止理由');
    });

    test('SQLインジェクション防止', () => {
        const sql = logic.buildInsertSuspensionHistoryQuery(100, '2026/04/01', "テスト'理由");
        expect(sql).toContain("テスト''理由");
    });
});

// ===== 施設再開 =====

describe('buildResumeFacilityQuery', () => {
    test('再開日が設定され休止理由がNULLになる', () => {
        const sql = logic.buildResumeFacilityQuery(100, '2026/06/01');
        expect(sql).toContain('再開年月日 = #2026/06/01#');
        expect(sql).toContain('休止理由 = NULL');
        expect(sql).toContain('WHERE 施設ID = 100');
    });

    test('異なるIDで一貫している', () => {
        const sql = logic.buildResumeFacilityQuery(999, '2026/12/31');
        expect(sql).toContain('WHERE 施設ID = 999');
        expect(sql).toContain('#2026/12/31#');
    });
});

// ===== 最新休止履歴ID取得 =====

describe('buildGetLatestSuspensionHistoryIdQuery', () => {
    test('未再開の最新休止履歴IDを取得する', () => {
        const sql = logic.buildGetLatestSuspensionHistoryIdQuery(100);
        expect(sql).toContain('MAX(休止履歴ID)');
        expect(sql).toContain('施設ID = 100');
        expect(sql).toContain('再開年月日 IS NULL');
    });

    test('maxIdカラムとして返す', () => {
        const sql = logic.buildGetLatestSuspensionHistoryIdQuery(100);
        expect(sql).toContain('AS maxId');
    });
});

// ===== 休止履歴の再開日更新（ID指定） =====

describe('buildUpdateSuspensionHistoryResumeByIdQuery', () => {
    test('指定IDの休止履歴に再開日を設定する', () => {
        const sql = logic.buildUpdateSuspensionHistoryResumeByIdQuery(50, '2026/06/01');
        expect(sql).toContain('再開年月日 = #2026/06/01#');
        expect(sql).toContain('WHERE 休止履歴ID = 50');
    });
});

// ===== 休止履歴の再開日更新（サブクエリ版・非推奨） =====

describe('buildUpdateSuspensionHistoryResumeQuery (deprecated)', () => {
    test('サブクエリでMAX(休止履歴ID)を使用', () => {
        const sql = logic.buildUpdateSuspensionHistoryResumeQuery(100, '2026/06/01');
        expect(sql).toContain('再開年月日 = #2026/06/01#');
        expect(sql).toContain('SELECT MAX(休止履歴ID)');
        expect(sql).toContain('施設ID = 100');
        expect(sql).toContain('再開年月日 IS NULL');
    });

    test('非推奨版とID指定版の結果が同じ対象を更新する', () => {
        const deprecatedSql = logic.buildUpdateSuspensionHistoryResumeQuery(100, '2026/06/01');
        const latestIdSql = logic.buildGetLatestSuspensionHistoryIdQuery(100);
        // 両方とも同じ条件: 施設ID=100, 再開年月日 IS NULL
        expect(deprecatedSql).toContain('施設ID = 100 AND 再開年月日 IS NULL');
        expect(latestIdSql).toContain('施設ID = 100 AND 再開年月日 IS NULL');
    });
});

// ===== 休止履歴一覧取得 =====

describe('buildLoadSuspensionHistoryQuery', () => {
    test('休止履歴を降順で取得する', () => {
        const sql = logic.buildLoadSuspensionHistoryQuery(100);
        expect(sql).toContain('施設ID = 100');
        expect(sql).toContain('ORDER BY 休止年月日 DESC');
    });

    test('日付がFormat関数で文字列化される', () => {
        const sql = logic.buildLoadSuspensionHistoryQuery(100);
        expect(sql).toContain("Format(休止年月日, 'yyyy/mm/dd')");
        expect(sql).toContain("Format(再開年月日, 'yyyy/mm/dd')");
    });

    test('休止履歴ID・休止日・再開日・休止理由を取得', () => {
        const sql = logic.buildLoadSuspensionHistoryQuery(100);
        expect(sql).toContain('休止履歴ID');
        expect(sql).toContain('休止理由');
    });
});

// ===== 完全サイクル: 休止→再開→休止→再開 =====

describe('休止/再開の完全ライフサイクル', () => {
    const facilityId = 100;

    test('サイクル1: 休止→再開', () => {
        // 1. 施設を休止
        const suspendSql = logic.buildSuspendFacilityQuery(facilityId, '2026/04/01', '点検');
        expect(suspendSql).toContain('休止年月日 = #2026/04/01#');
        expect(suspendSql).toContain('再開年月日 = NULL');

        // 2. 休止履歴を記録
        const histSql = logic.buildInsertSuspensionHistoryQuery(facilityId, '2026/04/01', '点検');
        expect(histSql).toContain('INSERT INTO 施設休止履歴');

        // 3. 施設を再開
        const resumeSql = logic.buildResumeFacilityQuery(facilityId, '2026/06/01');
        expect(resumeSql).toContain('再開年月日 = #2026/06/01#');
        expect(resumeSql).toContain('休止理由 = NULL');

        // 4. 休止履歴に再開日を記録（ID指定）
        const updateHistSql = logic.buildUpdateSuspensionHistoryResumeByIdQuery(1, '2026/06/01');
        expect(updateHistSql).toContain('再開年月日 = #2026/06/01#');
    });

    test('サイクル2: 再休止→再再開（複数サイクル）', () => {
        // 5. 再度休止
        const suspendSql2 = logic.buildSuspendFacilityQuery(facilityId, '2026/09/01', '設備更新');
        expect(suspendSql2).toContain('休止年月日 = #2026/09/01#');
        expect(suspendSql2).toContain('再開年月日 = NULL');

        // 6. 再度再開
        const resumeSql2 = logic.buildResumeFacilityQuery(facilityId, '2026/12/01');
        expect(resumeSql2).toContain('再開年月日 = #2026/12/01#');
    });

    test('休止→廃止の場合: 両方のSQLが独立して生成可能', () => {
        // 休止中に廃止される場合
        const suspendSql = logic.buildSuspendFacilityQuery(facilityId, '2026/04/01', '点検');
        const abolishSql = logic.buildAbolishFacilityQuery(facilityId, '2026/05/01');
        // 両方独立して実行可能
        expect(suspendSql).toContain('施設ID = 100');
        expect(abolishSql).toContain('施設ID = 100');
        expect(abolishSql).toContain('廃止年月日 = #2026/05/01#');
    });
});

// ===== 施設バージョン削除 =====

describe('buildDeleteFacilityVersionQueries', () => {
    test('3つのクエリを返す', () => {
        const queries = logic.buildDeleteFacilityVersionQueries(100);
        expect(queries).toHaveLength(3);
    });

    test('正しい削除順序: 休止履歴→処理能力→施設', () => {
        const queries = logic.buildDeleteFacilityVersionQueries(100);
        expect(queries[0]).toContain('DELETE FROM 施設休止履歴');
        expect(queries[1]).toContain('DELETE FROM 処理能力');
        expect(queries[2]).toContain('DELETE FROM 施設');
    });

    test('物理IDで削除する（論理IDではない）', () => {
        const queries = logic.buildDeleteFacilityVersionQueries(100);
        queries.forEach(q => {
            expect(q).toContain('施設ID = 100');
            expect(q).not.toContain('施設論理ID');
        });
    });

    test('buildDeleteFacilityQueriesとの違い: 論理ID vs 物理ID', () => {
        const versionQueries = logic.buildDeleteFacilityVersionQueries(100);
        const logicalQueries = logic.buildDeleteFacilityQueries(100);
        // バージョン版は物理ID（施設ID = 100）
        expect(versionQueries[2]).toBe('DELETE FROM 施設 WHERE 施設ID = 100');
        // 論理版は論理ID（施設論理ID = 100）
        expect(logicalQueries[2]).toBe('DELETE FROM 施設 WHERE 施設論理ID = 100');
    });

    test('buildDeleteFacilityQueriesは休止履歴も含む', () => {
        const queries = logic.buildDeleteFacilityQueries(100);
        expect(queries).toHaveLength(3);
        expect(queries[0]).toContain('DELETE FROM 施設休止履歴');
        expect(queries[0]).toContain('IN (SELECT 施設ID FROM 施設 WHERE 施設論理ID = 100)');
    });
});

// ===== 施設バージョンカウント =====

describe('buildCountFacilityVersionsQuery', () => {
    test('論理IDで施設バージョン数をカウントする', () => {
        const sql = logic.buildCountFacilityVersionsQuery(500);
        expect(sql).toContain('COUNT(*)');
        expect(sql).toContain('AS cnt');
        expect(sql).toContain('施設論理ID = 500');
    });

    test('テーブル名が施設', () => {
        const sql = logic.buildCountFacilityVersionsQuery(1);
        expect(sql).toContain('FROM 施設');
    });
});

// ===== カスケード削除での休止履歴整合性 =====

describe('カスケード削除と休止履歴の整合性', () => {
    test('buildDeleteBusinessQueriesに施設休止履歴が含まれる', () => {
        const queries = logic.buildDeleteBusinessQueries(42);
        const hasSuspensionDelete = queries.some(q => q.includes('施設休止履歴'));
        expect(hasSuspensionDelete).toBe(true);
    });

    test('buildDeleteBusinessQueriesの施設休止履歴は施設削除より前に実行される', () => {
        const queries = logic.buildDeleteBusinessQueries(42);
        const suspensionIndex = queries.findIndex(q => q.includes('DELETE FROM 施設休止履歴'));
        const facilityIndex = queries.findIndex(q => q.includes('DELETE FROM 施設 WHERE'));
        expect(suspensionIndex).toBeLessThan(facilityIndex);
    });

    test('buildDeleteFacilityQueriesでは休止履歴がサブクエリ付きで削除される', () => {
        const queries = logic.buildDeleteFacilityQueries(100);
        expect(queries[0]).toContain('DELETE FROM 施設休止履歴');
        expect(queries[0]).toContain('IN (SELECT 施設ID FROM 施設 WHERE 施設論理ID = 100)');
    });

    test('buildDeleteFacilityVersionQueriesでは休止履歴が直接IDで削除される', () => {
        const queries = logic.buildDeleteFacilityVersionQueries(100);
        expect(queries[0]).toBe('DELETE FROM 施設休止履歴 WHERE 施設ID = 100');
    });
});

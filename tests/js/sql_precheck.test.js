/**
 * SQL事前チェック（コンパイル的検証）
 * 全SQLビルダーが生成するクエリのカラム名をDBスキーマと照合し、
 * 存在しないカラム参照を検出する。
 *
 * JET/ADOでは不明カラム名をパラメータとして扱い、
 * "1 つ以上の必要なパラメーターの値が設定されていません" エラーになる。
 * このテストでそれを事前に防ぐ。
 */
const logic = require('../../app_logic.js');
const fs = require('fs');
const path = require('path');

// ===== DBスキーマ定義 =====
// .sql エクスポート + HTA migrateDatabase() で追加されるカラムを含む

function loadSchemaFromSqlFiles() {
    const tbldefs = path.join(__dirname, '../../schema/tbldefs');
    const schema = {};
    const files = fs.readdirSync(tbldefs).filter(f => f.endsWith('.sql'));
    for (const file of files) {
        const content = fs.readFileSync(path.join(tbldefs, file), 'utf-8');
        const tableMatch = content.match(/CREATE TABLE \[(.+?)\]/);
        if (!tableMatch) continue;
        const tableName = tableMatch[1];
        const columns = [];
        const colRegex = /\[([^\]]+)\]\s+(?:AUTOINCREMENT|LONG|VARCHAR|BIT|DATETIME|DOUBLE|INTEGER|MEMO|YESNO)/gi;
        let m;
        while ((m = colRegex.exec(content)) !== null) {
            columns.push(m[1]);
        }
        schema[tableName] = columns;
    }
    return schema;
}

const schema = loadSchemaFromSqlFiles();

// HTA migrateDatabase() で追加されるカラム
// .sqlエクスポートに含まれていても、旧DBに存在しない可能性があるカラムはここに列挙する。
// → テストが「HTAのmigrateDatabase()にマイグレーションがあるか」を検証する。
// → 新カラムをクエリに追加したらここにも追加 → マイグレーション忘れでテスト失敗。
const MIGRATION_COLUMNS = {
    '役員': ['代表者フラグ'],
    '車両': ['普通フラグ', '特管フラグ'],
    '処理能力': ['施設ID'],
    '施設': ['取消理由', '廃止確認日', '埋立終了年月日', '保管施設面積m2', '保管量上限m3', '保管高さm', '廃止理由'],
    '許可': ['変更許可フラグ', '失効新規フラグ']
};

for (const [table, cols] of Object.entries(MIGRATION_COLUMNS)) {
    if (schema[table]) {
        for (const col of cols) {
            if (!schema[table].includes(col)) {
                schema[table].push(col);
            }
        }
    }
}

// ===== HTAマイグレーション解析 =====
// app_source.hta の migrateDatabase() から実際にマイグレーションされるカラムを抽出

function parseMigrationsFromHta() {
    const htaPath = path.join(__dirname, '../../app_source.hta');
    const htaContent = fs.readFileSync(htaPath, 'utf-8');

    // migrateDatabase() 関数の範囲を抽出
    const funcStart = htaContent.indexOf('function migrateDatabase()');
    if (funcStart < 0) return {};
    // 次の "function " まで（大まかに）
    const nextFunc = htaContent.indexOf('\n        function ', funcStart + 1);
    const migrateBody = htaContent.substring(funcStart, nextFunc > 0 ? nextFunc : funcStart + 5000);

    // ALTER TABLE テーブル ADD COLUMN [カラム名] 型 パターン
    const migrated = {};
    const addColRe = /ALTER TABLE\s+(\S+)\s+ADD COLUMN\s+\[?([^\]\s]+)\]?\s+/gi;
    let m;
    while ((m = addColRe.exec(migrateBody)) !== null) {
        const table = m[1].replace(/[\[\]]/g, '');
        const col = m[2];
        if (!migrated[table]) migrated[table] = [];
        if (!migrated[table].includes(col)) migrated[table].push(col);
    }

    // facilityMigrations 配列パターン: {name: "カラム名", type: "型"}
    const facMigRe = /\{name:\s*"([^"]+)",\s*type:\s*"[^"]+"\}/g;
    while ((m = facMigRe.exec(migrateBody)) !== null) {
        const col = m[1];
        if (!migrated['施設']) migrated['施設'] = [];
        if (!migrated['施設'].includes(col)) migrated['施設'].push(col);
    }

    return migrated;
}

const htaMigrations = parseMigrationsFromHta();

// ===== SQL解析ユーティリティ =====

/**
 * SQLからテーブル名.カラム名の参照を抽出する
 * パターン: テーブル名.カラム名
 */
function extractQualifiedColumns(sql) {
    const refs = [];
    // テーブル.カラム パターン（日本語対応）
    const re = /([^\s,=(]+)\.([\u3000-\u9FFFa-zA-Z0-9_]+)/g;
    let m;
    while ((m = re.exec(sql)) !== null) {
        refs.push({ table: m[1], column: m[2] });
    }
    return refs;
}

/**
 * INSERT INTO テーブル (カラム1, カラム2...) からカラムを抽出
 */
function extractInsertColumns(sql) {
    const m = sql.match(/INSERT INTO\s+([^\s(]+)\s*\(([^)]+)\)/i);
    if (!m) return null;
    const table = m[1].replace(/[\[\]]/g, '');
    const columns = m[2].split(',').map(c => c.trim().replace(/[\[\]]/g, ''));
    return { table, columns };
}

/**
 * UPDATE テーブル SET カラム1 = ... からカラムを抽出
 */
function extractUpdateColumns(sql) {
    const m = sql.match(/UPDATE\s+([^\s]+)\s+SET\s+(.+?)\s+WHERE/is);
    if (!m) return null;
    const table = m[1].replace(/[\[\]]/g, '');
    const setPart = m[2];
    const columns = [];
    const colRe = /([\u3000-\u9FFFa-zA-Z0-9_]+)\s*=/g;
    let cm;
    while ((cm = colRe.exec(setPart)) !== null) {
        columns.push(cm[1]);
    }
    return { table, columns };
}

/**
 * SELECT ... FROM テーブル のカラムを抽出（テーブルプレフィクスなし）
 * Format(カラム名, ...) AS 別名 パターンも対応
 */
function extractSelectColumns(sql) {
    const results = [];
    // FROMの前の部分を取得
    const fromIdx = sql.search(/\bFROM\b/i);
    if (fromIdx < 0) return results;
    const selectPart = sql.substring(0, fromIdx);

    // Format(カラム名, ...) AS 別名 パターン
    const formatRe = /Format\(([^\s,)]+)/gi;
    let m;
    while ((m = formatRe.exec(selectPart)) !== null) {
        const col = m[1].replace(/[\[\]]/g, '');
        // テーブル.カラム の場合はカラム部分のみ
        const parts = col.split('.');
        results.push(parts[parts.length - 1]);
    }

    // Format() を除去してからカンマ分割
    // Format(...) を一旦プレースホルダに置換
    let cleaned = selectPart.replace(/^SELECT\s+/i, '');
    let formatIdx = 0;
    cleaned = cleaned.replace(/Format\([^)]+\)\s+AS\s+[\u3000-\u9FFFa-zA-Z0-9_]+/gi, function() {
        return '__FORMAT_' + (formatIdx++) + '__';
    });
    cleaned = cleaned.replace(/Format\([^)]+\)/gi, function() {
        return '__FORMAT_' + (formatIdx++) + '__';
    });

    const items = cleaned.split(',');
    for (const item of items) {
        const trimmed = item.trim();
        // Format プレースホルダはスキップ
        if (/^__FORMAT_/.test(trimmed)) continue;
        // AS別名がある場合
        if (/\bAS\b/i.test(trimmed)) {
            const beforeAs = trimmed.split(/\bAS\b/i)[0].trim();
            if (!/^__FORMAT_/.test(beforeAs)) {
                const parts = beforeAs.replace(/[\[\]]/g, '').split('.');
                results.push(parts[parts.length - 1]);
            }
            continue;
        }
        // テーブル.カラム or カラム
        if (trimmed && !/^\*$/.test(trimmed) && !/^COUNT\(/i.test(trimmed) && !/^MAX\(/i.test(trimmed) && !/^__FORMAT_/.test(trimmed)) {
            const parts = trimmed.replace(/[\[\]]/g, '').split('.');
            results.push(parts[parts.length - 1]);
        }
    }
    return results;
}

/**
 * FROM/JOIN句からメインテーブルを抽出
 */
function extractMainTable(sql) {
    const m = sql.match(/\bFROM\s+[\(\s]*([^\s(,]+)/i);
    if (!m) return null;
    return m[1].replace(/[\[\]]/g, '');
}

/**
 * カラムがスキーマに存在するかチェック
 */
function validateColumn(table, column) {
    if (!schema[table]) return { valid: false, reason: 'テーブル "' + table + '" が見つかりません' };
    if (!schema[table].includes(column)) {
        return { valid: false, reason: 'テーブル "' + table + '" にカラム "' + column + '" がありません' };
    }
    return { valid: true };
}

// ===== テストデータ =====
const samplePermitData = {
    businessId: 1, categoryId: 1, permitNumber: 'TEST-001',
    permitDate: '2026/01/01', validDate: '2031/01/01',
    todayStr: '2026/01/01', logicalId: 1
};
const sampleFacilityData = {
    logicalId: 1, businessId: 1, typeId: 1, location: 'テスト',
    permitNo: 'F-001', todayStr: '2026/01/01'
};
const sampleVehicleData = {
    businessId: 1, regNum1: '秋田', regNum2: '100', regNum3: 'あ', regNum4: '1234',
    normalFlag: true, specialFlag: false
};
const sampleOfficerData = {
    businessId: 1, position: '取締役', lastName: '山田', firstName: '太郎'
};
const sampleCapacityData = {
    facilityId: 1, itemId: 1, hourCap: 10, hourUnit: 1, dayCap: 100, dayUnit: 1
};
const sampleBusinessData = {
    name: 'テスト', zip: '010-0000', pref: '秋田県', address: 'テスト市', tel: '018-000-0000'
};

// ===== テスト本体 =====

describe('SQL事前チェック: スキーマ読み込み', () => {
    test('主要テーブルが読み込まれていること', () => {
        expect(schema['事業者']).toBeDefined();
        expect(schema['許可']).toBeDefined();
        expect(schema['施設']).toBeDefined();
        expect(schema['車両']).toBeDefined();
        expect(schema['役員']).toBeDefined();
        expect(schema['処理能力']).toBeDefined();
        expect(schema['許可品目']).toBeDefined();
    });

    test('マスターテーブルが読み込まれていること', () => {
        expect(schema['マスター_許可区分']).toBeDefined();
        expect(schema['マスター_施設種別']).toBeDefined();
        expect(schema['マスター_管理区分']).toBeDefined();
        expect(schema['マスター_処理方法']).toBeDefined();
        expect(schema['マスター_設置形態区分']).toBeDefined();
        expect(schema['マスター_品目']).toBeDefined();
    });

    test('マイグレーションカラムが含まれていること', () => {
        expect(schema['役員']).toContain('代表者フラグ');
        expect(schema['車両']).toContain('普通フラグ');
        expect(schema['車両']).toContain('特管フラグ');
        expect(schema['処理能力']).toContain('施設ID');
    });
});

describe('SQL事前チェック: INSERT文カラム検証', () => {
    const insertBuilders = [
        { name: 'buildSavePermitQuery', fn: () => logic.buildSavePermitQuery(samplePermitData) },
        { name: 'buildSaveFacilityQuery', fn: () => logic.buildSaveFacilityQuery(sampleFacilityData) },
        { name: 'buildSaveVehicleQuery', fn: () => logic.buildSaveVehicleQuery(sampleVehicleData) },
        { name: 'buildSaveOfficerQuery', fn: () => logic.buildSaveOfficerQuery(sampleOfficerData) },
        { name: 'buildSaveCapacityQuery(new)', fn: () => logic.buildSaveCapacityQuery(sampleCapacityData) },
        { name: 'buildSaveBusinessQuery', fn: () => logic.buildSaveBusinessQuery(sampleBusinessData) },
        { name: 'buildPermitItemQueries', fn: () => logic.buildPermitItemQueries(1, 1).insert },
    ];

    for (const builder of insertBuilders) {
        test(builder.name + ': INSERT先カラムがテーブルに存在すること', () => {
            const sql = builder.fn();
            const parsed = extractInsertColumns(sql);
            if (!parsed) return; // UPDATEになる場合はスキップ
            const errors = [];
            for (const col of parsed.columns) {
                const result = validateColumn(parsed.table, col);
                if (!result.valid) errors.push(result.reason);
            }
            expect(errors).toEqual([]);
        });
    }
});

describe('SQL事前チェック: UPDATE文カラム検証', () => {
    const updateBuilders = [
        { name: 'buildSaveBusinessQuery(edit)', fn: () => logic.buildSaveBusinessQuery({...sampleBusinessData, editId: 1}) },
        { name: 'buildSaveVehicleQuery(edit)', fn: () => logic.buildSaveVehicleQuery({...sampleVehicleData, editId: 1}) },
        { name: 'buildSaveOfficerQuery(edit)', fn: () => logic.buildSaveOfficerQuery({...sampleOfficerData, editId: 1}) },
        { name: 'buildSaveCapacityQuery(edit)', fn: () => logic.buildSaveCapacityQuery({...sampleCapacityData, editId: 1}) },
        { name: 'buildAbolishPermitQuery', fn: () => logic.buildAbolishPermitQuery(1, '2026/01/01', 'test') },
        { name: 'buildCancelPermitQuery', fn: () => logic.buildCancelPermitQuery(1, '2026/01/01', 'test') },
        { name: 'buildRestorePermitQuery', fn: () => logic.buildRestorePermitQuery(1) },
        { name: 'buildAbolishFacilityQuery', fn: () => logic.buildAbolishFacilityQuery(1, '2026/01/01') },
        { name: 'buildCancelFacilityQuery', fn: () => logic.buildCancelFacilityQuery(1, '2026/01/01', 'test') },
        { name: 'buildRestoreFacilityQuery', fn: () => logic.buildRestoreFacilityQuery(1) },
        { name: 'buildScrapVehicleQuery', fn: () => logic.buildScrapVehicleQuery(1) },
        { name: 'buildRestoreVehicleQuery', fn: () => logic.buildRestoreVehicleQuery(1) },
        { name: 'buildUpdatePermitHistoryQuery', fn: () => logic.buildUpdatePermitHistoryQuery({permitId:1, permitNumber:'X', categoryId:1, permitDate:'2026/01/01'}) },
        { name: 'buildUpdateFacilityHistoryQuery', fn: () => logic.buildUpdateFacilityHistoryQuery({facilityId:1, typeId:1, location:'テスト', managementTypeId:1}) },
    ];

    for (const builder of updateBuilders) {
        test(builder.name + ': UPDATE先カラムがテーブルに存在すること', () => {
            const sql = builder.fn();
            const parsed = extractUpdateColumns(sql);
            if (!parsed) return;
            const errors = [];
            for (const col of parsed.columns) {
                const result = validateColumn(parsed.table, col);
                if (!result.valid) errors.push(result.reason);
            }
            expect(errors).toEqual([]);
        });
    }
});

describe('SQL事前チェック: SELECT文 テーブル修飾カラム検証', () => {
    const selectBuilders = [
        { name: 'buildLoadPermitsQuery', fn: () => logic.buildLoadPermitsQuery(1) },
        { name: 'buildLoadFacilitiesForBusinessQuery', fn: () => logic.buildLoadFacilitiesForBusinessQuery(1) },
        { name: 'buildLoadProcessingCapacityQuery', fn: () => logic.buildLoadProcessingCapacityQuery(1) },
        { name: 'buildLoadPermitHistoryQuery', fn: () => logic.buildLoadPermitHistoryQuery(1) },
        { name: 'buildLoadFacilityHistoryQuery', fn: () => logic.buildLoadFacilityHistoryQuery(1) },
        { name: 'buildLoadOfficersForBusinessQuery', fn: () => logic.buildLoadOfficersForBusinessQuery(1) },
        { name: 'buildLoadFacilityForEditQuery', fn: () => logic.buildLoadFacilityForEditQuery(1) },
        { name: 'buildLoadPermitForEditQuery', fn: () => logic.buildLoadPermitForEditQuery(1) },
        { name: 'buildLoadPermitItemsQuery', fn: () => logic.buildLoadPermitItemsQuery(1) },
    ];

    for (const builder of selectBuilders) {
        test(builder.name + ': テーブル修飾カラムが存在すること', () => {
            const sql = builder.fn();
            const refs = extractQualifiedColumns(sql);
            // サブクエリのエイリアス(AS f2等)を解決する
            const aliasMap = {};
            const aliasRe = /(\S+)\s+AS\s+(\w+)/gi;
            let am;
            while ((am = aliasRe.exec(sql)) !== null) {
                aliasMap[am[2]] = am[1];
            }
            const errors = [];
            for (const ref of refs) {
                // Format関数の引数やAS別名内のドットはスキップ
                if (ref.table === "'" || ref.table === '#') continue;
                const resolvedTable = aliasMap[ref.table] || ref.table;
                const result = validateColumn(resolvedTable, ref.column);
                if (!result.valid) errors.push(ref.table + '.' + ref.column + ' → ' + result.reason);
            }
            expect(errors).toEqual([]);
        });
    }
});

describe('SQL事前チェック: SELECT文 非修飾カラム検証', () => {
    // 単一テーブルからのSELECT（テーブルプレフィクスなし）
    const singleTableSelects = [
        { name: 'buildLoadFacilityForEditQuery', fn: () => logic.buildLoadFacilityForEditQuery(1), table: '施設' },
        { name: 'buildLoadPermitItemsQuery', fn: () => logic.buildLoadPermitItemsQuery(1), table: '許可品目' },
    ];

    for (const builder of singleTableSelects) {
        test(builder.name + ': カラムがテーブル "' + builder.table + '" に存在すること', () => {
            const sql = builder.fn();
            const columns = extractSelectColumns(sql);
            const errors = [];
            for (const col of columns) {
                // AS別名はスキップ
                if (col.includes('文字列') && !schema[builder.table].includes(col)) continue;
                const result = validateColumn(builder.table, col);
                if (!result.valid) errors.push(col + ' → ' + result.reason);
            }
            expect(errors).toEqual([]);
        });
    }
});

describe('SQL事前チェック: WHERE句カラム検証', () => {
    test('buildLoadFacilitiesForBusinessQuery: WHERE句のカラムが存在すること', () => {
        const sql = logic.buildLoadFacilitiesForBusinessQuery(1);
        // WHERE 施設.事業者ID = X AND 施設.有効終了日時 IS NULL AND 施設.廃止年月日 IS NULL
        expect(sql).toContain('施設.事業者ID');
        expect(sql).toContain('施設.有効終了日時');
        expect(sql).toContain('施設.廃止年月日');
        expect(schema['施設']).toContain('事業者ID');
        expect(schema['施設']).toContain('有効終了日時');
        expect(schema['施設']).toContain('廃止年月日');
    });

    test('buildLoadPermitsQuery: WHERE句のカラムが存在すること', () => {
        const sql = logic.buildLoadPermitsQuery(1);
        expect(sql).toContain('許可.事業者ID');
        expect(schema['許可']).toContain('事業者ID');
    });

    test('buildLoadProcessingCapacityQuery: WHERE句のカラムが存在すること', () => {
        const sql = logic.buildLoadProcessingCapacityQuery(1);
        // 処理能力.施設ID が使われている
        const refs = extractQualifiedColumns(sql);
        const capacityRefs = refs.filter(r => r.table === '処理能力');
        const errors = [];
        for (const ref of capacityRefs) {
            const result = validateColumn('処理能力', ref.column);
            if (!result.valid) errors.push(ref.column + ' → ' + result.reason);
        }
        expect(errors).toEqual([]);
    });
});

describe('SQL事前チェック: JOIN条件カラム検証', () => {
    test('buildLoadFacilitiesForBusinessQuery: JOIN条件のカラムが存在すること', () => {
        const sql = logic.buildLoadFacilitiesForBusinessQuery(1);
        const refs = extractQualifiedColumns(sql);
        // サブクエリのエイリアス(AS f2等)を解決する
        const aliasMap = {};
        const aliasRe = /(\S+)\s+AS\s+(\w+)/gi;
        let am;
        while ((am = aliasRe.exec(sql)) !== null) {
            aliasMap[am[2]] = am[1];
        }
        const errors = [];
        for (const ref of refs) {
            if (ref.table === "'" || ref.table === '#') continue;
            const resolvedTable = aliasMap[ref.table] || ref.table;
            const result = validateColumn(resolvedTable, ref.column);
            if (!result.valid) errors.push(ref.table + '.' + ref.column + ' → ' + result.reason);
        }
        expect(errors).toEqual([]);
    });
});

// ===== マイグレーション整合性テスト =====
// MIGRATION_COLUMNS に登録されたカラムが HTA の migrateDatabase() で
// 実際にマイグレーションされているかを検証する。
// 新カラムをクエリに追加 → MIGRATION_COLUMNS に追加 → HTAにマイグレーション追加
// のどれかが欠けていればテストが失敗する。

describe('SQL事前チェック: マイグレーション整合性', () => {
    test('HTAのmigrateDatabase()が正しくパースされていること', () => {
        // 既知のマイグレーション（役員.代表者フラグ等）が検出されること
        expect(htaMigrations['役員']).toContain('代表者フラグ');
        expect(htaMigrations['車両']).toContain('普通フラグ');
        expect(htaMigrations['車両']).toContain('特管フラグ');
    });

    for (const [table, cols] of Object.entries(MIGRATION_COLUMNS)) {
        // 処理能力.施設ID は実DBに元々存在する（.sqlエクスポートの欠落）のでスキップ
        if (table === '処理能力') continue;

        for (const col of cols) {
            test(table + '.' + col + ': HTAにマイグレーションが存在すること', () => {
                const htaCols = htaMigrations[table] || [];
                expect(htaCols).toContain(col);
            });
        }
    }
});

describe('SQL事前チェック: クエリ参照カラムのマイグレーション網羅', () => {
    // 全SQLビルダーが参照するカラムのうち、.sqlエクスポートに無いものは
    // MIGRATION_COLUMNS に登録されている必要がある
    const baseSchema = loadSchemaFromSqlFiles(); // マイグレーション追加前の素のスキーマ

    // 全ビルダーからカラム参照を収集
    function collectAllReferencedColumns() {
        const refs = {}; // { table: Set<column> }
        function addRef(table, col) {
            if (!refs[table]) refs[table] = new Set();
            refs[table].add(col);
        }

        // INSERT系
        const insertSqls = [
            logic.buildSavePermitQuery(samplePermitData),
            logic.buildSaveFacilityQuery(sampleFacilityData),
            logic.buildSaveVehicleQuery(sampleVehicleData),
            logic.buildSaveOfficerQuery(sampleOfficerData),
            logic.buildSaveCapacityQuery(sampleCapacityData),
            logic.buildSaveBusinessQuery(sampleBusinessData),
        ];
        for (const sql of insertSqls) {
            const parsed = extractInsertColumns(sql);
            if (parsed) parsed.columns.forEach(c => addRef(parsed.table, c));
        }

        // UPDATE系
        const updateSqls = [
            logic.buildSaveBusinessQuery({...sampleBusinessData, editId: 1}),
            logic.buildSaveVehicleQuery({...sampleVehicleData, editId: 1}),
            logic.buildSaveOfficerQuery({...sampleOfficerData, editId: 1}),
            logic.buildAbolishFacilityQuery(1, '2026/01/01', '2026/01/01'),
            logic.buildCancelFacilityQuery(1, '2026/01/01', 'test'),
            logic.buildRestoreFacilityQuery(1),
            logic.buildUpdateFacilityHistoryQuery({facilityId:1, typeId:1, location:'テスト',
                managementTypeId:1, storageAreaM2:100, storageCapM3:50, storageHeightM:3,
                abolishConfirmDate:'2026/01/01', cancelDate:'2026/01/01', cancelReason:'test'}),
        ];
        for (const sql of updateSqls) {
            const parsed = extractUpdateColumns(sql);
            if (parsed) parsed.columns.forEach(c => addRef(parsed.table, c));
        }

        // SELECT系（テーブル修飾あり）
        const selectSqls = [
            logic.buildLoadFacilitiesForBusinessQuery(1),
            logic.buildLoadProcessingCapacityQuery(1),
            logic.buildLoadPermitsQuery(1),
            logic.buildLoadPermitHistoryQuery(1),
            logic.buildLoadFacilityHistoryQuery(1),
            logic.buildLoadOfficersForBusinessQuery(1),
        ];
        for (const sql of selectSqls) {
            // サブクエリのエイリアス(AS f2等)を解決する
            const aliasMap = {};
            const aliasRe = /(\S+)\s+AS\s+(\w+)/gi;
            let am;
            while ((am = aliasRe.exec(sql)) !== null) {
                aliasMap[am[2]] = am[1];
            }
            const qRefs = extractQualifiedColumns(sql);
            for (const r of qRefs) {
                if (r.table === "'" || r.table === '#') continue;
                const resolvedTable = aliasMap[r.table] || r.table;
                addRef(resolvedTable, r.column);
            }
        }

        // SELECT系（単一テーブル、非修飾）
        const facilityEditSql = logic.buildLoadFacilityForEditQuery(1);
        const facCols = extractSelectColumns(facilityEditSql);
        for (const c of facCols) {
            if (!c.includes('文字列')) addRef('施設', c);
        }

        return refs;
    }

    const allRefs = collectAllReferencedColumns();

    test('SQLビルダーが参照するカラムで、.sqlに無いものはMIGRATION_COLUMNSに登録されていること', () => {
        const errors = [];
        for (const [table, colSet] of Object.entries(allRefs)) {
            const baseCols = baseSchema[table] || [];
            const migCols = MIGRATION_COLUMNS[table] || [];
            for (const col of colSet) {
                if (!baseCols.includes(col) && !migCols.includes(col)) {
                    errors.push(table + '.' + col + ': .sqlに無く、MIGRATION_COLUMNSにも未登録');
                }
            }
        }
        expect(errors).toEqual([]);
    });
});

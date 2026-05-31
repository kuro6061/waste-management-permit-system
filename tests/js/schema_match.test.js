/**
 * DBスキーマ整合性テスト
 *
 * SQLクエリが参照するカラム名がDBテーブル定義と一致することを検証する。
 * 「休止日」vs「休止年月日」のようなカラム名不一致バグの再発を防止する。
 */
const logic = require('../../app_logic.js');
const fs = require('fs');
const path = require('path');

// --- DBスキーマ定義を公開用schema/tbldefsから読み込み ---
var tbldefsDir = path.resolve(__dirname, '../../schema/tbldefs');

function parseColumns(sqlFile) {
    var content = fs.readFileSync(path.join(tbldefsDir, sqlFile), 'utf-8');
    var cols = [];
    var re = /\[([^\]]+)\]/g;
    var match;
    // 最初のマッチはテーブル名なのでスキップ
    var first = true;
    while ((match = re.exec(content)) !== null) {
        if (first) { first = false; continue; }
        // CONSTRAINT名やINDEX名はスキップ
        if (/^(PrimaryKey|Index_)/.test(match[1])) continue;
        cols.push(match[1]);
    }
    return cols;
}

var SCHEMA = {
    施設: parseColumns('施設.sql'),
    許可: parseColumns('許可.sql'),
    事業者: parseColumns('事業者.sql'),
    車両: parseColumns('車両.sql'),
    処理能力: parseColumns('処理能力.sql'),
    役員: parseColumns('役員.sql')
};

// --- ヘルパー: SQLからカラム参照を抽出 ---
// JET SQLの日本語カラム名（施設種別ID, 保管施設面積m2 等）に対応
function extractReferencedColumns(sql, tableName) {
    var schemaCols = SCHEMA[tableName] || [];
    var found = [];

    // 方針: SQLテキスト中にスキーマのカラム名が含まれているかを直接チェック
    // カラム名の部分一致を避けるため、長い名前から先にチェック
    var sorted = schemaCols.slice().sort(function(a, b) { return b.length - a.length; });
    var remaining = sql;
    for (var i = 0; i < sorted.length; i++) {
        if (remaining.indexOf(sorted[i]) !== -1) {
            found.push(sorted[i]);
            // 見つかったカラム名を置換して部分一致を防止
            while (remaining.indexOf(sorted[i]) !== -1) {
                remaining = remaining.replace(sorted[i], '___MATCHED___');
            }
        }
    }
    return found;
}

// SQLで参照されているがDBスキーマに存在しないカラムを検出
function findUnknownColumns(sql, tableName) {
    var schemaCols = SCHEMA[tableName] || [];
    var unknown = [];

    // Format(カラム名, ...) パターン
    var formatRe = /Format\((?:[\w\u3000-\u9fff]+\.)?([^\s,)]+)/g;
    var m;
    while ((m = formatRe.exec(sql)) !== null) {
        var col = m[1];
        if (schemaCols.indexOf(col) === -1 && !isNonColumn(col)) unknown.push(col);
    }

    // SET カラム名 = パターン (UPDATE文)
    var setRe = /SET\s+(.+?)(?:\s+WHERE)/i;
    var setMatch = setRe.exec(sql);
    if (setMatch) {
        var setParts = setMatch[1].split(',');
        for (var i = 0; i < setParts.length; i++) {
            var eqMatch = setParts[i].trim().match(/^([^\s=]+)\s*=/);
            if (eqMatch) {
                var c = eqMatch[1];
                if (schemaCols.indexOf(c) === -1 && !isNonColumn(c)) unknown.push(c);
            }
        }
    }

    // WHERE カラム名 = パターン
    var whereRe = /WHERE\s+(.+)$/i;
    var whereMatch = whereRe.exec(sql);
    if (whereMatch) {
        var whereColRe = /([^\s(,]+)\s*(?:=|IS\s)/g;
        while ((m = whereColRe.exec(whereMatch[1])) !== null) {
            var wc = m[1];
            // テーブル.カラム形式
            if (wc.indexOf('.') !== -1) wc = wc.split('.').pop();
            if (schemaCols.indexOf(wc) === -1 && !isNonColumn(wc)) unknown.push(wc);
        }
    }

    // 重複除去
    var unique = [];
    for (var j = 0; j < unknown.length; j++) {
        if (unique.indexOf(unknown[j]) === -1) unique.push(unknown[j]);
    }
    return unique;
}

function isNonColumn(s) {
    // 数値、SQL関数/キーワード、値リテラルを除外
    if (/^\d+$/.test(s)) return true;
    if (/^(NULL|TRUE|FALSE|AND|OR|NOT|COUNT|MAX|MIN|SELECT|FROM|WHERE|SET|UPDATE|INSERT|INTO|VALUES|DELETE|ORDER|BY|ASC|DESC|LIKE|IN|BETWEEN|IS|AS|FORMAT|施設|許可|事業者|車両|処理能力|役員)$/i.test(s)) return true;
    if (/^#/.test(s)) return true;
    if (/^'/.test(s)) return true;
    return false;
}

function validateColumnsExist(sql, tableName) {
    var referenced = extractReferencedColumns(sql, tableName);
    var schemaCols = SCHEMA[tableName];
    var missing = [];
    for (var i = 0; i < referenced.length; i++) {
        if (schemaCols.indexOf(referenced[i]) === -1) {
            missing.push(referenced[i]);
        }
    }
    return missing;
}

// ===== 施設テーブル =====
describe('施設テーブル: SQLカラム名がDBスキーマと一致', function() {

    test('buildLoadFacilityForEditQuery のカラムが全て存在', function() {
        var sql = logic.buildLoadFacilityForEditQuery(1);
        var missing = findUnknownColumns(sql, '施設');
        expect(missing).toEqual([]);
    });

    test('buildUpdateFacilityHistoryQuery のカラムが全て存在', function() {
        var sql = logic.buildUpdateFacilityHistoryQuery({
            facilityId: 1, typeId: 1, location: 'テスト',
            permitNo: '001', permitDate: '2025/01/01',
            setupDate: '2025/01/01', startDate: '2025/01/01',
            endDate: '2025/12/31', abolishDate: '2025/12/31',
            managementTypeId: 1, capacityM3: 100, areaM2: 200,
            landfillEndDate: '2030/01/01', processingMethodId: 1,
            setupFormId: 1, permitTargetId: 1
        });
        var missing = findUnknownColumns(sql, '施設');
        expect(missing).toEqual([]);
    });

    test('buildSaveFacilityQuery のカラムが全て存在', function() {
        var sql = logic.buildSaveFacilityQuery({
            logicalId: 1, businessId: 1, typeId: 1,
            location: 'テスト', permitNo: '001',
            permitDate: '2025/01/01', todayStr: '2025/01/01'
        });
        var missing = findUnknownColumns(sql, '施設');
        expect(missing).toEqual([]);
    });

    test('buildRestoreFacilityQuery のカラムが全て存在', function() {
        var sql = logic.buildRestoreFacilityQuery(1);
        var missing = findUnknownColumns(sql, '施設');
        expect(missing).toEqual([]);
    });

    test('buildAbolishFacilityQuery のカラムが全て存在', function() {
        var sql = logic.buildAbolishFacilityQuery(1, '2025/06/01');
        var missing = findUnknownColumns(sql, '施設');
        expect(missing).toEqual([]);
    });

    test('buildLoadFacilityHistoryQuery のカラムが全て存在', function() {
        var sql = logic.buildLoadFacilityHistoryQuery(1);
        var missing = findUnknownColumns(sql, '施設');
        expect(missing).toEqual([]);
    });

    test('DBスキーマに休止年月日/再開年月日/取消年月日が存在（年月日サフィックス確認）', function() {
        var cols = SCHEMA['施設'];
        expect(cols).toContain('休止年月日');
        expect(cols).toContain('再開年月日');
        expect(cols).toContain('取消年月日');
        expect(cols).toContain('保管施設面積m2');
        expect(cols).toContain('保管量上限m3');
        expect(cols).toContain('保管高さm');
        // 間違った名前が使われていないこと
        expect(cols).not.toContain('休止日');
        expect(cols).not.toContain('再開日');
        expect(cols).not.toContain('取消日');
    });
});

// ===== 許可テーブル =====
describe('許可テーブル: SQLカラム名がDBスキーマと一致', function() {

    test('buildSavePermitQuery のカラムが全て存在', function() {
        var sql = logic.buildSavePermitQuery({
            logicalId: 1, businessId: 1, categoryId: 1,
            permitNo: '001', permitDate: '2025/01/01',
            expiryDate: '2030/01/01', isExcellent: false,
            todayStr: '2025/01/01'
        });
        var missing = findUnknownColumns(sql, '許可');
        expect(missing).toEqual([]);
    });

    test('buildUpdatePermitHistoryQuery のカラムが全て存在', function() {
        var sql = logic.buildUpdatePermitHistoryQuery({
            permitId: 1, categoryId: 1, permitNo: '001',
            permitDate: '2025/01/01', expiryDate: '2030/01/01',
            isExcellent: false, abolishDate: '2025/12/31',
            cancelDate: '2025/12/31', startDate: '2025/01/01',
            endDate: '2025/12/31'
        });
        var missing = findUnknownColumns(sql, '許可');
        expect(missing).toEqual([]);
    });

    test('buildRestorePermitQuery のカラムが全て存在', function() {
        var sql = logic.buildRestorePermitQuery(1);
        var missing = findUnknownColumns(sql, '許可');
        expect(missing).toEqual([]);
    });

    test('buildAbolishPermitQuery のカラムが全て存在', function() {
        var sql = logic.buildAbolishPermitQuery(1, '2025/06/01', '事業廃止');
        var missing = findUnknownColumns(sql, '許可');
        expect(missing).toEqual([]);
    });

    test('buildCancelPermitQuery のカラムが全て存在', function() {
        var sql = logic.buildCancelPermitQuery(1, '2025/06/01', '行政処分');
        var missing = findUnknownColumns(sql, '許可');
        expect(missing).toEqual([]);
    });

    test('許可テーブルの取消日は「取消日」（年月日なし）であること', function() {
        var cols = SCHEMA['許可'];
        expect(cols).toContain('取消日');
        expect(cols).toContain('廃止日');
        // 施設と異なり「年月日」サフィックスがない
        expect(cols).not.toContain('取消年月日');
        expect(cols).not.toContain('廃止年月日');
    });
});

// ===== HTA内のSQL文字列も検証 =====
describe('HTA内の施設SQL: カラム名がDBスキーマと一致', function() {
    var htaContent;
    beforeAll(function() {
        htaContent = fs.readFileSync(
            path.resolve(__dirname, '../../app_source.hta'), 'utf-8'
        );
    });

    test('HTA内の施設UPDATEで「休止日」「再開日」「取消日」を使っていない', function() {
        // 施設テーブルへのUPDATEで間違ったカラム名を使っていないか
        var facilityUpdates = htaContent.match(/UPDATE\s+施設\s+SET\s+[^"']*/g) || [];
        for (var i = 0; i < facilityUpdates.length; i++) {
            var stmt = facilityUpdates[i];
            // 「休止日 =」のような間違ったカラム名がないこと
            expect(stmt).not.toMatch(/(?<!\w)休止日\s*=/);
            expect(stmt).not.toMatch(/(?<!\w)再開日\s*=/);
            expect(stmt).not.toMatch(/(?<!\w)取消日\s*=/);
        }
    });

    test('HTA内の施設UPDATEで正しい「休止年月日」「再開年月日」「取消年月日」を使用', function() {
        // 休止・再開・取消のSQL文が正しいカラム名を使っているか
        var content = htaContent;
        // 休止処理がある場合、正しいカラム名を使っていること
        if (/休止年月日\s*=\s*#/.test(content)) {
            expect(content).toMatch(/休止年月日\s*=\s*#/);
        }
        if (/再開年月日\s*=\s*#/.test(content)) {
            expect(content).toMatch(/再開年月日\s*=\s*#/);
        }
        if (/取消年月日\s*=\s*#/.test(content)) {
            expect(content).toMatch(/取消年月日\s*=\s*#/);
        }
    });
});

// ===== 命名規則の差異を明示的にドキュメント化 =====
describe('テーブル間のカラム命名規則の差異', function() {
    test('許可テーブルは「日」サフィックス、施設テーブルは「年月日」サフィックス', function() {
        // この差異が今回のバグの根本原因。
        // 許可: 取消日, 廃止日
        // 施設: 取消年月日, 廃止年月日, 休止年月日, 再開年月日
        expect(SCHEMA['許可']).toContain('取消日');
        expect(SCHEMA['許可']).toContain('廃止日');
        expect(SCHEMA['施設']).toContain('取消年月日');
        expect(SCHEMA['施設']).toContain('廃止年月日');
        expect(SCHEMA['施設']).toContain('休止年月日');
        expect(SCHEMA['施設']).toContain('再開年月日');
    });
});

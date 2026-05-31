/**
 * バッジ-バリデーション整合性テスト（コンパイラ型静的解析）
 *
 * HTAソースを静的解析し、UIバッジ（必須/任意）とバリデーションロジックの
 * 整合性を自動検証する。新しいフォームや入力欄を追加した際に、
 * バッジとバリデーションの食い違いを即座に検出する。
 *
 * 検出するバグパターン:
 *   1. badge-required なのにバリデーション未実施
 *   2. badge-optional なのにバリデーション実施（条件付き必須は除外リストで管理）
 *   3. バリデーション対象だがバッジが付いていない
 */
const fs = require('fs');
const path = require('path');

const htaSource = fs.readFileSync(
    path.join(__dirname, '..', '..', 'app_source.hta'), 'utf-8'
);
const htaLines = htaSource.split('\n');

// ────────────────────────────────────────
// ヘルパー関数
// ────────────────────────────────────────

/** 関数の開始行（1-based）を検索 */
function findFunctionLine(funcName) {
    for (var i = 0; i < htaLines.length; i++) {
        if (htaLines[i].indexOf('function ' + funcName + '(') >= 0) return i + 1;
    }
    return -1;
}

/** 関数の終了行を推定（ブレース対応） */
function findFunctionEnd(startLine) {
    if (startLine <= 0) return 1;
    var depth = 0, started = false;
    for (var i = startLine - 1; i < htaLines.length; i++) {
        for (var c = 0; c < htaLines[i].length; c++) {
            if (htaLines[i][c] === '{') { depth++; started = true; }
            if (htaLines[i][c] === '}') depth--;
        }
        if (started && depth <= 0) return i + 1;
    }
    return Math.min(startLine + 300, htaLines.length);
}

/** 指定範囲のソースを取得 */
function getSource(start, end) {
    return htaLines.slice(start - 1, end).join('\n');
}

/**
 * ソースからバッジ付きフィールドを抽出
 * バッジとIDが同じ行にあるパターンと、別行にあるパターン（ラベル行→次行にinput）の両方に対応。
 * 戻り値: [{ type: 'required'|'optional', inputId, label, line }]
 */
function extractBadgeFields(source, baseLineNum) {
    var results = [];
    var srcLines = source.split('\n');
    for (var i = 0; i < srcLines.length; i++) {
        var line = srcLines[i];
        // reqBadge 変数によるバッジ参照を展開
        var effectiveLine = line;
        if (/\+ reqBadge \+/.test(line) || /reqBadge \+/.test(line)) {
            effectiveLine = line.replace(/"\s*\+\s*reqBadge\s*\+\s*"/g,
                " <span class='badge-required'>必須</span>");
        }

        var badgeMatches = effectiveLine.match(/badge-(required|optional)/g);
        if (!badgeMatches) continue;

        for (var b = 0; b < badgeMatches.length; b++) {
            var badgeType = badgeMatches[b].replace('badge-', '');

            // 同じ行からinput/select IDを抽出（エスケープ引用符対応）
            var idMatches = [];
            var idRe = /id=(?:['"]|\\['"])([^'"\\]+)(?:['"]|\\')/g;
            var idMatch;
            while ((idMatch = idRe.exec(line)) !== null) {
                idMatches.push(idMatch[1]);
            }

            // 同じ行にIDがない場合、続く2行も検索（バッジとinputが別行のパターン）
            if (idMatches.length === 0) {
                for (var look = 1; look <= 2 && i + look < srcLines.length; look++) {
                    var lookLine = srcLines[i + look];
                    var lookIdRe = /id=(?:['"]|\\['"])([^'"\\]+)(?:['"]|\\')/g;
                    var lookIdMatch;
                    while ((lookIdMatch = lookIdRe.exec(lookLine)) !== null) {
                        idMatches.push(lookIdMatch[1]);
                    }
                    if (idMatches.length > 0) break;
                }
            }

            // ラベルテキストを抽出
            var labelMatch = line.match(/label[^>]*>([^<]*?)\s*<span/);
            var labelText = labelMatch ? labelMatch[1].trim() : '';

            // reqBadge 変数による間接参照（車両フォーム等）
            if (idMatches.length === 0 && /reqBadge/.test(line)) {
                var directIdMatch = line.match(/id='([^']+)'/);
                if (directIdMatch) idMatches.push(directIdMatch[1]);
            }

            if (idMatches.length > 0) {
                results.push({
                    type: badgeType,
                    inputId: idMatches[0],
                    label: labelText,
                    line: (baseLineNum || 0) + i + 1
                });
            }
        }
    }
    return results;
}

/**
 * 保存関数から missing.push("...") パターンで必須チェック対象を抽出
 * 戻り値: [ラベル文字列]
 */
function extractMissingPushFields(source) {
    var results = [];
    var re = /missing\.push\(\s*["']([^"']+)["']\s*\)/g;
    var match;
    while ((match = re.exec(source)) !== null) {
        results.push(match[1]);
    }
    return results;
}

// ────────────────────────────────────────
// フォーム定義レジストリ
//
// 新しいフォームを追加したらここに登録する。
// テストが通らなければ、バッジかバリデーションに不整合がある。
// ────────────────────────────────────────
var FORMS = [
    {
        name: '許可追加',
        formFunc: 'openPermitForm',
        saveFunc: 'savePermit',
        // savePermit は missing.push ではなく一括 if でチェック
        customRequired: function(src) {
            var fields = [];
            if (/!catId/.test(src)) fields.push('許可区分');
            if (/!number\b/.test(src)) fields.push('許可番号');
            if (/!pDate/.test(src)) fields.push('許可年月日');
            if (/!validDate/.test(src)) fields.push('許可有効年月日');
            return fields;
        },
        // inputId → バリデーションラベルのマッピング
        idToLabel: {
            'pCategory': '許可区分',
            'pNumber': '許可番号',
            'pDate': '許可年月日',
            'pValidDate': '許可有効年月日'
        }
    },
    {
        name: '許可編集',
        formFunc: 'showPermitEditForm',
        saveFunc: 'savePermitEdit',
        idToLabel: {
            'edit-permit-number': '許可番号',
            'edit-permit-category': '許可区分',
            'edit-permit-date': '許可年月日',
            'edit-permit-valid': '許可有効年月日'
        },
        // 条件付き必須（optional バッジだが特定条件で必須になるもの）
        conditionalRequired: []
    },
    {
        name: '施設追加',
        formFunc: 'openFacilityForm',
        saveFunc: 'saveFacility',
        customRequired: function(src) {
            var fields = [];
            if (/!typeId/.test(src)) fields.push('施設種別');
            if (/!location/.test(src)) fields.push('設置場所');
            return fields;
        },
        idToLabel: {
            'fType': '施設種別',
            'fLocation': '設置場所',
            'fPermitNo': '許可番号',
            'fPermitDate': '許可年月日',
            'fSetupDate': '設置年月日',
            'fMgmtType': '管理区分',
            'fCapacity': '容量(㎥)',
            'fArea': '面積(㎡)',
            'fLandfillEnd': '埋立終了年月日',
            'fMethod': '処理方法',
            'fSetupForm': '設置形態',
            'fPermitTarget': '許可対象区分'
            // 処理能力はインラインテーブル方式（addPendingCapacityRow）に変更
        },
        // 条件付き必須（許可対象区分=許可対象施設の場合に許可番号が必須）
        conditionalRequired: ['fPermitNo']
    },
    {
        name: '施設編集',
        formFunc: 'showFacilityEditForm',
        saveFunc: 'saveFacilityEdit',
        idToLabel: {
            'edit-fac-type': '施設種別',
            'edit-fac-location': '設置場所',
            'edit-fac-permit-no': '施設許可番号',
            'edit-fac-permit-date': '許可年月日',
            'edit-fac-setup-date': '設置年月日',
            'edit-fac-mgmt-type': '管理区分',
            'edit-fac-capacity': '容量(㎥)',
            'edit-fac-area': '面積(㎡)',
            'edit-fac-landfill-end': '埋立終了年月日',
            'edit-fac-method': '処理方法',
            'edit-fac-setup-form': '設置形態',
            'edit-fac-permit-target': '許可対象区分'
        },
        // 条件付き必須: 許可対象施設の場合のみ許可番号が必須
        conditionalRequired: ['edit-fac-permit-no']
    },
    {
        name: '車両',
        formFunc: 'openVehicleForm',
        saveFunc: 'saveVehicle',
        idToLabel: {
            'vReg1': '登録番号1（地名）',
            'vReg2': '登録番号2（分類番号）',
            'vReg3': '登録番号3（ひらがな）',
            'vReg4': '登録番号4（一連指定番号）'
        }
    },
    {
        name: '役員',
        formFunc: 'openOfficerForm',
        saveFunc: 'saveOfficer',
        idToLabel: {
            'offPosition': '役職名',
            'offLastName': '姓',
            'offFirstName': '名'
        }
    },
    {
        name: '処理能力',
        formFunc: 'openCapacityForm',
        saveFunc: 'saveCapacity',
        customRequired: function(src) {
            var fields = [];
            if (/!itemId/.test(src)) fields.push('品目');
            return fields;
        },
        idToLabel: {
            'capItemSelect': '品目',
            'capHourCap': '時間処理能力',
            'capDayCap': '日処理能力',
            'capHours': '稼働時間',
            'capNote': '特記事項'
        }
    },
    {
        name: 'マスター管理',
        formFunc: 'openMasterForm',
        saveFunc: 'saveMaster',
        customRequired: function(src) {
            var fields = [];
            if (/!name/.test(src)) fields.push('名');
            return fields;
        },
        idToLabel: {
            'inputMasterName': '名',
            'inputMasterExtra': '追加列',
            'inputMasterFk': 'FK参照'
        }
    }
];

// ================================================================
// メインテスト: 各フォームのバッジ/バリデーション整合性
// ================================================================

describe('コンパイラ: バッジ-バリデーション整合性チェック', function() {

    FORMS.forEach(function(form) {

        describe(form.name + 'フォーム', function() {

            var formStart, formEnd, saveStart, saveEnd;
            var formSource, saveSource;
            var badges, validatedFields;

            beforeAll(function() {
                formStart = findFunctionLine(form.formFunc);
                formEnd = findFunctionEnd(formStart);
                saveStart = findFunctionLine(form.saveFunc);
                saveEnd = findFunctionEnd(saveStart);

                formSource = formStart > 0 ? getSource(formStart, formEnd) : '';
                saveSource = saveStart > 0 ? getSource(saveStart, saveEnd) : '';

                badges = extractBadgeFields(formSource, formStart - 1);
                validatedFields = form.customRequired
                    ? form.customRequired(saveSource)
                    : extractMissingPushFields(saveSource);
            });

            test('フォーム生成関数 ' + form.formFunc + ' が存在する', function() {
                expect(formStart).toBeGreaterThan(0);
            });

            test('保存関数 ' + form.saveFunc + ' が存在する', function() {
                expect(saveStart).toBeGreaterThan(0);
            });

            test('badge-required → バリデーション実施', function() {
                var requiredBadges = badges.filter(function(b) { return b.type === 'required'; });
                var violations = [];

                requiredBadges.forEach(function(badge) {
                    var label = form.idToLabel[badge.inputId];
                    if (!label) return; // マッピング未定義はスキップ

                    var isValidated = validatedFields.some(function(f) {
                        return f === label || f.indexOf(label) >= 0 || label.indexOf(f) >= 0;
                    });
                    if (!isValidated) {
                        violations.push(
                            'L' + badge.line + ': id=' + badge.inputId +
                            ' (' + label + ') は badge-required だがバリデーション未実施'
                        );
                    }
                });

                expect(violations).toEqual([]);
            });

            test('badge-optional → バリデーションで必須チェックされていない', function() {
                var conditionalList = form.conditionalRequired || [];
                var optionalBadges = badges.filter(function(b) {
                    return b.type === 'optional' &&
                        conditionalList.indexOf(b.inputId) === -1;
                });
                var violations = [];

                optionalBadges.forEach(function(badge) {
                    var label = form.idToLabel[badge.inputId];
                    if (!label) return;

                    var isValidated = validatedFields.some(function(f) {
                        return f === label || f.indexOf(label) >= 0 || label.indexOf(f) >= 0;
                    });
                    if (isValidated) {
                        violations.push(
                            'L' + badge.line + ': id=' + badge.inputId +
                            ' (' + label + ') は badge-optional だが必須バリデーションされている'
                        );
                    }
                });

                expect(violations).toEqual([]);
            });

            test('バリデーション対象 → バッジが存在する', function() {
                var conditionalList = form.conditionalRequired || [];
                var violations = [];

                validatedFields.forEach(function(fieldLabel) {
                    // idToLabel の逆引き
                    var inputId = null;
                    Object.keys(form.idToLabel).forEach(function(id) {
                        if (form.idToLabel[id] === fieldLabel) inputId = id;
                    });
                    if (!inputId) return;

                    // 条件付き必須フィールドは動的バッジのためスキップ
                    // （動的切替テストで別途検証）
                    if (conditionalList.indexOf(inputId) >= 0) return;

                    var hasBadge = badges.some(function(b) {
                        return b.inputId === inputId;
                    });
                    if (!hasBadge) {
                        violations.push(
                            fieldLabel + ' (id=' + inputId +
                            ') はバリデーション必須だがバッジなし'
                        );
                    }
                });

                expect(violations).toEqual([]);
            });
        });
    });
});

// ================================================================
// 条件付き必須の整合性
// ================================================================

describe('コンパイラ: 条件付き必須フィールドの検証', function() {

    test('施設編集: 許可対象施設の場合のみ許可番号が必須チェックされる', function() {
        var start = findFunctionLine('saveFacilityEdit');
        var end = findFunctionEnd(start);
        var src = getSource(start, end);

        // 条件付きの判定ロジックが存在する
        expect(src).toMatch(/isPermitTarget/);
        // 許可番号の必須チェックが isPermitTarget に依存する
        expect(src).toMatch(/isPermitTarget\s*&&\s*!permitNo/);
    });

    test('条件付き必須フィールドにはバッジ動的切替コードが存在すること', function() {
        // conditionalRequired に登録されたフィールドは、条件に応じて
        // badge-required / badge-optional を動的に切り替えるコードが必要。
        // 切替コードがないと、ユーザーにはバッジが「任意」なのに
        // バリデーションで「必須」エラーが出る不整合が起きる。
        var violations = [];

        FORMS.forEach(function(form) {
            var conditionalList = form.conditionalRequired || [];
            if (conditionalList.length === 0) return;

            var formStart = findFunctionLine(form.formFunc);
            var formEnd = findFunctionEnd(formStart);
            var formSource = formStart > 0 ? getSource(formStart, formEnd) : '';

            conditionalList.forEach(function(inputId) {
                // 条件付き必須のフィールドには、ユーザーが条件を変更した時に
                // バッジ表示を動的に切り替えるコードが必要。
                //
                // 検出パターン:
                //   - 当該inputIdに隣接するバッジ要素のclassNameやinnerHTMLを書き換えるコード
                //   - onchange ハンドラ内で badge-required/badge-optional を切り替えるコード
                //   - updateBadge/toggleBadge 等の汎用切替関数呼び出し
                //
                // 注: フォーム内に badge-required と badge-optional が「それぞれ別フィールド用に」
                //     存在するだけでは不十分。当該フィールドのバッジを動的に変更するコードが必要。
                var escapedId = inputId.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');

                // フォーム関数内だけでなく、HTA全体から関連する切替コードを検索
                var hasDynamicBadge =
                    // パターン1: 当該フィールドIDのバッジ要素（id="xxx-badge"）が存在し、
                    //            それを書き換える関数がHTAに存在する
                    new RegExp(escapedId + '-badge').test(htaSource) &&
                    new RegExp(escapedId + '-badge[\\s\\S]{0,5}(className|innerText|innerHTML)').test(htaSource) ||
                    // パターン2: 汎用バッジ切替関数に当該フィールドIDを渡す
                    new RegExp('(updateBadge|toggleBadge|switchBadge|updateFieldBadge|updatePermitNoBadge)').test(htaSource) &&
                    new RegExp(escapedId + '-badge').test(htaSource) ||
                    // パターン3: 条件分岐で当該フィールドのバッジを出し分け（三項演算子等）
                    new RegExp(escapedId + '[\\s\\S]{0,30}\\?[\\s\\S]{0,30}badge-(required|optional)').test(formSource) ||
                    new RegExp('(isPermitTarget|permitTarget)[\\s\\S]{0,30}\\?[\\s\\S]{0,60}' + escapedId).test(formSource);

                if (!hasDynamicBadge) {
                    violations.push(
                        form.name + ': id=' + inputId +
                        ' は条件付き必須だがバッジ動的切替コードがない' +
                        '（ユーザーには「任意」表示のまま必須エラーが出る）'
                    );
                }
            });
        });

        expect(violations).toEqual([]);
    });

    test('許可変更モード: 変更事由発生日が必須チェックされる', function() {
        var start = findFunctionLine('savePermitEdit');
        var end = findFunctionEnd(start);
        var src = getSource(start, end);

        // 変更モードの判定
        expect(src).toMatch(/editingPermitMode\s*===\s*["']change["']/);
        // 変更事由発生日のチェック
        expect(src).toMatch(/edit-permit-change-event-date/);
        expect(src).toMatch(/!changeEventDate/);
    });
});

// ================================================================
// 静的HTMLフォーム: 事業者フォーム（動的生成ではないため別途検証）
// ================================================================

describe('コンパイラ: 事業者フォーム（静的HTML）', function() {
    // 事業者フォームは静的HTMLのため extractBadgeFields が使えない。
    // 直接HTMLソースから検証する。

    test('事業者名が badge-required かつ saveBusiness で必須チェックされている', function() {
        // バッジ
        expect(htaSource).toMatch(/id="inputBusinessName"[^>]*>/);
        expect(htaSource).toMatch(/事業者名\s*<span class="badge-required">/);

        // バリデーション
        var start = findFunctionLine('saveBusiness');
        var end = findFunctionEnd(start);
        var src = getSource(start, end);
        expect(src).toMatch(/!name/);
    });

    test('badge-optional な欄が saveBusiness で必須チェックされていない', function() {
        var start = findFunctionLine('saveBusiness');
        var end = findFunctionEnd(start);
        var src = getSource(start, end);

        // optional な欄: 事業者区分, 郵便番号, 都道府県, 市区町村, 電話番号
        var optionalIds = [
            { id: 'inputBusinessType', label: '事業者区分' },
            { id: 'inputZipCode', label: '郵便番号' },
            { id: 'inputPrefecture', label: '都道府県' },
            { id: 'inputAddress', label: '市区町村・町名番地' },
            { id: 'inputPhone', label: '電話番号' }
        ];
        var violations = [];
        optionalIds.forEach(function(f) {
            // missing.push にこのラベルが含まれていないこと
            if (new RegExp('missing\\.push\\([^)]*' + f.label).test(src)) {
                violations.push(f.label + ' は badge-optional だが必須チェックされている');
            }
        });
        expect(violations).toEqual([]);
    });
});

// ================================================================
// 横断チェック: バッジの総数と構造的健全性
// ================================================================

describe('コンパイラ: 全体構造チェック', function() {

    test('全ての badge-required 行に input/select の ID が紐付いている（同一行または次行）', function() {
        var violations = [];

        for (var i = 0; i < htaLines.length; i++) {
            var line = htaLines[i];
            // CSS定義行はスキップ
            if (/\.badge-required/.test(line)) continue;
            if (!/badge-required/.test(line)) continue;

            // reqBadge 変数参照は許容
            if (/reqBadge/.test(line)) continue;
            // グループタイトル（処理能力セクション等）は許容
            if (/group-title/.test(line)) continue;
            // マスター管理の動的タイトル（config.title）は許容
            if (/config\.title/.test(line)) continue;
            // JS実行コード内のbadge-required参照（className切替等）は許容
            if (/className\s*=|\.className/.test(line)) continue;

            // IDが同じ行または続く2行に存在するか
            var nextLine1 = (i + 1 < htaLines.length) ? htaLines[i + 1] : '';
            var nextLine2 = (i + 2 < htaLines.length) ? htaLines[i + 2] : '';
            if (!/id=/.test(line) && !/id=/.test(nextLine1) && !/id=/.test(nextLine2)) {
                violations.push({
                    line: i + 1,
                    text: line.trim().substring(0, 120)
                });
            }
        }

        expect(violations).toEqual([]);
    });

    test('バッジ付き全入力欄がFORMS定義でカバーされている', function() {
        // 全バッジのinputIdを収集（CSS定義・JS実行コード・動的バッジID除外）
        var allBadgeIds = [];
        for (var i = 0; i < htaLines.length; i++) {
            var line = htaLines[i];
            if (!/badge-(required|optional)/.test(line)) continue;
            if (/\.badge-/.test(line)) continue;      // CSS定義
            if (/className/.test(line)) continue;       // JS実行コード
            if (/config\.title/.test(line)) continue;   // マスター管理（動的タイトル）
            // reqBadge 変数使用行もIDを抽出
            var idMatch = line.match(/id=(?:['"]|\\['"])([^'"\\]+)/);
            if (idMatch) allBadgeIds.push({ id: idMatch[1], line: i + 1 });
        }

        // フォーム定義でカバーされているID + 事業者フォーム（静的HTML）
        var coveredIds = {
            'inputBusinessName': true,
            'inputBusinessType': true,
            'inputZipCode': true,
            'inputPrefecture': true,
            'inputAddress': true,
            'inputPhone': true
        };
        FORMS.forEach(function(form) {
            Object.keys(form.idToLabel).forEach(function(id) {
                coveredIds[id] = true;
            });
            // 条件付き必須もカバー済み（バッジ要素IDも含む）
            (form.conditionalRequired || []).forEach(function(id) {
                coveredIds[id] = true;
                coveredIds[id + '-badge'] = true;
            });
        });

        // 未カバーのIDを報告
        var uncovered = allBadgeIds.filter(function(b) { return !coveredIds[b.id]; });
        if (uncovered.length > 0) {
            console.warn('FORMSに未登録のバッジ付き入力欄:', uncovered.map(function(b) {
                return 'L' + b.line + ': ' + b.id;
            }));
        }
        expect(uncovered).toEqual([]);
    });

    test('半角変換関数が許可番号の保存時に呼ばれている', function() {
        // savePermit
        var s1 = findFunctionLine('savePermit');
        expect(getSource(s1, findFunctionEnd(s1))).toMatch(/normalizePermitNumber/);

        // savePermitEdit
        var s2 = findFunctionLine('savePermitEdit');
        expect(getSource(s2, findFunctionEnd(s2))).toMatch(/normalizePermitNumber/);

        // saveFacility（施設の許可番号）
        var s3 = findFunctionLine('saveFacility');
        expect(getSource(s3, findFunctionEnd(s3))).toMatch(/normalizePermitNumber/);

        // saveFacilityEdit
        var s4 = findFunctionLine('saveFacilityEdit');
        expect(getSource(s4, findFunctionEnd(s4))).toMatch(/normalizePermitNumber/);
    });
});

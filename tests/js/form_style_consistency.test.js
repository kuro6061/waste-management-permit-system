/**
 * フォームスタイル整合性テスト
 * 同一エンティティの作成/編集フォームでインラインスタイルが一致するかを検証。
 * HTA内のHTML生成コードを静的解析し、ペアとなるフィールドの
 * width・style属性が揃っているかチェックする。
 */
const fs = require('fs');
const path = require('path');

const htaSource = fs.readFileSync(
    path.join(__dirname, '..', '..', 'app_source.hta'), 'utf-8'
);

/**
 * 指定された関数の本体を抽出する
 */
function extractFunctionBody(source, funcName) {
    const startPattern = new RegExp('function\\s+' + funcName + '\\s*\\(');
    const match = source.match(startPattern);
    if (!match) return '';
    const startIdx = match.index;
    let braceCount = 0;
    let inFunc = false;
    let bodyStart = 0;
    for (let i = startIdx; i < source.length; i++) {
        if (source[i] === '{') {
            if (!inFunc) { inFunc = true; bodyStart = i + 1; }
            braceCount++;
        } else if (source[i] === '}') {
            braceCount--;
            if (braceCount === 0 && inFunc) {
                return source.substring(bodyStart, i);
            }
        }
    }
    return '';
}

/**
 * HTML生成コードからselect/input要素のスタイル情報を抽出
 * { label: string, tagType: string, style: string, id: string }[]
 */
function extractFieldStyles(funcBody) {
    const fields = [];
    // select要素: <select id='xxx' style='...'>
    const selectPattern = /id='([^']+)'[^>]*?(?:style='([^']*)')?[^>]*><\/select>|<select[^>]*?id='([^']+)'[^>]*?(?:style='([^']*)')?/g;
    let m;
    while ((m = selectPattern.exec(funcBody)) !== null) {
        const id = m[1] || m[3];
        const style = m[2] || m[4] || '';
        fields.push({ id, tagType: 'select', style });
    }
    // input[type=number or type=text] with numeric-style fields: <input type='number|text' id='xxx' style='...'
    const numberPattern = /<input\s+(?:class='[^']*'\s+)?type='(?:number|text)'\s+id='([^']+)'\s*(?:style='([^']*)')?/g;
    while ((m = numberPattern.exec(funcBody)) !== null) {
        fields.push({ id: m[1], tagType: 'number', style: m[2] || '' });
    }
    return fields;
}

/**
 * ラベルテキストをID周辺のコードから抽出
 */
function extractLabelForId(funcBody, fieldId) {
    // パターン: <label>...ラベル名...</label> ... id='fieldId'
    // 大体 label が同じ行か前の行にある
    const lines = funcBody.split('\n');
    for (let i = 0; i < lines.length; i++) {
        if (lines[i].includes("id='" + fieldId + "'")) {
            // 同じ行内のlabelを探す
            const labelMatch = lines[i].match(/<label>([^<]+)</);
            if (labelMatch) {
                // badge部分を除去
                return labelMatch[1].replace(/<span[^>]*>[^<]*<\/span>/g, '').trim();
            }
        }
    }
    return '';
}

// 施設追加 vs 施設修正
const addBody = extractFunctionBody(htaSource, 'openFacilityForm');
const editBody = extractFunctionBody(htaSource, 'showFacilityEditForm');

describe('施設フォームのスタイル整合性: 追加 vs 修正', () => {
    // 対応するフィールドペア: [追加側ID, 修正側ID, ラベル]
    const fieldPairs = [
        // 最終処分場
        ['fMgmtType', 'edit-fac-mgmt-type', '管理区分（select）'],
        ['fCapacity', 'edit-fac-capacity', '容量（number）'],
        ['fArea', 'edit-fac-area', '面積（number）'],
        // 中間処理施設
        ['fMethod', 'edit-fac-method', '処理方法（select）'],
        ['fSetupForm', 'edit-fac-setup-form', '設置形態（select）'],
        ['fPermitTarget', 'edit-fac-permit-target', '許可対象区分（select）'],
    ];

    const addFields = extractFieldStyles(addBody);
    const editFields = extractFieldStyles(editBody);

    function getFieldById(fields, id) {
        return fields.find(f => f.id === id);
    }

    fieldPairs.forEach(([addId, editId, label]) => {
        test(label + ': width styleが一致', () => {
            const addField = getFieldById(addFields, addId);
            const editField = getFieldById(editFields, editId);
            expect(addField).toBeDefined();
            expect(editField).toBeDefined();
            if (addField && editField) {
                // widthを抽出して比較
                const addWidth = (addField.style.match(/width:\s*(\d+px)/) || [])[1] || 'auto';
                const editWidth = (editField.style.match(/width:\s*(\d+px)/) || [])[1] || 'auto';
                expect(addWidth).toBe(editWidth);
            }
        });
    });
});

// 処理能力: 施設追加はインラインテーブル方式（renderPendingCapacityTable）に統一済み
// 編集テーブル（loadEditCapacityTable）と同じUIを使用するため、
// 追加 vs 編集のフィールドペアテストは不要（テーブル構造が同一）
describe('処理能力フォーム: インラインテーブル方式の統一', () => {
    test('施設追加でインラインテーブル方式が使われている', () => {
        const addBody = extractFunctionBody(htaSource, 'openFacilityForm');
        expect(addBody).toContain('addPendingCapacityRow');
        expect(addBody).toContain('newFacilityCapacityList');
    });

    test('renderPendingCapacityTableがdata-tableクラスを使用', () => {
        const renderBody = extractFunctionBody(htaSource, 'renderPendingCapacityTable');
        expect(renderBody).toContain("data-table");
        expect(renderBody).toContain("inline-input");
    });
});

describe('同一フォーム内のスタイル一貫性', () => {
    test('施設追加: 条件分岐selectは全て同じwidth', () => {
        const addFields = extractFieldStyles(addBody);
        const conditionalSelects = addFields.filter(f =>
            f.tagType === 'select' &&
            ['fMgmtType', 'fMethod', 'fSetupForm', 'fPermitTarget'].includes(f.id)
        );
        if (conditionalSelects.length > 1) {
            const widths = conditionalSelects.map(f =>
                (f.style.match(/width:\s*(\d+px)/) || [])[1] || 'auto'
            );
            const uniqueWidths = [...new Set(widths)];
            expect(uniqueWidths).toHaveLength(1);
        }
    });

    test('施設修正: 条件分岐selectは全て同じwidth', () => {
        const editFields = extractFieldStyles(editBody);
        const conditionalSelects = editFields.filter(f =>
            f.tagType === 'select' &&
            ['edit-fac-mgmt-type', 'edit-fac-method', 'edit-fac-setup-form', 'edit-fac-permit-target'].includes(f.id)
        );
        if (conditionalSelects.length > 1) {
            const widths = conditionalSelects.map(f =>
                (f.style.match(/width:\s*(\d+px)/) || [])[1] || 'auto'
            );
            const uniqueWidths = [...new Set(widths)];
            expect(uniqueWidths).toHaveLength(1);
        }
    });

    test('施設追加: 数値入力(容量/面積)は同じwidth', () => {
        const addFields = extractFieldStyles(addBody);
        const numericFields = addFields.filter(f =>
            f.tagType === 'number' &&
            ['fCapacity', 'fArea'].includes(f.id)
        );
        if (numericFields.length > 1) {
            const widths = numericFields.map(f =>
                (f.style.match(/width:\s*(\d+px)/) || [])[1] || 'auto'
            );
            const uniqueWidths = [...new Set(widths)];
            expect(uniqueWidths).toHaveLength(1);
        }
    });

    test('施設修正: 数値入力(容量/面積)は同じwidth', () => {
        const editFields = extractFieldStyles(editBody);
        const numericFields = editFields.filter(f =>
            f.tagType === 'number' &&
            ['edit-fac-capacity', 'edit-fac-area'].includes(f.id)
        );
        if (numericFields.length > 1) {
            const widths = numericFields.map(f =>
                (f.style.match(/width:\s*(\d+px)/) || [])[1] || 'auto'
            );
            const uniqueWidths = [...new Set(widths)];
            expect(uniqueWidths).toHaveLength(1);
        }
    });
});

describe('フォーム構造の対称性チェック', () => {
    test('施設追加と修正で同じ条件分岐ブロック構造を持つ', () => {
        // 追加側: landfill-fields, processing-fields, storage-fields
        expect(addBody).toContain("id='landfill-fields'");
        expect(addBody).toContain("id='processing-fields'");
        expect(addBody).toContain("id='storage-fields'");
        // 修正側: edit-landfill-fields, edit-processing-fields, edit-storage-fields
        expect(editBody).toContain("id='edit-landfill-fields'");
        expect(editBody).toContain("id='edit-processing-fields'");
        expect(editBody).toContain("id='edit-storage-fields'");
    });

    test('施設追加と修正で同じラベルテキストを使用', () => {
        const labelPairs = [
            ['施設種別', '施設種別'],
            ['設置場所', '設置場所'],
            ['許可番号', '許可番号'],
            ['許可年月日', '許可年月日'],
            ['設置年月日', '設置年月日'],
            ['管理区分', '管理区分'],
            ['容量(㎥)', '容量(㎥)'],
            ['面積(㎡)', '面積(㎡)'],
            ['埋立終了年月日', '埋立終了年月日'],
            ['処理方法', '処理方法'],
            ['設置形態', '設置形態'],
            ['許可対象区分', '許可対象区分'],
            ['保管面積(㎡)', '保管面積(㎡)'],
            ['保管量上限(㎥)', '保管量上限(㎥)'],
            ['保管高さ(m)', '保管高さ(m)'],
        ];
        labelPairs.forEach(([addLabel, editLabel]) => {
            expect(addBody).toContain(addLabel);
            expect(editBody).toContain(editLabel);
        });
    });

    test('施設追加と修正で同じバッジ（必須/任意）パターン', () => {
        // 施設種別: 必須
        expect(addBody).toMatch(/施設種別.*badge-required/);
        expect(editBody).toMatch(/施設種別.*badge-required/);
        // 設置場所: 必須
        expect(addBody).toMatch(/設置場所.*badge-required/);
        expect(editBody).toMatch(/設置場所.*badge-required/);
        // 許可番号: 追加は任意固定、編集は条件付き動的バッジ（badge-required or badge-optional）
        expect(addBody).toMatch(/許可番号.*badge-optional/);
        expect(editBody).toMatch(/許可番号.*edit-fac-permit-no-badge/);
    });
});

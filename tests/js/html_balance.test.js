/**
 * HTML タグバランスチェック
 * app_source.hta 内の JS で動的生成される HTML 文字列の開閉タグ不整合を検出する
 *
 * 方針:
 *   - html/bizInfo/rows/statusHtml 等のアキュムレータ変数、.innerHTML 代入、
 *     return html + "..." を対象にする
 *   - 1行から全ての文字列リテラルを抽出し（式の途中の閉じタグも拾う）
 *   - ソースコード解析なので各行は1回だけ読まれる（ループの繰り返しは無関係）
 */
const fs = require('fs');
const path = require('path');

const htaPath = path.join(__dirname, '..', '..', 'app_source.hta');
const htaSource = fs.readFileSync(htaPath, 'utf-8');

// void 要素（閉じタグ不要）
const VOID_ELEMENTS = new Set([
    'input', 'br', 'hr', 'img', 'meta', 'link', 'col', 'area',
    'base', 'embed', 'source', 'track', 'wbr'
]);

// HTML アキュムレータ変数名パターン
const HTML_VAR_PATTERN = /\b(html|bizInfo|rows|statusHtml|hourUnitOptions)\s*\+?=/;
const INNER_HTML_PATTERN = /\.innerHTML\s*\+?=/;
const RETURN_HTML_PATTERN = /\breturn\b.*\b(html|bizInfo|rows)\b.*"/;

/**
 * 行が HTML 生成行かどうか判定
 */
function isHtmlBuildingLine(line) {
    return HTML_VAR_PATTERN.test(line) ||
           INNER_HTML_PATTERN.test(line) ||
           RETURN_HTML_PATTERN.test(line);
}

/**
 * 関数ごとに HTML 断片を抽出する
 * - 1行の全文字列リテラルを抽出（閉じタグが式の後半にあっても拾える）
 * - ソースコード解析なので各行を1回だけ読み取る（ループ展開は不要）
 */
function extractHtmlByFunction(source) {
    const results = {};
    const lines = source.split('\n');
    let funcName = null;
    let funcDepth = 0;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const trimmed = line.trim();

        // 関数開始
        const funcMatch = trimmed.match(/^function\s+(\w+)\s*\(/);
        if (funcMatch && funcDepth === 0) {
            funcName = funcMatch[1];
            funcDepth = 0;
        }

        if (funcName) {
            // 波括弧カウント（文字列リテラル内のブレースをスキップ）
            for (let ci = 0; ci < line.length; ci++) {
                const ch = line[ci];
                if (ch === '"') {
                    ci++;
                    while (ci < line.length && line[ci] !== '"') {
                        if (line[ci] === '\\') ci++;
                        ci++;
                    }
                    continue;
                }
                if (ch === "'") {
                    ci++;
                    while (ci < line.length && line[ci] !== "'") {
                        if (line[ci] === '\\') ci++;
                        ci++;
                    }
                    continue;
                }
                if (ch === '{') {
                    funcDepth++;
                }
                if (ch === '}') {
                    funcDepth--;
                    if (funcDepth <= 0) {
                        funcName = null;
                        funcDepth = 0;
                        break;
                    }
                }
            }

            if (funcName && isHtmlBuildingLine(line)) {
                // 1行から全ての文字列リテラルを抽出
                const strings = [...line.matchAll(/"((?:[^"\\]|\\.)*)"/g)];
                for (const m of strings) {
                    const fragment = m[1].replace(/\\"/g, '"').replace(/\\'/g, "'");
                    if (!results[funcName]) results[funcName] = [];
                    results[funcName].push(fragment);
                }
            }
        }
    }
    return results;
}

/**
 * 関数呼び出しによる HTML 組み立てを検出し、ヘルパー関数の断片を呼び出し元に統合する
 * 例: html += buildTimelineBars(...) → buildTimelineBars の断片を呼び出し元に追加
 * 多段呼び出し（A→B→C）にも対応するためトポロジカル順で処理する
 * 統合済みのヘルパー関数名の Set を返す（個別テスト対象外にする）
 */
function inlineHelperFragments(functionFragments, source) {
    const lines = source.split('\n');
    let funcName = null;
    let depth = 0;
    const calls = {}; // caller -> [callees]

    // 呼び出しグラフを構築
    for (const line of lines) {
        const trimmed = line.trim();
        const funcMatch = trimmed.match(/^function\s+(\w+)\s*\(/);
        if (funcMatch && depth === 0) { funcName = funcMatch[1]; depth = 0; }
        if (funcName) {
            for (let ci = 0; ci < line.length; ci++) {
                const ch = line[ci];
                if (ch === '"') { ci++; while (ci < line.length && line[ci] !== '"') { if (line[ci] === '\\') ci++; ci++; } continue; }
                if (ch === "'") { ci++; while (ci < line.length && line[ci] !== "'") { if (line[ci] === '\\') ci++; ci++; } continue; }
                if (ch === '{') depth++;
                if (ch === '}') { depth--; if (depth <= 0) { funcName = null; depth = 0; break; } }
            }
            const callMatch = line.match(/\bhtml\s*\+=\s*(\w+)\s*\(/);
            if (callMatch && funcName && functionFragments[callMatch[1]]) {
                if (!calls[funcName]) calls[funcName] = [];
                calls[funcName].push(callMatch[1]);
            }
        }
    }

    // トポロジカル順で統合（リーフ関数から先に処理）
    const helperFuncs = new Set();
    const processed = new Set();

    function processFunc(name) {
        if (processed.has(name)) return;
        processed.add(name);
        if (calls[name]) {
            for (const callee of calls[name]) {
                processFunc(callee);
                if (functionFragments[callee]) {
                    if (!functionFragments[name]) functionFragments[name] = [];
                    functionFragments[name].push(...functionFragments[callee]);
                    helperFuncs.add(callee);
                }
            }
        }
    }

    for (const name of Object.keys(calls)) {
        processFunc(name);
    }
    return helperFuncs;
}

/**
 * HTML タグのバランスをチェック
 * 全断片を結合してから開閉タグをカウント
 */
function checkBalance(fragments) {
    const combined = fragments.join('');
    const tagRegex = /<\/?([a-zA-Z][a-zA-Z0-9]*)\b[^>]*\/?>/g;
    const opens = {};
    const closes = {};
    let match;

    while ((match = tagRegex.exec(combined)) !== null) {
        const full = match[0];
        const tag = match[1].toLowerCase();
        if (VOID_ELEMENTS.has(tag)) continue;
        if (full.endsWith('/>')) continue;

        if (full.startsWith('</')) {
            closes[tag] = (closes[tag] || 0) + 1;
        } else {
            opens[tag] = (opens[tag] || 0) + 1;
        }
    }

    const mismatches = [];
    const allTags = new Set([...Object.keys(opens), ...Object.keys(closes)]);
    for (const tag of allTags) {
        const o = opens[tag] || 0;
        const c = closes[tag] || 0;
        if (o !== c) {
            mismatches.push({ tag, opens: o, closes: c, diff: o - c });
        }
    }
    return mismatches;
}

// ===== テスト =====

describe('HTML タグバランスチェック', () => {
    const functions = extractHtmlByFunction(htaSource);
    // ヘルパー関数の断片を呼び出し元に統合（個別テスト対象外）
    const helperFuncs = inlineHelperFragments(functions, htaSource);
    const funcNames = Object.keys(functions).filter(n => functions[n].length > 0 && !helperFuncs.has(n));

    test('HTML生成関数が検出される', () => {
        expect(funcNames.length).toBeGreaterThan(10);
    });

    for (const name of funcNames) {
        test(`${name}: タグバランス`, () => {
            const mismatches = checkBalance(functions[name]);
            if (mismatches.length > 0) {
                const detail = mismatches
                    .map(m => `<${m.tag}>: 開${m.opens} / 閉${m.closes} (差: ${m.diff > 0 ? '+' : ''}${m.diff})`)
                    .join('\n  ');
                throw new Error(`${name} にHTMLタグの不整合:\n  ${detail}`);
            }
        });
    }
});

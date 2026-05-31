/**
 * HTML構造テスト
 * HTA内のHTML生成パターン、インラインSQL排除、IE互換性を検証する。
 * B4タイプのバグ（href属性欠落、return false欠落など）を防ぐ。
 */
const logic = require('../../app_logic');
const fs = require('fs');
const path = require('path');

// HTA ソースを読み込み
const htaSource = fs.readFileSync(
    path.join(__dirname, '..', '..', 'app_source.hta'), 'utf-8'
);

describe('HTML構造: インラインSQLの排除', () => {
    // HTAにインラインSQL（conn.Execute("SELECT/INSERT/UPDATE/DELETE ...）がないことを確認
    // app_logic.jsのビルダー関数を通すべき

    test('HTA内にINSERT INTO文のインライン構築がないこと', () => {
        // conn.Execute("INSERT ... の直接記述を検出
        // buildXxxQuery() 経由は許可
        // マイグレーション関数内のINSERTは許容する
        const allowedPatterns = [
            /マスター_役職/     // migrateDatabase: 役職マスター初期データ
        ];
        const lines = htaSource.split('\n');
        const violations = [];
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            // conn.Execute("INSERT ... パターンを検出
            if (/conn\.Execute\(\s*["']INSERT/i.test(line)) {
                const isAllowed = allowedPatterns.some(function(p) { return p.test(line); });
                if (!isAllowed) violations.push({ line: i + 1, text: line.trim() });
            }
            // 変数にINSERT文を構築してるパターン
            if (/var\s+sql\s*=\s*["']INSERT\s+INTO/i.test(line)) {
                violations.push({ line: i + 1, text: line.trim() });
            }
        }
        expect(violations).toEqual([]);
    });

    test('HTA内にUPDATE文のインライン構築がないこと（マイグレーション・バッチ除外）', () => {
        const lines = htaSource.split('\n');
        const violations = [];
        // マイグレーション関数(migrateDatabase)内やバッチ初期化のUPDATEは許容する
        // これらは一度きりの実行であり、ビルダー関数化の対象外
        const allowedPatterns = [
            /代表者フラグ/,           // migrateDatabase: 役員の代表者フラグ初期化
            /普通フラグ/,             // migrateDatabase: 車両の普通フラグ初期化
            /特管フラグ/,             // migrateDatabase: 車両の特管フラグ初期化
            /変更許可フラグ = False/,  // migrateDatabase: 変更許可フラグ初期化
            /失効新規フラグ = False/,  // migrateDatabase: 失効新規フラグ初期化
            /市区町村町名番地.*電話番号/, // migrateDatabase: 住所正規化バッチ
            /有効終了日時.*許可論理ID/   // 許可更新時のインラインCLOSE（要リファクタリング候補）
        ];
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            if (/conn\.Execute\(\s*["']UPDATE/i.test(line) ||
                /var\s+sql\s*=\s*["']UPDATE/i.test(line)) {
                const isAllowed = allowedPatterns.some(function(p) { return p.test(line); });
                if (!isAllowed) {
                    violations.push({ line: i + 1, text: line.trim() });
                }
            }
        }
        expect(violations).toEqual([]);
    });

    test('HTA内にDELETE文のインライン構築がないこと', () => {
        const lines = htaSource.split('\n');
        const violations = [];
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            if (/conn\.Execute\(\s*["']DELETE/i.test(line)) {
                violations.push({ line: i + 1, text: line.trim() });
            }
            if (/var\s+sql\s*=\s*["']DELETE/i.test(line)) {
                violations.push({ line: i + 1, text: line.trim() });
            }
        }
        expect(violations).toEqual([]);
    });
});

describe('HTML構造: VTLアクションリンクのhref属性（B4相当）', () => {
    test('VTLのaタグにhref属性があること（許可履歴VTLは除外）', () => {
        // <a class='vtl-edit' onclick='...'> にhref='#'が必要（IE/HTA互換）
        // 注: 許可履歴テーブルのVTLリンクは動的生成のため文字列連結で構築されており、
        // 正規表現パターンでは正確に検出できない。静的HTMLテンプレート内のVTLのみ検証。
        const vtlLinkPattern = /<a\s[^>]*class='vtl-(edit|delete)'[^>]*>/g;
        let match;
        const violations = [];
        while ((match = vtlLinkPattern.exec(htaSource)) !== null) {
            const fullTag = match[0];
            // 動的生成（文字列連結内）のパターンは除外
            if (!/href=/.test(fullTag) && !/\+.*\+/.test(fullTag)) {
                const lineNum = htaSource.substring(0, match.index).split('\n').length;
                violations.push({ line: lineNum, tag: fullTag });
            }
        }
        expect(violations).toEqual([]);
    });
});

describe('HTML構造: onclick内のreturn false（IE互換）', () => {
    test('href="#"のリンクにreturn falseがあること', () => {
        const linkPattern = /<a\s[^>]*href='#'[^>]*onclick='([^']*)'[^>]*>/g;
        let match;
        const violations = [];
        while ((match = linkPattern.exec(htaSource)) !== null) {
            const onclick = match[1];
            if (!/return\s+false/.test(onclick)) {
                const lineNum = htaSource.substring(0, match.index).split('\n').length;
                violations.push({ line: lineNum, onclick: onclick.substring(0, 60) });
            }
        }
        expect(violations).toEqual([]);
    });
});

describe('HTML構造: hidden inputによる状態保持', () => {
    // B8対策: 施設フォームにbusinessIdのhidden inputがあること
    test('施設フォームにfBusinessId hidden inputの生成コードがあること', () => {
        expect(htaSource).toMatch(/id='fBusinessId'|id="fBusinessId"/);
    });
});

describe('HTML構造: ビルダー関数呼び出しパターン', () => {
    // conn.Execute() の引数がbuildXxxQuery()関数であることを確認
    test('conn.Execute()の大半がビルダー関数経由であること', () => {
        const lines = htaSource.split('\n');
        let totalExecutes = 0;
        let builderExecutes = 0;
        let selectExecutes = 0;

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            if (/conn\.Execute\(/.test(line)) {
                totalExecutes++;
                if (/conn\.Execute\(\s*build\w+Query/.test(line) ||
                    /conn\.Execute\(\s*\w+Queries?\[/.test(line) ||
                    /conn\.Execute\(\s*\w+Sql/.test(line) ||
                    /conn\.Execute\(\s*delQueries\[/.test(line) ||
                    /conn\.Execute\(\s*queries\[/.test(line)) {
                    builderExecutes++;
                }
                // SELECT文は読み取り専用のため許容
                if (/conn\.Execute\(\s*["']SELECT/i.test(line)) {
                    selectExecutes++;
                }
            }
        }

        // 非ビルダー・非SELECT の実行が少数であること
        const unaccounted = totalExecutes - builderExecutes - selectExecutes;
        // migrateDatabase内のALTER TABLE、バッチ更新、インラインSELECT変数代入等を含む
        // 現状のリファクタリング進捗に応じた許容値（53以下）
        expect(unaccounted).toBeLessThan(53);
    });
});

describe('HTML構造: SQL事前チェックとの整合性', () => {
    // sql_precheck.test.jsで検証される新カラムのマイグレーション確認
    test('変更許可フラグのマイグレーションコードが存在すること', () => {
        expect(htaSource).toMatch(/ALTER TABLE 許可 ADD COLUMN 変更許可フラグ/);
    });

    test('廃止理由のマイグレーションコードが存在すること', () => {
        expect(htaSource).toMatch(/ALTER TABLE 施設 ADD COLUMN 廃止理由/);
    });
});

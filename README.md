# 廃棄物処理業許可管理システム

HTA と Microsoft Access を使った、廃棄物処理業の許可・施設・車両・役員情報管理アプリです。

## 構成

- `app_source.hta`: HTA本体。画面、CSS、イベント、ADODB実行を含みます。
- `app_logic.js`: SQLビルダー、バリデーション、共通ロジックです。
- `docs/`: 仕様、画面定義、DB設計などのドキュメントです。
- `schema/tbldefs/`: Access のテーブル定義SQLです。実データは含みません。
- `tests/`: Jest、pytest、HTAレイアウト確認用のテストです。
- `mcp-server/`: Access DBを操作するMCPサーバーです。
- `scripts/`: 公開用に残したHTA変換・静的チェック用スクリプトです。

## 公開リポジトリでの注意

実データ入りの Access DB、旧システムMDB、取り込みCSV、Excel、レビュー文書、ローカル設定は含めません。
`.gitignore` で `*.accdb`, `*.mdb`, `bridge/`, `data/`, `tmp/`, `docs/reviews/`, `.mcp.json` などを除外しています。

MCPを使う場合は `.mcp.example.json` を参考に、手元で `.mcp.json` を作成し、`DB_PATH` にローカルまたはダミーDBを指定してください。

実行用の `app.hta` は生成物です。必要な場合は次で作成します。

```bash
npm run convert:hta
```

## テスト

```bash
npm test -- --runInBand
```

Access Database Engine が入っていない環境では、DB接続が必要な pytest は skip されます。

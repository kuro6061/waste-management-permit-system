# 廃棄物処理業許可管理システム

HTA と Microsoft Access を使った、廃棄物処理業の許可・施設・車両・役員情報を管理するアプリです。

## クローン後の起動

この公開リポジトリには、実データを含まない `Database_sample.accdb` を同梱しています。Windows で Python 3 と Microsoft Access または Access Database Engine が利用できる環境なら、次で起動できます。

```bash
app_start.bat
```

`app_start.bat` は `app_source.hta` から Shift-JIS の `app.hta` を生成し、`mshta.exe` で起動します。既定のDBは `Database_sample.accdb` です。

## 構成

- `app_source.hta`: HTA本体です。画面、CSS、イベント処理、ADODB実行を含みます。
- `app_logic.js`: SQLビルダー、バリデーション、共通ロジックです。
- `Database_sample.accdb`: 実データを含まないサンプルDBです。
- `schema/tbldefs/`: Access のテーブル定義SQLです。
- `docs/`: 仕様、画面定義、DB設計などのドキュメントです。
- `tests/`: Jest、pytest、HTAレイアウト確認用のテストです。
- `scripts/`: HTA変換、静的チェック、ダミーデータ生成用スクリプトです。

## 公開リポジトリでの注意

実データ入りの Access DB、旧システムMDB、取り込みCSV、Excel、レビュー文書、ローカル設定は含めません。

`.gitignore` では `*.accdb` を除外し、公開用の `Database_sample.accdb` だけを例外として許可しています。実データやローカル専用ファイルは追加しないでください。

## テスト

```bash
npm install
npm test -- --runInBand
npm run check:hta
```

Access Database Engine が入っていない環境では、DB接続が必要な pytest は skip されます。ローカルDBを指定したい場合は `DB_PATH` 環境変数を使ってください。

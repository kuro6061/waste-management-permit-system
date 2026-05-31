# -*- coding: utf-8 -*-
"""
テーブル・カラム存在確認テスト
DBスキーマ変更によるHTAの破損を検知する
"""
import pytest


# HTAが使用する主要テーブル
REQUIRED_TABLES = [
    "事業者",
    "許可",
    "許可品目",
    "施設",
    "車両",
    "役員",
    "処理能力",
    "マスター_許可区分",
    "マスター_施設種別",
    "マスター_品目",
    "マスター_事業者区分",
    "マスター_廃棄物種類区分",
    "マスター_処理方法",
    "マスター_取扱区分",
    "マスター_形式",
    "マスター_日処理能力単位",
    "マスター_時間処理能力単位",
    "マスター_管理区分",
    "マスター_設置形態区分",
    "マスター_許可対象区分",
    "マスター_許可番号形式",
    "マスター_認定区分",
]

# 各テーブルの必須カラム（HTAのSQLクエリで参照されるカラム）
REQUIRED_COLUMNS = {
    "事業者": ["事業者ID", "事業者名", "事業者区分", "郵便番号", "都道府県", "市区町村町名番地", "電話番号"],
    "許可": [
        "許可ID", "許可論理ID", "事業者ID", "許可区分ID", "許可番号",
        "許可年月日", "許可有効年月日", "優良認定",
        "有効開始日時", "有効終了日時",
        "取消日", "取消理由", "廃止日", "廃止理由", "作成日時",
    ],
    "許可品目": ["許可品目ID", "許可ID", "品目ID", "取り扱いフラグ", "積替保管フラグ"],
    "施設": [
        "施設ID", "施設論理ID", "事業者ID", "施設種別ID",
        "設置場所", "許可番号", "許可年月日", "設置年月日",
        "有効開始日時", "有効終了日時", "廃止年月日",
    ],
    "車両": ["車両ID", "事業者ID", "登録番号1", "登録番号2", "登録番号3", "登録番号4", "廃車フラグ"],
    "役員": ["役員ID", "事業者ID", "役職名", "姓", "名", "退任フラグ"],
    "処理能力": [
        "処理能力ID", "施設ID", "品目ID",
        "時間処理能力", "時間処理能力単位ID",
        "日処理能力", "日処理能力単位ID",
        "稼働時間", "特記事項",
    ],
    "マスター_許可区分": ["許可区分ID", "許可区分名"],
    "マスター_施設種別": ["施設種別ID", "施設種別名"],
    "マスター_品目": ["品目ID", "品目名", "表示順"],
}


@pytest.mark.parametrize("table_name", REQUIRED_TABLES)
def test_table_exists(db_conn, table_name):
    """テーブルが存在し、SELECTできることを確認"""
    rs = db_conn.Execute(f"SELECT COUNT(*) FROM [{table_name}]")
    count = rs.Fields(0).Value
    rs.Close()
    assert count >= 0


@pytest.mark.parametrize("table_name,columns", [
    (k, v) for k, v in REQUIRED_COLUMNS.items()
])
def test_columns_exist(db_conn, table_name, columns):
    """テーブルに必須カラムが存在することを確認"""
    rs = db_conn.Execute(f"SELECT TOP 1 * FROM [{table_name}]")
    actual_columns = set()
    for i in range(rs.Fields.Count):
        actual_columns.add(rs.Fields(i).Name)
    rs.Close()
    for col in columns:
        assert col in actual_columns, f"カラム '{col}' が [{table_name}] に存在しません"


def test_foreign_key_business_permit(db_conn):
    """許可テーブルの事業者IDが事業者テーブルに存在する"""
    sql = """
        SELECT COUNT(*) FROM 許可
        WHERE 事業者ID NOT IN (SELECT 事業者ID FROM 事業者)
        AND 事業者ID IS NOT NULL
    """
    rs = db_conn.Execute(sql)
    orphan_count = rs.Fields(0).Value
    rs.Close()
    assert orphan_count == 0, f"許可テーブルに孤立した事業者ID参照が{orphan_count}件あります"


def test_foreign_key_permit_items(db_conn):
    """許可品目の許可IDが許可テーブルに存在する"""
    sql = """
        SELECT COUNT(*) FROM 許可品目
        WHERE 許可ID NOT IN (SELECT 許可ID FROM 許可)
        AND 許可ID IS NOT NULL
    """
    rs = db_conn.Execute(sql)
    orphan_count = rs.Fields(0).Value
    rs.Close()
    assert orphan_count == 0, f"許可品目テーブルに孤立した許可ID参照が{orphan_count}件あります"

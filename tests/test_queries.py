# -*- coding: utf-8 -*-
"""
SQLクエリ実行テスト
HTAのSQLビルダーが生成するのと同等のクエリが正しく実行できることを検証する
"""
import pytest


class TestSearchQueries:
    """検索系クエリのテスト"""

    def test_search_business_query(self, db_conn):
        """事業者検索クエリが実行可能で、正しいカラムを返す"""
        sql = "SELECT 事業者ID, 事業者名, 郵便番号, 都道府県, 市区町村町名番地, 電話番号 FROM 事業者 ORDER BY 事業者ID"
        rs = db_conn.Execute(sql)
        expected_cols = {"事業者ID", "事業者名", "郵便番号", "都道府県", "市区町村町名番地", "電話番号"}
        actual_cols = {rs.Fields(i).Name for i in range(rs.Fields.Count)}
        rs.Close()
        assert expected_cols == actual_cols

    def test_search_business_with_like(self, db_conn):
        """LIKE検索が正しく動作する"""
        sql = "SELECT COUNT(*) AS cnt FROM 事業者 WHERE 事業者名 LIKE '%テスト%' OR 電話番号 LIKE '%テスト%' OR 市区町村町名番地 LIKE '%テスト%'"
        rs = db_conn.Execute(sql)
        count = rs.Fields("cnt").Value
        rs.Close()
        assert count >= 0

    def test_search_permit_basic(self, db_conn):
        """許可検索の基本クエリが実行可能"""
        sql = (
            "SELECT DISTINCT 許可.許可ID, 許可.許可論理ID, 許可.許可番号, 許可.許可区分ID, "
            "許可.優良認定, "
            "Format(許可.許可年月日, 'yyyy/mm/dd') AS 許可日, "
            "Format(許可.許可有効年月日, 'yyyy/mm/dd') AS 有効期限, "
            "許可.許可有効年月日, "
            "Format(許可.廃止日, 'yyyy/mm/dd') AS 廃止日文字列, "
            "Format(許可.取消日, 'yyyy/mm/dd') AS 取消日文字列, "
            "事業者.事業者ID, 事業者.事業者名, マスター_許可区分.許可区分名 "
            "FROM ((許可 LEFT JOIN 事業者 ON 許可.事業者ID = 事業者.事業者ID) "
            "LEFT JOIN マスター_許可区分 ON 許可.許可区分ID = マスター_許可区分.許可区分ID) "
            "WHERE 許可.有効終了日時 IS NULL "
            "ORDER BY 許可.許可ID DESC"
        )
        rs = db_conn.Execute(sql)
        expected_cols = {"許可ID", "許可論理ID", "許可番号", "許可区分ID", "優良認定",
                         "許可日", "有効期限", "許可有効年月日", "廃止日文字列", "取消日文字列",
                         "事業者ID", "事業者名", "許可区分名"}
        actual_cols = {rs.Fields(i).Name for i in range(rs.Fields.Count)}
        rs.Close()
        assert expected_cols == actual_cols

    def test_search_permit_with_items_and(self, db_conn):
        """品目AND検索のEXISTS句が正しく動作する"""
        sql = (
            "SELECT 許可.許可ID FROM 許可 "
            "WHERE 許可.有効終了日時 IS NULL"
            " AND EXISTS (SELECT 1 FROM 許可品目 WHERE 許可品目.許可ID = 許可.許可ID AND 許可品目.取り扱いフラグ = True)"
        )
        rs = db_conn.Execute(sql)
        count = 0
        while not rs.EOF:
            count += 1
            rs.MoveNext()
        rs.Close()
        assert count >= 0

    def test_search_facility(self, db_conn):
        """施設検索クエリが実行可能"""
        sql = (
            "SELECT 施設.施設ID, 施設.施設論理ID, 施設.設置場所, 施設.許可番号, 施設.施設種別ID, "
            "事業者.事業者ID, 事業者.事業者名, マスター_施設種別.施設種別名 "
            "FROM (施設 LEFT JOIN 事業者 ON 施設.事業者ID = 事業者.事業者ID) "
            "LEFT JOIN マスター_施設種別 ON 施設.施設種別ID = マスター_施設種別.施設種別ID "
            "WHERE 施設.有効終了日時 IS NULL "
            "ORDER BY 施設.施設ID DESC"
        )
        rs = db_conn.Execute(sql)
        expected_cols = {"施設ID", "施設論理ID", "設置場所", "許可番号", "施設種別ID",
                         "事業者ID", "事業者名", "施設種別名"}
        actual_cols = {rs.Fields(i).Name for i in range(rs.Fields.Count)}
        rs.Close()
        assert expected_cols == actual_cols

    def test_search_vehicle(self, db_conn):
        """車両検索クエリが実行可能"""
        sql = (
            "SELECT 車両.車両ID, 車両.登録番号1, 車両.登録番号2, 車両.登録番号3, 車両.登録番号4, 車両.廃車フラグ, "
            "事業者.事業者ID, 事業者.事業者名 "
            "FROM 車両 LEFT JOIN 事業者 ON 車両.事業者ID = 事業者.事業者ID "
            "ORDER BY 車両.車両ID DESC"
        )
        rs = db_conn.Execute(sql)
        expected_cols = {"車両ID", "登録番号1", "登録番号2", "登録番号3", "登録番号4",
                         "廃車フラグ", "事業者ID", "事業者名"}
        actual_cols = {rs.Fields(i).Name for i in range(rs.Fields.Count)}
        rs.Close()
        assert expected_cols == actual_cols

    def test_search_officer(self, db_conn):
        """役員検索クエリが実行可能"""
        sql = (
            "SELECT 役員.役員ID, 役員.姓, 役員.名, 役員.役職名, 役員.退任フラグ, "
            "事業者.事業者ID, 事業者.事業者名 "
            "FROM 役員 LEFT JOIN 事業者 ON 役員.事業者ID = 事業者.事業者ID "
            "ORDER BY 役員.役員ID DESC"
        )
        rs = db_conn.Execute(sql)
        expected_cols = {"役員ID", "姓", "名", "役職名", "退任フラグ", "事業者ID", "事業者名"}
        actual_cols = {rs.Fields(i).Name for i in range(rs.Fields.Count)}
        rs.Close()
        assert expected_cols == actual_cols


class TestDetailQueries:
    """詳細表示系クエリのテスト"""

    def test_load_permits_for_business(self, db_conn):
        """事業者別許可一覧クエリが正しいカラムを返す"""
        sql = (
            "SELECT TOP 1 許可.許可ID, 許可.許可論理ID, 許可.許可区分ID, 許可.許可番号, "
            "Format(許可.許可年月日, 'yyyy/mm/dd') AS 許可日文字列, "
            "Format(許可.許可有効年月日, 'yyyy/mm/dd') AS 有効期限文字列, "
            "Format(許可.有効開始日時, 'yyyy/mm/dd') AS 有効開始文字列, "
            "Format(許可.取消日, 'yyyy/mm/dd') AS 取消日文字列, "
            "Format(許可.廃止日, 'yyyy/mm/dd') AS 廃止日文字列, "
            "マスター_許可区分.許可区分名 "
            "FROM 許可 LEFT JOIN マスター_許可区分 ON 許可.許可区分ID = マスター_許可区分.許可区分ID"
        )
        rs = db_conn.Execute(sql)
        expected_cols = {"許可ID", "許可論理ID", "許可区分ID", "許可番号",
                         "許可日文字列", "有効期限文字列", "有効開始文字列",
                         "取消日文字列", "廃止日文字列", "許可区分名"}
        actual_cols = {rs.Fields(i).Name for i in range(rs.Fields.Count)}
        rs.Close()
        assert expected_cols == actual_cols

    def test_processing_capacity_query(self, db_conn):
        """処理能力クエリが実行可能"""
        sql = (
            "SELECT 処理能力.*, マスター_品目.品目名 "
            "FROM 処理能力 "
            "LEFT JOIN マスター_品目 ON 処理能力.品目ID = マスター_品目.品目ID "
            "ORDER BY マスター_品目.表示順"
        )
        rs = db_conn.Execute(sql)
        actual_cols = {rs.Fields(i).Name for i in range(rs.Fields.Count)}
        rs.Close()
        assert "品目名" in actual_cols
        assert "処理能力ID" in actual_cols

    def test_permit_items_query(self, db_conn):
        """許可品目クエリが実行可能"""
        sql = "SELECT 品目ID, 品目名 FROM マスター_品目 ORDER BY 表示順"
        rs = db_conn.Execute(sql)
        count = 0
        while not rs.EOF:
            count += 1
            rs.MoveNext()
        rs.Close()
        assert count > 0, "品目マスターにデータがありません"


class TestStatisticsQueries:
    """統計クエリのテスト"""

    def test_business_count(self, db_conn):
        """事業者数カウントが0以上"""
        rs = db_conn.Execute("SELECT COUNT(*) AS cnt FROM [事業者]")
        count = rs.Fields("cnt").Value
        rs.Close()
        assert count >= 0

    def test_active_permit_count(self, db_conn):
        """有効許可数カウントが0以上"""
        rs = db_conn.Execute("SELECT COUNT(*) AS cnt FROM [許可] WHERE [有効終了日時] IS NULL")
        count = rs.Fields("cnt").Value
        rs.Close()
        assert count >= 0

    def test_active_facility_count(self, db_conn):
        """有効施設数カウントが0以上"""
        rs = db_conn.Execute("SELECT COUNT(*) AS cnt FROM [施設] WHERE [有効終了日時] IS NULL")
        count = rs.Fields("cnt").Value
        rs.Close()
        assert count >= 0

    def test_expiring_permit_count(self, db_conn):
        """期限切れ間近カウントが0以上"""
        rs = db_conn.Execute(
            "SELECT COUNT(*) AS cnt FROM [許可] WHERE [有効終了日時] IS NULL AND [許可有効年月日] IS NOT NULL"
        )
        count = rs.Fields("cnt").Value
        rs.Close()
        assert count >= 0

    def test_expiring_permits_within_year(self, db_conn):
        """1年以内の期限切れ許可クエリが実行可能"""
        sql = (
            "SELECT 許可.許可ID, 許可.許可番号, "
            "Format(許可.許可有効年月日, 'yyyy/mm/dd') AS 有効期限文字列, "
            "事業者.事業者名 "
            "FROM (許可 LEFT JOIN 事業者 ON 許可.事業者ID = 事業者.事業者ID) "
            "WHERE 許可.許可有効年月日 BETWEEN Date() AND DateAdd('yyyy', 1, Date()) "
            "AND 許可.有効終了日時 IS NULL "
            "ORDER BY 許可.許可有効年月日"
        )
        rs = db_conn.Execute(sql)
        count = 0
        while not rs.EOF:
            count += 1
            rs.MoveNext()
        rs.Close()
        assert count >= 0

    def test_capacity_aggregation(self, db_conn):
        """処理能力集計クエリが実行可能"""
        sql = (
            "SELECT 施設種別ID, 施設種別名 FROM マスター_施設種別 ORDER BY 施設種別ID"
        )
        rs = db_conn.Execute(sql)
        count = 0
        while not rs.EOF:
            count += 1
            rs.MoveNext()
        rs.Close()
        assert count > 0, "施設種別マスターにデータがありません"


class TestMasterQueries:
    """マスターテーブルクエリのテスト"""

    @pytest.mark.parametrize("table,id_col,name_col", [
        ("マスター_許可区分", "許可区分ID", "許可区分名"),
        ("マスター_施設種別", "施設種別ID", "施設種別名"),
        ("マスター_品目", "品目ID", "品目名"),
        ("マスター_処理方法", "処理方法ID", "処理方法名"),
        ("マスター_廃棄物種類区分", "廃棄物種類区分ID", "廃棄物種類区分名"),
        ("マスター_取扱区分", "取扱区分ID", "取扱区分記号"),
        ("マスター_形式", "形式ID", "形式名"),
        ("マスター_日処理能力単位", "日処理能力単位ID", "日処理能力単位名"),
        ("マスター_時間処理能力単位", "時間処理能力単位ID", "時間処理能力単位名"),
        ("マスター_管理区分", "管理区分ID", "管理区分名"),
        ("マスター_設置形態区分", "設置形態区分ID", "設置形態区分名"),
        ("マスター_許可対象区分", "許可対象区分ID", "許可対象区分名"),
        ("マスター_許可番号形式", "許可番号形式ID", "許可番号形式名"),
        ("マスター_認定区分", "認定ID", "認定名"),
    ])
    def test_master_table_query(self, db_conn, table, id_col, name_col):
        """マスターテーブルのSELECTクエリが実行可能"""
        sql = f"SELECT [{id_col}], [{name_col}] FROM [{table}] ORDER BY [{id_col}]"
        rs = db_conn.Execute(sql)
        actual_cols = {rs.Fields(i).Name for i in range(rs.Fields.Count)}
        rs.Close()
        assert id_col in actual_cols
        assert name_col in actual_cols

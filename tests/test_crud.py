# -*- coding: utf-8 -*-
"""
CRUD操作テスト
トランザクション内でINSERT/UPDATE/DELETEを実行し、ロールバックで安全に検証する
"""
import pytest


class TestBusinessCrud:
    """事業者テーブルのCRUD"""

    def test_insert_business(self, db_conn_tx):
        """事業者をINSERTし、SELECTで確認"""
        sql = (
            "INSERT INTO 事業者 (事業者名, 事業者区分, 郵便番号, 都道府県, 市区町村町名番地, 電話番号) "
            "VALUES ('テスト事業者', 1, '100-0001', '東京都', '千代田区1-1-1', '03-0000-0000')"
        )
        db_conn_tx.Execute(sql)

        rs = db_conn_tx.Execute(
            "SELECT TOP 1 事業者名, 郵便番号, 電話番号 FROM 事業者 "
            "WHERE 事業者名 = 'テスト事業者' ORDER BY 事業者ID DESC"
        )
        assert not rs.EOF
        assert rs.Fields("事業者名").Value == "テスト事業者"
        assert rs.Fields("郵便番号").Value == "100-0001"
        assert rs.Fields("電話番号").Value == "03-0000-0000"
        rs.Close()

    def test_update_business(self, db_conn_tx):
        """事業者をINSERT→UPDATE→SELECTで確認"""
        db_conn_tx.Execute(
            "INSERT INTO 事業者 (事業者名, 事業者区分, 郵便番号, 都道府県, 市区町村町名番地, 電話番号) "
            "VALUES ('更新前事業者', 1, '100-0001', '東京都', '千代田区1-1-1', '03-0000-0000')"
        )

        # 挿入したIDを取得
        rs = db_conn_tx.Execute(
            "SELECT TOP 1 事業者ID FROM 事業者 WHERE 事業者名 = '更新前事業者' ORDER BY 事業者ID DESC"
        )
        new_id = rs.Fields("事業者ID").Value
        rs.Close()

        # UPDATE実行
        db_conn_tx.Execute(
            f"UPDATE 事業者 SET 事業者名 = '更新後事業者', 電話番号 = '06-1111-1111' "
            f"WHERE 事業者ID = {new_id}"
        )

        # 確認
        rs = db_conn_tx.Execute(f"SELECT 事業者名, 電話番号 FROM 事業者 WHERE 事業者ID = {new_id}")
        assert not rs.EOF
        assert rs.Fields("事業者名").Value == "更新後事業者"
        assert rs.Fields("電話番号").Value == "06-1111-1111"
        rs.Close()

    def test_delete_business(self, db_conn_tx):
        """事業者をINSERT→DELETE→SELECTで削除確認"""
        db_conn_tx.Execute(
            "INSERT INTO 事業者 (事業者名, 事業者区分, 郵便番号, 都道府県, 市区町村町名番地, 電話番号) "
            "VALUES ('削除対象事業者', 1, '100-0001', '東京都', '千代田区1-1-1', '03-0000-0000')"
        )

        rs = db_conn_tx.Execute(
            "SELECT TOP 1 事業者ID FROM 事業者 WHERE 事業者名 = '削除対象事業者' ORDER BY 事業者ID DESC"
        )
        new_id = rs.Fields("事業者ID").Value
        rs.Close()

        db_conn_tx.Execute(f"DELETE FROM 事業者 WHERE 事業者ID = {new_id}")

        rs = db_conn_tx.Execute(f"SELECT COUNT(*) AS cnt FROM 事業者 WHERE 事業者ID = {new_id}")
        assert rs.Fields("cnt").Value == 0
        rs.Close()


class TestPermitCrud:
    """許可テーブルのCRUD"""

    def _get_first_business_id(self, conn):
        """テスト用に最初の事業者IDを取得"""
        rs = conn.Execute("SELECT TOP 1 事業者ID FROM 事業者 ORDER BY 事業者ID")
        if rs.EOF:
            pytest.skip("事業者データがありません")
        bid = rs.Fields("事業者ID").Value
        rs.Close()
        return bid

    def _get_first_permit_category_id(self, conn):
        """テスト用に最初の許可区分IDを取得"""
        rs = conn.Execute("SELECT TOP 1 許可区分ID FROM マスター_許可区分 ORDER BY 許可区分ID")
        if rs.EOF:
            pytest.skip("許可区分マスターにデータがありません")
        cid = rs.Fields("許可区分ID").Value
        rs.Close()
        return cid

    def test_insert_permit(self, db_conn_tx):
        """許可をINSERTし、SELECTで確認"""
        bid = self._get_first_business_id(db_conn_tx)
        cid = self._get_first_permit_category_id(db_conn_tx)

        # 論理IDの最大値+1を取得
        rs = db_conn_tx.Execute("SELECT MAX(許可論理ID) AS maxId FROM 許可")
        max_lid = rs.Fields("maxId").Value or 0
        rs.Close()
        new_lid = max_lid + 1

        sql = (
            f"INSERT INTO 許可 (許可論理ID, 事業者ID, 許可区分ID, 許可番号, "
            f"許可年月日, 許可有効年月日, 優良認定, 有効開始日時, 作成日時) "
            f"VALUES ({new_lid}, {bid}, {cid}, 'TEST-0001', "
            f"#2026/01/01#, #2027/01/01#, False, Now(), Now())"
        )
        db_conn_tx.Execute(sql)

        rs = db_conn_tx.Execute(
            f"SELECT 許可番号, 事業者ID, 許可区分ID FROM 許可 WHERE 許可論理ID = {new_lid} "
            f"AND 有効終了日時 IS NULL ORDER BY 許可ID DESC"
        )
        assert not rs.EOF
        assert rs.Fields("許可番号").Value == "TEST-0001"
        assert rs.Fields("事業者ID").Value == bid
        rs.Close()

    def test_update_permit_abolish(self, db_conn_tx):
        """許可の廃止日更新が正しく動作する"""
        rs = db_conn_tx.Execute(
            "SELECT TOP 1 許可ID FROM 許可 WHERE 有効終了日時 IS NULL AND 廃止日 IS NULL ORDER BY 許可ID"
        )
        if rs.EOF:
            rs.Close()
            pytest.skip("廃止可能な許可データがありません")
        pid = rs.Fields("許可ID").Value
        rs.Close()

        db_conn_tx.Execute(
            f"UPDATE 許可 SET 廃止日 = #2026/02/28#, 廃止理由 = 'テスト廃止' WHERE 許可ID = {pid}"
        )

        rs = db_conn_tx.Execute(f"SELECT 廃止日, 廃止理由 FROM 許可 WHERE 許可ID = {pid}")
        assert not rs.EOF
        assert rs.Fields("廃止理由").Value == "テスト廃止"
        assert rs.Fields("廃止日").Value is not None
        rs.Close()

    def test_update_permit_cancel(self, db_conn_tx):
        """許可の取消日更新が正しく動作する"""
        rs = db_conn_tx.Execute(
            "SELECT TOP 1 許可ID FROM 許可 WHERE 有効終了日時 IS NULL AND 取消日 IS NULL ORDER BY 許可ID"
        )
        if rs.EOF:
            rs.Close()
            pytest.skip("取消可能な許可データがありません")
        pid = rs.Fields("許可ID").Value
        rs.Close()

        db_conn_tx.Execute(
            f"UPDATE 許可 SET 取消日 = #2026/02/28#, 取消理由 = 'テスト取消' WHERE 許可ID = {pid}"
        )

        rs = db_conn_tx.Execute(f"SELECT 取消日, 取消理由 FROM 許可 WHERE 許可ID = {pid}")
        assert not rs.EOF
        assert rs.Fields("取消理由").Value == "テスト取消"
        assert rs.Fields("取消日").Value is not None
        rs.Close()

    def test_update_permit_revive(self, db_conn_tx):
        """廃止→復活（NULL化）が正しく動作する"""
        rs = db_conn_tx.Execute(
            "SELECT TOP 1 許可ID FROM 許可 WHERE 有効終了日時 IS NULL ORDER BY 許可ID"
        )
        if rs.EOF:
            rs.Close()
            pytest.skip("許可データがありません")
        pid = rs.Fields("許可ID").Value
        rs.Close()

        # まず廃止状態にする
        db_conn_tx.Execute(
            f"UPDATE 許可 SET 廃止日 = #2026/02/28#, 廃止理由 = 'テスト' WHERE 許可ID = {pid}"
        )
        # 復活
        db_conn_tx.Execute(
            f"UPDATE 許可 SET 廃止日 = NULL, 廃止理由 = NULL, 取消日 = NULL, 取消理由 = NULL "
            f"WHERE 許可ID = {pid}"
        )

        rs = db_conn_tx.Execute(f"SELECT 廃止日, 取消日 FROM 許可 WHERE 許可ID = {pid}")
        assert not rs.EOF
        assert rs.Fields("廃止日").Value is None
        assert rs.Fields("取消日").Value is None
        rs.Close()


class TestPermitItemCrud:
    """許可品目テーブルのCRUD（3状態サイクル）"""

    def _get_first_permit_id(self, conn):
        rs = conn.Execute("SELECT TOP 1 許可ID FROM 許可 WHERE 有効終了日時 IS NULL ORDER BY 許可ID")
        if rs.EOF:
            rs.Close()
            pytest.skip("許可データがありません")
        pid = rs.Fields("許可ID").Value
        rs.Close()
        return pid

    def _get_first_item_id(self, conn):
        rs = conn.Execute("SELECT TOP 1 品目ID FROM マスター_品目 ORDER BY 品目ID")
        if rs.EOF:
            rs.Close()
            pytest.skip("品目マスターにデータがありません")
        iid = rs.Fields("品目ID").Value
        rs.Close()
        return iid

    def test_insert_permit_item(self, db_conn_tx):
        """許可品目のINSERT（取り扱いフラグ=True, 積替保管フラグ=False）"""
        pid = self._get_first_permit_id(db_conn_tx)
        iid = self._get_first_item_id(db_conn_tx)

        # 既存の同一品目を削除してからテスト
        db_conn_tx.Execute(f"DELETE FROM 許可品目 WHERE 許可ID = {pid} AND 品目ID = {iid}")

        db_conn_tx.Execute(
            f"INSERT INTO 許可品目 (許可ID, 品目ID, 取り扱いフラグ, 積替保管フラグ) "
            f"VALUES ({pid}, {iid}, True, False)"
        )

        rs = db_conn_tx.Execute(
            f"SELECT 取り扱いフラグ, 積替保管フラグ FROM 許可品目 "
            f"WHERE 許可ID = {pid} AND 品目ID = {iid}"
        )
        assert not rs.EOF
        assert rs.Fields("取り扱いフラグ").Value is True
        assert rs.Fields("積替保管フラグ").Value is False
        rs.Close()

    def test_update_permit_item_to_transshipment(self, db_conn_tx):
        """許可品目の積替保管フラグをTrueに更新"""
        pid = self._get_first_permit_id(db_conn_tx)
        iid = self._get_first_item_id(db_conn_tx)

        # テスト用レコード作成
        db_conn_tx.Execute(f"DELETE FROM 許可品目 WHERE 許可ID = {pid} AND 品目ID = {iid}")
        db_conn_tx.Execute(
            f"INSERT INTO 許可品目 (許可ID, 品目ID, 取り扱いフラグ, 積替保管フラグ) "
            f"VALUES ({pid}, {iid}, True, False)"
        )

        # IDを取得
        rs = db_conn_tx.Execute(
            f"SELECT 許可品目ID FROM 許可品目 WHERE 許可ID = {pid} AND 品目ID = {iid}"
        )
        rec_id = rs.Fields("許可品目ID").Value
        rs.Close()

        # 積替保管フラグをTrueに更新
        db_conn_tx.Execute(
            f"UPDATE 許可品目 SET 取り扱いフラグ = True, 積替保管フラグ = True "
            f"WHERE 許可品目ID = {rec_id}"
        )

        rs = db_conn_tx.Execute(
            f"SELECT 取り扱いフラグ, 積替保管フラグ FROM 許可品目 WHERE 許可品目ID = {rec_id}"
        )
        assert not rs.EOF
        assert rs.Fields("取り扱いフラグ").Value is True
        assert rs.Fields("積替保管フラグ").Value is True
        rs.Close()

    def test_delete_permit_item(self, db_conn_tx):
        """許可品目のDELETE"""
        pid = self._get_first_permit_id(db_conn_tx)
        iid = self._get_first_item_id(db_conn_tx)

        db_conn_tx.Execute(f"DELETE FROM 許可品目 WHERE 許可ID = {pid} AND 品目ID = {iid}")
        db_conn_tx.Execute(
            f"INSERT INTO 許可品目 (許可ID, 品目ID, 取り扱いフラグ, 積替保管フラグ) "
            f"VALUES ({pid}, {iid}, True, False)"
        )

        rs = db_conn_tx.Execute(
            f"SELECT 許可品目ID FROM 許可品目 WHERE 許可ID = {pid} AND 品目ID = {iid}"
        )
        rec_id = rs.Fields("許可品目ID").Value
        rs.Close()

        db_conn_tx.Execute(f"DELETE FROM 許可品目 WHERE 許可品目ID = {rec_id}")

        rs = db_conn_tx.Execute(
            f"SELECT COUNT(*) AS cnt FROM 許可品目 WHERE 許可品目ID = {rec_id}"
        )
        assert rs.Fields("cnt").Value == 0
        rs.Close()


class TestVehicleCrud:
    """車両テーブルのCRUD"""

    def _get_first_business_id(self, conn):
        rs = conn.Execute("SELECT TOP 1 事業者ID FROM 事業者 ORDER BY 事業者ID")
        if rs.EOF:
            rs.Close()
            pytest.skip("事業者データがありません")
        bid = rs.Fields("事業者ID").Value
        rs.Close()
        return bid

    def test_insert_vehicle(self, db_conn_tx):
        """車両をINSERTし、SELECTで確認"""
        bid = self._get_first_business_id(db_conn_tx)

        db_conn_tx.Execute(
            f"INSERT INTO 車両 (事業者ID, 登録番号1, 登録番号2, 登録番号3, 登録番号4, 廃車フラグ) "
            f"VALUES ({bid}, '品川', '500', 'あ', '1234', False)"
        )

        rs = db_conn_tx.Execute(
            f"SELECT TOP 1 登録番号1, 登録番号2, 登録番号3, 登録番号4, 廃車フラグ "
            f"FROM 車両 WHERE 事業者ID = {bid} AND 登録番号1 = '品川' AND 登録番号4 = '1234' "
            f"ORDER BY 車両ID DESC"
        )
        assert not rs.EOF
        assert rs.Fields("登録番号1").Value == "品川"
        assert rs.Fields("登録番号2").Value == "500"
        assert rs.Fields("登録番号3").Value == "あ"
        assert rs.Fields("登録番号4").Value == "1234"
        rs.Close()

    def test_update_vehicle_scrap(self, db_conn_tx):
        """車両の廃車フラグ切替"""
        bid = self._get_first_business_id(db_conn_tx)

        db_conn_tx.Execute(
            f"INSERT INTO 車両 (事業者ID, 登録番号1, 登録番号2, 登録番号3, 登録番号4, 廃車フラグ) "
            f"VALUES ({bid}, 'テスト', '999', 'さ', '9999', False)"
        )

        rs = db_conn_tx.Execute(
            f"SELECT TOP 1 車両ID FROM 車両 WHERE 登録番号1 = 'テスト' AND 登録番号4 = '9999' "
            f"ORDER BY 車両ID DESC"
        )
        vid = rs.Fields("車両ID").Value
        rs.Close()

        # 廃車にする
        db_conn_tx.Execute(f"UPDATE 車両 SET 廃車フラグ = True WHERE 車両ID = {vid}")
        rs = db_conn_tx.Execute(f"SELECT 廃車フラグ FROM 車両 WHERE 車両ID = {vid}")
        assert rs.Fields("廃車フラグ").Value is True
        rs.Close()

        # 復活
        db_conn_tx.Execute(f"UPDATE 車両 SET 廃車フラグ = False WHERE 車両ID = {vid}")
        rs = db_conn_tx.Execute(f"SELECT 廃車フラグ FROM 車両 WHERE 車両ID = {vid}")
        assert rs.Fields("廃車フラグ").Value is False
        rs.Close()

    def test_delete_vehicle(self, db_conn_tx):
        """車両のDELETE"""
        bid = self._get_first_business_id(db_conn_tx)

        db_conn_tx.Execute(
            f"INSERT INTO 車両 (事業者ID, 登録番号1, 登録番号2, 登録番号3, 登録番号4, 廃車フラグ) "
            f"VALUES ({bid}, '削除', '000', 'テ', '0000', False)"
        )

        rs = db_conn_tx.Execute(
            f"SELECT TOP 1 車両ID FROM 車両 WHERE 登録番号1 = '削除' AND 登録番号4 = '0000' "
            f"ORDER BY 車両ID DESC"
        )
        vid = rs.Fields("車両ID").Value
        rs.Close()

        db_conn_tx.Execute(f"DELETE FROM 車両 WHERE 車両ID = {vid}")

        rs = db_conn_tx.Execute(f"SELECT COUNT(*) AS cnt FROM 車両 WHERE 車両ID = {vid}")
        assert rs.Fields("cnt").Value == 0
        rs.Close()


class TestOfficerCrud:
    """役員テーブルのCRUD"""

    def _get_first_business_id(self, conn):
        rs = conn.Execute("SELECT TOP 1 事業者ID FROM 事業者 ORDER BY 事業者ID")
        if rs.EOF:
            rs.Close()
            pytest.skip("事業者データがありません")
        bid = rs.Fields("事業者ID").Value
        rs.Close()
        return bid

    def test_insert_officer(self, db_conn_tx):
        """役員をINSERTし、SELECTで確認"""
        bid = self._get_first_business_id(db_conn_tx)

        db_conn_tx.Execute(
            f"INSERT INTO 役員 (事業者ID, 役職名, 姓, 名, 退任フラグ) "
            f"VALUES ({bid}, '代表取締役', 'テスト', '太郎', False)"
        )

        rs = db_conn_tx.Execute(
            f"SELECT TOP 1 役職名, 姓, 名, 退任フラグ FROM 役員 "
            f"WHERE 事業者ID = {bid} AND 姓 = 'テスト' AND 名 = '太郎' "
            f"ORDER BY 役員ID DESC"
        )
        assert not rs.EOF
        assert rs.Fields("役職名").Value == "代表取締役"
        assert rs.Fields("姓").Value == "テスト"
        assert rs.Fields("名").Value == "太郎"
        rs.Close()

    def test_update_officer_retire(self, db_conn_tx):
        """役員の退任フラグ切替"""
        bid = self._get_first_business_id(db_conn_tx)

        db_conn_tx.Execute(
            f"INSERT INTO 役員 (事業者ID, 役職名, 姓, 名, 退任フラグ) "
            f"VALUES ({bid}, '取締役', '退任', 'テスト', False)"
        )

        rs = db_conn_tx.Execute(
            f"SELECT TOP 1 役員ID FROM 役員 WHERE 姓 = '退任' AND 名 = 'テスト' "
            f"ORDER BY 役員ID DESC"
        )
        oid = rs.Fields("役員ID").Value
        rs.Close()

        # 退任にする
        db_conn_tx.Execute(f"UPDATE 役員 SET 退任フラグ = True WHERE 役員ID = {oid}")
        rs = db_conn_tx.Execute(f"SELECT 退任フラグ FROM 役員 WHERE 役員ID = {oid}")
        assert rs.Fields("退任フラグ").Value is True
        rs.Close()

        # 復活
        db_conn_tx.Execute(f"UPDATE 役員 SET 退任フラグ = False WHERE 役員ID = {oid}")
        rs = db_conn_tx.Execute(f"SELECT 退任フラグ FROM 役員 WHERE 役員ID = {oid}")
        assert rs.Fields("退任フラグ").Value is False
        rs.Close()

    def test_update_officer_info(self, db_conn_tx):
        """役員情報の更新"""
        bid = self._get_first_business_id(db_conn_tx)

        db_conn_tx.Execute(
            f"INSERT INTO 役員 (事業者ID, 役職名, 姓, 名, 退任フラグ) "
            f"VALUES ({bid}, '監査役', '変更前', '一郎', False)"
        )

        rs = db_conn_tx.Execute(
            f"SELECT TOP 1 役員ID FROM 役員 WHERE 姓 = '変更前' AND 名 = '一郎' "
            f"ORDER BY 役員ID DESC"
        )
        oid = rs.Fields("役員ID").Value
        rs.Close()

        db_conn_tx.Execute(
            f"UPDATE 役員 SET 役職名 = '常務取締役', 姓 = '変更後', 名 = '二郎' WHERE 役員ID = {oid}"
        )

        rs = db_conn_tx.Execute(f"SELECT 役職名, 姓, 名 FROM 役員 WHERE 役員ID = {oid}")
        assert not rs.EOF
        assert rs.Fields("役職名").Value == "常務取締役"
        assert rs.Fields("姓").Value == "変更後"
        assert rs.Fields("名").Value == "二郎"
        rs.Close()

    def test_delete_officer(self, db_conn_tx):
        """役員のDELETE"""
        bid = self._get_first_business_id(db_conn_tx)

        db_conn_tx.Execute(
            f"INSERT INTO 役員 (事業者ID, 役職名, 姓, 名, 退任フラグ) "
            f"VALUES ({bid}, '取締役', '削除', '対象', False)"
        )

        rs = db_conn_tx.Execute(
            f"SELECT TOP 1 役員ID FROM 役員 WHERE 姓 = '削除' AND 名 = '対象' "
            f"ORDER BY 役員ID DESC"
        )
        oid = rs.Fields("役員ID").Value
        rs.Close()

        db_conn_tx.Execute(f"DELETE FROM 役員 WHERE 役員ID = {oid}")

        rs = db_conn_tx.Execute(f"SELECT COUNT(*) AS cnt FROM 役員 WHERE 役員ID = {oid}")
        assert rs.Fields("cnt").Value == 0
        rs.Close()


class TestFacilityCrud:
    """施設テーブルのCRUD"""

    def _get_first_business_id(self, conn):
        rs = conn.Execute("SELECT TOP 1 事業者ID FROM 事業者 ORDER BY 事業者ID")
        if rs.EOF:
            rs.Close()
            pytest.skip("事業者データがありません")
        bid = rs.Fields("事業者ID").Value
        rs.Close()
        return bid

    def _get_first_facility_type_id(self, conn):
        rs = conn.Execute("SELECT TOP 1 施設種別ID FROM マスター_施設種別 ORDER BY 施設種別ID")
        if rs.EOF:
            rs.Close()
            pytest.skip("施設種別マスターにデータがありません")
        tid = rs.Fields("施設種別ID").Value
        rs.Close()
        return tid

    def test_insert_facility(self, db_conn_tx):
        """施設をINSERTし、SELECTで確認"""
        bid = self._get_first_business_id(db_conn_tx)
        tid = self._get_first_facility_type_id(db_conn_tx)

        # 論理IDの最大値+1を取得
        rs = db_conn_tx.Execute("SELECT MAX(施設論理ID) AS maxId FROM 施設")
        max_lid = rs.Fields("maxId").Value or 0
        rs.Close()
        new_lid = max_lid + 1

        sql = (
            f"INSERT INTO 施設 (施設論理ID, 事業者ID, 施設種別ID, 設置場所, 有効開始日時) "
            f"VALUES ({new_lid}, {bid}, {tid}, 'テスト市テスト町1-1', Now())"
        )
        db_conn_tx.Execute(sql)

        rs = db_conn_tx.Execute(
            f"SELECT 設置場所, 事業者ID, 施設種別ID FROM 施設 "
            f"WHERE 施設論理ID = {new_lid} AND 有効終了日時 IS NULL"
        )
        assert not rs.EOF
        assert rs.Fields("設置場所").Value == "テスト市テスト町1-1"
        assert rs.Fields("事業者ID").Value == bid
        rs.Close()

    def test_close_facility(self, db_conn_tx):
        """施設の廃止（有効終了日時の設定）"""
        rs = db_conn_tx.Execute(
            "SELECT TOP 1 施設ID FROM 施設 WHERE 有効終了日時 IS NULL ORDER BY 施設ID"
        )
        if rs.EOF:
            rs.Close()
            pytest.skip("有効な施設データがありません")
        fid = rs.Fields("施設ID").Value
        rs.Close()

        db_conn_tx.Execute(
            f"UPDATE 施設 SET 有効終了日時 = #2026/02/28#, 廃止年月日 = #2026/02/28# "
            f"WHERE 施設ID = {fid}"
        )

        rs = db_conn_tx.Execute(f"SELECT 有効終了日時, 廃止年月日 FROM 施設 WHERE 施設ID = {fid}")
        assert not rs.EOF
        assert rs.Fields("有効終了日時").Value is not None
        assert rs.Fields("廃止年月日").Value is not None
        rs.Close()


class TestCapacityCrud:
    """処理能力テーブルのCRUD"""

    def _get_first_facility_id(self, conn):
        rs = conn.Execute("SELECT TOP 1 施設ID FROM 施設 WHERE 有効終了日時 IS NULL ORDER BY 施設ID")
        if rs.EOF:
            rs.Close()
            pytest.skip("有効な施設データがありません")
        fid = rs.Fields("施設ID").Value
        rs.Close()
        return fid

    def _get_first_item_id(self, conn):
        rs = conn.Execute("SELECT TOP 1 品目ID FROM マスター_品目 ORDER BY 品目ID")
        if rs.EOF:
            rs.Close()
            pytest.skip("品目マスターにデータがありません")
        iid = rs.Fields("品目ID").Value
        rs.Close()
        return iid

    def test_insert_capacity(self, db_conn_tx):
        """処理能力をINSERTし、SELECTで確認"""
        fid = self._get_first_facility_id(db_conn_tx)
        iid = self._get_first_item_id(db_conn_tx)

        sql = (
            f"INSERT INTO 処理能力 (施設ID, 品目ID, 時間処理能力, 時間処理能力単位ID, "
            f"日処理能力, 日処理能力単位ID, 稼働時間, 特記事項) "
            f"VALUES ({fid}, {iid}, 100, 1, 800, 1, 8, 'テスト特記事項')"
        )
        db_conn_tx.Execute(sql)

        rs = db_conn_tx.Execute(
            f"SELECT TOP 1 時間処理能力, 日処理能力, 特記事項 FROM 処理能力 "
            f"WHERE 施設ID = {fid} AND 品目ID = {iid} ORDER BY 処理能力ID DESC"
        )
        assert not rs.EOF
        assert rs.Fields("特記事項").Value == "テスト特記事項"
        rs.Close()

    def test_update_capacity(self, db_conn_tx):
        """処理能力の更新"""
        fid = self._get_first_facility_id(db_conn_tx)
        iid = self._get_first_item_id(db_conn_tx)

        db_conn_tx.Execute(
            f"INSERT INTO 処理能力 (施設ID, 品目ID, 時間処理能力, 時間処理能力単位ID, "
            f"日処理能力, 日処理能力単位ID, 稼働時間, 特記事項) "
            f"VALUES ({fid}, {iid}, 50, 1, 400, 1, 8, '更新前')"
        )

        rs = db_conn_tx.Execute(
            f"SELECT TOP 1 処理能力ID FROM 処理能力 "
            f"WHERE 施設ID = {fid} AND 特記事項 = '更新前' ORDER BY 処理能力ID DESC"
        )
        cid = rs.Fields("処理能力ID").Value
        rs.Close()

        db_conn_tx.Execute(
            f"UPDATE 処理能力 SET 時間処理能力 = 200, 日処理能力 = 1600, 特記事項 = '更新後' "
            f"WHERE 処理能力ID = {cid}"
        )

        rs = db_conn_tx.Execute(f"SELECT 時間処理能力, 日処理能力, 特記事項 FROM 処理能力 WHERE 処理能力ID = {cid}")
        assert not rs.EOF
        assert rs.Fields("特記事項").Value == "更新後"
        rs.Close()

    def test_delete_capacity(self, db_conn_tx):
        """処理能力のDELETE"""
        fid = self._get_first_facility_id(db_conn_tx)
        iid = self._get_first_item_id(db_conn_tx)

        db_conn_tx.Execute(
            f"INSERT INTO 処理能力 (施設ID, 品目ID, 時間処理能力, 時間処理能力単位ID, "
            f"日処理能力, 日処理能力単位ID, 稼働時間, 特記事項) "
            f"VALUES ({fid}, {iid}, 10, 1, 80, 1, 8, '削除対象')"
        )

        rs = db_conn_tx.Execute(
            f"SELECT TOP 1 処理能力ID FROM 処理能力 WHERE 特記事項 = '削除対象' ORDER BY 処理能力ID DESC"
        )
        cid = rs.Fields("処理能力ID").Value
        rs.Close()

        db_conn_tx.Execute(f"DELETE FROM 処理能力 WHERE 処理能力ID = {cid}")

        rs = db_conn_tx.Execute(f"SELECT COUNT(*) AS cnt FROM 処理能力 WHERE 処理能力ID = {cid}")
        assert rs.Fields("cnt").Value == 0
        rs.Close()

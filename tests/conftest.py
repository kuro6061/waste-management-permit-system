# -*- coding: utf-8 -*-
"""
pytest フィクスチャ - DB接続とトランザクション管理

接続方式: ADODB (win32com) → pyodbc の順にフォールバック
ドライバー未インストール時は全テストをスキップする
"""
import os
import pytest

DB_PATH = os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
    "Database_ver.4.7.accdb"
)


class _PyodbcWrapper:
    """pyodbc の接続をADODB風インターフェースで使えるようにするラッパー"""

    class _FieldProxy:
        def __init__(self, cursor, row, columns):
            self._cursor = cursor
            self._row = row
            self._columns = columns  # {name: index}

        @property
        def Count(self):
            return len(self._columns)

        def __call__(self, key):
            if isinstance(key, int):
                return self._FieldValue(self._row, key, list(self._columns.keys())[key])
            name = key
            idx = self._columns.get(name)
            if idx is None:
                raise KeyError(f"Field '{name}' not found")
            return self._FieldValue(self._row, idx, name)

        class _FieldValue:
            def __init__(self, row, idx, name):
                self._row = row
                self._idx = idx
                self._name = name

            @property
            def Value(self):
                return self._row[self._idx] if self._row else None

            @property
            def Name(self):
                return self._name

    class _RecordSet:
        def __init__(self, cursor):
            self._cursor = cursor
            self._columns = {}
            if cursor.description:
                self._columns = {desc[0]: i for i, desc in enumerate(cursor.description)}
            self._row = None
            self._eof = False
            self._fetch_next()

        def _fetch_next(self):
            try:
                self._row = self._cursor.fetchone()
                self._eof = self._row is None
            except Exception:
                self._eof = True

        @property
        def EOF(self):
            return self._eof

        @property
        def Fields(self):
            return _PyodbcWrapper._FieldProxy(self._cursor, self._row, self._columns)

        def MoveNext(self):
            self._fetch_next()

        def Close(self):
            try:
                self._cursor.close()
            except Exception:
                pass

    def __init__(self, pyodbc_conn):
        self._conn = pyodbc_conn

    def Execute(self, sql):
        cursor = self._conn.cursor()
        cursor.execute(sql)
        return self._RecordSet(cursor)

    def BeginTrans(self):
        self._conn.autocommit = False

    def RollbackTrans(self):
        self._conn.rollback()

    def Close(self):
        self._conn.close()


def _try_adodb(db_path):
    """ADODB (win32com) での接続を試行"""
    try:
        import win32com.client
    except ImportError:
        return None

    providers = [
        f"Provider=Microsoft.ACE.OLEDB.16.0;Data Source={db_path};",
        f"Provider=Microsoft.ACE.OLEDB.12.0;Data Source={db_path};",
        f"Provider=Microsoft.Jet.OLEDB.4.0;Data Source={db_path};",
    ]

    for conn_str in providers:
        try:
            conn = win32com.client.Dispatch("ADODB.Connection")
            conn.Open(conn_str)
            return conn
        except Exception:
            pass
    return None


def _try_pyodbc(db_path):
    """pyodbc での接続を試行"""
    try:
        import pyodbc
    except ImportError:
        return None

    drivers = [d for d in pyodbc.drivers() if "Access" in d]
    for driver in drivers:
        try:
            conn_str = f"DRIVER={{{driver}}};DBQ={db_path};"
            raw_conn = pyodbc.connect(conn_str)
            return _PyodbcWrapper(raw_conn)
        except Exception:
            pass
    return None


@pytest.fixture(scope="session")
def db_conn():
    """DB接続（セッションスコープ - 全テストで共有）
    ADODB → pyodbc の順にフォールバックする"""
    conn = _try_adodb(DB_PATH)
    if conn is None:
        conn = _try_pyodbc(DB_PATH)
    if conn is None:
        pytest.skip(
            "DB接続に失敗しました。Microsoft Access Database Engine をインストールしてください。\n"
            "https://www.microsoft.com/en-us/download/details.aspx?id=54920"
        )
    yield conn
    conn.Close()


@pytest.fixture
def db_conn_tx(db_conn):
    """トランザクション付き接続（テスト後にロールバック）"""
    db_conn.BeginTrans()
    yield db_conn
    db_conn.RollbackTrans()

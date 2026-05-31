# -*- coding: utf-8 -*-
"""
廃棄物処理業許可管理システム ダミーデータ生成スクリプト

このスクリプトは以下を行います：
1. 既存データをすべて削除（マスターテーブル以外）
2. 適切な構造のダミーデータを生成

使用方法：
    python generate_dummy_data.py

注意：
    - 64bit Python + pyodbc が必要
    - データベースファイルが閉じている状態で実行
"""

import random
from datetime import datetime, timedelta
import os
from pathlib import Path

import pyodbc

# --- 設定 ---
ROOT_DIR = Path(__file__).resolve().parents[1]
DB_PATH = os.environ.get("DB_PATH", str(ROOT_DIR / "Database_ver.4.7.accdb"))

# --- 接続 ---
def get_connection():
    conn_str = (
        r'DRIVER={Microsoft Access Driver (*.mdb, *.accdb)};'
        f'DBQ={DB_PATH};'
    )
    return pyodbc.connect(conn_str)

# --- ダミーデータ定義 ---
PREFECTURES = [
    '北海道', '青森県', '岩手県', '宮城県', '秋田県', '山形県', '福島県',
    '茨城県', '栃木県', '群馬県', '埼玉県', '千葉県', '東京都', '神奈川県',
    '新潟県', '富山県', '石川県', '福井県', '山梨県', '長野県',
    '岐阜県', '静岡県', '愛知県', '三重県',
    '滋賀県', '京都府', '大阪府', '兵庫県', '奈良県', '和歌山県',
    '鳥取県', '島根県', '岡山県', '広島県', '山口県',
    '徳島県', '香川県', '愛媛県', '高知県',
    '福岡県', '佐賀県', '長崎県', '熊本県', '大分県', '宮崎県', '鹿児島県', '沖縄県'
]

COMPANY_SUFFIXES = ['株式会社', '有限会社', '合同会社']
COMPANY_NAMES = [
    '環境サービス', 'クリーンテック', 'エコロジー', 'リサイクル',
    '産業', '清掃', 'グリーン', 'サステナブル', '資源',
    '環境開発', 'エコシステム', 'リソース', '環境保全'
]

CITIES = [
    '中央区', '北区', '南区', '東区', '西区', '港区', '新宿区',
    '○○市', '△△町', '□□区'
]

ADDRESSES = [
    '1-2-3', '4-5-6', '7-8-9', '10-11', '12-13-14',
    '本町1丁目', '駅前2丁目', '工業団地3番地'
]

ROLE_NAMES = ['代表取締役', '取締役', '監査役', '専務取締役', '常務取締役', '部長', '課長']

LAST_NAMES = ['佐藤', '鈴木', '高橋', '田中', '伊藤', '渡辺', '山本', '中村', '小林', '加藤',
              '吉田', '山田', '佐々木', '山口', '松本', '井上', '斎藤', '林', '清水', '山崎']
FIRST_NAMES = ['太郎', '一郎', '健一', '正', '和夫', '誠', '隆', '明', '秀樹', '浩',
               '花子', '幸子', '和子', '洋子', '恵子', '美智子', '由美', '陽子', '真理', '智子']

def random_date(start_year=2015, end_year=2025):
    """ランダムな日付を生成"""
    start = datetime(start_year, 1, 1)
    end = datetime(end_year, 12, 31)
    delta = end - start
    random_days = random.randint(0, delta.days)
    return start + timedelta(days=random_days)

def random_phone():
    """ランダムな電話番号を生成"""
    area = random.choice(['03', '06', '052', '011', '022', '045', '048', '043'])
    mid = random.randint(1000, 9999)
    last = random.randint(1000, 9999)
    return f'{area}-{mid}-{last}'

def random_zipcode():
    """ランダムな郵便番号を生成"""
    return f'{random.randint(100, 999)}-{random.randint(1000, 9999)}'

def generate_company_name():
    """会社名を生成"""
    pref = random.choice(PREFECTURES).replace('県', '').replace('都', '').replace('府', '').replace('道', '')
    name = random.choice(COMPANY_NAMES)
    suffix = random.choice(COMPANY_SUFFIXES)

    if random.random() < 0.5:
        return f'{suffix}{pref}{name}'
    else:
        return f'{pref}{name}{suffix}'

def generate_permit_number(category_id, seq):
    """許可番号を生成"""
    # 許可区分によって形式を変える
    prefix_map = {
        1: 'SHU',  # 産業廃棄物収集運搬
        2: 'SHO',  # 産業廃棄物処分
        3: 'IPP',  # 一般廃棄物収集運搬
        4: 'IPS',  # 一般廃棄物処分
    }
    prefix = prefix_map.get(category_id, 'PER')
    return f'{prefix}-{random.randint(1, 47):02d}-{seq:04d}'

# --- データ削除 ---
def clear_data(conn):
    """既存のトランザクションデータを削除"""
    cursor = conn.cursor()

    # 削除順序（外部キー制約を考慮）
    tables_to_clear = [
        '処理能力',
        '許可品目',
        '許可最新履歴',
        '許可論理IDマッピング',
        '許可論理ID管理',
        '施設履歴',
        '施設概要',
        '中間_施設表示順',
        '車両',
        '役員',
        '施設',
        '許可',
        '事業者',
    ]

    print('既存データを削除中...')
    for table in tables_to_clear:
        try:
            cursor.execute(f'DELETE FROM [{table}]')
            print(f'  {table}: 削除完了')
        except Exception as e:
            print(f'  {table}: スキップ ({e})')

    conn.commit()
    print('削除完了\n')

# --- テーブル名を取得（特殊文字対策） ---
def get_table_names(conn):
    """データベース内のテーブル名を取得"""
    cursor = conn.cursor()
    tables = {}
    for row in cursor.tables(tableType='TABLE'):
        table_name = row.table_name
        # 正規化したキーを作成（ソフトハイフンを除去）
        normalized = table_name.replace('\xad', '').replace('\u00ad', '')
        tables[normalized] = table_name
    return tables

# --- マスターデータ確認 ---
def get_master_data(conn):
    """マスターテーブルのデータを取得"""
    cursor = conn.cursor()
    masters = {}

    # テーブル名一覧を取得
    tables = get_table_names(conn)
    print('  テーブル一覧取得完了')

    # 許可区分
    table_name = tables.get('マスター_許可区分', 'マスター_許可区分')
    try:
        cursor.execute(f'SELECT 許可区分ID, 許可区分名 FROM [{table_name}]')
        masters['permit_categories'] = {row[0]: row[1] for row in cursor.fetchall()}
    except Exception as e:
        print(f'    許可区分取得エラー: {e}')
        masters['permit_categories'] = {}

    # 施設種別
    table_name = tables.get('マスター_施設種別', 'マスター_施設種別')
    try:
        cursor.execute(f'SELECT 施設種別ID, 施設種別名 FROM [{table_name}]')
        masters['facility_types'] = {row[0]: row[1] for row in cursor.fetchall()}
    except Exception as e:
        print(f'    施設種別取得エラー: {e}')
        masters['facility_types'] = {}

    # 品目
    table_name = tables.get('マスター_品目', 'マスター_品目')
    try:
        cursor.execute(f'SELECT 品目ID, 品目名 FROM [{table_name}]')
        masters['items'] = {row[0]: row[1] for row in cursor.fetchall()}
    except Exception as e:
        print(f'    品目取得エラー: {e}')
        masters['items'] = {}

    # 事業者区分（特殊文字を含む可能性あり）
    table_name = None
    for key, val in tables.items():
        if '事業者区分' in key:
            table_name = val
            break
    if table_name:
        try:
            cursor.execute(f'SELECT 事業者区分ID, 事業者区分名 FROM [{table_name}]')
            masters['business_categories'] = {row[0]: row[1] for row in cursor.fetchall()}
        except Exception as e:
            print(f'    事業者区分取得エラー: {e}')
            masters['business_categories'] = {}
    else:
        masters['business_categories'] = {}

    # 処理方法
    table_name = tables.get('マスター_処理方法', 'マスター_処理方法')
    try:
        cursor.execute(f'SELECT 処理方法ID, 処理方法名 FROM [{table_name}]')
        masters['processing_methods'] = {row[0]: row[1] for row in cursor.fetchall()}
    except Exception as e:
        print(f'    処理方法取得エラー: {e}')
        masters['processing_methods'] = {}

    return masters

# --- データ生成 ---
def generate_data(conn, num_businesses=20):
    """ダミーデータを生成"""
    cursor = conn.cursor()
    masters = get_master_data(conn)

    print(f'マスターデータ確認:')
    print(f'  許可区分: {len(masters["permit_categories"])}件')
    print(f'  施設種別: {len(masters["facility_types"])}件')
    print(f'  品目: {len(masters["items"])}件')
    print(f'  事業者区分: {len(masters["business_categories"])}件')
    print(f'  処理方法: {len(masters["processing_methods"])}件')
    print()

    permit_categories = list(masters['permit_categories'].keys()) or [1, 2, 3, 4]
    facility_types = list(masters['facility_types'].keys()) or [1, 2, 3]
    items = list(masters['items'].keys()) or [1, 2, 3, 4, 5]
    business_categories = list(masters['business_categories'].keys()) or [1, 2]
    processing_methods = list(masters['processing_methods'].keys()) or [1, 2, 3]

    # 1. 事業者を生成
    print(f'事業者を{num_businesses}件生成中...')
    business_ids = []
    for i in range(num_businesses):
        name = generate_company_name()
        pref = random.choice(PREFECTURES)
        city = random.choice(CITIES)
        address = random.choice(ADDRESSES)

        cursor.execute('''
            INSERT INTO [事業者] (事業者名, 事業者区分, 郵便番号, 都道府県, 市区町村町名番地, 電話番号)
            VALUES (?, ?, ?, ?, ?, ?)
        ''', (
            name,
            random.choice(business_categories) if business_categories else None,
            random_zipcode(),
            pref,
            city + address,
            random_phone()
        ))

        cursor.execute('SELECT @@IDENTITY')
        business_id = cursor.fetchone()[0]
        business_ids.append(business_id)

    conn.commit()
    print(f'  事業者: {len(business_ids)}件作成\n')

    # 2. 許可を生成（各事業者に1〜3種類の許可区分、各区分に履歴2〜3件）
    print('許可を生成中...')
    permit_count = 0
    permit_logical_id = 1

    for biz_id in business_ids:
        # この事業者が持つ許可区分を決定（1〜3種類）
        num_categories = random.randint(1, min(3, len(permit_categories)))
        selected_categories = random.sample(permit_categories, num_categories)

        for cat_id in selected_categories:
            # 履歴数を決定（2〜3件）
            num_history = random.randint(2, 3)
            permit_number = generate_permit_number(cat_id, permit_logical_id)

            # 最初の許可日（古い順に生成）
            base_permit_date = random_date(2010, 2015)

            for hist_idx in range(num_history):
                # 許可日を生成（履歴ごとに5年ずつ進める）
                permit_date = base_permit_date + timedelta(days=365*5*hist_idx)
                # 有効期限は許可日から5年後
                valid_date = permit_date + timedelta(days=365*5)
                # 有効開始日時は許可日と同じ
                effective_start = permit_date

                # 最後の履歴以外は有効終了日時を設定（過去レコード）
                if hist_idx < num_history - 1:
                    # 次の許可の開始日の前日を有効終了日時とする
                    effective_end = base_permit_date + timedelta(days=365*5*(hist_idx+1) - 1)
                else:
                    effective_end = None  # 現在有効

                cursor.execute('''
                    INSERT INTO [許可] (許可論理ID, 事業者ID, 許可区分ID, 許可番号,
                        許可年月日, 許可有効年月日, 優良認定, 有効開始日時, 有効終了日時, 作成日時)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ''', (
                    permit_logical_id,
                    biz_id,
                    cat_id,
                    permit_number,
                    permit_date,
                    valid_date,
                    random.choice([True, False, False, False]),  # 25%の確率で優良認定
                    effective_start,
                    effective_end,
                    datetime.now()
                ))
                permit_count += 1

            permit_logical_id += 1

    conn.commit()
    print(f'  許可: {permit_count}件作成（論理ID: {permit_logical_id - 1}件）\n')

    # 3. 施設を生成（各事業者に3〜5件の施設、各施設に3〜4件の履歴）
    print('施設を生成中...')
    facility_count = 0
    facility_logical_id = 1

    for biz_id in business_ids:
        num_facilities = random.randint(3, 5)

        for i in range(num_facilities):
            pref = random.choice(PREFECTURES)
            city = random.choice(CITIES)
            address = random.choice(ADDRESSES)
            facility_type = random.choice(facility_types) if facility_types else None
            permit_no = random.randint(1000, 9999)
            base_permit_date = random_date(2010, 2015)
            base_setup_date = base_permit_date + timedelta(days=random.randint(30, 180))
            general_waste = random.choice([True, False])
            industrial_waste = random.choice([True, False])
            proc_method = random.choice(processing_methods) if processing_methods else None
            capacity = random.randint(100, 5000)
            area = random.randint(500, 10000)

            # 履歴数を決定（3〜4件）
            num_history = random.randint(3, 4)

            for hist_idx in range(num_history):
                # 履歴ごとに2年ずつ進める
                permit_date = base_permit_date + timedelta(days=730*hist_idx)
                setup_date = base_setup_date + timedelta(days=730*hist_idx)
                effective_start = setup_date

                # 最後の履歴以外は有効終了日時を設定（過去レコード）
                if hist_idx < num_history - 1:
                    effective_end = base_setup_date + timedelta(days=730*(hist_idx+1) - 1)
                else:
                    effective_end = None  # 現在有効

                cursor.execute('''
                    INSERT INTO [施設] (施設論理ID, 事業者ID, 表示順, 施設種別ID, 設置場所,
                        許可番号, 許可年月日, 設置年月日, 一般廃棄物取扱フラグ, 産業廃棄物取扱フラグ,
                        処理方法ID, 容量m3, 面積m2, 有効開始日時, 有効終了日時)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ''', (
                    facility_logical_id,
                    biz_id,
                    i + 1,
                    facility_type,
                    f'{pref}{city}{address}',
                    permit_no,
                    permit_date,
                    setup_date,
                    general_waste,
                    industrial_waste,
                    proc_method,
                    capacity,
                    area,
                    effective_start,
                    effective_end
                ))
                facility_count += 1

            facility_logical_id += 1

    conn.commit()
    print(f'  施設: {facility_count}件作成（論理ID: {facility_logical_id - 1}件）\n')

    # 3.5. 処理能力を生成（各施設レコード（履歴ごと）に3〜8品目の処理能力）
    print('処理能力を生成中...')
    capacity_count = 0

    # 施設ID（物理ID）の一覧を取得（履歴を含む全レコード）
    cursor.execute('SELECT 施設ID, 施設論理ID FROM [施設]')
    facility_records = [(row[0], row[1]) for row in cursor.fetchall()]

    for fac_id, fac_logical_id in facility_records:
        # この施設が処理する品目数を決定（3〜8品目）
        num_items = random.randint(3, min(8, len(items)))
        selected_items = random.sample(items, num_items)

        for item_id in selected_items:
            # 処理能力をランダムに生成
            hour_capacity = round(random.uniform(0.5, 10.0), 1)  # 0.5〜10.0
            hour_unit = random.choice([1, 2])  # 1: t/時間, 2: m3/時間

            day_capacity = round(random.uniform(5.0, 100.0), 1)  # 5.0〜100.0
            day_unit = random.choice([1, 2])  # 1: t/日, 2: m3/日

            operating_hours = random.choice([8, 10, 12, 16, 24])  # 稼働時間

            # 特記事項（30%の確率で設定）
            note = None
            if random.random() < 0.3:
                notes = ['破砕処理', '焼却処理', '圧縮処理', '選別処理', '中和処理', '脱水処理', '乾燥処理']
                note = random.choice(notes)

            cursor.execute('''
                INSERT INTO [処理能力] (施設ID, 施設論理ID, 品目ID, 時間処理能力, 時間処理能力単位ID,
                    日処理能力, 日処理能力単位ID, 稼働時間, 特記事項)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''', (
                fac_id,
                fac_logical_id,
                item_id,
                hour_capacity,
                hour_unit,
                day_capacity,
                day_unit,
                operating_hours,
                note
            ))
            capacity_count += 1

    conn.commit()
    print(f'  処理能力: {capacity_count}件作成\n')

    # 4. 役員を生成（各事業者に4〜8名）
    print('役員を生成中...')
    officer_count = 0

    for biz_id in business_ids:
        num_officers = random.randint(4, 8)
        used_roles = []

        for i in range(num_officers):
            # 代表取締役は1人だけ
            if i == 0:
                role = '代表取締役'
            else:
                available_roles = [r for r in ROLE_NAMES if r not in used_roles or r not in ['代表取締役']]
                role = random.choice(available_roles)
            used_roles.append(role)

            cursor.execute('''
                INSERT INTO [役員] (事業者ID, 役職名, 姓, 名, 退任フラグ)
                VALUES (?, ?, ?, ?, ?)
            ''', (
                biz_id,
                role,
                random.choice(LAST_NAMES),
                random.choice(FIRST_NAMES),
                False
            ))
            officer_count += 1

    conn.commit()
    print(f'  役員: {officer_count}件作成\n')

    # 5. 車両を生成（各事業者に10〜15台、半分が廃車）
    print('車両を生成中...')
    vehicle_count = 0
    scrapped_count = 0

    area_codes = ['品川', '練馬', '足立', '多摩', '横浜', '川崎', '大宮', '千葉', '名古屋', '大阪',
                  '札幌', '仙台', '神戸', '福岡', '広島', '京都', '堺', '湘南', '春日井', '岡崎']
    hiragana = ['あ', 'い', 'う', 'え', 'か', 'き', 'く', 'け', 'さ', 'す', 'せ', 'そ', 'た', 'ち', 'つ']

    for biz_id in business_ids:
        num_vehicles = random.randint(10, 15)

        for i in range(num_vehicles):
            # 半分を廃車にする
            is_scrapped = (i < num_vehicles // 2)
            if is_scrapped:
                scrapped_count += 1

            cursor.execute('''
                INSERT INTO [車両] (事業者ID, 登録番号1, 登録番号2, 登録番号3, 登録番号4, 廃車フラグ, 許可区分ID)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            ''', (
                biz_id,
                random.choice(area_codes),
                str(random.randint(100, 999)),
                random.choice(hiragana),
                str(random.randint(1, 9999)).zfill(4),
                is_scrapped,
                None  # 許可区分IDは使用しない
            ))
            vehicle_count += 1

    conn.commit()
    print(f'  車両: {vehicle_count}件作成（うち廃車: {scrapped_count}件）\n')

    # 6. 許可品目を生成（各許可に品目を関連付け）
    print('許可品目を生成中...')
    permit_item_count = 0

    # 許可IDの一覧を取得（最新の許可のみ = 有効終了日時がNULL）
    cursor.execute('SELECT 許可ID FROM [許可] WHERE 有効終了日時 IS NULL')
    current_permit_ids = [row[0] for row in cursor.fetchall()]

    for permit_id in current_permit_ids:
        # この許可が取り扱う品目数を決定（3〜10品目）
        num_items = random.randint(3, min(10, len(items)))
        selected_items = random.sample(items, num_items)

        for item_id in selected_items:
            # 取り扱いフラグは必ずTrue（品目として登録するから）
            handling_flag = True
            # 積替保管フラグは30%の確率でTrue
            transfer_flag = random.random() < 0.3

            cursor.execute('''
                INSERT INTO [許可品目] (許可ID, 品目ID, 取り扱いフラグ, 積替保管フラグ)
                VALUES (?, ?, ?, ?)
            ''', (
                permit_id,
                item_id,
                handling_flag,
                transfer_flag
            ))
            permit_item_count += 1

    conn.commit()
    print(f'  許可品目: {permit_item_count}件作成\n')

    print('=' * 50)
    print('ダミーデータ生成完了')
    print(f'  事業者: {len(business_ids)}件')
    print(f'  許可: {permit_count}件')
    print(f'  施設: {facility_count}件')
    print(f'  処理能力: {capacity_count}件')
    print(f'  役員: {officer_count}件')
    print(f'  車両: {vehicle_count}件（うち廃車: {scrapped_count}件）')
    print(f'  許可品目: {permit_item_count}件')
    print('=' * 50)

# --- メイン ---
def main():
    print('廃棄物処理業許可管理システム ダミーデータ生成')
    print('=' * 50)
    print(f'データベース: {DB_PATH}')
    print()

    if not os.path.exists(DB_PATH):
        print(f'エラー: データベースファイルが見つかりません')
        return

    try:
        conn = get_connection()
        print('データベース接続成功\n')

        # 既存データを削除
        clear_data(conn)

        # ダミーデータを生成
        generate_data(conn, num_businesses=50)

        conn.close()
        print('\n処理完了')

    except Exception as e:
        print(f'エラー: {e}')
        import traceback
        traceback.print_exc()

if __name__ == '__main__':
    main()

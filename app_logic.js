/**
 * 廃棄物処理業許可管理システム - 共通ロジック
 * HTA (app_source.hta) と テスト (Jest) の両方から使用される
 */
(function(global) {
    "use strict";

    // ===== 定数 =====

    /** 品目IDの境界値: この値未満=普通産廃、この値以上=特管産廃 */
    var ITEM_SPECIAL_THRESHOLD = 100;

    /** 施設種別ID: 中間処理施設 */
    var FACILITY_TYPE_PROCESSING = 1;
    /** 施設種別ID: 最終処分場 */
    var FACILITY_TYPE_LANDFILL = 2;
    /** 施設種別ID: 積替保管施設 */
    var FACILITY_TYPE_STORAGE = 3;

    /** 廃棄物種類区分ID: 特別管理産業廃棄物 */
    var WASTE_TYPE_SPECIAL = 2;

    /** 役職名の表示順（企業階層順） */
    var OFFICER_POSITIONS = ['代表取締役', '専務取締役', '常務取締役', '取締役', '監査役', '部長', '課長', 'その他'];

    // ===== ユーティリティ関数 =====

    function escapeHtml(str) {
        if (str === null || str === undefined || str === "") return "";
        return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
    }

    function escapeSql(str) {
        if (!str) return "";
        return String(str).replace(/'/g, "''");
    }

    /**
     * 数値をSQL用に変換（null/undefined/空文字列 → "NULL"、0を含む数値 → そのまま）
     */
    function numOrNull(val) {
        if (val === null || val === undefined || val === "") return "NULL";
        return val;
    }

    function padZero(num) {
        return (num < 10 ? "0" : "") + num;
    }

    function padZero2(n) {
        return (n < 10 ? "0" : "") + n;
    }

    function formatDate(dt) {
        if (!dt) return "";
        try {
            var d;
            if (typeof dt === "object" && dt.getVarDate) {
                // VBDate (ADODBから取得した日付)
                d = new Date(dt.getVarDate());
            } else if (typeof dt === "object" && dt instanceof Date) {
                d = dt;
            } else {
                // 文字列または数値
                d = new Date(dt);
            }
            if (isNaN(d.getTime())) return "";
            return d.getFullYear() + "/" + padZero(d.getMonth() + 1) + "/" + padZero(d.getDate());
        } catch (e) { return ""; }
    }

    function getMasterConfig(type) {
        var configs = {
            "許可区分": {
                table: "マスター_許可区分", idCol: "許可区分ID", nameCol: "許可区分名", title: "許可区分",
                fkCol: {
                    col: "廃棄物種類区分ID",
                    refTable: "マスター_廃棄物種類区分",
                    refIdCol: "廃棄物種類区分ID",
                    refNameCol: "廃棄物種類名",
                    label: "廃棄物種類区分"
                }
            },
            "施設種別": { table: "マスター_施設種別", idCol: "施設種別ID", nameCol: "施設種別名", title: "施設種別" },
            "品目": { table: "マスター_品目", idCol: "品目ID", nameCol: "品目名", title: "品目", extraCol: "表示順" },
            "処理方法": { table: "マスター_処理方法", idCol: "処理方法ID", nameCol: "処理方法名", title: "処理方法" },
            "廃棄物種類区分": { table: "マスター_廃棄物種類区分", idCol: "廃棄物種類区分ID", nameCol: "廃棄物種類名", title: "廃棄物種類区分" },
            "事業者区分": { table: "マスター_事業者区分", idCol: "事業者区分ID", nameCol: "事業者区分名", title: "事業者区分" },
            "取扱区分": { table: "マスター_取扱区分", idCol: "取扱区分ID", nameCol: "取扱区分記号", title: "取扱区分" },
            "形式": { table: "マスター_形式", idCol: "形式ID", nameCol: "形式名", title: "形式" },
            "日処理能力単位": { table: "マスター_日処理能力単位", idCol: "日処理能力単位ID", nameCol: "日処理能力単位名", title: "日処理能力単位" },
            "時間処理能力単位": { table: "マスター_時間処理能力単位", idCol: "時間処理能力単位ID", nameCol: "時間処理能力単位名", title: "時間処理能力単位" },
            "管理区分": { table: "マスター_管理区分", idCol: "管理区分ID", nameCol: "管理区分名", title: "管理区分" },
            "設置形態区分": { table: "マスター_設置形態区分", idCol: "設置形態区分ID", nameCol: "設置形態区分名", title: "設置形態区分" },
            "許可対象区分": { table: "マスター_許可対象区分", idCol: "許可対象区分ID", nameCol: "許可対象区分名", title: "許可対象区分" },
            "許可番号形式": { table: "マスター_許可番号形式", idCol: "許可番号形式ID", nameCol: "許可番号形式名", title: "許可番号形式", extraCol: "説明" },
            "認定区分": { table: "マスター_認定区分", idCol: "認定ID", nameCol: "認定名", title: "認定区分" },
            "役職": { table: "マスター_役職", idCol: "役職ID", nameCol: "役職名", title: "役職" }
        };
        return configs[type];
    }

    // ===== SQLビルダー関数 =====

    /**
     * 事業者検索クエリを構築
     * @param {string} keyword - 検索キーワード
     * @returns {string} SQL文
     */
    function buildSearchBusinessQuery(keyword) {
        var kw = escapeSql(keyword);
        var sql = "事業者ID, 事業者名, 郵便番号, 都道府県, 市区町村町名番地, 電話番号 FROM 事業者";
        sql = "SELECT " + sql;
        sql += " WHERE 事業者名 LIKE '%" + kw + "%'";
        sql += " OR 電話番号 LIKE '%" + kw + "%'";
        sql += " OR 市区町村町名番地 LIKE '%" + kw + "%'";
        sql += " ORDER BY 事業者ID";
        return sql;
    }

    /**
     * 許可検索クエリを構築
     * @param {object} params - 検索パラメータ
     * @param {string} [params.keyword] - キーワード
     * @param {string} [params.categoryId] - 許可区分ID
     * @param {string} [params.expiry] - 期限フィルタ (expired/30days/90days/1year/valid)
     * @param {string} [params.status] - 状態フィルタ (active/abolished/cancelled)
     * @param {boolean} [params.excellentOnly] - 優良認定のみ
     * @param {Array<string>} [params.selectedItemIds] - 選択品目ID配列
     * @param {string} [params.itemMode] - 品目検索モード (AND/OR)
     * @param {string} params.asOfDateSql - Access日付形式の基準日 (例: "#2026/02/28 23:59:59#")
     * @returns {string} SQL文
     */
    function buildSearchPermitQuery(params) {
        var keyword = params.keyword || "";
        var categoryId = params.categoryId || "";
        var expiry = params.expiry || "";
        var status = params.status || "";
        var excellentOnly = params.excellentOnly || false;
        var selectedItemIds = params.selectedItemIds || [];
        var itemMode = params.itemMode || "OR";
        var asOfDateSql = params.asOfDateSql;

        // 廃止・取消された許可は有効終了日時が過去に設定されるため、
        // status が abolished/cancelled の場合は有効終了日時のフィルタを緩和する
        var historyCondition;
        if (status === "abolished" || status === "cancelled") {
            historyCondition = "許可.有効開始日時 <= " + asOfDateSql;
        } else {
            historyCondition = "許可.有効開始日時 <= " + asOfDateSql + " AND (許可.有効終了日時 IS NULL OR 許可.有効終了日時 > " + asOfDateSql + ")";
        }

        var sql;
        if (selectedItemIds.length > 0 && itemMode === "AND") {
            // AND検索: すべての品目を含む許可を検索
            sql = "SELECT 許可.許可ID, 許可.許可論理ID, 許可.許可番号, 許可.許可区分ID, ";
            sql += "許可.優良認定, ";
            sql += "Format(許可.許可年月日, 'yyyy/mm/dd') AS 許可日, ";
            sql += "Format(許可.許可有効年月日, 'yyyy/mm/dd') AS 有効期限, ";
            sql += "許可.許可有効年月日, ";
            sql += "Format(許可.廃止日, 'yyyy/mm/dd') AS 廃止日文字列, ";
            sql += "Format(許可.取消日, 'yyyy/mm/dd') AS 取消日文字列, ";
            sql += "事業者.事業者ID, 事業者.事業者名, マスター_許可区分.許可区分名 ";
            sql += "FROM ((許可 LEFT JOIN 事業者 ON 許可.事業者ID = 事業者.事業者ID) ";
            sql += "LEFT JOIN マスター_許可区分 ON 許可.許可区分ID = マスター_許可区分.許可区分ID) ";
            sql += "WHERE " + historyCondition;
            for (var j = 0; j < selectedItemIds.length; j++) {
                sql += " AND EXISTS (SELECT 1 FROM 許可品目 WHERE 許可品目.許可ID = 許可.許可ID AND 許可品目.品目ID = " + selectedItemIds[j] + " AND 許可品目.取り扱いフラグ = True)";
            }
        } else {
            // OR検索または品目指定なし
            sql = "SELECT DISTINCT 許可.許可ID, 許可.許可論理ID, 許可.許可番号, 許可.許可区分ID, ";
            sql += "許可.優良認定, ";
            sql += "Format(許可.許可年月日, 'yyyy/mm/dd') AS 許可日, ";
            sql += "Format(許可.許可有効年月日, 'yyyy/mm/dd') AS 有効期限, ";
            sql += "許可.許可有効年月日, ";
            sql += "Format(許可.廃止日, 'yyyy/mm/dd') AS 廃止日文字列, ";
            sql += "Format(許可.取消日, 'yyyy/mm/dd') AS 取消日文字列, ";
            sql += "事業者.事業者ID, 事業者.事業者名, マスター_許可区分.許可区分名 ";
            sql += "FROM ((許可 LEFT JOIN 事業者 ON 許可.事業者ID = 事業者.事業者ID) ";
            sql += "LEFT JOIN マスター_許可区分 ON 許可.許可区分ID = マスター_許可区分.許可区分ID) ";
            if (selectedItemIds.length > 0) {
                sql += "INNER JOIN 許可品目 ON 許可.許可ID = 許可品目.許可ID ";
            }
            sql += "WHERE " + historyCondition;
            if (selectedItemIds.length > 0) {
                sql += " AND 許可品目.品目ID IN (" + selectedItemIds.join(",") + ") AND 許可品目.取り扱いフラグ = True";
            }
        }

        // キーワード検索
        if (keyword) {
            sql += " AND (許可.許可番号 LIKE '%" + escapeSql(keyword) + "%' OR 事業者.事業者名 LIKE '%" + escapeSql(keyword) + "%')";
        }
        // 許可区分
        if (categoryId) {
            sql += " AND 許可.許可区分ID = " + categoryId;
        }
        // 有効期限
        var baseDate = asOfDateSql;
        if (expiry === "expired") {
            sql += " AND 許可.許可有効年月日 < " + baseDate;
        } else if (expiry === "30days") {
            sql += " AND 許可.許可有効年月日 BETWEEN " + baseDate + " AND DateAdd('d', 30, " + baseDate + ")";
        } else if (expiry === "90days") {
            sql += " AND 許可.許可有効年月日 BETWEEN " + baseDate + " AND DateAdd('d', 90, " + baseDate + ")";
        } else if (expiry === "1year") {
            sql += " AND 許可.許可有効年月日 BETWEEN " + baseDate + " AND DateAdd('yyyy', 1, " + baseDate + ")";
        } else if (expiry === "valid") {
            sql += " AND 許可.許可有効年月日 >= " + baseDate;
        }
        // 状態
        if (status === "active") {
            sql += " AND (許可.廃止日 IS NULL AND 許可.取消日 IS NULL)";
        } else if (status === "abolished") {
            sql += " AND 許可.廃止日 IS NOT NULL";
        } else if (status === "cancelled") {
            sql += " AND 許可.取消日 IS NOT NULL";
        }
        // 優良認定
        if (excellentOnly) {
            sql += " AND 許可.優良認定 = True";
        }

        sql += " ORDER BY 許可.許可ID DESC";
        return sql;
    }

    /**
     * 施設検索クエリを構築
     * @param {string} keyword - 検索キーワード
     * @param {string} typeId - 施設種別ID
     * @returns {string} SQL文
     */
    function buildSearchFacilityQuery(keyword, typeId, includeAbolished, status, options) {
        options = options || {};
        var sql = "SELECT 施設.施設ID, 施設.施設論理ID, 施設.設置場所, 施設.許可番号, 施設.施設種別ID, 施設.廃止年月日, ";
        sql += "事業者.事業者ID, 事業者.事業者名, マスター_施設種別.施設種別名";
        // 処理方法名を結合
        sql += ", マスター_処理方法.処理方法名";
        sql += " FROM ((施設 LEFT JOIN 事業者 ON 施設.事業者ID = 事業者.事業者ID) ";
        sql += "LEFT JOIN マスター_施設種別 ON 施設.施設種別ID = マスター_施設種別.施設種別ID) ";
        sql += "LEFT JOIN マスター_処理方法 ON 施設.処理方法ID = マスター_処理方法.処理方法ID";
        // 処理能力のJOIN（日処理能力フィルタ or 品目フィルタ用）
        if (options.minDayCapacity || (options.itemIds && options.itemIds.length > 0)) {
            sql += " INNER JOIN 処理能力 ON 施設.施設ID = 処理能力.施設ID";
        }
        // 廃止・取消された施設は有効終了日時が設定されるため、
        // status が abolished の場合や includeAbolished の場合は有効終了日時フィルタを緩和する
        if (status === "abolished") {
            sql += " WHERE 施設.廃止年月日 IS NOT NULL";
        } else if (status === "cancelled") {
            sql += " WHERE 施設.取消年月日 IS NOT NULL";
        } else if (includeAbolished) {
            sql += " WHERE (施設.有効終了日時 IS NULL OR 施設.廃止年月日 IS NOT NULL OR 施設.取消年月日 IS NOT NULL)";
        } else {
            sql += " WHERE 施設.有効終了日時 IS NULL AND 施設.廃止年月日 IS NULL";
        }
        if (keyword) {
            sql += " AND (施設.設置場所 LIKE '%" + escapeSql(keyword) + "%' OR 施設.許可番号 LIKE '%" + escapeSql(keyword) + "%' OR 事業者.事業者名 LIKE '%" + escapeSql(keyword) + "%')";
        }
        if (typeId) {
            sql += " AND 施設.施設種別ID = " + typeId;
        }
        // 処理方法フィルタ
        if (options.processingMethodId) {
            sql += " AND 施設.処理方法ID = " + parseInt(options.processingMethodId);
        }
        // 許可対象区分フィルタ
        if (options.permitTargetId) {
            sql += " AND 施設.許可対象区分ID = " + parseInt(options.permitTargetId);
        }
        // 自己処理除外（許可対象区分ID=2が自己処理と仮定、マスター依存）
        if (options.excludeSelf) {
            sql += " AND (施設.許可対象区分ID IS NULL OR 施設.許可対象区分ID <> 2)";
        }
        // 日処理能力フィルタ
        if (options.minDayCapacity) {
            sql += " AND 処理能力.日処理能力 >= " + parseFloat(options.minDayCapacity);
        }
        // 品目フィルタ（複数品目: AND/OR切替対応）
        if (options.itemIds && options.itemIds.length > 0) {
            var ids = [];
            for (var ii = 0; ii < options.itemIds.length; ii++) {
                ids.push(parseInt(options.itemIds[ii]));
            }
            sql += " AND 処理能力.品目ID IN (" + ids.join(",") + ")";
            // GROUP BY で重複排除（INNER JOINにより複数行になる）
            sql += " GROUP BY 施設.施設ID, 施設.施設論理ID, 施設.設置場所, 施設.許可番号, 施設.施設種別ID, 施設.廃止年月日, 事業者.事業者ID, 事業者.事業者名, マスター_施設種別.施設種別名, マスター_処理方法.処理方法名";
            if (options.itemMatchMode === "and") {
                // AND: 全品目を扱える施設（HAVING COUNT(DISTINCT) = 品目数）
                sql += " HAVING COUNT(DISTINCT 処理能力.品目ID) = " + ids.length;
            }
        }
        sql += " ORDER BY 施設.施設ID DESC";
        return sql;
    }

    /**
     * 車両検索クエリを構築
     * @param {string} keyword - 検索キーワード
     * @param {boolean} includeScrapped - 廃車を含むか
     * @returns {string} SQL文
     */
    function buildSearchVehicleQuery(keyword, includeScrapped) {
        var kw = escapeSql(keyword);
        var sql = "SELECT 車両.車両ID, 車両.登録番号1, 車両.登録番号2, 車両.登録番号3, 車両.登録番号4, 車両.廃車フラグ, ";
        sql += "事業者.事業者ID, 事業者.事業者名 ";
        sql += "FROM 車両 LEFT JOIN 事業者 ON 車両.事業者ID = 事業者.事業者ID ";
        sql += "WHERE (車両.登録番号1 LIKE '%" + kw + "%' OR 車両.登録番号2 LIKE '%" + kw + "%' OR 車両.登録番号3 LIKE '%" + kw + "%' OR 車両.登録番号4 LIKE '%" + kw + "%' OR 事業者.事業者名 LIKE '%" + kw + "%')";
        if (!includeScrapped) {
            sql += " AND (車両.廃車フラグ = False OR 車両.廃車フラグ IS NULL)";
        }
        sql += " ORDER BY 車両.車両ID DESC";
        return sql;
    }

    /**
     * 役員検索クエリを構築
     * @param {string} keyword - 検索キーワード
     * @param {boolean} includeRetired - 退任者を含むか
     * @returns {string} SQL文
     */
    function buildSearchOfficerQuery(keyword, includeRetired) {
        var kw = escapeSql(keyword);
        var sql = "SELECT 役員.役員ID, 役員.姓, 役員.名, 役員.役職名, 役員.退任フラグ, ";
        sql += "事業者.事業者ID, 事業者.事業者名 ";
        sql += "FROM 役員 LEFT JOIN 事業者 ON 役員.事業者ID = 事業者.事業者ID ";
        sql += "WHERE (役員.姓 LIKE '%" + kw + "%' OR 役員.名 LIKE '%" + kw + "%' OR 役員.役職名 LIKE '%" + kw + "%' OR 事業者.事業者名 LIKE '%" + kw + "%')";
        if (!includeRetired) {
            sql += " AND (役員.退任フラグ = False OR 役員.退任フラグ IS NULL)";
        }
        sql += " ORDER BY 役員.役員ID DESC";
        return sql;
    }

    /**
     * 事業者別許可一覧クエリを構築
     * @param {number} businessId - 事業者ID
     * @returns {string} SQL文
     */
    function buildLoadPermitsQuery(businessId) {
        var sql = "SELECT 許可.許可ID, 許可.許可論理ID, 許可.許可区分ID, 許可.許可番号, 許可.優良認定, ";
        sql += "Format(許可.許可年月日, 'yyyy/mm/dd') AS 許可日文字列, ";
        sql += "Format(許可.許可有効年月日, 'yyyy/mm/dd') AS 有効期限文字列, ";
        sql += "Format(許可.有効開始日時, 'yyyy/mm/dd') AS 有効開始文字列, ";
        sql += "Format(許可.取消日, 'yyyy/mm/dd') AS 取消日文字列, ";
        sql += "Format(許可.廃止日, 'yyyy/mm/dd') AS 廃止日文字列, ";
        sql += "マスター_許可区分.許可区分名 ";
        sql += "FROM 許可 LEFT JOIN マスター_許可区分 ON 許可.許可区分ID = マスター_許可区分.許可区分ID ";
        sql += "WHERE 許可.事業者ID = " + businessId + " ";
        sql += "ORDER BY 許可.許可区分ID, 許可.有効開始日時 DESC";
        return sql;
    }

    /**
     * 統計クエリ群を構築
     * @returns {object} 各統計クエリをキーで返す
     */
    function buildStatisticsQueries() {
        return {
            businessCount: "SELECT COUNT(*) AS cnt FROM [事業者]",
            permitCount: "SELECT COUNT(*) AS cnt FROM [許可] WHERE [有効終了日時] IS NULL AND [廃止日] IS NULL AND [取消日] IS NULL",
            facilityCount: "SELECT COUNT(*) AS cnt FROM [施設] WHERE [有効終了日時] IS NULL AND [廃止年月日] IS NULL",
            expiringCount: "SELECT COUNT(*) AS cnt FROM [許可] WHERE [有効終了日時] IS NULL AND [廃止日] IS NULL AND [取消日] IS NULL AND [許可有効年月日] IS NOT NULL"
        };
    }

    // ===== バリデーション関数 =====

    /**
     * 必須フィールドチェック
     * @param {*} value - 検証する値
     * @param {string} fieldName - フィールド名（エラーメッセージ用）
     * @returns {string|null} エラーメッセージ（問題なければnull）
     */
    function validateRequired(value, fieldName) {
        if (value === null || value === undefined || String(value).trim() === "") {
            return fieldName + "は必須です";
        }
        return null;
    }

    /**
     * 日付フォーマットチェック（yyyy/mm/dd）
     * @param {string} dateStr - 日付文字列
     * @returns {string|null} エラーメッセージ（問題なければnull）
     */
    function validateDateFormat(dateStr) {
        if (!dateStr) return null; // optional
        if (!/^\d{4}\/\d{2}\/\d{2}$/.test(dateStr)) {
            return "日付はyyyy/mm/dd形式で入力してください: " + dateStr;
        }
        var parts = dateStr.split("/");
        var y = parseInt(parts[0], 10), m = parseInt(parts[1], 10), day = parseInt(parts[2], 10);
        var d = new Date(y, m - 1, day);
        if (isNaN(d.getTime()) || d.getFullYear() !== y || d.getMonth() + 1 !== m || d.getDate() !== day) {
            return "無効な日付です: " + dateStr;
        }
        return null;
    }

    /**
     * 日付順序チェック（開始 <= 終了）
     * @param {string} startDate - 開始日（yyyy/mm/dd）
     * @param {string} endDate - 終了日（yyyy/mm/dd）
     * @param {string} startLabel - 開始日ラベル
     * @param {string} endLabel - 終了日ラベル
     * @returns {string|null} エラーメッセージ
     */
    function validateDateOrder(startDate, endDate, startLabel, endLabel) {
        if (!startDate || !endDate) return null;
        if (startDate > endDate) {
            return startLabel + "(" + startDate + ")は" + endLabel + "(" + endDate + ")以前でなければなりません";
        }
        return null;
    }

    /**
     * 許可更新/変更時の日付順序バリデーション
     * 新許可年月日が旧版の有効期限と整合するかチェック
     * @param {string} newPermitDate - 新許可年月日（yyyy/mm/dd）
     * @param {string} prevValidDate - 旧版の許可有効年月日（yyyy/mm/dd）
     * @param {string} mode - "renewal"|"change"|"expiredNew"
     * @returns {string|null} エラーメッセージ
     */
    function validateRenewalDateOrder(newPermitDate, prevValidDate, mode) {
        if (!newPermitDate || !prevValidDate) return null;
        if (mode === "expiredNew") return null;  // 失効新規は日付逆転を許容
        if (newPermitDate < prevValidDate) return null;  // 旧版有効期限内なら問題なし
        return null;  // バリデーションは通す（タイムライン上の警告で対応）
    }

    /**
     * 非負数チェック
     * @param {number} value - 検証する値
     * @param {string} fieldName - フィールド名
     * @returns {string|null} エラーメッセージ
     */
    function validateNonNegative(value, fieldName) {
        if (value !== null && value !== undefined && value < 0) {
            return fieldName + "は0以上でなければなりません";
        }
        return null;
    }

    /**
     * 事業者データバリデーション
     */
    function validateBusinessData(data) {
        var errors = [];
        var e = validateRequired(data.name, "事業者名");
        if (e) errors.push(e);
        return errors;
    }

    /**
     * 許可データバリデーション
     */
    function validatePermitData(data) {
        var errors = [];
        var e;
        e = validateRequired(data.number, "許可番号"); if (e) errors.push(e);
        e = validateDateFormat(data.permitDate);        if (e) errors.push(e);
        e = validateDateFormat(data.validDate);          if (e) errors.push(e);
        e = validateDateOrder(data.permitDate, data.validDate, "許可年月日", "許可有効年月日");
        if (e) errors.push(e);
        return errors;
    }

    /**
     * 車両データバリデーション
     */
    function validateVehicleData(data) {
        var errors = [];
        var e;
        e = validateRequired(data.reg1, "登録番号1"); if (e) errors.push(e);
        e = validateRequired(data.reg4, "登録番号4"); if (e) errors.push(e);
        return errors;
    }

    /**
     * 役員データバリデーション
     */
    function validateOfficerData(data) {
        var errors = [];
        var e;
        e = validateRequired(data.lastName, "姓");    if (e) errors.push(e);
        e = validateRequired(data.firstName, "名");   if (e) errors.push(e);
        e = validateRequired(data.position, "役職名"); if (e) errors.push(e);
        return errors;
    }

    /**
     * 施設データバリデーション
     */
    function validateFacilityData(data) {
        var errors = [];
        var e;
        e = validateRequired(data.location, "設置場所"); if (e) errors.push(e);
        e = validateDateFormat(data.permitDate);          if (e) errors.push(e);
        e = validateDateFormat(data.setupDate);           if (e) errors.push(e);
        return errors;
    }

    /**
     * 処理能力データバリデーション
     */
    function validateCapacityData(data) {
        var errors = [];
        var e;
        e = validateNonNegative(data.hourCap, "時間処理能力"); if (e) errors.push(e);
        e = validateNonNegative(data.dayCap, "日処理能力");     if (e) errors.push(e);
        e = validateNonNegative(data.hours, "稼働時間");        if (e) errors.push(e);
        return errors;
    }

    /**
     * 廃止日バリデーション（必須+フォーマット+未来1年超チェック）
     */
    function validateAbolishDate(dateStr, startDateStr) {
        var errors = [];
        var e;
        e = validateRequired(dateStr, "廃止日"); if (e) { errors.push(e); return errors; }
        e = validateDateFormat(dateStr);          if (e) { errors.push(e); return errors; }
        var parts = dateStr.split("/");
        var abolishDate = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
        var oneYearLater = new Date();
        oneYearLater.setFullYear(oneYearLater.getFullYear() + 1);
        if (abolishDate > oneYearLater) {
            errors.push("廃止日が1年以上先の日付です: " + dateStr);
        }
        if (startDateStr) {
            var sp = startDateStr.split("/");
            var startDate = new Date(parseInt(sp[0], 10), parseInt(sp[1], 10) - 1, parseInt(sp[2], 10));
            if (abolishDate < startDate) {
                errors.push("廃止日(" + dateStr + ")は有効開始日(" + startDateStr + ")以降でなければなりません");
            }
        }
        return errors;
    }

    /**
     * 取消日バリデーション（必須+フォーマット+未来1年超チェック+有効期間チェック）
     */
    function validateCancelDate(dateStr, startDateStr) {
        var errors = [];
        var e;
        e = validateRequired(dateStr, "取消日"); if (e) { errors.push(e); return errors; }
        e = validateDateFormat(dateStr);          if (e) { errors.push(e); return errors; }
        var parts = dateStr.split("/");
        var cancelDate = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
        var oneYearLater = new Date();
        oneYearLater.setFullYear(oneYearLater.getFullYear() + 1);
        if (cancelDate > oneYearLater) {
            errors.push("取消日が1年以上先の日付です: " + dateStr);
        }
        if (startDateStr) {
            var sp = startDateStr.split("/");
            var startDate = new Date(parseInt(sp[0], 10), parseInt(sp[1], 10) - 1, parseInt(sp[2], 10));
            if (cancelDate < startDate) {
                errors.push("取消日(" + dateStr + ")は有効開始日(" + startDateStr + ")以降でなければなりません");
            }
        }
        return errors;
    }

    // ===== CRUD系 SQLビルダー関数 =====

    /**
     * 日付文字列を生成（Access形式: yyyy/mm/dd）
     * @param {Date} [dt] - 日付（省略時は現在日時）
     * @returns {string} yyyy/mm/dd形式の文字列
     */
    function buildDateStr(dt) {
        var d = dt || new Date();
        return d.getFullYear() + "/" + padZero(d.getMonth() + 1) + "/" + padZero(d.getDate());
    }

    /**
     * 事業者保存クエリを構築
     * @param {object} data - 事業者データ
     * @param {number} data.id - 事業者ID（0なら新規）
     * @param {string} data.name - 事業者名
     * @param {string} [data.businessType] - 事業者区分
     * @param {string} [data.zipCode] - 郵便番号
     * @param {string} [data.pref] - 都道府県
     * @param {string} [data.address] - 市区町村町名番地
     * @param {string} [data.phone] - 電話番号
     * @returns {string} SQL文
     */
    function buildSaveBusinessQuery(data) {
        var sql;
        var bt = numOrNull(data.businessType);
        if (data.id > 0) {
            sql = "UPDATE 事業者 SET ";
            sql += "事業者名 = '" + escapeSql(data.name) + "', ";
            sql += "事業者区分 = " + bt + ", ";
            sql += "郵便番号 = '" + escapeSql(data.zipCode || "") + "', ";
            sql += "都道府県 = '" + escapeSql(data.pref || "") + "', ";
            sql += "市区町村町名番地 = '" + escapeSql(data.address || "") + "', ";
            sql += "電話番号 = '" + escapeSql(data.phone || "") + "' ";
            sql += "WHERE 事業者ID = " + data.id;
        } else {
            sql = "INSERT INTO 事業者 (事業者名, 事業者区分, 郵便番号, 都道府県, 市区町村町名番地, 電話番号) VALUES (";
            sql += "'" + escapeSql(data.name) + "', ";
            sql += bt + ", ";
            sql += "'" + escapeSql(data.zipCode || "") + "', ";
            sql += "'" + escapeSql(data.pref || "") + "', ";
            sql += "'" + escapeSql(data.address || "") + "', ";
            sql += "'" + escapeSql(data.phone || "") + "')";
        }
        return sql;
    }

    /**
     * 事業者削除クエリを構築（単一テーブル - 後方互換性のため維持）
     */
    function buildDeleteBusinessQuery(id) {
        return "DELETE FROM 事業者 WHERE 事業者ID = " + id;
    }

    /**
     * 事業者削除クエリ群を構築（カスケード削除）
     * 関連テーブルを正しい依存順序で削除する
     * @param {number} id - 事業者ID
     * @returns {Array<string>} SQL文の配列（順番に実行すること）
     */
    function buildDeleteBusinessQueries(id) {
        return [
            // 許可品目（許可に依存）
            "DELETE FROM 許可品目 WHERE 許可ID IN (SELECT 許可ID FROM 許可 WHERE 事業者ID = " + id + ")",
            // 施設休止履歴（施設に依存）
            "DELETE FROM 施設休止履歴 WHERE 施設ID IN (SELECT 施設ID FROM 施設 WHERE 事業者ID = " + id + ")",
            // 処理能力（施設に依存）
            "DELETE FROM 処理能力 WHERE 施設ID IN (SELECT 施設ID FROM 施設 WHERE 事業者ID = " + id + ")",
            // 許可
            "DELETE FROM 許可 WHERE 事業者ID = " + id,
            // 施設
            "DELETE FROM 施設 WHERE 事業者ID = " + id,
            // 車両
            "DELETE FROM 車両 WHERE 事業者ID = " + id,
            // 役員
            "DELETE FROM 役員 WHERE 事業者ID = " + id,
            // 事業者本体
            "DELETE FROM 事業者 WHERE 事業者ID = " + id
        ];
    }

    /**
     * 許可保存（新規）クエリを構築
     * @param {object} data
     * @param {number} data.logicalId - 論理ID
     * @param {number} data.businessId - 事業者ID
     * @param {number} data.categoryId - 許可区分ID
     * @param {string} data.number - 許可番号
     * @param {string} data.permitDate - 許可年月日
     * @param {string} data.validDate - 許可有効年月日
     * @param {boolean} data.excellent - 優良認定
     * @param {string} data.todayStr - 今日の日付文字列
     * @param {boolean} [data.isExpiredNew] - 失効新規フラグ
     * @param {string} [data.endDate] - 有効終了日時（業許可: 許可有効年月日、施設: NULL）
     * @returns {string} SQL文
     */
    function buildSavePermitQuery(data) {
        var cols = ["許可論理ID", "事業者ID", "許可区分ID", "許可番号"];
        var vals = [data.logicalId, data.businessId, data.categoryId, "'" + escapeSql(data.number) + "'"];

        if (data.permitDate) {
            cols.push("許可年月日");
            vals.push("#" + data.permitDate + "#");
        }
        if (data.validDate) {
            cols.push("許可有効年月日");
            vals.push("#" + data.validDate + "#");
        }

        cols.push("優良認定");
        vals.push(data.excellent ? "True" : "False");

        cols.push("有効開始日時");
        vals.push("#" + (data.startDate || data.permitDate || data.todayStr) + "#");

        // 有効終了日時: 業許可は許可有効年月日、施設はNULL
        if (data.endDate) {
            cols.push("有効終了日時");
            vals.push("#" + data.endDate + "#");
        }

        cols.push("変更許可フラグ");
        vals.push(data.isChange ? "True" : "False");

        cols.push("失効新規フラグ");
        vals.push(data.isExpiredNew ? "True" : "False");

        cols.push("作成日時");
        vals.push("#" + data.todayStr + "#");

        var sql = "INSERT INTO 許可 (" + cols.join(", ") + ") VALUES (" + vals.join(", ") + ")";
        return sql;
    }

    /**
     * 同じ論理IDの旧バージョンをクローズするクエリを構築
     * lifecycle spec方式: 有効終了日時 = 新許可の許可年月日の前日
     * （旧許可自身の有効期限ではなく、新許可の発効日の前日で閉じる）
     * @param {number} logicalId - 許可論理ID
     * @param {string} newPermitDate - 新許可の許可年月日（yyyy/mm/dd）
     * @returns {string} SQL文
     */
    function buildCloseOldPermitVersionsQuery(logicalId, newPermitDate) {
        return "UPDATE 許可 SET 有効終了日時 = DateAdd('d', -1, #" + newPermitDate + "#) WHERE 許可論理ID = " + logicalId + " AND 有効終了日時 IS NULL";
    }

    /**
     * 旧バージョンを指定日でクローズするクエリを構築
     * @param {number} logicalId - 許可論理ID
     * @param {string} closeDate - クローズ日 (yyyy/mm/dd)
     * @returns {string} SQL文
     */
    function buildClosePermitVersionQuery(logicalId, closeDate) {
        return "UPDATE 許可 SET 有効終了日時 = #" + closeDate + "# WHERE 許可論理ID = " + logicalId + " AND 有効終了日時 IS NULL";
    }

    /**
     * 許可廃止クエリを構築
     */
    function buildAbolishPermitQuery(permitId, dateStr, reason) {
        var sql = "UPDATE 許可 SET 廃止日 = #" + dateStr + "#, 有効終了日時 = #" + dateStr + "#";
        if (reason) sql += ", 廃止理由 = '" + escapeSql(reason) + "'";
        sql += " WHERE 許可ID = " + permitId;
        return sql;
    }

    /**
     * 許可取消クエリを構築
     */
    function buildCancelPermitQuery(permitId, dateStr, reason) {
        var sql = "UPDATE 許可 SET 取消日 = #" + dateStr + "#, 有効終了日時 = #" + dateStr + "#";
        if (reason) sql += ", 取消理由 = '" + escapeSql(reason) + "'";
        sql += " WHERE 許可ID = " + permitId;
        return sql;
    }

    /**
     * 許可復活クエリを構築
     */
    function buildRestorePermitQuery(permitId) {
        return "UPDATE 許可 SET 廃止日 = NULL, 廃止理由 = NULL, 取消日 = NULL, 取消理由 = NULL, 有効終了日時 = NULL WHERE 許可ID = " + permitId;
    }

    /**
     * 同一論理IDでアクティブバージョンが存在するか確認するクエリ
     */
    function buildCheckActiveVersionExistsQuery(table, logicalIdCol, logicalId, excludeId, idCol) {
        return "SELECT COUNT(*) AS cnt FROM " + table + " WHERE " + logicalIdCol + " = " + logicalId +
            " AND 有効終了日時 IS NULL AND " + idCol + " <> " + excludeId;
    }

    /**
     * 許可品目サイクル用クエリ群を構築
     * ×→〇: INSERT, 〇→◎: UPDATE, ◎→×: DELETE
     */
    function buildPermitItemQueries(permitId, itemId) {
        return {
            select: "SELECT 許可品目ID, 取り扱いフラグ, 積替保管フラグ FROM 許可品目 WHERE 許可ID = " + permitId + " AND 品目ID = " + itemId,
            insert: "INSERT INTO 許可品目 (許可ID, 品目ID, 取り扱いフラグ, 積替保管フラグ) VALUES (" + permitId + ", " + itemId + ", True, False)",
            toTransfer: function(recId) { return "UPDATE 許可品目 SET 取り扱いフラグ = True, 積替保管フラグ = True WHERE 許可品目ID = " + recId; },
            remove: function(recId) { return "DELETE FROM 許可品目 WHERE 許可品目ID = " + recId; }
        };
    }

    /**
     * 許可品目コピークエリを構築（更新・変更許可時に旧バージョンの品目を引き継ぐ）
     * @param {number} fromPermitId - コピー元の許可ID
     * @param {number} toPermitId - コピー先の許可ID
     * @returns {string} SQL文
     */
    function buildCopyPermitItemsQuery(fromPermitId, toPermitId) {
        return "INSERT INTO 許可品目 (許可ID, 品目ID, 取り扱いフラグ, 積替保管フラグ) " +
            "SELECT " + toPermitId + ", 品目ID, 取り扱いフラグ, 積替保管フラグ " +
            "FROM 許可品目 WHERE 許可ID = " + fromPermitId;
    }

    /**
     * 許可品目を全削除するクエリを構築
     */
    function buildDeleteAllPermitItemsQuery(permitId) {
        return "DELETE FROM 許可品目 WHERE 許可ID = " + permitId;
    }

    /**
     * 許可品目を1件挿入するクエリを構築
     */
    function buildInsertPermitItemQuery(permitId, itemId, handling, transfer) {
        return "INSERT INTO 許可品目 (許可ID, 品目ID, 取り扱いフラグ, 積替保管フラグ) VALUES (" +
            permitId + ", " + itemId + ", " +
            (handling ? "True" : "False") + ", " +
            (transfer ? "True" : "False") + ")";
    }

    /**
     * 施設保存（新規）クエリを構築
     */
    function buildSaveFacilityQuery(data) {
        var sql = "INSERT INTO 施設 (施設論理ID, 事業者ID, 施設種別ID, 設置場所, 許可番号, ";
        sql += "許可年月日, 設置年月日, 有効開始日時, 管理区分ID, 容量m3, 面積m2, 埋立終了年月日, 処理方法ID, 設置形態区分ID, 許可対象区分ID, ";
        sql += "保管施設面積m2, 保管量上限m3, 保管高さm) VALUES (";
        sql += data.logicalId + ", " + data.businessId + ", " + data.typeId + ", ";
        sql += "'" + escapeSql(data.location) + "', ";
        sql += data.permitNo ? "'" + escapeSql(data.permitNo) + "'" : "NULL";
        sql += ", ";
        sql += data.permitDate ? "#" + data.permitDate + "#" : "NULL";
        sql += ", ";
        sql += data.setupDate ? "#" + data.setupDate + "#" : "NULL";
        sql += ", #" + (data.permitDate || data.todayStr) + "#";
        sql += ", " + numOrNull(data.managementTypeId);
        sql += ", " + numOrNull(data.capacityM3);
        sql += ", " + numOrNull(data.areaM2);
        sql += ", " + (data.landfillEndDate ? "#" + data.landfillEndDate + "#" : "NULL");
        sql += ", " + numOrNull(data.processingMethodId);
        sql += ", " + numOrNull(data.setupFormId);
        sql += ", " + numOrNull(data.permitTargetId);
        sql += ", " + numOrNull(data.storageAreaM2);
        sql += ", " + numOrNull(data.storageCapM3);
        sql += ", " + numOrNull(data.storageHeightM);
        sql += ")";
        return sql;
    }

    /**
     * 施設廃止クエリを構築
     * @param {number} facilityId - 施設ID
     * @param {string} dateStr - 廃止日
     * @param {string} [confirmDateStr] - 廃止確認日（最終処分場のみ、§9⑤ G6）
     */
    function buildAbolishFacilityQuery(facilityId, dateStr, confirmDateStr) {
        var sql = "UPDATE 施設 SET 有効終了日時 = #" + dateStr + "#, 廃止年月日 = #" + dateStr + "#";
        if (confirmDateStr) sql += ", 廃止確認日 = #" + confirmDateStr + "#";
        sql += " WHERE 施設ID = " + facilityId;
        return sql;
    }

    /**
     * 施設取消クエリを構築（G7: 取消理由追加）
     */
    function buildCancelFacilityQuery(facilityId, dateStr, reason) {
        var sql = "UPDATE 施設 SET 取消年月日 = #" + dateStr + "#, 有効終了日時 = #" + dateStr + "#";
        if (reason) sql += ", 取消理由 = '" + escapeSql(reason) + "'";
        sql += " WHERE 施設ID = " + facilityId;
        return sql;
    }

    /**
     * 施設復活クエリを構築（全状態フラグをクリア）
     */
    function buildRestoreFacilityQuery(facilityId) {
        return "UPDATE 施設 SET 廃止年月日 = NULL, 廃止確認日 = NULL, 廃止理由 = NULL, 取消年月日 = NULL, 取消理由 = NULL, 休止年月日 = NULL, 再開年月日 = NULL, 休止理由 = NULL, 有効終了日時 = NULL WHERE 施設ID = " + facilityId;
    }

    /**
     * 施設削除クエリを構築（処理能力も含め同一論理IDの全レコードを削除）
     */
    function buildDeleteFacilityQueries(logicalId) {
        return [
            "DELETE FROM 施設休止履歴 WHERE 施設ID IN (SELECT 施設ID FROM 施設 WHERE 施設論理ID = " + logicalId + ")",
            "DELETE FROM 処理能力 WHERE 施設ID IN (SELECT 施設ID FROM 施設 WHERE 施設論理ID = " + logicalId + ")",
            "DELETE FROM 施設 WHERE 施設論理ID = " + logicalId
        ];
    }

    /**
     * 同じ論理IDの旧施設バージョンをクローズするクエリを構築
     * @param {number} logicalId - 施設論理ID
     * @param {string} todayStr - 今日の日付文字列
     * @param {string} [boundaryDateStr] - 境界日（省略時はtodayStr）
     * @returns {string} SQL文
     */
    function buildCloseOldFacilityVersionsQuery(logicalId, todayStr, boundaryDateStr) {
        var closeDate = boundaryDateStr || todayStr;
        return "UPDATE 施設 SET 有効終了日時 = #" + closeDate + "# WHERE 施設論理ID = " + logicalId + " AND 有効終了日時 IS NULL";
    }

    /**
     * 車両保存（新規）クエリを構築
     */
    function buildSaveVehicleQuery(data) {
        var sql;
        var normalFlag = data.normalFlag ? "True" : "False";
        var specialFlag = data.specialFlag ? "True" : "False";
        if (data.id > 0) {
            sql = "UPDATE 車両 SET 登録番号1 = '" + escapeSql(data.reg1) + "', ";
            sql += "登録番号2 = '" + escapeSql(data.reg2 || "") + "', ";
            sql += "登録番号3 = '" + escapeSql(data.reg3 || "") + "', ";
            sql += "登録番号4 = '" + escapeSql(data.reg4) + "', ";
            sql += "普通フラグ = " + normalFlag + ", ";
            sql += "特管フラグ = " + specialFlag + " ";
            sql += "WHERE 車両ID = " + data.id;
        } else {
            sql = "INSERT INTO 車両 (事業者ID, 登録番号1, 登録番号2, 登録番号3, 登録番号4, 廃車フラグ, 普通フラグ, 特管フラグ) VALUES (";
            sql += data.businessId + ", '" + escapeSql(data.reg1) + "', '" + escapeSql(data.reg2 || "") + "', '";
            sql += escapeSql(data.reg3 || "") + "', '" + escapeSql(data.reg4) + "', False, " + normalFlag + ", " + specialFlag + ")";
        }
        return sql;
    }

    /**
     * 車両の許可種別フラグ更新クエリを構築
     */
    function buildUpdateVehicleFlagQuery(vehicleId, flagName, value) {
        var allowed = { "普通フラグ": 1, "特管フラグ": 1 };
        if (!allowed[flagName]) return "";
        return "UPDATE 車両 SET " + flagName + " = " + (value ? "True" : "False") + " WHERE 車両ID = " + vehicleId;
    }

    /**
     * 車両廃車/復活/削除クエリを構築
     */
    function buildScrapVehicleQuery(vehicleId) {
        return "UPDATE 車両 SET 廃車フラグ = True WHERE 車両ID = " + vehicleId;
    }
    function buildRestoreVehicleQuery(vehicleId) {
        return "UPDATE 車両 SET 廃車フラグ = False WHERE 車両ID = " + vehicleId;
    }
    function buildDeleteVehicleQuery(vehicleId) {
        return "DELETE FROM 車両 WHERE 車両ID = " + vehicleId;
    }

    /**
     * 役員保存クエリを構築
     */
    function buildSaveOfficerQuery(data) {
        var sql;
        if (data.id > 0) {
            sql = "UPDATE 役員 SET 役職名 = '" + escapeSql(data.position) + "', ";
            sql += "姓 = '" + escapeSql(data.lastName) + "', ";
            sql += "名 = '" + escapeSql(data.firstName) + "' ";
            sql += "WHERE 役員ID = " + data.id;
        } else {
            sql = "INSERT INTO 役員 (事業者ID, 役職名, 姓, 名, 退任フラグ) VALUES (";
            sql += data.businessId + ", '" + escapeSql(data.position) + "', '";
            sql += escapeSql(data.lastName) + "', '" + escapeSql(data.firstName) + "', False)";
        }
        return sql;
    }

    /**
     * 役員退任/復帰/削除クエリを構築
     */
    function buildRetireOfficerQuery(officerId) {
        return "UPDATE 役員 SET 退任フラグ = True WHERE 役員ID = " + officerId;
    }
    function buildReinstateOfficerQuery(officerId) {
        return "UPDATE 役員 SET 退任フラグ = False WHERE 役員ID = " + officerId;
    }
    function buildDeleteOfficerQuery(officerId) {
        return "DELETE FROM 役員 WHERE 役員ID = " + officerId;
    }
    function buildSetPrimaryOfficerQueries(officerId, businessId) {
        return [
            "UPDATE 役員 SET 代表者フラグ = False WHERE 事業者ID = " + businessId,
            "UPDATE 役員 SET 代表者フラグ = True WHERE 役員ID = " + officerId
        ];
    }
    function buildClearPrimaryOfficerQuery(officerId) {
        return "UPDATE 役員 SET 代表者フラグ = False WHERE 役員ID = " + officerId;
    }

    // ===== データ読み込み系SQLビルダー =====

    /**
     * 事業者詳細読み込みクエリを構築
     */
    function buildLoadBusinessDetailQuery(id) {
        return "SELECT * FROM 事業者 WHERE 事業者ID = " + id;
    }

    /**
     * 事業者一覧読み込みクエリを構築
     */
    function buildLoadBusinessListQuery(sortColumn, sortDir) {
        var allowed = { "事業者ID": 1, "事業者名": 1, "都道府県": 1, "電話番号": 1 };
        var col = (sortColumn && allowed[sortColumn]) ? sortColumn : "事業者名";
        var dir = (sortDir === "DESC") ? "DESC" : "ASC";
        return "SELECT 事業者ID, 事業者名, 郵便番号, 都道府県, 市区町村町名番地, 電話番号 FROM 事業者 ORDER BY " + col + " " + dir;
    }

    /**
     * 事業者別施設一覧（有効分のみ）クエリを構築
     */
    function buildLoadFacilitiesForBusinessQuery(businessId, includeAbolished) {
        var sql = "SELECT 施設.施設ID, 施設.施設論理ID, 施設.施設種別ID, 施設.設置場所, 施設.許可番号, ";
        sql += "施設.有効開始日時, 施設.有効終了日時, 施設.廃止年月日, 施設.容量m3, 施設.面積m2, ";
        sql += "マスター_施設種別.施設種別名, マスター_管理区分.管理区分名, マスター_処理方法.処理方法名, マスター_設置形態区分.設置形態区分名 ";
        sql += "FROM (((施設 LEFT JOIN マスター_施設種別 ON 施設.施設種別ID = マスター_施設種別.施設種別ID) ";
        sql += "LEFT JOIN マスター_管理区分 ON 施設.管理区分ID = マスター_管理区分.管理区分ID) ";
        sql += "LEFT JOIN マスター_処理方法 ON 施設.処理方法ID = マスター_処理方法.処理方法ID) ";
        sql += "LEFT JOIN マスター_設置形態区分 ON 施設.設置形態区分ID = マスター_設置形態区分.設置形態区分ID ";
        sql += "WHERE 施設.事業者ID = " + businessId + " AND 施設.有効終了日時 IS NULL";
        // 論理IDごとに最新版（MAX施設ID）のみ取得して古いバージョンの重複表示を防ぐ
        sql += " AND 施設.施設ID IN (SELECT MAX(f2.施設ID) FROM 施設 AS f2 WHERE f2.事業者ID = " + businessId + " AND f2.有効終了日時 IS NULL GROUP BY f2.施設論理ID)";
        if (!includeAbolished) {
            sql += " AND 施設.廃止年月日 IS NULL";
        }
        sql += " ORDER BY 施設.施設種別ID, 施設.処理方法ID, 施設.施設ID";
        return sql;
    }

    /**
     * 事業者別車両一覧クエリを構築
     */
    function buildLoadVehiclesForBusinessQuery(businessId) {
        return "SELECT * FROM 車両 WHERE 事業者ID = " + businessId + " ORDER BY 廃車フラグ, 車両ID";
    }

    /**
     * 事業者別役員一覧クエリを構築
     */
    function buildOfficerSortExpression() {
        var expr = "Switch(";
        for (var i = 0; i < OFFICER_POSITIONS.length; i++) {
            if (i > 0) expr += ", ";
            expr += "役職名='" + OFFICER_POSITIONS[i] + "', " + (i + 1);
        }
        expr += ", True, " + (OFFICER_POSITIONS.length + 1) + ")";
        return expr;
    }

    function buildLoadOfficersForBusinessQuery(businessId) {
        return "SELECT 役員ID, 役職名, 姓, 名, 退任フラグ, 代表者フラグ FROM 役員 WHERE 事業者ID = " + businessId +
            " ORDER BY IIF(退任フラグ, 1, 0), " + buildOfficerSortExpression() + ", IIF(代表者フラグ, 0, 1), 役員ID";
    }

    /**
     * 許可履歴読み込みクエリを構築
     */
    function buildLoadPermitHistoryQuery(logicalId) {
        var sql = "SELECT 許可.許可ID, 許可.許可番号, ";
        sql += "Format(許可.許可年月日, 'yyyy/mm/dd') AS 許可日文字列, ";
        sql += "Format(許可.許可有効年月日, 'yyyy/mm/dd') AS 許可有効期限文字列, ";
        sql += "Format(許可.有効開始日時, 'yyyy/mm/dd') AS 有効開始文字列, ";
        sql += "Format(許可.有効終了日時, 'yyyy/mm/dd') AS 有効終了文字列, ";
        sql += "Format(許可.取消日, 'yyyy/mm/dd') AS 取消日文字列, ";
        sql += "Format(許可.廃止日, 'yyyy/mm/dd') AS 廃止日文字列, ";
        sql += "許可.取消理由, 許可.廃止理由, 許可.変更許可フラグ, 許可.失効新規フラグ, ";
        sql += "マスター_許可区分.許可区分名 ";
        sql += "FROM 許可 LEFT JOIN マスター_許可区分 ON 許可.許可区分ID = マスター_許可区分.許可区分ID ";
        sql += "WHERE 許可.許可論理ID = " + logicalId + " ORDER BY 許可.有効開始日時 ASC";
        return sql;
    }

    /**
     * 許可履歴更新クエリを構築
     * 提供されたフィールドのみ更新する（部分更新対応）
     * permitNumber と categoryId は必須
     */
    function buildUpdatePermitHistoryQuery(data) {
        var sets = [];
        sets.push("許可番号 = '" + escapeSql(data.permitNumber) + "'");
        sets.push("許可区分ID = " + data.categoryId);

        if (data.permitDate !== undefined) {
            sets.push("許可年月日 = " + (data.permitDate ? "#" + data.permitDate + "#" : "NULL"));
        }
        if (data.validDate !== undefined) {
            sets.push("許可有効年月日 = " + (data.validDate ? "#" + data.validDate + "#" : "NULL"));
        }
        if (data.startDate !== undefined) {
            sets.push("有効開始日時 = " + (data.startDate ? "#" + data.startDate + "#" : "NULL"));
        }
        if (data.endDate !== undefined) {
            sets.push("有効終了日時 = " + (data.endDate ? "#" + data.endDate + "#" : "NULL"));
        }
        if (data.excellent !== undefined) {
            sets.push("優良認定 = " + (data.excellent ? "True" : "False"));
        }
        if (data.cancelDate !== undefined) {
            sets.push("取消日 = " + (data.cancelDate ? "#" + data.cancelDate + "#" : "NULL"));
        }
        if (data.cancelReason !== undefined) {
            sets.push("取消理由 = " + (data.cancelReason ? "'" + escapeSql(data.cancelReason) + "'" : "NULL"));
        }
        if (data.abolishDate !== undefined) {
            sets.push("廃止日 = " + (data.abolishDate ? "#" + data.abolishDate + "#" : "NULL"));
        }
        if (data.abolishReason !== undefined) {
            sets.push("廃止理由 = " + (data.abolishReason ? "'" + escapeSql(data.abolishReason) + "'" : "NULL"));
        }
        var sql = "UPDATE 許可 SET " + sets.join(", ") + " WHERE 許可ID = " + data.permitId;
        return sql;
    }

    /**
     * 施設履歴読み込みクエリを構築
     */
    function buildLoadFacilityHistoryQuery(logicalId) {
        var sql = "SELECT 施設.施設ID, 施設.設置場所, 施設.許可番号, ";
        sql += "Format(施設.有効開始日時, 'yyyy/mm/dd') AS 有効開始文字列, ";
        sql += "Format(施設.有効終了日時, 'yyyy/mm/dd') AS 有効終了文字列, ";
        sql += "Format(施設.廃止年月日, 'yyyy/mm/dd') AS 廃止日文字列, ";
        sql += "施設.容量m3, 施設.面積m2, ";
        sql += "マスター_施設種別.施設種別名, マスター_管理区分.管理区分名, マスター_処理方法.処理方法名, マスター_設置形態区分.設置形態区分名 ";
        sql += "FROM (((施設 LEFT JOIN マスター_施設種別 ON 施設.施設種別ID = マスター_施設種別.施設種別ID) ";
        sql += "LEFT JOIN マスター_管理区分 ON 施設.管理区分ID = マスター_管理区分.管理区分ID) ";
        sql += "LEFT JOIN マスター_処理方法 ON 施設.処理方法ID = マスター_処理方法.処理方法ID) ";
        sql += "LEFT JOIN マスター_設置形態区分 ON 施設.設置形態区分ID = マスター_設置形態区分.設置形態区分ID ";
        sql += "WHERE 施設.施設論理ID = " + logicalId + " ORDER BY 施設.有効開始日時 ASC";
        return sql;
    }

    /**
     * 処理能力一覧読み込みクエリを構築
     */
    function buildLoadProcessingCapacityQuery(facilityId) {
        var sql = "SELECT 処理能力.*, マスター_品目.品目名 FROM 処理能力 ";
        sql += "LEFT JOIN マスター_品目 ON 処理能力.品目ID = マスター_品目.品目ID ";
        sql += "WHERE 処理能力.施設ID = " + facilityId + " ORDER BY マスター_品目.表示順";
        return sql;
    }

    /**
     * 処理能力保存（新規/更新）クエリを構築
     */
    function buildSaveCapacityQuery(data) {
        var sql;
        var noteVal = data.note ? "'" + escapeSql(data.note) + "'" : "NULL";
        if (data.editId) {
            sql = "UPDATE 処理能力 SET ";
            sql += "品目ID = " + data.itemId + ", ";
            sql += "時間処理能力 = " + numOrNull(data.hourCap) + ", ";
            sql += "時間処理能力単位ID = " + data.hourUnit + ", ";
            sql += "日処理能力 = " + numOrNull(data.dayCap) + ", ";
            sql += "日処理能力単位ID = " + data.dayUnit + ", ";
            sql += "稼働時間 = " + numOrNull(data.hours) + ", ";
            sql += "特記事項 = " + noteVal + " ";
            sql += "WHERE 処理能力ID = " + data.editId;
        } else {
            sql = "INSERT INTO 処理能力 (施設ID, 品目ID, 時間処理能力, 時間処理能力単位ID, 日処理能力, 日処理能力単位ID, 稼働時間, 特記事項) VALUES (";
            sql += data.facilityId + ", " + data.itemId + ", ";
            sql += numOrNull(data.hourCap) + ", " + data.hourUnit + ", ";
            sql += numOrNull(data.dayCap) + ", " + data.dayUnit + ", ";
            sql += numOrNull(data.hours) + ", " + noteVal + ")";
        }
        return sql;
    }

    /**
     * 許可履歴の個別削除クエリ群を構築（許可品目も削除）
     */
    function buildDeletePermitHistoryQueries(permitId) {
        return [
            "DELETE FROM 許可品目 WHERE 許可ID = " + permitId,
            "DELETE FROM 許可 WHERE 許可ID = " + permitId
        ];
    }

    /**
     * 処理能力削除クエリを構築
     */
    function buildDeleteCapacityQuery(capId) {
        return "DELETE FROM 処理能力 WHERE 処理能力ID = " + capId;
    }

    /**
     * マスターデータ一覧読み込みクエリを構築
     */
    function buildLoadMasterListQuery(config) {
        var orderCol = (config.extraCol === "表示順") ? "表示順, " + config.idCol : config.idCol;
        return "SELECT * FROM [" + config.table + "] ORDER BY " + orderCol;
    }

    /**
     * マスターデータ個別読み込みクエリを構築
     */
    function buildLoadMasterForEditQuery(config, id) {
        return "SELECT * FROM [" + config.table + "] WHERE " + config.idCol + " = " + id;
    }

    /**
     * マスターデータ保存（新規/更新）クエリを構築
     */
    function buildSaveMasterQuery(config, data) {
        var sql;
        var hasFk = config.fkCol && data.fk !== undefined;
        var fkValue = (hasFk && data.fk !== null && data.fk !== "") ? parseInt(data.fk) : null;
        if (data.id > 0) {
            sql = "UPDATE [" + config.table + "] SET " + config.nameCol + " = '" + escapeSql(data.name) + "'";
            if (config.extraCol) {
                sql += ", " + config.extraCol + " = " + parseInt(data.extra || "0");
            }
            if (hasFk) {
                sql += ", " + config.fkCol.col + " = " + (fkValue !== null ? fkValue : "NULL");
            }
            sql += " WHERE " + config.idCol + " = " + data.id;
        } else {
            sql = "INSERT INTO [" + config.table + "] (" + config.idCol + ", " + config.nameCol;
            var vals = data.newId + ", '" + escapeSql(data.name) + "'";
            if (config.extraCol) {
                sql += ", " + config.extraCol;
                vals += ", " + parseInt(data.extra || "0");
            }
            if (hasFk) {
                sql += ", " + config.fkCol.col;
                vals += ", " + (fkValue !== null ? fkValue : "NULL");
            }
            sql += ") VALUES (" + vals + ")";
        }
        return sql;
    }

    /**
     * マスターデータ削除クエリを構築
     */
    function buildDeleteMasterQuery(config, id) {
        return "DELETE FROM [" + config.table + "] WHERE " + config.idCol + " = " + id;
    }

    /**
     * 期限切れ間近の許可一覧クエリを構築
     */
    function buildLoadExpiringPermitsQuery() {
        var sql = "SELECT 許可.許可ID, 許可.許可論理ID, 許可.許可番号, ";
        sql += "Format(許可.許可年月日, 'yyyy/mm/dd') AS 許可日文字列, ";
        sql += "Format(許可.許可有効年月日, 'yyyy/mm/dd') AS 有効期限文字列, ";
        sql += "事業者.事業者ID, 事業者.事業者名, マスター_許可区分.許可区分名 ";
        sql += "FROM (許可 LEFT JOIN 事業者 ON 許可.事業者ID = 事業者.事業者ID) ";
        sql += "LEFT JOIN マスター_許可区分 ON 許可.許可区分ID = マスター_許可区分.許可区分ID ";
        sql += "WHERE 許可.許可有効年月日 BETWEEN Date() AND DateAdd('yyyy', 1, Date()) ";
        sql += "AND 許可.有効終了日時 IS NULL AND 許可.廃止日 IS NULL AND 許可.取消日 IS NULL ";
        sql += "ORDER BY 許可.許可有効年月日";
        return sql;
    }

    /**
     * 許可数推移クエリを構築
     */
    function buildLoadPermitTrendQuery(catId) {
        var sql = "SELECT Year(許可年月日) AS 年, COUNT(*) AS 件数 FROM 許可 ";
        sql += "WHERE 有効終了日時 IS NULL AND 廃止日 IS NULL AND 取消日 IS NULL AND 許可区分ID = " + catId + " ";
        sql += "GROUP BY Year(許可年月日) ORDER BY Year(許可年月日)";
        return sql;
    }

    /**
     * 処理能力集計クエリを構築（施設種別ごと）
     */
    function buildLoadCapacityStatsQuery(facilityTypeId) {
        var sql = "SELECT 処理能力.品目ID, マスター_品目.品目名, ";
        sql += "処理能力.日処理能力単位ID, SUM(処理能力.日処理能力) AS 合計日処理能力 ";
        sql += "FROM ((処理能力 ";
        sql += "INNER JOIN 施設 ON 処理能力.施設ID = 施設.施設ID) ";
        sql += "INNER JOIN マスター_品目 ON 処理能力.品目ID = マスター_品目.品目ID) ";
        sql += "WHERE 施設.施設種別ID = " + facilityTypeId + " AND 施設.有効終了日時 IS NULL AND 施設.廃止年月日 IS NULL ";
        sql += "GROUP BY 処理能力.品目ID, マスター_品目.品目名, 処理能力.日処理能力単位ID, マスター_品目.表示順 ";
        sql += "ORDER BY マスター_品目.表示順";
        return sql;
    }

    /**
     * 許可品目一覧読み込みクエリを構築
     */
    function buildLoadPermitItemsQuery(permitId) {
        return "SELECT 品目ID, 取り扱いフラグ, 積替保管フラグ FROM 許可品目 WHERE 許可ID = " + permitId;
    }

    // ===== 編集フォーム用 SQLビルダー関数 =====

    /**
     * 許可編集フォーム用SELECTクエリを構築
     * 全日付フィールドにFormat()を適用し、文字列として取得する
     * @param {number} permitId - 許可ID
     * @returns {string} SQL文
     */
    function buildLoadPermitForEditQuery(permitId) {
        var sql = "SELECT 許可ID, 許可番号, 許可区分ID, ";
        sql += "Format(許可年月日, 'yyyy/mm/dd') AS 許可年月日文字列, ";
        sql += "Format(許可有効年月日, 'yyyy/mm/dd') AS 許可有効年月日文字列, ";
        sql += "優良認定, ";
        sql += "Format(有効開始日時, 'yyyy/mm/dd') AS 有効開始文字列, ";
        sql += "Format(有効終了日時, 'yyyy/mm/dd') AS 有効終了文字列, ";
        sql += "Format(取消日, 'yyyy/mm/dd') AS 取消日文字列, 取消理由, ";
        sql += "Format(廃止日, 'yyyy/mm/dd') AS 廃止日文字列, 廃止理由 ";
        sql += "FROM 許可 WHERE 許可ID = " + permitId;
        return sql;
    }

    /**
     * 施設編集フォーム用SELECTクエリを構築
     * 全日付フィールドにFormat()を適用し、文字列として取得する
     * @param {number} facilityId - 施設ID
     * @returns {string} SQL文
     */
    function buildLoadFacilityForEditQuery(facilityId) {
        var sql = "SELECT 施設ID, 施設種別ID, 設置場所, 許可番号, ";
        sql += "Format(許可年月日, 'yyyy/mm/dd') AS 許可年月日文字列, ";
        sql += "Format(設置年月日, 'yyyy/mm/dd') AS 設置年月日文字列, ";
        sql += "Format(有効開始日時, 'yyyy/mm/dd') AS 有効開始文字列, ";
        sql += "Format(有効終了日時, 'yyyy/mm/dd') AS 有効終了文字列, ";
        sql += "Format(廃止年月日, 'yyyy/mm/dd') AS 廃止日文字列, ";
        sql += "Format(休止年月日, 'yyyy/mm/dd') AS 休止日文字列, ";
        sql += "Format(再開年月日, 'yyyy/mm/dd') AS 再開日文字列, ";
        sql += "Format(取消年月日, 'yyyy/mm/dd') AS 取消日文字列, 取消理由, ";
        sql += "Format(廃止確認日, 'yyyy/mm/dd') AS 廃止確認日文字列, ";
        sql += "管理区分ID, 容量m3, 面積m2, ";
        sql += "Format(埋立終了年月日, 'yyyy/mm/dd') AS 埋立終了日文字列, ";
        sql += "処理方法ID, 設置形態区分ID, 許可対象区分ID, ";
        sql += "保管施設面積m2, 保管量上限m3, 保管高さm ";
        sql += "FROM 施設 WHERE 施設ID = " + facilityId;
        return sql;
    }

    /**
     * 施設履歴更新クエリを構築
     * 提供されたフィールドのみ更新する（部分更新対応）
     * typeId と location は必須
     * @param {object} data - 施設データ
     * @param {number} data.facilityId - 施設ID
     * @param {number} data.typeId - 施設種別ID
     * @param {string} data.location - 設置場所
     * @returns {string} SQL文
     */
    function buildUpdateFacilityHistoryQuery(data) {
        var sets = [];
        sets.push("施設種別ID = " + data.typeId);
        sets.push("設置場所 = '" + escapeSql(data.location) + "'");

        if (data.permitNo !== undefined) {
            sets.push("許可番号 = " + (data.permitNo ? "'" + escapeSql(data.permitNo) + "'" : "NULL"));
        }
        if (data.permitDate !== undefined) {
            sets.push("許可年月日 = " + (data.permitDate ? "#" + data.permitDate + "#" : "NULL"));
        }
        if (data.setupDate !== undefined) {
            sets.push("設置年月日 = " + (data.setupDate ? "#" + data.setupDate + "#" : "NULL"));
        }
        if (data.startDate !== undefined) {
            sets.push("有効開始日時 = " + (data.startDate ? "#" + data.startDate + "#" : "NULL"));
        }
        if (data.endDate !== undefined) {
            sets.push("有効終了日時 = " + (data.endDate ? "#" + data.endDate + "#" : "NULL"));
        }
        if (data.abolishDate !== undefined) {
            sets.push("廃止年月日 = " + (data.abolishDate ? "#" + data.abolishDate + "#" : "NULL"));
        }
        if (data.abolishConfirmDate !== undefined) {
            sets.push("廃止確認日 = " + (data.abolishConfirmDate ? "#" + data.abolishConfirmDate + "#" : "NULL"));
        }
        if (data.cancelDate !== undefined) {
            sets.push("取消年月日 = " + (data.cancelDate ? "#" + data.cancelDate + "#" : "NULL"));
        }
        if (data.cancelReason !== undefined) {
            sets.push("取消理由 = " + (data.cancelReason ? "'" + escapeSql(data.cancelReason) + "'" : "NULL"));
        }
        if (data.managementTypeId !== undefined) {
            sets.push("管理区分ID = " + numOrNull(data.managementTypeId));
        }
        if (data.capacityM3 !== undefined) {
            sets.push("容量m3 = " + numOrNull(data.capacityM3));
        }
        if (data.areaM2 !== undefined) {
            sets.push("面積m2 = " + numOrNull(data.areaM2));
        }
        if (data.landfillEndDate !== undefined) {
            sets.push("埋立終了年月日 = " + (data.landfillEndDate ? "#" + data.landfillEndDate + "#" : "NULL"));
        }
        if (data.processingMethodId !== undefined) {
            sets.push("処理方法ID = " + numOrNull(data.processingMethodId));
        }
        if (data.setupFormId !== undefined) {
            sets.push("設置形態区分ID = " + numOrNull(data.setupFormId));
        }
        if (data.permitTargetId !== undefined) {
            sets.push("許可対象区分ID = " + numOrNull(data.permitTargetId));
        }
        if (data.storageAreaM2 !== undefined) {
            sets.push("保管施設面積m2 = " + numOrNull(data.storageAreaM2));
        }
        if (data.storageCapM3 !== undefined) {
            sets.push("保管量上限m3 = " + numOrNull(data.storageCapM3));
        }
        if (data.storageHeightM !== undefined) {
            sets.push("保管高さm = " + numOrNull(data.storageHeightM));
        }

        var sql = "UPDATE 施設 SET " + sets.join(", ") + " WHERE 施設ID = " + data.facilityId;
        return sql;
    }

    /**
     * 境界日更新クエリを構築（許可・施設共用）
     * @param {string} table - テーブル名（"許可" or "施設"）
     * @param {string} idCol - IDカラム名（"許可ID" or "施設ID"）
     * @param {number} recordId - レコードID
     * @param {string} field - 更新フィールド名（"有効開始日時" or "有効終了日時"）
     * @param {string} dateStr - 日付文字列（yyyy/mm/dd）
     * @returns {string} SQL文
     */
    function buildUpdateBoundaryDateQuery(table, idCol, recordId, field, dateStr) {
        return "UPDATE " + table + " SET " + field + " = #" + dateStr + "# WHERE " + idCol + " = " + recordId;
    }

    /**
     * 最新バージョン取得クエリを構築（履歴追加時に使用）
     * @param {string} table - テーブル名
     * @param {string} logicalIdCol - 論理IDカラム名
     * @param {number} logicalId - 論理ID
     * @returns {string} SQL文
     */
    function buildLoadLatestVersionQuery(table, logicalIdCol, logicalId) {
        return "SELECT TOP 1 * FROM " + table + " WHERE " + logicalIdCol + " = " + logicalId + " ORDER BY 有効開始日時 DESC";
    }

    /**
     * 最大ID取得クエリを構築（新規レコードID取得用）
     * @param {string} table - テーブル名
     * @param {string} idCol - IDカラム名
     * @param {string} logicalIdCol - 論理IDカラム名
     * @param {number} logicalId - 論理ID
     * @returns {string} SQL文
     */
    function buildGetMaxIdQuery(table, idCol, logicalIdCol, logicalId) {
        return "SELECT MAX(" + idCol + ") AS newId FROM " + table + " WHERE " + logicalIdCol + " = " + logicalId;
    }

    /**
     * 物理IDを指定して旧バージョンをクローズするクエリを構築
     * @param {string} table - テーブル名
     * @param {string} idCol - IDカラム名
     * @param {number} recordId - レコードID
     * @param {string} todayStr - 今日の日付文字列
     * @returns {string} SQL文
     */
    function buildCloseOldVersionByIdQuery(table, idCol, recordId, todayStr, boundaryDateStr) {
        var closeDate = boundaryDateStr || todayStr;
        return "UPDATE " + table + " SET 有効終了日時 = #" + closeDate + "# WHERE " + idCol + " = " + recordId + " AND 有効終了日時 IS NULL";
    }

    /**
     * 役員編集フォーム用SELECTクエリを構築
     * @param {number} officerId - 役員ID
     * @returns {string} SQL文
     */
    function buildLoadOfficerForEditQuery(officerId) {
        return "SELECT 役職名, 姓, 名 FROM 役員 WHERE 役員ID = " + officerId;
    }

    /**
     * 処理能力の一括UPDATE用クエリを構築
     * @param {number} capacityId - 処理能力ID
     * @param {object} data - {itemId, hourCap, hourUnitId, dayCap, dayUnitId}
     * @returns {string} SQL文
     */
    function buildUpdateCapacityInlineQuery(capacityId, data) {
        var sql = "UPDATE 処理能力 SET 品目ID = " + data.itemId;
        sql += ", 時間処理能力 = " + numOrNull(data.hourCap);
        sql += ", 時間処理能力単位ID = " + (data.hourUnitId || 1);
        sql += ", 日処理能力 = " + numOrNull(data.dayCap);
        sql += ", 日処理能力単位ID = " + (data.dayUnitId || 1);
        sql += " WHERE 処理能力ID = " + capacityId;
        return sql;
    }

    /**
     * 処理能力のINSERT用クエリを構築（配列対応）
     * @param {number} facilityId - 施設ID
     * @param {object} data - {itemId, hourCap, hourUnitId, dayCap, dayUnitId}
     * @returns {string} SQL文
     */
    function buildInsertCapacityInlineQuery(facilityId, data) {
        var sql = "INSERT INTO 処理能力 (施設ID, 品目ID, 時間処理能力, 時間処理能力単位ID, 日処理能力, 日処理能力単位ID) VALUES (";
        sql += facilityId + ", " + data.itemId;
        sql += ", " + numOrNull(data.hourCap);
        sql += ", " + (data.hourUnitId || 1);
        sql += ", " + numOrNull(data.dayCap);
        sql += ", " + (data.dayUnitId || 1) + ")";
        return sql;
    }

    /**
     * 施設休止用UPDATEクエリを構築
     * @param {number} facilityId - 施設ID
     * @param {string} suspendDateStr - 休止日 (yyyy/mm/dd)
     * @returns {string} SQL文
     */
    function buildSuspendFacilityQuery(facilityId, suspendDateStr, reason) {
        var sql = "UPDATE 施設 SET 休止年月日 = #" + suspendDateStr + "#, 再開年月日 = NULL";
        if (reason) sql += ", 休止理由 = '" + escapeSql(reason) + "'";
        sql += " WHERE 施設ID = " + facilityId;
        return sql;
    }

    /**
     * 施設休止履歴INSERTクエリを構築
     */
    function buildInsertSuspensionHistoryQuery(facilityId, suspendDateStr, reason) {
        var sql = "INSERT INTO 施設休止履歴 (施設ID, 休止年月日";
        if (reason) sql += ", 休止理由";
        sql += ") VALUES (" + facilityId + ", #" + suspendDateStr + "#";
        if (reason) sql += ", '" + escapeSql(reason) + "'";
        sql += ")";
        return sql;
    }

    /**
     * 施設再開用UPDATEクエリを構築
     * @param {number} facilityId - 施設ID
     * @param {string} resumeDateStr - 再開日 (yyyy/mm/dd)
     * @returns {string} SQL文
     */
    function buildResumeFacilityQuery(facilityId, resumeDateStr) {
        return "UPDATE 施設 SET 再開年月日 = #" + resumeDateStr + "#, 休止理由 = NULL WHERE 施設ID = " + facilityId;
    }

    /**
     * 施設休止履歴の最新レコードに再開日を設定
     */
    function buildGetLatestSuspensionHistoryIdQuery(facilityId) {
        return "SELECT MAX(休止履歴ID) AS maxId FROM 施設休止履歴 WHERE 施設ID = " + facilityId + " AND 再開年月日 IS NULL";
    }

    function buildUpdateSuspensionHistoryResumeByIdQuery(historyId, resumeDateStr) {
        return "UPDATE 施設休止履歴 SET 再開年月日 = #" + resumeDateStr + "# WHERE 休止履歴ID = " + historyId;
    }

    /**
     * @deprecated JET SQLのサブクエリ互換性問題あり。buildGetLatestSuspensionHistoryIdQuery + buildUpdateSuspensionHistoryResumeByIdQuery を使用してください。
     */
    function buildUpdateSuspensionHistoryResumeQuery(facilityId, resumeDateStr) {
        return "UPDATE 施設休止履歴 SET 再開年月日 = #" + resumeDateStr + "# WHERE 休止履歴ID = (" +
            "SELECT MAX(休止履歴ID) FROM 施設休止履歴 WHERE 施設ID = " + facilityId + " AND 再開年月日 IS NULL)";
    }

    /**
     * 施設休止履歴一覧取得クエリを構築
     */
    function buildLoadSuspensionHistoryQuery(facilityId) {
        return "SELECT 休止履歴ID, Format(休止年月日, 'yyyy/mm/dd') AS 休止日文字列, " +
            "Format(再開年月日, 'yyyy/mm/dd') AS 再開日文字列, 休止理由 " +
            "FROM 施設休止履歴 WHERE 施設ID = " + facilityId + " ORDER BY 休止年月日 DESC";
    }

    /**
     * 施設バージョン削除用クエリを構築（処理能力も含む）
     * @param {number} facilityId - 施設ID
     * @returns {string[]} SQL文の配列
     */
    function buildDeleteFacilityVersionQueries(facilityId) {
        return [
            "DELETE FROM 施設休止履歴 WHERE 施設ID = " + facilityId,
            "DELETE FROM 処理能力 WHERE 施設ID = " + facilityId,
            "DELETE FROM 施設 WHERE 施設ID = " + facilityId
        ];
    }

    /**
     * 次の論理IDを取得するSELECTクエリを構築
     * @param {string} table - テーブル名
     * @param {string} logicalIdCol - 論理IDカラム名
     * @returns {string} SQL文
     */
    function buildGetNextLogicalIdQuery(table, logicalIdCol) {
        return "SELECT MAX(" + logicalIdCol + ") AS maxId FROM " + table;
    }

    /**
     * マスター新規ID採番クエリを構築（品目の種別範囲対応）
     * @param {object} config - getMasterConfig() の結果
     * @param {string} [category] - "special" or "normal" (品目のみ)
     * @returns {string} SQL文
     */
    function buildGetNextMasterIdQuery(config, category) {
        if (category === "special") {
            return "SELECT MAX(" + config.idCol + ") AS maxId FROM [" + config.table + "] WHERE " + config.idCol + " >= " + ITEM_SPECIAL_THRESHOLD;
        } else if (category === "normal") {
            return "SELECT MAX(" + config.idCol + ") AS maxId FROM [" + config.table + "] WHERE " + config.idCol + " < " + ITEM_SPECIAL_THRESHOLD;
        }
        return "SELECT MAX(" + config.idCol + ") AS maxId FROM [" + config.table + "]";
    }

    /**
     * 施設バージョン残数カウントクエリを構築
     * @param {number} logicalId - 施設論理ID
     * @returns {string} SQL文
     */
    function buildCountFacilityVersionsQuery(logicalId) {
        return "SELECT COUNT(*) AS cnt FROM 施設 WHERE 施設論理ID = " + logicalId;
    }

    // ===== 正規化ユーティリティ =====

    /**
     * 全角英数字・全角ハイフン等を半角に補正（許可番号・住所等の汎用正規化）
     */
    function normalizeToHankaku(s) {
        if (!s) return "";
        s = String(s).replace(/^\s+|\s+$/g, "");
        // 全角英数→半角英数
        s = s.replace(/[Ａ-Ｚａ-ｚ０-９]/g, function(c) {
            return String.fromCharCode(c.charCodeAt(0) - 0xFEE0);
        });
        // 全角ハイフン・ダッシュ類→半角ハイフン
        s = s.replace(/[\u2010\u2015\u2212\u30FC\uFF0D\uFF70]/g, "-");
        return s;
    }

    var normalizePermitNumber = normalizeToHankaku;

    // ===== 旧システム インポート機能 =====

    /**
     * 事業者名を正規化（マッチング用）
     * 全角半角統一、スペース除去、㈱⇔株式会社 等
     */
    function normalizeBusinessName(name) {
        if (!name) return "";
        var s = String(name);
        // 全角英数→半角英数
        s = s.replace(/[Ａ-Ｚａ-ｚ０-９]/g, function(c) {
            return String.fromCharCode(c.charCodeAt(0) - 0xFEE0);
        });
        // 濁点・半濁点結合（半角カナ+ﾞ/ﾟ → 全角）★単独カナ変換より先に実行
        s = s.replace(/ｶﾞ/g, "ガ").replace(/ｷﾞ/g, "ギ").replace(/ｸﾞ/g, "グ").replace(/ｹﾞ/g, "ゲ").replace(/ｺﾞ/g, "ゴ");
        s = s.replace(/ｻﾞ/g, "ザ").replace(/ｼﾞ/g, "ジ").replace(/ｽﾞ/g, "ズ").replace(/ｾﾞ/g, "ゼ").replace(/ｿﾞ/g, "ゾ");
        s = s.replace(/ﾀﾞ/g, "ダ").replace(/ﾁﾞ/g, "ヂ").replace(/ﾂﾞ/g, "ヅ").replace(/ﾃﾞ/g, "デ").replace(/ﾄﾞ/g, "ド");
        s = s.replace(/ﾊﾞ/g, "バ").replace(/ﾋﾞ/g, "ビ").replace(/ﾌﾞ/g, "ブ").replace(/ﾍﾞ/g, "ベ").replace(/ﾎﾞ/g, "ボ");
        s = s.replace(/ﾊﾟ/g, "パ").replace(/ﾋﾟ/g, "ピ").replace(/ﾌﾟ/g, "プ").replace(/ﾍﾟ/g, "ペ").replace(/ﾎﾟ/g, "ポ");
        s = s.replace(/ｳﾞ/g, "ヴ");
        // 半角カナ→全角カナ（基本50音 + 小文字カナ）
        var hk = "ｱｲｳｴｵｶｷｸｹｺｻｼｽｾｿﾀﾁﾂﾃﾄﾅﾆﾇﾈﾉﾊﾋﾌﾍﾎﾏﾐﾑﾒﾓﾔﾕﾖﾗﾘﾙﾚﾛﾜｦﾝｧｨｩｪｫｬｭｮｯ";
        var zk = "アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワヲンァィゥェォャュョッ";
        for (var i = 0; i < hk.length; i++) {
            s = s.replace(new RegExp(hk.charAt(i), "g"), zk.charAt(i));
        }
        // 残留した半角濁点・半濁点を除去
        s = s.replace(/\uff9e/g, "").replace(/\uff9f/g, "");
        // 括弧付き略称 → 展開してから法人格ごと除去
        s = s.replace(/㈱/g, "株式会社");
        s = s.replace(/㈲/g, "有限会社");
        s = s.replace(/㈳/g, "社団法人");
        // (株) （株） 等のカッコ囲みも除去
        s = s.replace(/[（(]株[）)]/g, "株式会社");
        s = s.replace(/[（(]有[）)]/g, "有限会社");
        // 法人格を除去（マッチング精度向上: 株式会社 vs 有限会社 の不一致を回避）
        s = s.replace(/株式会社|有限会社|合同会社|合名会社|合資会社|社団法人|財団法人|特定非営利活動法人|一般社団法人|一般財団法人|公益社団法人|公益財団法人|企業組合|協業組合/g, "");
        // 中黒（・）除去（全角・半角）
        s = s.replace(/[・\uff65]/g, "");
        // 括弧付きの注記を除去（「（廃止）」「（収運のみ廃止）」等）
        s = s.replace(/[（(][^）)]*[）)]/g, "");
        // スペース除去（全角半角）
        s = s.replace(/[\s\u3000]+/g, "");
        // ー と各種ハイフン系を統一
        s = s.replace(/[-\u2010\uff0d\u2500\u2015\uff70]/g, "ー");
        // 「旧）～」以降のノイズを除去
        s = s.replace(/旧[）)].*/g, "");
        return s;
    }

    /**
     * 現行DBの事業者一覧と旧DB事業者一覧から名前マッチングマップを構築
     * @param {Array} currentBusinesses - 現行DB事業者 [{事業者ID, 事業者名}]
     * @param {Array} legacyBusinesses - 旧DB事業者 [{ID, 業者名}]
     * @returns {Object} { map: Map<legacyId, currentId>, unmatched: [{legacyId, legacyName}] }
     */
    function buildBusinessNameMap(currentBusinesses, legacyBusinesses) {
        var currentMap = {}; // normalized name → currentId
        var i;
        for (i = 0; i < currentBusinesses.length; i++) {
            var biz = currentBusinesses[i];
            var key = normalizeBusinessName(biz["事業者名"]);
            currentMap[key] = biz["事業者ID"];
        }

        var resultMap = {}; // legacyId → currentId
        var unmatched = [];
        for (i = 0; i < legacyBusinesses.length; i++) {
            var leg = legacyBusinesses[i];
            var legKey = normalizeBusinessName(leg["業者名"]);
            if (currentMap[legKey] !== undefined) {
                resultMap[leg["ID"]] = currentMap[legKey];
            } else {
                unmatched.push({ legacyId: leg["ID"], legacyName: leg["業者名"] });
            }
        }

        return { map: resultMap, unmatched: unmatched };
    }

    /**
     * 旧DB役員データからINSERT SQLを生成（重複チェック付き）
     * @param {Array} officers - [{ＩＤ番号, 役職名, 姓, 名}]
     * @param {Object} businessIdMap - legacyId → currentId
     * @param {Array} existingOfficers - 既存の役員データ [{事業者ID, 役職名, 姓, 名}]
     * @returns {Object} { queries: string[], skippedCount: number, insertCount: number, unmatchedBizCount: number }
     */
    function buildImportOfficersQueries(officers, businessIdMap, existingOfficers) {
        var queries = [];
        var skippedCount = 0;
        var unmatchedBizCount = 0;

        // 既存役員の重複チェック用セット
        var existingSet = {};
        var i;
        for (i = 0; i < existingOfficers.length; i++) {
            var eo = existingOfficers[i];
            var eKey = eo["事業者ID"] + "|" + (eo["役職名"] || "") + "|" + (eo["姓"] || "") + "|" + (eo["名"] || "");
            existingSet[eKey] = true;
        }

        for (i = 0; i < officers.length; i++) {
            var off = officers[i];
            var legacyBizId = off["ＩＤ番号"];
            var currentBizId = businessIdMap[legacyBizId];
            if (currentBizId === undefined) {
                unmatchedBizCount++;
                continue;
            }

            var position = String(off["役職名"] || "").trim();
            var lastName = String(off["姓"] || "").trim();
            var firstName = String(off["名"] || "").trim();

            // 空文字列は許可されないフィールドへのデフォルト値
            if (!position) position = "（不明）";
            if (!lastName) lastName = "（不明）";
            if (!firstName) firstName = "（不明）";

            // 重複チェック
            var dupKey = currentBizId + "|" + position + "|" + lastName + "|" + firstName;
            if (existingSet[dupKey]) {
                skippedCount++;
                continue;
            }
            existingSet[dupKey] = true; // 同バッチ内の重複も防止

            var sql = buildSaveOfficerQuery({
                id: 0,
                businessId: currentBizId,
                position: position,
                lastName: lastName,
                firstName: firstName
            });
            queries.push(sql);
        }

        return {
            queries: queries,
            skippedCount: skippedCount,
            insertCount: queries.length,
            unmatchedBizCount: unmatchedBizCount
        };
    }

    /**
     * 旧DB車両データからINSERT SQLを生成（重複チェック付き）
     * @param {Array} vehicles - [{ＩＤ番号, 登録№１, 登録№２, 登録№３, 登録№４, 廃車}]
     * @param {Object} businessIdMap - legacyId → currentId
     * @param {Array} existingVehicles - 既存の車両データ [{事業者ID, 登録番号1, 登録番号2, 登録番号3, 登録番号4}]
     * @returns {Object} { queries: string[], skippedCount: number, insertCount: number, unmatchedBizCount: number, scrappedCount: number }
     */
    function buildImportVehiclesQueries(vehicles, businessIdMap, existingVehicles) {
        var queries = [];
        var skippedCount = 0;
        var unmatchedBizCount = 0;
        var scrappedCount = 0;

        // 既存車両の重複チェック用セット
        var existingSet = {};
        var i;
        for (i = 0; i < existingVehicles.length; i++) {
            var ev = existingVehicles[i];
            var eKey = ev["事業者ID"] + "|" + (ev["登録番号1"] || "").trim() + "|" + (ev["登録番号2"] || "").trim() + "|" + (ev["登録番号3"] || "").trim() + "|" + (ev["登録番号4"] || "").trim();
            existingSet[eKey] = true;
        }

        for (i = 0; i < vehicles.length; i++) {
            var v = vehicles[i];
            var legacyBizId = v["ＩＤ番号"];
            if (legacyBizId === null || legacyBizId === undefined) {
                unmatchedBizCount++;
                continue;
            }
            var currentBizId = businessIdMap[legacyBizId];
            if (currentBizId === undefined) {
                unmatchedBizCount++;
                continue;
            }

            var reg1 = String(v["登録№１"] || "").trim();
            var reg2 = String(v["登録№２"] || "").trim();
            var reg3 = String(v["登録№３"] || "").trim();
            var reg4 = String(v["登録№４"] || "").trim();

            if (!reg1 || !reg4) continue; // 必須フィールド

            // 重複チェック
            var dupKey = currentBizId + "|" + reg1 + "|" + reg2 + "|" + reg3 + "|" + reg4;
            if (existingSet[dupKey]) {
                skippedCount++;
                continue;
            }
            existingSet[dupKey] = true;

            var isScrapped = v["廃車"] === true || v["廃車"] === -1;
            if (isScrapped) scrappedCount++;

            // INSERT (廃車フラグ含む)
            var sql = "INSERT INTO 車両 (事業者ID, 登録番号1, 登録番号2, 登録番号3, 登録番号4, 廃車フラグ) VALUES (";
            sql += currentBizId + ", '" + escapeSql(reg1) + "', '" + escapeSql(reg2) + "', '";
            sql += escapeSql(reg3) + "', '" + escapeSql(reg4) + "', " + (isScrapped ? "True" : "False") + ")";
            queries.push(sql);
        }

        return {
            queries: queries,
            skippedCount: skippedCount,
            insertCount: queries.length,
            unmatchedBizCount: unmatchedBizCount,
            scrappedCount: scrappedCount
        };
    }

    /**
     * 旧DB読み込み用SQLクエリ
     */
    function buildReadLegacyBusinessesQuery() {
        return "SELECT ID, 業者名 FROM [００．T 全処理業] ORDER BY ID";
    }

    function buildReadLegacyOfficersQuery() {
        return "SELECT ＩＤ番号, 役職名, 姓, 名 FROM [５０．T 全役員]";
    }

    function buildReadLegacyVehiclesQuery(tableName) {
        return "SELECT ＩＤ番号, 登録№１, 登録№２, 登録№３, 登録№４, 廃車 FROM [" + escapeSql(tableName) + "]";
    }

    /**
     * 既存の全役員を取得するクエリ（重複チェック用）
     */
    function buildLoadAllOfficersQuery() {
        return "SELECT 事業者ID, 役職名, 姓, 名 FROM 役員";
    }

    /**
     * 既存の全車両を取得するクエリ（重複チェック用）
     */
    function buildLoadAllVehiclesQuery() {
        return "SELECT 事業者ID, 登録番号1, 登録番号2, 登録番号3, 登録番号4 FROM 車両";
    }

    // ===== マスターデータ参照クエリ =====

    /**
     * マスターテーブルの一覧取得クエリ（汎用）
     * @param {string} table - テーブル名（例: "マスター_許可区分"）
     * @param {string} idCol - IDカラム名（例: "許可区分ID"）
     * @param {string} nameCol - 名前カラム名（例: "許可区分名"）
     * @param {string} [orderCol] - ソートカラム（省略時はidCol）
     * @returns {string} SQL文
     */
    function buildMasterListQuery(table, idCol, nameCol, orderCol) {
        return "SELECT " + idCol + ", " + nameCol + " FROM [" + table + "] ORDER BY " + (orderCol || idCol);
    }

    /**
     * マスターテーブルの全カラム取得クエリ
     */
    function buildMasterAllQuery(table, orderCol) {
        if (orderCol) {
            return "SELECT * FROM [" + table + "] ORDER BY " + orderCol;
        }
        return "SELECT * FROM [" + table + "]";
    }

    /**
     * マスターテーブルの名前取得クエリ（単一レコード）
     * @param {string} table - テーブル名
     * @param {string} idCol - IDカラム名
     * @param {string} nameCol - 名前カラム名
     * @param {number} id - 検索ID値
     * @returns {string} SQL文
     */
    function buildMasterNameQuery(table, idCol, nameCol, id) {
        return "SELECT " + nameCol + " FROM [" + table + "] WHERE " + idCol + " = " + id;
    }

    // ===== カウントクエリ =====

    function buildActivePermitCountQuery(businessId) {
        return "SELECT COUNT(*) AS cnt FROM 許可 WHERE 事業者ID = " + businessId + " AND 有効終了日時 IS NULL";
    }

    function buildActiveFacilityCountQuery(businessId) {
        return "SELECT COUNT(*) AS cnt FROM 施設 WHERE 事業者ID = " + businessId + " AND 有効終了日時 IS NULL AND 廃止年月日 IS NULL";
    }

    function buildVehicleCountQuery(businessId) {
        return "SELECT COUNT(*) AS cnt FROM 車両 WHERE 事業者ID = " + businessId;
    }

    function buildOfficerCountQuery(businessId) {
        return "SELECT COUNT(*) AS cnt FROM 役員 WHERE 事業者ID = " + businessId;
    }

    function buildExpiringPermitsCountQuery() {
        return "SELECT COUNT(*) AS cnt FROM [許可] WHERE [許可有効年月日] BETWEEN Date() AND DateAdd('yyyy', 1, Date()) AND [有効終了日時] IS NULL AND [廃止日] IS NULL AND [取消日] IS NULL";
    }

    // ===== 許可品目参照クエリ =====

    function buildLoadPermitItemsFlagsQuery(permitId) {
        return "SELECT 品目ID, 取り扱いフラグ, 積替保管フラグ FROM 許可品目 WHERE 許可ID = " + permitId;
    }

    function buildWasteTypeMapQuery() {
        return "SELECT 許可区分ID, 廃棄物種類区分ID FROM マスター_許可区分";
    }

    // ===== データメンテナンスクエリ =====

    function buildMissingStartDateCountQuery(table) {
        return "SELECT COUNT(*) AS cnt FROM " + table + " WHERE 有効開始日時 IS NULL";
    }

    function buildFixMissingPermitStartDateQuery() {
        return "UPDATE 許可 SET 有効開始日時 = IIF(許可年月日 IS NOT NULL, 許可年月日, 作成日時) WHERE 有効開始日時 IS NULL AND (許可年月日 IS NOT NULL OR 作成日時 IS NOT NULL)";
    }

    function buildFixMissingFacilityStartDateQuery() {
        return "UPDATE 施設 SET 有効開始日時 = IIF(設置年月日 IS NOT NULL, 設置年月日, 許可年月日) WHERE 有効開始日時 IS NULL AND (設置年月日 IS NOT NULL OR 許可年月日 IS NOT NULL)";
    }

    // ===== 個別レコード取得クエリ =====

    function buildGetVehicleByIdQuery(vehicleId) {
        return "SELECT 登録番号1, 登録番号2, 登録番号3, 登録番号4, 普通フラグ, 特管フラグ FROM 車両 WHERE 車両ID = " + vehicleId;
    }

    function buildGetProcessingCapacityByIdQuery(capacityId) {
        return "SELECT * FROM 処理能力 WHERE 処理能力ID = " + capacityId;
    }

    function buildGetMaxBusinessIdQuery() {
        return "SELECT MAX(事業者ID) AS newId FROM 事業者";
    }

    // ===== FK参照クエリ =====

    function buildForeignKeyMapQuery(refTable, refIdCol, refNameCol, orderCol) {
        return "SELECT " + refIdCol + ", " + refNameCol + " FROM [" + refTable + "] ORDER BY " + (orderCol || refIdCol);
    }

    // ===== エクスポート =====

    // HTA用: グローバルに公開
    var exports = {
        // バリデーション関数
        validateRequired: validateRequired,
        validateDateFormat: validateDateFormat,
        validateDateOrder: validateDateOrder,
        validateNonNegative: validateNonNegative,
        validateBusinessData: validateBusinessData,
        validatePermitData: validatePermitData,
        validateVehicleData: validateVehicleData,
        validateOfficerData: validateOfficerData,
        validateFacilityData: validateFacilityData,
        validateCapacityData: validateCapacityData,
        validateAbolishDate: validateAbolishDate,
        validateCancelDate: validateCancelDate,
        validateRenewalDateOrder: validateRenewalDateOrder,
        // ユーティリティ関数
        escapeHtml: escapeHtml,
        escapeSql: escapeSql,
        formatDate: formatDate,
        padZero: padZero,
        padZero2: padZero2,
        getMasterConfig: getMasterConfig,
        buildDateStr: buildDateStr,
        buildSearchBusinessQuery: buildSearchBusinessQuery,
        buildSearchPermitQuery: buildSearchPermitQuery,
        buildSearchFacilityQuery: buildSearchFacilityQuery,
        buildSearchVehicleQuery: buildSearchVehicleQuery,
        buildSearchOfficerQuery: buildSearchOfficerQuery,
        buildLoadPermitsQuery: buildLoadPermitsQuery,
        buildStatisticsQueries: buildStatisticsQueries,
        buildSaveBusinessQuery: buildSaveBusinessQuery,
        buildDeleteBusinessQuery: buildDeleteBusinessQuery,
        buildDeleteBusinessQueries: buildDeleteBusinessQueries,
        buildSavePermitQuery: buildSavePermitQuery,
        buildCloseOldPermitVersionsQuery: buildCloseOldPermitVersionsQuery,
        buildClosePermitVersionQuery: buildClosePermitVersionQuery,
        buildAbolishPermitQuery: buildAbolishPermitQuery,
        buildCancelPermitQuery: buildCancelPermitQuery,
        buildRestorePermitQuery: buildRestorePermitQuery,
        buildCheckActiveVersionExistsQuery: buildCheckActiveVersionExistsQuery,
        buildPermitItemQueries: buildPermitItemQueries,
        buildSaveFacilityQuery: buildSaveFacilityQuery,
        buildAbolishFacilityQuery: buildAbolishFacilityQuery,
        buildCancelFacilityQuery: buildCancelFacilityQuery,
        buildRestoreFacilityQuery: buildRestoreFacilityQuery,
        buildDeleteFacilityQueries: buildDeleteFacilityQueries,
        buildCloseOldFacilityVersionsQuery: buildCloseOldFacilityVersionsQuery,
        buildSaveVehicleQuery: buildSaveVehicleQuery,
        buildUpdateVehicleFlagQuery: buildUpdateVehicleFlagQuery,
        buildScrapVehicleQuery: buildScrapVehicleQuery,
        buildRestoreVehicleQuery: buildRestoreVehicleQuery,
        buildDeleteVehicleQuery: buildDeleteVehicleQuery,
        buildSaveOfficerQuery: buildSaveOfficerQuery,
        buildRetireOfficerQuery: buildRetireOfficerQuery,
        buildReinstateOfficerQuery: buildReinstateOfficerQuery,
        buildDeleteOfficerQuery: buildDeleteOfficerQuery,
        buildLoadBusinessDetailQuery: buildLoadBusinessDetailQuery,
        buildLoadBusinessListQuery: buildLoadBusinessListQuery,
        buildLoadFacilitiesForBusinessQuery: buildLoadFacilitiesForBusinessQuery,
        buildLoadVehiclesForBusinessQuery: buildLoadVehiclesForBusinessQuery,
        buildLoadOfficersForBusinessQuery: buildLoadOfficersForBusinessQuery,
        buildLoadPermitHistoryQuery: buildLoadPermitHistoryQuery,
        buildUpdatePermitHistoryQuery: buildUpdatePermitHistoryQuery,
        buildLoadFacilityHistoryQuery: buildLoadFacilityHistoryQuery,
        buildLoadProcessingCapacityQuery: buildLoadProcessingCapacityQuery,
        buildSaveCapacityQuery: buildSaveCapacityQuery,
        buildDeletePermitHistoryQueries: buildDeletePermitHistoryQueries,
        buildDeleteCapacityQuery: buildDeleteCapacityQuery,
        buildLoadMasterListQuery: buildLoadMasterListQuery,
        buildLoadMasterForEditQuery: buildLoadMasterForEditQuery,
        buildSaveMasterQuery: buildSaveMasterQuery,
        buildDeleteMasterQuery: buildDeleteMasterQuery,
        buildLoadExpiringPermitsQuery: buildLoadExpiringPermitsQuery,
        buildLoadPermitTrendQuery: buildLoadPermitTrendQuery,
        buildLoadCapacityStatsQuery: buildLoadCapacityStatsQuery,
        buildLoadPermitItemsQuery: buildLoadPermitItemsQuery,
        buildLoadPermitForEditQuery: buildLoadPermitForEditQuery,
        buildLoadFacilityForEditQuery: buildLoadFacilityForEditQuery,
        buildUpdateFacilityHistoryQuery: buildUpdateFacilityHistoryQuery,
        buildUpdateBoundaryDateQuery: buildUpdateBoundaryDateQuery,
        buildLoadLatestVersionQuery: buildLoadLatestVersionQuery,
        buildGetMaxIdQuery: buildGetMaxIdQuery,
        buildCloseOldVersionByIdQuery: buildCloseOldVersionByIdQuery,
        buildLoadOfficerForEditQuery: buildLoadOfficerForEditQuery,
        buildCopyPermitItemsQuery: buildCopyPermitItemsQuery,
        buildDeleteAllPermitItemsQuery: buildDeleteAllPermitItemsQuery,
        buildInsertPermitItemQuery: buildInsertPermitItemQuery,
        // 正規化ユーティリティ
        numOrNull: numOrNull,
        normalizeToHankaku: normalizeToHankaku,
        normalizePermitNumber: normalizePermitNumber,
        // 旧システム インポート機能
        normalizeBusinessName: normalizeBusinessName,
        buildBusinessNameMap: buildBusinessNameMap,
        buildImportOfficersQueries: buildImportOfficersQueries,
        buildImportVehiclesQueries: buildImportVehiclesQueries,
        buildReadLegacyBusinessesQuery: buildReadLegacyBusinessesQuery,
        buildReadLegacyOfficersQuery: buildReadLegacyOfficersQuery,
        buildReadLegacyVehiclesQuery: buildReadLegacyVehiclesQuery,
        buildLoadAllOfficersQuery: buildLoadAllOfficersQuery,
        buildLoadAllVehiclesQuery: buildLoadAllVehiclesQuery,
        ITEM_SPECIAL_THRESHOLD: ITEM_SPECIAL_THRESHOLD,
        FACILITY_TYPE_PROCESSING: FACILITY_TYPE_PROCESSING,
        FACILITY_TYPE_LANDFILL: FACILITY_TYPE_LANDFILL,
        FACILITY_TYPE_STORAGE: FACILITY_TYPE_STORAGE,
        WASTE_TYPE_SPECIAL: WASTE_TYPE_SPECIAL,
        OFFICER_POSITIONS: OFFICER_POSITIONS,
        buildSetPrimaryOfficerQueries: buildSetPrimaryOfficerQueries,
        buildClearPrimaryOfficerQuery: buildClearPrimaryOfficerQuery,
        // インラインSQL抽出（処理能力・施設操作）
        buildUpdateCapacityInlineQuery: buildUpdateCapacityInlineQuery,
        buildInsertCapacityInlineQuery: buildInsertCapacityInlineQuery,
        buildSuspendFacilityQuery: buildSuspendFacilityQuery,
        buildResumeFacilityQuery: buildResumeFacilityQuery,
        buildInsertSuspensionHistoryQuery: buildInsertSuspensionHistoryQuery,
        buildUpdateSuspensionHistoryResumeQuery: buildUpdateSuspensionHistoryResumeQuery,
        buildGetLatestSuspensionHistoryIdQuery: buildGetLatestSuspensionHistoryIdQuery,
        buildUpdateSuspensionHistoryResumeByIdQuery: buildUpdateSuspensionHistoryResumeByIdQuery,
        buildLoadSuspensionHistoryQuery: buildLoadSuspensionHistoryQuery,
        buildDeleteFacilityVersionQueries: buildDeleteFacilityVersionQueries,
        buildGetNextLogicalIdQuery: buildGetNextLogicalIdQuery,
        buildGetNextMasterIdQuery: buildGetNextMasterIdQuery,
        buildCountFacilityVersionsQuery: buildCountFacilityVersionsQuery,
        // マスターデータ参照
        buildMasterListQuery: buildMasterListQuery,
        buildMasterAllQuery: buildMasterAllQuery,
        buildMasterNameQuery: buildMasterNameQuery,
        // カウントクエリ
        buildActivePermitCountQuery: buildActivePermitCountQuery,
        buildActiveFacilityCountQuery: buildActiveFacilityCountQuery,
        buildVehicleCountQuery: buildVehicleCountQuery,
        buildOfficerCountQuery: buildOfficerCountQuery,
        buildExpiringPermitsCountQuery: buildExpiringPermitsCountQuery,
        // 許可品目参照
        buildLoadPermitItemsFlagsQuery: buildLoadPermitItemsFlagsQuery,
        buildWasteTypeMapQuery: buildWasteTypeMapQuery,
        // データメンテナンス
        buildMissingStartDateCountQuery: buildMissingStartDateCountQuery,
        buildFixMissingPermitStartDateQuery: buildFixMissingPermitStartDateQuery,
        buildFixMissingFacilityStartDateQuery: buildFixMissingFacilityStartDateQuery,
        // 個別レコード取得
        buildGetVehicleByIdQuery: buildGetVehicleByIdQuery,
        buildGetProcessingCapacityByIdQuery: buildGetProcessingCapacityByIdQuery,
        buildGetMaxBusinessIdQuery: buildGetMaxBusinessIdQuery,
        buildForeignKeyMapQuery: buildForeignKeyMapQuery
    };

    for (var key in exports) {
        if (exports.hasOwnProperty(key)) {
            global[key] = exports[key];
        }
    }

    // Node.js用: module.exports
    if (typeof module !== "undefined" && module.exports) {
        module.exports = exports;
    }

})(typeof window !== "undefined" ? window : (typeof global !== "undefined" ? global : this));

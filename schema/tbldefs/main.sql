CREATE TABLE [main] (
  [ID] AUTOINCREMENT CONSTRAINT [ID] PRIMARY KEY UNIQUE NOT NULL,
  [一般廃棄物取扱フラグ] BIT,
  [産業廃棄物取扱フラグ] BIT,
  [種別ID] SHORT,
  [処理方法ID] SHORT,
  [品目ID] DOUBLE,
  [事業者ID] DOUBLE,
  [設置形態区分ID] DOUBLE,
  [許可日] DATETIME,
  [許可番号] VARCHAR (255),
  [設置場所] VARCHAR (255),
  [廃止日] DATETIME,
  [休止日] DATETIME,
  [再開日] DATETIME,
  [時間処理能力] LONG,
  [時間処理能力単位ID] DOUBLE,
  [稼働時間] DOUBLE
)

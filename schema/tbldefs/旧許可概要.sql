CREATE TABLE [旧許可概要] (
  [履歴ID] AUTOINCREMENT CONSTRAINT [PrimaryKey] PRIMARY KEY UNIQUE NOT NULL,
  [許可区分ID] LONG,
  [許可番号] VARCHAR (255),
  [許可年月日] DATETIME,
  [許可有効年月日] DATETIME,
  [取消日] DATETIME,
  [取消理由] VARCHAR (200),
  [廃止日] DATETIME,
  [廃止理由] VARCHAR (200),
  [優良認定] BIT
)

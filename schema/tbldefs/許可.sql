CREATE TABLE [許可] (
  [許可ID] AUTOINCREMENT CONSTRAINT [Index_CE136BAE_B76C_4DF9] PRIMARY KEY UNIQUE NOT NULL,
  [許可論理ID] LONG,
  [事業者ID] LONG,
  [許可区分ID] LONG,
  [許可番号] VARCHAR (255),
  [許可年月日] DATETIME,
  [許可有効年月日] DATETIME,
  [取消日] DATETIME,
  [取消理由] VARCHAR (200),
  [廃止日] DATETIME,
  [廃止理由] VARCHAR (200),
  [優良認定] BIT,
  [有効開始日時] DATETIME,
  [有効終了日時] DATETIME,
  [作成日時] DATETIME
)

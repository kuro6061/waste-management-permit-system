CREATE TABLE [車両] (
  [車両ID] AUTOINCREMENT CONSTRAINT [PrimaryKey] PRIMARY KEY UNIQUE NOT NULL,
  [事業者ID] LONG,
  [登録番号1] VARCHAR (20),
  [登録番号2] VARCHAR (20),
  [登録番号3] VARCHAR (20),
  [登録番号4] VARCHAR (20),
  [廃車フラグ] BIT,
  [許可区分ID] LONG,
  [普通フラグ] BIT,
  [特管フラグ] BIT
)

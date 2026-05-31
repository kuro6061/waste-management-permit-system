CREATE TABLE [許可品目] (
  [許可品目ID] AUTOINCREMENT CONSTRAINT [PrimaryKey] PRIMARY KEY UNIQUE NOT NULL,
  [許可ID] LONG,
  [品目ID] LONG,
  [取り扱いフラグ] BIT,
  [積替保管フラグ] BIT
)

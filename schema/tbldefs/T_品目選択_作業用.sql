CREATE TABLE [T_品目選択_作業用] (
  [ID] AUTOINCREMENT CONSTRAINT [PrimaryKey] PRIMARY KEY UNIQUE NOT NULL,
  [品目ID] LONG,
  [品目名] VARCHAR (255),
  [追加] BIT,
  [取り扱い] BIT,
  [積替保管] BIT
)

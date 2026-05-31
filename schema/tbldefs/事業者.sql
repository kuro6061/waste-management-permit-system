CREATE TABLE [事業者] (
  [事業者ID] AUTOINCREMENT CONSTRAINT [PrimaryKey] PRIMARY KEY UNIQUE NOT NULL,
  [事業者名] VARCHAR (100),
  [事業者区分] LONG,
  [郵便番号] VARCHAR (8),
  [都道府県] VARCHAR (10),
  [市区町村町名番地] VARCHAR (100),
  [町名番地] VARCHAR (255),
  [電話番号] VARCHAR (20)
)

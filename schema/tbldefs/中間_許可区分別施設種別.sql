CREATE TABLE [中間_許可区分別施設種別] (
  [許可区分別施設種別ID] AUTOINCREMENT CONSTRAINT [PrimaryKey] PRIMARY KEY UNIQUE NOT NULL,
  [許可区分ID] LONG,
  [施設種別ID] LONG
)

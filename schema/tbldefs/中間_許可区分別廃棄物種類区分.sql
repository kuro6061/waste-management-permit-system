CREATE TABLE [中間_許可区分別廃棄物種類区分] (
  [許可区分別廃棄物種類区分ID] AUTOINCREMENT CONSTRAINT [PrimaryKey] PRIMARY KEY UNIQUE NOT NULL,
  [許可区分ID] LONG,
  [廃棄物種類区分ID] LONG
)

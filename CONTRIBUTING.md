# Adding to Wardrobe's built-in lists

You don't need to be a programmer to add a colour, a material or a type of clothing. Everything the app
offers in its lists lives in plain text files in the `data/` folder.

## Add an entry

1. Open the file for the list you want to change, for example `data/materials.json`.
2. Copy an existing entry, including its curly braces, and paste it where you want the new one to show:
   the order in the file is the order in the app.
3. Change the copy:
   - `id`: a short name in lowercase letters, digits and hyphens, such as `faux-fur`. It must be new.
     Once an entry is published, its `id` never changes, because people's saved wardrobes refer to it.
   - `name`: what the app shows, such as `Faux fur`.
   - Anything else the file uses (a colour's `hex` and `family`, a type's `parent`), copied from a
     similar entry.
4. Mind the commas: every entry except the last is followed by a comma.
5. Open a pull request. The *Check data* check tells you if anything is off, and says what.

## What each field means

Every file has a schema in `data/schema/` that describes each field, and which values are allowed. A few
worth knowing:

- **types.json**: an entry without `parent` is a group (Tops, Shoes). An entry with `parent` is a type
  inside that group and must come after it. `region` tells photo matching where on the body to look;
  `sizeSystems` lists which sizes to offer. A type can leave both out to use its group's.
- **colours.json**: `family` lets people filter by "any blue". Pick one of the families the schema lists.
- `spicy: true` on a type or material makes the app suggest the spicy flag for items that use it.
- **care.json**: add a `why` when the reason for the advice isn't obvious.

## Something the app has to treat differently

A new kind of entry that changes how the app behaves (a new body region, a new colour family) needs a
code change as well as the data. Open an issue describing it instead.

Check your change locally, if you like, with `node scripts/check-data.js`.

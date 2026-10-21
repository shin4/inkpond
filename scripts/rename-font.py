import sys
from fontTools.ttLib import TTFont
src, dst = sys.argv[1], sys.argv[2]
f = TTFont(src)
names = f["name"]
# OFL: a modified version may not keep the Reserved Font Name "Source".
for rec in list(names.names):
    if rec.nameID in (1, 3, 4, 6, 16, 17, 18, 21, 22):
        names.removeNames(nameID=rec.nameID)
for nid, value in {1: "Inkpond Glyphs", 2: "Regular", 3: "Inkpond Glyphs 1.0", 4: "Inkpond Glyphs", 6: "InkpondGlyphs-Regular"}.items():
    names.setName(value, nid, 3, 1, 0x409)
    names.setName(value, nid, 1, 0, 0)
if "CFF " in f:
    cff = f["CFF "].cff
    cff.fontNames = ["InkpondGlyphs-Regular"]
    top = cff.topDictIndex[0]
    for key in ("FullName", "FamilyName"):
        if hasattr(top, key):
            setattr(top, key, "Inkpond Glyphs")
f.flavor = "woff2"
f.save(dst)
g = TTFont(dst)
print(sorted({r.toUnicode() for r in g["name"].names if r.nameID in (1, 4, 6)}), len(g.getBestCmap()), "glyphs")
print("Source in names:", any("Source" in r.toUnicode() for r in g["name"].names if r.nameID in (1,3,4,6,16,17)))

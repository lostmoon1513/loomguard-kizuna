"""Word-level diff between two versions of a draft."""
import re
from difflib import SequenceMatcher

_TOKEN = re.compile(r"\s+|\w+|[^\w\s]", re.UNICODE)


def _merge(ops: list[dict]) -> list[dict]:
    out: list[dict] = []
    for o in ops:
        if out and out[-1]["op"] == o["op"]:
            out[-1]["text"] += o["text"]
        else:
            out.append(dict(o))
    return out


def diff_words(a: str, b: str) -> dict:
    """Returns {"ops": [{"op": "equal"|"insert"|"delete", "text": str}], "stats": {...}}."""
    ta, tb = _TOKEN.findall(a), _TOKEN.findall(b)
    # trim the common start and end first: edits are usually small, and this keeps big drafts fast
    lo = 0
    while lo < len(ta) and lo < len(tb) and ta[lo] == tb[lo]:
        lo += 1
    hi_a, hi_b = len(ta), len(tb)
    while hi_a > lo and hi_b > lo and ta[hi_a - 1] == tb[hi_b - 1]:
        hi_a -= 1
        hi_b -= 1
    ops: list[dict] = []
    if lo:
        ops.append({"op": "equal", "text": "".join(ta[:lo])})
    ma, mb = ta[lo:hi_a], tb[lo:hi_b]
    sm = SequenceMatcher(None, ma, mb, autojunk=len(ma) + len(mb) > 4000)
    for tag, i1, i2, j1, j2 in sm.get_opcodes():
        if tag == "equal":
            ops.append({"op": "equal", "text": "".join(ma[i1:i2])})
        else:
            if i2 > i1:
                ops.append({"op": "delete", "text": "".join(ma[i1:i2])})
            if j2 > j1:
                ops.append({"op": "insert", "text": "".join(mb[j1:j2])})
    if hi_a < len(ta):
        ops.append({"op": "equal", "text": "".join(ta[hi_a:])})
    ops = _merge(ops)

    def words(kind: str) -> int:
        return sum(len(re.findall(r"\w+", o["text"])) for o in ops if o["op"] == kind)

    return {"ops": ops, "stats": {"added_words": words("insert"), "removed_words": words("delete"),
                                  "unchanged_words": words("equal")}}
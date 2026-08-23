
"""Report face counts for every bundled InsightFace test image."""
import glob
import os
import sys

_HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, _HERE)
os.chdir(_HERE)

import numpy as np
import insightface
from services.faces import detect_faces

img_dir = os.path.join(os.path.dirname(insightface.__file__), "data", "images")
for path in sorted(glob.glob(os.path.join(img_dir, "*"))):
    with open(path, "rb") as fh:
        raw = fh.read()
    faces = detect_faces(raw)
    norms = [round(float(np.linalg.norm(f.embedding)), 3) for f in faces]
    print("%-24s faces=%d norms=%s" % (os.path.basename(path), len(faces), norms))
print("SCAN_DONE")

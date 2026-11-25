"""Find editable PowerPoint objects that need a layout review."""
import json
import sys
from collections import defaultdict

from pptx import Presentation
from pptx.util import Inches


def audit(deck):
    tolerance = Inches(4 / 96)
    findings = []
    for page, slide in enumerate(deck.slides, 1):
        texts = defaultdict(list)
        outside = repeated = 0
        for shape in slide.shapes:
            left, top = shape.left, shape.top
            right, bottom = left + shape.width, top + shape.height
            if (left < -tolerance or top < -tolerance
                    or right > deck.slide_width + tolerance
                    or bottom > deck.slide_height + tolerance):
                outside += 1
            if not shape.has_text_frame:
                continue
            content = " ".join(shape.text.split())
            if not content:
                continue
            for x, y, w, h in texts[content]:
                if (abs(left - x) <= tolerance and abs(top - y) <= tolerance
                        and min(shape.width, w) > tolerance and min(shape.height, h) > tolerance):
                    repeated += 1
                    break
            texts[content].append((left, top, shape.width, shape.height))
        if outside or repeated:
            findings.append({"page": page, "outOfBounds": outside, "overlappingText": repeated})
    return findings


if __name__ == "__main__":
    print(json.dumps(audit(Presentation(sys.argv[1]))))

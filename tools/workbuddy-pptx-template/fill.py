import argparse
import json
import re
from pathlib import Path

from pptx import Presentation
from pptx.enum.shapes import MSO_SHAPE_TYPE

MARKER = re.compile(r"\{\{([a-z][a-z0-9_]*)\}\}")


def text_runs(shapes):
    for shape in shapes:
        if shape.shape_type == MSO_SHAPE_TYPE.GROUP:
            yield from text_runs(shape.shapes)
        if shape.has_text_frame:
            for paragraph in shape.text_frame.paragraphs:
                yield from paragraph.runs


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("template", type=Path)
    parser.add_argument("fills", type=Path)
    parser.add_argument("output", type=Path)
    args = parser.parse_args()
    deck = Presentation(args.template)
    slots = {}
    for slide in deck.slides:
        for run in text_runs(slide.shapes):
            match = MARKER.fullmatch(run.text)
            if match:
                name = match[1]
                if name in slots:
                    parser.error(f"Duplicate slot: {name}")
                slots[name] = run
    fills = json.loads(args.fills.read_text(encoding="utf-8-sig"))
    if not slots or not isinstance(fills, dict) or fills.keys() != slots.keys():
        parser.error(f"Expected exactly these slots: {', '.join(slots)}")
    for name, value in fills.items():
        if not isinstance(value, str) or not value.strip() or len(value.splitlines()) != 1 or MARKER.search(value):
            parser.error(f"Invalid text for slot: {name}")
        slots[name].text = value.strip()
    with args.output.open("xb") as output:
        deck.save(output)


if __name__ == "__main__":
    main()

"""Verify a spike result without containing any teaching data in the repository."""
import json,re,sys
from pathlib import Path
from pptx import Presentation
folder=Path(sys.argv[1]);scene=json.loads((folder/'scene.json').read_text('utf-8'))
deck=Presentation(next(folder.glob('*.pptx')))
normalize=lambda s:re.sub(r'\s+','',s)
assert len(deck.slides)==len(scene['pages'])
for i,(slide,page) in enumerate(zip(deck.slides,scene['pages']),1):
 actual=''.join(s.text for s in slide.shapes if s.has_text_frame)
 expected=''.join(o['text'] for o in page['objects'] if o['kind']=='text')
 assert normalize(actual)==normalize(expected),f'Page {i} native text mismatch'
 assert page['speech'] and slide.notes_slide.notes_text_frame.text==page['speech'],f'Page {i} notes mismatch'
 assert any(s.has_text_frame and s.text.strip() for s in slide.shapes),f'Page {i} has no editable text'
print(f'PASS: {len(deck.slides)} pages, native text and complete per-page speeches preserved.')

"""Native HTML-layout exporter. SVG fragments remain images; no model calls."""
import base64,io,json,os,re,sys
from pathlib import Path
from pptx import Presentation
from pptx.util import Inches,Pt
from pptx.dml.color import RGBColor
from pptx.enum.shapes import MSO_SHAPE,MSO_CONNECTOR
from pptx.enum.text import MSO_ANCHOR
from pptx.oxml.xmlchemy import OxmlElement

folder=Path(sys.argv[1]); data=json.loads((folder/'scene.json').read_text('utf-8')); deck=Presentation()
deck.slide_width=Inches(1280/96);deck.slide_height=Inches(720/96)
def unit(px): return Inches(px/96)
def color(value):
 values=re.findall(r'[\d.]+',value or '')
 return RGBColor(*(int(float(x)) for x in values[:3])) if len(values)>=3 else RGBColor(255,255,255)
def opacity(element,value):
 values=re.findall(r'[\d.]+',value or '')
 if len(values)==4 and float(values[3])<1:
  alpha=OxmlElement('a:alpha');alpha.set('val',str(round(float(values[3])*100000)));element.append(alpha)
def fill(shape,o):
 gradient=o.get('gradient','none')
 stops=re.findall(r'rgba?\([^)]+\)',gradient)
 if len(stops)>=2:
  shape.fill.gradient();shape.fill.gradient_stops[0].color.rgb=color(stops[0]);shape.fill.gradient_stops[1].color.rgb=color(stops[-1]);shape.fill.gradient_angle=90
 else:
  shape.fill.solid();shape.fill.fore_color.rgb=color(o.get('color'));opacity(shape._element.spPr.xpath('./a:solidFill/a:srgbClr')[0],o.get('color'))
 shape.line.fill.background()
counts=[]
for index,page in enumerate(data['pages']):
 slide=deck.slides.add_slide(deck.slide_layouts[6]);count={'text':0,'shapes':0,'images':0,'svgFragments':0}
 for o in page['objects']:
  kind=o['kind'];x,y,w,h=[unit(o.get(n,0)) for n in ['x','y','w','h']]
  if kind=='rect':
   shape=slide.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE if o.get('radius') else MSO_SHAPE.RECTANGLE,x,y,w,h);fill(shape,o)
   if o.get('radius') and min(o['w'],o['h'])>0: shape.adjustments[0]=min(.5,o['radius']/min(o['w'],o['h']))
   count['shapes']+=1
  elif kind=='line':
   a,b,c,d=o['points'];shape=slide.shapes.add_connector(MSO_CONNECTOR.STRAIGHT,unit(a),unit(b),unit(c),unit(d));shape.line.color.rgb=color(o['color']);shape.line.width=Pt(o['width']*.75);count['shapes']+=1
  elif kind=='text':
   shape=slide.shapes.add_textbox(x,y,w+unit(2),max(h,unit(o['size']*1.3)));frame=shape.text_frame;frame.clear();frame.word_wrap=False
   frame.margin_left=frame.margin_right=frame.margin_top=frame.margin_bottom=0;frame.vertical_anchor=MSO_ANCHOR.TOP
   p=frame.paragraphs[0];p.space_before=p.space_after=Pt(0);p.line_spacing=1.0
   run=p.add_run();run.text=o['text'];font=run.font;font.name=o['font'].split(',')[0].strip(' "\'');font.size=Pt(o['size']*.75);font.bold=int(o['weight'])>=600 if o['weight'].isdigit() else o['weight']=='bold';font.italic=o['italic'];font.color.rgb=color(o['color']);font.underline='underline' in o['decoration'];count['text']+=1
  elif kind in ['image','raster']:
   if kind=='raster': stream=str(folder/o['file']);count['svgFragments']+=1
   else:
    if not o['src'].startswith('data:image/'): raise ValueError('Only embedded source images are supported')
    stream=io.BytesIO(base64.b64decode(o['src'].split(',',1)[1]));count['images']+=1
   picture=slide.shapes.add_picture(stream,x,y,w,h)
   for edge,value in o.get('crop',{}).items():setattr(picture,'crop_'+edge,value)
  # PowerPoint's default shape style adds a theme shadow absent in the HTML.
  if kind in ['rect','line']:
   shape._element.spPr.append(OxmlElement('a:effectLst'))
 slide.notes_slide.notes_text_frame.text=page.get('speech','')+('\n\n'+page['notes'] if page.get('notes') else '')
 counts.append(count)
 # Per-page checkpoint: each successful save contains every completed page.
 target=folder/'lesson.pptx';temporary=folder/'lesson.partial';deck.save(str(temporary));os.replace(temporary,target)
 (folder/'progress.json').write_text(json.dumps({'completed':index+1,'total':len(data['pages']),'stage':'ppt saved'}),encoding='utf-8')
 print(json.dumps({'type':'local_export_progress','stage':'exporting','completed':index+1,'total':len(data['pages']),'message':f'已导出 {index+1} / {len(data["pages"])} 页及对应讲稿'},ensure_ascii=False),flush=True)
(folder/'report.json').write_text(json.dumps({'counts':counts,'warnings':[p['warnings'] for p in data['pages']]},ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps({'pages':len(deck.slides),'nativeTextRuns':sum(c['text'] for c in counts),'svgRasterFragments':sum(c['svgFragments'] for c in counts)}))

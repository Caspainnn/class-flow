from pathlib import Path
import sys
import win32com.client
sys.stdout.reconfigure(encoding='utf-8')
work=Path(__file__).parent
source=work.parent.parent/'Word文档/第四章 PPT管理.docx'
destination=work/'排版检查/第四章 PPT管理.pdf'
word=None
opened=None
try:
    word=win32com.client.DispatchEx('Word.Application')
    word.Visible=False
    word.DisplayAlerts=0
    word.AutomationSecurity=3
    opened=word.Documents.Open(str(source),ConfirmConversions=False,ReadOnly=False,AddToRecentFiles=False,Visible=False)
    opened.Repaginate()
    opened.Fields.Update()
    opened.Repaginate()
    opened.Fields.Update()
    opened.Save()
    opened.ExportAsFixedFormat(str(destination),17,OpenAfterExport=False)
    print('PAGES',opened.ComputeStatistics(2))
    print(str(destination))
finally:
    if opened is not None:opened.Close(False)
    if word is not None:word.Quit()

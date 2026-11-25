from pathlib import Path
import sys
import win32com.client

sys.stdout.reconfigure(encoding='utf-8')
root = Path(__file__).resolve().parents[2]
qa = Path(__file__).parent / '排版检查'
word = None
opened = None
try:
    word = win32com.client.DispatchEx('Word.Application')
    word.Visible = False
    word.DisplayAlerts = 0
    word.AutomationSecurity = 3
    for source, destination, editable in [
        (root / '工作文件' / '参考模板' / '排版参考.docx', qa / 'template.pdf', False),
        (root / 'Word文档' / '第三章 课程管理.docx', qa / '第三章 课程管理.pdf', True),
    ]:
        opened = word.Documents.Open(str(source), ConfirmConversions=False,
                                     ReadOnly=not editable, AddToRecentFiles=False,
                                     Visible=False)
        if editable:
            opened.Repaginate()
            opened.Fields.Update()
            opened.Repaginate()
            opened.Fields.Update()
            opened.Save()
        opened.ExportAsFixedFormat(str(destination), 17, OpenAfterExport=False)
        print(source.name, 'PAGES', opened.ComputeStatistics(2), 'PDF', destination)
        opened.Close(False)
        opened = None
finally:
    if opened is not None:
        opened.Close(False)
    if word is not None:
        word.Quit()

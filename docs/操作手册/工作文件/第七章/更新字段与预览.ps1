$ErrorActionPreference='Stop'
$taskFolder='E:/MyProjects/Inclass/docs/操作手册/工作文件/第七章'
$manualFolder=Split-Path -Parent (Split-Path -Parent $taskFolder)
$documentPath=[System.IO.Path]::GetFullPath((Join-Path $manualFolder 'Word文档/第七章 学情管理.docx'))
$pdfPath=[System.IO.Path]::GetFullPath((Join-Path $taskFolder '排版检查/第七章内部预览.pdf'))
$wordApp=New-Object -ComObject Word.Application
$wordApp.Visible=$false
$wordApp.DisplayAlerts=0
$wordApp.AutomationSecurity=3
$opened=$null
try {
  $opened=$wordApp.Documents.Open($documentPath,$false,$false,$false)
  $opened.Repaginate()
  [void]$opened.Fields.Update()
  $opened.Repaginate()
  [void]$opened.Fields.Update()
  $opened.Save()
  $opened.SaveAs2($pdfPath,17)
  Write-Output ('Pages: '+$opened.ComputeStatistics(2))
} finally {
  if($null -ne $opened){$opened.Close(0)}
  $wordApp.Quit()
  [void][System.Runtime.InteropServices.Marshal]::FinalReleaseComObject($wordApp)
}

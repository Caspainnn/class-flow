$ErrorActionPreference='Stop'
$taskFolder='E:/MyProjects/Inclass/docs/操作手册/工作文件/第六章'
$manualFolder=Split-Path -Parent (Split-Path -Parent $taskFolder)
$documentPath=[System.IO.Path]::GetFullPath((Join-Path $manualFolder 'Word文档/第六章 签到管理.docx'))
$pdfPath=[System.IO.Path]::GetFullPath((Join-Path $taskFolder '排版检查/第六章内部预览.pdf'))
Write-Output 'Starting Word'
$wordApp=New-Object -ComObject Word.Application
$wordApp.Visible=$false
$wordApp.DisplayAlerts=0
$wordApp.AutomationSecurity=3
$opened=$null
try {
  Write-Output 'Opening document'
  $opened=$wordApp.Documents.Open($documentPath,$false,$false,$false)
  Write-Output 'Updating page references'
  $opened.Repaginate()
  [void]$opened.Fields.Update()
  $opened.Repaginate()
  [void]$opened.Fields.Update()
  $opened.Save()
  Write-Output 'Exporting internal preview'
  $opened.SaveAs2($pdfPath,17)
  Write-Output 'Preview exported'
  Write-Output ('Pages: '+$opened.ComputeStatistics(2))
} finally {
  if($null -ne $opened){$opened.Close(0)}
  $wordApp.Quit()
  [void][System.Runtime.InteropServices.Marshal]::FinalReleaseComObject($wordApp)
}

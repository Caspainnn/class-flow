$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$docx = Join-Path (Split-Path (Split-Path $root -Parent) -Parent) 'Word文档\第九章 设置.docx'
$qa = Join-Path $root '排版检查'
New-Item -ItemType Directory -Force -Path $qa | Out-Null
$pdf = Join-Path $qa '第九章 设置.pdf'
$word = New-Object -ComObject Word.Application
$word.Visible = $false
$word.DisplayAlerts = 0
try {
  $doc = $word.Documents.Open($docx)
  foreach ($toc in $doc.TablesOfContents) { $toc.Update() }
  foreach ($field in $doc.Fields) { $field.Update() | Out-Null }
  foreach ($section in $doc.Sections) {
    foreach ($header in $section.Headers) { foreach ($field in $header.Range.Fields) { $field.Update() | Out-Null } }
    foreach ($footer in $section.Footers) { foreach ($field in $footer.Range.Fields) { $field.Update() | Out-Null } }
  }
  $doc.Save()
  $doc.ExportAsFixedFormat($pdf, 17)
  $doc.Close()
} finally {
  $word.Quit()
  [System.Runtime.InteropServices.Marshal]::ReleaseComObject($word) | Out-Null
}
Write-Output $pdf

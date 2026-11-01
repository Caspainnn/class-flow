param([Parameter(Mandatory=$true)][string]$InputFile,[Parameter(Mandatory=$true)][string]$OutputDir)
$ErrorActionPreference='Stop'
$app=$null
$deck=$null
$security=$null
$quitWhenDone=$false
$mutex=$null
$ownsMutex=$false
try {
  $inputPath=(Resolve-Path -LiteralPath $InputFile).Path
  $outputPath=(Resolve-Path -LiteralPath $OutputDir).Path
  $cancelFile=Join-Path $outputPath 'cancel.flag'
  $mutex=[Threading.Mutex]::new($false,'Local\InclassPptTemplateRender')
  while(!$ownsMutex){
    if(Test-Path -LiteralPath $cancelFile){throw 'Template rendering cancelled'}
    try {$ownsMutex=$mutex.WaitOne(250)}catch [Threading.AbandonedMutexException] {$ownsMutex=$true}
  }
  if(Test-Path -LiteralPath $cancelFile){throw 'Template rendering cancelled'}
  $app=New-Object -ComObject PowerPoint.Application
  $quitWhenDone=($app.Presentations.Count -eq 0 -and $app.Visible -eq 0)
  $security=$app.AutomationSecurity
  $app.AutomationSecurity=3
  $deck=$app.Presentations.Open($inputPath,-1,0,0)
  $count=$deck.Slides.Count
  if($count -lt 1 -or $count -gt 150){throw 'Invalid template page count'}
  $width=1280
  $height=[int][Math]::Round($width*$deck.PageSetup.SlideHeight/$deck.PageSetup.SlideWidth)
  for($i=1;$i -le $count;$i++){
    if(Test-Path -LiteralPath $cancelFile){throw 'Template rendering cancelled'}
    $slide=$deck.Slides.Item($i)
    try {$slide.Export((Join-Path $outputPath ('{0:d3}.png' -f $i)),'PNG',$width,$height)}
    finally {[void][Runtime.InteropServices.Marshal]::FinalReleaseComObject($slide)}
  }
  [Console]::WriteLine($count)
} finally {
  try {if($deck){try {$deck.Close()}finally {[void][Runtime.InteropServices.Marshal]::FinalReleaseComObject($deck)}}}
  finally {
    try {if($app){try {if($null -ne $security){$app.AutomationSecurity=$security};if($quitWhenDone -and $app.Presentations.Count -eq 0){$app.Quit()}}finally {[void][Runtime.InteropServices.Marshal]::FinalReleaseComObject($app)}}}
    finally {if($ownsMutex){$mutex.ReleaseMutex()};if($mutex){$mutex.Dispose()};[GC]::Collect();[GC]::WaitForPendingFinalizers()}
  }
}

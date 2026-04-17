$r = Invoke-WebRequest -Uri 'http://localhost:3002' -UseBasicParsing
$h = $r.Content
Write-Host ("hero: " + $h.Contains("给灵魂开个 GitHub"))
Write-Host ("feat: " + $h.Contains("核心能力"))
Write-Host ("tmpl: " + $h.Contains("模板体系"))
Write-Host ("summ: " + $h.Contains("3 个示例 Relic"))

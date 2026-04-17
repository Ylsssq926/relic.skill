$r = Invoke-WebRequest -Uri 'http://localhost:3002' -UseBasicParsing
$h = $r.Content

# Find all <section tags and their immediate content length
$pattern = '<section[^>]*>(.*?)</section>'
$matches = [regex]::Matches($h, $pattern, [System.Text.RegularExpressions.RegexOptions]::Singleline)

Write-Host ("Total sections found: " + $matches.Count)
foreach ($m in $matches) {
    $len = $m.Groups[1].Value.Length
    $preview = $m.Groups[1].Value.Substring(0, [Math]::Min(200, $len))
    Write-Host ("--- Section len=$len ---")
    Write-Host $preview
    Write-Host ""
}

$r = Invoke-WebRequest -Uri 'http://localhost:3002' -UseBasicParsing
$h = $r.Content

# Check if hero title exists in raw HTML
$checks = @(
    @{ name='hero title'; pattern='给灵魂开个 GitHub' },
    @{ name='hero subtitle'; pattern='万物皆可 Relic' },
    @{ name='summary'; pattern='3 个示例 Relic' },
    @{ name='features'; pattern='核心能力' },
    @{ name='templates'; pattern='模板体系' },
    @{ name='examples'; pattern='示例展示' }
)

foreach ($c in $checks) {
    if ($h.Contains($c.pattern)) {
        Write-Host ("FOUND: " + $c.name)
    } else {
        Write-Host ("MISSING: " + $c.name)
    }
}

# Also check the first section (hero) for h1 tag
$idx = $h.IndexOf('<section')
if ($idx -gt 0) {
    $firstSection = $h.Substring($idx, [Math]::Min(500, $h.Length - $idx))
    Write-Host ""
    Write-Host "=== First 500 chars of first section ==="
    Write-Host $firstSection
}

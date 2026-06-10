$output = docker inspect open-design --format "{{.State.Status}} {{.State.StartedAt}}"
$output | Out-File -FilePath "e:\workspace\projects\open-design\deploy\result.txt"
Write-Output $output

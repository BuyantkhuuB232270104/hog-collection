# Hog tsugluulaltyn system - Windows deer bugdiig suulgana (Node.js, PostgreSQL, VS Code, DB, .env, seed)
# Ajilluulah: SETUP.bat-iig davhar darna  (esvel)  powershell -ExecutionPolicy Bypass -File setup-windows.ps1
$ErrorActionPreference = 'Stop'
$Root    = $PSScriptRoot
$PgSuper = 'postgres123'   # PostgreSQL shineer suulgaval postgres-iin nuuts ug
$DbPass  = 'hog123'

function Step($t) { Write-Host "`n=== $t ===" -ForegroundColor Cyan }
function Refresh-Path { $env:Path = [Environment]::GetEnvironmentVariable('Path','Machine') + ';' + [Environment]::GetEnvironmentVariable('Path','User') }
function WG($id, $extra) {
  $a = @('install','--id',$id,'-e','--accept-package-agreements','--accept-source-agreements') + $extra
  & winget @a
}
if (-not (Get-Command winget -ErrorAction SilentlyContinue)) { throw "winget baihgui. Microsoft Store-oos 'App Installer' suulgaad dahin ajilluulna uu." }

Step '1/7 Node.js'
Refresh-Path
if (Get-Command node -ErrorAction SilentlyContinue) { Write-Host "Suusan: $(node -v)" } else { WG 'OpenJS.NodeJS.LTS' @('--silent'); Refresh-Path }

Step '2/7 Visual Studio Code'
if (Get-Command code -ErrorAction SilentlyContinue) { Write-Host 'Suusan' } else { WG 'Microsoft.VisualStudioCode' @('--silent'); Refresh-Path }

Step '3/7 PostgreSQL 16'
$psql = Get-ChildItem 'C:\Program Files\PostgreSQL\*\bin\psql.exe' -ErrorAction SilentlyContinue | Sort-Object FullName | Select-Object -Last 1
if ($psql) {
  Write-Host "Suusan: $($psql.FullName)"
  $sec = Read-Host 'postgres hereglegchiin nuuts ugee oruulna uu' -AsSecureString
  $PgSuper = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($sec))
} else {
  WG 'PostgreSQL.PostgreSQL.16' @('--override', "--mode unattended --unattendedmodeui none --superpassword $PgSuper --serverport 5432")
  $psql = Get-ChildItem 'C:\Program Files\PostgreSQL\*\bin\psql.exe' | Sort-Object FullName | Select-Object -Last 1
  Write-Host "postgres hereglegchiin nuuts ug: $PgSuper"
}
$psql = $psql.FullName

Step '4/7 Ogogdliin san: hog, hog_test'
$env:PGPASSWORD = $PgSuper
function PG($db, $sql) { $o = & $psql -U postgres -h localhost -p 5432 -d $db -tAc $sql; if ($LASTEXITCODE) { throw "psql aldaa: $sql" }; return $o }
if (-not (PG 'postgres' "SELECT 1 FROM pg_roles WHERE rolname='hog'")) { PG 'postgres' "CREATE ROLE hog LOGIN PASSWORD '$DbPass'" | Out-Null }
else { PG 'postgres' "ALTER ROLE hog PASSWORD '$DbPass'" | Out-Null }
foreach ($db in 'hog','hog_test') {
  if (-not (PG 'postgres' "SELECT 1 FROM pg_database WHERE datname='$db'")) { PG 'postgres' "CREATE DATABASE $db OWNER hog" | Out-Null }
  PG $db 'CREATE EXTENSION IF NOT EXISTS btree_gist' | Out-Null
  PG $db 'ALTER SCHEMA public OWNER TO hog' | Out-Null
}
Remove-Item Env:PGPASSWORD

Step '5/7 server\.env'
$envFile = Join-Path $Root 'server\.env'
if (-not (Test-Path $envFile)) {
  $jwt = -join ((48..57 + 65..90 + 97..122) | Get-Random -Count 48 | ForEach-Object { [char]$_ })
  "DATABASE_URL=postgres://hog:$DbPass@localhost:5432/hog`r`nJWT_SECRET=$jwt`r`nPORT=3000`r`nUPLOAD_DIR=uploads" | Set-Content -Path $envFile -Encoding ascii
  Write-Host 'Uuslee'
} else { Write-Host 'Baina (oorchlohgui)' }

Step '6/7 npm modul, build, jishee ogogdol'
Set-Location $Root
$need = -not (Test-Path 'server\node_modules\express') -or -not (Test-Path 'client\node_modules\vite') -or -not (Test-Path 'server\node_modules\@node-rs\argon2-win32-x64-msvc')
if ($need) { npm.cmd run install:all; if ($LASTEXITCODE) { throw 'npm install amjiltgui' } } else { Write-Host 'node_modules bairlaj baina (Windows-iin binary oruulsan)' }
if (-not (Test-Path 'client\dist\index.html')) { npm.cmd run build; if ($LASTEXITCODE) { throw 'build amjiltgui' } }
npm.cmd run db:seed; if ($LASTEXITCODE) { throw 'db:seed amjiltgui' }

Step '7/7 VS Code neej baina'
Refresh-Path
if (Get-Command code -ErrorAction SilentlyContinue) { code $Root } else { Write-Host 'VS Code-iig garaar neej, File > Open Folder > ' $Root }
Write-Host "`nBELEN. VS Code dotor: Ctrl+Shift+B  (esvel Terminal > Run Task > '1. Sistem asaah') -> http://localhost:3000" -ForegroundColor Green
Write-Host 'Nevtreh: 99000001 / 90000002 / 90000003 / 90000005 / 90000001, nuuts ug Demo12345' -ForegroundColor Green
Read-Host 'Enter darj haana'

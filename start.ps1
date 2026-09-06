# CrediiFlow 1-Click Startup Script for Windows PowerShell
Write-Host "======================================================" -ForegroundColor Cyan
Write-Host "Starting CrediiFlow Multi-Tenant SaaS Platform..." -ForegroundColor Cyan
Write-Host "======================================================" -ForegroundColor Cyan

$root = $PSScriptRoot

# 1. Check PostgreSQL on Port 5432
Write-Host "`n[1/4] Checking PostgreSQL database on port 5432..." -ForegroundColor Yellow
$pgCheck = Test-NetConnection -ComputerName 127.0.0.1 -Port 5432 -WarningAction SilentlyContinue
if (-not $pgCheck.TcpTestSucceeded) {
    Write-Host "Starting PostgreSQL container..." -ForegroundColor Gray
    try {
        docker start doit_db 2>$null
        if ($LASTEXITCODE -ne 0) {
            docker start pg 2>$null
        }
    } catch {}
    Start-Sleep -Seconds 2
} else {
    Write-Host "PostgreSQL is running and healthy on port 5432." -ForegroundColor Green
}

# 2. Bootstrap Database Tables & Seeds
Write-Host "`n[2/4] Bootstrapping master and tenant databases..." -ForegroundColor Yellow
$backendDir = Join-Path $root "backend"
$pythonExe = Join-Path $backendDir "venv\Scripts\python.exe"
if (-not (Test-Path $pythonExe)) { $pythonExe = "python" }

& $pythonExe (Join-Path $backendDir "scripts\bootstrap.py")

# 3. Launch Backend in a new window
Write-Host "`n[3/4] Starting FastAPI Backend on http://localhost:8000..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$backendDir'; .\venv\Scripts\Activate.ps1; uvicorn app.main:app --reload --port 8000"

# 4. Launch Frontends in new windows
Write-Host "`n[4/4] Starting Web Applications..." -ForegroundColor Yellow
$frontendDir = Join-Path $root "frontend"
$superadminDir = Join-Path $root "superadmin-frontend"
$landingDir = Join-Path $root "landing-page"

Write-Host " -> Tenant App: http://localhost:3000" -ForegroundColor Green
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$frontendDir'; npm run dev"

Write-Host " -> SuperAdmin: http://localhost:3001" -ForegroundColor Green
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$superadminDir'; npm run dev"

Write-Host " -> Landing Page: http://localhost:3002" -ForegroundColor Green
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$landingDir'; npm run dev -- -p 3002"

Start-Sleep -Seconds 4
Write-Host "`n======================================================" -ForegroundColor Cyan
Write-Host "All services started! Opening http://localhost:3000" -ForegroundColor Cyan
Write-Host "Tenant Admin Login: 7900671145 | Password: pass123" -ForegroundColor White
Write-Host "SuperAdmin Login:   superadmin | Password: superpass123" -ForegroundColor White
Write-Host "======================================================" -ForegroundColor Cyan
Start-Process "http://localhost:3000"

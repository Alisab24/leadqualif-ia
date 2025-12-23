# start-all.ps1
# Script PowerShell pour lancer les deux serveurs (Backend Flask + Frontend React)

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "🚀 Démarrage de LeadQualif IA" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Vérifier que Node.js est installé
Write-Host "🔍 Vérification de Node.js..." -ForegroundColor Yellow
try {
    $nodeVersion = node --version
    Write-Host "   ✅ Node.js installé : $nodeVersion" -ForegroundColor Green
} catch {
    Write-Host "   ❌ Node.js n'est pas installé" -ForegroundColor Red
    Write-Host "   💡 Installez Node.js depuis https://nodejs.org/" -ForegroundColor Yellow
    exit 1
}

Write-Host ""

# Terminal 1 : Backend Flask (WSL)
Write-Host "📦 Lancement du serveur Flask (Backend)..." -ForegroundColor Yellow
Write-Host "   Port : http://localhost:5000" -ForegroundColor White

Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd C:\Users\hp\Hp\nexap\backend; Write-Host '🚀 Serveur Flask - Backend' -ForegroundColor Cyan; Write-Host ''; wsl bash -c 'cd /mnt/c/Users/hp/Hp/nexap/backend && source venv/bin/activate && python run.py'"

# Attendre un peu pour que le backend démarre
Write-Host "   ⏳ Attente du démarrage du backend..." -ForegroundColor Gray
Start-Sleep -Seconds 5

# Terminal 2 : Frontend React
Write-Host "⚛️  Lancement du serveur React (Frontend)..." -ForegroundColor Yellow
Write-Host "   Port : http://localhost:5173" -ForegroundColor White

Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd C:\Users\hp\Hp\nexap; Write-Host '⚛️  Serveur React - Frontend' -ForegroundColor Cyan; Write-Host ''; npm run dev"

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "✅ Les deux serveurs sont en cours de démarrage" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "📍 URLs disponibles :" -ForegroundColor White
Write-Host "   Backend  : http://localhost:5000" -ForegroundColor Cyan
Write-Host "   Frontend : http://localhost:5173" -ForegroundColor Cyan
Write-Host ""
Write-Host "🔐 Pour vous connecter :" -ForegroundColor White
Write-Host "   1. Allez sur http://localhost:5173/login" -ForegroundColor Gray
Write-Host "   2. Username : agent01" -ForegroundColor Gray
Write-Host "   3. Password : secretpass" -ForegroundColor Gray
Write-Host ""
Write-Host "💡 Les deux terminaux doivent rester ouverts !" -ForegroundColor Yellow
Write-Host ""





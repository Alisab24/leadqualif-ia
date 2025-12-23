# Script PowerShell pour vérifier l'installation de Python
# Usage: .\check_python.ps1

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "🐍 Vérification de Python" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Test 1: Vérifier si Python est installé
Write-Host "1️⃣  Vérification de Python..." -ForegroundColor Yellow
try {
    $pythonVersion = python --version 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "   ✅ Python est installé" -ForegroundColor Green
        Write-Host "   📊 Version: $pythonVersion" -ForegroundColor White
    } else {
        Write-Host "   ❌ Python n'est pas reconnu" -ForegroundColor Red
        Write-Host ""
        Write-Host "   💡 Solutions:" -ForegroundColor Yellow
        Write-Host "      1. Installez Python depuis le Microsoft Store" -ForegroundColor White
        Write-Host "      2. OU téléchargez depuis https://www.python.org/downloads/" -ForegroundColor White
        Write-Host "      3. Cochez 'Add Python to PATH' lors de l'installation" -ForegroundColor White
        Write-Host "      4. Redémarrez PowerShell après l'installation" -ForegroundColor White
        Write-Host ""
        Write-Host "   📚 Consultez INSTALL_PYTHON_WINDOWS.md pour plus d'aide" -ForegroundColor Cyan
        exit 1
    }
} catch {
    Write-Host "   ❌ Python n'est pas installé ou n'est pas dans le PATH" -ForegroundColor Red
    Write-Host ""
    Write-Host "   💡 Installez Python depuis le Microsoft Store ou python.org" -ForegroundColor Yellow
    Write-Host "   📚 Consultez INSTALL_PYTHON_WINDOWS.md" -ForegroundColor Cyan
    exit 1
}

Write-Host ""

# Test 2: Vérifier si pip est installé
Write-Host "2️⃣  Vérification de pip..." -ForegroundColor Yellow
try {
    $pipVersion = pip --version 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "   ✅ pip est installé" -ForegroundColor Green
        Write-Host "   📊 $pipVersion" -ForegroundColor White
    } else {
        Write-Host "   ⚠️  pip n'est pas reconnu" -ForegroundColor Yellow
        Write-Host "   💡 Essayez: python -m pip --version" -ForegroundColor White
    }
} catch {
    Write-Host "   ⚠️  pip n'est pas reconnu" -ForegroundColor Yellow
}

Write-Host ""

# Test 3: Vérifier si Python peut exécuter du code
Write-Host "3️⃣  Test d'exécution Python..." -ForegroundColor Yellow
try {
    $test = python -c "print('OK')" 2>&1
    if ($test -eq "OK") {
        Write-Host "   ✅ Python fonctionne correctement" -ForegroundColor Green
    } else {
        Write-Host "   ⚠️  Python a des problèmes" -ForegroundColor Yellow
    }
} catch {
    Write-Host "   ⚠️  Erreur lors du test" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "✅ Vérification terminée" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Vérifier si on est dans le dossier backend
if (Test-Path "requirements.txt") {
    Write-Host "💡 Vous êtes dans le dossier backend" -ForegroundColor Cyan
    Write-Host "   Vous pouvez maintenant lancer: python run.py" -ForegroundColor White
} else {
    Write-Host "💡 Pour lancer le serveur Flask:" -ForegroundColor Cyan
    Write-Host "   cd backend" -ForegroundColor White
    Write-Host "   python run.py" -ForegroundColor White
}

Write-Host ""







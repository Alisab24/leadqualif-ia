#!/bin/bash
# Script pour corriger les fins de ligne de start.sh
# Usage: ./fix_start.sh

if command -v dos2unix > /dev/null 2>&1; then
    dos2unix start.sh
    echo "✅ Fins de ligne corrigées avec dos2unix"
elif command -v sed > /dev/null 2>&1; then
    sed -i 's/\r$//' start.sh
    echo "✅ Fins de ligne corrigées avec sed"
else
    echo "⚠️  Installez dos2unix pour corriger les fins de ligne:"
    echo "   sudo apt install dos2unix"
    echo "   dos2unix start.sh"
fi

chmod +x start.sh
echo "✅ Permissions d'exécution ajoutées"






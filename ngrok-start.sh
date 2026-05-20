#!/bin/bash
# Arranca ngrok y actualiza PUBLIC_API_URL en la app automáticamente

API_PORT=3001
APP_API="http://localhost:${API_PORT}"

# Matar instancia previa si existe
pkill -f "ngrok http ${API_PORT}" 2>/dev/null
sleep 1

# Arrancar ngrok en background
ngrok http ${API_PORT} --log=stdout > /tmp/ngrok.log 2>&1 &
NGROK_PID=$!

# Esperar a que esté listo
echo "Arrancando ngrok..."
for i in {1..10}; do
    URL=$(curl -s http://localhost:4040/api/tunnels 2>/dev/null | python3 -c "import sys,json; t=json.load(sys.stdin)['tunnels']; print(next((x['public_url'] for x in t if x['proto']=='https'), ''))" 2>/dev/null)
    if [ -n "$URL" ]; then
        break
    fi
    sleep 1
done

if [ -z "$URL" ]; then
    echo "ERROR: No se pudo obtener la URL de ngrok"
    exit 1
fi

echo "URL pública: $URL"

# Actualizar PUBLIC_API_URL en la app (esperar a que la API esté levantada)
for i in {1..15}; do
    RES=$(curl -s -o /dev/null -w "%{http_code}" "${APP_API}/health")
    if [ "$RES" = "200" ]; then
        break
    fi
    echo "Esperando API en ${APP_API}..."
    sleep 2
done

PATCH=$(curl -s -X PATCH "${APP_API}/settings" \
    -H "Content-Type: application/json" \
    -d "[{\"key\":\"PUBLIC_API_URL\",\"value\":\"${URL}\"}]")

if echo "$PATCH" | grep -q '"success":true'; then
    echo "✓ PUBLIC_API_URL actualizada: $URL"
else
    echo "⚠ API no disponible todavía. Actualiza PUBLIC_API_URL manualmente en Ajustes:"
    echo "  $URL"
fi

echo ""
echo "ngrok corriendo (PID $NGROK_PID). Dashboard: http://localhost:4040"

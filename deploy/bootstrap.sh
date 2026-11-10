#!/usr/bin/env bash
# Instalación única de Noah Beauty Studio en el VPS (Ubuntu/Debian). Se puede volver a correr sin problema.
# Deja dos ambientes: pre (rama "pre", puerto 3101) y prod (rama "main", puerto 3100),
# con despliegue automático cada minuto y respaldo diario de la base de datos de prod.
set -euo pipefail

REPO="${NOAH_REPO:-git@github.com:jorgebt95/noah-beauty-studio.git}"
SRC="$(cd "$(dirname "$0")/.." && pwd)"
say() { printf '\n\033[1;35m== %s\033[0m\n' "$*"; }

[ "$(id -u)" = 0 ] || { echo "Corre este script como root (sudo)."; exit 1; }
export DEBIAN_FRONTEND=noninteractive

say "Paquetes base"
apt-get update -qq
apt-get install -y -qq git curl ca-certificates gnupg build-essential python3 >/dev/null

if ! command -v node >/dev/null || [ "$(node -p 'process.versions.node.split(".")[0]')" -lt 20 ]; then
  say "Instalando Node.js 22"
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash - >/dev/null
  apt-get install -y -qq nodejs >/dev/null
fi
echo "Node $(node -v)"

say "Usuario y carpetas"
id noah >/dev/null 2>&1 || useradd -m -s /bin/bash noah
mkdir -p /opt/noah /var/lib/noah/pre /var/lib/noah/prod /var/lib/noah/backups /etc/noah
chown -R noah:noah /opt/noah /var/lib/noah
chmod 750 /etc/noah

# Llave para leer el repo (deploy key). Normalmente ya la creó el comando de arranque.
if [ ! -f /home/noah/.ssh/id_ed25519 ]; then
  sudo -u noah mkdir -p /home/noah/.ssh
  sudo -u noah ssh-keygen -t ed25519 -N "" -f /home/noah/.ssh/id_ed25519 -C noah-vps >/dev/null
  echo "Agrega esta llave en GitHub > repo > Settings > Deploy keys:"; cat /home/noah/.ssh/id_ed25519.pub
  read -r -p "Presiona Enter cuando la hayas agregado… " _ </dev/tty
fi
grep -q github.com /home/noah/.ssh/known_hosts 2>/dev/null || sudo -u noah sh -c 'ssh-keyscan -t ed25519 github.com >> /home/noah/.ssh/known_hosts 2>/dev/null'

say "Código de pre (rama pre) y prod (rama main)"
for ENVN in pre prod; do
  BR=$([ "$ENVN" = prod ] && echo main || echo pre)
  DIR=/opt/noah/$ENVN/app
  if [ ! -d "$DIR/.git" ]; then
    sudo -u noah mkdir -p /opt/noah/$ENVN
    sudo -u noah git clone -q -b "$BR" "$REPO" "$DIR"
  fi
  (cd "$DIR" && sudo -u noah npm ci --omit=dev --no-audit --no-fund >/dev/null && sudo -u noah cp package-lock.json .deployed-lock)
done

say "Configuración de cada ambiente"
NEW_PINS=""
for ENVN in pre prod; do
  F=/etc/noah/$ENVN.env
  if [ ! -f "$F" ]; then
    PIN=$(shuf -i 1000-9999 -n 1)
    PORT=$([ "$ENVN" = prod ] && echo 3100 || echo 3101)
    cat > "$F" <<EOF
NOAH_ENV=$ENVN
PORT=$PORT
DATA_DIR=/var/lib/noah/$ENVN
ADMIN_PIN=$PIN
COOKIE_SECURE=1
# Calendario de iCloud de Sophia (opcional): contraseña de app de su Apple ID
ICLOUD_USER=
ICLOUD_APP_PASSWORD=
ICLOUD_CALENDAR=
EOF
    NEW_PINS="$NEW_PINS\n  $ENVN: $PIN"
  fi
  chown root:noah "$F"; chmod 640 "$F"
done

say "Servicios del sistema"
cat > /etc/systemd/system/noah@.service <<'EOF'
[Unit]
Description=Noah Beauty Studio (%i)
After=network-online.target
Wants=network-online.target

[Service]
User=noah
WorkingDirectory=/opt/noah/%i/app
EnvironmentFile=/etc/noah/%i.env
ExecStart=/usr/bin/node server.js
Restart=always
RestartSec=3
NoNewPrivileges=true
ProtectSystem=full
PrivateTmp=true

[Install]
WantedBy=multi-user.target
EOF

install -m 755 "$SRC/deploy/noah-deploy" /usr/local/bin/noah-deploy
install -m 755 "$SRC/deploy/noah-set-domain" /usr/local/bin/noah-set-domain

cat > /etc/systemd/system/noah-deploy.service <<'EOF'
[Unit]
Description=Noah: instalar cambios nuevos de GitHub
[Service]
Type=oneshot
ExecStart=/usr/local/bin/noah-deploy all
EOF
cat > /etc/systemd/system/noah-deploy.timer <<'EOF'
[Unit]
Description=Noah: revisar cambios cada minuto
[Timer]
OnBootSec=1min
OnUnitActiveSec=1min
[Install]
WantedBy=timers.target
EOF
cat > /etc/systemd/system/noah-backup.service <<'EOF'
[Unit]
Description=Noah: respaldo diario de la base de datos de prod
[Service]
Type=oneshot
User=noah
EnvironmentFile=/etc/noah/prod.env
WorkingDirectory=/opt/noah/prod/app
ExecStart=/usr/bin/node scripts/backup.js /var/lib/noah/backups
EOF
cat > /etc/systemd/system/noah-backup.timer <<'EOF'
[Unit]
Description=Noah: respaldo diario
[Timer]
OnCalendar=*-*-* 09:30:00
Persistent=true
[Install]
WantedBy=timers.target
EOF

systemctl daemon-reload
systemctl enable --now noah@pre noah@prod >/dev/null
systemctl restart noah@pre noah@prod
systemctl enable --now noah-deploy.timer noah-backup.timer >/dev/null

say "Dirección web"
IP=$(curl -4 -fsS https://api.ipify.org || hostname -I | awk '{print $1}')
IPD=${IP//./-}
if [ ! -f /etc/noah/domains ]; then
  printf 'PROD_HOST=noah-%s.sslip.io\nPRE_HOST=pre-noah-%s.sslip.io\n' "$IPD" "$IPD" > /etc/noah/domains
fi
/usr/local/bin/noah-set-domain --apply

if command -v ufw >/dev/null && ufw status | grep -q "Status: active"; then
  ufw allow 80/tcp >/dev/null; ufw allow 443/tcp >/dev/null
fi

sleep 3
. /etc/noah/domains
say "Listo"
for ENVN in prod pre; do
  P=$([ "$ENVN" = prod ] && echo 3100 || echo 3101)
  if curl -fsS "http://127.0.0.1:$P/api/health" >/dev/null; then echo "  $ENVN: corriendo"; else echo "  $ENVN: NO responde (revisa: journalctl -u noah@$ENVN -n 50)"; fi
done
echo
echo "  Prod (clientas): https://$PROD_HOST"
echo "  Pre (pruebas):   https://$PRE_HOST"
echo "  Panel de Sophia: agrega /admin al final de cada dirección"
[ -n "$NEW_PINS" ] && echo -e "\n  PIN inicial del panel (cámbialo en Ajustes):$NEW_PINS"
echo
echo "  Si la página no abre en unos minutos, revisa que el firewall de Hetzner permita los puertos 80 y 443."

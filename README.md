# Noah Beauty Studio

Sitio de citas, servicios, trabajos y tarjeta Club Cereza de Noah Beauty Studio, con panel para Sophia en `/admin`.

- **Clientas:** agendar (servicio, día y hora libres; retoque a mitad de precio en pestañas dentro de 15 días), solicitar horario especial, ver su tarjeta con celular + PIN, ver servicios y trabajos.
- **Sophia (`/admin`, con PIN):** agenda del día (atendida / no vino / cancelar, suma cerezas sola), solicitudes de horario especial, clientas (cerezas extra, canjear premios, cambiar PIN), servicios (precio y duración), fotos y ajustes.
- **Calendario de iCloud (opcional):** con `ICLOUD_USER`, `ICLOUD_APP_PASSWORD` e `ICLOUD_CALENDAR` en `/etc/noah/<ambiente>.env`, los eventos de Sophia bloquean horarios y cada cita nueva se crea en su calendario.

## Ambientes y despliegue

| Ambiente | Rama   | Puerto | Datos                  |
|----------|--------|--------|------------------------|
| pre      | `pre`  | libre desde 4720 (`/etc/noah/pre.env`) | `/var/lib/noah/pre`    |
| prod     | `main` | libre desde 4710 (`/etc/noah/prod.env`) | `/var/lib/noah/prod`   |

El VPS revisa GitHub cada minuto (`noah-deploy.timer`). Un cambio se sube primero a `pre`; cuando se aprueba, se pasa a `main`:

```bash
git checkout pre && git commit … && git push origin pre      # se instala en pre
git checkout main && git merge --ff-only pre && git push      # se instala en prod
```

Si la versión nueva no arranca, `noah-deploy` regresa sola a la anterior.

## Comandos útiles en el VPS

```bash
sudo noah-deploy all --force          # reinstalar ya
journalctl -u noah@prod -n 100        # registro de la app
journalctl -u noah-deploy -n 50       # registro de despliegues
sudo noah-set-domain midominio.com    # pasar de la dirección temporal al dominio
sudo nano /etc/noah/prod.env && sudo systemctl restart noah@prod   # credenciales de iCloud
ls /var/lib/noah/backups              # respaldos diarios de prod (30 días)
```

## Desarrollo

```bash
npm install
npm run dev     # http://127.0.0.1:3000 · PIN del panel 1234
npm test        # prueba de humo del flujo completo
```

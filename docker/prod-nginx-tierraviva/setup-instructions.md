# Guía de Configuración: Proxy Inverso Global y Staging de MS AMBAR en Tierra Viva

Esta carpeta contiene la configuración necesaria para desplegar un **proxy inverso global (`prod_nginx`)** en el servidor de Tierra Viva (`saul@ubuntu-2gb-hil-1-tierra-viva`), permitiendo alojar:
1. **Tierra Viva (Producción)**: `tierraviva.com.mx` (y su subdominio `www`).
2. **MS AMBAR (Staging)**: `staging.ambar.tierraviva.com.mx` (con auto-apagado automático).

---

## Estructura del Servidor

En el VPS, te sugerimos organizar los proyectos de la siguiente manera:
```text
/home/saul/
│
├── tierra-viva/               # Repositorio de Tierra Viva (Producción)
│
├── ms-ambar/                  # Repositorio de MS AMBAR (Staging)
│
└── prod-nginx/                # Esta carpeta con el proxy inverso global
    ├── docker-compose.yml
    └── default.conf
```

---

## Paso 1: Configurar la Red y los Volúmenes Globales en el VPS

Antes de levantar cualquier contenedor, debes asegurarte de que la red compartida y los volúmenes externos existan en Docker en el servidor de Tierra Viva.

Ejecuta los siguientes comandos en la terminal de tu VPS:

```bash
# 1. Crear la red compartida (puente para que Nginx vea los demás contenedores)
docker network create prod_network

# 2. Crear los volúmenes para los archivos estáticos y media de Tierra Viva (si no existen)
docker volume create tierraviva_static_volume
docker volume create tierraviva_media_volume

# 3. Crear los volúmenes para MS AMBAR Staging
docker volume create ambar_staging_static_volume
docker volume create ambar_staging_media_volume
```

---

## Paso 2: Configurar y Levantar el Proxy Inverso Global

1. Copia la carpeta `prod-nginx-tierraviva` al VPS (puedes renombrarla a `prod-nginx` en `/home/saul/prod-nginx`).
2. Levanta el proxy en modo temporal (sin SSL activado aún, o bien asegurándote de que no falle si no existen los certificados):
   
> [!NOTE]
> La primera vez que levantes Nginx, si no tienes los certificados SSL en `/etc/letsencrypt/live/...`, Nginx fallará al iniciar. Para solucionar esto, sigue el paso 3.

---

## Paso 3: Obtener Certificados SSL con Certbot

Para generar los certificados para `tierraviva.com.mx` y `staging.ambar.tierraviva.com.mx` de forma segura:

### Método A: Generar certificados temporales y obtener los reales
Puedes levantar temporalmente un servidor Nginx básico en el puerto 80 solo para el reto de Certbot, u obtenerlos directamente usando certbot en modo standalone (deteniendo temporalmente cualquier servicio en el puerto 80):

```bash
# Detén temporalmente cualquier servicio que use el puerto 80
sudo systemctl stop nginx  # (Solo si tienes nginx corriendo nativo en el host)

# Corre Certbot en modo standalone para obtener los certificados
docker run -it --rm --name certbot \
  -v "/etc/letsencrypt:/etc/letsencrypt" \
  -v "/var/lib/letsencrypt:/var/lib/letsencrypt" \
  -p 80:80 \
  certbot/certbot certonly --standalone \
  -d tierraviva.com.mx -d www.tierraviva.com.mx \
  -d staging.ambar.tierraviva.com.mx
```

Una vez que Certbot guarde los certificados exitosamente en `/etc/letsencrypt/live/`, ya puedes levantar el proxy global de forma segura:

```bash
cd /home/saul/prod-nginx
docker compose up -d
```

---

## Paso 4: Configurar y Levantar MS AMBAR Staging

1. En el repositorio `ms-ambar` en tu VPS, crea el archivo `.env.staging` copiando la plantilla:
   ```bash
   cp .env.staging.example .env.staging
   ```
2. Abre `.env.staging` y asegúrate de configurar las variables reales de base de datos, Stripe y Cloudinary si es necesario. Ajusta `AUTO_STOP_INTERVAL` al tiempo deseado (ej. `24h` o `12h`).
3. Levanta el entorno de staging usando el script `nectar.sh`:
   ```bash
   chmod +x nectar.sh
   ./nectar.sh up-staging
   ```
4. Corre las migraciones y recopila los archivos estáticos:
   ```bash
   ./nectar.sh migrate-staging
   ./nectar.sh collectstatic-staging
   ```

---

## Paso 5: Monitorear el Entorno

- **Logs del Proxy Inverso**:
  ```bash
  cd /home/saul/prod-nginx
  docker compose logs -f nginx
  ```
- **Monitorear el temporizador de auto-apagado de MS AMBAR**:
  ```bash
  docker logs ambar_staging_autostop
  ```

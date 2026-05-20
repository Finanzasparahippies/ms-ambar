# Guía de Configuración: Proxy Inverso Global y Despliegue de MS AMBAR (Producción y Staging) en Tierra Viva

Esta carpeta contiene la configuración para desplegar un **proxy inverso global (`prod_nginx`)** en el servidor de Tierra Viva (`saul@ubuntu-2gb-hil-1-tierra-viva`), permitiendo alojar:
1. **Tierra Viva (Producción)**: `tierraviva.com.mx` (y su subdominio `www`).
2. **MS AMBAR (Producción)**: `msambar.com` (y su subdominio `www`).
3. **MS AMBAR (Staging)**: `staging.msambar.com` (y su subdominio `www`).

---

## Solución al error "Permission Denied" en Docker

Si al ejecutar comandos de Docker en tu VPS recibes un error como:
`permission denied while trying to connect to the docker API at unix:///var/run/docker.sock`

Tienes dos opciones para solucionarlo:

### Opción A (Recomendada): Agregar tu usuario 'saul' al grupo 'docker'
Esto te permitirá ejecutar comandos de Docker sin tener que escribir `sudo` antes de cada comando. Ejecuta esto en tu VPS:
```bash
sudo usermod -aG docker saul
newgrp docker
```
*(Después de esto, ya no necesitarás usar `sudo` para correr Docker).*

### Opción B: Ejecutar todos los comandos con `sudo`
Puedes simplemente anteponer `sudo` a todos tus comandos de Docker (como se muestra en esta guía a continuación).

---

## Estructura del Servidor

En el VPS, te sugerimos organizar los proyectos de la siguiente manera:
```text
/home/saul/
│
├── tierra-viva/               # Repositorio de Tierra Viva (Producción)
│
├── ms-ambar/                  # Repositorio de MS AMBAR (Aquí manejas Prod y Staging)
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
sudo docker network create prod_network

# 2. Crear los volúmenes para los archivos estáticos y media de Tierra Viva (si no existen)
sudo docker volume create tierraviva_static_volume
sudo docker volume create tierraviva_media_volume

# 3. Crear los volúmenes para MS AMBAR Producción
sudo docker volume create ambar_static_volume
sudo docker volume create ambar_media_volume

# 4. Crear los volúmenes para MS AMBAR Staging
sudo docker volume create ambar_staging_static_volume
sudo docker volume create ambar_staging_media_volume
```

---

## Paso 2: Configurar y Levantar el Proxy Inverso Global

1. Copia la carpeta `prod-nginx-tierraviva` al VPS (puedes renombrarla a `prod-nginx` en `/home/saul/prod-nginx`).
2. Levanta el proxy en modo temporal (sin SSL activado aún, o bien asegurándote de que no falle si no existen los certificados):
   
> [!NOTE]
> La primera vez que levantes Nginx, si no tienes los certificados SSL en `/etc/letsencrypt/live/...`, Nginx fallará al iniciar. Para solucionar esto, sigue el paso 3.

---

## Paso 3: Obtener Certificados SSL con Certbot

Para obtener los certificados SSL para `msambar.com` (Producción) y `staging.msambar.com` (Staging), conservando tus certificados existentes de Tierra Viva:

### Obtener certificados de MS AMBAR
Si ya tienes los certificados de Tierra Viva en `/etc/letsencrypt/live/tierraviva.com.mx/`, ejecuta Certbot para obtener los nuevos certificados de producción y staging:

```bash
# Detén temporalmente cualquier servicio que use el puerto 80 en el host
sudo systemctl stop nginx  # (Solo si tienes un Nginx nativo corriendo en el host)

# 1. Obtener certificado para MS AMBAR Producción
sudo docker run -it --rm --name certbot \
  -v "/etc/letsencrypt:/etc/letsencrypt" \
  -v "/var/lib/letsencrypt:/var/lib/letsencrypt" \
  -p 80:80 \
  certbot/certbot certonly --standalone \
  -d msambar.com -d www.msambar.com

# 2. Obtener certificado para MS AMBAR Staging
sudo docker run -it --rm --name certbot \
  -v "/etc/letsencrypt:/etc/letsencrypt" \
  -v "/var/lib/letsencrypt:/var/lib/letsencrypt" \
  -p 80:80 \
  certbot/certbot certonly --standalone \
  -d staging.msambar.com -d www.staging.msambar.com
```

Una vez guardados los certificados exitosamente, ya puedes levantar el proxy global de forma segura:

```bash
cd /home/saul/prod-nginx
sudo docker compose up -d
```

---

## Paso 4: Desplegar MS AMBAR Producción

1. En el repositorio `ms-ambar` en tu VPS, asegúrate de que el archivo `.env` contenga la configuración de producción.
   - `ALLOWED_HOSTS=localhost,127.0.0.1,backend,frontend,msambar.com,www.msambar.com`
   - `FRONTEND_URL=https://msambar.com`
   - `NEXT_PUBLIC_API_URL=https://msambar.com/api`
   - `ENVIRONMENT=production`
2. Levanta el entorno de producción usando Docker Compose:
   ```bash
   sudo docker compose -f docker-compose.prod.yml up -d --build
   ```
3. Ejecuta migraciones y compila estáticos de producción:
   ```bash
   sudo docker compose -f docker-compose.prod.yml exec backend python manage.py migrate
   sudo docker compose -f docker-compose.prod.yml exec backend python manage.py collectstatic --no-input
   ```

---

## Paso 5: Desplegar MS AMBAR Staging (Con Auto-Apagado)

1. En el repositorio `ms-ambar` en tu VPS, crea el archivo `.env.staging` copiando la plantilla:
   ```bash
   cp .env.staging.example .env.staging
   ```
2. Configura las variables del entorno de pruebas en `.env.staging`:
   - `ALLOWED_HOSTS=localhost,127.0.0.1,backend-staging,nginx-staging,staging.msambar.com,www.staging.msambar.com`
   - `FRONTEND_URL=https://staging.msambar.com`
   - `NEXT_PUBLIC_API_URL=https://staging.msambar.com/api`
   - `ENVIRONMENT=staging`
   - `AUTO_STOP_INTERVAL=24h`
3. Levanta el entorno de staging:
   ```bash
   # Nota: Puedes usar el script de automatización
   ./nectar.sh up-staging
   ```
4. Corre migraciones y estáticos de staging:
   ```bash
   ./nectar.sh migrate-staging
   ./nectar.sh collectstatic-staging
   ```

---

## Paso 6: Monitorear los Entornos

- **Logs del Proxy Inverso Global**:
  ```bash
  cd /home/saul/prod-nginx
  sudo docker compose logs -f nginx
  ```
- **Monitorear el temporizador de auto-apagado de MS AMBAR Staging**:
  ```bash
  sudo docker logs ambar_staging_autostop
  ```

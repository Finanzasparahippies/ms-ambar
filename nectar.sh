#!/bin/bash

# Nectar Labs CLI for MS AMBAR
# Script to manage MS AMBAR docker/podman environment easily

COMMAND=$1
if [ $# -gt 0 ]; then
    shift
fi

# Detect Container runtime (docker or podman)
if command -v docker &> /dev/null; then
    DOCKER_BIN="docker"
elif command -v podman &> /dev/null; then
    DOCKER_BIN="podman"
else
    echo "==========================================="
    echo "  [ERROR] No container runtime detected!   "
    echo "==========================================="
    echo "No se encontró ni 'docker' ni 'podman' en el PATH del sistema."
    echo ""
    echo "Si estás en Fedora Linux, instala Podman + Compose ejecutando:"
    echo "  sudo dnf install -y podman-docker podman-compose"
    echo ""
    echo "O bien instala Docker Engine oficial."
    exit 1
fi

# Detect Compose provider
COMPOSE_BIN=""
if [ "$DOCKER_BIN" = "docker" ]; then
    if docker compose version &> /dev/null; then
        COMPOSE_BIN="docker compose"
    elif command -v docker-compose &> /dev/null; then
        COMPOSE_BIN="docker-compose"
    fi
elif [ "$DOCKER_BIN" = "podman" ]; then
    if command -v podman-compose &> /dev/null; then
        COMPOSE_BIN="podman-compose"
    elif podman compose version &> /dev/null 2>&1; then
        COMPOSE_BIN="podman compose"
    fi
fi

if [ -z "$COMPOSE_BIN" ]; then
    echo "==========================================="
    echo "  [ERROR] No Compose provider detected!    "
    echo "==========================================="
    echo "Se detectó '${DOCKER_BIN}', pero no se encontró un proveedor de Compose (docker-compose / podman-compose)."
    echo ""
    echo "Si estás en Fedora Linux, instala podman-compose y podman-docker ejecutando:"
    echo "  sudo dnf install -y podman-compose podman-docker"
    echo ""
    echo "O si prefieres Docker oficial, instala docker-ce y docker-compose-plugin."
    exit 1
fi

# Helper function to run Django commands in dev (using exec if running, run --rm if not)
run_django_cmd_dev() {
    local tty_flag=""
    if [ -t 0 ]; then
        tty_flag="-it"
    fi
    if $DOCKER_BIN ps --format '{{.Names}}' 2>/dev/null | grep -q "ambar_dev_backend"; then
        $DOCKER_BIN exec $tty_flag ambar_dev_backend python manage.py "$@"
    elif $COMPOSE_BIN ps 2>/dev/null | grep -q "backend"; then
        $COMPOSE_BIN exec $tty_flag backend python manage.py "$@"
    else
        $COMPOSE_BIN run --rm $tty_flag -w /app backend python manage.py "$@"
    fi
}

# Helper function to run Django commands in staging (using exec if running, run --rm if not)
run_django_cmd_staging() {
    local tty_flag=""
    if [ -t 0 ]; then
        tty_flag="-it"
    fi
    if $DOCKER_BIN ps --format '{{.Names}}' 2>/dev/null | grep -q "ambar_staging_backend"; then
        $DOCKER_BIN exec $tty_flag ambar_staging_backend python manage.py "$@"
    elif $COMPOSE_BIN --env-file .env.staging -f docker-compose.staging.yml ps 2>/dev/null | grep -q "backend-staging"; then
        $COMPOSE_BIN --env-file .env.staging -f docker-compose.staging.yml exec $tty_flag backend-staging python manage.py "$@"
    else
        $COMPOSE_BIN --env-file .env.staging -f docker-compose.staging.yml run --rm $tty_flag -w /app backend-staging python manage.py "$@"
    fi
}

# Helper function to run Django commands in prod (using exec if running, run --rm if not)
run_django_cmd_prod() {
    local tty_flag=""
    if [ -t 0 ]; then
        tty_flag="-it"
    fi
    if $DOCKER_BIN ps --format '{{.Names}}' 2>/dev/null | grep -q "ambar_backend"; then
        $DOCKER_BIN exec $tty_flag ambar_backend python manage.py "$@"
    elif $COMPOSE_BIN -f docker-compose.prod.yml ps 2>/dev/null | grep -q "backend"; then
        $COMPOSE_BIN -f docker-compose.prod.yml exec $tty_flag backend python manage.py "$@"
    else
        $COMPOSE_BIN -f docker-compose.prod.yml run --rm $tty_flag -w /app backend python manage.py "$@"
    fi
}

# Helper function to find and remove conflicting containers from other project namespaces
remove_conflicting_containers() {
    local container_names=("$@")
    for container in "${container_names[@]}"; do
        if $DOCKER_BIN ps -a --format '{{.Name}}' 2>/dev/null | grep -q "^${container}$"; then
            echo "Warning: Container '${container}' already exists (possibly from a different or older Docker Compose project/run)."
            echo "Removing existing container '${container}' to prevent naming conflicts..."
            $DOCKER_BIN rm -f "${container}"
        fi
    done
}

show_help() {
    echo "==========================================="
    echo "           MS AMBAR - Nectar Labs CLI      "
    echo "==========================================="
    echo ""
    echo "Usage: ./nectar.sh [command]"
    echo ""
    echo "Commands:"
    echo "  dev                     - Start development environment"
    echo "  stop                    - Stop development environment"
    echo "  restart                 - Restart development containers"
    echo "  logs                    - Show real-time development logs"
    echo "  makemigrations          - Generate new backend database migrations"
    echo "  migrate                 - Run database migrations in dev"
    echo "  createsuperuser         - Create a Django admin superuser in dev"
    echo "  shell                   - Open backend python shell in dev"
    echo "  test                    - Run backend tests (Dev)"
    echo "  typecheck               - Run TypeScript type-check in Dev frontend"
    echo "  buildcheck              - Run Next.js build check in Dev frontend"
    echo "  frontend                - Run Next.js frontend locally (npm run dev)"
    echo ""
    echo "Staging Commands:"
    echo "  build-staging           - Build staging Docker images"
    echo "  up-staging              - Start staging environment"
    echo "  down-staging            - Stop staging environment"
    echo "  restart-staging         - Restart staging environment"
    echo "  logs-staging            - Show real-time staging logs"
    echo "  makemigrations-staging  - Generate staging database migrations"
    echo "  migrate-staging         - Run database migrations in staging"
    echo "  createsuperuser-staging - Create admin superuser in staging"
    echo "  shell-staging           - Open backend python shell in staging"
    echo "  collectstatic-staging   - Compile static assets in staging"
    echo "  test-staging            - Run backend tests (Staging)"
    echo "  typecheck-staging       - Run TypeScript type-check in Staging frontend"
    echo "  buildcheck-staging      - Run Next.js build check in Staging frontend"
    echo ""
    echo "Production Commands:"
    echo "  build                   - Build production Docker images"
    echo "  up-prod                 - Start production environment"
    echo "  down-prod               - Stop production environment"
    echo "  restart-prod            - Restart production environment"
    echo "  logs-prod               - Show real-time production logs"
    echo "  makemigrations-prod     - Generate database migrations (Prod)"
    echo "  migrate-prod            - Run database migrations in prod"
    echo "  shell-prod              - Open backend python shell in prod"
    echo "  collectstatic           - Compile static assets in prod"
    echo "  certbot                 - Request Let's Encrypt SSL certificate"
    echo "  clean                   - Safe Docker and VPS cleanup"
    echo "  help                    - Show this help screen"
}

case $COMMAND in
    dev)
        echo "Starting MS AMBAR Dev Environment using ${COMPOSE_BIN}..."
        remove_conflicting_containers ambar_dev_db ambar_dev_backend ambar_dev_frontend ambar_dev_nginx
        $COMPOSE_BIN up -d --build "$@"
        ;;
    stop)
        echo "Stopping Dev Environment..."
        $COMPOSE_BIN down "$@"
        ;;
    restart)
        echo "Restarting Dev Environment..."
        $COMPOSE_BIN restart "$@"
        ;;
    logs)
        if [ $# -eq 0 ]; then
            $COMPOSE_BIN logs -f --tail=100
        else
            $COMPOSE_BIN logs "$@"
        fi
        ;;
    makemigrations|makemigrations-dev)
        run_django_cmd_dev makemigrations "$@"
        ;;
    migrate|migrate-dev)
        run_django_cmd_dev migrate "$@"
        ;;
    createsuperuser|createsuperuser-dev)
        run_django_cmd_dev createsuperuser "$@"
        ;;
    shell|shell-dev)
        run_django_cmd_dev shell "$@"
        ;;
    test|test-dev)
        run_django_cmd_dev test "$@"
        ;;
    typecheck)
        echo "Running TypeScript type-check in Dev frontend..."
        if $DOCKER_BIN ps --format '{{.Names}}' 2>/dev/null | grep -q "ambar_dev_frontend"; then
            $DOCKER_BIN exec ambar_dev_frontend npx tsc --noEmit "$@"
        else
            $COMPOSE_BIN exec frontend npx tsc --noEmit "$@"
        fi
        ;;
    buildcheck)
        echo "Running Next.js build-check in Dev frontend..."
        if $DOCKER_BIN ps --format '{{.Names}}' 2>/dev/null | grep -q "ambar_dev_frontend"; then
            $DOCKER_BIN exec ambar_dev_frontend npm run build "$@"
        else
            $COMPOSE_BIN exec frontend npm run build "$@"
        fi
        ;;
    frontend)
        cd frontend && npm run dev "$@"
        ;;
    build-staging)
        echo "Building MS AMBAR Staging Images..."
        $COMPOSE_BIN --env-file .env.staging -f docker-compose.staging.yml build "$@"
        ;;
    up-staging)
        echo "Starting MS AMBAR Staging Environment..."
        remove_conflicting_containers ambar_staging_backend ambar_staging_frontend ambar_staging_nginx ambar_staging_autostop
        $COMPOSE_BIN --env-file .env.staging -f docker-compose.staging.yml up -d --build "$@"
        ;;
    down-staging|stop-staging)
        echo "Stopping Staging Environment..."
        $COMPOSE_BIN --env-file .env.staging -f docker-compose.staging.yml down "$@"
        ;;
    restart-staging)
        echo "Restarting Staging Environment..."
        $COMPOSE_BIN --env-file .env.staging -f docker-compose.staging.yml restart "$@"
        ;;
    logs-staging)
        if [ $# -eq 0 ]; then
            $COMPOSE_BIN --env-file .env.staging -f docker-compose.staging.yml logs -f --tail=100
        else
            $COMPOSE_BIN --env-file .env.staging -f docker-compose.staging.yml logs "$@"
        fi
        ;;
    migrate-staging)
        run_django_cmd_staging migrate "$@"
        ;;
    makemigrations-staging)
        run_django_cmd_staging makemigrations "$@"
        ;;
    createsuperuser-staging)
        run_django_cmd_staging createsuperuser "$@"
        ;;
    shell-staging)
        run_django_cmd_staging shell "$@"
        ;;
    collectstatic-staging)
        echo "Running collectstatic in Staging..."
        run_django_cmd_staging collectstatic --no-input "$@"
        ;;
    test-staging)
        run_django_cmd_staging test "$@"
        ;;
    typecheck-staging)
        echo "Running TypeScript type-check for Staging frontend..."
        $COMPOSE_BIN --env-file .env.staging -f docker-compose.staging.yml run --rm frontend-staging npx tsc --noEmit "$@"
        ;;
    buildcheck-staging)
        echo "Running Next.js build-check for Staging frontend..."
        $COMPOSE_BIN --env-file .env.staging -f docker-compose.staging.yml run --rm frontend-staging npm run build "$@"
        ;;
    build)
        echo "Building MS AMBAR Production Images..."
        $COMPOSE_BIN -f docker-compose.prod.yml build "$@"
        ;;
    up-prod)
        echo "Starting MS AMBAR Production Environment..."
        remove_conflicting_containers ambar_backend ambar_frontend
        $COMPOSE_BIN -f docker-compose.prod.yml up -d "$@"
        ;;
    down-prod)
        echo "Stopping Production Environment..."
        $COMPOSE_BIN -f docker-compose.prod.yml down "$@"
        ;;
    restart-prod)
        echo "Restarting Production Environment..."
        $COMPOSE_BIN -f docker-compose.prod.yml restart "$@"
        ;;
    logs-prod)
        if [ $# -eq 0 ]; then
            $COMPOSE_BIN -f docker-compose.prod.yml logs -f --tail=100
        else
            $COMPOSE_BIN -f docker-compose.prod.yml logs "$@"
        fi
        ;;
    makemigrations-prod)
        run_django_cmd_prod makemigrations "$@"
        ;;
    migrate-prod)
        run_django_cmd_prod migrate "$@"
        ;;
    shell-prod)
        run_django_cmd_prod shell "$@"
        ;;
    collectstatic)
        echo "Running collectstatic..."
        if $DOCKER_BIN ps --format '{{.Names}}' 2>/dev/null | grep -q "ambar_dev_backend"; then
            run_django_cmd_dev collectstatic --no-input "$@"
        elif $DOCKER_BIN ps --format '{{.Names}}' 2>/dev/null | grep -q "ambar_staging_backend"; then
            run_django_cmd_staging collectstatic --no-input "$@"
        else
            run_django_cmd_prod collectstatic --no-input "$@"
        fi
        ;;
    certbot)
        DOMAIN=$1
        if [ -z "$DOMAIN" ]; then
            echo "Usage: ./nectar.sh certbot example.com"
            exit 1
        fi
        $COMPOSE_BIN -f docker-compose.prod.yml run --rm certbot certonly --webroot --webroot-path=/var/www/certbot -d $DOMAIN -d www.$DOMAIN
        ;;
    clean)
        echo "Starting comprehensive and safe VPS/Container cleanup..."
        echo ""
        echo "1. Removing stopped containers..."
        $DOCKER_BIN container prune -f
        
        echo "2. Removing dangling networks..."
        $DOCKER_BIN network prune -f
        
        echo "3. Removing dangling volumes (only unused/anonymous volumes)..."
        $DOCKER_BIN volume prune -f
        
        echo "4. Removing dangling/untagged images..."
        $DOCKER_BIN image prune -f
        
        echo "5. Removing build cache..."
        $DOCKER_BIN builder prune -f 2>/dev/null || true
        
        echo "6. Checking for legacy/conflicting Compose project 'ms-ambar'..."
        if $COMPOSE_BIN -p ms-ambar ps -q &>/dev/null || [ -n "$($DOCKER_BIN ps -a --filter 'label=com.docker.compose.project=ms-ambar' -q 2>/dev/null)" ]; then
            echo "   Stopping and removing legacy 'ms-ambar' project containers and networks..."
            $COMPOSE_BIN -p ms-ambar down
        else
            echo "   No legacy 'ms-ambar' project containers found."
        fi
        
        if command -v journalctl &> /dev/null; then
            echo "7. Vacuuming system logs (journald) to 100MB..."
            sudo journalctl --vacuum-size=100M 2>/dev/null || echo "   (Skip: sudo privileges required to vacuum logs)"
        fi
        
        if command -v apt-get &> /dev/null; then
            echo "8. Cleaning APT package cache..."
            sudo apt-get autoclean -y 2>/dev/null || echo "   (Skip: sudo privileges required to clean APT cache)"
        fi
        
        echo ""
        echo "System cleanup complete! Disk space reclaimed successfully."
        ;;
    *)
        show_help
        ;;
esac

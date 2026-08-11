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

# Helper function to run npm/frontend commands in dev
run_npm_cmd_dev() {
    local tty_flag=""
    if [ -t 0 ]; then
        tty_flag="-it"
    fi
    if $DOCKER_BIN ps --format '{{.Names}}' 2>/dev/null | grep -q "ambar_dev_frontend"; then
        $DOCKER_BIN exec $tty_flag ambar_dev_frontend npm "$@"
    elif $COMPOSE_BIN ps 2>/dev/null | grep -q "frontend"; then
        $COMPOSE_BIN exec $tty_flag frontend npm "$@"
    elif [ -d "frontend" ] && command -v npm &> /dev/null; then
        (cd frontend && npm "$@")
    else
        $COMPOSE_BIN run --rm $tty_flag -w /app frontend npm "$@"
    fi
}

# Helper function to run npm/frontend commands in staging
run_npm_cmd_staging() {
    local tty_flag=""
    if [ -t 0 ]; then
        tty_flag="-it"
    fi
    if $DOCKER_BIN ps --format '{{.Names}}' 2>/dev/null | grep -q "ambar_staging_frontend"; then
        $DOCKER_BIN exec $tty_flag ambar_staging_frontend npm "$@"
    elif $COMPOSE_BIN --env-file .env.staging -f docker-compose.staging.yml ps 2>/dev/null | grep -q "frontend-staging"; then
        $COMPOSE_BIN --env-file .env.staging -f docker-compose.staging.yml exec $tty_flag frontend-staging npm "$@"
    else
        $COMPOSE_BIN --env-file .env.staging -f docker-compose.staging.yml run --rm $tty_flag -w /app frontend-staging npm "$@"
    fi
}

# Helper function to run npm/frontend commands in prod
run_npm_cmd_prod() {
    local tty_flag=""
    if [ -t 0 ]; then
        tty_flag="-it"
    fi
    if $DOCKER_BIN ps --format '{{.Names}}' 2>/dev/null | grep -q "ambar_frontend"; then
        $DOCKER_BIN exec $tty_flag ambar_frontend npm "$@"
    elif $COMPOSE_BIN -f docker-compose.prod.yml ps 2>/dev/null | grep -q "frontend"; then
        $COMPOSE_BIN -f docker-compose.prod.yml exec $tty_flag frontend npm "$@"
    else
        $COMPOSE_BIN -f docker-compose.prod.yml run --rm $tty_flag -w /app frontend npm "$@"
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
    echo "=== DEVELOPMENT ENV (Local / Dev) ==="
    echo "  dev                     - Start development environment"
    echo "  stop                    - Stop development environment"
    echo "  restart                 - Restart development containers"
    echo "  logs                    - Show real-time development logs"
    echo "  makemigrations          - Generate new backend database migrations"
    echo "  migrate                 - Run database migrations in dev"
    echo "  createsuperuser         - Create a Django admin superuser in dev"
    echo "  shell                   - Open backend python shell in dev"
    echo "  test                    - Run backend tests (Dev)"
    echo "  pycheck                 - Run Python syntax check (py_compile)"
    echo "  test-frontend           - Run Jest unit tests in Frontend (Dev)"
    echo "  typecheck               - Run TypeScript type-check in Dev frontend"
    echo "  buildcheck              - Run Next.js build check in Dev frontend"
    echo "  install-frontend        - Install npm packages in Dev frontend"
    echo "  frontend                - Run Next.js frontend locally (npm run dev)"
    echo ""
    echo "=== STAGING ENV ==="
    echo "  build-staging           - Build staging Docker images"
    echo "  up-staging              - Start staging environment"
    echo "  deploy-staging          - Build and start staging environment"
    echo "  down-staging            - Stop staging environment"
    echo "  restart-staging         - Restart staging environment"
    echo "  logs-staging            - Show real-time staging logs"
    echo "  logs-nginx-staging      - Show real-time staging Nginx logs"
    echo "  makemigrations-staging  - Generate staging database migrations"
    echo "  migrate-staging         - Run database migrations in staging"
    echo "  createsuperuser-staging - Create admin superuser in staging"
    echo "  shell-staging           - Open backend python shell in staging"
    echo "  collectstatic-staging   - Compile static assets in staging"
    echo "  test-staging            - Run backend tests (Staging)"
    echo "  pycheck-staging         - Run Python syntax check (Staging)"
    echo "  test-frontend-staging   - Run Jest unit tests in Staging frontend"
    echo "  typecheck-staging       - Run TypeScript type-check in Staging frontend"
    echo "  buildcheck-staging      - Run Next.js build check in Staging frontend"
    echo "  install-frontend-staging - Install npm packages in Staging container"
    echo ""
    echo "=== PRODUCTION ENV (Prod) ==="
    echo "  build                   - Build production Docker images"
    echo "  up-prod                 - Start production environment"
    echo "  deploy-prod             - Build and start production environment"
    echo "  down-prod               - Stop production environment"
    echo "  restart-prod            - Restart production environment"
    echo "  logs-prod               - Show real-time production logs"
    echo "  logs-nginx              - Show real-time Nginx logs (Prod/Staging)"
    echo "  logs-nginx-prod         - Show real-time production Nginx logs"
    echo "  makemigrations-prod     - Generate database migrations (Prod)"
    echo "  migrate-prod            - Run database migrations in prod"
    echo "  shell-prod              - Open backend python shell in prod"
    echo "  collectstatic           - Compile static assets in prod"
    echo "  pycheck-prod            - Run Python syntax check (Prod)"
    echo "  test-frontend-prod      - Run Jest unit tests in Production frontend"
    echo "  install-frontend-prod   - Install npm packages in Production container"
    echo "  certbot                 - Request Let's Encrypt SSL certificate"
    echo ""
    echo "=== UTILITIES ==="
    echo "  purge-bots              - Purge bot/spam subscribers in dev backend (supports --dry-run)"
    echo "  purge-bots-staging      - Purge bot/spam subscribers in staging backend"
    echo "  purge-bots-prod         - Purge bot/spam subscribers in production backend"
    echo "  clean [--all|-a]        - Comprehensive Docker and VPS cleanup (use --all for deep prune)"
    echo "  help                    - Show this help screen"
}

case $COMMAND in
    purge-bots|purge-bots-dev)
        run_django_cmd_dev purge_spam_bots "$@"
        ;;
    purge-bots-staging)
        run_django_cmd_staging purge_spam_bots "$@"
        ;;
    purge-bots-prod)
        run_django_cmd_prod purge_spam_bots "$@"
        ;;
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
    test-frontend|test-frontend-dev)
        echo "Running Jest unit tests in Dev Frontend..."
        run_npm_cmd_dev test -- --no-cache "$@"
        ;;
    install-frontend|install-frontend-dev)
        echo "Installing npm packages in Dev Frontend..."
        run_npm_cmd_dev install "$@"
        ;;
    pycheck)
        echo "Running Python syntax check (py_compile)..."
        if $DOCKER_BIN ps --format '{{.Names}}' 2>/dev/null | grep -q "ambar_dev_backend"; then
            $DOCKER_BIN exec ambar_dev_backend python -m py_compile config/settings.py apps/tickets/views.py apps/performance/views.py
        elif $COMPOSE_BIN ps 2>/dev/null | grep -q "backend"; then
            $COMPOSE_BIN exec backend python -m py_compile config/settings.py apps/tickets/views.py apps/performance/views.py
        elif command -v python &> /dev/null; then
            (cd backend && python -m py_compile config/settings.py apps/tickets/views.py apps/performance/views.py)
        else
            $COMPOSE_BIN run --rm -w /app backend python -m py_compile config/settings.py apps/tickets/views.py apps/performance/views.py
        fi
        ;;
    pycheck-staging)
        echo "Running Python syntax check (py_compile) in Staging..."
        if $DOCKER_BIN ps --format '{{.Names}}' 2>/dev/null | grep -q "ambar_staging_backend"; then
            $DOCKER_BIN exec ambar_staging_backend python -m py_compile config/settings.py apps/tickets/views.py apps/performance/views.py
        elif $COMPOSE_BIN --env-file .env.staging -f docker-compose.staging.yml ps 2>/dev/null | grep -q "backend-staging"; then
            $COMPOSE_BIN --env-file .env.staging -f docker-compose.staging.yml exec backend-staging python -m py_compile config/settings.py apps/tickets/views.py apps/performance/views.py
        else
            $COMPOSE_BIN --env-file .env.staging -f docker-compose.staging.yml run --rm -w /app backend-staging python -m py_compile config/settings.py apps/tickets/views.py apps/performance/views.py
        fi
        ;;
    pycheck-prod)
        echo "Running Python syntax check (py_compile) in Production..."
        if $DOCKER_BIN ps --format '{{.Names}}' 2>/dev/null | grep -q "ambar_backend"; then
            $DOCKER_BIN exec ambar_backend python -m py_compile config/settings.py apps/tickets/views.py apps/performance/views.py
        elif $COMPOSE_BIN -f docker-compose.prod.yml ps 2>/dev/null | grep -q "backend"; then
            $COMPOSE_BIN -f docker-compose.prod.yml exec backend python -m py_compile config/settings.py apps/tickets/views.py apps/performance/views.py
        else
            $COMPOSE_BIN -f docker-compose.prod.yml run --rm -w /app backend python -m py_compile config/settings.py apps/tickets/views.py apps/performance/views.py
        fi
        ;;
    typecheck)
        echo "Running TypeScript type-check in Dev frontend..."
        if $DOCKER_BIN ps --format '{{.Names}}' 2>/dev/null | grep -q "^ambar_dev_frontend$"; then
            $DOCKER_BIN exec -e NODE_OPTIONS="--max-old-space-size=1024" ambar_dev_frontend npm run typecheck "$@"
        else
            $COMPOSE_BIN exec -e NODE_OPTIONS="--max-old-space-size=1024" frontend npm run typecheck "$@"
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
    deploy-staging)
        echo "Deploying MS AMBAR Staging Environment..."
        remove_conflicting_containers ambar_staging_backend ambar_staging_frontend ambar_staging_nginx ambar_staging_autostop
        $COMPOSE_BIN --env-file .env.staging -f docker-compose.staging.yml up -d --build "$@"
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
    logs-nginx-staging)
        if $DOCKER_BIN ps --format '{{.Names}}' 2>/dev/null | grep -q "^ambar_staging_nginx$"; then
            $DOCKER_BIN logs -f --tail=100 ambar_staging_nginx "$@"
        else
            $COMPOSE_BIN --env-file .env.staging -f docker-compose.staging.yml logs -f --tail=100 nginx-staging "$@"
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
    test-frontend-staging)
        echo "Running Jest unit tests in Staging Frontend..."
        run_npm_cmd_staging test -- --no-cache "$@"
        ;;
    install-frontend-staging)
        echo "Installing npm packages in Staging Frontend..."
        run_npm_cmd_staging install "$@"
        ;;
    typecheck-staging)
        echo "Running TypeScript type-check for Staging frontend..."
        if $DOCKER_BIN ps --format '{{.Names}}' 2>/dev/null | grep -q "^ambar_staging_frontend$"; then
            $DOCKER_BIN exec -e NODE_OPTIONS="--max-old-space-size=1024" ambar_staging_frontend npm run typecheck "$@"
        else
            $COMPOSE_BIN --env-file .env.staging -f docker-compose.staging.yml run --rm -e NODE_OPTIONS="--max-old-space-size=1024" frontend-staging npm run typecheck "$@"
        fi
        ;;
    buildcheck-staging)
        echo "Running Next.js build-check for Staging frontend..."
        $COMPOSE_BIN --env-file .env.staging -f docker-compose.staging.yml run --rm frontend-staging npm run build "$@"
        ;;
    test-frontend-prod)
        echo "Running Jest unit tests in Production Frontend..."
        run_npm_cmd_prod test -- --no-cache "$@"
        ;;
    install-frontend-prod)
        echo "Installing npm packages in Production Frontend..."
        run_npm_cmd_prod install "$@"
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
    deploy-prod)
        echo "Deploying MS AMBAR Production Environment..."
        remove_conflicting_containers ambar_backend ambar_frontend
        $COMPOSE_BIN -f docker-compose.prod.yml up -d --build "$@"
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
    logs-nginx|logs-nginx-prod)
        if $DOCKER_BIN ps --format '{{.Names}}' 2>/dev/null | grep -q "^prod_nginx$"; then
            $DOCKER_BIN logs -f --tail=100 prod_nginx "$@"
        elif $DOCKER_BIN ps --format '{{.Names}}' 2>/dev/null | grep -q "^ambar_staging_nginx$"; then
            $DOCKER_BIN logs -f --tail=100 ambar_staging_nginx "$@"
        elif $DOCKER_BIN ps --format '{{.Names}}' 2>/dev/null | grep -q "^ambar_dev_nginx$"; then
            $DOCKER_BIN logs -f --tail=100 ambar_dev_nginx "$@"
        else
            echo "No se encontró ningún contenedor Nginx activo (prod_nginx, ambar_staging_nginx, ambar_dev_nginx)."
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
        echo "Starting comprehensive VPS & Docker system cleanup..."
        echo ""
        DEEP_PRUNING=false
        if [ "$1" = "--all" ] || [ "$1" = "-a" ]; then
            DEEP_PRUNING=true
        fi

        echo "1. Cleaning Docker containers, networks, volumes, images and build cache..."
        if [ "$DEEP_PRUNING" = true ]; then
            echo "   Executing deep system prune (docker system prune -a --volumes -f)..."
            $DOCKER_BIN system prune -a --volumes -f
        else
            echo "   Executing standard system prune (docker system prune -f)..."
            $DOCKER_BIN system prune -f
            $DOCKER_BIN volume prune -f
            $DOCKER_BIN builder prune -f 2>/dev/null || true
        fi
        
        echo "2. Checking for legacy/conflicting Compose project 'ms-ambar'..."
        if $COMPOSE_BIN -p ms-ambar ps -q &>/dev/null || [ -n "$($DOCKER_BIN ps -a --filter 'label=com.docker.compose.project=ms-ambar' -q 2>/dev/null)" ]; then
            echo "   Stopping and removing legacy 'ms-ambar' project containers and networks..."
            $COMPOSE_BIN -p ms-ambar down
        else
            echo "   No legacy 'ms-ambar' project containers found."
        fi

        if command -v journalctl &> /dev/null; then
            echo "3. Vacuuming system logs (journald) to 50MB..."
            sudo journalctl --vacuum-size=50M 2>/dev/null || echo "   (Skip: sudo privileges required to vacuum logs)"
        fi

        echo "4. Truncating large authentication log files (/var/log/btmp)..."
        sudo truncate -s 0 /var/log/btmp /var/log/btmp.1 2>/dev/null || echo "   (Skip: sudo privileges required to truncate /var/log/btmp)"

        if command -v apt-get &> /dev/null; then
            echo "5. Cleaning APT package cache and removing unused packages..."
            sudo apt-get clean -y 2>/dev/null || echo "   (Skip: sudo privileges required for apt-get clean)"
            sudo apt-get autoremove -y 2>/dev/null || echo "   (Skip: sudo privileges required for apt-get autoremove)"
        fi

        echo ""
        echo "Docker system status after cleanup:"
        $DOCKER_BIN system df 2>/dev/null || true
        echo ""
        echo "System cleanup complete! Disk space reclaimed successfully."
        ;;
    *)
        show_help
        ;;
esac

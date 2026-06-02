#!/bin/bash

# Nectar Labs CLI for MS AMBAR
# Script to manage MS AMBAR docker environment easily

COMMAND=$1
if [ $# -gt 0 ]; then
    shift
fi

# Helper function to run Django commands in dev (using exec if running, run --rm if not)
run_django_cmd_dev() {
    if docker compose ps --services --filter "status=running" | grep -q "^backend$"; then
        docker compose exec backend python manage.py "$@"
    else
        docker compose run --rm backend python manage.py "$@"
    fi
}

# Helper function to run Django commands in staging (using exec if running, run --rm if not)
run_django_cmd_staging() {
    if docker compose --env-file .env.staging -f docker-compose.staging.yml ps --services --filter "status=running" | grep -q "^backend-staging$"; then
        docker compose --env-file .env.staging -f docker-compose.staging.yml exec backend-staging python manage.py "$@"
    else
        docker compose --env-file .env.staging -f docker-compose.staging.yml run --rm backend-staging python manage.py "$@"
    fi
}

# Helper function to run Django commands in prod (using exec if running, run --rm if not)
run_django_cmd_prod() {
    if docker compose -f docker-compose.prod.yml ps --services --filter "status=running" | grep -q "^backend$"; then
        docker compose -f docker-compose.prod.yml exec backend python manage.py "$@"
    else
        docker compose -f docker-compose.prod.yml run --rm backend python manage.py "$@"
    fi
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
    echo "  collectstatic           - Compile static assets in prod"
    echo "  certbot                 - Request Let's Encrypt SSL certificate"
    echo "  clean                   - Safe Docker and VPS cleanup"
    echo "  help                    - Show this help screen"
}

case $COMMAND in
    dev)
        echo "Starting MS AMBAR Dev Environment..."
        docker compose up -d --build "$@"
        ;;
    stop)
        echo "Stopping Dev Environment..."
        docker compose down "$@"
        ;;
    restart)
        echo "Restarting Dev Environment..."
        docker compose restart "$@"
        ;;
    logs)
        if [ $# -eq 0 ]; then
            docker compose logs -f --tail=100
        else
            docker compose logs "$@"
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
        docker compose exec frontend npx tsc --noEmit "$@"
        ;;
    buildcheck)
        echo "Running Next.js build-check in Dev frontend..."
        docker compose exec frontend npm run build "$@"
        ;;
    frontend)
        cd frontend && npm run dev "$@"
        ;;
    build-staging)
        echo "Building MS AMBAR Staging Images..."
        docker compose --env-file .env.staging -f docker-compose.staging.yml build "$@"
        ;;
    up-staging)
        echo "Starting MS AMBAR Staging Environment..."
        docker compose --env-file .env.staging -f docker-compose.staging.yml up -d --build "$@"
        ;;
    down-staging|stop-staging)
        echo "Stopping Staging Environment..."
        docker compose --env-file .env.staging -f docker-compose.staging.yml down "$@"
        ;;
    restart-staging)
        echo "Restarting Staging Environment..."
        docker compose --env-file .env.staging -f docker-compose.staging.yml restart "$@"
        ;;
    logs-staging)
        if [ $# -eq 0 ]; then
            docker compose --env-file .env.staging -f docker-compose.staging.yml logs -f --tail=100
        else
            docker compose --env-file .env.staging -f docker-compose.staging.yml logs "$@"
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
        echo "Running TypeScript type-check in Staging frontend..."
        docker compose --env-file .env.staging -f docker-compose.staging.yml exec frontend-staging npx tsc --noEmit "$@"
        ;;
    buildcheck-staging)
        echo "Running Next.js build-check in Staging frontend..."
        docker compose --env-file .env.staging -f docker-compose.staging.yml exec frontend-staging npm run build "$@"
        ;;
    build)
        echo "Building MS AMBAR Production Images..."
        docker compose -f docker-compose.prod.yml build "$@"
        ;;
    up-prod)
        echo "Starting MS AMBAR Production Environment..."
        docker compose -f docker-compose.prod.yml up -d "$@"
        ;;
    down-prod)
        echo "Stopping Production Environment..."
        docker compose -f docker-compose.prod.yml down "$@"
        ;;
    restart-prod)
        echo "Restarting Production Environment..."
        docker compose -f docker-compose.prod.yml restart "$@"
        ;;
    logs-prod)
        if [ $# -eq 0 ]; then
            docker compose -f docker-compose.prod.yml logs -f --tail=100
        else
            docker compose -f docker-compose.prod.yml logs "$@"
        fi
        ;;
    makemigrations-prod)
        run_django_cmd_prod makemigrations "$@"
        ;;
    migrate-prod)
        run_django_cmd_prod migrate "$@"
        ;;
    collectstatic)
        echo "Running collectstatic..."
        if docker compose ps --format json | grep -q "ambar_dev_backend"; then
            run_django_cmd_dev collectstatic --no-input "$@"
        elif docker compose --env-file .env.staging -f docker-compose.staging.yml ps --format json | grep -q "ambar_staging_backend"; then
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
        docker compose -f docker-compose.prod.yml run --rm certbot certonly --webroot --webroot-path=/var/www/certbot -d $DOMAIN -d www.$DOMAIN
        ;;
    clean)
        echo "Starting comprehensive and safe VPS/Docker cleanup..."
        echo ""
        echo "1. Removing stopped containers..."
        docker container prune -f
        
        echo "2. Removing dangling networks..."
        docker network prune -f
        
        echo "3. Removing dangling volumes (only unused/anonymous volumes)..."
        docker volume prune -f
        
        echo "4. Removing dangling/untagged images..."
        docker image prune -f
        
        echo "5. Removing Docker build cache..."
        docker builder prune -f
        
        if command -v journalctl &> /dev/null; then
            echo "6. Vacuuming system logs (journald) to 100MB..."
            sudo journalctl --vacuum-size=100M 2>/dev/null || echo "   (Skip: sudo privileges required to vacuum logs)"
        fi
        
        if command -v apt-get &> /dev/null; then
            echo "7. Cleaning APT package cache..."
            sudo apt-get autoclean -y 2>/dev/null || echo "   (Skip: sudo privileges required to clean APT cache)"
        fi
        
        echo ""
        echo "System cleanup complete! Disk space reclaimed successfully."
        ;;
    *)
        show_help
        ;;
esac

#!/bin/bash

# Nectar Labs CLI for MS AMBAR
# Script to manage MS AMBAR docker environment easily

COMMAND=$1

show_help() {
    echo "==========================================="
    echo "           MS AMBAR - Nectar Labs CLI      "
    echo "==========================================="
    echo ""
    echo "Usage: ./nectar.sh [command]"
    echo ""
    echo "Commands:"
    echo "  dev             - Start development environment (Docker/Podman)"
    echo "  stop            - Stop development environment"
    echo "  restart         - Restart development containers"
    echo "  logs            - Show real-time development logs"
    echo "  makemigrations  - Generate new backend database migrations"
    echo "  migrate         - Run database migrations in dev"
    echo "  createsuperuser - Create a Django admin superuser in dev"
    echo "  shell           - Open backend python shell in dev"
    echo "  frontend        - Run Next.js frontend locally (npm run dev)"
    echo ""
    echo "Production Commands:"
    echo "  build           - Build production Docker images"
    echo "  up-prod         - Start production environment"
    echo "  down-prod       - Stop production environment"
    echo "  restart-prod    - Restart production environment"
    echo "  logs-prod       - Show real-time production logs"
    echo "  migrate-prod    - Run database migrations in prod"
    echo "  collectstatic   - Compile static assets in prod"
    echo "  certbot         - Request Let's Encrypt SSL certificate"
    echo "  help            - Show this help screen"
}

case $COMMAND in
    dev)
        echo "Starting MS AMBAR Dev Environment..."
        docker compose up -d --build
        ;;
    stop)
        echo "Stopping Dev Environment..."
        docker compose down
        ;;
    restart)
        echo "Restarting Dev Environment..."
        docker compose restart
        ;;
    logs)
        docker compose logs -f
        ;;
    makemigrations)
        docker compose run --rm backend python manage.py makemigrations
        ;;
    migrate)
        docker compose exec backend python manage.py migrate
        ;;
    createsuperuser)
        docker compose exec backend python manage.py createsuperuser
        ;;
    shell)
        docker compose exec backend python manage.py shell
        ;;
    frontend)
        cd frontend && npm run dev
        ;;
    build)
        echo "Building MS AMBAR Production Images..."
        docker compose -f docker-compose.prod.yml build
        ;;
    up-prod)
        echo "Starting MS AMBAR Production Environment..."
        docker compose -f docker-compose.prod.yml up -d
        ;;
    down-prod)
        echo "Stopping Production Environment..."
        docker compose -f docker-compose.prod.yml down
        ;;
    restart-prod)
        echo "Restarting Production Environment..."
        docker compose -f docker-compose.prod.yml restart
        ;;
    logs-prod)
        echo "Showing Production Logs..."
        docker compose -f docker-compose.prod.yml logs -f
        ;;
    migrate-prod)
        echo "Running Production Migrations..."
        docker compose -f docker-compose.prod.yml exec backend python manage.py migrate
        ;;
    collectstatic)
        echo "Running collectstatic..."
        if docker compose ps --format json | grep -q "ambar_dev_backend"; then
            echo "Detected Active Development Environment. Running collectstatic..."
            docker compose exec backend python manage.py collectstatic --no-input
        else
            echo "Detected Active Production Environment. Running collectstatic..."
            docker compose -f docker-compose.prod.yml exec backend python manage.py collectstatic --no-input
        fi
        ;;
    certbot)
        DOMAIN=$2
        if [ -z "$DOMAIN" ]; then
            echo "Usage: ./nectar.sh certbot example.com"
            exit 1
        fi
        docker compose -f docker-compose.prod.yml run --rm certbot certonly --webroot --webroot-path=/var/www/certbot -d $DOMAIN -d www.$DOMAIN
        ;;
    *)
        show_help
        ;;
esac

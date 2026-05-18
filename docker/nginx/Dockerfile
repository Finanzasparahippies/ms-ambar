FROM nginx:alpine

# Copy the default configuration to the template path inside the image
COPY default.conf /etc/nginx/default.conf.template

# Dynamically extract the system DNS server and write the final configuration on container startup
RUN echo '#!/bin/sh' > /entrypoint.sh && \
    echo 'RESOLVER_IP=$(awk "/nameserver/ {print \$2; exit}" /etc/resolv.conf)' >> /entrypoint.sh && \
    echo 'echo "Auto-detected DNS Resolver IP: $RESOLVER_IP"' >> /entrypoint.sh && \
    echo 'sed "s/PLACEHOLDER_RESOLVER/$RESOLVER_IP/g" /etc/nginx/default.conf.template > /etc/nginx/conf.d/default.conf' >> /entrypoint.sh && \
    echo 'exec nginx -g "daemon off;"' >> /entrypoint.sh && \
    chmod +x /entrypoint.sh

EXPOSE 80

ENTRYPOINT ["/entrypoint.sh"]

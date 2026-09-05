# Docker setup

Installs Docker Engine and the Compose plugin on Ubuntu using the official
Docker repo.

What it gives you:

- docker engine (daemon + CLI)
- docker compose plugin
- docker group access for the current user

Run:

```bash
./install.sh
```

After install, log out/in (or run `newgrp docker`) to use Docker without sudo.
If you previously had the Ubuntu `docker.io` package installed, this setup
will remove it to avoid conflicts.

Note: setup may update `~/.profile` and `~/.zshrc` for PATH defaults.

Useful commands:

```bash
# List images and containers
docker images
docker ps
docker ps -a

# Inspect logs
docker logs <container>

# Exec into a running container
docker exec -it <container> /bin/sh
docker exec -it <container> /bin/bash

# Stop and remove containers
docker stop <container>
docker rm <container>

# Remove images
docker rmi <image>
```

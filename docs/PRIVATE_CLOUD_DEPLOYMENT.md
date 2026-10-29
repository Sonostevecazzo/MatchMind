# Private cloud deployment (Oracle Cloud + Cloudflare Tunnel)

This guide is for a single-person MatchMind instance. Do not expose port 8000 directly to the internet.

## Architecture

- A small Ubuntu VM runs MatchMind in Docker.
- Docker Compose stores SQLite in a persistent `./data` directory.
- The app's HTTP Basic authentication is enabled with private environment variables.
- Cloudflare Tunnel provides HTTPS ingress without opening an inbound web port on the VM.
- The daily Serie A refresh runs in the MatchMind process at 04:05 Europe/Rome.

A free VM is subject to provider availability, account verification, regional capacity and free-tier terms. This setup is not complete until you create the VM and test it.

## 1. Prepare the VM

Create an Ubuntu LTS VM in your cloud account. Use SSH keys, not password SSH. In the cloud firewall/security list, allow SSH only from your own IP if possible; do not allow inbound TCP 8000, 80 or 443. Keep the VM updated.

Install Docker Engine and the Docker Compose plugin using Docker's official Ubuntu installation instructions. Then connect by SSH.

## 2. Get the private repository onto the VM

Use a GitHub deploy key restricted to this repository, or authenticate with GitHub CLI. Do not put a personal access token into a shell command, repository file, or chat message. Clone `Sonostevecazzo/MatchMind` and check out `main` only after the security PR is reviewed and merged.

## 3. Configure private credentials

From the repository directory:

```bash
cp .env.example .env
mkdir -p data
chmod 700 data
```

Edit `.env` locally on the VM and set at least:

```dotenv
MATCHMIND_REQUIRE_AUTH=true
MATCHMIND_AUTH_USERNAME=choose-a-private-username
MATCHMIND_AUTH_PASSWORD=replace-with-a-long-unique-random-password
MATCHMIND_PUBLIC_AUTO_SYNC=true
MATCHMIND_PUBLIC_SYNC_ON_STARTUP=true
MATCHMIND_PUBLIC_SYNC_HOUR=4
MATCHMIND_PUBLIC_SYNC_MINUTE=5
MATCHMIND_TIMEZONE=Europe/Rome
DATABASE_URL=sqlite:///./data/matchmind.db
```

Choose a long unique password. Do not use these example values as actual credentials. Restrict the file permissions:

```bash
chmod 600 .env
```

Do not commit `.env`. Do not add any API key unless you intentionally use API-Football.

## 4. Start MatchMind locally on the VM

The included Compose file binds the app to `127.0.0.1:8000`, so it is not directly exposed on the VM's network interface.

```bash
docker compose up --build -d
docker compose ps
docker compose logs --tail=100 matchmind
```

Check locally on the VM:

```bash
curl -I http://127.0.0.1:8000/
curl -s http://127.0.0.1:8000/health
```

The first command should return HTTP 401 when auth is enabled, because it does not send credentials. The health endpoint should also require authentication.

## 5. Connect Cloudflare Tunnel

In the Cloudflare dashboard, add a domain to Cloudflare if you do not already have one active there. Under **Zero Trust → Networks → Tunnels**, create a named tunnel and follow Cloudflare's current instructions to install `cloudflared` on the VM and run it as a service.

Create a public hostname such as `matchmind.your-domain.example` and route it to:

```
http://localhost:8000
```

Use your real hostname, not the example domain. Do not publish a second route directly to port 8000. Cloudflare Tunnel should be the only public route to the app. Keep app-level username/password authentication enabled as a second layer. If you also configure Cloudflare Access, add an allow policy limited to your own identity/email.

Follow the official Cloudflare Tunnel guide: https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/

## 6. Verify from your phone

On Android, open the HTTPS hostname in Chrome. The browser should prompt for the MatchMind username and password. Confirm that:
- `/` shows the dashboard only after authentication;
- `/health` and `/docs` also require authentication;
- wrong credentials are rejected;
- Serie A fixtures/results appear after the first sync;
- the data remain after `docker compose restart`;
- the container starts again after a VM reboot.

The daily scheduler runs only while the MatchMind process is running. A free VM that is stopped or reclaimed cannot run the scheduled job during downtime.

## Important limitations

- This uses the public open-matchday dataset: daily, not live; coverage varies and it does not provide bookmaker odds, injuries or complete player availability.
- MatchMind's current model is a statistical baseline, not a validated AI betting model. Do not treat outputs as guaranteed predictions.
- Back up `./data/matchmind.db` regularly and test restoring a backup.
- Do not expose the app publicly until authentication, HTTPS and persistent storage have all been verified.

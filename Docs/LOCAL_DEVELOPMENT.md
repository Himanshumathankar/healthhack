# Local Development

Run local infrastructure:

```bash
docker compose up -d
```

Install dependencies:

```bash
pnpm install
```

Prepare database:

```bash
pnpm db:generate
pnpm db:migrate:dev
pnpm db:seed:dev
```

Run all processes:

```bash
pnpm dev
```

Local services:

- Web: `http://localhost:3000`
- API: `http://localhost:4000/api/v1/health`
- OpenAPI: `http://localhost:4000/api/docs`
- Mailpit: `http://localhost:8025`
- MinIO: `http://localhost:9001`

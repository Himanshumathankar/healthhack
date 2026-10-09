#!/usr/bin/env bash
set -euo pipefail
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_ROOT"
if [ "${NODE_ENV:-development}" = "production" ]; then
  echo "The development admin bootstrap cannot run in production." >&2
  exit 1
fi
if [ -f .env ]; then
  set -a
  source ./.env
  set +a
fi
if [ "${NODE_ENV:-development}" = "production" ]; then
  echo "The development admin bootstrap cannot run in production." >&2
  exit 1
fi
pnpm --filter @healthhack/api exec node --input-type=module <<'JS'
import { createRequire } from 'node:module';
import argon2 from 'argon2';
const require = createRequire(new URL('./package.json', import.meta.url));
const { PrismaClient } = require('../../packages/database/node_modules/@prisma/client');
const db = new PrismaClient();
try {
  const existing = await db.user.findUnique({where:{username:'adminstratore'}});
  if(existing && existing.globalRole !== 'SUPER_ADMIN') throw new Error('This username belongs to an existing account; bootstrap did not change it.');
  if(existing) { console.log('Development super admin already exists; password unchanged.'); }
  else {
    const role = await db.organizationRole.findUnique({where:{builtInKey:'SUPER_ADMIN'}});
    if(!role) throw new Error('Start the API once to initialize built-in roles, then rerun bootstrap.');
    const passwordHash = await argon2.hash('adminstratore', {type:argon2.argon2id});
    await db.user.create({data:{username:'adminstratore', email:'adminstratore@healthhack.local', passwordHash, globalRole:'SUPER_ADMIN', organizationRoleId:role.id, emailVerifiedAt:new Date(), profile:{create:{fullName:'Administrator',skills:[]}}}});
    console.log('Created local-development super admin: adminstratore');
  }
} finally {await db.$disconnect();}
JS

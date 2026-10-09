import { config as loadEnv } from 'dotenv';
import * as bcrypt from 'bcrypt';
import { DataSource } from 'typeorm';
import { User, UserRole } from '../modules/users/entities/user.entity';

// Deliberately a manual script, not something that runs on boot: an auto-seeding app would recreate an admin someone intentionally
// removed, and carry the seed password into every environment it starts in. Run with: npm run seed:admin
loadEnv();

async function seedAdmin(): Promise<void> {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;
  const name = process.env.ADMIN_NAME ?? 'Admin';

  if (!email || !password) {
    console.error('ADMIN_EMAIL and ADMIN_PASSWORD must both be set.');
    process.exit(1);
  }

  if (process.env.NODE_ENV === 'production' && password.length < 12) {
    console.error('Refusing to seed a production admin with a password under 12 characters.');
    process.exit(1);
  }

  const dataSource = new DataSource({
    type: 'postgres',
    url: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : false,
    entities: [User],
    synchronize: false,
  });

  await dataSource.initialize();

  try {
    const repo = dataSource.getRepository(User);
    const existing = await repo.findOne({ where: { email } });

    if (existing) {
      console.log(`Admin ${email} already exists (role: ${existing.role}). Nothing to do.`);
      return;
    }

    const rounds = Number.parseInt(process.env.BCRYPT_SALT_ROUNDS ?? '12', 10);

    await repo.save(
      repo.create({
        email,
        name,
        role: UserRole.ADMIN,
        passwordHash: await bcrypt.hash(password, rounds),
        // Seeded by an operator who already controls the deployment — nothing for an email round-trip to prove.
        emailVerified: true,
      }),
    );

    console.log(`Created admin ${email}. Change this password after first sign-in.`);
  } finally {
    await dataSource.destroy();
  }
}

seedAdmin().catch((error: unknown) => {
  console.error('Admin seed failed:', error instanceof Error ? error.message : error);
  process.exit(1);
});

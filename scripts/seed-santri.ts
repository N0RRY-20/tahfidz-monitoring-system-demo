import "dotenv/config";
import { db } from "../src/db";
import { user, userRole, account } from "../src/db/schema/auth-schema";
import { santriProfiles, classes } from "../src/db/schema/tahfidz-schema";
import { randomUUID } from "crypto";
import { eq } from "drizzle-orm";
import { auth } from "../src/lib/auth";

const DEFAULT_PASSWORD = "password123";

const namaDepan = [
  "Ahmad",
  "Muhammad",
  "Abdullah",
  "Umar",
  "Ali",
  "Ibrahim",
  "Yusuf",
  "Ismail",
  "Hasan",
  "Husain",
  "Bilal",
  "Hamza",
  "Zaid",
  "Khalid",
  "Salman",
  "Faris",
  "Fatimah",
  "Aisyah",
  "Khadijah",
  "Maryam",
  "Zahra",
  "Hafsah",
  "Ruqayyah",
  "Zainab",
  "Aminah",
  "Safiyah",
  "Asma",
  "Halimah",
  "Sumayyah",
  "Laila",
];

const namaBelakang = [
  "Al-Farisi",
  "An-Nawawi",
  "Al-Ghazali",
  "Ar-Razi",
  "Al-Bukhari",
  "At-Tirmidzi",
  "Hidayatullah",
  "Rahmatullah",
  "Saifullah",
  "Habibullah",
  "Nurul Huda",
  "Nur Iman",
  "Baitul Makmur",
  "Darul Hikmah",
  "Raudhatul Jannah",
];

const namaGuru = [
  { name: "Ustadz Ahmad Fauzan", email: "ustadz.fauzan@ponpes.id" },
  { name: "Ustadz Muhammad Rizki", email: "ustadz.rizki@ponpes.id" },
  { name: "Ustadzah Fatimah Azzahra", email: "ustadzah.fatimah@ponpes.id" },
  { name: "Ustadz Abdullah Hakim", email: "ustadz.hakim@ponpes.id" },
  { name: "Ustadzah Aisyah Rahmah", email: "ustadzah.aisyah@ponpes.id" },
];

function randomPick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

// Menggunakan auth.api.signUpEmail untuk membuat user dengan password yang benar
async function createUserWithAuth(
  userData: { name: string; email: string },
  roleId: string
): Promise<string> {
  // Cek apakah user sudah ada
  const existingUser = await db
    .select({ id: user.id })
    .from(user)
    .where(eq(user.email, userData.email))
    .limit(1);

  if (existingUser.length > 0) {
    console.log(`    User ${userData.email} sudah ada, skip...`);
    return existingUser[0].id;
  }

  try {
    // Gunakan better-auth API untuk membuat user dengan password yang benar
    const result = await auth.api.signUpEmail({
      body: {
        name: userData.name,
        email: userData.email,
        password: DEFAULT_PASSWORD,
      },
    });

    if (result && result.user) {
      // Assign role
      await db
        .insert(userRole)
        .values({ userId: result.user.id, roleId: roleId })
        .onConflictDoNothing();

      return result.user.id;
    } else {
      throw new Error("Failed to create user");
    }
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`    Error creating ${userData.email}: ${errorMessage}`);
    throw error;
  }
}

async function seedSantri() {
  console.log("Starting Santri & Guru Seed...\n");
  console.log(`Default password: ${DEFAULT_PASSWORD}\n`);

  const classesList = await db.select().from(classes);
  if (classesList.length === 0) {
    console.log("No classes found. Run db:seed-classes first.");
    return;
  }
  console.log(`Found ${classesList.length} classes.\n`);

  console.log("Creating guru users (via better-auth API)...");
  const guruIds: string[] = [];

  for (const guru of namaGuru) {
    const guruId = await createUserWithAuth(guru, "role_guru");
    guruIds.push(guruId);
    console.log(`  Created: ${guru.name} (${guru.email})`);
  }

  console.log(`\nTotal guru: ${guruIds.length}\n`);

  console.log("Creating santri profiles...");
  const TOTAL_SANTRI = 50;
  let createdCount = 0;

  for (let i = 0; i < TOTAL_SANTRI; i++) {
    const firstName = randomPick(namaDepan);
    const lastName = randomPick(namaBelakang);
    const fullName = `${firstName} ${lastName}`;
    const email = `santri${i + 1}@ponpes.id`;
    const assignedGuru = randomPick(guruIds);
    const assignedClass = randomPick(classesList);

    const userId = await createUserWithAuth(
      { name: fullName, email: email },
      "role_santri"
    );

    const existingProfile = await db
      .select({ id: santriProfiles.id })
      .from(santriProfiles)
      .where(eq(santriProfiles.userId, userId))
      .limit(1);

    if (existingProfile.length === 0) {
      await db.insert(santriProfiles).values({
        id: randomUUID(),
        userId: userId,
        fullName: fullName,
        classId: assignedClass.id,
        assignedGuruId: assignedGuru,
      });
    }

    createdCount++;

    if (createdCount % 10 === 0) {
      console.log(`  Created ${createdCount}/${TOTAL_SANTRI} santri...`);
    }
  }

  console.log(`\n${createdCount} santri processed!`);
  console.log("\nSeed completed!");
  console.log(`\nLogin credentials:`);
  console.log(`  Email guru: ustadz.fauzan@ponpes.id`);
  console.log(`  Email santri: santri1@ponpes.id to santri50@ponpes.id`);
  console.log(`  Password: ${DEFAULT_PASSWORD}`);
}

seedSantri()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Seed failed:", err);
    process.exit(1);
  });

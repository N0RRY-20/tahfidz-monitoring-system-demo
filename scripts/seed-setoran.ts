import "dotenv/config";
import { db } from "../src/db";
import {
  dailyRecords,
  recordTags,
  santriProfiles,
  quranMeta,
  masterTags,
} from "../src/db/schema/tahfidz-schema";
import { eq, isNotNull } from "drizzle-orm";
import { randomUUID } from "crypto";

// Helper: Generate tanggal dalam format YYYY-MM-DD untuk N hari yang lalu
function getDateString(daysAgo: number): string {
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

// Helper: Random integer between min and max (inclusive)
function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// Helper: Random pick dari array
function randomPick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

// Helper: Random subset dari array
function randomSubset<T>(arr: T[], maxCount: number): T[] {
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  const count = randomInt(0, Math.min(maxCount, arr.length));
  return shuffled.slice(0, count);
}

// Weighted random color status (lebih banyak hijau)
function randomColorStatus(): "G" | "Y" | "R" {
  const rand = Math.random();
  if (rand < 0.6) return "G"; // 60% hijau
  if (rand < 0.9) return "Y"; // 30% kuning
  return "R"; // 10% merah
}

// Pool catatan realistis
const notesPool = [
  null,
  null, // Lebih sering tanpa catatan
  null,
  "Alhamdulillah lancar",
  "Perlu diulang lagi besok",
  "Sedikit lupa di tengah",
  "Sudah lebih baik dari kemarin",
  "Fokus kurang, perlu istirahat dulu",
  "Sangat baik, lanjutkan!",
  "Perhatikan tajwid ikhfa",
  "Mad terlalu pendek, perbaiki",
  "Makhraj sudah bagus",
  "Semangat terus!",
];

async function seedSetoran() {
  console.log("📚 Starting Setoran Seed (1 Bulan)...\n");

  // 1. Fetch semua santri yang punya guru
  const santriList = await db
    .select({
      id: santriProfiles.id,
      fullName: santriProfiles.fullName,
      guruId: santriProfiles.assignedGuruId,
    })
    .from(santriProfiles)
    .where(isNotNull(santriProfiles.assignedGuruId));

  if (santriList.length === 0) {
    console.log("⚠️  Tidak ada santri yang memiliki guru assigned.");
    console.log("   Silakan assign guru ke santri terlebih dahulu.");
    return;
  }

  console.log(
    `📋 Ditemukan ${santriList.length} santri dengan guru assigned.\n`
  );

  // 2. Fetch surat Al-Qur'an (prioritas Juz 30)
  const surahList = await db.select().from(quranMeta);
  const juz30Surahs = surahList.filter((s) => s.juzNumber === 30);
  const prioritySurahs =
    juz30Surahs.length > 0 ? juz30Surahs : surahList.slice(0, 20);

  console.log(
    `📖 Menggunakan ${prioritySurahs.length} surat (prioritas Juz 30).\n`
  );

  // 3. Fetch tags
  const tagsList = await db.select().from(masterTags);
  console.log(`🏷️  Ditemukan ${tagsList.length} tags.\n`);

  // 4. Generate setoran untuk 30 hari ke belakang
  const DAYS = 30;
  let totalRecords = 0;
  let totalTags = 0;

  for (const santri of santriList) {
    console.log(`👤 Processing: ${santri.fullName}`);
    let santriRecords = 0;

    for (let day = 1; day <= DAYS; day++) {
      // Skip beberapa hari secara random (simulasi libur/izin) - 20% chance skip
      if (Math.random() < 0.2) continue;

      const dateStr = getDateString(day);

      // Decide tipe setoran hari ini (bisa keduanya, salah satu, atau tidak ada)
      const hasZiyadah = Math.random() < 0.7; // 70% ada ziyadah
      const hasMurajaah = Math.random() < 0.6; // 60% ada murajaah

      if (hasZiyadah) {
        const surah = randomPick(prioritySurahs);
        const ayatStart = randomInt(1, Math.max(1, surah.totalAyat - 5));
        const ayatEnd = randomInt(
          ayatStart,
          Math.min(surah.totalAyat, ayatStart + 10)
        );

        const recordId = randomUUID();
        await db.insert(dailyRecords).values({
          id: recordId,
          santriId: santri.id,
          guruId: santri.guruId!,
          date: dateStr,
          surahId: surah.id,
          ayatStart,
          ayatEnd,
          colorStatus: randomColorStatus(),
          type: "ziyadah",
          notesText: randomPick(notesPool),
        });

        // Insert random tags
        const selectedTags = randomSubset(tagsList, 3);
        for (const tag of selectedTags) {
          await db.insert(recordTags).values({
            recordId,
            tagId: tag.id,
          });
          totalTags++;
        }

        santriRecords++;
      }

      if (hasMurajaah) {
        const surah = randomPick(prioritySurahs);
        const ayatStart = randomInt(1, Math.max(1, surah.totalAyat - 10));
        const ayatEnd = randomInt(
          ayatStart,
          Math.min(surah.totalAyat, ayatStart + 20)
        );

        const recordId = randomUUID();
        await db.insert(dailyRecords).values({
          id: recordId,
          santriId: santri.id,
          guruId: santri.guruId!,
          date: dateStr,
          surahId: surah.id,
          ayatStart,
          ayatEnd,
          colorStatus: randomColorStatus(),
          type: "murajaah",
          notesText: randomPick(notesPool),
        });

        // Insert random tags
        const selectedTags = randomSubset(tagsList, 3);
        for (const tag of selectedTags) {
          await db.insert(recordTags).values({
            recordId,
            tagId: tag.id,
          });
          totalTags++;
        }

        santriRecords++;
      }
    }

    console.log(`   ✅ ${santriRecords} records created`);
    totalRecords += santriRecords;
  }

  console.log("\n🎉 Setoran Seed completed!");
  console.log(`\n📊 Summary:`);
  console.log(`   - Total santri: ${santriList.length}`);
  console.log(`   - Total records: ${totalRecords}`);
  console.log(`   - Total tags assigned: ${totalTags}`);
  console.log(`   - Period: ${DAYS} hari ke belakang`);
}

seedSetoran()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("❌ Seed failed:", err);
    process.exit(1);
  });

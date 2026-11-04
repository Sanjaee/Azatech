import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { eq } from 'drizzle-orm';
import { getDb, getPool } from './index';
import { users, products, customers } from './schema';
import { env } from '../config/env';

export const SEED_PRODUCTS = [
  {
    productCode: 'PRD-ELC-001',
    name: 'Logitech MX Master 3S Wireless Mouse',
    description: 'Ergonomic performance wireless mouse with quiet clicks and 8K DPI sensor',
    price: '1650000.00',
    stock: 45,
  },
  {
    productCode: 'PRD-ELC-002',
    name: 'Keychron K2 Pro Mechanical Keyboard',
    description: 'QMK/VIA wireless custom mechanical keyboard 75% layout tactile switches',
    price: '1850000.00',
    stock: 30,
  },
  {
    productCode: 'PRD-ELC-003',
    name: 'Dell UltraSharp 27" 4K USB-C Hub Monitor (U2723QE)',
    description: '27-inch 4K IPS Black panel monitor with 90W USB-C power delivery',
    price: '9450000.00',
    stock: 15,
  },
  {
    productCode: 'PRD-ELC-004',
    name: 'Sony WH-1000XM5 Noise Canceling Headphones',
    description: 'Industry-leading wireless active noise canceling over-ear headphones',
    price: '5499000.00',
    stock: 25,
  },
  {
    productCode: 'PRD-ELC-005',
    name: 'Anker 737 Power Bank (PowerCore 24K)',
    description: '24,000mAh 3-port portable charger with 140W Power Delivery 3.1',
    price: '2150000.00',
    stock: 60,
  },
  {
    productCode: 'PRD-ELC-006',
    name: 'Samsung T7 Shield 2TB Portable SSD',
    description: 'Rugged IP65 water and dust resistant USB 3.2 Gen 2 external SSD',
    price: '2890000.00',
    stock: 40,
  },
  {
    productCode: 'PRD-ELC-007',
    name: 'CalDigit TS4 Thunderbolt 4 Dock',
    description: '18-port Thunderbolt 4 docking station with 98W host charging and 2.5GbE',
    price: '6750000.00',
    stock: 12,
  },
  {
    productCode: 'PRD-ELC-008',
    name: 'Elgato Stream Deck MK.2 (15 Keys)',
    description: 'Studio controller with 15 customizable LCD keys and detachable stand',
    price: '2480000.00',
    stock: 22,
  },
  {
    productCode: 'PRD-OFF-009',
    name: 'BenQ ScreenBar Halo Monitor Light',
    description: 'LED monitor lamp with wireless controller and back-light auto dimming',
    price: '2690000.00',
    stock: 35,
  },
  {
    productCode: 'PRD-OFF-010',
    name: 'Herman Miller Sayl Ergonomic Office Chair',
    description: 'Frameless 3D Intelligent suspension back ergonomic task chair',
    price: '12500000.00',
    stock: 8,
  },
  {
    productCode: 'PRD-NET-011',
    name: 'Ubiquiti UniFi Dream Router (UDR)',
    description: 'All-in-one WiFi 6 enterprise router with PoE switch and UniFi OS Console',
    price: '3850000.00',
    stock: 18,
  },
  {
    productCode: 'PRD-NET-012',
    name: 'Synology DiskStation DS923+ 4-Bay NAS',
    description: 'Scalable 4-bay network attached storage powered by AMD Ryzen R1600',
    price: '9850000.00',
    stock: 10,
  },
  {
    productCode: 'PRD-ACC-013',
    name: 'Apple USB-C to MagSafe 3 Cable (2m)',
    description: 'Magnetic charging cable for MacBook Pro and MacBook Air',
    price: '799000.00',
    stock: 75,
  },
  {
    productCode: 'PRD-ACC-014',
    name: 'Belkin BoostCharge Pro 3-in-1 Wireless Charger',
    description: '15W MagSafe wireless charging stand for iPhone, Apple Watch, and AirPods',
    price: '2290000.00',
    stock: 50,
  },
  {
    productCode: 'PRD-BEV-015',
    name: 'Hydrococo Original Coconut Water 250ml (Pack of 24)',
    description: 'Natural coconut water refreshment carton pack for office pantry',
    price: '150000.00',
    stock: 100,
  },
];

export const SEED_CUSTOMERS = [
  {
    name: 'PT Nusantara Digital Solusi',
    email: 'procurement@nusantaradigital.co.id',
    phone: '+62-21-5550101',
    address: 'Jl. Jend. Sudirman Kav. 52-53, SCBD, Jakarta Selatan 12190',
  },
  {
    name: 'CV Karya Mandiri Teknologi',
    email: 'purchasing@karyamandiri.id',
    phone: '+62-22-4209876',
    address: 'Jl. Dago No. 118, Coblong, Kota Bandung, Jawa Barat 40132',
  },
  {
    name: 'PT Sinar Inovasi Nusantara',
    email: 'finance@sinarinovasi.co.id',
    phone: '+62-31-5312233',
    address: 'Jl. Basuki Rahmat No. 88, Genteng, Surabaya, Jawa Timur 60271',
  },
  {
    name: 'Budi Santoso',
    email: 'budi.santoso@jakarta-mail.id',
    phone: '+62-812-3456-7890',
    address: 'Jl. Kemang Raya No. 45, Mampang Prapatan, Jakarta Selatan 12730',
  },
  {
    name: 'Siti Rahmawati',
    email: 'siti.rahmawati@kreasi.id',
    phone: '+62-813-9876-5432',
    address: 'Jl. Kaliurang KM 5.5, Sleman, DI Yogyakarta 55281',
  },
  {
    name: 'PT Mega Logistik Express',
    email: 'ops@megalogistik.co.id',
    phone: '+62-21-6509988',
    address: 'Jl. Yos Sudarso Kav. 85, Sunter, Jakarta Utara 14350',
  },
  {
    name: 'Andi Wijaya Kusuma',
    email: 'andi.wijaya@archstudio.id',
    phone: '+62-811-2233-4455',
    address: 'Jl. Sunset Road No. 102, Kuta, Badung, Bali 80361',
  },
  {
    name: 'PT FinTech Amanah Indonesia',
    email: 'it-supply@fintechamanah.co.id',
    phone: '+62-21-29887766',
    address: 'Menara Kuningan Lt. 15, Jl. HR Rasuna Said, Jakarta Selatan 12940',
  },
  {
    name: 'Dewi Lestari Putri',
    email: 'dewi.lestari@medika-group.id',
    phone: '+62-815-6789-0123',
    address: 'Jl. Pemuda No. 142, Sekayu, Kota Semarang, Jawa Tengah 50132',
  },
  {
    name: 'PT Agro Cipta Persada',
    email: 'admin@agrocipta.co.id',
    phone: '+62-61-4567890',
    address: 'Jl. Diponegoro No. 31, Madras Hulu, Kota Medan, Sumatera Utara 20152',
  },
];

export async function runSeed(customDb = getDb()): Promise<void> {
  console.log('Running database seeder...');

  const passwordHash = await bcrypt.hash(env.SEED_ADMIN_PASSWORD, 10);

  // 1. Idempotent Admin User Upsert
  await customDb
    .insert(users)
    .values({
      name: env.SEED_ADMIN_NAME,
      email: env.SEED_ADMIN_EMAIL.toLowerCase(),
      passwordHash,
    })
    .onConflictDoUpdate({
      target: users.email,
      set: {
        name: env.SEED_ADMIN_NAME,
        passwordHash,
        updatedAt: new Date(),
      },
    });

  // 2. Idempotent Products Upsert (16 realistic products)
  for (const prod of SEED_PRODUCTS) {
    await customDb
      .insert(products)
      .values(prod)
      .onConflictDoUpdate({
        target: products.productCode,
        set: {
          name: prod.name,
          description: prod.description,
          price: prod.price,
          updatedAt: new Date(),
        },
      });
  }

  // 3. Idempotent Customers Seed (11 realistic customers)
  for (const cust of SEED_CUSTOMERS) {
    const existing = await customDb
      .select({ id: customers.id })
      .from(customers)
      .where(eq(customers.name, cust.name))
      .limit(1);

    if (existing.length === 0) {
      await customDb.insert(customers).values(cust);
    }
  }

  console.log(
    `Seeder selesai: 1 user admin (${env.SEED_ADMIN_EMAIL}), ${SEED_PRODUCTS.length} produk, ${SEED_CUSTOMERS.length} pelanggan.`
  );
}

if (require.main === module) {
  runSeed()
    .then(async () => {
      await getPool().end();
      process.exit(0);
    })
    .catch(async (err) => {
      console.error('Seed failed:', err);
      await getPool().end();
      process.exit(1);
    });
}

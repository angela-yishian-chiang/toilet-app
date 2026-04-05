/**
 * seed.js — One-time script to migrate db.json data into Firestore.
 *
 * Usage (local):
 *   1. Download your Firebase service account key from:
 *      Firebase Console → Project Settings → Service Accounts → Generate new private key
 *   2. Save it as serviceAccountKey.json in this directory (it's git-ignored)
 *   3. Run: $env:GOOGLE_APPLICATION_CREDENTIALS=".\serviceAccountKey.json"
 *           node seed.js
 */

const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');

// Initialize Firebase Admin
if (!admin.apps.length) {
    admin.initializeApp();
}

const db = admin.firestore();
const CAFES_COLLECTION = 'cafes';

async function seed() {
    const dbPath = path.join(__dirname, 'db.json');

    if (!fs.existsSync(dbPath)) {
        console.error('db.json not found. Nothing to seed.');
        process.exit(1);
    }

    const cafes = JSON.parse(fs.readFileSync(dbPath, 'utf-8'));
    console.log(`Seeding ${cafes.length} cafes into Firestore collection "${CAFES_COLLECTION}"...`);

    const batch = db.batch();

    cafes.forEach(cafe => {
        const docRef = db.collection(CAFES_COLLECTION).doc(cafe.id);
        batch.set(docRef, cafe);
    });

    await batch.commit();
    console.log('✅ Seed complete! All cafes have been written to Firestore.');
    process.exit(0);
}

seed().catch(err => {
    console.error('❌ Seed failed:', err);
    process.exit(1);
});

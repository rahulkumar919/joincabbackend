# 🔥 Firebase Admin SDK Setup Guide

## Current Status

✅ **Client credentials configured** (google-services.json)
- Project ID: `joincab-44b25`
- Project Number: `395978440881`
- API Key: `AIzaSyDt048vFHCM8dvUlkJTOWcHwzoQGhctLBQ`

⚠️ **Admin SDK credentials needed** for backend push notifications

---

## Why You Need Admin SDK?

The backend needs Firebase Admin SDK to:
- Send push notifications to users
- Verify FCM tokens
- Manage user authentication server-side

---

## How to Get Firebase Admin SDK Credentials

### Step 1: Go to Firebase Console
1. Open: https://console.firebase.google.com/
2. Select project: **joincab-44b25**

### Step 2: Navigate to Service Accounts
1. Click **⚙️ Settings** (gear icon) → **Project settings**
2. Click **Service accounts** tab
3. Scroll down to **Firebase Admin SDK** section

### Step 3: Generate Private Key
1. Click **"Generate new private key"** button
2. Click **"Generate key"** in confirmation dialog
3. A JSON file will download (e.g., `joincab-44b25-firebase-adminsdk-xxxxx.json`)

### Step 4: Extract Credentials from JSON

Open the downloaded JSON file. It will look like:

```json
{
  "type": "service_account",
  "project_id": "joincab-44b25",
  "private_key_id": "abc123...",
  "private_key": "-----BEGIN PRIVATE KEY-----\nMIIE...\n-----END PRIVATE KEY-----\n",
  "client_email": "firebase-adminsdk-xxxxx@joincab-44b25.iam.gserviceaccount.com",
  "client_id": "123456789...",
  "auth_uri": "https://accounts.google.com/o/oauth2/auth",
  "token_uri": "https://oauth2.googleapis.com/token",
  "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
  "client_x509_cert_url": "https://www.googleapis.com/robot/v1/metadata/x509/..."
}
```

### Step 5: Update Backend .env File

Copy these values from the JSON to your `.env`:

```env
FIREBASE_PROJECT_ID=joincab-44b25
FIREBASE_PRIVATE_KEY_ID=<copy from private_key_id>
FIREBASE_PRIVATE_KEY="<copy entire private_key including -----BEGIN and -----END>"
FIREBASE_CLIENT_EMAIL=<copy from client_email>
FIREBASE_CLIENT_ID=<copy from client_id>
FIREBASE_CLIENT_X509_CERT_URL=<copy from client_x509_cert_url>
```

**IMPORTANT:** 
- Keep the quotes around `FIREBASE_PRIVATE_KEY`
- Don't remove the `\n` characters in the private key
- Keep the entire key on one line

### Step 6: Update Render Environment Variables

1. Go to: https://dashboard.render.com
2. Select your service: **joincabbackend**
3. Go to **Environment** tab
4. Update/Add these variables with the values from Step 5
5. Click **Save Changes** (will trigger redeploy)

---

## Alternative: Use Existing Credentials (If Available)

If you already have Firebase Admin SDK credentials from the old deployment:

1. Check old `.env` file or deployment settings
2. Copy the `FIREBASE_*` variables
3. Paste into new `.env` file

---

## Testing Firebase Connection

After updating credentials, test the connection:

```bash
cd C:\Desktop\cabjoin\cabjoin\cabbazar-backend
node -e "
const admin = require('firebase-admin');
admin.initializeApp({
  credential: admin.credential.cert({
    projectId: process.env.FIREBASE_PROJECT_ID,
    privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL
  })
});
console.log('✅ Firebase Admin SDK initialized successfully!');
"
```

---

## Current Configuration

**Frontend (taxi-bazar):**
- ✅ `google-services.json` created
- ✅ Package name: `com.rahulkumar.joincab`
- ✅ API Key configured

**Backend (cabbazar-backend):**
- ✅ Project ID configured
- ⚠️ Admin SDK credentials needed (follow steps above)

---

## Troubleshooting

### "Invalid credentials" error
- Check that private key includes `-----BEGIN PRIVATE KEY-----` and `-----END PRIVATE KEY-----`
- Ensure `\n` characters are preserved
- Verify quotes around the private key value

### "Project not found" error
- Verify `FIREBASE_PROJECT_ID=joincab-44b25`
- Check that service account has proper permissions

### Push notifications not working
- Ensure Admin SDK credentials are correct
- Check that FCM is enabled in Firebase Console
- Verify device FCM token is valid

---

## Security Notes

⚠️ **NEVER commit the service account JSON file to Git!**
⚠️ **Keep `.env` file in `.gitignore`**
⚠️ **Don't share private keys publicly**

---

## Quick Checklist

- [ ] Downloaded service account JSON from Firebase Console
- [ ] Extracted credentials from JSON
- [ ] Updated backend `.env` file
- [ ] Updated Render environment variables
- [ ] Tested Firebase connection
- [ ] Push notifications working

---

**Need help?** Check Firebase documentation: https://firebase.google.com/docs/admin/setup

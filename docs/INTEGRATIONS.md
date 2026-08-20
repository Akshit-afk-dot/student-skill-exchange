# Setting up the integrations

Step-by-step for the four optional services. The code for all of them is already written —
what follows is only how to obtain the credentials.

> **Never commit credentials.** Put them in `server/.env` (which `.gitignore` excludes) for
> local work, and in your host's environment settings for a deployment. If you ever paste a
> secret somewhere public, rotate it immediately — treat it as burned.

Every one of these is optional. The server logs which are active at boot, and falls back
cleanly when they are absent.

---

## 0. MongoDB Atlas — required

Everything else depends on this one.

1. Sign up at [mongodb.com/atlas](https://www.mongodb.com/atlas) and create a **free M0**
   cluster. Pick the region nearest you.
2. **Database Access → Add New Database User.** Choose *Password* auth and
   *Read and write to any database*. Use a long generated password.
3. **Network Access → Add IP Address.**
   - Local development: *Add Current IP Address*.
   - Render/Railway/Fly: they have no fixed egress IPs on free plans, so use
     `0.0.0.0/0`. Your database user's password then becomes the only thing protecting it
     — make it long and random.
4. **Database → Connect → Drivers**, copy the string, and insert your password plus the
   database name:

```
MONGO_URI=mongodb+srv://sse_user:YOUR_PASSWORD@cluster0.ab1cd.mongodb.net/student-skill-exchange?retryWrites=true&w=majority
```

Verify it:

```bash
cd server
npm run seed        # creates the catalogue and 10 demo students
npm run dev
curl http://localhost:4000/health   # → "database": "connected"
```

---

## 1. Cloudinary — profile photos and attachments

Without this, uploads land in `server/uploads/` and are served by the API. That is fine
locally, but **Render, Railway and Fly wipe the filesystem on every deploy**, so uploaded
photos would vanish. Since you are deploying, configure this.

1. Sign up at [cloudinary.com](https://cloudinary.com) — the free tier is 25 GB storage
   and 25 GB monthly bandwidth, far beyond what a project demo needs.
2. The **Dashboard** landing page shows a *Product Environment Credentials* panel with
   **Cloud Name**, **API Key** and **API Secret**. Click the eye icon to reveal the secret.
3. Set all three:

```bash
CLOUDINARY_CLOUD_NAME=dxxxxxxxx
CLOUDINARY_API_KEY=123456789012345
CLOUDINARY_API_SECRET=abcdefgh_IJKLMNOP-qrstuvwxyz
```

**Verify:** restart the server and look for `Storage driver: cloudinary` in the log. Upload
a profile photo from the app; the returned URL should start with
`https://res.cloudinary.com/`. Files appear under `student-skill-exchange/avatars` in your
Cloudinary Media Library.

All three variables are required — the server only switches drivers when it has the full
set, otherwise it silently stays on local disk. If you see `Storage driver: local disk`,
one of them is missing or misspelled.

---

## 2. Firebase Cloud Messaging — push notifications

Without this, notifications still appear in the app's notification centre and arrive over
the socket in real time. FCM only adds the buzz when the app is **closed**.

### Server side

1. Create a project at [console.firebase.google.com](https://console.firebase.google.com).
   Analytics is not needed.
2. **⚙ Project settings → Service accounts → Generate new private key.** A JSON file
   downloads. **This file is a credential** — do not commit it.
3. Open the JSON and copy three fields into your environment:

```bash
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-abc12@your-project-id.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY=-----BEGIN PRIVATE KEY-----\nMIIEvQIBADAN...\n-----END PRIVATE KEY-----\n
```

The private key contains newlines. Put it on **one line with literal `\n`** exactly as it
appears in the JSON — the server converts them back to real newlines. In a `.env` file,
wrap it in double quotes.

### App side

Push tokens are registered by the app through `POST /auth/push-token`, which is already
wired up. To actually receive pushes on a device you also need:

1. **Firebase → Project settings → Your apps → Add app** for Android and/or iOS, using the
   bundle identifier from `mobile/app.json` (currently `edu.college.skillexchange`).
2. Download `google-services.json` (Android) / `GoogleService-Info.plist` (iOS) into
   `mobile/`, and reference them in `app.json`:

```json
"android": { "googleServicesFile": "./google-services.json", … },
"ios":     { "googleServicesFile": "./GoogleService-Info.plist", … }
```

3. Push does **not** work in Expo Go on Android — it needs a development build:

```bash
npx expo install expo-notifications
eas build --profile development --platform android
```

**Verify:** the server logs `FCM initialised` at boot instead of
`FCM credentials absent — push notifications disabled`.

---

## 3. Google sign-in

The backend verifies Google ID tokens against **your own client IDs** — that is what stops
a token minted for someone else's app being replayed against yours. So the same IDs go in
both places.

1. [Google Cloud Console](https://console.cloud.google.com) → create or select a project.
2. **APIs & Services → OAuth consent screen.** Choose *External*, fill in the app name and
   your email. While it is in *Testing*, add your own Google account under *Test users*.
3. **APIs & Services → Credentials → Create Credentials → OAuth client ID.** Create one
   per platform you intend to support:

| Type | Extra fields |
|---|---|
| **Web application** | Authorised redirect URI: `https://auth.expo.io/@your-expo-username/student-skill-exchange` |
| **Android** | Package name `edu.college.skillexchange` + your signing SHA-1 fingerprint |
| **iOS** | Bundle ID `edu.college.skillexchange` |

Get the Android SHA-1 with `eas credentials`, or for a local debug build:

```bash
keytool -list -v -keystore ~/.android/debug.keystore -alias androiddebugkey -storepass android -keypass android
```

4. **Server** — list every client ID you created, comma-separated. These are the audiences
   the API will accept:

```bash
GOOGLE_CLIENT_IDS=1234-web.apps.googleusercontent.com,1234-android.apps.googleusercontent.com,1234-ios.apps.googleusercontent.com
```

5. **App** — fill in `mobile/app.json` under `extra.google`:

```json
"extra": {
  "apiUrl": "https://your-api.onrender.com",
  "google": {
    "expo": "1234-web.apps.googleusercontent.com",
    "web": "1234-web.apps.googleusercontent.com",
    "android": "1234-android.apps.googleusercontent.com",
    "ios": "1234-ios.apps.googleusercontent.com"
  }
}
```

The **"Continue with Google" button only appears when at least one ID is set** — it stays
hidden otherwise, so an unconfigured build never shows a button that cannot work.

If the server has no `GOOGLE_CLIENT_IDS`, `POST /auth/google` returns `501
GOOGLE_AUTH_DISABLED` rather than pretending to work.

---

## 4. SMTP — verification and password-reset emails

Without this, verification links and 6-digit reset codes are **written to the server log**.
That is genuinely enough to demo both flows — you read the code out of the terminal.

### Gmail

Gmail rejects your normal account password. You need an app password:

1. Enable 2-Step Verification on the Google account.
2. Go to [myaccount.google.com/apppasswords](https://myaccount.google.com/apppasswords),
   create one for "Mail", and copy the 16-character value.

```bash
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=you@gmail.com
SMTP_PASS=abcdefghijklmnop
SMTP_SECURE=false
MAIL_FROM=Student Skill Exchange <you@gmail.com>
```

`SMTP_SECURE=false` with port 587 is correct — that port upgrades to TLS via STARTTLS.
Use `SMTP_SECURE=true` only with port 465.

### Alternatives

[Brevo](https://www.brevo.com) (300/day free) and [Mailtrap](https://mailtrap.io) are both
easier than Gmail. Mailtrap captures mail in a web inbox instead of delivering it, which is
ideal for testing — nothing can accidentally reach a real person.

**Verify:** register a new account. With SMTP configured the verification mail arrives;
without it, the log shows `SMTP not configured — email written to log instead of sent`
along with the full body.

---

## Deploying with these set

See [DEPLOYMENT.md](DEPLOYMENT.md) for the hosting walkthrough. In short:

- **API** → Render, using the committed [`render.yaml`](../render.yaml). Every secret is
  marked `sync: false`, so you enter them in the dashboard and nothing sensitive is in git.
  The two JWT secrets are generated by Render itself.
- **Admin dashboard** → Netlify or Vercel, using
  [`admin/netlify.toml`](../admin/netlify.toml) or
  [`admin/vercel.json`](../admin/vercel.json). Set `VITE_API_URL` to your API URL; it is
  baked in at build time, so changing it needs a rebuild.
- **After deploying**, set `CORS_ORIGINS` on the API to the dashboard's URL, and
  `PUBLIC_URL` to the API's own URL.

---

## Quick reference

| Variable | Needed for | Without it |
|---|---|---|
| `MONGO_URI` | Everything | Server cannot start |
| `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET` | Auth | Refuses to start in production |
| `CORS_ORIGINS` | Admin dashboard | Refuses to start in production |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD` | First admin | No admin account is created |
| `CLOUDINARY_*` | Durable uploads | Local disk; lost on redeploy |
| `FIREBASE_*` | Push notifications | In-app + realtime only |
| `GOOGLE_CLIENT_IDS` | Google sign-in | Button hidden; endpoint returns 501 |
| `SMTP_*` | Real emails | Written to the server log |

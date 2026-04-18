# Setup Guide — UMN Ticket System

## Overview

- **web-scanner/** → Node.js app deployed to GoDaddy cPanel at `events.unitymedianetwork.com`
- **electron-admin/** → Mac desktop app (DMG) run locally to manage events and generate tickets

---

## Part 1 — GoDaddy cPanel: Create the Subdomain

1. Log into GoDaddy → **My Products** → your `unitymedianetwork.com` hosting → **cPanel**
2. In cPanel, go to **Domains** → **Subdomains**
3. Create subdomain: `events` → Domain: `unitymedianetwork.com`
4. Document Root will auto-fill as `public_html/events` — leave it
5. Click **Create**

---

## Part 2 — GoDaddy cPanel: Create the MySQL Database

1. In cPanel go to **Databases** → **MySQL Databases**
2. Under **Create New Database**, enter a name e.g. `umn_tickets` → click **Create Database**
3. Under **MySQL Users** → Create a new user e.g. `umn_admin` with a strong password → **Create User**
4. Under **Add User to Database** → select your user and database → **Add** → grant **All Privileges**
5. Note down:
   - Database name (cPanel prefixes it: `youraccount_umn_tickets`)
   - Username (also prefixed: `youraccount_umn_admin`)
   - Password

### Import the Schema

1. In cPanel go to **phpMyAdmin**
2. Select your database from the left panel
3. Click the **SQL** tab
4. Paste the entire contents of `web-scanner/db/schema.sql`
5. Click **Go**

---

## Part 3 — GoDaddy cPanel: Deploy the Node.js App

### Upload the files

1. In cPanel go to **File Manager** → navigate to `public_html/events`
2. Upload the entire contents of the `web-scanner/` folder (not the folder itself — its contents)
3. Your structure should look like:
   ```
   public_html/events/
     app.js
     package.json
     .env
     db/
     routes/
     views/
     public/
   ```

### Create the .env file

1. In File Manager, create a new file called `.env` in `public_html/events/`
2. Copy the contents of `.env.example` and fill in your values:
   ```
   DB_HOST=localhost
   DB_USER=youraccount_umn_admin
   DB_PASSWORD=your_db_password
   DB_NAME=youraccount_umn_tickets
   SESSION_SECRET=some-long-random-string-change-this
   ADMIN_USERNAME=admin
   ADMIN_PASSWORD=choose-a-strong-password
   API_KEY=another-long-random-string-for-the-electron-app
   PORT=3000
   BASE_URL=https://events.unitymedianetwork.com
   ```

### Set up Node.js in cPanel

1. In cPanel go to **Software** → **Setup Node.js App**
2. Click **Create Application**
3. Fill in:
   - **Node.js version**: 18 or 20 (latest available)
   - **Application mode**: Production
   - **Application root**: `public_html/events`
   - **Application URL**: `events.unitymedianetwork.com`
   - **Application startup file**: `app.js`
4. Click **Create**
5. In the app panel, click **Run NPM Install** — wait for it to finish
6. Click **Restart**

### Verify it works

Visit `https://events.unitymedianetwork.com/events` — you should see the events list page (empty for now).

Visit `https://events.unitymedianetwork.com/auth/login` — you should see the admin login.

---

## Part 4 — Build & Install the Electron Admin App

### Prerequisites (on your Mac)

```bash
# Install Node.js if you haven't (https://nodejs.org) then:
cd ticket-system/electron-admin
npm install
```

### Run locally (for testing)

```bash
npm start
```

### Build the DMG

```bash
npm run build
```

The DMG will be output to `electron-admin/dist/`. Double-click to install like any Mac app.

For Apple Silicon Macs:
```bash
npm run build:arm
```

---

## Part 5 — First Run: Connect the Electron App

1. Open **UMN Ticket Admin**
2. Go to **Settings**
3. Enter:
   - **Server URL**: `https://events.unitymedianetwork.com`
   - **API Key**: the value you set for `API_KEY` in your `.env` file
4. Click **Save Settings** then **Test Connection** — should show ✓ Connected

---

## Part 6 — Create Your First Event

1. In the Electron app → **Organisations** → **Add Organisation**
   - Enter club name, choose colours, upload logo
2. Go to **Events** → **Add Event**
   - Select the organisation, fill in event details
3. Go to **Import CSV** → select the event → upload your CSV
   - CSV format: `name, email, mobile, company, tickets`
   - The `tickets` column is the quantity per person
4. After import, go to **Generate Tickets** → select the event → **Generate & Download PDF Tickets**
   - A ZIP file of PDFs will appear in your Downloads folder
   - Send each PDF to the corresponding attendee

---

## Part 7 — Door Scanning on Event Night

1. On any phone/tablet open: `https://events.unitymedianetwork.com/events`
2. Select the event
3. Allow camera access when prompted
4. Scan each attendee's QR code:
   - **Green ✓ + name** = valid, first scan, entry granted
   - **Red ✗ + ALREADY USED** = ticket was already scanned, deny entry

---

## CSV Format Reference

```csv
name,email,mobile,company,tickets
Brian Murphy,brian@example.com,0871234567,Murphy & Co,2
Table of 8 Ltd,contact@table8.com,0861234567,Table of 8 Ltd,8
Jane Smith,jane@example.com,0851234567,,1
```

- `tickets` = number of individual unique tickets to generate for this person
- `email`, `mobile`, `company` are optional but recommended
- The header row must be present

---

## Troubleshooting

**Node.js app not starting on GoDaddy**
- Check the error log in cPanel → Setup Node.js App → your app → Log
- Most common issue: missing `.env` file or wrong DB credentials

**`npm install` fails on cPanel**
- GoDaddy shared hosting has limited memory. Try removing `devDependencies` from package.json before uploading, or SSH in and run `npm install --production`

**Camera not working on scanner**
- The scanner requires HTTPS. Ensure your subdomain has SSL enabled (free via cPanel → SSL/TLS → Let's Encrypt)

**Electron app shows "Not configured"**
- Go to Settings, enter the server URL and API key, save

**PDF tickets not generating**
- Make sure you imported the CSV first — tickets must exist in the database before generating PDFs

const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    titleBarStyle: 'hiddenInset',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });
  mainWindow.loadFile(path.join(__dirname, 'src', 'index.html'));
}

app.whenReady().then(createWindow);
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });

// Read CSV file from disk
ipcMain.handle('open-csv', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile'],
    filters: [{ name: 'CSV Files', extensions: ['csv'] }]
  });
  if (result.canceled || !result.filePaths.length) return null;
  return fs.readFileSync(result.filePaths[0], 'utf8');
});

// Open logo file picker, returns base64 data URL
ipcMain.handle('open-image', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile'],
    filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'gif', 'svg'] }]
  });
  if (result.canceled || !result.filePaths.length) return null;
  const data = fs.readFileSync(result.filePaths[0]);
  const ext = path.extname(result.filePaths[0]).slice(1);
  return `data:image/${ext};base64,${data.toString('base64')}`;
});

// Generate PDFs and ZIP them into Downloads folder
ipcMain.handle('generate-tickets', async (event, { tickets, event: evt }) => {
  const PDFDocument = require('pdfkit');
  const QRCode = require('qrcode');
  const archiver = require('archiver');
  const baseUrl = evt.baseUrl || 'https://events.unitymedianetwork.com';

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'umn-tickets-'));
  const zipName = `${evt.slug}-tickets.zip`;
  const zipPath = path.join(os.homedir(), 'Downloads', zipName);

  const output = fs.createWriteStream(zipPath);
  const archive = archiver('zip', { zlib: { level: 9 } });
  archive.pipe(output);

  for (const ticket of tickets) {
    const qrData = `${baseUrl}/verify/${ticket.ticketNumber}`;
    const qrBuffer = await QRCode.toBuffer(qrData, { errorCorrectionLevel: 'H', width: 200, margin: 1 });

    const doc = new PDFDocument({ size: [595, 260], margin: 0 });
    const chunks = [];
    doc.on('data', c => chunks.push(c));

    await new Promise(resolve => {
      doc.on('end', resolve);

      // Background
      doc.rect(0, 0, 595, 260).fill(evt.primary_color || '#1a1a2e');

      // Accent stripe
      doc.rect(0, 0, 6, 260).fill(evt.accent_color || '#e94560');

      // Logo area (if provided)
      if (evt.logo_url && evt.logo_url.startsWith('data:image')) {
        try {
          const base64Data = evt.logo_url.split(',')[1];
          const imgBuffer = Buffer.from(base64Data, 'base64');
          doc.image(imgBuffer, 24, 24, { width: 80, height: 80, fit: [80, 80] });
        } catch (e) {}
      }

      // Event name
      doc.fillColor(evt.secondary_color || '#ffffff')
        .font('Helvetica-Bold').fontSize(20)
        .text(evt.name, 120, 28, { width: 290, lineBreak: false });

      // Date / time / venue
      const dateStr = new Date(evt.event_date).toLocaleDateString('en-GB', {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
      });
      const metaLine = [dateStr, evt.event_time, evt.venue].filter(Boolean).join('  ·  ');
      doc.font('Helvetica').fontSize(11).fillColor('rgba(255,255,255,0.7)')
        .text(metaLine, 120, 60, { width: 290 });

      // Divider
      doc.moveTo(120, 90).lineTo(420, 90).strokeColor('rgba(255,255,255,0.15)').lineWidth(1).stroke();

      // Attendee name
      doc.font('Helvetica-Bold').fontSize(16).fillColor(evt.secondary_color || '#ffffff')
        .text(ticket.name, 120, 104, { width: 290 });

      if (ticket.company) {
        doc.font('Helvetica').fontSize(12).fillColor('rgba(255,255,255,0.6)')
          .text(ticket.company, 120, 126, { width: 290 });
      }

      // Ticket number
      doc.font('Helvetica').fontSize(10).fillColor(evt.accent_color || '#e94560')
        .text(`TICKET #${ticket.ticketNumber.slice(0, 8).toUpperCase()}`, 120, 165);

      // QR code
      doc.image(qrBuffer, 460, 20, { width: 110, height: 110 });

      // Bottom label under QR
      doc.font('Helvetica').fontSize(8).fillColor('rgba(255,255,255,0.5)')
        .text('Scan to verify', 460, 135, { width: 110, align: 'center' });

      // Powered by
      doc.font('Helvetica').fontSize(8).fillColor('rgba(255,255,255,0.3)')
        .text('events.unitymedianetwork.com', 0, 238, { width: 595, align: 'center' });

      doc.end();
    });

    const pdfBuffer = Buffer.concat(chunks);
    const safeName = ticket.name.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    archive.append(pdfBuffer, { name: `ticket-${safeName}-${ticket.ticketNumber.slice(0, 8)}.pdf` });
  }

  await new Promise((resolve, reject) => {
    output.on('close', resolve);
    archive.on('error', reject);
    archive.finalize();
  });

  shell.showItemInFolder(zipPath);
  return { success: true, path: zipPath, count: tickets.length };
});

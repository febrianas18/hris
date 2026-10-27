/**
 * Modul Pengiriman Email Transaksional & Notifikasi Sistem (PRD Bab 11 & BR-11)
 *
 * Mendukung pengiriman email transaksional otomatis:
 * 1. Email ke Atasan saat ada pengajuan baru dari anggota divisinya.
 * 2. Email ke HRD saat pengajuan menunggu keputusan akhir (Tahap 2).
 * 3. Email ke pemohon saat pengajuan disetujui, ditolak, atau dibatalkan HRD.
 * 4. Email ke karyawan saat slip gaji terbit (BERISI TAUTAN SAJA TANPA NOMINAL GAJI - BR-11).
 *
 * Ketentuan PRD Bab 11:
 * - "Kegagalan pengiriman email tidak boleh membatalkan aksi utama."
 * - Pengiriman email bersifat non-blocking dengan penanganan fallback log.
 */

export interface EmailPayload {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
}

/**
 * Mendapatkan URL basis aplikasi untuk tautan dalam email
 */
export function getAppBaseUrl(): string {
  if (process.env.NEXT_PUBLIC_APP_URL) {
    return process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, '');
  }
  if (process.env.APP_URL) {
    return process.env.APP_URL.replace(/\/$/, '');
  }
  return 'http://localhost:3000';
}

/**
 * Pengirim email serbaguna dengan dukungan Resend API & Fallback Dev Logger
 */
export async function sendTransactionalEmail(payload: EmailPayload): Promise<{ success: boolean; mocked?: boolean; error?: string }> {
  const recipients = Array.isArray(payload.to) ? payload.to : [payload.to];
  const validRecipients = recipients.filter((email) => Boolean(email && email.includes('@')));

  if (validRecipients.length === 0) {
    console.warn('[EMAIL WARNING] Tidak ada alamat email penerima yang valid:', payload.to);
    return { success: false, error: 'Penerima email tidak valid' };
  }

  const apiKey = process.env.RESEND_API_KEY;
  const fromEmail = process.env.EMAIL_FROM || 'KarsaHR <notifications@karsalintas.test>';

  // 1. Jika RESEND_API_KEY tersedia, kirim via HTTP API Resend
  if (apiKey) {
    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: fromEmail,
          to: validRecipients,
          subject: payload.subject,
          html: payload.html,
          text: payload.text,
        }),
      });

      if (res.ok) {
        console.log(`[EMAIL SENT] Berhasil dikirim ke ${validRecipients.join(', ')} | Subjek: "${payload.subject}"`);
        return { success: true };
      } else {
        const errText = await res.text();
        console.warn(`[EMAIL RESEND ERROR] Gagal mengirim (${res.status}): ${errText}`);
      }
    } catch (err: unknown) {
      console.warn('[EMAIL NETWORK ERROR] Gagal menghubungi layanan email:', err instanceof Error ? err.message : err);
    }
  }

  // 2. Fallback / Dev Logger (PRD Bab 11: kegagalan email tidak membatalkan aksi)
  console.log(`[TRANSACTIONAL EMAIL LOG]
--------------------------------------------------------------------------------
Kepada   : ${validRecipients.join(', ')}
Dari     : ${fromEmail}
Subjek   : ${payload.subject}
Waktu    : ${new Date().toISOString()}
--------------------------------------------------------------------------------
${payload.text || '(Konten HTML terlampir)'}
--------------------------------------------------------------------------------`);

  return { success: true, mocked: true };
}

/**
 * Format nama jenis pengajuan agar mudah dibaca manusia
 */
function formatJenisPengajuan(jenis: string): string {
  switch (jenis) {
    case 'cuti_tahunan':
      return 'Cuti Tahunan';
    case 'sakit':
      return 'Izin Sakit';
    case 'izin':
      return 'Izin Keperluan Pribadi';
    default:
      return jenis.replace(/_/g, ' ');
  }
}

/**
 * Layout HTML wrapper berstandar profesional untuk KarsaHR
 */
function buildHtmlTemplate({
  title,
  badgeText,
  badgeColor,
  bodyHtml,
  actionText,
  actionUrl,
}: {
  title: string;
  badgeText: string;
  badgeColor: string;
  bodyHtml: string;
  actionText?: string;
  actionUrl?: string;
}): string {
  return `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #0f172a; line-height: 1.5;">
  <div style="max-width: 580px; margin: 32px auto; background-color: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
    <!-- Header -->
    <div style="background-color: #0f7a5f; padding: 24px 32px; border-bottom: 2px solid #0b5c48;">
      <div style="color: #ffffff; font-size: 20px; font-weight: 800; letter-spacing: -0.02em;">
        Karsa<span style="color: #8df1d8;">HR</span>
      </div>
      <div style="color: rgba(255, 255, 255, 0.85); font-size: 11px; text-transform: uppercase; letter-spacing: 0.1em; font-weight: 600; margin-top: 2px;">
        PT Karsa Lintas Nusantara
      </div>
    </div>

    <!-- Main Content -->
    <div style="padding: 32px;">
      <div style="display: inline-block; padding: 4px 10px; border-radius: 9999px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; background-color: ${badgeColor}; color: #ffffff; margin-bottom: 16px;">
        ${badgeText}
      </div>

      <h1 style="font-size: 20px; font-weight: 700; color: #0f172a; margin: 0 0 16px 0; line-height: 1.3;">
        ${title}
      </h1>

      <div style="font-size: 14px; color: #334155; line-height: 1.6;">
        ${bodyHtml}
      </div>

      ${
        actionText && actionUrl
          ? `
      <div style="margin-top: 28px; padding-top: 20px; border-top: 1px solid #f1f5f9;">
        <a href="${actionUrl}" style="display: inline-block; background-color: #0f7a5f; color: #ffffff; text-decoration: none; font-size: 13px; font-weight: 700; padding: 12px 24px; border-radius: 8px; box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05);">
          ${actionText} &rarr;
        </a>
      </div>
      `
          : ''
      }
    </div>

    <!-- Footer -->
    <div style="background-color: #f8fafc; padding: 16px 32px; border-top: 1px solid #e2e8f0; font-size: 11px; color: #64748b; line-height: 1.5;">
      <p style="margin: 0;">Email ini dikirim secara otomatis oleh Sistem Informasi HRIS PT Karsa Lintas Nusantara.</p>
      <p style="margin: 4px 0 0 0;">Mohon untuk tidak membalas email ini secara langsung.</p>
    </div>
  </div>
</body>
</html>`;
}

// =============================================================================
// 1. NOTIFIKASI KE ATASAN SAAT ADA PENGAJUAN BARU (PRD Bab 11)
// =============================================================================
export async function notifyAtasanNewLeaveRequest({
  atasanEmail,
  atasanNama,
  pemohonNama,
  jenis,
  tanggalMulai,
  tanggalSelesai,
  jumlahHari,
  alasan,
}: {
  atasanEmail: string;
  atasanNama: string;
  pemohonNama: string;
  jenis: string;
  tanggalMulai: string;
  tanggalSelesai: string;
  jumlahHari: number;
  alasan: string;
}) {
  const appUrl = getAppBaseUrl();
  const jenisText = formatJenisPengajuan(jenis);
  const subject = `[KarsaHR] Pengajuan ${jenisText} Baru dari ${pemohonNama}`;

  const bodyHtml = `
    <p>Yth. <strong>${atasanNama}</strong>,</p>
    <p>Anggota divisi Anda, <strong>${pemohonNama}</strong>, baru saja mengajukan permohonan <strong>${jenisText}</strong> yang memerlukan persetujuan Tahap 1 dari Anda.</p>
    
    <div style="background-color: #f1f5f9; border-radius: 8px; padding: 16px; margin: 16px 0; border-left: 4px solid #0f7a5f;">
      <p style="margin: 0 0 8px 0;"><strong>Jenis:</strong> ${jenisText}</p>
      <p style="margin: 0 0 8px 0;"><strong>Rentang Tanggal:</strong> ${tanggalMulai} s/d ${tanggalSelesai}</p>
      <p style="margin: 0 0 8px 0;"><strong>Durasi:</strong> ${jumlahHari} hari kerja</p>
      <p style="margin: 0;"><strong>Alasan:</strong> "${alasan}"</p>
    </div>

    <p>Silakan masuk ke aplikasi KarsaHR untuk memeriksa detail dan memberikan persetujuan Tahap 1.</p>
  `;

  const text = `Yth. ${atasanNama},\n\nAnggota divisi Anda, ${pemohonNama}, baru saja mengajukan ${jenisText} (${jumlahHari} hari kerja: ${tanggalMulai} s/d ${tanggalSelesai}).\nAlasan: "${alasan}"\n\nBuka halaman persetujuan: ${appUrl}/persetujuan`;

  const html = buildHtmlTemplate({
    title: `Pengajuan ${jenisText} Baru`,
    badgeText: 'Persetujuan Tahap 1',
    badgeColor: '#0f7a5f',
    bodyHtml,
    actionText: 'Tinjau Pengajuan',
    actionUrl: `${appUrl}/persetujuan`,
  });

  return sendTransactionalEmail({ to: atasanEmail, subject, html, text });
}

// =============================================================================
// 2. NOTIFIKASI KE HRD SAAT MENUNGGU KEPUTUSAN AKHIR (PRD Bab 11)
// =============================================================================
export async function notifyHrdFinalLeaveDecision({
  hrdEmails,
  pemohonNama,
  jenis,
  tanggalMulai,
  tanggalSelesai,
  jumlahHari,
  alasan,
  disetujuiAtasanOleh,
}: {
  hrdEmails: string[];
  pemohonNama: string;
  jenis: string;
  tanggalMulai: string;
  tanggalSelesai: string;
  jumlahHari: number;
  alasan: string;
  disetujuiAtasanOleh?: string;
}) {
  if (!hrdEmails || hrdEmails.length === 0) return;

  const appUrl = getAppBaseUrl();
  const jenisText = formatJenisPengajuan(jenis);
  const subject = `[KarsaHR] Pengajuan ${jenisText} Menunggu Keputusan Akhir HRD - ${pemohonNama}`;

  const approvalNote = disetujuiAtasanOleh
    ? `<p style="margin: 0 0 8px 0; color: #0f7a5f;"><strong>Status Tahap 1:</strong> Disetujui oleh Atasan (${disetujuiAtasanOleh})</p>`
    : `<p style="margin: 0 0 8px 0; color: #2563eb;"><strong>Tahap:</strong> Langsung ke HRD (Tanpa Atasan / Diajukan oleh Atasan/HRD)</p>`;

  const bodyHtml = `
    <p>Halo Tim <strong>Human Resources</strong>,</p>
    <p>Pengajuan <strong>${jenisText}</strong> dari <strong>${pemohonNama}</strong> saat ini sedang menunggu keputusan akhir (Tahap 2) dari HRD.</p>
    
    <div style="background-color: #f1f5f9; border-radius: 8px; padding: 16px; margin: 16px 0; border-left: 4px solid #2563eb;">
      ${approvalNote}
      <p style="margin: 0 0 8px 0;"><strong>Pemohon:</strong> ${pemohonNama}</p>
      <p style="margin: 0 0 8px 0;"><strong>Jenis:</strong> ${jenisText}</p>
      <p style="margin: 0 0 8px 0;"><strong>Rentang:</strong> ${tanggalMulai} s/d ${tanggalSelesai} (${jumlahHari} hari kerja)</p>
      <p style="margin: 0;"><strong>Alasan:</strong> "${alasan}"</p>
    </div>

    <p>Silakan buka portal HRD untuk memberikan keputusan akhir (Setujui atau Tolak).</p>
  `;

  const text = `Tim HRD,\n\nPengajuan ${jenisText} dari ${pemohonNama} (${jumlahHari} hari kerja: ${tanggalMulai} s/d ${tanggalSelesai}) menunggu keputusan akhir HRD.\nAlasan: "${alasan}"\n\nBuka halaman persetujuan: ${appUrl}/persetujuan`;

  const html = buildHtmlTemplate({
    title: `Keputusan Akhir Pengajuan: ${pemohonNama}`,
    badgeText: 'Keputusan Akhir HRD',
    badgeColor: '#2563eb',
    bodyHtml,
    actionText: 'Proses Keputusan HRD',
    actionUrl: `${appUrl}/persetujuan`,
  });

  return sendTransactionalEmail({ to: hrdEmails, subject, html, text });
}

// =============================================================================
// 3. NOTIFIKASI KE PEMOHON SAAT DISETUJUI, DITOLAK, ATAU DIBATALKAN (PRD Bab 11)
// =============================================================================
export async function notifyPemohonLeaveStatus({
  pemohonEmail,
  pemohonNama,
  jenis,
  status,
  tanggalMulai,
  tanggalSelesai,
  jumlahHari,
  alasanPenolakan,
  diprosesOlehNama,
}: {
  pemohonEmail: string;
  pemohonNama: string;
  jenis: string;
  status: 'disetujui' | 'ditolak' | 'dibatalkan';
  tanggalMulai: string;
  tanggalSelesai: string;
  jumlahHari: number;
  alasanPenolakan?: string;
  diprosesOlehNama: string;
}) {
  const appUrl = getAppBaseUrl();
  const jenisText = formatJenisPengajuan(jenis);

  let title = '';
  let badgeText = '';
  let badgeColor = '';
  let statusDescription = '';

  if (status === 'disetujui') {
    title = `Pengajuan ${jenisText} Anda Disetujui`;
    badgeText = 'Disetujui';
    badgeColor = '#0f7a5f';
    statusDescription = `Pengajuan ${jenisText} Anda untuk periode <strong>${tanggalMulai} s/d ${tanggalSelesai}</strong> (${jumlahHari} hari kerja) telah resmi <strong>disetujui</strong> oleh HRD (${diprosesOlehNama}). Jadwal kehadiran Anda telah disesuaikan secara otomatis.`;
  } else if (status === 'ditolak') {
    title = `Pengajuan ${jenisText} Anda Ditolak`;
    badgeText = 'Ditolak';
    badgeColor = '#e11d48';
    statusDescription = `Pengajuan ${jenisText} Anda untuk periode <strong>${tanggalMulai} s/d ${tanggalSelesai}</strong> (${jumlahHari} hari kerja) <strong>ditolak</strong> oleh ${diprosesOlehNama}. Kuota cuti tahunan Anda (jika berlaku) telah dikembalikan secara otomatis.`;
  } else {
    title = `Pengajuan ${jenisText} Anda Dibatalkan`;
    badgeText = 'Dibatalkan';
    badgeColor = '#f59e0b';
    statusDescription = `Pengajuan ${jenisText} Anda untuk periode <strong>${tanggalMulai} s/d ${tanggalSelesai}</strong> (${jumlahHari} hari kerja) telah <strong>dibatalkan</strong> oleh HRD (${diprosesOlehNama}). Kuota cuti tahunan Anda (jika berlaku) telah dikembalikan ke saldo aktif.`;
  }

  const subject = `[KarsaHR] ${title}`;

  const reasonBlock =
    alasanPenolakan && status === 'ditolak'
      ? `
    <div style="background-color: #fff1f2; border-radius: 8px; padding: 14px; margin: 16px 0; border-left: 4px solid #e11d48; color: #881337;">
      <p style="margin: 0; font-size: 13px;"><strong>Alasan Penolakan:</strong> "${alasanPenolakan}"</p>
    </div>`
      : '';

  const bodyHtml = `
    <p>Halo <strong>${pemohonNama}</strong>,</p>
    <p>${statusDescription}</p>
    ${reasonBlock}
    <p>Anda dapat melihat riwayat pengajuan dan rincian kuota cuti terkini di menu <strong>Cuti & Izin</strong> pada aplikasi KarsaHR.</p>
  `;

  const text = `Halo ${pemohonNama},\n\n${title} (${jumlahHari} hari kerja: ${tanggalMulai} s/d ${tanggalSelesai}) oleh ${diprosesOlehNama}.${
    alasanPenolakan ? `\nAlasan: "${alasanPenolakan}"` : ''
  }\n\nLihat status pengajuan Anda: ${appUrl}/cuti-izin`;

  const html = buildHtmlTemplate({
    title,
    badgeText,
    badgeColor,
    bodyHtml,
    actionText: 'Lihat Cuti & Izin',
    actionUrl: `${appUrl}/cuti-izin`,
  });

  return sendTransactionalEmail({ to: pemohonEmail, subject, html, text });
}

// =============================================================================
// 4. NOTIFIKASI SLIP GAJI TERBIT (PRD Bab 11 & ATURAN BR-11: TANPA NOMINAL GAJI)
// =============================================================================
export async function notifyEmployeePayslipPublished({
  employeeEmail,
  employeeNama,
  periode,
  nomorSlip,
}: {
  employeeEmail: string;
  employeeNama: string;
  periode: string;
  nomorSlip: string;
}) {
  const appUrl = getAppBaseUrl();
  const subject = `[KarsaHR] Slip Gaji Periode ${periode} Telah Diterbitkan`;

  // KRITIS: Aturan BR-11 & PRD Bab 11 secara tegas melarang mencantumkan nominal gaji dalam email atau notifikasi apa pun.
  // Email ini HANYA berisi pengumuman nomor slip, periode, dan tautan ke aplikasi KarsaHR.
  const bodyHtml = `
    <p>Halo <strong>${employeeNama}</strong>,</p>
    <p>Slip gaji resmi Anda untuk <strong>Periode ${periode}</strong> telah diterbitkan oleh Human Resources dengan nomor slip <strong>${nomorSlip}</strong> dan status terkunci permanen.</p>
    
    <div style="background-color: #f1f5f9; border-radius: 8px; padding: 16px; margin: 16px 0; border-left: 4px solid #0f7a5f;">
      <p style="margin: 0 0 8px 0;"><strong>Nama Karyawan:</strong> ${employeeNama}</p>
      <p style="margin: 0 0 8px 0;"><strong>Periode Gaji:</strong> ${periode}</p>
      <p style="margin: 0;"><strong>Nomor Resmi Slip:</strong> <code style="font-family: monospace; font-weight: bold; color: #0f7a5f;">${nomorSlip}</code></p>
    </div>

    <p style="font-size: 13px; color: #64748b; line-height: 1.5;">
      <em>Demi menjaga kerahasiaan data sesuai kebijakan keamanan perusahaan, rincian nominal gaji tidak dicantumkan dalam email ini. Silakan masuk ke aplikasi KarsaHR untuk melihat atau mencetak slip gaji Anda.</em>
    </p>
  `;

  const text = `Halo ${employeeNama},\n\nSlip gaji Anda untuk Periode ${periode} (Nomor: ${nomorSlip}) telah resmi diterbitkan.\n\nSesuai kebijakan kerahasiaan perusahaan (BR-11), nominal gaji tidak dicantumkan dalam email ini.\nSilakan lihat atau unduh slip gaji Anda di: ${appUrl}/slip-gaji`;

  const html = buildHtmlTemplate({
    title: `Slip Gaji Periode ${periode} Telah Terbit`,
    badgeText: 'Slip Gaji Resmi',
    badgeColor: '#0f7a5f',
    bodyHtml,
    actionText: 'Buka Slip Gaji Saya',
    actionUrl: `${appUrl}/slip-gaji`,
  });

  return sendTransactionalEmail({ to: employeeEmail, subject, html, text });
}

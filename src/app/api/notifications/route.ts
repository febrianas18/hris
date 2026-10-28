import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { getAuthUser } from '@/utils/auth';
import { getNotificationsForUser, AppNotification } from '@/utils/notifications';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient();
    const user = await getAuthUser(req, supabase);

    if (!user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('id, nama_lengkap, email, peran, divisi_id')
      .eq('id', user.id)
      .maybeSingle();

    if (!profile) {
      return NextResponse.json({ success: false, error: 'Profil tidak ditemukan' }, { status: 404 });
    }

    // 1. Ambil notifikasi dari in-memory / session store
    const inMemoryNotifs = getNotificationsForUser({
      id: profile.id,
      email: profile.email,
      peran: profile.peran as 'karyawan' | 'atasan' | 'hrd',
      divisi_id: profile.divisi_id,
    });

    // 2. Ambil notifikasi historis berbasis data nyata di database Supabase
    const dbNotifs: AppNotification[] = [];

    if (profile.peran === 'atasan' && profile.divisi_id) {
      // Pengajuan cuti dari anggota divisi yang diajukan
      const { data: teamLeaves } = await supabase
        .from('pengajuan_cuti')
        .select(`
          id, jenis, tanggal_mulai, tanggal_selesai, jumlah_hari, alasan, status, dibuat_pada,
          pemohon:karyawan_id (id, nama_lengkap, email, divisi_id)
        `)
        .eq('perlu_atasan', true)
        .neq('karyawan_id', profile.id)
        .order('dibuat_pada', { ascending: false })
        .limit(10);

      (teamLeaves || []).forEach((item: any) => {
        const rawPemohon = Array.isArray(item.pemohon) ? item.pemohon[0] : item.pemohon;
        if (rawPemohon?.divisi_id === profile.divisi_id) {
          const jenisLabel = item.jenis.replace(/_/g, ' ');
          dbNotifs.push({
            id: `db-leave-${item.id}`,
            recipientId: profile.id,
            targetRole: 'atasan',
            title: `Pengajuan ${jenisLabel} Baru`,
            message: `${rawPemohon.nama_lengkap} mengajukan ${jenisLabel} (${item.jumlah_hari} hari: ${item.tanggal_mulai} s/d ${item.tanggal_selesai}).`,
            type: 'leave_request',
            link: '/persetujuan',
            createdAt: item.dibuat_pada,
            isRead: item.status !== 'diajukan',
            emailSubject: `[KarsaHR] Pengajuan ${jenisLabel} Baru dari ${rawPemohon.nama_lengkap}`,
            channel: 'both',
          });
        }
      });
    } else if (profile.peran === 'hrd') {
      // Pengajuan cuti menunggu keputusan akhir HRD
      const { data: hrdLeaves } = await supabase
        .from('pengajuan_cuti')
        .select(`
          id, jenis, tanggal_mulai, tanggal_selesai, jumlah_hari, status, dibuat_pada,
          pemohon:karyawan_id (id, nama_lengkap, email)
        `)
        .or('status.eq.disetujui_atasan,and(status.eq.diajukan,perlu_atasan.eq.false)')
        .order('dibuat_pada', { ascending: false })
        .limit(10);

      (hrdLeaves || []).forEach((item: any) => {
        const rawPemohon = Array.isArray(item.pemohon) ? item.pemohon[0] : item.pemohon;
        const jenisLabel = item.jenis.replace(/_/g, ' ');
        dbNotifs.push({
          id: `db-hrd-leave-${item.id}`,
          targetRole: 'hrd',
          title: `Menunggu Keputusan Akhir HRD`,
          message: `Pengajuan ${jenisLabel} ${rawPemohon?.nama_lengkap || 'Karyawan'} (${item.jumlah_hari} hari) siap diproses tahap akhir.`,
          type: 'leave_request',
          link: '/persetujuan',
          createdAt: item.dibuat_pada,
          isRead: false,
          emailSubject: `[KarsaHR] Pengajuan ${jenisLabel} Menunggu Keputusan Akhir HRD - ${rawPemohon?.nama_lengkap || 'Karyawan'}`,
          channel: 'both',
        });
      });
    } else {
      // Karyawan: Status cuti pribadi yang telah diputuskan
      const { data: myLeaves } = await supabase
        .from('pengajuan_cuti')
        .select('id, jenis, status, tanggal_mulai, tanggal_selesai, jumlah_hari, dibuat_pada')
        .eq('karyawan_id', profile.id)
        .in('status', ['disetujui', 'ditolak', 'dibatalkan'])
        .order('dibuat_pada', { ascending: false })
        .limit(5);

      (myLeaves || []).forEach((item) => {
        const jenisLabel = item.jenis.replace(/_/g, ' ');
        dbNotifs.push({
          id: `db-my-leave-${item.id}`,
          recipientId: profile.id,
          targetRole: 'karyawan',
          title: `Pengajuan ${jenisLabel} ${item.status === 'disetujui' ? 'Disetujui' : item.status === 'ditolak' ? 'Ditolak' : 'Dibatalkan'}`,
          message: `Pengajuan ${jenisLabel} Anda untuk ${item.tanggal_mulai} s/d ${item.tanggal_selesai} statusnya: ${item.status}.`,
          type: item.status === 'disetujui' ? 'leave_approved' : item.status === 'ditolak' ? 'leave_rejected' : 'leave_cancelled',
          link: '/cuti-izin',
          createdAt: item.dibuat_pada,
          isRead: true,
          emailSubject: `[KarsaHR] Pengajuan ${jenisLabel} Anda Telah ${item.status}`,
          channel: 'both',
        });
      });

      // Slip gaji terbit
      const { data: myPayslips } = await supabase
        .from('slip_gaji')
        .select('id, nomor_slip, periode, dibuat_pada, diterbitkan_pada')
        .eq('karyawan_id', profile.id)
        .eq('status', 'terbit')
        .order('periode', { ascending: false })
        .limit(3);

      (myPayslips || []).forEach((slip) => {
        dbNotifs.push({
          id: `db-slip-${slip.id}`,
          recipientId: profile.id,
          targetRole: 'karyawan',
          title: `Slip Gaji Periode ${slip.periode} Diterbitkan`,
          message: `Slip gaji resmi nomor ${slip.nomor_slip || '-'} telah diterbitkan. Rincian gaji dirahasiakan dalam notifikasi sesuai BR-11.`,
          type: 'payslip',
          link: '/slip-gaji',
          createdAt: slip.diterbitkan_pada || slip.dibuat_pada,
          isRead: true,
          emailSubject: `[KarsaHR] Slip Gaji Periode ${slip.periode} Telah Diterbitkan`,
          channel: 'both',
        });
      });
    }

    // Gabungkan notifikasi memory (paling baru) dengan notifikasi database, urutkan berdasarkan waktu
    const combined = [...inMemoryNotifs, ...dbNotifs];
    const uniqueMap = new Map<string, AppNotification>();
    combined.forEach((n) => {
      if (!uniqueMap.has(n.id)) {
        uniqueMap.set(n.id, n);
      }
    });

    const notifications = Array.from(uniqueMap.values()).sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    const unreadCount = notifications.filter((n) => !n.isRead).length;

    return NextResponse.json({
      success: true,
      unreadCount,
      notifications,
      isResendConfigured: Boolean(process.env.RESEND_API_KEY),
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Gagal memuat notifikasi';
    return NextResponse.json({ success: false, error: errorMsg }, { status: 500 });
  }
}


export interface HrdQueueItem {
  id: string;
  jenis: string;
  tanggal_mulai: string;
  tanggal_selesai: string;
  jumlah_hari: number;
  status: string;
  dibuat_pada: string;
  alasan: string;
  karyawan_nama: string;
  karyawan_nik: string;
  divisi_nama: string;
}

export interface HrdDivisionStat {
  id: string;
  nama: string;
  total: number;
  hadir: number;
  terlambat: number;
  cuti: number;
  alpa: number;
}

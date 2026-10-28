/**
 * In-App & Transactional Notification Store (PRD Bab 11 & BR-11)
 * Mengelola notifikasi sistem di dalam aplikasi (In-App Notification Bell)
 * serta mengaitkannya dengan template email transaksional.
 */

export interface AppNotification {
  id: string;
  recipientId?: string;
  recipientEmail?: string;
  targetRole?: 'karyawan' | 'atasan' | 'hrd' | 'all';
  targetDivisiId?: string;
  title: string;
  message: string;
  type: 'leave_request' | 'leave_approved' | 'leave_rejected' | 'leave_cancelled' | 'payslip';
  link: string;
  createdAt: string;
  isRead: boolean;
  emailSubject?: string;
  emailHtml?: string;
  channel: 'email' | 'in_app' | 'both';
}

// Global in-memory storage for runtime notifications across requests
const globalNotifications: AppNotification[] = [];

/**
 * Menyimpan notifikasi baru ke sistem
 */
export function addAppNotification(notification: Omit<AppNotification, 'id' | 'createdAt' | 'isRead'>): AppNotification {
  const newNotif: AppNotification = {
    ...notification,
    id: `notif-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
    createdAt: new Date().toISOString(),
    isRead: false,
  };

  globalNotifications.unshift(newNotif);

  // Batasi maksimal 100 notifikasi di memori agar hemat resource
  if (globalNotifications.length > 100) {
    globalNotifications.pop();
  }

  return newNotif;
}

/**
 * Mengambil seluruh notifikasi yang relevan untuk profil pengguna saat ini
 */
export function getNotificationsForUser(userProfile: {
  id: string;
  email: string;
  peran: 'karyawan' | 'atasan' | 'hrd';
  divisi_id?: string | null;
}): AppNotification[] {
  return globalNotifications.filter((n) => {
    // 1. Notifikasi spesifik untuk karyawan tertentu
    if (n.recipientId && n.recipientId === userProfile.id) return true;
    if (n.recipientEmail && n.recipientEmail.toLowerCase() === userProfile.email.toLowerCase()) return true;

    // 2. Notifikasi untuk role tertentu
    if (n.targetRole === 'all') return true;
    if (n.targetRole === userProfile.peran) {
      // Jika atasan, pastikan divisi cocok jika targetDivisiId diset
      if (userProfile.peran === 'atasan' && n.targetDivisiId) {
        return n.targetDivisiId === userProfile.divisi_id;
      }
      return true;
    }

    return false;
  });
}

/**
 * Menandai notifikasi sebagai sudah dibaca
 */
export function markNotificationAsRead(notificationId: string): boolean {
  const notif = globalNotifications.find((n) => n.id === notificationId);
  if (notif) {
    notif.isRead = true;
    return true;
  }
  return false;
}

/**
 * Menandai semua notifikasi untuk pengguna sebagai sudah dibaca
 */
export function markAllNotificationsAsReadForUser(userProfile: {
  id: string;
  email: string;
  peran: 'karyawan' | 'atasan' | 'hrd';
}): void {
  const userNotifs = getNotificationsForUser(userProfile);
  userNotifs.forEach((n) => {
    n.isRead = true;
  });
}


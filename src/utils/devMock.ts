import { createHmac } from 'crypto';

export interface MockTimePayload {
  p_mock_time_str: string | null;
  p_mock_sig: string | null;
}

/**
 * Menandatangani waktu simulasi (header x-mock-server-time) agar RPC database
 * hanya menerima mock time yang benar-benar dikirim oleh server aplikasi.
 *
 * Hanya dipakai saat NODE_ENV !== 'production'. Di production header mock
 * diabaikan dan RPC memakai now() dari database.
 */
export function buildMockTimePayload(
  mockTime: string | null | undefined
): MockTimePayload {
  if (!mockTime) {
    return { p_mock_time_str: null, p_mock_sig: null };
  }

  const secret = process.env.MOCK_TIME_SECRET;
  if (!secret) {
    throw new Error(
      'MOCK_TIME_SECRET belum diset. Simulasi waktu tidak dapat digunakan.'
    );
  }

  const signature = createHmac('sha256', secret).update(mockTime).digest('hex');
  return { p_mock_time_str: mockTime, p_mock_sig: signature };
}

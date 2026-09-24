import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
void i18n.use(initReactI18next).init({ lng: 'en', fallbackLng: 'en', interpolation: { escapeValue: false }, resources: {
  en: { translation: { board: 'Overview', approvals: 'Approvals', metrics: 'Insights', admin: 'Settings', title: 'A little clarity. A lot of progress.', subtitle: 'Your supply chain, moving forward.', search: 'Search cases, materials or purchase orders', cases: 'Your attention makes the difference.', all: 'All cases', demo: 'Demo workspace', view: 'Review priority case', ask: 'Ask AERA', signal: 'Signal', triage: 'Triage', impact: 'Impact', options: 'Options', approve: 'Approve', execute: 'Execute' } },
  id: { translation: { board: 'Ringkasan', approvals: 'Persetujuan', metrics: 'Wawasan', admin: 'Pengaturan', title: 'Lebih jelas. Lebih banyak kemajuan.', subtitle: 'Rantai pasok Anda, terus bergerak.', search: 'Cari kasus, material, atau pesanan', cases: 'Perhatian Anda membuat perbedaan.', all: 'Semua kasus', demo: 'Ruang kerja demo', view: 'Tinjau kasus prioritas', ask: 'Tanya AERA', signal: 'Sinyal', triage: 'Triase', impact: 'Dampak', options: 'Opsi', approve: 'Setujui', execute: 'Eksekusi' } },
} });
export default i18n;

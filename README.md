# Dapur Macet!

Game edukasi interaktif berbasis web untuk memvisualisasikan permasalahan **Deadlock** pada Sistem Operasi melalui simulasi manajemen dapur. Dibangun menggunakan **HTML5, CSS3, Vanilla JavaScript, dan Three.js r128** yang berjalan sepenuhnya secara luring (offline) tanpa dependensi CDN.

---

## Daftar Isi
- [Tentang Proyek](#tentang-proyek)
- [Fitur Utama](#fitur-utama)
- [Pemetaan Konsep Sistem Operasi](#pemetaan-konsep-sistem-operasi)
- [Cara Menjalankan](#cara-menjalankan)
- [Panduan dan Alur Permainan](#panduan-dan-alur-permainan)
- [Pengujian Otomatis](#pengujian-otomatis)
- [Struktur Proyek](#struktur-proyek)
- [Tim Pengembang](#tim-pengembang)
- [Lisensi](#lisensi)

---

## Tentang Proyek
**Dapur Macet!** menempatkan pemain sebagai kepala koki yang mengatur para koki (proses) dalam memperebutkan peralatan dapur terbatas (sumber daya). Pemain akan menghadapi skenario pesanan melalui tiga mekanisme penanganan deadlock secara berurutan, mengamati perilaku sistem langkah demi langkah (tick-by-tick), dan membandingkan metrik efisiensinya di akhir permainan.

---

## Fitur Utama
- **3 Tingkat Kesulitan (Masing-masing 3 Match):**
  - **Easy:** 2 koki (pemilihan maksimal 2 karakter), 2 alat, timer kesabaran, dan 4 ronde izin peminjaman.
  - **Medium:** 3 koki, 3 alat, rotasi alat, dan pemulihan dengan penghentian proses (process termination).
  - **Hard:** 4 koki tetap, 3 alat (single-instance), gelombang 12 pelanggan, matriks Banker's Algorithm, dan reschedule/cancel saat unsafe state.
- **Visualisasi Real-Time:** Lencana status alat (Tersedia, Dipakai, Diminta), Wait-For Graph, serta panel matriks `Max`, `Allocation`, `Need`, dan `Available`.
- **Kontrol Simulasi dan Audio:** Mendukung jeda (pause), percepatan/lewati animasi, pengaturan volume SFX/Musik, serta penyimpanan skor otomatis di `localStorage`.
- **Layar Komparasi Akhir:** Log keputusan, rincian skor, status layanan, dan perbandingan efektivitas strategi.

---

## Pemetaan Konsep Sistem Operasi

| Konsep Sistem Operasi | Representasi di dalam Game |
| :--- | :--- |
| **Proses** | Koki yang mengerjakan pesanan |
| **Resource dan Instance** | Peralatan dapur (Katel, Panci, Kompor) beserta jumlah unitnya |
| **Max / Allocation / Need** | Kebutuhan total resep / Alat yang sedang dipegang / Sisa alat yang dibutuhkan |
| **Available dan Request** | Alat yang menganggur (idle) dan permintaan izin memakai alat |
| **Deadlock dan Safe State** | Dapur macet (saling tunggu) dan urutan eksekusi aman untuk semua pesanan |
| **Preempt / Terminate** | Penjadwalan ulang (reschedule) atau pembatalan pesanan koki |

---

## Cara Menjalankan

### Prasyarat
- **Node.js v22+** (atau Python 3 / ekstensi VS Code Live Server).
- Tidak memerlukan instalasi paket eksternal (`npm install` tidak diperlukan).

### Langkah Instalasi dan Jalankan
1. Masuk ke direktori proyek:
   ```bash
   cd dapur-macet-main

## Tim Pengembang
- Mata Kuliah: Sistem Operasi 
- Kelas: A
- Dosen Pengampu: Bapak Muhammad Sidik Asyaqi, S.T.,M.T.

Catatan Kontribusi: Seluruh anggota kelompok berkontribusi secara merata pada tahap perancangan desain, pengembangan kode (HTML/CSS/JS/Three.js), serta penyusunan laporan akhir proyek.

| Nama Lengkap | NPM | Peran & Fokus Pengerjaan |
| :--- | :--- | :--- |
| Wildan Nurohim | 257006111026 | Ketua Kelompok — Landing Page, Mode Hard, Desain, Coding & Laporan |
| Syayid Nur Fadillah | 257006111062 | Landing Page, Mode Hard, Desain, Coding & Laporan |
| Dita Dwi Meilani | 257006111038 | Halaman Tutorial, Mode Easy, Desain, Coding & Laporan |
| Ghefira Aulia Azzahra | 257006111041 | Halaman Tutorial, Mode Easy, Desain, Coding & Laporan |
| Rafli Adriana Saputra | 257006111004 | Halaman Pengaturan (Settings), Mode Medium, Desain, Coding & Laporan |
| Nanda Sintia Putri | 257006111045 | Halaman Pengaturan (Settings), Mode Medium, Desain, Coding & Laporan |

---

## Lisensi & Atribusi Aset
https://www.figma.com/design/7xZJV4i4xA4OLRDQuCnuSc/Dapur-Macet-?node-id=2-3&t=z2rnOEAxVwLpenXQ-1
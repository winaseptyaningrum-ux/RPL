const API_URL = 'http://localhost:3000/api';

let isRegisterMode = false;
let currentProfile = null;

// Elemen Halaman
const pageLogin = document.getElementById('page-login');
const pageProfil = document.getElementById('page-profil');
const pageBeranda = document.getElementById('page-beranda');
const alertBox = document.getElementById('alert-box');

// Helper tampilkan pesan error
function showAlert(msg) {
  alertBox.textContent = msg;
  alertBox.classList.remove('hidden');
  setTimeout(() => alertBox.classList.add('hidden'), 4000);
}

// Helper navigasi antar layar utama
function showScreen(screenName) {
  pageLogin.classList.add('hidden');
  pageProfil.classList.add('hidden');
  pageBeranda.classList.add('hidden');

  if (screenName === 'login') pageLogin.classList.remove('hidden');
  if (screenName === 'profil') pageProfil.classList.remove('hidden');
  if (screenName === 'beranda') pageBeranda.classList.remove('hidden');
}

// Toggle Mode Login <-> Daftar pada halaman 01
const authTitle = document.getElementById('auth-title');
const authSubmitBtn = document.getElementById('auth-submit-btn');
const authSwitchText = document.getElementById('auth-switch-text');
const authSwitchLink = document.getElementById('auth-switch-link');

authSwitchLink.addEventListener('click', (e) => {
  e.preventDefault();
  isRegisterMode = !isRegisterMode;

  if (isRegisterMode) {
    authTitle.textContent = 'Daftar dengan Email kampus';
    authSubmitBtn.textContent = 'Daftar';
    authSwitchText.textContent = 'Sudah punya akun?';
    authSwitchLink.textContent = 'Masuk';
  } else {
    authTitle.textContent = 'Masuk dengan Email kampus';
    authSubmitBtn.textContent = 'Masuk';
    authSwitchText.textContent = 'Belum punya akun?';
    authSwitchLink.textContent = 'Daftar di sini';
  }
});

// Submit Form Login / Daftar
document.getElementById('auth-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const email_kampus = document.getElementById('email_kampus').value;
  const password = document.getElementById('password').value;

  const endpoint = isRegisterMode ? '/register' : '/login';

  try {
    const res = await fetch(`${API_URL}${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email_kampus, password })
    });

    const data = await res.json();
    if (!res.ok) {
      showAlert(data.message || 'Terjadi kesalahan.');
      return;
    }

    // Simpan token & email ke localStorage
    localStorage.setItem('cbe_token', data.token);
    localStorage.setItem('cbe_email', data.user.email_kampus);

    if (isRegisterMode || !data.hasProfile) {
      // Arahkan ke 02 lengkapi profil
      showScreen('profil');
    } else {
      // Profil sudah lengkap -> langsung ke 03 beranda
      currentProfile = data.profil;
      renderBeranda(false);
      showScreen('beranda');
    }
  } catch (err) {
    showAlert('Tidak dapat terhubung ke server backend.');
  }
});

// Logika Pilihan Chip Golongan Darah
const chips = document.querySelectorAll('#blood-chips .chip');
const golonganInput = document.getElementById('golongan_darah');

chips.forEach((chip) => {
  chip.addEventListener('click', () => {
    chips.forEach((c) => c.classList.remove('active'));
    chip.classList.add('active');
    golonganInput.value = chip.dataset.value;
  });
});

// Isi form profil jika sedang mode edit
function populateProfileForm(profil) {
  if (!profil) return;
  document.getElementById('nama_lengkap').value = profil.nama_lengkap || '';
  document.getElementById('nim_id_civitas').value = profil.nim_id_civitas || '';
  document.getElementById('no_telepon').value = profil.no_telepon || '';
  document.getElementById('fakultas_unit').value = profil.fakultas_unit || '';
  document.getElementById('bersedia_donor').checked = profil.bersedia_donor == 1;

  const goldar = profil.golongan_darah || 'A';
  golonganInput.value = goldar;
  chips.forEach((c) => {
    c.classList.toggle('active', c.dataset.value === goldar);
  });
}

// Submit Form Lengkapi / Update Profil Pendonor
document.getElementById('profil-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const token = localStorage.getItem('cbe_token');

  const payload = {
    nama_lengkap: document.getElementById('nama_lengkap').value,
    nim_id_civitas: document.getElementById('nim_id_civitas').value,
    no_telepon: document.getElementById('no_telepon').value,
    fakultas_unit: document.getElementById('fakultas_unit').value,
    golongan_darah: golonganInput.value,
    bersedia_donor: document.getElementById('bersedia_donor').checked ? 1 : 0
  };

  try {
    const res = await fetch(`${API_URL}/profil`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(payload)
    });

    const data = await res.json();
    if (!res.ok) {
      showAlert(data.message || 'Gagal menyimpan profil.');
      return;
    }

    currentProfile = data.profil;
    renderBeranda(true, data.message);
    showScreen('beranda');
  } catch (err) {
    showAlert('Gagal menghubungi server saat menyimpan profil.');
  }
});

// Render Halaman 03 Beranda & Tab Profil
function renderBeranda(showBanner = false, bannerMessage = 'Profil pendonor berhasil disimpan') {
  const banner = document.getElementById('success-banner');
  const bannerText = document.getElementById('success-banner-text');

  if (showBanner) {
    bannerText.textContent = bannerMessage;
    banner.classList.remove('hidden');
  } else {
    banner.classList.add('hidden');
  }

  // Sapaan nama pendonor
  const greetingName = document.getElementById('greeting-name');
  if (currentProfile && currentProfile.nama_lengkap) {
    const firstName = currentProfile.nama_lengkap.split(' ')[0];
    greetingName.textContent = `Halo, ${firstName}!`;
  } else {
    greetingName.textContent = 'Halo, Pendonor!';
  }

  // Ringkasan di Tab Profil
  const summaryBox = document.getElementById('profile-summary-box');
  if (currentProfile) {
    summaryBox.innerHTML = `
      <strong>${currentProfile.nama_lengkap}</strong>
      <p>NIM/ID: ${currentProfile.nim_id_civitas}</p>
      <p>Fakultas/Unit: ${currentProfile.fakultas_unit}</p>
      <p>No. Telepon: ${currentProfile.no_telepon}</p>
      <p>Golongan Darah: <b>${currentProfile.golongan_darah}</b></p>
      <p>Status: ${currentProfile.bersedia_donor == 1 ? 'Bersedia Donor' : 'Tidak Aktif Donor'}</p>
    `;
  }
}

// Navigasi Bottom Bar
function switchTab(tabName) {
  document.querySelectorAll('.tab-view').forEach((el) => el.classList.add('hidden'));
  document.getElementById(`tab-${tabName}`).classList.remove('hidden');

  document.querySelectorAll('.nav-item').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.tab === tabName);
  });
}

document.querySelectorAll('.nav-item').forEach((btn) => {
  btn.addEventListener('click', () => switchTab(btn.dataset.tab));
});

// Buka Form Edit Profil dari Kartu Beranda maupun Tab Profil
document.getElementById('btn-edit-profil').addEventListener('click', () => {
  populateProfileForm(currentProfile);
  showScreen('profil');
});

document.getElementById('btn-ubah-profil-tab').addEventListener('click', () => {
  populateProfileForm(currentProfile);
  showScreen('profil');
});

// Logout
document.getElementById('btn-logout').addEventListener('click', () => {
  localStorage.removeItem('cbe_token');
  localStorage.removeItem('cbe_email');
  currentProfile = null;
  document.getElementById('auth-form').reset();
  switchTab('beranda');
  showScreen('login');
});

// Cek sesi saat halaman pertama kali dimuat
async function initSession() {
  const token = localStorage.getItem('cbe_token');
  if (!token) {
    showScreen('login');
    return;
  }

  try {
    const res = await fetch(`${API_URL}/profil`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (!res.ok) {
      localStorage.removeItem('cbe_token');
      showScreen('login');
      return;
    }

    const data = await res.json();
    if (data.hasProfile) {
      currentProfile = data.profil;
      renderBeranda(false);
      showScreen('beranda');
    } else {
      showScreen('profil');
    }
  } catch (err) {
    showScreen('login');
  }
}

initSession();
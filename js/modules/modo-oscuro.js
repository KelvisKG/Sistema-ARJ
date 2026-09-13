// === Modo Oscuro ===
    // ═══════════════════════════════════════════════════════════════
    // LOTE C — FUNCIONES ESTRATÉGICAS
    // ═══════════════════════════════════════════════════════════════

    // ─── MODO OSCURO ───
    function toggleModoOscuro() {
      document.body.classList.toggle('dark');
      const btn = document.getElementById('btn-dark');
      const oscuro = document.body.classList.contains('dark');
      btn.innerHTML = oscuro ? '<i class="ti ti-sun"></i>' : '<i class="ti ti-moon"></i>';
      btn.title = oscuro ? 'Modo claro' : 'Modo oscuro';
      notif(oscuro ? 'Modo oscuro activado' : 'Modo claro activado', 'success');
    }

    // ─── COMPARATIVA ENTRE EMPRESAS ───
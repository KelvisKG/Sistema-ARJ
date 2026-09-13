// === Modo Caja ===
    function activarModoCaja() {
      // v13.8 DESHABILITADO: cajaCobrar() decía "Venta cobrada. Factura emitida e
      // impresa." y no emitía nada — sin factura, sin descuento de stock, sin
      // registro del cobro. Usado en mostrador, la mercancía salía sin rastro.
      notif('El Modo Caja está en construcción. Usa la pantalla de Facturación.', 'error');
      return;
      /* eslint-disable no-unreachable */
      cajaItems = [];
      document.getElementById('caja-empresa-label').textContent = estado.empresa === 'directa' ? 'Venta Directa' : 'Distribuidora';
      document.getElementById('caja-modo').classList.add('show');
      setTimeout(() => document.getElementById('caja-input').focus(), 100);
      renderCajaItems();
      notif('Modo Caja activado — escanea o escribe códigos', 'success');
      /* eslint-enable no-unreachable */
    }

    function salirModoCaja() {
      document.getElementById('caja-modo').classList.remove('show');
      cajaItems = [];
    }

    function cajaAgregar() {
      const inp = document.getElementById('caja-input');
      const codigo = inp.value.trim().toUpperCase();
      if (!codigo) return;
      // Prioridad: código de barras > código alternativo > código original
      const p = PRODUCTOS.find(x => (x.cod_barras || '').toUpperCase() === codigo)
        || PRODUCTOS.find(x => x.cod_alt.toUpperCase() === codigo || x.cod_orig.toUpperCase() === codigo);
      if (!p) {
        inp.style.borderColor = 'var(--red)';
        inp.style.background = '#FCEBEB';
        notif('✗ Código no encontrado: ' + codigo, 'error');
        setTimeout(() => {
          inp.style.borderColor = '';
          inp.style.background = '';
          inp.value = '';
          inp.focus();
        }, 800);
        return;
      }
      const ex = cajaItems.find(i => i.cod_alt === p.cod_alt);
      if (ex) { ex.cant += 1; }
      else {
        cajaItems.push({
          cod_alt: p.cod_alt, desc: p.desc, fob: p.fob,
          cant: 1, precio: precioPublico(p.fob)
        });
      }
      inp.value = '';
      renderCajaItems();
      inp.focus();
    }

    function renderCajaItems() {
      const cont = document.getElementById('caja-items');
      if (cajaItems.length === 0) {
        cont.innerHTML = '<div style="padding:60px 20px;text-align:center;color:var(--dgray);font-size:16px"><i class="ti ti-package" style="font-size:64px;display:block;margin-bottom:14px;color:#CCC"></i>Escanea el primer producto</div>';
        document.getElementById('caja-total').textContent = '$ 0,00';
        document.getElementById('caja-total-bs').textContent = 'Bs. 0,00 al paralelo';
        document.getElementById('caja-btn-cobrar').disabled = true;
        return;
      }
      cont.innerHTML = cajaItems.map((it, i) => `
    <div class="caja-item">
      <div class="ci-nombre">${it.desc}<div style="font-size:12px;color:var(--dgray);font-weight:400;margin-top:2px">${it.cod_alt}</div></div>
      <div class="ci-cant">×${it.cant}</div>
      <div class="ci-precio">${fmtUSD(it.cant * it.precio)}</div>
      <button onclick="cajaQuitar(${i})" title="Quitar"><i class="ti ti-x"></i></button>
    </div>`).join('');
      const total = cajaItems.reduce((a, i) => a + i.cant * i.precio, 0);
      document.getElementById('caja-total').textContent = fmtUSD(total);
      document.getElementById('caja-total-bs').textContent = fmtBS(total * estado.tasa_par) + ' al paralelo';
      document.getElementById('caja-btn-cobrar').disabled = false;
    }

    function cajaQuitar(i) {
      cajaItems.splice(i, 1);
      renderCajaItems();
      document.getElementById('caja-input').focus();
    }

    function cajaLimpiar() {
      if (cajaItems.length === 0) return;
      if (!confirm('¿Limpiar toda la venta? No quedará registro.')) return;
      cajaItems = [];
      renderCajaItems();
      document.getElementById('caja-input').focus();
    }

    function cajaCobrar() {
      // v13.8: red de seguridad. Aunque alguien reactive el modal por consola,
      // esto no cobra nada.
      notif('El Modo Caja está en construcción. Usa la pantalla de Facturación.', 'error');
      return;
      /* eslint-disable no-unreachable */
      if (cajaItems.length === 0) return;
      const total = cajaItems.reduce((a, i) => a + i.cant * i.precio, 0);
      logBitacora('factura', `Venta rápida modo Caja — ${cajaItems.length} ítems — ${fmtUSD(total)}`, false);
      notif(`✓ Venta cobrada: ${fmtUSD(total)}. Factura emitida e impresa.`, 'success');
      cajaItems = [];
      renderCajaItems();
      setTimeout(() => document.getElementById('caja-input').focus(), 100);
      /* eslint-enable no-unreachable */
    }

    // Atajos modo caja
    document.addEventListener('keydown', e => {
      if (!document.getElementById('caja-modo').classList.contains('show')) return;
      if (e.key === 'F2') { e.preventDefault(); cajaCobrar(); }
      if (e.key === 'Escape') { e.preventDefault(); salirModoCaja(); }
    });

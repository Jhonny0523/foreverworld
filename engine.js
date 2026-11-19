/* ==========================================================================
   FOREVER WORLD — Motor económico (sin DOM, se puede probar con Node)

   Tres capas, cada una resuelve un problema distinto:
   1. EMISIÓN: cuánto dinero puede existir.
      Techo = capitalización = emisión fundacional + puntos de obras AUDITADAS.
      Acumular ítems en cofres no cuenta para nada.
      Toda obra auditada fortalece la moneda en el cambio (con bono adicional si
      se conserva margen sin imprimir); emitir por encima del techo la devalúa.
   2. TIPO DE CAMBIO: cuánto vale una moneda frente a la otra.
      Lo fija el Banco Internacional (neutral) por sus reservas, el respaldo real en
      obras auditadas (que fortalece la moneda incluso tras emitir dentro del techo),
      el superávit no emitido (bono extra) y el exceso sin respaldo (que la devalúa).
      (producto constante con "inercia" virtual). Nadie lo decide: lo mueve el
      comercio y el respaldo real. Si un Estado compra más de lo que vende, su moneda baja.
   3. PRECIOS: cuánto cuesta cada cosa. Lista pública en la moneda del vendedor,
      cambios solo en Sesión de Tarifas, impugnación por Oferta Sellada.

   Monedas: 'M' = moneda de Mythstorm, 'S' = moneda de Scadrial.
   Participantes: 'myth', 'scad', ids de invitados. 'bank' = Banco Internacional.
   ========================================================================== */

(function (root) {
  'use strict';

  const EPS = 1e-9;
  // Etiquetas visibles (la interfaz las reemplaza por DR/BX y nombres de jugador)
  const L = k => (root.FW_ENGINE && root.FW_ENGINE.label ? root.FW_ENGINE.label(k) : k);
  const r4 = n => Math.round((n + Number.EPSILON) * 100) / 100; // centavos
  const curOfState = s => (s === 'myth' ? 'M' : 'S');
  const stateOfCur = c => (c === 'M' ? 'myth' : 'scad');
  const otherCur = c => (c === 'M' ? 'S' : 'M');
  const otherState = s => (s === 'myth' ? 'scad' : 'myth');
  const isState = p => p === 'myth' || p === 'scad';

  let CATS_REF = [];
  function setCategories(c) { CATS_REF = c || []; }

  function holdings(st, pid) {
    const h = st.economy.holdings;
    if (!h[pid]) h[pid] = { M: 0, S: 0 };
    return h[pid];
  }

  /* ---------------- Capa 1: obras, capitalización y emisión ---------------- */

  // Puntos efectivos de cada obra auditada. Las categorías con "decay" valen
  // 100%, 50%, 25%... por cada obra repetida del mismo producto y dueño.
  function effectiveWorkPoints(st, categories) {
    const decayCats = new Set(categories.filter(c => c.decay).map(c => c.id));
    const uniqueCats = new Set(categories.filter(c => c.unique).map(c => c.id));
    const audited = st.economy.works
      .filter(w => w.status === 'auditada')
      .slice()
      .sort((a, b) => (a.auditedAt || 0) - (b.auditedAt || 0));
    const seen = {};
    const out = {};
    audited.forEach(w => {
      const pts = Number(w.final ?? w.proposed ?? 0);
      if (uniqueCats.has(w.cat)) {
        // Reliquias: solo la primera de cada tipo (que siga custodiada) cuenta
        const key = `${w.owner}|${w.cat}|${String(w.product || '').trim().toLowerCase()}`;
        out[w.id] = seen[key] ? 0 : pts;
        seen[key] = true;
      } else if (decayCats.has(w.cat)) {
        const key = `${w.owner}|${w.cat}|${String(w.product || '').trim().toLowerCase()}`;
        const n = seen[key] || 0;
        seen[key] = n + 1;
        out[w.id] = r4(pts * Math.pow(0.5, n));
      } else {
        out[w.id] = pts;
      }
    });
    return out;
  }

  function worksPoints(st, s, categories) {
    const cats = categories || CATS_REF;
    const eff = effectiveWorkPoints(st, cats);
    return r4(st.economy.works
      .filter(w => w.owner === s && w.status === 'auditada')
      .reduce((sum, w) => sum + (eff[w.id] || 0), 0));
  }

  function capitalization(st, s, categories) {
    return r4(Number(st.settings.baseIssue || 0) + worksPoints(st, s, categories));
  }

  // Dinero en existencia de una moneda (en manos de todos + reservas del banco)
  function issued(st, c) {
    let sum = Number(st.economy.bank[c] || 0);
    Object.values(st.economy.holdings).forEach(h => { sum += Number(h[c] || 0); });
    return r4(sum);
  }

  function inDefault(st, pid) {
    return st.economy.loans.some(l => l.borrower === pid && l.status === 'mora');
  }

  // Dinero sin respaldo: lo que circula por encima del techo
  function excess(st, c) {
    const s = stateOfCur(c);
    return Math.max(0, r4(issued(st, c) - capitalization(st, s, CATS_REF)));
  }

  // Respaldo sobrante: capitalización auditada por encima del dinero en circulación.
  // Valoriza/fortalece la moneda mientras el Estado conserve ese respaldo sin imprimirlo.
  function surplus(st, c) {
    const s = stateOfCur(c);
    return Math.max(0, r4(capitalization(st, s, CATS_REF) - issued(st, c)));
  }

  function mint(st, s, amount, categories, allowOver) {
    const c = curOfState(s);
    amount = r4(Number(amount));
    if (!(amount > 0)) return { ok: false, msg: 'Cantidad inválida.' };
    if (inDefault(st, s)) return { ok: false, msg: 'Estado en mora con un préstamo: no puede emitir hasta ponerse al día.' };
    const cap = capitalization(st, s, categories);
    const now = issued(st, c);
    const over = r4(Math.max(0, now + amount - Math.max(cap, now)));
    if (over > EPS && !allowOver) {
      return { ok: false, needConfirm: true, over, msg: `Supera el techo de emisión: hay ${fmt(now)} en circulación y el techo es ${fmt(cap)}. ${fmt(over)} ${L(c)} serían dinero SIN RESPALDO.` };
    }
    holdings(st, s)[c] = r4(holdings(st, s)[c] + amount);
    return { ok: true, over };
  }

  function burn(st, s, amount) {
    const c = curOfState(s);
    amount = r4(Number(amount));
    const h = holdings(st, s);
    if (!(amount > 0)) return { ok: false, msg: 'Cantidad inválida.' };
    if (amount > h[c] + EPS) return { ok: false, msg: 'No tienes tanta moneda propia en el tesoro.' };
    h[c] = r4(h[c] - amount);
    return { ok: true };
  }

  /* ---------------- Capa 2: Banco Internacional y tipo de cambio ---------------- */

  function inertia(st) { return Math.max(0, Number(st.settings.fxInertia || 0)); }

  // Profundidad efectiva de cada lado del cambio:
  // - bank[c] + inertia: liquidez de mercado (comercio en La Gran Cámara)
  // - excess(c): emisión SIN respaldo de c → DEVALÚA c
  // - worksPoints(otherState): obras auditadas del otro Estado (solidez/PIB real) → AVALÚA al otro Estado
  //   de forma permanente incluso tras emitir dentro de su techo
  // - surplus(oc): respaldo sobrante NO impreso del otro Estado → bono extra de apreciación por escasez
  function depth(st, c) {
    const oc = otherCur(c);
    const os = stateOfCur(oc);
    return st.economy.bank[c] + inertia(st) + excess(st, c) + worksPoints(st, os, CATS_REF) + surplus(st, oc);
  }

  // Precio de 1 M expresado en S
  function rate(st) {
    const x = depth(st, 'M');
    const y = depth(st, 'S');
    if (x <= EPS || y <= EPS) return 1;
    return y / x;
  }

  // Cuánto de "from" hay que entregar al banco para sacar "out" de la otra moneda
  function quoteForOut(st, fromCur, out) {
    const toCur = otherCur(fromCur);
    const V = inertia(st);
    const b = st.economy.bank;
    if (out > b[toCur] + EPS) return { ok: false, msg: `${L('bank')} solo tiene ${fmt(b[toCur])} ${L(toCur)} en reservas.` };
    const X = depth(st, fromCur);
    const Y = depth(st, toCur);
    if (Y - out <= EPS) return { ok: false, msg: 'El banco no tiene liquidez suficiente.' };
    return { ok: true, cost: r4((X * out) / (Y - out)) };
  }

  // Cuánto se recibe de la otra moneda al entregar "amountIn" de "fromCur"
  function quoteForIn(st, fromCur, amountIn) {
    const toCur = otherCur(fromCur);
    const V = inertia(st);
    const b = st.economy.bank;
    const X = depth(st, fromCur);
    const Y = depth(st, toCur);
    let out = (Y * amountIn) / (X + amountIn);
    if (out > b[toCur]) out = b[toCur];
    return r4(out);
  }

  function credit(st, pid, c, amount) {
    if (pid === 'bank') st.economy.bank[c] = r4(st.economy.bank[c] + amount);
    else holdings(st, pid)[c] = r4(holdings(st, pid)[c] + amount);
  }

  /* Pago universal: "payer" entrega "amount" de la moneda "cur" a "payee".
     Usa primero lo que tenga en esa moneda; el faltante lo convierte desde
     su otra moneda a través del Banco Internacional (y eso mueve el cambio). */
  function pay(st, payer, payee, cur, amount, dry) {
    amount = r4(Number(amount));
    if (!(amount > 0)) return { ok: false, msg: 'Cantidad inválida.' };
    if (payer === payee) return { ok: false, msg: 'Quien paga y quien cobra son el mismo.' };
    const h = holdings(st, payer);
    const oc = otherCur(cur);
    const direct = r4(Math.min(h[cur], amount));
    const short = r4(amount - direct);
    let cost = 0;
    if (short > EPS) {
      const q = quoteForOut(st, oc, short);
      if (!q.ok) return { ok: false, msg: `Te faltan ${fmt(short)} ${L(cur)} y ${q.msg.charAt(0).toLowerCase() + q.msg.slice(1)}` };
      cost = q.cost;
      if (cost > h[oc] + EPS) {
        return { ok: false, msg: `Fondos insuficientes: necesitas ${fmt(cost)} ${L(oc)} para convertir y tienes ${fmt(h[oc])}.` };
      }
    }
    if (!dry) {
      h[cur] = r4(h[cur] - direct);
      if (short > EPS) {
        h[oc] = r4(h[oc] - cost);
        st.economy.bank[oc] = r4(st.economy.bank[oc] + cost);
        st.economy.bank[cur] = r4(st.economy.bank[cur] - short);
      }
      credit(st, payee, cur, amount);
    }
    return { ok: true, direct, short, cost, costCur: oc };
  }

  // Cambio voluntario de divisas en el banco
  function swap(st, pid, fromCur, amountIn, dry) {
    amountIn = r4(Number(amountIn));
    const h = holdings(st, pid);
    if (!(amountIn > 0)) return { ok: false, msg: 'Cantidad inválida.' };
    if (amountIn > h[fromCur] + EPS) return { ok: false, msg: 'No tienes esa cantidad.' };
    const toCur = otherCur(fromCur);
    const out = quoteForIn(st, fromCur, amountIn);
    if (!(out > 0)) return { ok: false, msg: 'El banco no tiene reservas de la otra moneda.' };
    if (!dry) {
      h[fromCur] = r4(h[fromCur] - amountIn);
      h[toCur] = r4(h[toCur] + out);
      st.economy.bank[fromCur] = r4(st.economy.bank[fromCur] + amountIn);
      st.economy.bank[toCur] = r4(st.economy.bank[toCur] - out);
    }
    return { ok: true, out, toCur };
  }

  // Aporte conjunto de liquidez: Mythstorm pone M, Scadrial pone S al cambio vigente.
  // No mueve el tipo de cambio.
  function jointDeposit(st, amountM, dry) {
    amountM = r4(Number(amountM));
    if (!(amountM > 0)) return { ok: false, msg: 'Cantidad inválida.' };
    const V = inertia(st);
    const b = st.economy.bank;
    const amountS = r4(amountM * rate(st));
    const hm = holdings(st, 'myth');
    const hs = holdings(st, 'scad');
    if (amountM > hm.M + EPS) return { ok: false, msg: `El tesoro de ${L('myth')} no tiene ${fmt(amountM)} ${L('M')}.` };
    if (amountS > hs.S + EPS) return { ok: false, msg: `El tesoro de ${L('scad')} no tiene ${fmt(amountS)} ${L('S')}.` };
    if (!dry) {
      hm.M = r4(hm.M - amountM);
      hs.S = r4(hs.S - amountS);
      b.M = r4(b.M + amountM);
      b.S = r4(b.S + amountS);
    }
    return { ok: true, amountM, amountS };
  }

  // Convierte entre 'M', 'S' y la Unidad Internacional 'U' (canasta ½ M + ½ S)
  function uiValue(st, c) {
    const r = rate(st); // S por cada M
    return c === 'M' ? 0.5 + 0.5 / r : 0.5 * r + 0.5;
  }

  function convert(st, amount, from, to) {
    if (from === to) return amount;
    if (from === 'U') return amount * uiValue(st, to);
    if (to === 'U') return amount / uiValue(st, from);
    const r = rate(st);
    return from === 'M' ? amount * r : amount / r;
  }

  /* ---------------- Préstamos ----------------
     Un préstamo se denomina en M, S o U (canasta neutral: Ojo de Ender por defecto).
     En U se entrega y se devuelve en moneda real, convertida al cambio del día:
     si una moneda cae, la pérdida se reparte mitad y mitad. */

  function loanDue(l) { return r4(l.principal * (1 + Number(l.interest || 0) / 100)); }

  // Moneda real con la que se salda un préstamo
  function settleCur(l) {
    if (l.cur !== 'U') return l.cur;
    if (isState(l.lender)) return curOfState(l.lender);
    if (isState(l.borrower)) return curOfState(l.borrower);
    return l.payCur || 'M';
  }

  function bankDebt(st, s) {
    const c = curOfState(s);
    return r4(st.economy.loans
      .filter(l => l.lender === 'bank' && l.borrower === s && l.status !== 'pagado')
      .reduce((sum, l) => sum + convert(st, loanDue(l), l.cur, c), 0));
  }

  // Máximo que el banco puede prestar ahora a un Estado, expresado en "cur" (M, S o U).
  // payCur = moneda real que saldría de las reservas.
  function bankLoanLimits(st, s, cur, categories, payCur) {
    const c = curOfState(s);
    payCur = cur === 'U' ? (payCur || c) : cur;
    const cap = capitalization(st, s, categories);
    const maxDebt = cap * Number(st.settings.bankCollateralPct || 0) / 100; // en moneda del Estado
    const room = Math.max(0, maxDebt - bankDebt(st, s));
    const rateMult = 1 + Number(st.settings.bankRate || 0) / 100;
    const byCollateral = convert(st, room, c, cur) / rateMult;
    const liquidity = convert(st, st.economy.bank[payCur] * Number(st.settings.bankLiquidityPct || 0) / 100, payCur, cur);
    return { max: r4(Math.max(0, Math.min(byCollateral, liquidity))), maxDebt: r4(maxDebt), liquidity: r4(liquidity), payCur };
  }

  function createLoan(st, { lender, borrower, cur, payCur, principal, interest, due, terms }, categories) {
    principal = r4(Number(principal));
    if (!(principal > 0)) return { ok: false, msg: 'Monto inválido.' };
    if (lender === borrower) return { ok: false, msg: 'Prestamista y deudor son el mismo.' };
    if (inDefault(st, borrower)) return { ok: false, msg: 'El deudor está en mora: no puede recibir préstamos nuevos.' };
    if (cur !== 'U') payCur = cur;
    else if (!payCur) payCur = isState(lender) ? curOfState(lender) : (isState(borrower) ? curOfState(borrower) : 'M');
    const out = r4(convert(st, principal, cur, payCur)); // moneda real entregada
    if (lender === 'bank') {
      if (!isState(borrower)) return { ok: false, msg: `${L('bank')} solo presta a Estados (los invitados no tienen obras como garantía).` };
      if (excess(st, curOfState(borrower)) > EPS) return { ok: false, msg: `${L('bank')} no presta a un Estado sobre-emitido (tiene dinero sin respaldo).` };
      const lim = bankLoanLimits(st, borrower, cur, categories, payCur);
      if (principal > lim.max + EPS) return { ok: false, msg: `Supera el límite del banco: máximo ${fmt(lim.max)} ${L(cur)} ahora mismo.` };
      interest = Number(st.settings.bankRate || 0);
      st.economy.bank[payCur] = r4(st.economy.bank[payCur] - out);
    } else {
      const h = holdings(st, lender);
      if (out > h[payCur] + EPS) return { ok: false, msg: `El prestamista no tiene ${fmt(out)} ${L(payCur)}.` };
      h[payCur] = r4(h[payCur] - out);
    }
    credit(st, borrower, payCur, out);
    const loan = {
      id: uid('lon'), lender, borrower, cur, payCur, delivered: out, principal,
      interest: Number(interest || 0), due: due || '', terms: terms || '',
      status: 'activo', createdAt: Date.now()
    };
    st.economy.loans.unshift(loan);
    return { ok: true, loan, out };
  }

  function repayLoan(st, loanId, dry) {
    const l = st.economy.loans.find(x => x.id === loanId);
    if (!l || l.status === 'pagado') return { ok: false, msg: 'Préstamo no encontrado o ya pagado.' };
    const c = settleCur(l);
    const amount = r4(convert(st, loanDue(l), l.cur, c));
    const res = pay(st, l.borrower, l.lender, c, amount, dry);
    if (!res.ok) return res;
    if (!dry) {
      l.status = 'pagado';
      l.paidAt = Date.now();
      l.paidAmount = amount;
      l.paidCur = c;
    }
    return { ok: true, res, amount, cur: c };
  }

  /* ---------------- Acciones (para invitados y para el otro Estado) ---------------- */

  function sharePrice(st, s, categories) {
    const total = Number(st.settings.sharesTotal || 100);
    return r4(capitalization(st, s, categories) / total);
  }

  function shareBook(st, s) {
    if (!st.economy.shares[s]) st.economy.shares[s] = { [s]: Number(st.settings.sharesTotal || 100) };
    return st.economy.shares[s];
  }

  function buyShares(st, buyer, s, n, categories, dry) {
    n = Math.floor(Number(n));
    if (!(n > 0)) return { ok: false, msg: 'Número de acciones inválido.' };
    if (buyer === s) return { ok: false, msg: 'Un Estado no compra sus propias acciones aquí (usa Recomprar).' };
    const book = shareBook(st, s);
    if ((book[s] || 0) < n) return { ok: false, msg: `El Estado solo tiene ${book[s] || 0} acciones disponibles.` };
    const total = r4(sharePrice(st, s, categories) * n);
    const res = pay(st, buyer, s, curOfState(s), total, dry);
    if (!res.ok) return res;
    if (!dry) {
      book[s] -= n;
      book[buyer] = (book[buyer] || 0) + n;
    }
    return { ok: true, total, res };
  }

  function sellShares(st, holder, s, n, categories, dry) {
    n = Math.floor(Number(n));
    const book = shareBook(st, s);
    if (!(n > 0) || (book[holder] || 0) < n) return { ok: false, msg: 'No tiene tantas acciones.' };
    const total = r4(sharePrice(st, s, categories) * n);
    const c = curOfState(s);
    if (holdings(st, s)[c] + EPS < total) return { ok: false, msg: `El tesoro del Estado no tiene ${fmt(total)} para recomprar.` };
    const res = pay(st, s, holder, c, total, dry);
    if (!res.ok) return res;
    if (!dry) {
      book[holder] -= n;
      if (book[holder] === 0) delete book[holder];
      book[s] = (book[s] || 0) + n;
    }
    return { ok: true, total };
  }

  function payDividend(st, s, perShare, dry) {
    perShare = r4(Number(perShare));
    if (!(perShare > 0)) return { ok: false, msg: 'Dividendo inválido.' };
    const book = shareBook(st, s);
    const c = curOfState(s);
    const outside = Object.entries(book).filter(([pid, n]) => pid !== s && n > 0);
    if (outside.length === 0) return { ok: false, msg: 'No hay accionistas externos.' };
    const total = r4(outside.reduce((sum, [, n]) => sum + n * perShare, 0));
    if (total > holdings(st, s)[c] + EPS) return { ok: false, msg: `El tesoro necesita ${fmt(total)} en moneda propia.` };
    if (!dry) outside.forEach(([pid, n]) => pay(st, s, pid, c, r4(n * perShare)));
    return { ok: true, total, holders: outside.length };
  }

  /* ---------------- Oferta sellada ---------------- */
  // Si la oferta del comprador >= pedido del vendedor: precio = punto medio.
  // Si no: sin acuerdo. Al segundo intento fallido: punto medio obligatorio.
  function sealedBid(ask, bid, attempt) {
    ask = Number(ask); bid = Number(bid);
    if (!(ask > 0) || !(bid > 0)) return { ok: false, msg: 'Ambos números deben ser positivos.' };
    const mid = r4((ask + bid) / 2);
    if (bid >= ask) return { ok: true, deal: true, price: mid, forced: false };
    if (attempt >= 2) return { ok: true, deal: true, price: mid, forced: true };
    return { ok: true, deal: false, gap: r4(ask - bid) };
  }

  /* ---------------- utilidades ---------------- */
  function fmt(n) {
    const v = Math.round(Number(n || 0) * 100) / 100;
    return v.toLocaleString('es-CO', { maximumFractionDigits: 2 });
  }
  function uid(prefix) {
    return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
  }

  root.FW_ENGINE = {
    r4, fmt, uid, setCategories, excess, surplus, worksPoints, depth, curOfState, stateOfCur, otherCur, otherState, isState, holdings,
    effectiveWorkPoints, capitalization, issued, inDefault, mint, burn,
    rate, quoteForOut, quoteForIn, pay, swap, jointDeposit, convert, uiValue,
    loanDue, settleCur, bankDebt, bankLoanLimits, createLoan, repayLoan,
    sharePrice, shareBook, buyShares, sellShares, payDividend, sealedBid
  };
})(typeof window !== 'undefined' ? window : globalThis);

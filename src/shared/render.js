/* 스코어보드 1·2 HTML 생성 (조작 화면 미리보기와 프릭샷 오버레이가 함께 사용)
 * state = { mode:'pl'|'race', maps:[{name,short}], pl:{...}, race:{...} }
 * build(state, prevKey) -> { jc, sb1, sb2, key }  (key 는 점수·킬이 바뀐 순간 강조 애니메이션용)
 */
(function (root) {
  const esc = (s) =>
    String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

  function shortOf(maps, name) {
    const m = (maps || []).find((x) => x.name === name);
    return m && m.short ? m.short : String(name || '').trim().charAt(0);
  }

  /* ---------- 프로리그 ---------- */
  function buildPL(st, prevKey) {
    const S = st.pl;
    const games = S.games || [];
    const g = games[S.cur] || games[0] || { a: '', b: '', ar: '', br: '', map: '' };
    const sa = games.filter((x) => x.w === 'A').length;
    const sb = games.filter((x) => x.w === 'B').length;
    const allDone = games.length > 0 && games.every((x) => x.w);

    const key = 'pl|' + sa + ':' + sb;
    const prev = String(prevKey || '').split('|');
    const changed = prev[0] === 'pl' && prevKey !== key;
    const pa = (prev[1] || '').split(':');
    const pop1 = changed && pa[0] != sa;
    const pop2 = changed && pa[1] != sb;

    const sb1 = `
    <div class="sb1-banner ${S.bannerOn && S.banner ? '' : 'off'}">${esc(S.banner || '·')}</div>
    <div class="sb1-box">
      <div class="sb1-set"><b>SET ${S.cur + 1}</b><span>${esc(g.map)}</span></div>
      <div class="sb1-main">
        <div class="sb1-p a">${esc(g.a)}</div>
        <div class="sb1-score"><i class="${pop1 ? 'pop' : ''}">${sa}</i><i class="${pop2 ? 'pop' : ''}">${sb}</i></div>
        <div class="sb1-p b">${esc(g.b)}</div>
      </div>
    </div>
    <div class="sb1-sub">
      <div class="sb1-race a"><span><b>${esc(g.ar)}</b></span></div>
      <div class="sb1-race b"><span><b>${esc(g.br)}</b></span></div>
    </div>`;

    const rows = games
      .map((x, i) => {
        const cl = (side) => (!x.w ? 'n-pend' : x.w === side ? 'n-' + (side === 'A' ? x.ar : x.br) : 'n-lose');
        const cur = i === S.cur && !allDone;
        return `<div class="sb2-row ${cur ? 'cur' : ''}"><div class="sb2-no">${i + 1}</div><div class="${cl('A')}">${esc(x.a)}</div><div class="sb2-map">${esc(shortOf(st.maps, x.map))}</div><div class="${cl('B')}">${esc(x.b)}</div></div>`;
      })
      .join('');
    const sb2 = `
    <div class="sb2-title" ${String(S.title || '').trim() ? '' : 'hidden'}>${esc(S.title)}</div>
    <div class="sb2-head"><span>${esc(S.a.name)}</span><span class="sc">${sa}:${sb}</span><span>${esc(S.b.name)}</span></div>
    <div class="sb2-rows">${rows}</div>`;

    return { jc: false, sb1, sb2, key };
  }

  /* ---------- 종족최강전 (기존 TFPL_S4/bj/종최 디자인) ---------- */
  const RACE_COLOR = { T: '#5599ff', P: '#FFD700', Z: '#ff4444' };
  const RACES = ['T', 'Z', 'P'];

  function buildJC(st, prevKey) {
    const R = st.race;
    const P = (id) => (id == null ? null : R.players.find((p) => p.id === id) || null);
    const ref = (x) => (x == null ? null : typeof x === 'object' ? x : { id: x });
    const pnm = (x) => {
      x = ref(x);
      if (!x) return '';
      const p = P(x.id);
      return p ? p.name : x.name || '';
    };
    const prace = (x) => {
      x = ref(x);
      if (!x) return '';
      const p = P(x.id);
      return p ? p.r : x.r || '';
    };
    const kills = (x) => {
      x = ref(x);
      const p = x && P(x.id);
      return p ? p.k || 0 : 0;
    };
    const aliveRaces = RACES.filter((r) => R.players.some((p) => p.r === r && !p.out));
    const done = R.log.length > 0 && aliveRaces.length <= 1;
    const last = R.log[R.log.length - 1];
    const fin = done && R.need && last;
    const A = fin ? last.L : ref(R.cur.L);
    const B = fin ? last.R : ref(R.cur.R);

    const ka = kills(A);
    const kb = kills(B);
    const key = 'race|' + ka + ':' + kb;
    const prev = String(prevKey || '').split('|');
    const changed = prev[0] === 'race' && prevKey !== key;
    const pk = (prev[1] || '').split(':');

    const jk = (n, pop) => (n > 0 ? `<span class="jk ${n >= 3 ? 'hot' : ''} ${pop ? 'pop' : ''}">${n}<small>K</small></span>` : '');
    const sep = (n) => (n > 0 ? '<i class="jsep"></i>' : '');
    const pos = (x, side) => {
      const r = prace(x);
      return r ? `<span class="jc1-pos" style="color:${RACE_COLOR[r]}">${r}${R.pos[side]}</span>` : '';
    };
    const nameStyle = (x) => (pnm(x).length > 7 ? 'style="font-size:15px"' : '');
    const setNo = fin ? R.log.length : R.log.length + 1;
    const map = fin ? last.map : R.cur.map;

    const sb1 = `<div class="jc1">
    <div class="jc1-top"><span>SET ${setNo}</span><span>${esc(map)}</span></div>
    <div class="jc1-line"></div>
    <div class="jc1-row"><span class="jc1-name l" ${nameStyle(A)}>${esc(pnm(A))}</span><span class="jc1-name r" ${nameStyle(B)}>${esc(pnm(B))}</span></div>
    <div class="jc1-bot"><div class="jc1-pg l">${jk(ka, changed && pk[0] != ka)}${sep(ka)}${pos(A, 'L')}</div><div class="jc1-sp"></div><div class="jc1-pg r">${pos(B, 'R')}${sep(kb)}${jk(kb, changed && pk[1] != kb)}</div></div>
  </div>`;

    const rows = ['T', 'P', 'Z']
      .filter((r) => !R.hide[r])
      .map(
        (r) =>
          `<div class="jc2-row ${r}"><div class="jc2-chip ${r}">${r}</div>${R.players
            .filter((q) => q.r === r)
            .map((q) => `<div class="jc2-name ${q.out ? 'dead' : ''}">${esc(q.name)}</div>`)
            .join('')}</div>`
      )
      .join('');
    const prize = String(R.prize || '').trim() ? `<div class="jc2-prize">${esc(R.prize)}</div>` : '';
    const sb2 = `<div class="jc2">${rows}${prize}</div>`;

    return { jc: true, sb1, sb2, key };
  }

  root.TUFRender = {
    esc,
    shortOf,
    build(st, prevKey) {
      return st.mode === 'race' ? buildJC(st, prevKey) : buildPL(st, prevKey);
    },
  };
})(typeof window !== 'undefined' ? window : globalThis);

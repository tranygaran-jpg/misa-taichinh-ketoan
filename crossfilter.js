/* Identity-free client-side aggregation for coordinated chart selections. */
(function(global) {
  "use strict";
  const YEARS = [2023, 2024, 2025];
  const CODES = "ABCDE";
  const OTHER = "BCDE";
  const yearIndex = year => Math.max(0, Math.min(2, Number(year) - 2023));
  const maskAt = (row, year) => row.masks[yearIndex(year)] || "";
  const productCount = mask => mask.length;
  const buyingGroup = (row, year) => {
    const mask = maskAt(row, year);
    if (mask.length < 2) return mask.length ? "single" : "inactive";
    return [...mask].every(p => row.first.includes(p)) ? "initial" : "supplemental";
  };
  const newObject = codes => Object.fromEntries([...codes].map(k => [k, 0]));
  function selectedRows(cohorts, filters) {
    const currentYear = Number(filters.year || 2025);
    return cohorts.filter(row => {
      const mask = maskAt(row, currentYear);
      if (!mask.length) return false;
      if (filters.size && row.size !== filters.size) return false;
      if (filters.industry && row.industry !== filters.industry) return false;
      if (filters.city && row.city !== filters.city) return false;
      if (filters.product && !mask.includes(filters.product)) return false;
      if (filters.combo && mask !== filters.combo) return false;
      if (filters.count) {
        const count = productCount(mask);
        if (filters.count === "3+" ? count < 3 : filters.count === "2+" ? count < 2 : count !== Number(filters.count)) return false;
      }
      if (filters.purchaseType && buyingGroup(row, currentYear) !== filters.purchaseType) return false;
      if (filters.revenueClass) {
        const group = productCount(mask) === 1 ? "single" : "multi";
        if (group !== filters.revenueClass) return false;
      }
      if (filters.ab && (!mask.includes("A") || !mask.includes("B") || row.ab !== filters.ab)) return false;
      if (filters.role) {
        if (!mask.includes(filters.role.code)) return false;
        const wasFirst = row.first.includes(filters.role.code);
        if (wasFirst !== (filters.role.mode === "first")) return false;
      }
      if (filters.aSubset && !mask.includes("A")) return false;
      if (filters.productStatus) {
        const owned = mask.includes(filters.productStatus.code);
        if (owned !== filters.productStatus.owned) return false;
      }
      return true;
    });
  }

  function aggregate(cohorts, filters) {
    const year = Number(filters.year || 2025);
    const rows = selectedRows(cohorts, filters);
    const perProduct = newObject(CODES);
    const singleProduct = newObject(CODES);
    const byProductCount = {"1": 0, "2": 0, "3+": 0};
    const comboMap = {};
    const roleFirst = newObject(CODES), roleAdditional = newObject(CODES);
    const ab = {"A→B": 0, "B→A": 0, "A+B": 0};
    const yearly = YEARS.map(y => ({year: y, single: 0, two: 0, threePlus: 0, initial: 0, supplemental: 0}));
    const revenue = YEARS.map(y => ({year: y, single: 0, multi: 0}));
    const supplementalMoney = newObject(OTHER);
    const boughtA = newObject(OTHER);
    const missingA = newObject(OTHER);
    const segments = {size: new Map(), industry: new Map(), city: new Map()};
    let totalCustomers = 0, baseA = 0;

    for (const row of rows) {
      const n = row.n;
      const mask = maskAt(row, year);
      totalCustomers += n;
      const count = productCount(mask);
      const countKey = count >= 3 ? "3+" : String(count);
      byProductCount[countKey] += n;
      if (count >= 2) comboMap[mask] = (comboMap[mask] || 0) + n;
      for (const code of mask) {
        perProduct[code] += n;
        if (count === 1) singleProduct[code] += n;
        if (row.first.includes(code)) roleFirst[code] += n;
        else roleAdditional[code] += n;
      }
      if (mask.includes("A") && mask.includes("B") && ab[row.ab] !== undefined) ab[row.ab] += n;
      for (let i = 0; i < YEARS.length; i++) {
        const ym = row.masks[i] || "";
        if (!ym.length) continue;
        if (ym.length === 1) yearly[i].single += n;
        else if (ym.length === 2) yearly[i].two += n;
        else yearly[i].threePlus += n;
        if (ym.length > 1) {
          const initial = [...ym].every(p => row.first.includes(p));
          yearly[i][initial ? "initial" : "supplemental"] += n;
        }
        revenue[i][ym.length === 1 ? "single" : "multi"] += row.revenue[i];
      }
      for (let i = 0; i < OTHER.length; i++) supplementalMoney[OTHER[i]] += row.supplemental[4 * yearIndex(year) + i];
      if (mask.includes("A")) {
        baseA += n;
        for (const code of OTHER) (mask.includes(code) ? boughtA : missingA)[code] += n;
        for (const dimension of ["size", "industry", "city"]) {
          const label = row[dimension];
          if (!segments[dimension].has(label)) segments[dimension].set(label, {label, base: 0, missing: newObject(OTHER)});
          const group = segments[dimension].get(label);
          group.base += n;
          for (const code of OTHER) if (!mask.includes(code)) group.missing[code] += n;
        }
      }
    }
    const countAB = ab["A→B"] + ab["B→A"] + ab["A+B"];
    return {
      meta: {year, totalCustomers, countAB, selectedCohorts: rows.length},
      dashboard1: {
        totalCustomers, perProduct, singleProduct, byProductCount,
        combinations: Object.entries(comboMap).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
          .map(([code, count]) => ({code, count}))
      },
      dashboard2: {
        byYear: yearly,
        byProductRole: [...CODES].map(code => ({code, first: roleFirst[code], additional: roleAdditional[code]})),
        aBSequence: ab
      },
      dashboard3: {
        revenue: revenue.map(row => ({year: row.year, single: row.single / 1e9, multi: row.multi / 1e9})),
        supplementalMoney: Object.fromEntries([...OTHER].map(code => [code, supplementalMoney[code] / 1e6])),
        aSubset: {base: baseA, bought: boughtA, missing: missingA},
        segments: Object.fromEntries(Object.entries(segments).map(([dimension, map]) =>
          [dimension, [...map.values()].sort((a, b) => b.base - a.base || a.label.localeCompare(b.label))]))
      }
    };
  }
  global.CrossFilterEngine = {aggregate, selectedRows, buyingGroup};
})(globalThis);

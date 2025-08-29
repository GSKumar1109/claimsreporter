// ===== Config =====
const NUM_PRODUCTS = 8;
const STORAGE_KEY = "depotSalesManager.v1";

// ✅ Fixed product names (always 8)
const FIXED_PRODUCTS = [
  "MC VSOP",
  "MCB",
  "SSW",
  "KWB",
  "DSPG",
  "MC RUM",
  "GSW",
  "GSB",
];
// ✅ Fixed list of depots in exact order
const DEPOTS = [
  "KNL",
  "NDYL",
  "ATP",
  "CTR-I",
  "CTR-II",
  "CTR-III",
  "CDP-I",
  "PDTR",
  "NLR-I",
  "NLR-II",
  "PKM-I",
  "PKM-II",
  "VZA-I",
  "VZA-II",
  "VZA-III",
  "GNT-I",
  "GNT-II",
  "GNT-III",
  "EG-I",
  "EG-II",
  "EG-III",
  "WG-I",
  "WG-II",
  "WG-III",
  "VSKP-I",
  "VSKP-II",
  "VSKP-III",
  "VZM",
  "SKLM",
];

// ===== State =====
const state = {
  products: Array.from({ length: NUM_PRODUCTS }, (_, i) => `Product ${i + 1}`),
  data: {},
  get currentDepot() {
    return document.getElementById("depotSelect").value;
  },
};

// ===== Utilities =====
const fmt = new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 });
const money = (v) => fmt.format(Math.round(v || 0));
const toNum = (v) => {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : 0;
};
const uid = () => Math.random().toString(36).slice(2, 9);

function productsTotal(arr) {
  return (arr || []).reduce((s, p) => s + toNum(p.cases) * toNum(p.rate), 0);
}

// ===== Product Name Handling =====
let productCount = NUM_PRODUCTS;
let productNames = [...state.products];

function renderProductNames() {
  const grid = document.getElementById("productNameGrid");
  grid.innerHTML = "";
  productNames.forEach((name, i) => {
    const input = document.createElement("input");
    input.value = name;
    input.dataset.index = i;
    input.addEventListener("input", (e) => {
      productNames[i] = e.target.value;
      state.products = [...productNames];
      renderProductInputs();
      render();
    });
    grid.appendChild(input);
  });
}

// ===== Excel Export =====
document
  .getElementById("exportExcelBtn")
  .addEventListener("click", function () {
    const depotSelect = document.getElementById("depotSelect");
    const selectedDepot = depotSelect.value;

    if (!selectedDepot) {
      alert("Please select a depot first.");
      return;
    }
    const table = document.getElementById("dataTable");
    if (!table || table.rows.length === 0) {
      alert("No data found in the table for this depot.");
      return;
    }

    const tableClone = table.cloneNode(true);
    for (let row of tableClone.rows) {
      const lastCell = row.cells[row.cells.length - 1];
      if (lastCell && lastCell.innerText.trim().toLowerCase() === "delete") {
        row.deleteCell(row.cells.length - 1);
      }
    }

    const ws = XLSX.utils.table_to_sheet(tableClone);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, selectedDepot);

    XLSX.writeFile(wb, `${selectedDepot}_data.xlsx`);
  });

// ===== Product Inputs =====
function renderProductInputs() {
  const container = document.getElementById("productInputs");
  container.innerHTML = "";
  productNames.forEach((name, i) => {
    const tpl = document
      .getElementById("productInputTpl")
      .content.cloneNode(true);
    tpl.querySelector("[data-role=label]").textContent = name;
    container.appendChild(tpl);
  });
}

document.getElementById("addProduct").addEventListener("click", () => {
  productCount++;
  productNames.push(`P${productCount}`);
  state.products = [...productNames];
  renderProductNames();
  renderProductInputs();
  render();
});

document.getElementById("removeProduct").addEventListener("click", () => {
  if (productCount > 1) {
    productCount--;
    productNames.pop();
    state.products = [...productNames];
    renderProductNames();
    renderProductInputs();
    render();
  } else {
    alert("At least one product must remain!");
  }
});

// ===== Consolidate Rows =====
function consolidateDepotRows(rows) {
  if (!Array.isArray(rows)) return [];
  const bySyn = new Map();
  for (const r of rows) {
    const syn = (r?.syndicate || "").trim();
    if (!syn) continue;
    const shops = [];
    if (Array.isArray(r.shopIds))
      shops.push(...r.shopIds.map((s) => String(s).trim()).filter(Boolean));
    if (r.shopId) shops.push(String(r.shopId).trim());

    const products = Array.isArray(r.products)
      ? r.products
          .slice(0, productCount)
          .map((p) => ({ cases: toNum(p?.cases), rate: toNum(p?.rate) }))
      : Array.from({ length: productCount }, () => ({ cases: 0, rate: 0 }));

    const existing = bySyn.get(syn);
    if (!existing) {
      bySyn.set(syn, {
        id: r.id || uid(),
        syndicate: syn,
        shopIds: [...new Set(shops)],
        products,
      });
    } else {
      existing.shopIds = [...new Set([...existing.shopIds, ...shops])];
      const tPrev = productsTotal(existing.products);
      const tNew = productsTotal(products);
      if (tNew >= tPrev) existing.products = products;
    }
  }
  return [...bySyn.values()].sort((a, b) =>
    a.syndicate.localeCompare(b.syndicate)
  );
}

// ===== Storage =====
function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed.products) {
        state.products = parsed.products;
        productNames = [...state.products];
        productCount = productNames.length;
      }
      if (parsed.data) {
        state.data = {};
        for (const [depot, rows] of Object.entries(parsed.data)) {
          state.data[depot] = consolidateDepotRows(rows);
        }
        save();
      }
    }
  } catch (e) {
    console.warn("Load failed", e);
  }
}
function save() {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({ products: state.products, data: state.data })
  );
}

// ===== Init Depot Select =====
function initDepotSelect() {
  const sel = document.getElementById("depotSelect");
  sel.innerHTML = "";
  DEPOTS.forEach((dep) => {
    const opt = document.createElement("option");
    opt.value = dep;
    opt.textContent = dep;
    sel.appendChild(opt);
  });
  const last = localStorage.getItem(STORAGE_KEY + ":lastDepot");
  if (last && DEPOTS.includes(last)) sel.value = last;
  else sel.value = DEPOTS[0];
  sel.addEventListener("change", () => {
    localStorage.setItem(STORAGE_KEY + ":lastDepot", sel.value);
    render();
  });
}

function initMonthYear() {
    const yearSel = document.getElementById("yearSelect");
    const monthSel = document.getElementById("monthSelect");
    const now = new Date();
    const thisYear = now.getFullYear();
  
    yearSel.innerHTML = "";
    for (let y = thisYear - 5; y <= thisYear + 2; y++) {
      const opt = document.createElement("option");
      opt.value = y;
      opt.textContent = y;
      yearSel.appendChild(opt);
    }
  
    // ✅ Load from localStorage if available
    const savedMonth = localStorage.getItem("selectedMonth");
    const savedYear = localStorage.getItem("selectedYear");
  
    if (savedMonth) {
      monthSel.value = savedMonth;
    } else {
      monthSel.value = String(now.getMonth() + 1).padStart(2, "0");
    }
  
    if (savedYear) {
      yearSel.value = savedYear;
    } else {
      yearSel.value = thisYear;
    }
  
    // ✅ Save + render when changed
    monthSel.addEventListener("change", () => {
      localStorage.setItem("selectedMonth", monthSel.value);
      render();
    });
    yearSel.addEventListener("change", () => {
      localStorage.setItem("selectedYear", yearSel.value);
      render();
    });
  }  

// ===== Product Names =====
function initProductNames() {
  renderProductNames();
  document.getElementById("saveNames").onclick = () => {
    const inputs = [...document.querySelectorAll("#productNameGrid input")];
    productNames = inputs.map(
      (i, idx) => i.value.trim() || `Product ${idx + 1}`
    );
    state.products = [...productNames];
    save();
    renderProductInputs();
    render();
  };
  document.getElementById("resetNames").onclick = () => {
    state.products = Array.from(
      { length: productCount },
      (_, i) => `Product ${i + 1}`
    );
    productNames = [...state.products];
    save();
    initProductNames();
    renderProductInputs();
    render();
  };
}

// ===== Form =====
function buildFormProducts() {
  const wrap = document.getElementById("productInputs");
  wrap.innerHTML = "";
  for (let i = 0; i < productCount; i++) {
    const tpl = document.getElementById("productInputTpl");
    const node = tpl.content.firstElementChild.cloneNode(true);
    node.querySelector("[data-role=label]").textContent = state.products[i];
    const cases = node.querySelector("[data-role=cases]");
    const rate = node.querySelector("[data-role=rate]");
    const amount = node.querySelector("[data-role=amount]");
    function recalc() {
      amount.value = (toNum(cases.value) * toNum(rate.value)).toFixed(2);
      totalFromForm();
    }    
    cases.addEventListener("input", recalc);
    rate.addEventListener("input", recalc);
    wrap.appendChild(node);
  }
}

function totalFromForm() {
  const productRows = document.querySelectorAll("#productInputs .product-row");
  let sumCases = 0,
    sumAmount = 0;

  productRows.forEach((row) => {
    const casesInput = row.querySelector("[data-role=cases]");
    const rateInput = row.querySelector("[data-role=rate]");
    const amountInput = row.querySelector("[data-role=amount]");

    const cases = toNum(casesInput.value);
    const rate = toNum(rateInput.value);
    const amount = cases * rate;

    amountInput.value = money(amount);

    sumCases += cases;
    sumAmount += amount;
  });

  const perCase = sumCases > 0 ? sumAmount / sumCases : 0;
  document.getElementById(
    "formTotal"
  ).textContent = `Row Total → Cases: ${money(sumCases)} | Per Case: ${money(
    perCase
  )} | Amount: ${money(sumAmount)}`;

  return { cases: sumCases, amount: sumAmount, perCase };
}

function initForm() {
  buildFormProducts();
  const form = document.getElementById("entryForm");
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const syndicate = document.getElementById("syndicate").value.trim();
    const shopIds = document
      .getElementById("shopIds")
      .value.split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    if (!syndicate || shopIds.length === 0)
      return alert("Enter Syndicate and at least one Shop ID");

    const products = [...document.querySelectorAll("#productInputs .card")].map(
      (card) => {
        const cases = toNum(card.querySelector("[data-role=cases]").value);
        const rate = toNum(card.querySelector("[data-role=rate]").value);
        const amount = cases * rate;
        const perCase = cases > 0 ? amount / cases : 0;
        return { cases, rate, amount, perCase };
      }
    );

    const totals = products.reduce(
      (acc, p) => {
        acc.cases += p.cases;
        acc.amount += p.amount;
        return acc;
      },
      { cases: 0, amount: 0 }
    );
    totals.perCase = totals.cases > 0 ? totals.amount / totals.cases : 0;

    const depot = state.currentDepot;
    if (!state.data[depot]) state.data[depot] = [];
    const existing = state.data[depot].find((r) => r.syndicate === syndicate);
    if (existing) {
      existing.shopIds = [...new Set([...existing.shopIds, ...shopIds])];
      existing.products = products;
      existing.totals = totals;
    } else {
      state.data[depot].push({
        id: uid(),
        syndicate,
        shopIds,
        products,
        totals,
      });
    }

    save();
    form.reset();
    buildFormProducts();
    totalFromForm();
    render();
  });
  document.getElementById("clearForm").onclick = () => {
    form.reset();
    buildFormProducts();
    totalFromForm();
  };
}

// ===== Rendering =====
function render() {
  const depot = state.currentDepot;
  const rows = (state.data[depot] || []).slice();
  document.getElementById("rowCount").textContent = `${rows.length} rows`;
  const tbl = document.getElementById("dataTable");
  tbl.innerHTML = "";

  // headers
  const thead = document.createElement("thead");
  const totalCols = 2 + productCount * 3 + 3 + 1;
  // 2 (Syndicate + Shop IDs) + productCount*3 + 3 (Row totals) + 1 (Action)

  // ✅ Heading row 1: Company name
  const trCompany = document.createElement("tr");
  const thCompany = document.createElement("th");
  thCompany.colSpan = totalCols;
  thCompany.textContent = "SRIVEN ENTERPRISES";
  thCompany.style.textAlign = "center";
  thCompany.style.fontSize = "20px";
  thCompany.style.fontWeight = "bold";
  thCompany.style.background = "#e0e0e0";
  trCompany.appendChild(thCompany);
  thead.appendChild(trCompany);

  // ✅ Heading row 2: Report + depot
  const trTitle = document.createElement("tr");
  const thTitle = document.createElement("th");
  thTitle.colSpan = totalCols;

  const month = document.getElementById("monthSelect").value;
const year = document.getElementById("yearSelect").value;
const monthName = new Date(`${year}-${month}-01`).toLocaleString('default', { month: 'long' });

  thTitle.textContent = `Claim Report From — ${depot} for ${monthName} ${year}`;

  thTitle.style.textAlign = "center";
  thTitle.style.fontSize = "16px";
  thTitle.style.background = "#f0f0f0";
  trTitle.appendChild(thTitle);
  thead.appendChild(trTitle);

  // ✅ Existing first row of column headers
  const tr1 = document.createElement("tr");
  tr1.appendChild(
    Object.assign(document.createElement("th"), {
      textContent: "Syndicate",
      style: { minWidth: "160px" },
    })
  );
  tr1.appendChild(
    Object.assign(document.createElement("th"), {
      textContent: "Shop IDs",
      style: { minWidth: "220px" },
    })
  );
  for (let i = 0; i < productCount; i++) {
    const th = document.createElement("th");
    th.colSpan = 3;
    th.textContent = state.products[i];
    tr1.appendChild(th);
  }
  const thRow = document.createElement("th");
  thRow.colSpan = 3;
  thRow.textContent = "Row Totals";
  tr1.appendChild(thRow);
  tr1.appendChild(
    Object.assign(document.createElement("th"), { textContent: "Action" })
  );
  thead.appendChild(tr1);

  // ✅ Existing second row (Cases / Rate / Amount…)
  const tr2 = document.createElement("tr");
  tr2.appendChild(document.createElement("th"));
  tr2.appendChild(document.createElement("th"));
  for (let i = 0; i < productCount; i++) {
    tr2.appendChild(
      Object.assign(document.createElement("th"), { textContent: "Cases" })
    );
    tr2.appendChild(
      Object.assign(document.createElement("th"), { textContent: "Rate" })
    );
    tr2.appendChild(
      Object.assign(document.createElement("th"), { textContent: "Amount" })
    );
  }
  tr2.appendChild(
    Object.assign(document.createElement("th"), { textContent: "Cases" })
  );
  tr2.appendChild(
    Object.assign(document.createElement("th"), { textContent: "Per Case" })
  );
  tr2.appendChild(
    Object.assign(document.createElement("th"), { textContent: "Amount" })
  );
  tr2.appendChild(
    Object.assign(document.createElement("th"), { textContent: "Delete" })
  );
  thead.appendChild(tr2);

  tbl.appendChild(thead);
  const tbody = document.createElement("tbody");
  const depotCases = Array(productCount).fill(0);
  const depotAmounts = Array(productCount).fill(0);
  let depotCasesTotal = 0,
    depotAmountTotal = 0;

  for (const r of rows) {
    const tr = document.createElement("tr");
    tr.appendChild(
      Object.assign(document.createElement("td"), { textContent: r.syndicate })
    );
    tr.appendChild(
      Object.assign(document.createElement("td"), {
        textContent: (r.shopIds || []).join(", "),
      })
    );

    let rowCases = 0,
      rowAmount = 0;

    r.products.forEach((p, i) => {
      const cases = toNum(p.cases);
      const rate = toNum(p.rate);
      const amount = cases * rate;

      depotCases[i] += cases;
      depotAmounts[i] += amount;
      rowCases += cases;
      rowAmount += amount;

      tr.appendChild(
        Object.assign(document.createElement("td"), {
          textContent: money(cases),
        })
      );
      tr.appendChild(
        Object.assign(document.createElement("td"), {
          textContent: money(rate),
        })
      );
      tr.appendChild(
        Object.assign(document.createElement("td"), {
          textContent: money(amount),
        })
      );
    });

    const rowPerCase = rowCases > 0 ? rowAmount / rowCases : 0;
    depotCasesTotal += rowCases;
    depotAmountTotal += rowAmount;

    tr.appendChild(
      Object.assign(document.createElement("td"), {
        innerHTML: `<b>${money(rowCases)}</b>`,
      })
    );
    tr.appendChild(
      Object.assign(document.createElement("td"), {
        innerHTML: `<b>${money(rowPerCase)}</b>`,
      })
    );
    tr.appendChild(
      Object.assign(document.createElement("td"), {
        innerHTML: `<b>${money(rowAmount)}</b>`,
      })
    );

    const tdDelete = document.createElement("td");
    const btn = document.createElement("button");
    btn.textContent = "Delete";
    btn.className = "btn-danger";
    btn.onclick = () => {
      state.data[depot] = state.data[depot].filter((x) => x.id !== r.id);
      save();
      render();
    };
    tdDelete.appendChild(btn);
    tr.appendChild(tdDelete);

    tbody.appendChild(tr);
  }
  tbl.appendChild(tbody);

  const tfoot = document.createElement("tfoot");
  const trF = document.createElement("tr");
  trF.appendChild(
    Object.assign(document.createElement("td"), { textContent: "Depot Total" })
  );
  trF.appendChild(document.createElement("td"));

  depotCases.forEach((cases, i) => {
    const amount = depotAmounts[i];
    const rate = cases > 0 ? amount / cases : 0;
    trF.appendChild(
      Object.assign(document.createElement("td"), {
        innerHTML: `<b>${money(cases)}</b>`,
      })
    );
    trF.appendChild(
      Object.assign(document.createElement("td"), {
        innerHTML: `<b>${money(rate)}</b>`,
      })
    );
    trF.appendChild(
      Object.assign(document.createElement("td"), {
        innerHTML: `<b>${money(amount)}</b>`,
      })
    );
  });

  const depotPerCase =
    depotCasesTotal > 0 ? depotAmountTotal / depotCasesTotal : 0;
  trF.appendChild(
    Object.assign(document.createElement("td"), {
      innerHTML: `<b>${money(depotCasesTotal)}</b>`,
    })
  );
  trF.appendChild(
    Object.assign(document.createElement("td"), {
      innerHTML: `<b>${money(depotPerCase)}</b>`,
    })
  );
  trF.appendChild(
    Object.assign(document.createElement("td"), {
      innerHTML: `<b>${money(depotAmountTotal)}</b>`,
    })
  );

  tfoot.appendChild(trF);
  tbl.appendChild(tfoot);
}

// ===== Export / Import / Clear =====
function initIO() {
  document.getElementById("exportBtn").onclick = () => {
    const depot = state.currentDepot;
    const blob = new Blob(
      [
        JSON.stringify(
          { depot, products: state.products, rows: state.data[depot] || [] },
          null,
          2
        ),
      ],
      { type: "application/json" }
    );
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${depot.replace(/\s+/g, "_")}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };
  document.getElementById("importBtn").onclick = () =>
    document.getElementById("importFile").click();
  document
    .getElementById("importFile")
    .addEventListener("change", async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const text = await file.text();
      try {
        const obj = JSON.parse(text);
        if (!Array.isArray(obj.rows)) throw new Error("Invalid file");
        if (Array.isArray(obj.products)) {
          state.products = obj.products;
          productNames = [...obj.products];
          productCount = productNames.length;
          initProductNames();
          buildFormProducts();
        }
        const depot = state.currentDepot;
        const normalized = obj.rows.map((r) => ({
          id: r.id || uid(),
          syndicate: r.syndicate,
          shopIds: Array.isArray(r.shopIds)
            ? r.shopIds.map((s) => String(s).trim()).filter(Boolean)
            : r.shopId
            ? [String(r.shopId).trim()]
            : [],
          products: (r.products || [])
            .slice(0, productCount)
            .map((p) => ({ cases: toNum(p.cases), rate: toNum(p.rate) })),
        }));
        state.data[depot] = consolidateDepotRows(normalized);
        save();
        render();
        e.target.value = "";
      } catch (err) {
        alert("Import failed: " + err.message);
      }
    });
  document.getElementById("clearDepot").onclick = () => {
    if (confirm("Clear all data for " + state.currentDepot + "?")) {
      state.data[state.currentDepot] = [];
      save();
      render();
    }
  };
}

// ===== Boot =====
load();
initDepotSelect();
initMonthYear();   // ✅ month/year first
initProductNames();
initForm();
initIO();
totalFromForm();
render();

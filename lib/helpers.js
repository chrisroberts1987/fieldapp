export const fmt$ = v =>
"$" + Number(v).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",");

export const fmtDate = d => {
if (!d) return "--";
const [y, m, day] = d.split("-");
return m + "/" + day + "/" + y;
};

export const todayStr = () => new Date().toISOString().slice(0, 10);

export const uid = () => Math.random().toString(36).slice(2, 9);

export const calcEst = est => {
const sub = (est.line_items || []).reduce((s, li) => s + li.qty * li.price, 0);
const disc = est.discount || 0;
const after = sub - disc;
const tax = after * ((est.tax_rate || 0) / 100);
return { sub, disc, tax, total: after + tax };
};

export const IRS_RATE = 0.70;

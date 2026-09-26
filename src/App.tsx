import { useState, useMemo, useEffect } from 'react';
import './App.css';
import { ImmigrationRecord } from './types/immigration';
import { fetchRealEstatData } from './api/estat';
import { calculateCFM } from './utils/simulator';
import {
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  ComposedChart, Area, Line, LineChart
} from 'recharts';
import {
  FileText, Clock, CheckCircle, Calculator, Building2, Loader, CalendarClock,
  Info, TrendingUp, TrendingDown, Layers, Database, BadgeCheck, CalendarCheck,
  ChevronDown, AlertTriangle, BarChart3
} from 'lucide-react';

// ---------- Helpers hiển thị ----------

const fmtNum = (n?: number) => (n ?? 0).toLocaleString('en-US');

const fmtDateVi = (dateStr?: string): string => {
  if (!dateStr) return '';
  const [y, m, d] = dateStr.split('-');
  return `${d}/${m}/${y}`;
};

const fmtMonthVi = (monthStr?: string): string => {
  if (!monthStr) return '';
  const [y, m] = monthStr.split('-');
  return `${m}/${y}`;
};

const WEEKDAYS_VI = ['Chủ nhật', 'Thứ hai', 'Thứ ba', 'Thứ tư', 'Thứ năm', 'Thứ sáu', 'Thứ bảy'];
const weekdayVi = (dateStr?: string): string => {
  if (!dateStr) return '';
  const [y, m, d] = dateStr.split('-').map(Number);
  return WEEKDAYS_VI[new Date(y, m - 1, d).getDay()];
};

const toMonths = (days: number) => (days / 30.44).toFixed(1);

const todayStr = () => {
  const t = new Date();
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
};

const tooltipStyle = {
  background: '#fff',
  border: '1px solid #e2e8f0',
  borderRadius: 12,
  boxShadow: '0 10px 30px rgba(15,23,42,.08)',
  fontSize: 13
};

// Thẻ thống kê
const StatCard = ({
  icon, tone, label, value, delta, invertDelta = false, delay
}: {
  icon: React.ReactNode; tone: string; label: string; value: number;
  delta?: number | null; invertDelta?: boolean | 'neutral'; delay: number;
}) => {
  const hasDelta = typeof delta === 'number' && Number.isFinite(delta) && delta !== 0;
  const up = hasDelta && (delta as number) > 0;
  const cls = invertDelta === 'neutral' ? 'neutral' : (invertDelta ? !up : up) ? 'good' : 'bad';
  return (
    <div className={`card stat-card tone-${tone}`} style={{ animationDelay: `${delay}s` }}>
      <div className="stat-icon">{icon}</div>
      <div className="stat-info">
        <span className="stat-label">{label}</span>
        <span className="stat-value">{fmtNum(value)}</span>
        {hasDelta && (
          <span className={`stat-delta ${cls}`}>
            {up ? <TrendingUp size={13} /> : <TrendingDown size={13} />}
            {up ? '+' : ''}{fmtNum(delta as number)} so với tháng trước
          </span>
        )}
      </div>
    </div>
  );
};

// Một bước trong phần giải thích công thức
const FormulaStep = ({
  n, title, expr, calc, note
}: {
  n: number; title: string; expr: React.ReactNode; calc: React.ReactNode; note?: React.ReactNode;
}) => (
  <div className="f-step">
    <div className="f-num">{n}</div>
    <div className="f-body">
      <div className="f-title">{title}</div>
      <div className="f-expr">{expr}</div>
      <div className="f-calc">{calc}</div>
      {note && <div className="f-note">{note}</div>}
    </div>
  </div>
);

const V = ({ s, sub }: { s: string; sub: string }) => (
  <span className="var">{s}<sub>{sub}</sub></span>
);

function App() {
  const [data, setData] = useState<ImmigrationRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedBureau, setSelectedBureau] = useState('Chi nhánh Yokohama');
  const [selectedType, setSelectedType] = useState('Xin vĩnh trú');
  const [submitDate, setSubmitDate] = useState('2026-03-25');

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        const _appId = import.meta.env.VITE_ESTAT_APP_ID;
        if (!_appId) {
          throw new Error("Không tìm thấy mã VITE_ESTAT_APP_ID trong cấu hình biến môi trường (.env). Vui lòng kiểm tra lại cấu hình ứng dụng.");
        }
        const apiData = await fetchRealEstatData(_appId);
        if (apiData && apiData.length > 0) {
          setData(apiData);
        } else {
          throw new Error("API e-Stat của Chính phủ Nhật Bản trả về kết quả rỗng hoặc không có dữ liệu phù hợp.");
        }
      } catch (e: unknown) {
        console.error("Lỗi nạp dữ liệu API e-Stat:", e);
        setError(e instanceof Error ? e.message : "Không thể kết nối với máy chủ e-Stat chính phủ Nhật Bản. Vui lòng kiểm tra kết nối internet hoặc thử lại sau.");
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  const bureaus = useMemo(() => [...new Set(data.map(d => d.bureau))], [data]);
  const types = useMemo(() => [...new Set(data.map(d => d.type))], [data]);

  const filteredData = useMemo(() => {
    return data.filter(d => d.bureau === selectedBureau && d.type === selectedType);
  }, [data, selectedBureau, selectedType]);

  const latestData = filteredData[filteredData.length - 1] || null;
  const prevData = filteredData[filteredData.length - 2] || null;
  const diff = (k: 'received' | 'processed' | 'pending') =>
    latestData && prevData ? (latestData[k] ?? 0) - (prevData[k] ?? 0) : null;

  const simResult = useMemo(() => calculateCFM(submitDate, filteredData), [submitDate, filteredData]);
  const f = simResult?.formulaDetails;

  // Trạng thái + tiến độ
  const isFuture = submitDate > todayStr();
  const progress = !f ? 0
    : isFuture ? 0
    : f.D_total > 0 ? Math.min(100, Math.max(0, (f.daysWaited / f.D_total) * 100))
    : 100;
  const status = !f ? null
    : isFuture ? { cls: 'future', text: 'Chưa nộp · mô phỏng trước' }
    : f.D_rem === 0 ? { cls: 'done', text: 'Có thể đã đến lượt xử lý' }
    : { cls: 'waiting', text: 'Đang trong hàng đợi' };

  // Các mốc thời gian hiển thị trong thẻ kết quả
  const today = todayStr();
  const milestones = !simResult || !f ? [] : [
    { key: 'submit', date: submitDate, text: 'Nộp hồ sơ', cls: 'past' },
    ...(!simResult.projected && !f.clearedInData && f.anchorDate > submitDate
      ? [{ key: 'anchor', date: f.anchorDate, text: `Hết số liệu thật (còn ${fmtNum(f.Q_pos)} hồ sơ trước bạn)`, cls: 'past' }]
      : []),
    ...(!isFuture ? [{ key: 'today', date: today, text: 'Hôm nay', cls: 'now' }] : []),
    { key: 'done', date: simResult.completionDate ?? '', text: 'Dự kiến có kết quả', cls: 'goal' },
  ].sort((a, b) => a.date.localeCompare(b.date) || (a.key === 'done' ? 1 : -1));

  return (
    <div className="app-container">
      {/* ---------- HERO ---------- */}
      <header className="hero">
        <div className="hero-inner">
          <span className="hero-eyebrow"><Database size={14} /> Dữ liệu chính phủ Nhật · e-Stat 出入国管理統計</span>
          <h1>Japan Immigration <span className="hl">Stats</span></h1>
          <p>Theo dõi tình hình xét duyệt tư cách lưu trú và ước tính ngày có kết quả cho hồ sơ của bạn.</p>
          {latestData && (
            <span className="hero-chip">Số liệu mới nhất: tháng <strong>{fmtMonthVi(latestData.month)}</strong></span>
          )}
        </div>
      </header>

      <main className="main-content">
        {/* ---------- CONTROLS ---------- */}
        <section className="card controls">
          <div className="control-group">
            <label><Building2 size={15} /> Cục lưu trú</label>
            <div className="select-wrap">
              <select value={selectedBureau} onChange={(e) => setSelectedBureau(e.target.value)} className="field">
                {bureaus.map(b => <option key={b} value={b}>{b}</option>)}
              </select>
              <ChevronDown size={16} className="select-caret" />
            </div>
          </div>
          <div className="control-group">
            <label><FileText size={15} /> Loại hồ sơ</label>
            <div className="select-wrap">
              <select value={selectedType} onChange={(e) => setSelectedType(e.target.value)} className="field">
                {types.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
              <ChevronDown size={16} className="select-caret" />
            </div>
          </div>
          <div className="control-group">
            <label><CalendarClock size={15} /> Ngày nộp hồ sơ</label>
            <input type="date" value={submitDate} onChange={e => e.target.value && setSubmitDate(e.target.value)} className="field" />
          </div>
        </section>

        {loading ? (
          <div className="card state-box">
            <Loader className="spin" size={34} />
            <p>Đang nạp dữ liệu từ e-Stat Chính phủ Nhật...</p>
          </div>
        ) : error ? (
          <div className="card state-box error">
            <div className="state-icon"><AlertTriangle size={28} /></div>
            <h3>Không thể nạp dữ liệu từ e-Stat</h3>
            <p>{error}</p>
            <button className="btn-danger" onClick={() => window.location.reload()}>Thử tải lại dữ liệu</button>
          </div>
        ) : (
          <>
            {/* ---------- SIMULATOR ---------- */}
            <section className="sim-grid">
              {/* Kết quả nổi bật */}
              <div className="result-card">
                <div className="result-top">
                  <span className="result-label"><CalendarCheck size={16} /> Ngày dự kiến có kết quả</span>
                  {status && <span className={`status-pill ${status.cls}`}><span className="dot" />{status.text}</span>}
                </div>

                {simResult && f ? (
                  <>
                    <div className="result-date">{fmtDateVi(simResult.completionDate)}</div>
                    <div className="result-sub">
                      {weekdayVi(simResult.completionDate)} · khoảng <strong>{toMonths(f.D_total)} tháng</strong> kể từ ngày nộp
                    </div>

                    <div className="progress">
                      <div className="progress-track">
                        <div className="progress-fill" style={{ width: `${progress}%` }} />
                      </div>
                      <div className="progress-labels">
                        <span>Nộp {fmtDateVi(submitDate)}</span>
                        <span className="progress-pct">{isFuture ? 'Chưa bắt đầu' : `Đã qua ${Math.round(progress)}%`}</span>
                        <span>{fmtDateVi(simResult.completionDate)}</span>
                      </div>
                    </div>

                    <div className="kpi-row">
                      <div className="kpi">
                        <span className="kpi-val">{fmtNum(f.D_total)}<small> ngày</small></span>
                        <span className="kpi-lbl">Tổng thời gian</span>
                      </div>
                      <div className="kpi">
                        <span className="kpi-val">{fmtNum(f.daysWaited)}<small> ngày</small></span>
                        <span className="kpi-lbl">Đã chờ</span>
                      </div>
                      <div className="kpi accent">
                        <span className="kpi-val">{fmtNum(f.D_rem)}<small> ngày</small></span>
                        <span className="kpi-lbl">Còn lại</span>
                      </div>
                    </div>

                    <div className="result-foot">
                      <span><b>{fmtNum(f.Q_pos)}</b> hồ sơ còn đứng trước bạn</span>
                      <span className="sep">·</span>
                      <span>tốc độ <b>{f.R_daily.toFixed(1)}</b> hồ sơ/ngày</span>
                    </div>

                    <ol className="timeline">
                      {milestones.map(m => (
                        <li key={m.key} className={`tl-item ${m.cls}`}>
                          <span className="tl-dot" />
                          <span className="tl-date">{fmtDateVi(m.date)}</span>
                          <span className="tl-text">{m.text}</span>
                        </li>
                      ))}
                    </ol>

                    {simResult.projected && (
                      <div className="result-warn">
                        <Info size={14} /> Tháng nộp chưa có số liệu thật (mới đến {fmtMonthVi(f.lastRealMonth)}), phần này được ngoại suy.
                      </div>
                    )}
                  </>
                ) : (
                  <div className="result-sub">Không đủ dữ liệu để mô phỏng.</div>
                )}
              </div>

              {/* Cách tính */}
              <div className="card formula-card">
                <div className="card-head">
                  <span className="head-icon"><Calculator size={18} /></span>
                  <div>
                    <h2>Cách tính</h2>
                    <span className="card-sub">Mô hình hàng đợi theo thứ tự nộp (FIFO)</span>
                  </div>
                </div>

                {f ? (
                  <div className="f-steps">
                    <FormulaStep
                      n={1}
                      title="Số hồ sơ đứng trước bạn khi nộp"
                      expr={<><V s="C" sub="prev" /> + <V s="N" sub="app" /> − <V s="P" sub="app" /> − <V s="C" sub="proc" /></>}
                      calc={<>{fmtNum(f.C_prev)} + {fmtNum(f.N_app)} − {fmtNum(f.P_app)} − {fmtNum(f.C_proc)} = <b>{fmtNum(Math.max(0, f.Q_app - f.C_proc))}</b></>}
                    />
                    <FormulaStep
                      n={2}
                      title={`Trừ số đã xử lý đến hết ${fmtMonthVi(f.lastRealMonth)}`}
                      expr={<><V s="Q" sub="pos" /> = (<V s="Q" sub="app" /> − <V s="C" sub="proc" />) − <V s="E" sub="proc" /></>}
                      calc={<>{fmtNum(Math.max(0, f.Q_app - f.C_proc))} − {fmtNum(f.E_proc)} = <b>{fmtNum(f.Q_pos)}</b></>}
                      note={f.clearedInData ? 'Theo số liệu thật, các hồ sơ trước bạn đã được xử lý hết.' : undefined}
                    />
                    <FormulaStep
                      n={3}
                      title="Tốc độ xử lý trung bình 6 tháng"
                      expr={<><V s="R" sub="daily" /> = ΣP / ΣD</>}
                      calc={<>{fmtNum(f.sumP)} / {f.sumD} = <b>{f.R_daily.toFixed(2)}</b> hồ sơ/ngày</>}
                    />
                    <FormulaStep
                      n={4}
                      title="Tổng thời gian chờ"
                      expr={<><V s="D" sub="total" /> = <V s="D" sub="elapsed" /> + ⌈<V s="Q" sub="pos" /> / <V s="R" sub="daily" />⌉</>}
                      calc={f.clearedInData
                        ? <><b>{fmtNum(f.D_total)}</b> ngày (xác định từ số liệu thật)</>
                        : <>{fmtNum(f.D_elapsed)} + {fmtNum(f.D_queue)} = <b>{fmtNum(f.D_total)}</b> ngày</>}
                      note={!f.clearedInData ? <>{fmtNum(f.D_queue)} ngày chờ được tính từ mốc {fmtDateVi(f.anchorDate)}</> : undefined}
                    />
                  </div>
                ) : (
                  <p className="muted">Đang tính toán hàng chờ...</p>
                )}

                <details className="glossary">
                  <summary><Info size={14} /> Giải thích ký hiệu</summary>
                  <div className="glossary-grid">
                    <div><b>C<sub>prev</sub></b> Tồn đọng đầu tháng nộp (旧受)</div>
                    <div><b>N<sub>app</sub></b> Tiếp nhận mới trong tháng nộp</div>
                    <div><b>P<sub>app</sub></b> Hồ sơ nộp sau bạn trong tháng nộp</div>
                    <div><b>C<sub>proc</sub></b> Đã xử lý trước khi bạn nộp</div>
                    <div><b>E<sub>proc</sub></b> Đã xử lý sau ngày nộp đến hết tháng có số liệu</div>
                    <div><b>Q<sub>pos</sub></b> Số hồ sơ còn đứng trước bạn</div>
                    <div><b>R<sub>daily</sub></b> Số hồ sơ xử lý trung bình mỗi ngày</div>
                    <div><b>D<sub>rem</sub></b> Số ngày còn lại tính từ hôm nay</div>
                  </div>
                </details>

                <p className="disclaimer">
                  *Số liệu <strong>ước tính</strong>, giả định hồ sơ được xử lý theo thứ tự nộp. Thời gian thực tế có thể khác tuỳ độ phức tạp của từng hồ sơ.
                </p>
              </div>
            </section>

            {/* ---------- STATS ---------- */}
            <div className="section-title">
              <h2>Tình hình tháng {fmtMonthVi(latestData?.month)}</h2>
              <span>{selectedBureau} · {selectedType}</span>
            </div>
            <section className="stats-grid">
              <StatCard delay={0.05} tone="indigo" icon={<Layers size={22} />} label="Tổng thụ lý (tồn cũ + mới)" value={latestData?.totalHandled ?? 0} />
              <StatCard delay={0.1} tone="blue" icon={<FileText size={22} />} label="Tiếp nhận mới" value={latestData?.received ?? 0} delta={diff('received')} invertDelta="neutral" />
              <StatCard delay={0.15} tone="green" icon={<CheckCircle size={22} />} label="Đã xử lý xong" value={latestData?.processed ?? 0} delta={diff('processed')} />
              <StatCard delay={0.2} tone="amber" icon={<Clock size={22} />} label="Tồn đọng cuối tháng" value={latestData?.pending ?? 0} delta={diff('pending')} invertDelta />
            </section>

            {/* ---------- CHARTS ---------- */}
            <section className="charts-grid">
              <div className="card chart-card">
                <div className="card-head">
                  <span className="head-icon amber"><BarChart3 size={18} /></span>
                  <div>
                    <h2>Diễn biến hồ sơ</h2>
                    <span className="card-sub">Tiếp nhận, xử lý và tồn đọng theo tháng</span>
                  </div>
                </div>
                <ResponsiveContainer width="100%" height={330}>
                  <ComposedChart data={filteredData} margin={{ top: 10, right: 8, left: -12, bottom: 0 }}>
                    <defs>
                      <linearGradient id="gPending" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#f59e0b" stopOpacity={0.4} />
                        <stop offset="100%" stopColor="#f59e0b" stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                    <XAxis dataKey="month" tickFormatter={fmtMonthVi} stroke="#94a3b8" tick={{ fontSize: 12 }} tickLine={false} axisLine={false} minTickGap={28} />
                    <YAxis stroke="#94a3b8" tick={{ fontSize: 12 }} tickLine={false} axisLine={false}
                      tickFormatter={(v: number) => v >= 1000 ? `${(v / 1000).toFixed(v >= 10000 ? 0 : 1)}k` : `${v}`} />
                    <Tooltip contentStyle={tooltipStyle} labelFormatter={(l) => `Tháng ${fmtMonthVi(String(l))}`} formatter={(v) => fmtNum(Number(v))} />
                    <Legend iconType="circle" iconSize={9} wrapperStyle={{ fontSize: 13, paddingTop: 8 }} />
                    <Area type="monotone" dataKey="pending" name="Tồn đọng" stroke="#f59e0b" strokeWidth={2} fill="url(#gPending)" />
                    <Line type="monotone" dataKey="received" name="Tiếp nhận" stroke="#3b82f6" strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="processed" name="Đã xử lý" stroke="#10b981" strokeWidth={2} dot={false} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>

              <div className="card chart-card">
                <div className="card-head">
                  <span className="head-icon violet"><BadgeCheck size={18} /></span>
                  <div>
                    <h2>Tỉ lệ được cấp phép</h2>
                    <span className="card-sub">Được cấp / (được cấp + bị từ chối)</span>
                  </div>
                </div>
                <div className="passrate-now">
                  <span className="passrate-val">{latestData?.passRate ?? 0}%</span>
                  <span className="card-sub">tháng {fmtMonthVi(latestData?.month)}</span>
                </div>
                <ResponsiveContainer width="100%" height={240}>
                  <LineChart data={filteredData} margin={{ top: 10, right: 8, left: -16, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                    <XAxis dataKey="month" tickFormatter={fmtMonthVi} stroke="#94a3b8" tick={{ fontSize: 12 }} tickLine={false} axisLine={false} minTickGap={28} />
                    <YAxis stroke="#94a3b8" domain={[0, 100]} tick={{ fontSize: 12 }} tickLine={false} axisLine={false} tickFormatter={(t: number) => `${t}%`} />
                    <Tooltip contentStyle={tooltipStyle} labelFormatter={(l) => `Tháng ${fmtMonthVi(String(l))}`} formatter={(v) => [`${v}%`, 'Tỉ lệ đậu']} />
                    <Line type="monotone" dataKey="passRate" name="Tỉ lệ đậu" stroke="#7c3aed" strokeWidth={2.5} dot={false} activeDot={{ r: 5 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </section>
          </>
        )}
      </main>

      <footer className="footer">
        Nguồn: e-Stat · 出入国管理統計 (bảng 0003449073). Kết quả chỉ mang tính tham khảo.
      </footer>
    </div>
  );
}

export default App;

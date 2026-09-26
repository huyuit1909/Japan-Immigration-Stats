import { useState, useMemo, useEffect } from 'react';
import './App.css';
import { ImmigrationRecord } from './types/immigration';
import { fetchRealEstatData } from './api/estat';
import { calculateCFM } from './utils/simulator';
import { XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, AreaChart, Area, Line, LineChart } from 'recharts';
import { FileText, Clock, CheckCircle, Calculator, Building2, Loader, CalendarClock, Info, TrendingUp } from 'lucide-react';

const Fraction = ({ num, den }: { num: React.ReactNode; den: React.ReactNode }) => (
  <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', verticalAlign: 'middle', padding: '0 6px' }}>
    <div style={{ borderBottom: '1.5px solid rgba(15, 23, 42, 0.85)', paddingBottom: '2px', textAlign: 'center', width: '100%', fontWeight: 600 }}>{num}</div>
    <div style={{ paddingTop: '2px', textAlign: 'center', width: '100%', fontWeight: 600 }}>{den}</div>
  </div>
);

const BracketedFraction = ({ num, den }: { num: React.ReactNode; den: React.ReactNode }) => (
  <div style={{ display: 'inline-flex', alignItems: 'center', verticalAlign: 'middle', color: '#0f172a' }}>
    <span style={{ fontSize: '2.5rem', fontWeight: 200, marginRight: '1px', marginLeft: '1px', transform: 'scaleY(1.3)', display: 'inline-block', color: '#475569' }}>[</span>
    <Fraction num={num} den={den} />
    <span style={{ fontSize: '2.5rem', fontWeight: 200, marginLeft: '1px', marginRight: '1px', transform: 'scaleY(1.3)', display: 'inline-block', color: '#475569' }}>]</span>
  </div>
);

const HorizontalBrace = ({ value }: { value: string | number }) => (
  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%', minWidth: '50px', marginTop: '2px' }}>
    <svg viewBox="0 0 100 10" preserveAspectRatio="none" style={{ width: '100%', height: '8px', color: '#64748b', margin: '2px 0' }}>
      <path
        d="M 0,0 C 15,0 35,2 45,6 C 47,7 48,10 50,10 C 52,10 53,7 55,6 C 65,2 85,0 100,0"
        stroke="currentColor"
        fill="none"
        strokeWidth="1.2"
      />
    </svg>
    <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#334155', marginTop: '1px', fontFamily: 'monospace' }}>{value}</span>
  </div>
);

const formatEnglishDate = (dateStr?: string): string => {
  if (!dateStr) return '';
  const [y, m, d] = dateStr.split('-').map(Number);
  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  return `${months[m - 1]} ${d}, ${y}`;
};

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
      setError(null);
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
      } catch (e: any) {
        console.error("Lỗi nạp dữ liệu API e-Stat:", e);
        setError(e.message || "Không thể kết nối với máy chủ e-Stat chính phủ Nhật Bản. Vui lòng kiểm tra kết nối internet hoặc thử lại sau.");
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  // Filter Data
  const filteredData = useMemo(() => {
    return data.filter(d => d.bureau === selectedBureau && d.type === selectedType);
  }, [data, selectedBureau, selectedType]);

  // Latest Data for Cards
  const latestData = filteredData[filteredData.length - 1] || null;

  // Simulator
  const simResult = useMemo(() => {
    return calculateCFM(submitDate, filteredData);
  }, [submitDate, filteredData]);

  return (
    <div className="app-container animate-fade-in">
      <header className="app-header">
        <div>
          <h1 className="text-gradient-primary">Japan Immigration Stats</h1>
          <p>Trực quan hoá dữ liệu xin và đổi tư cách lưu trú (Nguồn: e-Stat)</p>
        </div>
      </header>

      <main className="main-content">
        {/* Controls Section */}
        <section className="glass-panel controls-section">
          <div className="control-group">
            <label><Building2 size={16} /> Cục lưu trú</label>
            <select 
              value={selectedBureau} 
              onChange={(e) => setSelectedBureau(e.target.value)}
              className="glass-select"
            >
              {[...new Set(data.map(d=>d.bureau))].map(b => <option key={b} value={b}>{b}</option>)}
            </select>
          </div>
          
          <div className="control-group">
            <label><FileText size={16} /> Loại hồ sơ</label>
            <select 
              value={selectedType} 
              onChange={(e) => setSelectedType(e.target.value)}
              className="glass-select"
            >
              {[...new Set(data.map(d=>d.type))].map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
        </section>

        {loading ? (
          <div className="glass-panel" style={{ textAlign: 'center', padding: '4rem 2rem' }}>
            <Loader className="animate-spin" size={32} style={{ margin: '0 auto', color: '#4f46e5' }} />
            <p style={{ marginTop: '1.25rem', fontSize: '1rem', fontWeight: 500, color: 'var(--text-secondary)' }}>Đang nạp dữ liệu từ e-Stat Chính phủ Nhật...</p>
          </div>
        ) : error ? (
          <div className="glass-panel animate-fade-in" style={{ 
            background: 'linear-gradient(135deg, rgba(254, 226, 226, 0.85) 0%, rgba(254, 242, 242, 0.55) 100%)',
            border: '1px solid rgba(239, 68, 68, 0.35)',
            boxShadow: '0 12px 32px 0 rgba(239, 68, 68, 0.05)',
            padding: '3rem 2rem',
            textAlign: 'center',
            borderRadius: '24px',
            maxWidth: '650px',
            margin: '2rem auto',
            backdropFilter: 'blur(10px)',
            WebkitBackdropFilter: 'blur(10px)'
          }}>
            <div style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', width: '56px', height: '56px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.25rem auto' }}>
              <Info size={30} />
            </div>
            <h3 style={{ fontSize: '1.35rem', color: '#991b1b', fontWeight: 700, marginBottom: '0.75rem', fontFamily: '"Outfit", sans-serif' }}>
              Không thể nạp dữ liệu từ e-Stat
            </h3>
            <p style={{ fontSize: '0.95rem', color: '#7f1d1d', lineHeight: 1.6, marginBottom: '1.5rem', fontWeight: 500 }}>
              {error}
            </p>
            <button 
              onClick={() => window.location.reload()}
              style={{
                background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
                color: 'white',
                border: 'none',
                padding: '0.8rem 2rem',
                borderRadius: '12px',
                fontWeight: 600,
                fontSize: '0.925rem',
                cursor: 'pointer',
                boxShadow: '0 4px 14px rgba(239, 68, 68, 0.2)',
                transition: 'transform 0.15s, box-shadow 0.15s'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-1px)';
                e.currentTarget.style.boxShadow = '0 6px 18px rgba(239, 68, 68, 0.3)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 4px 14px rgba(239, 68, 68, 0.2)';
              }}
            >
              Thử tải lại dữ liệu
            </button>
          </div>
        ) : (
          <>
        {/* Stats Section */}
        <section className="stats-grid">
          <div className="glass-panel stat-card" style={{ order: 0 }}>
            <div className="stat-icon bg-blue"><Building2 /></div>
            <div className="stat-info">
              <h3>Đang giải quyết (Tất cả)</h3>
              <p className="stat-value">{latestData?.totalHandled?.toLocaleString() || 0}</p>
            </div>
          </div>
          <div className="glass-panel stat-card" style={{ order: 1 }}>
            <div className="stat-icon bg-blue"><FileText /></div>
            <div className="stat-info">
              <h3>Đã tiếp nhận (Tháng gần nhất)</h3>
              <p className="stat-value">{latestData?.received?.toLocaleString() || 0}</p>
            </div>
          </div>
          <div className="glass-panel stat-card" style={{ order: 2 }}>
            <div className="stat-icon bg-green"><CheckCircle /></div>
            <div className="stat-info">
              <h3>Đã xử lý xong</h3>
              <p className="stat-value">{latestData?.processed?.toLocaleString() || 0}</p>
            </div>
          </div>
          <div className="glass-panel stat-card" style={{ order: 3 }}>
            <div className="stat-icon bg-orange"><Clock /></div>
            <div className="stat-info">
              <h3>Tồn đọng (Cuối tháng)</h3>
              <p className="stat-value">{latestData?.pending?.toLocaleString() || 0}</p>
            </div>
          </div>
        </section>

        {/* Simulator Section */}
        <section className="glass-panel simulator-section" style={{ minHeight: 'auto', paddingBottom: '2.5rem' }}>
          <div className="simulator-header">
            <Calculator />
            <h2>Mô hình Dòng chảy Tích luỹ (Wait Time Simulator)</h2>
            <div className="custom-tooltip">
              <Info size={18} color="var(--text-secondary)" />
              <div className="tooltip-text" style={{ minWidth: '400px' }}>
                <strong style={{ color: 'var(--primary-color)' }}>Công thức Cumulative Flow Model + Phân rã theo Ngày:</strong>
                <ul style={{ paddingLeft: '1rem', marginTop: '0.5rem', marginBottom: '0.5rem', gap: '0.25rem', display: 'flex', flexDirection: 'column' }}>
                  <li><strong>Tồn Đọng (Queue Position):</strong> Thuật toán xác định lượng Tồn đọng (P<sub>0</sub>) ở tại tháng trùng với Ngày nộp.</li>
                  <li><strong>Vòng lặp Bào mòn:</strong> Lượng tồn đọng được trừ lùi dần qua từng tháng kế tiếp theo công thức <code>P_new = P_old - V_i</code> (V<sub>i</sub>: số lượng đã xử lý ở tháng i). Biên chạy liên tục tới khi <code>P_old &lt; V_i</code>.</li>
                  <li><strong>Tỷ lệ Ngày (Fractional Day Margin):</strong> Nếu tháng cuối không ăn nguyên tháng, ngày lẻ được bù bằng biên phân rã: <br/><code>Phần Dư = (P_old_còn_lại / V_tháng_đó) * 30.43 ngày</code></li>
                  <li><strong>Điểm chạm Kết Quả:</strong> Tính bằng <code>Ngày nộp + (Tổng hệ số phân rã phần dư × 30.43 ngày)</code></li>
                </ul>
                <span style={{ color: '#94a3b8' }}>*Giới hạn Tương Lai: Nếu chạm mốc chưa có Data, yếu tố V<sub>i</sub> sẽ được thay thế bằng vận tốc trung bình EMA Forecasted của 12 tháng biểu đồ gần nhất.</span>
              </div>
            </div>
          </div>
          <div className="simulator-content" style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap' }}>
            <div className="sim-input-box" style={{ flex: '1', minWidth: '280px', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-secondary)' }}><CalendarClock size={16} style={{ verticalAlign: 'middle', marginRight: '0.25rem' }}/> Ngày nộp hồ sơ</label>
                <input 
                  type="date" 
                  value={submitDate} 
                  onChange={e => setSubmitDate(e.target.value)} 
                  className="glass-select"
                  style={{ width: '100%', marginBottom: '0.5rem', padding: '1rem' }}
                />
                <p className="sim-note">*Nếu bạn chưa nộp, hãy chọn ngày hôm nay để xem tình trạng hàng chờ của ngày hôm đó.</p>
              </div>


              

            </div>
            
            <div className="sim-formula" style={{ flex: '2', minWidth: '320px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem', marginBottom: 0, padding: 0, background: 'transparent', border: 'none' }}>
              {simResult && simResult.formulaDetails ? (() => {
                const f = simResult.formulaDetails;
                return (
                  <div style={{ 
                    width: '100%',
                    background: 'rgba(255, 255, 255, 0.8)',
                    border: '1px solid var(--glass-border)',
                    boxShadow: '0 12px 40px 0 rgba(31, 38, 135, 0.06)',
                    borderRadius: '24px',
                    padding: '2rem 1.5rem',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '1.5rem',
                    backdropFilter: 'blur(12px)',
                    WebkitBackdropFilter: 'blur(12px)'
                  }}>
                    {/* Ngày dự kiến Header */}
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: '0.5rem', width: '100%' }}>
                      <span style={{ fontSize: '1.65rem', fontWeight: 600, color: '#1e293b', fontFamily: '"Outfit", "Inter", sans-serif', letterSpacing: '-0.02em' }}>
                        Estimated Completion Date
                      </span>
                      <span style={{ 
                        fontSize: '3.2rem', 
                        fontWeight: 800, 
                        lineHeight: 1.1, 
                        background: 'linear-gradient(135deg, #4f46e5 0%, #3b82f6 100%)',
                        WebkitBackgroundClip: 'text',
                        WebkitTextFillColor: 'transparent',
                        fontFamily: '"Outfit", "Inter", sans-serif',
                        margin: '0.25rem 0'
                      }}>
                        {formatEnglishDate(simResult.completionDate)}
                      </span>
                      <span style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: 500, fontStyle: 'italic' }}>
                        (Dự kiến ngày {simResult.completionDate?.split('-').reverse().join('/')})
                      </span>
                    </div>

                    <div style={{ width: '100%', height: '1px', backgroundColor: 'rgba(0,0,0,0.06)' }}></div>

                    {/* Khung công thức toán học */}
                    <div style={{
                      width: '100%',
                      background: 'rgba(248, 250, 252, 0.9)',
                      border: '1px solid rgba(226, 232, 240, 0.8)',
                      borderRadius: '20px',
                      padding: '1.75rem 1.25rem',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '1.25rem',
                      boxShadow: 'inset 0 2px 4px 0 rgba(0, 0, 0, 0.01)',
                      overflowX: 'auto',
                      maxWidth: '100%'
                    }}>
                      {/* Dòng 1: Công thức chính */}
                      <div style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'center', 
                        fontSize: '1.45rem', 
                        color: '#0f172a',
                        gap: '0.6rem', 
                        flexWrap: 'nowrap',
                        fontWeight: 500
                      }}>
                        <span style={{ fontFamily: 'Georgia, serif', fontStyle: 'italic' }}>
                          D<sub style={{ fontSize: '0.6em', bottom: '-0.2em' }}>queue</sub>
                        </span>
                        <span style={{ color: '#64748b' }}>≈</span>
                        <BracketedFraction 
                          num={<span style={{ fontFamily: 'Georgia, serif', fontStyle: 'italic' }}>Q<sub style={{ fontSize: '0.6em', bottom: '-0.2em' }}>pos</sub></span>} 
                          den={<span style={{ fontFamily: 'Georgia, serif', fontStyle: 'italic' }}>R<sub style={{ fontSize: '0.6em', bottom: '-0.2em' }}>daily</sub></span>} 
                        />
                        <span style={{ color: '#64748b' }}>=</span>
                        <BracketedFraction 
                          num={<span>{f.Q_pos}</span>} 
                          den={<span>{f.R_daily}</span>} 
                        />
                        <span style={{ color: '#64748b' }}>≈</span>
                        <span style={{ fontWeight: 700, color: '#3b82f6', fontFamily: 'Georgia, serif' }}>{f.D_queue} d</span>
                      </div>

                      {/* Dòng 1b: D_total = D_elapsed + D_queue */}
                      <div style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'center', 
                        fontSize: '1.25rem', 
                        color: '#334155',
                        gap: '0.5rem', 
                        flexWrap: 'wrap',
                        fontWeight: 500
                      }}>
                        <span style={{ fontFamily: 'Georgia, serif', fontStyle: 'italic' }}>
                          D<sub style={{ fontSize: '0.6em', bottom: '-0.2em' }}>total</sub>
                        </span>
                        <span style={{ color: '#64748b' }}>=</span>
                        {f.clearedInData ? (
                          <span>{f.D_total} d <span style={{ fontSize: '0.85rem', color: '#64748b' }}>(hàng đợi đã hết trong dữ liệu thật)</span></span>
                        ) : (
                          <>
                            <span>{f.D_elapsed} d <span style={{ fontSize: '0.8rem', color: '#64748b' }}>(nộp → {f.anchorDate})</span></span>
                            <span style={{ color: '#64748b' }}>+</span>
                            <span>{f.D_queue} d</span>
                            <span style={{ color: '#64748b' }}>=</span>
                            <span style={{ fontWeight: 700, color: '#3b82f6', fontFamily: 'Georgia, serif' }}>{f.D_total} d</span>
                          </>
                        )}
                      </div>

                      {f.daysWaited > 0 && (
                        <>
                          <div style={{ width: '90%', height: '1px', backgroundColor: 'rgba(0,0,0,0.05)' }}></div>
                          <div style={{ 
                            display: 'flex', 
                            alignItems: 'center', 
                            justifyContent: 'center', 
                            fontSize: '1.25rem', 
                            color: '#334155',
                            gap: '0.5rem', 
                            flexWrap: 'wrap',
                            fontWeight: 500
                          }}>
                            <span style={{ fontFamily: 'Georgia, serif', fontStyle: 'italic' }}>
                              D<sub style={{ fontSize: '0.6em', bottom: '-0.2em' }}>rem</sub>
                            </span>
                            <span style={{ color: '#64748b' }}>=</span>
                            <span style={{ fontFamily: 'Georgia, serif', fontStyle: 'italic' }}>
                              D<sub style={{ fontSize: '0.6em', bottom: '-0.2em' }}>total</sub>
                            </span>
                            <span style={{ color: '#64748b' }}>-</span>
                            <span style={{ color: '#e11d48', fontWeight: 600 }}>{f.daysWaited} d (đã chờ)</span>
                            <span style={{ color: '#64748b' }}>=</span>
                            <span>{f.D_total} - {f.daysWaited}</span>
                            <span style={{ color: '#64748b' }}>≈</span>
                            <span style={{ fontWeight: 700, color: '#10b981', fontFamily: 'Georgia, serif' }}>{f.D_rem} d còn lại</span>
                          </div>
                        </>
                      )}

                      <div style={{ width: '90%', height: '1px', backgroundColor: 'rgba(0,0,0,0.05)' }}></div>

                      {/* Dòng 2: where hệ phương trình */}
                      <div style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'center', 
                        gap: '0.75rem', 
                        width: '100%',
                        fontSize: '1.15rem'
                      }}>
                        <span style={{ fontFamily: 'Georgia, serif', fontStyle: 'italic', color: '#64748b', marginRight: '0.25rem' }}>where</span>
                        
                        {/* Dấu ngoặc nhọn bên trái tự co giãn */}
                        <div style={{ height: '90px', width: '12px', flexShrink: 0 }}>
                          <svg viewBox="0 0 12 100" preserveAspectRatio="none" style={{ width: '12px', height: '100%', color: '#475569' }}>
                            <path d="M 12,0 C 6,0 4,10 4,20 L 4,45 C 4,48 2,50 0,50 C 2,50 4,52 4,55 L 4,80 C 4,90 6,100 12,100" stroke="currentColor" fill="none" strokeWidth="1.2"/>
                          </svg>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', alignItems: 'flex-start' }}>
                          {/* Q_pos */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                            <span style={{ fontFamily: 'Georgia, serif', fontStyle: 'italic' }}>Q<sub style={{ fontSize: '0.6em', bottom: '-0.2em' }}>pos</sub></span>
                            <span style={{ color: '#64748b' }}>≈</span>
                            <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', verticalAlign: 'top' }}>
                              <span style={{ fontFamily: 'Georgia, serif', fontStyle: 'italic' }}>Q<sub style={{ fontSize: '0.6em', bottom: '-0.2em' }}>app</sub></span>
                              <HorizontalBrace value={f.Q_app} />
                            </div>
                            <span style={{ color: '#64748b' }}>-</span>
                            <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', verticalAlign: 'top' }}>
                              <span style={{ fontFamily: 'Georgia, serif', fontStyle: 'italic' }}>C<sub style={{ fontSize: '0.6em', bottom: '-0.2em' }}>proc</sub></span>
                              <HorizontalBrace value={f.C_proc} />
                            </div>
                            <span style={{ color: '#64748b' }}>-</span>
                            <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', verticalAlign: 'top' }}>
                              <span style={{ fontFamily: 'Georgia, serif', fontStyle: 'italic' }}>E<sub style={{ fontSize: '0.6em', bottom: '-0.2em' }}>proc</sub></span>
                              <HorizontalBrace value={f.E_proc} />
                            </div>
                          </div>

                          {/* R_daily */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                            <span style={{ fontFamily: 'Georgia, serif', fontStyle: 'italic' }}>R<sub style={{ fontSize: '0.6em', bottom: '-0.2em' }}>daily</sub></span>
                            <span style={{ color: '#64748b' }}>≈</span>
                            <BracketedFraction 
                              num={<span style={{ fontSize: '0.95rem' }}>∑ P</span>} 
                              den={<span style={{ fontSize: '0.95rem' }}>∑ D</span>} 
                            />
                            <span style={{ color: '#64748b' }}>=</span>
                            <BracketedFraction 
                              num={<span>{f.sumP}</span>} 
                              den={<span>{f.sumD}</span>} 
                            />
                          </div>
                        </div>
                      </div>

                      <div style={{ width: '90%', height: '1px', backgroundColor: 'rgba(0,0,0,0.05)' }}></div>

                      {/* Dòng 3: Q_app */}
                      <div style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'center', 
                        gap: '0.5rem', 
                        width: '100%',
                        fontSize: '1.15rem'
                      }}>
                        <span style={{ fontFamily: 'Georgia, serif', fontStyle: 'italic' }}>Q<sub style={{ fontSize: '0.6em', bottom: '-0.2em' }}>app</sub></span>
                        <span style={{ color: '#64748b' }}>≈</span>
                        <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', verticalAlign: 'top' }}>
                          <span style={{ fontFamily: 'Georgia, serif', fontStyle: 'italic' }}>C<sub style={{ fontSize: '0.6em', bottom: '-0.2em' }}>prev</sub></span>
                          <HorizontalBrace value={f.C_prev} />
                        </div>
                        <span style={{ color: '#64748b' }}>+</span>
                        <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', verticalAlign: 'top' }}>
                          <span style={{ fontFamily: 'Georgia, serif', fontStyle: 'italic' }}>N<sub style={{ fontSize: '0.6em', bottom: '-0.2em' }}>app</sub></span>
                          <HorizontalBrace value={f.N_app} />
                        </div>
                        <span style={{ color: '#64748b' }}>-</span>
                        <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', verticalAlign: 'top' }}>
                          <span style={{ fontFamily: 'Georgia, serif', fontStyle: 'italic' }}>P<sub style={{ fontSize: '0.6em', bottom: '-0.2em' }}>app</sub></span>
                          <HorizontalBrace value={f.P_app} />
                        </div>
                      </div>
                    </div>

                    {/* Dòng thông tin giải thích */}
                    <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '0.4rem', borderTop: '1px solid rgba(0,0,0,0.05)', paddingTop: '1rem' }}>
                      <p style={{ margin: 0, fontSize: '0.85rem', color: '#475569', lineHeight: 1.5, textAlign: 'left' }}>
                        *This is an <strong>estimate</strong> based on current processing rates, expected queue position, and pending applications. Actual processing time for your application may vary.
                      </p>
                      <p style={{ margin: 0, fontSize: '0.8rem', color: '#64748b', lineHeight: 1.5, textAlign: 'left', fontStyle: 'italic' }}>
                        *Đây là số liệu <strong>ước tính</strong> dựa trên tốc độ xử lý hiện tại, vị trí hàng đợi thực tế và số lượng hồ sơ đang tồn đọng. Thời gian thẩm định hồ sơ thực tế của bạn có thể thay đổi.
                      </p>
                    </div>

                    {/* Chú giải các ký hiệu ký tự toán học */}
                    <details style={{ width: '100%', cursor: 'pointer', textAlign: 'left' }}>
                      <summary style={{ fontSize: '0.85rem', fontWeight: 600, color: '#4f46e5', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                        <Info size={14} /> Giải thích các ký hiệu công thức
                      </summary>
                      <div style={{ 
                        marginTop: '0.5rem', 
                        padding: '0.75rem', 
                        background: 'rgba(0,0,0,0.02)', 
                        borderRadius: '12px', 
                        fontSize: '0.8rem', 
                        color: '#334155',
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                        gap: '0.5rem 1rem'
                      }}>
                         <div><strong>D<sub>total</sub></strong>: Tổng số ngày chờ kể từ ngày nộp.</div>
                         <div><strong>D<sub>queue</sub></strong>: Số ngày để xử lý hết Q<sub>pos</sub>, tính từ mốc {f.anchorDate}.</div>
                         <div><strong>D<sub>rem</sub></strong>: Số ngày chờ còn lại dự kiến kể từ hôm nay.</div>
                         <div><strong>Q<sub>pos</sub></strong>: Số hồ sơ còn đứng trước bạn tại mốc {f.anchorDate} (hết dữ liệu thật tháng {f.lastRealMonth}).</div>
                        <div><strong>Q<sub>app</sub></strong>: Tổng hồ sơ cần xử lý tại tháng nộp.</div>
                        <div><strong>C<sub>prev</sub></strong>: Hồ sơ tồn đọng đầu tháng nộp (旧受).</div>
                        <div><strong>N<sub>app</sub></strong>: Hồ sơ tiếp nhận mới trong tháng nộp.</div>
                        <div><strong>P<sub>app</sub></strong>: Hồ sơ nộp sau bạn trong tháng nộp.</div>
                        <div><strong>C<sub>proc</sub></strong>: Hồ sơ đã xử lý trước khi bạn nộp.</div>
                        <div><strong>E<sub>proc</sub></strong>: Hồ sơ đã xử lý sau ngày nộp đến hết tháng dữ liệu thật cuối.</div>
                        <div><strong>∑ P / ∑ D</strong>: Tổng số hồ sơ xử lý / số ngày (6 tháng).</div>
                      </div>
                    </details>
                  </div>
                );
              })() : (
                <span style={{ color: 'var(--text-secondary)' }}>Đang tính toán hàng chờ...</span>
              )}
            </div>
          </div>
        </section>

            {/* Charts Section */}
            <section className="glass-panel chart-section">
              <h2>Biểu đồ diễn biến</h2>
              <div className="chart-wrapper">
                <ResponsiveContainer width="100%" height={350}>
                  <AreaChart data={filteredData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorPending" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.8}/>
                        <stop offset="95%" stopColor="#f59e0b" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                    <XAxis dataKey="month" stroke="#94a3b8" />
                    <YAxis stroke="#94a3b8" />
                    <Tooltip 
                      contentStyle={{ backgroundColor: 'var(--glass-bg)', border: '1px solid var(--glass-border)', borderRadius: '8px', color: 'var(--text-primary)' }}
                      labelStyle={{ color: 'var(--text-primary)', fontWeight: 'bold' }}
                    />
                    <Legend />
                    <Area type="monotone" dataKey="pending" name="Tồn đọng" stroke="#f59e0b" fillOpacity={1} fill="url(#colorPending)" />
                    <Line type="monotone" dataKey="received" name="Tiếp nhận" stroke="#3b82f6" strokeWidth={2} />
                    <Line type="monotone" dataKey="processed" name="Đã xử lý" stroke="#10b981" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
                <div className="chart-wrapper glass-panel" style={{ padding: '0', overflow: 'hidden' }}>
              <div style={{ padding: '1.5rem', borderBottom: '1px solid var(--glass-border)', background: 'linear-gradient(to right, rgba(255, 255, 255, 0.9), rgba(255, 255, 255, 0.4))' }}>
                <h3 style={{ margin: 0, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <TrendingUp size={20} color="var(--accent-color)"/> Tỉ lệ được cấp phép (Pass Rate)
                </h3>
              </div>
              <div style={{ padding: '1.5rem' }}>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={filteredData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.2)" vertical={false} />
                    <XAxis dataKey="month" stroke="#94a3b8" />
                    <YAxis stroke="#94a3b8" domain={[0, 100]} tickFormatter={(tick) => `${tick}%`} />
                    <Tooltip 
                      contentStyle={{ backgroundColor: 'var(--glass-bg)', border: '1px solid var(--glass-border)', borderRadius: '8px', color: 'var(--text-primary)' }}
                      labelStyle={{ color: 'var(--text-primary)', fontWeight: 'bold' }}
                      formatter={(value: string | number | boolean | null | undefined | readonly (string | number)[]) => [
                        typeof value === 'number' || typeof value === 'string' ? `${value}%` : '',
                        'Tỉ lệ đậu'
                      ]}
                    />
                    <Legend />
                    <Line type="monotone" dataKey="passRate" name="Tỉ lệ đậu" stroke="var(--accent-color)" strokeWidth={3} dot={{ r: 4, strokeWidth: 2, fill: "var(--bg-color)" }} activeDot={{ r: 6 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
            </section>
          </>
        )}
      </main>


    </div>
  );
}

export default App;

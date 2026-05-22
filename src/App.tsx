import { useState, useMemo, useEffect } from 'react';
import './App.css';
import { MOCK_DATA, ImmigrationRecord } from './data/mock';
import { fetchRealEstatData } from './api/estat';
import { calculateCFM } from './utils/simulator';
import { XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, AreaChart, Area, Line, LineChart } from 'recharts';
import { FileText, Clock, CheckCircle, Calculator, Building2, Loader, CalendarClock, Info, TrendingUp } from 'lucide-react';

function App() {
  const [data, setData] = useState<ImmigrationRecord[]>(MOCK_DATA);
  const [loading, setLoading] = useState(true);
  const [selectedBureau, setSelectedBureau] = useState('Chi nhánh Yokohama');
  const [selectedType, setSelectedType] = useState('Xin vĩnh trú');
  const [submitDate, setSubmitDate] = useState('2026-03-25');



  useEffect(() => {
    const loadData = async () => {
      try {
        const _appId = import.meta.env.VITE_ESTAT_APP_ID;
        if (_appId) {
          const apiData = await fetchRealEstatData(_appId);
          if (apiData && apiData.length > 0) setData(apiData);
        }
      } catch (e) {
        console.error("Dùng mock data do nạp data thật thất bại", e);
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
          <div className="glass-panel" style={{ textAlign: 'center', padding: '3rem' }}>
            <Loader className="animate-spin" size={32} style={{ margin: '0 auto', color: '#3b82f6' }} />
            <p style={{ marginTop: '1rem' }}>Đang nạp dữ liệu từ e-Stat Chính phủ Nhật...</p>
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
            
            <div className="sim-formula" style={{ flex: '2', minWidth: '320px', display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '0.5rem', marginBottom: 0, padding: 0, background: 'transparent', border: 'none' }}>
              {simResult ? (
                <div style={{ 
                  width: '100%',
                  background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.95) 0%, rgba(255, 255, 255, 0.6) 100%)',
                  border: '1px solid var(--glass-border)',
                  boxShadow: '0 12px 32px 0 rgba(31, 38, 135, 0.1)',
                  borderRadius: '20px',
                  padding: '1.5rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '1.25rem',
                  backdropFilter: 'blur(8px)'
                }}>
                  {/* Ngày dự kiến Header */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid rgba(0,0,0,0.05)', paddingBottom: '1rem' }}>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                       <span style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 600 }}>📅 Trả kết quả dự kiến vào</span>
                       <span className="text-gradient-primary" style={{ fontSize: '3rem', fontWeight: 800, lineHeight: 1.1, marginTop: '0.25rem' }}>
                         {simResult.completionDate?.split('-').reverse().join('/')}
                       </span>
                    </div>
                    <div style={{ background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.1), rgba(139, 92, 246, 0.1))', padding: '1rem', borderRadius: '50%' }}>
                      <CalendarClock size={40} color="url(#colorPending)" style={{ stroke: 'var(--primary-color)' }} />
                    </div>
                  </div>

                  {/* Dòng thời gian lộ trình dự kiến */}
                  <div style={{ 
                    background: 'rgba(255, 255, 255, 0.55)', 
                    border: '1px solid rgba(255, 255, 255, 0.8)', 
                    padding: '1.25rem 1rem', 
                    borderRadius: '16px', 
                    position: 'relative'
                  }}>
                    <p style={{ margin: '0 0 1rem 0', fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      📍 Lộ trình dự kiến của hồ sơ
                    </p>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', position: 'relative', minHeight: '80px' }}>
                      {/* Đường nối */}
                      <div style={{ 
                        position: 'absolute', 
                        top: '16px', 
                        left: '12%', 
                        right: '12%', 
                        height: '4px', 
                        background: 'linear-gradient(90deg, #3b82f6 0%, #7c3aed 50%, #10b981 100%)', 
                        borderRadius: '2px', 
                        zIndex: 0 
                      }}></div>
                      
                      {/* Step 1: Nộp */}
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', zIndex: 1, flex: 1, textAlign: 'center' }}>
                        <div style={{ 
                          width: '32px', 
                          height: '32px', 
                          borderRadius: '50%', 
                          background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)', 
                          color: 'white', 
                          display: 'flex', 
                          alignItems: 'center', 
                          justifyContent: 'center', 
                          fontWeight: 'bold', 
                          fontSize: '0.875rem',
                          boxShadow: '0 0 12px rgba(59, 130, 246, 0.4)'
                        }}>1</div>
                        <span style={{ fontSize: '0.75rem', fontWeight: 700, marginTop: '0.5rem', color: 'var(--text-primary)' }}>Nộp hồ sơ</span>
                        <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginTop: '0.1rem', fontWeight: 500 }}>
                          {simResult.submitDate?.split('-').reverse().join('/')}
                        </span>
                      </div>

                      {/* Step 2: Thẩm tra */}
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', zIndex: 1, flex: 1, textAlign: 'center' }}>
                        <div style={{ 
                          width: '32px', 
                          height: '32px', 
                          borderRadius: '50%', 
                          background: 'linear-gradient(135deg, #7c3aed, #6366f1)', 
                          color: 'white', 
                          display: 'flex', 
                          alignItems: 'center', 
                          justifyContent: 'center', 
                          fontWeight: 'bold', 
                          fontSize: '0.875rem',
                          boxShadow: '0 0 12px rgba(124, 58, 237, 0.4)'
                        }}>2</div>
                        <span style={{ fontSize: '0.75rem', fontWeight: 700, marginTop: '0.5rem', color: 'var(--text-primary)' }}>Được thẩm tra</span>
                        <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginTop: '0.1rem', fontWeight: 500 }}>
                          {simResult.vettingStartDate?.split('-').reverse().join('/')}
                        </span>
                      </div>

                      {/* Step 3: Kết quả */}
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', zIndex: 1, flex: 1, textAlign: 'center' }}>
                        <div style={{ 
                          width: '32px', 
                          height: '32px', 
                          borderRadius: '50%', 
                          background: 'linear-gradient(135deg, #10b981, #059669)', 
                          color: 'white', 
                          display: 'flex', 
                          alignItems: 'center', 
                          justifyContent: 'center', 
                          fontWeight: 'bold', 
                          fontSize: '0.875rem',
                          boxShadow: '0 0 12px rgba(16, 185, 129, 0.4)'
                        }}>3</div>
                        <span style={{ fontSize: '0.75rem', fontWeight: 700, marginTop: '0.5rem', color: 'var(--text-primary)' }}>Có kết quả</span>
                        <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginTop: '0.1rem', fontWeight: 500 }}>
                          {simResult.completionDate?.split('-').reverse().join('/')}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Inner Stats Grid */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '0.75rem' }}>
                    <div style={{ background: 'rgba(255, 255, 255, 0.7)', border: '1px solid rgba(255,255,255,0.9)', padding: '0.75rem 1rem', borderRadius: '12px', display: 'flex', flexDirection: 'column' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600 }}><Clock size={12}/> Tổng thời gian chờ</span>
                      <span style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)', marginTop: '0.25rem' }}>{simResult.waitDays.toLocaleString()} ngày</span>
                    </div>
                    <div style={{ background: 'rgba(255, 255, 255, 0.7)', border: '1px solid rgba(255,255,255,0.9)', padding: '0.75rem 1rem', borderRadius: '12px', display: 'flex', flexDirection: 'column' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600 }}><CalendarClock size={12}/> Chờ trong hàng đợi</span>
                      <span style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)', marginTop: '0.25rem' }}>{simResult.queueWaitDays.toLocaleString()} ngày</span>
                    </div>
                    <div style={{ background: 'rgba(255, 255, 255, 0.7)', border: '1px solid rgba(255,255,255,0.9)', padding: '0.75rem 1rem', borderRadius: '12px', display: 'flex', flexDirection: 'column' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600 }}><Clock size={12}/> Thời gian thẩm tra</span>
                      <span style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)', marginTop: '0.25rem' }}>{simResult.activeVettingDays.toLocaleString()} ngày</span>
                    </div>
                    <div style={{ background: 'rgba(255, 255, 255, 0.7)', border: '1px solid rgba(255,255,255,0.9)', padding: '0.75rem 1rem', borderRadius: '12px', display: 'flex', flexDirection: 'column' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600 }}><Building2 size={12}/> Hồ sơ tồn đọng</span>
                      <span style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)', marginTop: '0.25rem' }}>{simResult.positionDetails.startingBacklog.toLocaleString()}</span>
                    </div>
                  </div>



                  {/* Badges */}
                  <div style={{ marginTop: '0.25rem' }}>
                    {simResult.projected && <span className="sim-note" style={{ color: '#d97706', display: 'flex', alignItems: 'center', gap: '4px', background: 'rgba(217, 119, 6, 0.1)', padding: '0.5rem 0.75rem', borderRadius: '8px', fontWeight: 500 }}><Info size={14} style={{flexShrink: 0}}/> Số liệu ước tính chứa Forecast dựa trên tốc độ xử lý 12 tháng gần nhất.</span>}
                    {!simResult.projected && simResult.waitDays > 0 && <span className="sim-note" style={{ color: '#059669', display: 'flex', alignItems: 'center', gap: '4px', background: 'rgba(5, 150, 105, 0.1)', padding: '0.5rem 0.75rem', borderRadius: '8px', fontWeight: 500 }}><CheckCircle size={14} style={{flexShrink: 0}}/> Bám sát 100% lịch sử xử lý hồ sơ thực tế của Cục tại thời điểm nộp.</span>}
                  </div>
                </div>
              ) : (
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

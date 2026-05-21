import { useState, useMemo, useEffect } from 'react';
import './App.css';
import { MOCK_DATA, ImmigrationRecord } from './data/mock';
import { fetchRealEstatData } from './api/estat';
import { calculateCFM } from './utils/simulator';
import { calculatePersonalProfile, PersonalProfile, AIPrediction } from './utils/aiPredictor';
import { calculateHSPPoints, HSPCriteria } from './utils/hspCalculator';
import { XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, AreaChart, Area, Line, LineChart } from 'recharts';
import { FileText, Clock, CheckCircle, Calculator, Building2, Loader, CalendarClock, Info, TrendingUp, X } from 'lucide-react';

function App() {
  const [data, setData] = useState<ImmigrationRecord[]>(MOCK_DATA);
  const [loading, setLoading] = useState(true);
  const [selectedBureau, setSelectedBureau] = useState('Chi nhánh Yokohama');
  const [selectedType, setSelectedType] = useState('Xin vĩnh trú');
  const [submitDate, setSubmitDate] = useState('2026-03-25');

  // AI Predictor State
  const [showAIPredictor, setShowAIPredictor] = useState(false);
  const [profile, setProfile] = useState<PersonalProfile>({ visaRoute: 'regular', yearsInJapan: 10, income: 400, taxPensionClean: true, criminalRecord: false });
  const [prediction, setPrediction] = useState<AIPrediction | null>(null);

  const [hspCriteria, setHspCriteria] = useState<HSPCriteria>({
    academic: 'bachelor',
    experienceYears: 5,
    age: 28,
    annualIncome: 500,
    japanese: 'none',
    japanUniGraduate: false,
    topUni: false,
    dualDegree: false,
    itCert: 'disabled',
    govSupportCompany: false
  });

  // Calculate explicit HSP points whenever criteria or main income changes
  useEffect(() => {
    const freshCriteria = { ...hspCriteria, annualIncome: profile.income };
    const calculatedPoints = calculateHSPPoints(freshCriteria);
    if (profile.hspPoints !== calculatedPoints) {
      setProfile(p => ({ ...p, hspPoints: calculatedPoints }));
    }
  }, [hspCriteria, profile.income, profile.hspPoints]);

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

  const handlePredictorSubmit = () => {
    setShowAIPredictor(false);
  };

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

  // Update Prediction when Simulation changes
  useEffect(() => {
    if (simResult && profile) {
      const basePass = simResult.projected ? 60 : 75; // Default base rates if real data is not enough
      const latestPassRate = filteredData.length > 0 && filteredData[filteredData.length - 1].passRate ? filteredData[filteredData.length - 1].passRate : basePass;
      setPrediction(calculatePersonalProfile(profile, latestPassRate as number));
    }
  }, [simResult, profile, filteredData]);

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
              
              <div style={{ display: 'flex', marginTop: '1.5rem' }}>
                <button 
                  onClick={() => setShowAIPredictor(true)}
                  style={{ 
                    background: 'linear-gradient(135deg, #6366f1, #a855f7, #ec4899)', 
                    color: 'white', 
                    border: 'none', 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center',
                    gap: '0.5rem',
                    padding: '0.75rem 1.25rem',
                    borderRadius: '999px',
                    fontSize: '0.95rem',
                    fontWeight: 700,
                    boxShadow: '0 8px 20px rgba(168, 85, 247, 0.3), inset 0 2px 4px rgba(255, 255, 255, 0.3)',
                    cursor: 'pointer',
                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                    WebkitFontSmoothing: 'antialiased',
                    width: '100%'
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 12px 24px rgba(168, 85, 247, 0.4), inset 0 2px 4px rgba(255, 255, 255, 0.4)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 8px 20px rgba(168, 85, 247, 0.3), inset 0 2px 4px rgba(255, 255, 255, 0.3)'; }}
                >
                  <Calculator size={18}/> Phân tích Đặc Quyền Vĩnh Trú (AI)
                </button>
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

                  {/* Inner Stats Grid */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                    <div style={{ background: 'rgba(255, 255, 255, 0.7)', border: '1px solid rgba(255,255,255,0.9)', padding: '1rem', borderRadius: '12px' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.875rem', color: 'var(--text-secondary)', fontWeight: 500 }}><Clock size={14}/> Thời gian chờ xử lý ròng</span>
                      <span style={{ display: 'block', fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-primary)', marginTop: '0.4rem' }}>{simResult.waitDays.toLocaleString()} ngày</span>
                    </div>
                    <div style={{ background: 'rgba(255, 255, 255, 0.7)', border: '1px solid rgba(255,255,255,0.9)', padding: '1rem', borderRadius: '12px' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.875rem', color: 'var(--text-secondary)', fontWeight: 500 }}><Building2 size={14}/> Số hồ sơ tồn đọng trước bạn</span>
                      <span style={{ display: 'block', fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-primary)', marginTop: '0.4rem' }}>{simResult.positionDetails.startingBacklog.toLocaleString()}</span>
                    </div>
                  </div>

                  {/* AI Prediction Notice */}
                  {prediction && (
                    <div style={{ background: 'rgba(255,255,255,0.8)', padding: '1rem', borderRadius: '12px', borderLeft: '4px solid var(--accent-color)' }}>
                      <p style={{ margin: 0, fontSize: '0.875rem', fontWeight: 600, color: 'var(--accent-color)', marginBottom: '0.5rem' }}>🤖 Tiên đoán Cá nhân hóa (AI Predictor)</p>
                      <ul style={{ margin: 0, paddingLeft: '1.25rem', fontSize: '0.875rem', color: 'var(--text-primary)' }}>
                        {prediction.reasons.map((r, i) => <li key={i} style={{ marginBottom: '0.25rem' }}>{r}</li>)}
                      </ul>
                      <div style={{ marginTop: '0.75rem', display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                        <span style={{ background: 'rgba(139, 92, 246, 0.1)', padding: '0.5rem 1rem', borderRadius: '8px', fontWeight: 700, color: 'var(--accent-color)' }}>Tỉ lệ đậu của riêng bạn: {prediction.passRate}%</span>
                        
                        {(() => {
                           const adjustedDays = Math.round(simResult.waitDays * prediction.waitDaysMultiplier);
                           const d = new Date(submitDate); 
                           d.setDate(d.getDate() + adjustedDays);
                           const dString = String(d.getDate()).padStart(2, '0') + '/' + String(d.getMonth() + 1).padStart(2, '0') + '/' + d.getFullYear();
                           return (
                             <>
                               <span style={{ background: 'rgba(5, 150, 105, 0.1)', padding: '0.5rem 1rem', borderRadius: '8px', fontWeight: 700, color: 'var(--success)' }}>
                                 Mức chờ cá nhân: {adjustedDays.toLocaleString()} ngày
                               </span>
                               <span style={{ background: 'rgba(236, 72, 153, 0.1)', padding: '0.5rem 1rem', borderRadius: '8px', fontWeight: 800, color: '#ec4899', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                 ⭐ Chạm tay vào thẻ ngày: {dString}
                               </span>
                             </>
                           );
                        })()}
                      </div>
                    </div>
                  )}

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
                      formatter={(value: any) => [`${value}%`, 'Tỉ lệ đậu']}
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

      {/* AI Predictor Modal */}
      {showAIPredictor && (
        <div className="modal-overlay" onClick={() => setShowAIPredictor(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
               <h2>🤖 Thẩm Phán Đặc Nhiệm AI</h2>
               <button onClick={() => setShowAIPredictor(false)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}><X/></button>
            </div>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem', fontSize: '0.875rem' }}>Hãy nhập hồ sơ của bạn, hệ thống sẽ chập số liệu thực tế tại cục để tiên đoán Tỷ lệ đậu & Fast-track của bạn.</p>
            
            <div className="form-group">
              <label>Loại Hồ Sơ Xin Vĩnh Trú</label>
              <div className="pill-group">
                <button className={`pill-btn ${profile.visaRoute === 'regular' ? 'active' : ''}`} onClick={() => setProfile({...profile, visaRoute: 'regular'})}>Thường (Chưa đủ điểm)</button>
                <button className={`pill-btn ${profile.visaRoute === 'hsp' ? 'active' : ''}`} onClick={() => setProfile({...profile, visaRoute: 'hsp'})}>Nhân lực Chất lượng cao (HSP 70+)</button>
                <button className={`pill-btn ${profile.visaRoute === 'spouse' ? 'active' : ''}`} onClick={() => setProfile({...profile, visaRoute: 'spouse'})}>Vợ/chồng người Nhật</button>
              </div>
            </div>

            <div className="form-group">
              <label>Thu nhập hằng năm (Năm gần nhất): <span style={{color: 'var(--primary-color)'}}>{profile.income} man</span></label>
              <input type="range" min="200" max="1200" step="50" value={profile.income} onChange={(e) => setProfile({...profile, income: parseInt(e.target.value)})} style={{ width: '100%' }} />
            </div>

            <div className="form-group">
              <label>Tuổi hiện tại: <span style={{color: 'var(--primary-color)'}}>{hspCriteria.age} tuổi</span></label>
              <input type="range" min="20" max="55" step="1" value={hspCriteria.age} onChange={(e) => setHspCriteria({...hspCriteria, age: parseInt(e.target.value)})} style={{ width: '100%' }} />
            </div>

            <div className="form-group" style={{ marginBottom: '1.5rem' }}>
              <label>Số năm CƯ TRÚ (sống) liên tục tại Nhật: <span style={{color: 'var(--primary-color)'}}>{profile.yearsInJapan} năm</span></label>
              <input type="range" min="0" max="15" value={profile.yearsInJapan} onChange={(e) => {
                setProfile({...profile, yearsInJapan: parseInt(e.target.value)});
              }} style={{ width: '100%' }} />
              <p className="sim-note" style={{ marginTop: '0.25rem' }}>*Dùng làm căn cứ chung duyệt các loại Vĩnh Trú (Luật: Cần 10 năm bám trụ nếu nộp diện Thường).</p>
            </div>

            {profile.visaRoute === 'hsp' && (
              <div style={{ background: 'linear-gradient(to right, rgba(59, 130, 246, 0.05), rgba(139, 92, 246, 0.05))', padding: '1.5rem', borderRadius: '16px', border: '1px solid rgba(59, 130, 246, 0.2)', marginBottom: '1.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                  <h3 style={{ margin: 0, fontSize: '1rem', color: 'var(--primary-color)' }}>Bảng Tính Điểm Bộ Tư Pháp (Tự động)</h3>
                  <div style={{ background: profile.hspPoints && profile.hspPoints >= 80 ? 'var(--success)' : profile.hspPoints && profile.hspPoints >= 70 ? '#f59e0b' : 'var(--text-secondary)', color: 'white', padding: '0.25rem 1rem', borderRadius: '999px', fontWeight: 800, fontSize: '1.25rem' }}>
                    {profile.hspPoints} Điểm
                  </div>
                </div>

                <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                  <label style={{ fontSize: '0.875rem' }}>Kinh nghiệm Làm việc CHUYÊN MÔN: <span style={{color: 'var(--primary-color)', fontWeight: 800}}>{hspCriteria.experienceYears} năm</span></label>
                  <input type="range" min="0" max="15" value={hspCriteria.experienceYears} onChange={(e) => setHspCriteria({...hspCriteria, experienceYears: parseInt(e.target.value)})} style={{ width: '100%' }} />
                  <p className="sim-note" style={{ fontSize: '0.75rem', marginTop: '0.25rem' }}>*Khác với số năm cư trú. Đây là thời gian thực tế đi làm đúng chuyên ngành (Không tính thời gian đi học).</p>
                </div>

                <div className="form-group" style={{ marginBottom: '1rem' }}>
                  <label style={{ fontSize: '0.875rem' }}>Học vị</label>
                  <div className="pill-group">
                    <button className={`pill-btn ${hspCriteria.academic === 'doctor' ? 'active' : ''}`} style={{ fontSize: '0.875rem', padding: '0.25rem 0.75rem' }} onClick={() => setHspCriteria({...hspCriteria, academic: 'doctor'})}>Tiến sĩ (+30)</button>
                    <button className={`pill-btn ${hspCriteria.academic === 'master' ? 'active' : ''}`} style={{ fontSize: '0.875rem', padding: '0.25rem 0.75rem' }} onClick={() => setHspCriteria({...hspCriteria, academic: 'master'})}>Thạc sĩ (+20)</button>
                    <button className={`pill-btn ${hspCriteria.academic === 'bachelor' ? 'active' : ''}`} style={{ fontSize: '0.875rem', padding: '0.25rem 0.75rem' }} onClick={() => setHspCriteria({...hspCriteria, academic: 'bachelor'})}>Cử nhân (+10)</button>
                    <button className={`pill-btn ${hspCriteria.academic === 'none' ? 'active' : ''}`} style={{ fontSize: '0.875rem', padding: '0.25rem 0.75rem' }} onClick={() => setHspCriteria({...hspCriteria, academic: 'none'})}>Khác</button>
                  </div>
                </div>

                <div className="form-group" style={{ marginBottom: '1rem' }}>
                  <label style={{ fontSize: '0.875rem' }}>Chứng chỉ Tiếng Nhật</label>
                  <div className="pill-group">
                    <button className={`pill-btn ${hspCriteria.japanese === 'n1' ? 'active' : ''}`} style={{ fontSize: '0.875rem', padding: '0.25rem 0.75rem' }} onClick={() => setHspCriteria({...hspCriteria, japanese: 'n1'})}>N1 (+15)</button>
                    <button className={`pill-btn ${hspCriteria.japanese === 'n2' ? 'active' : ''}`} style={{ fontSize: '0.875rem', padding: '0.25rem 0.75rem' }} onClick={() => setHspCriteria({...hspCriteria, japanese: 'n2'})}>N2 (+10)</button>
                    <button className={`pill-btn ${hspCriteria.japanese === 'none' ? 'active' : ''}`} style={{ fontSize: '0.875rem', padding: '0.25rem 0.75rem' }} onClick={() => setHspCriteria({...hspCriteria, japanese: 'none'})}>Chưa có</button>
                  </div>
                </div>

                <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                  <label style={{ fontSize: '0.875rem' }}>Các điểm thưởng Bổ sung (MOJ Bonus)</label>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '0.5rem', marginTop: '0.5rem' }}>
                    
                    <label style={{ fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'rgba(255,255,255,0.6)', padding: '0.5rem', borderRadius: '8px', border: '1px solid rgba(0,0,0,0.05)' }}>
                      <input type="checkbox" checked={hspCriteria.japanUniGraduate} onChange={(e) => setHspCriteria({...hspCriteria, japanUniGraduate: e.target.checked})} style={{ width: '16px', height: '16px' }}/>
                      Tốt nghiệp ĐH tại Nhật Bản (+10đ)
                    </label>

                    <label style={{ fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'rgba(255,255,255,0.6)', padding: '0.5rem', borderRadius: '8px', border: '1px solid rgba(0,0,0,0.05)' }}>
                      <input type="checkbox" checked={hspCriteria.topUni} onChange={(e) => setHspCriteria({...hspCriteria, topUni: e.target.checked})} style={{ width: '16px', height: '16px' }}/>
                      TN Trường Top 300 TG / ĐH Chỉ định (+10đ)
                    </label>

                    <label style={{ fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'rgba(255,255,255,0.6)', padding: '0.5rem', borderRadius: '8px', border: '1px solid rgba(0,0,0,0.05)' }}>
                      <input type="checkbox" checked={hspCriteria.dualDegree} onChange={(e) => setHspCriteria({...hspCriteria, dualDegree: e.target.checked})} style={{ width: '16px', height: '16px' }}/>
                      Có bằng Kép (Nhiều Thạc sĩ/Tiến sĩ) (+5đ)
                    </label>

                    <label style={{ fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'rgba(255,255,255,0.6)', padding: '0.5rem', borderRadius: '8px', border: '1px solid rgba(0,0,0,0.05)' }}>
                      <input type="checkbox" checked={hspCriteria.govSupportCompany} onChange={(e) => setHspCriteria({...hspCriteria, govSupportCompany: e.target.checked})} style={{ width: '16px', height: '16px' }}/>
                      Cty thuộc D/án Sáng tạo chính phủ (+10đ)
                    </label>

                  </div>
                </div>

                <div className="form-group" style={{ marginBottom: '0' }}>
                  <label style={{ fontSize: '0.875rem' }}>Chứng chỉ IT (FE, AP...)</label>
                  <div className="pill-group">
                    <button className={`pill-btn ${hspCriteria.itCert === 'disabled' ? 'active' : ''}`} style={{ fontSize: '0.875rem', padding: '0.25rem 0.75rem' }} onClick={() => setHspCriteria({...hspCriteria, itCert: 'disabled'})}>Không có</button>
                    <button className={`pill-btn ${hspCriteria.itCert === 'basic' ? 'active' : ''}`} style={{ fontSize: '0.875rem', padding: '0.25rem 0.75rem' }} onClick={() => setHspCriteria({...hspCriteria, itCert: 'basic'})}>Pass 1 Chứng chỉ (+5đ)</button>
                    <button className={`pill-btn ${hspCriteria.itCert === 'advanced' ? 'active' : ''}`} style={{ fontSize: '0.875rem', padding: '0.25rem 0.75rem' }} onClick={() => setHspCriteria({...hspCriteria, itCert: 'advanced'})}>Nhiều chứng chỉ/Cấp cao (+10đ)</button>
                  </div>
                </div>

              </div>
            )}

            <div className="form-group">
              <label>Đóng thuế, Nenkin đầy đủ hạn 100%?</label>
              <div className="pill-group">
                <button className={`pill-btn ${profile.taxPensionClean ? 'active' : ''}`} onClick={() => setProfile({...profile, taxPensionClean: true})}>Chuẩn 100%</button>
                <button className={`pill-btn ${!profile.taxPensionClean ? 'active' : ''}`} onClick={() => setProfile({...profile, taxPensionClean: false})}>Có nợ / trễ hạn / quên</button>
              </div>
            </div>

            <div className="form-group">
              <label>Tiền sự giao thông (Vé đỏ) / Hình sự?</label>
              <div className="pill-group">
                <button className={`pill-btn ${!profile.criminalRecord ? 'active' : ''}`} onClick={() => setProfile({...profile, criminalRecord: false})}>Trong sạch</button>
                <button className={`pill-btn ${profile.criminalRecord ? 'active' : ''}`} onClick={() => setProfile({...profile, criminalRecord: true})}>Đã từng bị phạt nặng</button>
              </div>
            </div>

            <button onClick={handlePredictorSubmit} style={{ width: '100%', padding: '1rem', background: 'var(--primary-color)', color: 'white', border: 'none', borderRadius: '12px', fontSize: '1rem', fontWeight: 600, marginTop: '1rem', cursor: 'pointer' }}>
              Xem kết quả Mô Phỏng Vĩnh Trú
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;

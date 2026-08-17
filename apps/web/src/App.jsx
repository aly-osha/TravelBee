import React, { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import { 
  Map, Users, MessageSquare, ShieldAlert, Zap, LogOut, 
  MapPin, Star, Send, Shield, AlertTriangle, CheckCircle, 
  Trash2, UserCheck, AlertOctagon, UserPlus, Heart, Info, RefreshCw, Upload
} from 'lucide-react';

const API_URL = 'http://localhost:5000';
const SOCKET_URL = 'http://localhost:5001';

export default function App() {
  // Session States
  const [token, setToken] = useState(localStorage.getItem('tb_token') || '');
  const [user, setUser] = useState(JSON.parse(localStorage.getItem('tb_user')) || null);
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authName, setAuthName] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);
  const [loginError, setLoginError] = useState('');
  
  // Navigation
  const [activeTab, setActiveTab] = useState('map'); // map, social, chat, security, attackLab
  
  // App Feature States
  const [places, setPlaces] = useState([]);
  const [nearbyTravelers, setNearbyTravelers] = useState([]);
  const [suggestedTravelers, setSuggestedTravelers] = useState([]);
  const [activeChatUser, setActiveChatUser] = useState(null);
  const [messages, setMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [userStatuses, setUserStatuses] = useState({});
  const [followedUsers, setFollowedUsers] = useState(new Set());
  
  // Submit Location Form
  const [newPlaceName, setNewPlaceName] = useState('');
  const [newPlaceDesc, setNewPlaceDesc] = useState('');
  const [newPlaceCat, setNewPlaceCat] = useState('Hidden Spot');
  
  // Security Console States
  const [securityLogs, setSecurityLogs] = useState([]);
  const [securityMetrics, setSecurityMetrics] = useState({
    failedLogins: 0,
    blockedAccounts: 0,
    suspiciousRequests: 0,
    apiRateLimitEvents: 0,
    fileScanFailures: 0,
    blockedIps: 0
  });
  const [manualIpToBlock, setManualIpToBlock] = useState('');
  const [blockStatusMsg, setBlockStatusMsg] = useState('');

  // Attack Lab Simulator Logs
  const [attackLogs, setAttackLogs] = useState([]);
  const [isAttacking, setIsAttacking] = useState(false);
  
  // Socket.IO Ref
  const socketRef = useRef(null);

  // Fetch foundational info when logged in
  useEffect(() => {
    if (token) {
      fetchPlaces();
      fetchSocialData();
      
      if (user?.role === 'Security Analyst' || user?.role === 'Super Admin') {
        fetchSecurityDashboard();
      }

      // Initialize Socket.IO connection
      socketRef.current = io(SOCKET_URL, {
        auth: { token }
      });

      socketRef.current.on('connect', () => {
        console.log('Realtime Connected');
      });

      socketRef.current.on('private_message', (msg) => {
        // If the message is related to currently open chat window
        setMessages((prev) => {
          // Prevent duplicates
          if (prev.find(m => m.id === msg.id)) return prev;
          return [...prev, msg];
        });
      });

      socketRef.current.on('user_status', ({ userId, status }) => {
        setUserStatuses(prev => ({ ...prev, [userId]: status }));
      });

      socketRef.current.on('connect_error', (err) => {
        console.error('Socket connection error:', err.message);
      });

      return () => {
        if (socketRef.current) {
          socketRef.current.disconnect();
        }
      };
    }
  }, [token]);

  // Periodically update logs for Security Analyst
  useEffect(() => {
    let interval;
    if (token && (user?.role === 'Security Analyst' || user?.role === 'Super Admin')) {
      interval = setInterval(() => {
        fetchSecurityDashboard();
      }, 4000);
    }
    return () => clearInterval(interval);
  }, [token, user]);

  const fetchPlaces = async () => {
    try {
      const coords = user?.location ? `?lat=${user.location.lat}&lng=${user.location.lng}` : '';
      const res = await fetch(`${API_URL}/api/places${coords}`);
      const data = await res.json();
      if (Array.isArray(data)) setPlaces(data);
    } catch (e) {
      console.error(e);
    }
  };

  const fetchSocialData = async () => {
    try {
      const headers = { 'Authorization': `Bearer ${token}` };
      
      const nearbyRes = await fetch(`${API_URL}/api/users/nearby`, { headers });
      const nearbyData = await nearbyRes.json();
      if (Array.isArray(nearbyData)) setNearbyTravelers(nearbyData);

      const suggestedRes = await fetch(`${API_URL}/api/users/suggested`, { headers });
      const suggestedData = await suggestedRes.json();
      if (Array.isArray(suggestedData)) setSuggestedTravelers(suggestedData);
    } catch (e) {
      console.error(e);
    }
  };

  const fetchSecurityDashboard = async () => {
    try {
      const headers = { 'Authorization': `Bearer ${token}` };
      
      const logsRes = await fetch(`${API_URL}/api/security/logs`, { headers });
      const logs = await logsRes.json();
      if (Array.isArray(logs)) setSecurityLogs(logs);

      const metricsRes = await fetch(`${API_URL}/api/security/metrics`, { headers });
      const metrics = await metricsRes.json();
      if (metrics && !metrics.error) setSecurityMetrics(metrics);
    } catch (e) {
      console.error(e);
    }
  };

  // Auth Operations
  const handleLogin = async (e) => {
    e.preventDefault();
    setLoginError('');
    try {
      const res = await fetch(`${API_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: authEmail, password: authPassword })
      });
      const data = await res.json();
      
      if (!res.ok) {
        setLoginError(data.error || 'Authentication failed');
        return;
      }

      localStorage.setItem('tb_token', data.token);
      localStorage.setItem('tb_user', JSON.stringify(data.user));
      setToken(data.token);
      setUser(data.user);
      setAuthPassword('');
    } catch (err) {
      setLoginError('Could not connect to API server.');
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setLoginError('');
    try {
      // Mock latitude/longitude for traveler coordinates
      const mockLat = (12.9 + Math.random() * 0.1).toFixed(4);
      const mockLng = (77.5 + Math.random() * 0.1).toFixed(4);

      const res = await fetch(`${API_URL}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          name: authName, 
          email: authEmail, 
          password: authPassword,
          lat: mockLat,
          lng: mockLng
        })
      });
      const data = await res.json();

      if (!res.ok) {
        setLoginError(data.error || 'Registration failed');
        return;
      }

      localStorage.setItem('tb_token', data.token);
      localStorage.setItem('tb_user', JSON.stringify(data.user));
      setToken(data.token);
      setUser(data.user);
      setAuthPassword('');
      setAuthName('');
    } catch (err) {
      setLoginError('Could not connect to API server.');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('tb_token');
    localStorage.removeItem('tb_user');
    setToken('');
    setUser(null);
    setActiveChatUser(null);
    setMessages([]);
  };

  const detectLiveLocation = () => {
    if (!navigator.geolocation) {
      alert('Geolocation is not supported by your browser.');
      return;
    }
    navigator.geolocation.getCurrentPosition(async (position) => {
      const { latitude, longitude } = position.coords;
      try {
        const res = await fetch(`${API_URL}/api/users/location`, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ lat: latitude, lng: longitude })
         });
         if (res.ok) {
           const data = await res.json();
           const updatedUser = { ...user, location: data.location };
           setUser(updatedUser);
           localStorage.setItem('tb_user', JSON.stringify(updatedUser));
           alert(`Live Location Detected! Coordinates updated to: ${latitude.toFixed(4)}, ${longitude.toFixed(4)}`);
           fetchPlaces();
           fetchSocialData();
         }
      } catch (err) {
        alert('Failed to update location on the server.');
      }
    }, (err) => {
      alert(`Geolocation failed: ${err.message}. Try reloading or enabling browser permission.`);
    });
  };

  // Submit discovery spot
  const handleSubmitPlace = async (e) => {
    e.preventDefault();
    if (!newPlaceName || !newPlaceDesc) return;

    try {
      // Pick coordinates near traveler
      const userLat = user?.location?.lat || 12.9716;
      const userLng = user?.location?.lng || 77.5946;
      const offsetLat = (Math.random() - 0.5) * 0.02;
      const offsetLng = (Math.random() - 0.5) * 0.02;

      const res = await fetch(`${API_URL}/api/places`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          name: newPlaceName,
          category: newPlaceCat,
          description: newPlaceDesc,
          lat: userLat + offsetLat,
          lng: userLng + offsetLng
        })
      });

      if (res.ok) {
        setNewPlaceName('');
        setNewPlaceDesc('');
        alert('Discovery spot submitted! Awaiting Moderator approval.');
        fetchPlaces();
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Social actions
  const handleFollowUser = async (targetId) => {
    try {
      const res = await fetch(`${API_URL}/api/users/follow/${targetId}`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setFollowedUsers(prev => {
          const next = new Set(prev);
          if (data.following) next.add(targetId);
          else next.delete(targetId);
          return next;
        });
        fetchSocialData();
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Open chat room
  const openChatWith = async (targetUser) => {
    setActiveChatUser(targetUser);
    setActiveTab('chat');
    try {
      const res = await fetch(`${API_URL}/api/users/messages/${targetUser.id}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (Array.isArray(data)) setMessages(data);
    } catch (e) {
      console.error(e);
    }
  };

  // Send messaging bubble
  const handleSendMessage = (e, placeShare = null) => {
    if (e) e.preventDefault();
    if (!chatInput && !placeShare) return;

    if (socketRef.current && activeChatUser) {
      socketRef.current.emit('private_message', {
        receiverId: activeChatUser.id,
        content: chatInput,
        placeShare
      });
      setChatInput('');
    }
  };

  // Security Analyst manual blacklist
  const handleBlockIp = async (block = true) => {
    if (!manualIpToBlock) return;
    setBlockStatusMsg('');
    try {
      const res = await fetch(`${API_URL}/api/security/block-ip`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ ip: manualIpToBlock, block })
      });
      const data = await res.json();
      setBlockStatusMsg(data.message || data.error);
      fetchSecurityDashboard();
      setManualIpToBlock('');
    } catch (e) {
      console.error(e);
    }
  };

  const resetSecuritySimulator = async () => {
    try {
      const res = await fetch(`${API_URL}/api/security/reset`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        alert('Simulator state, blocked IPs and log buffers reset successfully!');
        fetchSecurityDashboard();
        setAttackLogs([]);
      }
    } catch (e) {
      console.error(e);
    }
  };

  // ==========================================
  // ATTACK LAB SIMULATOR (Demonstrations Panel)
  // ==========================================
  const runSimulatedAttack = async (attackType) => {
    setIsAttacking(true);
    const logs = [`[SIMULATOR] Launching ${attackType} Attack Simulation...`];
    setAttackLogs(logs);

    const appendLog = (str) => {
      logs.push(str);
      setAttackLogs([...logs]);
    };

    try {
      if (attackType === 'Brute Force Login') {
        appendLog(`[Attacker] Triggering 10 fast sequential login attempts with invalid keys...`);
        let rateLimited = false;
        
        for (let i = 1; i <= 10; i++) {
          appendLog(`[Request ${i}] POST /api/auth/login (Payload: attacker@travelbee.com)`);
          const res = await fetch(`${API_URL}/api/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: 'attacker@travelbee.com', password: `wrong-pass-${i}` })
          });
          
          appendLog(`[Response ${i}] Status Code: ${res.status}`);
          if (res.status === 429) {
            rateLimited = true;
            appendLog(`🚨 [Mitigation Verified] HTTP 429 Too Many Requests received. Rate Limiter triggered!`);
            break;
          } else if (res.status === 403) {
            appendLog(`🚨 [Mitigation Verified] HTTP 403 Account Locked. Brute-Force lockout triggered!`);
            break;
          }
          // tiny delay
          await new Promise(r => setTimeout(r, 100));
        }
        
        if (!rateLimited) {
          appendLog(`⚠️ [Simulation Done] Requests finished. Review server logs for account lockout states.`);
        }

      } else if (attackType === 'NoSQL Injection') {
        appendLog(`[Attacker] Query payload: { email: { "$ne": "" }, password: "wrong" }`);
        appendLog(`[Request] POST /api/auth/login`);
        
        const res = await fetch(`${API_URL}/api/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            email: { "$ne": "" }, 
            password: "wrong" 
          })
        });

        appendLog(`[Response] Status Code: ${res.status}`);
        const data = await res.json();
        appendLog(`[Response Payload] ${JSON.stringify(data)}`);
        
        if (res.status === 401 || res.status === 400) {
          appendLog(`🚨 [Mitigation Verified] Injection attempt sanitized by security middleware. User authentication failed securely (no login bypass).`);
        } else {
          appendLog(`❌ [Simulation Warning] Unexpected status: ${res.status}`);
        }

      } else if (attackType === 'Insecure Direct Object Reference (IDOR)') {
        appendLog(`[Attacker] Logged in as: ${user.email}`);
        appendLog(`[Attacker] Fetching messaging records between user-traveler-2 and user-traveler-3 (Neither is me)...`);
        appendLog(`[Request] GET /api/users/idor-test/messages?senderId=user-traveler-2&receiverId=user-traveler-3`);

        const res = await fetch(`${API_URL}/api/users/idor-test/messages?senderId=user-traveler-2&receiverId=user-traveler-3`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });

        appendLog(`[Response] Status Code: ${res.status}`);
        const data = await res.json();
        appendLog(`[Response Payload] ${JSON.stringify(data)}`);

        if (res.status === 403) {
          appendLog(`🚨 [Mitigation Verified] HTTP 403 Forbidden. Ownership validator blocked unauthorized object reference!`);
        } else {
          appendLog(`❌ [Simulation Warning] IDOR Guard bypassed. Unexpected status: ${res.status}`);
        }

      } else if (attackType === 'Malicious File Upload') {
        appendLog(`[Attacker] Uploading file "webshell.png" with PHP system execution headers...`);
        appendLog(`[Request] POST /api/upload`);

        const formData = new FormData();
        // Create a blob representing a polyglot file: has PNG extension but php code in content
        const maliciousBlob = new Blob(['PNG89a... <?php system($_GET["cmd"]); ?>'], { type: 'image/png' });
        formData.append('file', maliciousBlob, 'webshell.png');

        const res = await fetch(`${API_URL}/api/upload`, {
          method: 'POST',
          body: formData
        });

        appendLog(`[Response] Status Code: ${res.status}`);
        const data = await res.json();
        appendLog(`[Response Payload] ${JSON.stringify(data)}`);

        if (res.status === 400) {
          appendLog(`🚨 [Mitigation Verified] HTTP 400 Bad Request. Malware scanner flagged injected script signatures! File quarantined.`);
        } else {
          appendLog(`❌ [Simulation Warning] File accepted. Unexpected status: ${res.status}`);
        }

      } else if (attackType === 'Privilege Escalation') {
        appendLog(`[Attacker] Current role: ${user.role}`);
        appendLog(`[Attacker] Traveler attempts to fetch superadmin accounts list...`);
        appendLog(`[Request] GET /api/admin/users`);

        const res = await fetch(`${API_URL}/api/admin/users`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });

        appendLog(`[Response] Status Code: ${res.status}`);
        const data = await res.json();
        appendLog(`[Response Payload] ${JSON.stringify(data)}`);

        if (res.status === 403) {
          appendLog(`🚨 [Mitigation Verified] HTTP 403 Access Forbidden. Whitelisted RBAC array validation successfully blocked traveler role!`);
        } else {
          appendLog(`❌ [Simulation Warning] Access granted. Unexpected status: ${res.status}`);
        }

      } else if (attackType === 'API Flooding (DoS)') {
        appendLog(`[Attacker] Dispatching 25 quick search requests to /api/places...`);
        let rateLimited = false;

        for (let i = 1; i <= 25; i++) {
          const res = await fetch(`${API_URL}/api/places`);
          if (res.status === 429) {
            rateLimited = true;
            appendLog(`[Request ${i}] HTTP 429 Too Many Requests received.`);
            appendLog(`🚨 [Mitigation Verified] Global rate limiter intercepted flooding requests.`);
            break;
          } else {
            appendLog(`[Request ${i}] Passed.`);
          }
        }

        if (!rateLimited) {
          appendLog(`⚠️ [Simulation Done] Flooding completed without trigger. Adjust server limit thresholds.`);
        }
      }
    } catch (err) {
      appendLog(`❌ [Simulation Error] Failed: ${err.message}`);
    } finally {
      setIsAttacking(false);
      fetchSecurityDashboard();
    }
  };

  // If not logged in, render auth card
  if (!token || !user) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        background: 'radial-gradient(circle at center, #1b1b22 0%, #0a0a0c 100%)',
        padding: '1rem'
      }}>
        <div className="card" style={{ width: '400px', boxShadow: 'var(--shadow-lg)', border: '1px solid var(--border-color)' }}>
          <div className="logo-container" style={{ justifyContent: 'center' }}>
            <span style={{ fontSize: '2rem' }}>🐝</span>
            <span className="logo-text" style={{ fontSize: '2rem' }}>Travel Bee 2.0</span>
          </div>
          
          <h2 style={{ textAlign: 'center', marginBottom: '1.5rem', fontWeight: 600 }}>
            {isRegistering ? 'Create Traveler Account' : 'Security Portal Sign-In'}
          </h2>

          {loginError && (
            <div className="alert-banner danger" style={{ padding: '0.75rem' }}>
              <AlertOctagon size={18} />
              <span style={{ fontSize: '0.85rem' }}>{loginError}</span>
            </div>
          )}

          <form onSubmit={isRegistering ? handleRegister : handleLogin}>
            {isRegistering && (
              <div className="input-group">
                <label className="input-label">Full Name</label>
                <input 
                  type="text" 
                  className="input-field" 
                  value={authName} 
                  onChange={e => setAuthName(e.target.value)} 
                  required 
                />
              </div>
            )}

            <div className="input-group">
              <label className="input-label">Email Address</label>
              <input 
                type="email" 
                className="input-field" 
                placeholder="e.g. rahul@travelbee.com"
                value={authEmail} 
                onChange={e => setAuthEmail(e.target.value)} 
                required 
              />
            </div>

            <div className="input-group" style={{ marginBottom: '2rem' }}>
              <label className="input-label">Password</label>
              <input 
                type="password" 
                className="input-field" 
                placeholder="e.g. password123"
                value={authPassword} 
                onChange={e => setAuthPassword(e.target.value)} 
                required 
              />
            </div>

            <button type="submit" className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }}>
              {isRegistering ? <UserPlus size={18} /> : <UserCheck size={18} />}
              {isRegistering ? 'Register as Traveler' : 'Authenticate Session'}
            </button>
          </form>

          <div style={{ marginTop: '1.5rem', textAlign: 'center', fontSize: '0.85rem' }}>
            <span style={{ color: 'var(--text-secondary)' }}>
              {isRegistering ? 'Already have an account?' : 'Need to join?'}
            </span>{' '}
            <button 
              className="btn btn-secondary" 
              style={{ padding: '0.2rem 0.6rem', fontSize: '0.85rem' }} 
              onClick={() => {
                setIsRegistering(!isRegistering);
                setLoginError('');
              }}
            >
              {isRegistering ? 'Sign In' : 'Sign Up'}
            </button>
          </div>

          <div style={{ marginTop: '1.5rem', borderTop: '1px solid var(--border-color)', paddingTop: '1rem' }}>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textAlign: 'center', marginBottom: '0.5rem' }}>
              🔬 Test Accounts & Security Roles
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', fontSize: '0.75rem' }}>
              <div 
                style={{ background: 'var(--bg-tertiary)', padding: '0.4rem', borderRadius: '4px', cursor: 'pointer', border: '1px solid var(--border-color)' }}
                onClick={() => { setAuthEmail('rahul@travelbee.com'); setAuthPassword('password123'); setIsRegistering(false); }}
              >
                💛 Traveler: <br/>rahul@travelbee.com (pass123)
              </div>
              <div 
                style={{ background: 'var(--bg-tertiary)', padding: '0.4rem', borderRadius: '4px', cursor: 'pointer', border: '1px solid var(--border-color)' }}
                onClick={() => { setAuthEmail('security@travelbee.com'); setAuthPassword('securitypass'); setIsRegistering(false); }}
              >
                🛡️ Sec Analyst: <br/>security@travelbee.com
              </div>
              <div 
                style={{ background: 'var(--bg-tertiary)', padding: '0.4rem', borderRadius: '4px', cursor: 'pointer', border: '1px solid var(--border-color)' }}
                onClick={() => { setAuthEmail('moderator@travelbee.com'); setAuthPassword('moderatorpass'); setIsRegistering(false); }}
              >
                ⚖️ Moderator: <br/>moderator@travelbee.com
              </div>
              <div 
                style={{ background: 'var(--bg-tertiary)', padding: '0.4rem', borderRadius: '4px', cursor: 'pointer', border: '1px solid var(--border-color)' }}
                onClick={() => { setAuthEmail('admin@travelbee.com'); setAuthPassword('adminpass'); setIsRegistering(false); }}
              >
                🚨 Super Admin: <br/>admin@travelbee.com
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Dashboard Sidebar Role Classification
  const getRoleBadgeClass = () => {
    if (user.role === 'Security Analyst') return 'badge-role analyst';
    if (user.role === 'Moderator') return 'badge-role moderator';
    if (user.role === 'Super Admin') return 'badge-role admin';
    return 'badge-role';
  };

  return (
    <div className="app-container">
      {/* Sidebar Navigation */}
      <nav className="sidebar">
        <div>
          <div className="logo-container">
            <span style={{ fontSize: '1.8rem' }}>🐝</span>
            <span className="logo-text">Travel Bee 2.0</span>
          </div>

          <ul className="nav-links">
            <li 
              className={`nav-item ${activeTab === 'map' ? 'active' : ''}`}
              onClick={() => { setActiveTab('map'); fetchPlaces(); }}
            >
              <Map size={20} />
              Discovery Map
            </li>
            
            <li 
              className={`nav-item ${activeTab === 'social' ? 'active' : ''}`}
              onClick={() => { setActiveTab('social'); fetchSocialData(); }}
            >
              <Users size={20} />
              Suggested Users
            </li>
            
            <li 
              className={`nav-item ${activeTab === 'chat' ? 'active' : ''}`}
              onClick={() => setActiveTab('chat')}
            >
              <MessageSquare size={20} />
              Traveler Chat
            </li>
            
            {(user.role === 'Security Analyst' || user.role === 'Super Admin') && (
              <li 
                className={`nav-item ${activeTab === 'security' ? 'active' : ''}`}
                onClick={() => { setActiveTab('security'); fetchSecurityDashboard(); }}
              >
                <ShieldAlert size={20} />
                Security Dashboard
              </li>
            )}
            
            <li 
              className={`nav-item ${activeTab === 'attackLab' ? 'active' : ''}`}
              onClick={() => setActiveTab('attackLab')}
            >
              <Zap size={20} />
              Attack Lab
            </li>
          </ul>
        </div>

        {/* User badge */}
        <div className="user-profile-badge">
          <div className="avatar">
            {user.name.charAt(0)}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h4 style={{ fontSize: '0.9rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {user.name}
            </h4>
            <div style={{ display: 'flex', gap: '0.25rem', flexDirection: 'column' }}>
              <span className={getRoleBadgeClass()} style={{ alignSelf: 'flex-start' }}>
                {user.role}
              </span>
            </div>
          </div>
          <button onClick={handleLogout} className="btn" style={{ padding: '0.4rem', color: 'var(--text-muted)' }}>
            <LogOut size={16} />
          </button>
        </div>
      </nav>

      {/* Main Content Workspace */}
      <main className="main-content">
        <header className="top-bar">
          <div className="page-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            {activeTab === 'map' && <span>🗺️ Location Discovery Hub</span>}
            {activeTab === 'social' && <span>👥 Suggested travelers & Recommendations</span>}
            {activeTab === 'chat' && <span>💬 Secure messaging feeds</span>}
            {activeTab === 'security' && <span>🛡️ SOC Security Monitor</span>}
            {activeTab === 'attackLab' && <span>🔬 Cyber security Attack Demonstration Lab</span>}
          </div>

          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
            {user.location && (
              <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                <MapPin size={14} className="text-primary" />
                GPS Coords: {user.location.lat.toFixed(2)}, {user.location.lng.toFixed(2)} (Obfuscated for client privacy)
              </span>
            )}
          </div>
        </header>

        {/* ======================= */}
        /* TAB 1: DISCOVERY MAP    */
        /* ======================= */}
        {activeTab === 'map' && (
          <div style={{ display: 'flex', height: '100%', overflow: 'hidden' }}>
            <div style={{ flex: 1, padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div className="card" style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                  <h3 style={{ fontSize: '1rem', fontWeight: 'bold' }}>Interactive Vector Map</h3>
                  <div style={{ display: 'flex', gap: '0.5rem', fontSize: '0.75rem' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                      <span style={{ display: 'inline-block', width: '10px', height: '10px', borderRadius: '50%', backgroundColor: 'var(--primary)' }}></span>
                      Historical
                    </span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                      <span style={{ display: 'inline-block', width: '10px', height: '10px', borderRadius: '50%', backgroundColor: 'var(--color-success)' }}></span>
                      Hidden Spot
                    </span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                      <span style={{ display: 'inline-block', width: '10px', height: '10px', borderRadius: '50%', backgroundColor: 'var(--color-info)' }}></span>
                      Community
                    </span>
                  </div>
                </div>

                {/* Simulated Canvas Map Container */}
                <div className="vector-map-container" style={{ flex: 1 }}>
                  {/* Grid Lines Overlay */}
                  <div style={{
                    position: 'absolute', inset: 0,
                    backgroundImage: 'radial-gradient(circle, #222 1px, transparent 1px)',
                    backgroundSize: '30px 30px', opacity: 0.3
                  }}></div>

                  {/* Stylized Vector Map Background (City streets, parks, and winding river) */}
                  <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }} opacity="0.25">
                    {/* Winding River */}
                    <path d="M -100,320 C 150,220 250,480 600,420 T 1200,350" fill="none" stroke="#2563eb" strokeWidth="42" strokeLinecap="round" />
                    <path d="M -100,320 C 150,220 250,480 600,420 T 1200,350" fill="none" stroke="#3b82f6" strokeWidth="36" strokeLinecap="round" />
                    
                    {/* Green Parks */}
                    <rect x="60" y="80" width="220" height="150" rx="12" fill="#065f46" opacity="0.4" />
                    <rect x="420" y="100" width="180" height="220" rx="15" fill="#065f46" opacity="0.4" />
                    
                    {/* Golden Highways & Intersecting Streets */}
                    <path d="M -50,150 L 1100,600" fill="none" stroke="#1f2937" strokeWidth="10" />
                    <path d="M -50,150 L 1100,600" fill="none" stroke="#d97706" strokeWidth="2" />
                    
                    <path d="M 320,-50 L 320,950" fill="none" stroke="#1f2937" strokeWidth="10" />
                    <path d="M 320,-50 L 320,950" fill="none" stroke="#d97706" strokeWidth="2" />

                    <path d="M -50,450 C 250,450 450,150 900,150" fill="none" stroke="#374151" strokeWidth="5" strokeDasharray="5,5" />
                    
                    {/* City center roundabout */}
                    <circle cx="320" cy="300" r="30" fill="#111" stroke="#4b5563" strokeWidth="4" />
                    <circle cx="320" cy="300" r="12" fill="#d97706" />
                  </svg>

                  {/* Draw Current User location if opt-in */}
                  {user.location && (
                    <div 
                      className="user-dot"
                      style={{
                        left: '50%',
                        top: '50%'
                      }}
                      title="You are here"
                    />
                  )}

                  {/* Places Dots */}
                  {places.map((p, index) => {
                    const latOffset = (p.location.lat - (user.location?.lat || 12.9716)) * 30000;
                    const lngOffset = (p.location.lng - (user.location?.lng || 77.5946)) * 30000;
                    const categoryClass = p.category.toLowerCase().includes('hist') 
                      ? 'historical' 
                      : p.category.toLowerCase().includes('hidd') 
                        ? 'hidden' 
                        : 'community';

                    return (
                      <div 
                        key={p.id}
                        className={`place-dot ${categoryClass}`}
                        style={{
                          left: `calc(50% + ${lngOffset}px)`,
                          top: `calc(50% - ${latOffset}px)`
                        }}
                        onClick={() => {
                          alert(`📍 Place: ${p.name}\nCategory: ${p.category}\nRating: ⭐ ${p.rating}\nDescription: ${p.description}`);
                        }}
                        title={p.name}
                      >
                        <MapPin size={10} style={{ color: '#000' }} />
                      </div>
                    );
                  })}

                  {/* Nearby Travelers Dots (Fuzzed layout for Privacy compliance) */}
                  {nearbyTravelers.map((t) => {
                    if (t.distance === 9999 || !t.distance) return null;
                    
                    // Deterministic fuzzed placement angle based on traveler ID
                    const charSum = t.id.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0);
                    const angle = (charSum % 360) * (Math.PI / 180);
                    
                    const distPixels = t.distance * 35; // 35 pixels per km for visual visibility
                    const xOffset = distPixels * Math.cos(angle);
                    const yOffset = distPixels * Math.sin(angle);

                    return (
                      <div 
                        key={t.id}
                        className="user-dot"
                        style={{
                          left: `calc(50% + ${xOffset}px)`,
                          top: `calc(50% - ${yOffset}px)`,
                          backgroundColor: '#f59e0b',
                          boxShadow: '0 0 10px #f59e0b',
                          width: '14px',
                          height: '14px',
                          border: '2px solid #fff'
                        }}
                        onClick={() => {
                          alert(`👤 Nearby Traveler: ${t.name}\nDistance: ${t.distanceStr}\nInterests: ${t.interests.join(', ')}`);
                        }}
                        title={`${t.name} (${t.distanceStr})`}
                      />
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Sidebar Details / Form */}
            <div style={{ width: '340px', borderLeft: '1px solid var(--border-color)', backgroundColor: 'var(--bg-secondary)', padding: '1.5rem', overflowY: 'auto' }}>
              <button 
                type="button" 
                className="btn btn-primary" 
                style={{ width: '100%', marginBottom: '1.5rem', background: '#eab308', color: '#000', justifyContent: 'center' }}
                onClick={detectLiveLocation}
              >
                <MapPin size={16} />
                Detect Live Location
              </button>

              <h3 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem', borderTop: '1px solid var(--border-color)', paddingTop: '1.5rem' }}>
                <MapPin size={18} className="text-primary" />
                Submit Discovery
              </h3>

              <form onSubmit={handleSubmitPlace} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div className="input-group">
                  <label className="input-label">Spot Name</label>
                  <input 
                    type="text" 
                    className="input-field" 
                    placeholder="e.g. Whispering Caves"
                    value={newPlaceName}
                    onChange={e => setNewPlaceName(e.target.value)}
                    required
                  />
                </div>

                <div className="input-group">
                  <label className="input-label">Category</label>
                  <select 
                    className="input-field"
                    value={newPlaceCat}
                    onChange={e => setNewPlaceCat(e.target.value)}
                  >
                    <option value="Hidden Spot">Hidden Spot (Traveler Secret)</option>
                    <option value="Historical">Historical Site</option>
                    <option value="Community Spot">Community Hangout</option>
                  </select>
                </div>

                <div className="input-group">
                  <label className="input-label">Description & Tips</label>
                  <textarea 
                    className="input-field" 
                    style={{ height: '100px', resize: 'none' }}
                    placeholder="Explain how to get here or historical details..."
                    value={newPlaceDesc}
                    onChange={e => setNewPlaceDesc(e.target.value)}
                    required
                  />
                </div>

                <button type="submit" className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }}>
                  <Upload size={16} />
                  Submit Place
                </button>
              </form>

              <div style={{ marginTop: '2rem', borderTop: '1px solid var(--border-color)', paddingTop: '1.5rem' }}>
                <h4 style={{ fontSize: '0.9rem', marginBottom: '0.75rem', fontWeight: 600 }}>Nearby Discovery Spots</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {places.map(p => (
                    <div 
                      key={p.id} 
                      style={{ background: 'var(--bg-tertiary)', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border-color)', cursor: 'pointer' }}
                      onClick={() => alert(`Name: ${p.name}\n${p.description}`)}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontWeight: 600, fontSize: '0.85rem' }}>{p.name}</span>
                        <span style={{ fontSize: '0.75rem', padding: '0.1rem 0.4rem', borderRadius: '4px', background: 'rgba(255,255,255,0.05)' }}>
                          ⭐ {p.rating || 'N/A'}
                        </span>
                      </div>
                      <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
                        {p.category} {p.distance !== undefined ? `• ${p.distance} km away` : ''}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* =========================== */}
        {/* TAB 2: SOCIAL RECOMMEND     */}
        {/* =========================== */}
        {activeTab === 'social' && (
          <div style={{ display: 'flex', height: '100%', overflow: 'hidden' }}>
            {/* Suggested Travelers Grid */}
            <div style={{ flex: 1, padding: '2rem', overflowY: 'auto' }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Heart size={20} style={{ color: 'var(--primary)' }} />
                Suggested Travelers
              </h2>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
                Computed using our 6-factor weight profile (Distance 30%, Shared Interests 20%, Destinations 15%, Discoveries 15%, Mutuals 10%, Activity 10%).
              </p>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1rem' }}>
                {suggestedTravelers.map(t => (
                  <div key={t.id} className="card" style={{ padding: '1rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div>
                        <h4 style={{ fontWeight: 700, fontSize: '1rem' }}>{t.name}</h4>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem', marginTop: '0.5rem' }}>
                          {t.interests.map(i => (
                            <span key={i} style={{ fontSize: '0.7rem', padding: '0.1rem 0.4rem', borderRadius: '4px', background: 'rgba(251,191,36,0.1)', color: 'var(--primary)' }}>
                              {i}
                            </span>
                          ))}
                        </div>
                      </div>
                      
                      {/* Score Badge */}
                      <div style={{ textAlign: 'right' }}>
                        <span style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--primary)' }}>
                          {t.recommendationScore}%
                        </span>
                        <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>Match Score</div>
                      </div>
                    </div>

                    <div style={{ marginTop: '1rem', display: 'flex', gap: '0.5rem' }}>
                      <button 
                        className="btn btn-primary" 
                        style={{ flex: 1, fontSize: '0.75rem', padding: '0.4rem' }}
                        onClick={() => openChatWith(t)}
                      >
                        <MessageSquare size={12} />
                        Message
                      </button>
                      <button 
                        className={`btn ${followedUsers.has(t.id) ? 'btn-secondary' : 'btn-secondary'}`} 
                        style={{ flex: 1, fontSize: '0.75rem', padding: '0.4rem', border: followedUsers.has(t.id) ? '1px solid var(--color-success)' : '' }}
                        onClick={() => handleFollowUser(t.id)}
                      >
                        {followedUsers.has(t.id) ? <UserCheck size={12} style={{ color: 'var(--color-success)' }} /> : <UserPlus size={12} />}
                        {followedUsers.has(t.id) ? 'Following' : 'Follow'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Nearby Travelers Column */}
            <div style={{ width: '340px', borderLeft: '1px solid var(--border-color)', backgroundColor: 'var(--bg-secondary)', padding: '1.5rem', overflowY: 'auto' }}>
              <h3 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem' }}>
                <Users size={18} className="text-primary" />
                Nearby Travelers
              </h3>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
                🔒 Strict Coordinate Privacy: GPS lat/lng pairs are stripped before transmission. Only approximate distance markers are displayed.
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {nearbyTravelers.map(t => (
                  <div key={t.id} style={{ background: 'var(--bg-tertiary)', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontWeight: 600, fontSize: '0.85rem' }}>{t.name}</span>
                      <span style={{ fontSize: '0.75rem', color: 'var(--primary)', fontWeight: 'bold' }}>
                        {t.distanceStr}
                      </span>
                    </div>
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
                      Interests: {t.interests.join(', ')}
                    </p>
                    <div style={{ marginTop: '0.75rem', display: 'flex', gap: '0.25rem' }}>
                      <button 
                        className="btn btn-primary" 
                        style={{ fontSize: '0.7rem', padding: '0.25rem 0.5rem', width: '100%', justifyContent: 'center' }}
                        onClick={() => openChatWith(t)}
                      >
                        Message
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ===================== */}
        {/* TAB 3: TRAVELER CHAT  */}
        {/* ===================== */}
        {activeTab === 'chat' && (
          <div className="chat-container">
            {/* Conversations List */}
            <div className="chat-sidebar">
              <div style={{ padding: '1rem', borderBottom: '1px solid var(--border-color)' }}>
                <h4 style={{ fontWeight: 'bold' }}>Active Dialogs</h4>
              </div>
              <div style={{ flex: 1, overflowY: 'auto' }}>
                {suggestedTravelers.map(t => (
                  <div 
                    key={t.id} 
                    style={{
                      padding: '1rem',
                      borderBottom: '1px solid var(--border-color)',
                      cursor: 'pointer',
                      background: activeChatUser?.id === t.id ? 'var(--bg-tertiary)' : 'transparent',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between'
                    }}
                    onClick={() => openChatWith(t)}
                  >
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{t.name}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                        {userStatuses[t.id] === 'online' ? '🟢 Online' : '⚪ Offline'}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Chat Messages Main Area */}
            <div className="chat-main">
              {activeChatUser ? (
                <>
                  <div className="chat-header">
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <span style={{ fontWeight: 700 }}>{activeChatUser.name}</span>
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
                        Conversation Secured with JWT handshakes
                      </span>
                    </div>
                  </div>

                  <div className="chat-messages">
                    {messages.map((m, idx) => (
                      <div 
                        key={m.id || idx} 
                        className={`message-bubble ${m.senderId === user.id ? 'sent' : 'received'}`}
                      >
                        {m.placeShare ? (
                          <div style={{ background: '#111', padding: '0.5rem', borderRadius: '4px', border: '1px solid var(--border-color)', marginBottom: '0.5rem', color: '#fff', width: '220px' }}>
                            <div style={{ fontSize: '0.75rem', color: 'var(--primary)', fontWeight: 'bold' }}>📍 Place Recommendation</div>
                            <div style={{ fontWeight: 'bold', fontSize: '0.9rem', marginTop: '0.25rem' }}>{m.placeShare.name}</div>
                            <div style={{ fontSize: '0.75rem', color: '#ccc' }}>Rating: ⭐ {m.placeShare.rating}</div>
                            <button 
                              className="btn btn-primary" 
                              style={{ width: '100%', fontSize: '0.7rem', padding: '0.25rem', marginTop: '0.5rem' }}
                              onClick={() => alert(`Map route calculated to ${m.placeShare.name}`)}
                            >
                              View Route
                            </button>
                          </div>
                        ) : null}
                        <div>{m.content}</div>
                        <div style={{ fontSize: '0.6rem', opacity: 0.6, textAlign: 'right', marginTop: '0.25rem' }}>
                          {new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Place recommendation sharing options */}
                  <div style={{ background: 'var(--bg-secondary)', borderTop: '1px solid var(--border-color)', padding: '0.5rem 1rem', display: 'flex', gap: '0.5rem', overflowX: 'auto', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>📍 Share Spot:</span>
                    {places.map(p => (
                      <button 
                        key={p.id}
                        className="btn btn-secondary" 
                        style={{ fontSize: '0.7rem', padding: '0.2rem 0.5rem', whiteSpace: 'nowrap' }}
                        onClick={() => handleSendMessage(null, p)}
                      >
                        {p.name}
                      </button>
                    ))}
                  </div>

                  <form className="chat-input-area" onSubmit={handleSendMessage}>
                    <input 
                      type="text" 
                      className="chat-input" 
                      placeholder="Type a message securely..."
                      value={chatInput}
                      onChange={e => setChatInput(e.target.value)}
                    />
                    <button type="submit" className="btn btn-primary">
                      <Send size={16} />
                    </button>
                  </form>
                </>
              ) : (
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)' }}>
                  <MessageSquare size={48} style={{ marginBottom: '1rem', opacity: 0.3 }} />
                  Select a traveler from the sidebar to open a conversation.
                </div>
              )}
            </div>
          </div>
        )}

        {/* ========================== */}
        {/* TAB 4: SECURITY DASHBOARD  */}
        {/* ========================== */}
        {activeTab === 'security' && (
          <div style={{ padding: '2rem', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold' }}>SOC Analytics Dashboard</h2>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Centralized security alert monitor logs.</p>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button className="btn btn-secondary" onClick={fetchSecurityDashboard}>
                  <RefreshCw size={16} />
                  Refresh Metrics
                </button>
                <button className="btn btn-danger" onClick={resetSecuritySimulator}>
                  <Trash2 size={16} />
                  Reset Logs
                </button>
              </div>
            </div>

            {/* Metrics cards grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem' }}>
              <div className="card" style={{ borderLeft: '4px solid var(--color-danger)' }}>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Blocked Accounts</div>
                <div style={{ fontSize: '1.8rem', fontWeight: 800, marginTop: '0.5rem' }}>{securityMetrics.blockedAccounts}</div>
              </div>
              <div className="card" style={{ borderLeft: '4px solid var(--color-warning)' }}>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Failed Logins</div>
                <div style={{ fontSize: '1.8rem', fontWeight: 800, marginTop: '0.5rem' }}>{securityMetrics.failedLogins}</div>
              </div>
              <div className="card" style={{ borderLeft: '4px solid var(--color-info)' }}>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Suspicious Actions</div>
                <div style={{ fontSize: '1.8rem', fontWeight: 800, marginTop: '0.5rem' }}>{securityMetrics.suspiciousRequests}</div>
              </div>
              <div className="card" style={{ borderLeft: '4px solid #f43f5e' }}>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>API Flood Intercepts</div>
                <div style={{ fontSize: '1.8rem', fontWeight: 800, marginTop: '0.5rem' }}>{securityMetrics.apiRateLimitEvents}</div>
              </div>
              <div className="card" style={{ borderLeft: '4px solid #a855f7' }}>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Quarantined Files</div>
                <div style={{ fontSize: '1.8rem', fontWeight: 800, marginTop: '0.5rem' }}>{securityMetrics.fileScanFailures}</div>
              </div>
              <div className="card" style={{ borderLeft: '4px solid #4b5563' }}>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Blocked IPs</div>
                <div style={{ fontSize: '1.8rem', fontWeight: 800, marginTop: '0.5rem' }}>{securityMetrics.blockedIps}</div>
              </div>
            </div>

            {/* Firewalls IP blocks section */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '1.5rem', minHeight: '300px' }}>
              {/* Left col: Block IP manually */}
              <div className="card" style={{ height: 'fit-content' }}>
                <h3 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Shield size={18} />
                  Firewall Isolation
                </h3>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
                  Blacklist malicious IPs immediately.
                </p>

                <div className="input-group">
                  <label className="input-label">Target IP Address</label>
                  <input 
                    type="text" 
                    className="input-field" 
                    placeholder="e.g. 192.168.1.15"
                    value={manualIpToBlock}
                    onChange={e => setManualIpToBlock(e.target.value)}
                  />
                </div>

                {blockStatusMsg && (
                  <div style={{ fontSize: '0.75rem', padding: '0.5rem', background: 'rgba(255,255,255,0.05)', borderRadius: '4px', marginBottom: '1rem' }}>
                    {blockStatusMsg}
                  </div>
                )}

                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button className="btn btn-danger" style={{ flex: 1, fontSize: '0.85rem' }} onClick={() => handleBlockIp(true)}>
                    Blacklist
                  </button>
                  <button className="btn btn-secondary" style={{ flex: 1, fontSize: '0.85rem' }} onClick={() => handleBlockIp(false)}>
                    Whitelist
                  </button>
                </div>
              </div>

              {/* Right col: Security log history table */}
              <div className="card" style={{ display: 'flex', flexDirection: 'column', padding: '1rem' }}>
                <h3 className="card-title" style={{ padding: '0.5rem' }}>Incident Log Feed</h3>
                <div style={{ flex: 1, overflowY: 'auto', maxHeight: '400px' }}>
                  <table className="log-table">
                    <thead>
                      <tr>
                        <th>Timestamp</th>
                        <th>Type</th>
                        <th>Severity</th>
                        <th>Message</th>
                        <th>Source IP</th>
                      </tr>
                    </thead>
                    <tbody>
                      {securityLogs.map((l) => (
                        <tr key={l.id} className={`log-row ${l.severity}`}>
                          <td>{new Date(l.timestamp).toLocaleTimeString()}</td>
                          <td>{l.type}</td>
                          <td>{l.severity}</td>
                          <td>{l.message}</td>
                          <td>{l.ip}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ====================== */}
        {/* TAB 5: ATTACK LAB      */}
        {/* ====================== */}
        {activeTab === 'attackLab' && (
          <div style={{ padding: '2rem', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold' }}>Cybersecurity Attack Lab Simulator</h2>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                Demonstrate that the Travel Bee security controls stop attacks live. Select an attack to launch a simulated exploit attempt and verify the system's defenses.
              </p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 2fr', gap: '1.5rem', flex: 1 }}>
              {/* Attack control cards */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                
                {/* Card 1: Brute Force */}
                <div className="card" style={{ padding: '1rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h4 style={{ fontWeight: 'bold' }}>1. Brute-Force Authentication</h4>
                    <button 
                      className="btn btn-primary" 
                      style={{ fontSize: '0.75rem', padding: '0.4rem 0.8rem' }}
                      disabled={isAttacking}
                      onClick={() => runSimulatedAttack('Brute Force Login')}
                    >
                      Execute Attack
                    </button>
                  </div>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.5rem' }}>
                    Attacker fires 10 invalid credentials. Expected Result: Rate limiter intercept (429) followed by account temporary lockout.
                  </p>
                </div>

                {/* Card 2: NoSQL Injection */}
                <div className="card" style={{ padding: '1rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h4 style={{ fontWeight: 'bold' }}>2. NoSQL DB query Injection</h4>
                    <button 
                      className="btn btn-primary" 
                      style={{ fontSize: '0.75rem', padding: '0.4rem 0.8rem' }}
                      disabled={isAttacking}
                      onClick={() => runSimulatedAttack('NoSQL Injection')}
                    >
                      Execute Attack
                    </button>
                  </div>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.5rem' }}>
                    Attacker injects MongoDB comparison operator (`$ne` - not equal) keys. Expected: Query sanitized, returns 401.
                  </p>
                </div>

                {/* Card 3: IDOR */}
                <div className="card" style={{ padding: '1rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h4 style={{ fontWeight: 'bold' }}>3. Broken Access Control (IDOR)</h4>
                    <button 
                      className="btn btn-primary" 
                      style={{ fontSize: '0.75rem', padding: '0.4rem 0.8rem' }}
                      disabled={isAttacking}
                      onClick={() => runSimulatedAttack('Insecure Direct Object Reference (IDOR)')}
                    >
                      Execute Attack
                    </button>
                  </div>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.5rem' }}>
                    Attacker attempts to query message dialogues belonging to other users. Expected: IDOR validator flags owner breach (403).
                  </p>
                </div>

                {/* Card 4: Polyglot upload */}
                <div className="card" style={{ padding: '1rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h4 style={{ fontWeight: 'bold' }}>4. Malicious Polyglot File Upload</h4>
                    <button 
                      className="btn btn-primary" 
                      style={{ fontSize: '0.75rem', padding: '0.4rem 0.8rem' }}
                      disabled={isAttacking}
                      onClick={() => runSimulatedAttack('Malicious File Upload')}
                    >
                      Execute Attack
                    </button>
                  </div>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.5rem' }}>
                    Attacker uploads a webshell script masked inside an image. Expected: MIME check & script signature flags threat (400).
                  </p>
                </div>

                {/* Card 5: Privilege Escalation */}
                <div className="card" style={{ padding: '1rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h4 style={{ fontWeight: 'bold' }}>5. Privilege Escalation</h4>
                    <button 
                      className="btn btn-primary" 
                      style={{ fontSize: '0.75rem', padding: '0.4rem 0.8rem' }}
                      disabled={isAttacking}
                      onClick={() => runSimulatedAttack('Privilege Escalation')}
                    >
                      Execute Attack
                    </button>
                  </div>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.5rem' }}>
                    Traveler role attempts to invoke Super Admin User endpoint. Expected: Whitelisted role validator blocks call (403).
                  </p>
                </div>

                {/* Card 6: DoS API Flooding */}
                <div className="card" style={{ padding: '1rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h4 style={{ fontWeight: 'bold' }}>6. DoS API Flooding</h4>
                    <button 
                      className="btn btn-primary" 
                      style={{ fontSize: '0.75rem', padding: '0.4rem 0.8rem' }}
                      disabled={isAttacking}
                      onClick={() => runSimulatedAttack('API Flooding (DoS)')}
                    >
                      Execute Attack
                    </button>
                  </div>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.5rem' }}>
                    Attacker floods `/api/places` with 25 rapid requests. Expected: Rate limiter triggers (429 Too Many Requests).
                  </p>
                </div>

              </div>

              {/* Lab console log logs feed */}
              <div className="card" style={{ background: '#090a0f', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
                  <h4 style={{ color: 'var(--primary)', fontWeight: 'bold' }}>⚡ Live Attack Console Log</h4>
                  <span style={{ fontSize: '0.65rem', padding: '0.1rem 0.4rem', borderRadius: '4px', background: 'var(--primary-glow)', color: 'var(--primary)' }}>
                    SIMULATOR ACTIVE
                  </span>
                </div>

                <div style={{ flex: 1, overflowY: 'auto', fontFamily: 'var(--font-mono)', fontSize: '0.8rem', padding: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {attackLogs.length === 0 ? (
                    <div style={{ color: 'var(--text-muted)', textAlign: 'center', marginTop: '4rem' }}>
                      Click "Execute Attack" to run exploits.
                    </div>
                  ) : (
                    attackLogs.map((l, index) => {
                      let color = '#ccc';
                      if (l.includes('[SIMULATOR]')) color = '#f59e0b';
                      if (l.includes('🚨')) color = '#10b981';
                      if (l.includes('❌') || l.includes('Blocked')) color = '#ef4444';
                      
                      return (
                        <div key={index} style={{ color, whiteSpace: 'pre-wrap', lineHeight: '1.4' }}>
                          {l}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

      </main>
    </div>
  );
}

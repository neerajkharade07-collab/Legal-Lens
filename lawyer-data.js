/**
 * lawyer-data.js
 *
 * Single source of truth for Legal Lens demo lawyer data.
 * Shared by find-a-lawyer.html, lawyer-profile.html, lawyer-login.html,
 * lawyer-signup.html and lawyer-dashboard.html so the same lawyers,
 * IDs, and fields are used everywhere.
 *
 * BACKEND-READY:
 * Every function here returns a Promise so each one can be
 * swapped for a real API call later without touching any UI code:
 *
 *   getLawyers()          -> fetch('/api/lawyers')
 *   getLawyerById(id)     -> fetch(`/api/lawyers/${id}`)
 *   getSimilarLawyers(l)  -> fetch(`/api/lawyers/${l.id}/similar`)
 *   registerLawyer(data)  -> fetch('/api/lawyers', { method: 'POST', ... })
 *   updateLawyerProfile() -> fetch(`/api/lawyers/${id}`, { method: 'PATCH', ... })
 *
 * NEW IN THIS VERSION (Lawyer Connect two-sided platform):
 * Registered ("Lawyer" role) accounts are layered on top of the
 * original seed lawyers, without altering the seed array. This keeps
 * every existing customer-side page (find-a-lawyer.html, lawyer
 * profile cards, similar lawyers) working exactly as before, while
 * letting new lawyers created through lawyer-signup.html show up
 * in the same directory automatically.
 *
 * PRIVACY NOTE: this is a prototype with no real backend. Passwords
 * collected on the lawyer/customer auth forms are intentionally never
 * written to localStorage -- only non-sensitive profile fields are
 * persisted (name, email, professional details). Swap in real
 * authentication (hashed passwords, server sessions, etc.) before
 * this becomes anything other than a demo.
 */
(function (global) {

  const lawyers = [
    { id: 'lawyer001', name: 'Adv. Aarav Mehta', verified: true, practiceAreas: ['Criminal Law', 'Civil Law'], experience: 8, location: 'Pune', languages: ['English', 'Hindi', 'Marathi'], consultationFee: 1500, rating: 4.8, consultations: 127, description: 'Focused on criminal defense and civil litigation with a client-first approach, helping individuals navigate complex proceedings with clarity.' },
    { id: 'lawyer002', name: 'Adv. Priya Deshmukh', verified: true, practiceAreas: ['Family Law', 'Property Law'], experience: 12, location: 'Mumbai', languages: ['English', 'Hindi', 'Marathi'], consultationFee: 2500, rating: 4.9, consultations: 203, description: 'Experienced family and property law practitioner known for practical, empathetic guidance through sensitive matters.' },
    { id: 'lawyer003', name: 'Adv. Rohan Kulkarni', verified: false, practiceAreas: ['Cyber Law', 'Consumer Law'], experience: 4, location: 'Pune', languages: ['English', 'Hindi'], consultationFee: 1200, rating: 4.5, consultations: 41, description: 'Emerging cyber law specialist assisting clients with online fraud, data privacy, and consumer disputes.' },
    { id: 'lawyer004', name: 'Adv. Kavya Reddy', verified: true, practiceAreas: ['Employment Law', 'Business / Corporate Law'], experience: 9, location: 'Hyderabad', languages: ['English', 'Telugu', 'Hindi'], consultationFee: 3000, rating: 4.7, consultations: 158, description: 'Corporate and employment law advisor working with startups and individual employees on contracts and workplace disputes.' },
    { id: 'lawyer005', name: 'Adv. Vikram Singh', verified: true, practiceAreas: ['Banking / Finance', 'Civil Law'], experience: 16, location: 'Delhi', languages: ['English', 'Hindi'], consultationFee: 4000, rating: 4.9, consultations: 312, description: 'Senior banking and finance litigator with extensive experience handling recovery matters and financial disputes.' },
    { id: 'lawyer006', name: 'Adv. Sneha Iyer', verified: true, practiceAreas: ['Tenant / Rental Disputes', 'Property Law'], experience: 6, location: 'Bengaluru', languages: ['English', 'Tamil', 'Kannada'], consultationFee: 1800, rating: 4.6, consultations: 89, description: 'Dedicated to helping tenants and landlords resolve rental disputes fairly and efficiently.' },
    { id: 'lawyer007', name: 'Adv. Arjun Nair', verified: false, practiceAreas: ['Criminal Law', 'Cyber Law'], experience: 2, location: 'Nagpur', languages: ['English', 'Hindi', 'Marathi'], consultationFee: 900, rating: 4.3, consultations: 18, description: 'Early-career advocate building a practice in criminal defense and digital crime cases.' },
    { id: 'lawyer008', name: 'Adv. Meera Joshi', verified: true, practiceAreas: ['Family Law', 'Consumer Law'], experience: 11, location: 'Nashik', languages: ['English', 'Hindi', 'Marathi'], consultationFee: 2000, rating: 4.8, consultations: 176, description: 'Compassionate family law counsel with a strong track record in mediation and consumer protection matters.' },
    { id: 'lawyer009', name: 'Adv. Karthik Rajan', verified: true, practiceAreas: ['Business / Corporate Law', 'Banking / Finance'], experience: 14, location: 'Bengaluru', languages: ['English', 'Tamil', 'Kannada'], consultationFee: 5000, rating: 4.9, consultations: 264, description: 'Corporate counsel advising growing businesses on structuring, compliance, and financial agreements.' },
    { id: 'lawyer010', name: 'Adv. Ananya Kapoor', verified: false, practiceAreas: ['Property Law', 'Tenant / Rental Disputes'], experience: 3, location: 'Delhi', languages: ['English', 'Hindi'], consultationFee: 1100, rating: 4.4, consultations: 27, description: 'Property and tenancy specialist assisting clients with documentation review and dispute resolution.' },
    { id: 'lawyer011', name: 'Adv. Rahul Bhatt', verified: true, practiceAreas: ['Civil Law', 'Employment Law'], experience: 7, location: 'Mumbai', languages: ['English', 'Hindi', 'Marathi'], consultationFee: 2200, rating: 4.6, consultations: 112, description: 'Civil litigation and employment law practitioner focused on practical, timely resolutions for individuals.' },
    { id: 'lawyer012', name: 'Adv. Divya Menon', verified: true, practiceAreas: ['Cyber Law', 'Business / Corporate Law'], experience: 10, location: 'Hyderabad', languages: ['English', 'Telugu', 'Hindi'], consultationFee: 3500, rating: 4.8, consultations: 191, description: 'Technology-focused counsel advising companies and individuals on cyber law, data protection, and digital contracts.' }
  ];

  const ACCOUNTS_KEY = 'legalLensLawyerAccounts';   // [{ id, name, email, barNumber, createdAt }]  -- no passwords, ever
  const PROFILES_KEY = 'legalLensLawyerProfiles';    // [ lawyer profile objects, same shape as seed `lawyers` + email/availability ]
  const REQUESTS_KEY = 'legalLensConsultRequests';   // shared with find-a-lawyer.html / lawyer-profile.js

  /* =========================================================
     LOW-LEVEL STORAGE HELPERS
     ========================================================= */
  function readJSON(key, fallback) {
    try {
      const val = JSON.parse(localStorage.getItem(key));
      return val === null || val === undefined ? fallback : val;
    } catch (e) {
      return fallback;
    }
  }

  function writeJSON(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }

  function getAccounts() { return readJSON(ACCOUNTS_KEY, []); }
  function saveAccounts(list) { writeJSON(ACCOUNTS_KEY, list); }

  function getRegisteredProfiles() { return readJSON(PROFILES_KEY, []); }
  function saveRegisteredProfiles(list) { writeJSON(PROFILES_KEY, list); }

  function getAllLawyersSync() {
    // Seed lawyers first, then registered lawyers -- never mutate the seed array.
    return lawyers.slice().concat(getRegisteredProfiles());
  }

  function generateId(prefix) {
    return prefix + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  /* =========================================================
     EXISTING CUSTOMER-FACING API (unchanged signatures)
     ========================================================= */
  function getLawyers() {
    // Swap this for: return fetch('/api/lawyers').then(r => r.json());
    return Promise.resolve(getAllLawyersSync());
  }

  function getLawyerById(id) {
    // Swap this for: return fetch(`/api/lawyers/${id}`).then(r => r.ok ? r.json() : null);
    const found = getAllLawyersSync().find(l => l.id === id) || null;
    return Promise.resolve(found);
  }

  function getSimilarLawyers(lawyer, limit) {
    limit = limit || 4;
    // Swap this for: return fetch(`/api/lawyers/${lawyer.id}/similar?limit=${limit}`).then(r => r.json());
    const all = getAllLawyersSync();
    const scored = all
      .filter(l => l.id !== lawyer.id)
      .map(l => {
        let score = 0;
        if (l.location === lawyer.location) score += 2;
        (l.practiceAreas || []).forEach(p => { if (lawyer.practiceAreas.includes(p)) score += 2; });
        (l.languages || []).forEach(lang => { if (lawyer.languages.includes(lang)) score += 1; });
        return { lawyer: l, score };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map(x => x.lawyer);

    return Promise.resolve(scored);
  }

  /* =========================================================
     LAWYER ACCOUNTS (registration / login)
     ========================================================= */

  // Creates both an account record (auth-facing, no password stored)
  // and a lawyer profile record (directory-facing). New lawyers start
  // as Verification Pending -- never auto-verified.
  function registerLawyer(details) {
    const id = generateId('lawyer');
    const now = new Date().toISOString();

    const account = {
      id: id,
      name: details.name,
      email: details.email,
      barNumber: details.barNumber || '',
      createdAt: now
    };

    const profile = {
      id: id,
      name: details.name,
      email: details.email,
      barNumber: details.barNumber || '',
      verified: false,
      practiceAreas: details.practiceAreas || [],
      experience: details.experience || 0,
      location: details.location || '',
      languages: details.languages || [],
      consultationFee: details.consultationFee || 0,
      rating: 0,
      consultations: 0,
      description: details.description || '',
      availability: { days: [], slots: [] },
      createdAt: now
    };

    const accounts = getAccounts();
    accounts.push(account);
    saveAccounts(accounts);

    const profiles = getRegisteredProfiles();
    profiles.push(profile);
    saveRegisteredProfiles(profiles);

    // Swap this whole function for:
    // return fetch('/api/lawyers/register', { method: 'POST', body: JSON.stringify(details) }).then(r => r.json());
    return Promise.resolve(profile);
  }

  function findLawyerAccountByEmail(email) {
    const normalized = (email || '').trim().toLowerCase();
    const account = getAccounts().find(a => a.email.trim().toLowerCase() === normalized) || null;
    // Swap this for: return fetch(`/api/lawyers/login`, { method: 'POST', body: JSON.stringify({ email }) }).then(...);
    return Promise.resolve(account);
  }

  // SIH demo: lawyer LOGIN is real (backend /api/auth/lawyer/*), but the
  // dashboard's profile details / requests are still browser-local demo data.
  // After a backend login there may be no browser profile for the backend
  // lawyerId yet, so create an empty one (name/email from the backend session,
  // verified: false) instead of bouncing the lawyer back to the login page.
  function ensureLawyerProfile(id, details) {
    details = details || {};
    const existing = getAllLawyersSync().find(l => l.id === id);
    if (existing) return Promise.resolve(existing);
    const now = new Date().toISOString();
    const profile = {
      id: id, name: details.name || 'Lawyer', email: details.email || '', barNumber: '',
      verified: false, practiceAreas: [], experience: 0, location: '', languages: [],
      consultationFee: 0, rating: 0, consultations: 0, description: '',
      availability: { days: [], slots: [] }, createdAt: now
    };
    const profiles = getRegisteredProfiles();
    profiles.push(profile);
    saveRegisteredProfiles(profiles);
    const accounts = getAccounts();
    if (!accounts.some(a => a.id === id)) {
      accounts.push({ id: id, name: profile.name, email: profile.email, barNumber: '', createdAt: now });
      saveAccounts(accounts);
    }
    return Promise.resolve(profile);
  }

  function getLawyerProfile(id) {
    return getLawyerById(id);
  }

  function updateLawyerProfile(id, updates) {
    const profiles = getRegisteredProfiles();
    const idx = profiles.findIndex(p => p.id === id);

    if (idx === -1) {
      // Seed lawyers are static demo data and are not user-editable in this prototype.
      return Promise.resolve(null);
    }

    profiles[idx] = Object.assign({}, profiles[idx], updates);
    saveRegisteredProfiles(profiles);

    // Keep the matching account record's name/email in sync for nav display.
    const accounts = getAccounts();
    const accIdx = accounts.findIndex(a => a.id === id);
    if (accIdx !== -1) {
      if (updates.name) accounts[accIdx].name = updates.name;
      if (updates.email) accounts[accIdx].email = updates.email;
      saveAccounts(accounts);
    }

    // Swap this for: return fetch(`/api/lawyers/${id}`, { method: 'PATCH', body: JSON.stringify(updates) }).then(r => r.json());
    return Promise.resolve(profiles[idx]);
  }

  /* =========================================================
     CONSULTATION REQUESTS (shared with customer-side pages)
     ========================================================= */
  function getAllConsultRequests() {
    return readJSON(REQUESTS_KEY, []);
  }

  function getConsultRequestsForLawyer(lawyerId) {
    const requests = getAllConsultRequests().filter(r => r.lawyerId === lawyerId);
    return Promise.resolve(requests);
  }

  function updateConsultRequestStatus(requestId, status) {
    const requests = getAllConsultRequests();
    const idx = requests.findIndex(r => r.id === requestId);
    if (idx === -1) return Promise.resolve(null);

    requests[idx].status = status;
    requests[idx].respondedAt = new Date().toISOString();
    writeJSON(REQUESTS_KEY, requests);
    return Promise.resolve(requests[idx]);
  }

  // My Clients = customers whose consultation request(s) for this lawyer
  // were accepted, de-duplicated, with their latest request summarized.
  function getClientsForLawyer(lawyerId) {
    const accepted = getAllConsultRequests().filter(r => r.lawyerId === lawyerId && r.status === 'accepted');
    const byClient = {};

    accepted.forEach(r => {
      const key = (r.customerEmail || r.customerName || 'guest').toLowerCase();
      if (!byClient[key] || new Date(r.requestedAt) > new Date(byClient[key].requestedAt)) {
        byClient[key] = r;
      }
    });

    const clients = Object.keys(byClient).map(key => {
      const r = byClient[key];
      const count = accepted.filter(x => (x.customerEmail || x.customerName || 'guest').toLowerCase() === key).length;
      return {
        customerName: r.customerName || 'Guest Client',
        customerEmail: r.customerEmail || '',
        lastIssue: r.issue,
        lastType: r.type,
        lastRequestedAt: r.requestedAt,
        consultationCount: count
      };
    });

    return Promise.resolve(clients);
  }

  global.LegalLensLawyerData = {
    // Existing customer-facing API
    getLawyers,
    getLawyerById,
    getSimilarLawyers,
    // Lawyer accounts / profiles
    registerLawyer,
    findLawyerAccountByEmail,
    getLawyerProfile,
    ensureLawyerProfile,
    updateLawyerProfile,
    // Consultation requests / clients
    getConsultRequestsForLawyer,
    updateConsultRequestStatus,
    getClientsForLawyer
  };

})(window);
/**
 * =========================================================================
 * Notifyy • Modular ES6 Application Architecture & Mock Repository
 * =========================================================================
 * 
 * BACKEND INTEGRATION NOTE:
 * To connect to Firebase Realtime Database:
 *   1. Import Firebase SDK: import { initializeApp } from 'firebase/app';
 *   2. import { getDatabase, ref, onValue, push, set } from 'firebase/database';
 *   3. Replace MockNoticeRepository methods with 'set(ref(db, ...))' and 'onValue(ref(db, ...))'
 * 
 * To connect to Node.js / Express REST API:
 *   1. Replace repository methods with 'fetch('/api/v1/notices')' or Axios calls.
 * =========================================================================
 */

// ==========================================
// 1. DATA MODELS & MOCK REPOSITORY LAYER
// ==========================================

const INITIAL_MOCK_NOTICES = [
  {
    noticeId: 'NTC-101',
    title: '⚠️ Campus Power Maintenance & Server Downtime',
    content: 'Please be advised that the central datacenter and main academic buildings will undergo scheduled electrical maintenance this Saturday from 08:00 AM to 02:00 PM. Portal services will be temporarily unavailable.',
    publisherName: 'Dr. Robert Vance (Registrar)',
    publisherRole: 'ADMIN',
    targetDepartment: 'ALL',
    targetAudience: 'Campus-Wide',
    category: 'URGENT',
    urgency: 'CRITICAL',
    timestamp: Date.now() - (2 * 3600 * 1000)
  },
  {
    noticeId: 'NTC-102',
    title: '📝 Spring 2026 Final Examination Routine Released',
    content: 'The official timetable for the undergraduate Final Term Examinations has been uploaded to the university portal. Students must resolve any registration holds and collect admit cards by Friday.',
    publisherName: 'Office of the Controller of Exams',
    publisherRole: 'ADMIN',
    targetDepartment: 'ALL',
    targetAudience: 'All Students',
    category: 'EXAM',
    urgency: 'HIGH',
    timestamp: Date.now() - (5 * 3600 * 1000),
    attachment: {
      name: 'Spring_2026_Final_Exam_Routine.pdf',
      type: 'PDF',
      size: '1.4 MB',
      headline: 'OFFICIAL FINAL EXAMINATION TIMETABLE - SPRING 2026',
      table: `
        <table>
          <thead>
            <tr><th>Course Code</th><th>Course Title</th><th>Exam Date</th><th>Time Slot</th><th>Assigned Hall</th></tr>
          </thead>
          <tbody>
            <tr><td>CSE 420</td><td>Distributed Systems</td><td>April 05, 2026</td><td>09:30 AM - 12:30 PM</td><td>Auditorium 2</td></tr>
            <tr><td>CSE 312</td><td>Operating Systems</td><td>April 08, 2026</td><td>01:30 PM - 04:30 PM</td><td>Computer Lab 4 &amp; 5</td></tr>
            <tr><td>CSE 211</td><td>Data Structures &amp; Algorithms</td><td>April 12, 2026</td><td>09:30 AM - 12:30 PM</td><td>Hall 304, 305</td></tr>
            <tr><td>MATH 201</td><td>Linear Algebra &amp; Statistics</td><td>April 16, 2026</td><td>01:30 PM - 04:30 PM</td><td>Exam Hall B</td></tr>
          </tbody>
        </table>
      `
    }
  },
  {
    noticeId: 'NTC-103',
    title: '🗓️ IEEE Annual Tech Symposium & Hackathon 2026',
    content: 'Join us for the 7th Annual CSE & EEE Inter-University Hackathon! Exciting prize pools, industry keynote speakers, and internship opportunities for top performing teams.',
    publisherName: 'Prof. Alan Turing (CSE HOD)',
    publisherRole: 'DEPT_ADMIN',
    targetDepartment: 'CSE',
    targetAudience: 'CSE & EEE Faculty/Students',
    category: 'EVENT',
    urgency: 'NORMAL',
    timestamp: Date.now() - (24 * 3600 * 1000),
    attachment: {
      name: 'IEEE_Tech_Symposium_Guidelines.pdf',
      type: 'PDF',
      size: '1.1 MB',
      headline: '7TH ANNUAL INTER-UNIVERSITY HACKATHON &amp; SYMPOSIUM GUIDELINES',
      table: `
        <table>
          <thead>
            <tr><th>Track Name</th><th>Eligibility</th><th>Team Size</th><th>Grand Prize</th></tr>
          </thead>
          <tbody>
            <tr><td>AI &amp; Generative Models</td><td>Undergraduate &amp; Masters</td><td>3 - 4 Members</td><td>$3,000 + Tech Internship</td></tr>
            <tr><td>Smart Hardware &amp; Robotics</td><td>Engineering Students</td><td>3 - 4 Members</td><td>$2,500 + FabLab Sponsorship</td></tr>
            <tr><td>FinTech &amp; Cybersecurity</td><td>Open to All Faculties</td><td>2 - 4 Members</td><td>$2,000 + Seed Grant</td></tr>
          </tbody>
        </table>
      `
    }
  },
  {
    noticeId: 'NTC-104',
    title: '📢 Room Rescheduling: CSE420 Distributed Systems',
    content: 'Today\'s lecture on Distributed Consensus Algorithms has been relocated from Room 304 to Multimedia Auditorium 2 due to projector maintenance.',
    publisherName: 'Dr. Grace Hopper (Faculty)',
    publisherRole: 'TEACHER',
    targetDepartment: 'CSE',
    targetAudience: 'CSE Batch 2023',
    category: 'ANNOUNCEMENT',
    urgency: 'NORMAL',
    timestamp: Date.now() - (30 * 60 * 1000)
  },
  {
    noticeId: 'NTC-105',
    title: '📝 Lab Assignment 3 Deadline Extension',
    content: 'The submission deadline for the Operating Systems Virtual Memory simulation project is extended to Sunday 11:59 PM. Submit your GitHub repositories via Google Classroom.',
    publisherName: 'Prof. Linus Torvalds (Faculty)',
    publisherRole: 'TEACHER',
    targetDepartment: 'CSE',
    targetAudience: 'CSE312 Enrolled',
    category: 'ANNOUNCEMENT',
    urgency: 'NORMAL',
    timestamp: Date.now() - (3 * 3600 * 1000),
    attachment: {
      name: 'OS_Virtual_Memory_Lab3_Spec.pdf',
      type: 'PDF',
      size: '860 KB',
      headline: 'CSE312: VIRTUAL MEMORY SIMULATION PROJECT SPECIFICATION',
      table: `
        <table>
          <thead>
            <tr><th>Component</th><th>Weight</th><th>Requirements</th><th>Due Date</th></tr>
          </thead>
          <tbody>
            <tr><td>Page Table Simulation</td><td>30%</td><td>Multi-level paging with TLB caching</td><td>Sunday 11:59 PM</td></tr>
            <tr><td>Page Replacement Alg.</td><td>40%</td><td>LRU, FIFO, Clock (Second Chance)</td><td>Sunday 11:59 PM</td></tr>
            <tr><td>Performance Benchmarking</td><td>30%</td><td>Hit/Miss ratio report &amp; graph</td><td>Sunday 11:59 PM</td></tr>
          </tbody>
        </table>
      `
    }
  },
  {
    noticeId: 'NTC-201',
    title: '⚡ EEE: Embedded Systems Lab Microcontroller Allocation',
    content: 'Students of EEE Batch 2024 must report to Embedded Systems Lab 2 for STM32 hardware kit allocation. Bring your institutional student IDs and lab manuals.',
    publisherName: 'Dr. Nikola Tesla (Faculty)',
    publisherRole: 'TEACHER',
    targetDepartment: 'EEE',
    targetAudience: 'EEE Batch 2024',
    category: 'ANNOUNCEMENT',
    urgency: 'NORMAL',
    timestamp: Date.now() - (4 * 3600 * 1000),
    attachment: {
      name: 'STM32_Embedded_Lab_Manual.pdf',
      type: 'PDF',
      size: '1.5 MB',
      headline: 'EEE320: EMBEDDED SYSTEMS HARDWARE LAB PROTOCOL',
      table: `
        <table>
          <thead>
            <tr><th>Lab Module</th><th>Microcontroller</th><th>Evaluation Criteria</th><th>Lab Room</th></tr>
          </thead>
          <tbody>
            <tr><td>Module 1</td><td>STM32F4 Discovery</td><td>GPIO &amp; Interrupt Handling</td><td>Lab 2A</td></tr>
            <tr><td>Module 2</td><td>ESP32 Dual-Core</td><td>FreeRTOS Task Scheduling</td><td>Lab 2B</td></tr>
            <tr><td>Module 3</td><td>TI MSP430</td><td>Ultra-Low Power Optimization</td><td>Lab 3</td></tr>
          </tbody>
        </table>
      `
    }
  },
  {
    noticeId: 'NTC-202',
    title: '📈 BBA: Strategic Management Case Analysis Deadline',
    content: 'Final presentation slides and Harvard Business Review case analysis report must be uploaded to the department portal by Monday 05:00 PM. Late submissions will receive grade deductions.',
    publisherName: 'Prof. Philip Kotler (BBA HOD)',
    publisherRole: 'DEPT_ADMIN',
    targetDepartment: 'BBA',
    targetAudience: 'BBA Final Year Students',
    category: 'ANNOUNCEMENT',
    urgency: 'NORMAL',
    timestamp: Date.now() - (6 * 3600 * 1000),
    attachment: {
      name: 'BBA_Strategic_Management_Rubric.docx',
      type: 'DOCX',
      size: '620 KB',
      headline: 'BBA401: STRATEGIC BUSINESS CASE EVALUATION RUBRIC',
      table: `
        <table>
          <thead>
            <tr><th>Evaluation Section</th><th>Weight</th><th>Key Focus Areas</th></tr>
          </thead>
          <tbody>
            <tr><td>Financial Ratio Analysis</td><td>35%</td><td>DuPont Model, Liquidity, Solvency</td></tr>
            <tr><td>Competitive Positioning</td><td>35%</td><td>Porter\'s Five Forces &amp; VRIO Matrix</td></tr>
            <tr><td>Executive Strategy Deck</td><td>30%</td><td>15-minute Board Presentation Pitch</td></tr>
          </tbody>
        </table>
      `
    }
  },
  {
    noticeId: 'NTC-203',
    title: '⚖️ LAW: Moot Court Competition Registration Open',
    content: 'Registration is now officially open for the 2026 Inter-University Constitutional Law Moot Court competition. Teams must register with the faculty dean office.',
    publisherName: 'Dean of Law Faculty',
    publisherRole: 'DEPT_ADMIN',
    targetDepartment: 'LAW',
    targetAudience: 'All Law Students',
    category: 'EVENT',
    urgency: 'NORMAL',
    timestamp: Date.now() - (12 * 3600 * 1000),
    attachment: {
      name: 'Moot_Court_2026_Official_Rules.pdf',
      type: 'PDF',
      size: '1.1 MB',
      headline: 'CONSTITUTIONAL LAW MOOT COURT BENCH REGULATIONS 2026',
      table: `
        <table>
          <thead>
            <tr><th>Stage</th><th>Timeline</th><th>Requirements</th></tr>
          </thead>
          <tbody>
            <tr><td>Memorial Submission</td><td>April 10, 2026</td><td>Written Memorials for Applicant &amp; Respondent</td></tr>
            <tr><td>Preliminary Rounds</td><td>April 22, 2026</td><td>Oral Arguments (30 mins per team)</td></tr>
            <tr><td>Grand Championship</td><td>May 02, 2026</td><td>Presided over by Supreme Court Judges</td></tr>
          </tbody>
        </table>
      `
    }
  }
];

class MockNoticeRepository {
  constructor() {
    this.notices = [...INITIAL_MOCK_NOTICES];
    this.subscribers = [];
  }

  async getAllNotices() {
    // Simulate lightweight network latency (20ms)
    return new Promise(resolve => {
      setTimeout(() => {
        resolve([...this.notices].sort((a, b) => b.timestamp - a.timestamp));
      }, 20);
    });
  }

  async publishNotice(noticeData) {
    return new Promise(resolve => {
      const newNotice = {
        ...noticeData,
        noticeId: 'NTC-' + Math.random().toString(36).substring(2, 8).toUpperCase(),
        timestamp: Date.now()
      };
      this.notices.unshift(newNotice);
      this.notifySubscribers();
      resolve(newNotice);
    });
  }

  async deleteNotice(noticeId) {
    this.notices = this.notices.filter(n => n.noticeId !== noticeId);
    this.notifySubscribers();
    return true;
  }

  subscribe(callback) {
    this.subscribers.push(callback);
    callback(this.notices);
  }

  unsubscribe(callback) {
    this.subscribers = this.subscribers.filter(sub => sub !== callback);
  }

  notifySubscribers() {
    const sorted = [...this.notices].sort((a, b) => b.timestamp - a.timestamp);
    this.subscribers.forEach(cb => cb(sorted));
  }
}

// Instantiate Repository Singleton
const noticeRepository = new MockNoticeRepository();

// ==========================================
// 2. STATE & CONFIGURATION
// ==========================================

const APP_STATE = {
  currentRole: 'STUDENT', // 'STUDENT' | 'TEACHER' | 'DEPT_ADMIN' | 'ADMIN'
  currentUser: {
    userId: 'STU-1001',
    name: 'Alex Smith',
    role: 'STUDENT',
    departmentId: 'CSE'
  },
  selectedCategory: 'ALL',
  selectedDepartment: 'ALL',
  searchQuery: '',
  activeFilterTab: 'all',
  theme: localStorage.getItem('notifyy_theme') || 'light'
};

const ROLES_CONFIG = {
  STUDENT: {
    title: 'Student Portal',
    userName: 'Alex Smith',
    userDept: 'CSE • Batch 2024',
    avatar: 'AS',
    canPublish: false
  },
  TEACHER: {
    title: 'Faculty Portal',
    userName: 'Prof. Alan Turing',
    userDept: 'Computer Science Dept',
    avatar: 'AT',
    canPublish: true
  },
  DEPT_ADMIN: {
    title: 'Department HOD',
    userName: 'Dr. Ada Lovelace',
    userDept: 'Head of CSE Department',
    avatar: 'AL',
    canPublish: true
  },
  ADMIN: {
    title: 'University Admin',
    userName: 'Dr. Robert Vance',
    userDept: 'Office of the Registrar',
    avatar: 'RV',
    canPublish: true
  }
};

// ==========================================
// 3. UI RENDERING & FORMATTING HELPERS
// ==========================================

function formatRelativeTime(timestamp) {
  const diff = Math.max(0, Date.now() - timestamp);
  const minutes = Math.floor(diff / (1000 * 60));
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));

  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return new Date(timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function getCategoryBadgeLabel(category) {
  switch (category) {
    case 'URGENT': return '⚠️ Urgent Alert';
    case 'EXAM': return '📝 Exam Routine';
    case 'EVENT': return '🗓️ Event';
    case 'ANNOUNCEMENT':
    default:
      return '📢 Announcement';
  }
}

function showToast(message, type = 'info') {
  const container = document.getElementById('toastContainer');
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `<span>📢</span> <div>${message}</div>`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

// ==========================================
// 4. NOTICE CARD GENERATOR & DOM RENDERER
// ==========================================

function renderNoticeCards(notices) {
  const container = document.getElementById('noticesContainer');
  const emptyState = document.getElementById('emptyState');

  const isSuperAdmin = APP_STATE.currentUser.role === 'ADMIN';
  const userDept = (APP_STATE.currentUser.departmentId || 'CSE').toUpperCase();

  // STRICT MULTI-TENANT DEPARTMENTAL ISOLATION:
  // Non-admin roles (Students, Faculty, HODs) must NEVER see another department's notices.
  // They can ONLY see notices targeted to their own department OR 'ALL' (Campus-Wide).
  const permittedNotices = notices.filter(notice => {
    if (isSuperAdmin) return true;
    const target = (notice.targetDepartment || 'ALL').toUpperCase();
    return target === 'ALL' || target === userDept;
  });

  // Filter permitted notices according to UI filters
  const filtered = permittedNotices.filter(notice => {
    const noticeDept = (notice.targetDepartment || 'ALL').toUpperCase();

    // Category match
    const matchCategory = (APP_STATE.selectedCategory === 'ALL' || notice.category === APP_STATE.selectedCategory);

    // Department match from dropdown
    let matchDept = true;
    if (isSuperAdmin) {
      matchDept = (APP_STATE.selectedDepartment === 'ALL' || noticeDept === APP_STATE.selectedDepartment);
    } else {
      if (APP_STATE.selectedDepartment === 'MY_DEPT') {
        matchDept = (noticeDept === userDept);
      } else if (APP_STATE.selectedDepartment === 'CAMPUS') {
        matchDept = (noticeDept === 'ALL');
      } else {
        matchDept = (noticeDept === 'ALL' || noticeDept === userDept);
      }
    }

    // Filter tab shortcuts
    let matchTab = true;
    if (APP_STATE.activeFilterTab === 'urgent') matchTab = (notice.category === 'URGENT');
    if (APP_STATE.activeFilterTab === 'exams') matchTab = (notice.category === 'EXAM');
    if (APP_STATE.activeFilterTab === 'events') matchTab = (notice.category === 'EVENT');
    if (APP_STATE.activeFilterTab === 'my-dept') matchTab = (noticeDept === userDept);

    // Search Query match
    const q = APP_STATE.searchQuery.toLowerCase().trim();
    const matchSearch = !q || (
      notice.title.toLowerCase().includes(q) ||
      notice.content.toLowerCase().includes(q) ||
      notice.publisherName.toLowerCase().includes(q) ||
      noticeDept.includes(q.toUpperCase())
    );

    return matchCategory && matchDept && matchTab && matchSearch;
  });

  // Update counts strictly based on permitted notices (no cross-department leakage)
  document.getElementById('totalNoticeCount').textContent = permittedNotices.length;
  document.getElementById('statTotalNotices').textContent = permittedNotices.length;
  document.getElementById('urgentCount').textContent = permittedNotices.filter(n => n.category === 'URGENT').length;
  document.getElementById('statUrgentNotices').textContent = permittedNotices.filter(n => n.category === 'URGENT').length;

  if (filtered.length === 0) {
    container.innerHTML = '';
    emptyState.style.display = 'block';
    return;
  }

  emptyState.style.display = 'none';

  container.innerHTML = filtered.map(notice => `
    <article class="notice-card" data-id="${notice.noticeId}">
      <div class="notice-header">
        <div class="badge-group">
          <span class="badge ${notice.category}">${getCategoryBadgeLabel(notice.category)}</span>
          <span class="badge-dept">${notice.targetDepartment === 'ALL' ? 'Campus-Wide' : notice.targetDepartment}</span>
        </div>
        <span class="notice-time">${formatRelativeTime(notice.timestamp)}</span>
      </div>

      <h4 class="notice-title">${escapeHtml(notice.title)}</h4>
      <p class="notice-snippet">${escapeHtml(notice.content)}</p>

      ${notice.attachment ? `
        <div class="notice-attachment-pill" data-id="${notice.noticeId}" title="Click to read attached document inside portal">
          <span class="attachment-icon">${notice.attachment.type === 'PDF' ? '📄' : '📝'}</span>
          <span class="attachment-name">${escapeHtml(notice.attachment.name)}</span>
          <span class="attachment-size">${notice.attachment.size}</span>
          <span class="attachment-view-action">Read Document ↗</span>
        </div>
      ` : ''}

      <div class="notice-footer">
        <div class="publisher-info">
          <h5>${escapeHtml(notice.publisherName)}</h5>
          <p>Audience: ${escapeHtml(notice.targetAudience)}</p>
        </div>
        <div class="card-actions">
          <button class="card-action-btn btn-copy" title="Copy Notice Text" data-id="${notice.noticeId}">📋</button>
          <button class="card-action-btn btn-share" title="Share Notice" data-id="${notice.noticeId}">🔗</button>
        </div>
      </div>
    </article>
  `).join('');

  // Attach card event listeners
  container.querySelectorAll('.notice-card').forEach(card => {
    card.addEventListener('click', (e) => {
      if (e.target.closest('.card-action-btn') || e.target.closest('.notice-attachment-pill')) return;
      const noticeId = card.dataset.id;
      const notice = notices.find(n => n.noticeId === noticeId);
      if (notice) openDetailsModal(notice);
    });
  });

  // Attach directly to attachment pills
  container.querySelectorAll('.notice-attachment-pill').forEach(pill => {
    pill.addEventListener('click', (e) => {
      e.stopPropagation();
      const noticeId = pill.dataset.id;
      const notice = notices.find(n => n.noticeId === noticeId);
      if (notice) openDocViewerModal(notice);
    });
  });

  container.querySelectorAll('.btn-copy').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const noticeId = btn.dataset.id;
      const notice = notices.find(n => n.noticeId === noticeId);
      if (notice) copyNoticeToClipboard(notice);
    });
  });

  container.querySelectorAll('.btn-share').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const noticeId = btn.dataset.id;
      const notice = notices.find(n => n.noticeId === noticeId);
      if (notice) shareNotice(notice);
    });
  });
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// ==========================================
// 5. MODAL & INTERACTION HANDLERS
// ==========================================

let activeModalNotice = null;
let currentDocZoom = 1.0;

function openDetailsModal(notice) {
  activeModalNotice = notice;
  const modal = document.getElementById('detailsModal');
  const catBadge = document.getElementById('modalCategoryBadge');
  catBadge.className = `badge ${notice.category}`;
  catBadge.textContent = getCategoryBadgeLabel(notice.category);

  document.getElementById('modalDeptBadge').textContent = notice.targetDepartment === 'ALL' ? 'Campus-Wide' : notice.targetDepartment + ' Dept';
  document.getElementById('modalNoticeTitle').textContent = notice.title;
  document.getElementById('modalPublisher').textContent = notice.publisherName;
  document.getElementById('modalAudience').textContent = notice.targetAudience;
  document.getElementById('modalTimestamp').textContent = new Date(notice.timestamp).toLocaleString();
  document.getElementById('modalNoticeContent').textContent = notice.content;

  // Document Attachment & In-Modal Preview Section
  const attachCard = document.getElementById('detailsAttachmentCard');
  const inmodalDocPreview = document.getElementById('inmodalDocPreview');
  const inmodalDocBody = document.getElementById('inmodalDocBody');

  if (notice.attachment) {
    attachCard.style.display = 'flex';
    document.getElementById('modalAttachIcon').textContent = notice.attachment.type === 'PDF' ? '📄' : '📝';
    document.getElementById('modalAttachName').textContent = notice.attachment.name;
    document.getElementById('modalAttachMeta').textContent = `${notice.attachment.size} • Official Institutional Document`;

    // Render inside modal preview so users can view the PDF/document directly without leaving modal
    if (inmodalDocPreview && inmodalDocBody) {
      inmodalDocPreview.style.display = 'block';
      if (notice.attachment.dataUrl) {
        inmodalDocBody.innerHTML = `
          <iframe src="${notice.attachment.dataUrl}" style="width: 100%; height: 350px; border: 1px solid var(--border); border-radius: 8px; background: white;" title="Document PDF Preview"></iframe>
        `;
      } else if (notice.attachment.table) {
        inmodalDocBody.innerHTML = `
          <div style="font-weight: 600; margin-bottom: 10px; color: var(--primary); font-size: 0.88rem; letter-spacing: 0.5px;">
            ${escapeHtml(notice.attachment.headline || notice.title)}
          </div>
          ${notice.attachment.table}
        `;
      } else {
        inmodalDocBody.innerHTML = `
          <div style="padding: 16px; background: var(--surface); border-radius: 8px; border: 1px dashed var(--border); color: var(--text-secondary); font-size: 0.88rem;">
            📄 Official institutional document attached (<strong>${escapeHtml(notice.attachment.name)}</strong>). Click "View Fullscreen PDF" below to view the signed letterhead and verification seal.
          </div>
        `;
      }
    }
  } else {
    attachCard.style.display = 'none';
    if (inmodalDocPreview) inmodalDocPreview.style.display = 'none';
  }

  modal.style.display = 'flex';
}

function openDocViewerModal(notice) {
  if (!notice || !notice.attachment) return;
  const modal = document.getElementById('docViewerModal');
  const attach = notice.attachment;

  document.getElementById('viewerTypeIcon').textContent = attach.type === 'PDF' ? '📄' : '📝';
  document.getElementById('viewerDocTitle').textContent = attach.name;

  const realPdfIframe = document.getElementById('realPdfIframe');
  const docSheet = document.getElementById('docSheet');
  const pageTabs = document.getElementById('docPageTabs');
  const page2Content = document.getElementById('docViewerPage2Content');
  const btnTab1 = document.getElementById('btnTabDocPage1');
  const btnTab2 = document.getElementById('btnTabDocPage2');
  const mainParagraph = document.getElementById('docViewerParagraph');
  const tableWrapper = document.getElementById('docTableWrapper');

  if (attach.dataUrl) {
    // Real uploaded PDF / file preview
    if (realPdfIframe) {
      realPdfIframe.src = attach.dataUrl;
      realPdfIframe.style.display = 'block';
    }
    if (docSheet) docSheet.style.display = 'none';
    if (pageTabs) pageTabs.style.display = 'none';
  } else {
    // Institutional formatted Document Sheet
    if (realPdfIframe) {
      realPdfIframe.src = '';
      realPdfIframe.style.display = 'none';
    }
    if (docSheet) docSheet.style.display = 'block';
    if (pageTabs) pageTabs.style.display = 'flex';

    document.getElementById('docViewerDate').textContent = 'Date: ' + new Date(notice.timestamp).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
    document.getElementById('docViewerHeadline').textContent = attach.headline || notice.title.toUpperCase();
    document.getElementById('docViewerParagraph').textContent = notice.content;
    document.getElementById('docViewerSignee').textContent = notice.publisherName;

    if (attach.table) {
      tableWrapper.innerHTML = attach.table;
      tableWrapper.style.display = 'block';
    } else {
      tableWrapper.innerHTML = '';
      tableWrapper.style.display = 'none';
    }

    // Default to page 1
    if (btnTab1) btnTab1.classList.add('active');
    if (btnTab2) btnTab2.classList.remove('active');
    if (page2Content) page2Content.style.display = 'none';
    if (mainParagraph) mainParagraph.style.display = 'block';
  }

  currentDocZoom = 1.0;
  updateDocZoom();

  modal.style.display = 'flex';
}

function downloadDocumentFile(notice) {
  if (!notice || !notice.attachment) return;
  const attach = notice.attachment;
  const fileName = attach.name || 'Notice_Document.pdf';

  if (attach.dataUrl) {
    const a = document.createElement('a');
    a.href = attach.dataUrl;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    showToast(`⬇️ Downloaded official file: ${fileName}`);
    return;
  }

  // Generate an authentic downloadable HTML official institutional document copy
  const htmlContent = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${escapeHtml(fileName)}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Georgia, serif; padding: 40px; color: #111; max-width: 820px; margin: 0 auto; background: #fff; }
    .header { text-align: center; border-bottom: 3px double #333; padding-bottom: 16px; margin-bottom: 24px; }
    .header h1 { font-size: 20px; letter-spacing: 1px; margin: 0; color: #0f172a; }
    .header p { margin: 6px 0 0; font-size: 13px; color: #475569; font-weight: 500; }
    .meta { display: flex; justify-content: space-between; font-size: 13px; font-weight: bold; margin-bottom: 20px; color: #334155; }
    .headline { font-size: 16px; font-weight: bold; text-decoration: underline; text-align: center; margin: 25px 0 16px; color: #0284c7; }
    .content { font-size: 14.5px; line-height: 1.65; text-align: justify; margin-bottom: 20px; }
    table { width: 100%; border-collapse: collapse; margin: 20px 0; font-size: 13px; }
    th, td { border: 1px solid #cbd5e1; padding: 9px 12px; text-align: left; }
    th { background-color: #f1f5f9; color: #0f172a; font-weight: 600; }
    .footer { margin-top: 50px; display: flex; justify-content: space-between; align-items: flex-end; }
    .seal { border: 2px solid #0284c7; color: #0284c7; padding: 12px 18px; font-weight: bold; text-align: center; border-radius: 6px; font-size: 11px; letter-spacing: 1px; }
    .sig { text-align: center; border-top: 1px solid #64748b; padding-top: 6px; min-width: 220px; font-size: 13px; }
  </style>
</head>
<body>
  <div class="header">
    <h1>METROPOLITAN UNIVERSITY OF TECHNOLOGY</h1>
    <p>OFFICE OF THE REGISTRAR &amp; CONTROLLER OF EXAMINATIONS</p>
  </div>
  <div class="meta">
    <span>Ref: MUT/PUB/2026/0491</span>
    <span>Date: ${new Date(notice.timestamp).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</span>
  </div>
  <div class="headline">${escapeHtml(attach.headline || notice.title)}</div>
  <div class="content">${escapeHtml(notice.content)}</div>
  ${attach.table || ''}
  <div class="footer">
    <div class="seal">★ OFFICIAL SEAL ★<br>VERIFIED INSTITUTIONAL NOTICE</div>
    <div class="sig">
      <strong>${escapeHtml(notice.publisherName)}</strong><br>
      Authorized Institutional Signatory
    </div>
  </div>
</body>
</html>`;

  const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName.endsWith('.html') ? fileName : fileName.replace(/\.(pdf|docx)$/i, '') + '_Official.html';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  showToast(`⬇️ Downloaded institutional document: ${fileName}`);
}

function updateDocZoom() {
  const sheet = document.getElementById('docSheet');
  if (sheet) sheet.style.transform = `scale(${currentDocZoom})`;
  const label = document.getElementById('zoomLevel');
  if (label) label.textContent = `${Math.round(currentDocZoom * 100)}%`;
}

function copyNoticeToClipboard(notice) {
  const text = `${notice.title}\n\n${notice.content}\n\n— Published by ${notice.publisherName} via Notifyy`;
  navigator.clipboard.writeText(text).then(() => {
    showToast('📋 Notice copied to clipboard!');
  }).catch(() => {
    showToast('Failed to copy text', 'error');
  });
}

function shareNotice(notice) {
  const shareData = {
    title: notice.title,
    text: `${notice.title}\n\n${notice.content}\n\nTarget: ${notice.targetAudience}`,
    url: window.location.href
  };

  if (navigator.share) {
    navigator.share(shareData).catch(() => {});
  } else {
    copyNoticeToClipboard(notice);
    showToast('🔗 Notice details copied for sharing!');
  }
}

const ROLE_EMAILS = {
  STUDENT: 'student@univ.edu',
  TEACHER: 'faculty@univ.edu',
  DEPT_ADMIN: 'hod@univ.edu',
  ADMIN: 'admin@univ.edu'
};

const DEPT_NAMES = {
  CSE: 'Computer Science & Engineering (CSE)',
  EEE: 'Electrical & Electronic Engineering (EEE)',
  BBA: 'School of Business Administration (BBA)',
  LAW: 'Department of Law & Justice (LAW)',
  ALL: 'Campus-Wide / All Departments'
};

// Strict Role-Based Access Control & Departmental Multi-Tenancy Applier
function applyUserRole(role, email, deptId = 'CSE') {
  APP_STATE.currentRole = role;

  // University Admin oversees the whole institution; non-admins are assigned a department
  const userDept = role === 'ADMIN' ? 'ALL' : (deptId || 'CSE').toUpperCase();
  APP_STATE.currentUser.role = role;
  APP_STATE.currentUser.departmentId = userDept;
  APP_STATE.currentUser.email = email || ROLE_EMAILS[role];

  // Dynamic role identity adapting to assigned department
  const deptShort = userDept === 'ALL' ? 'Central' : userDept;
  const deptFull = DEPT_NAMES[userDept] || userDept;

  if (role === 'STUDENT') {
    APP_STATE.currentUser.name = `Alex Smith (${deptShort})`;
    APP_STATE.currentUser.userDept = `${deptShort} • Batch 2024`;
    APP_STATE.currentUser.avatar = 'AS';
    APP_STATE.currentUser.canPublish = false;
  } else if (role === 'TEACHER') {
    APP_STATE.currentUser.name = `Prof. Alan Turing (${deptShort})`;
    APP_STATE.currentUser.userDept = `${deptShort} Faculty Member`;
    APP_STATE.currentUser.avatar = 'AT';
    APP_STATE.currentUser.canPublish = true;
  } else if (role === 'DEPT_ADMIN') {
    APP_STATE.currentUser.name = `Dr. Ada Lovelace (${deptShort} HOD)`;
    APP_STATE.currentUser.userDept = `Head of ${deptShort} Department`;
    APP_STATE.currentUser.avatar = 'AL';
    APP_STATE.currentUser.canPublish = true;
  } else {
    APP_STATE.currentUser.name = 'Dr. Robert Vance (Registrar)';
    APP_STATE.currentUser.userDept = 'Office of the University Registrar';
    APP_STATE.currentUser.avatar = 'RV';
    APP_STATE.currentUser.canPublish = true;
  }

  // Update UI Elements
  const badge = document.getElementById('currentRoleBadge');
  if (badge) {
    const titles = {
      STUDENT: `Student Portal (${deptShort})`,
      TEACHER: `Faculty Portal (${deptShort})`,
      DEPT_ADMIN: `HOD Portal (${deptShort})`,
      ADMIN: 'University Admin'
    };
    badge.textContent = titles[role] || role;
  }

  const nameEl = document.getElementById('userName');
  if (nameEl) nameEl.textContent = APP_STATE.currentUser.name;

  const subEl = document.getElementById('userSubtext');
  if (subEl) subEl.textContent = APP_STATE.currentUser.userDept;

  const avatar = document.getElementById('userAvatar');
  if (avatar) avatar.textContent = APP_STATE.currentUser.avatar;

  // Strict Read-Only Active Tier Badge Updates
  const activeTierPill = document.getElementById('activeTierPill');
  const activeTierAccessTag = document.getElementById('activeTierAccessTag');
  const activeTierFootnote = document.getElementById('activeTierFootnote');

  if (activeTierPill) {
    const roleLabels = {
      STUDENT: `🎓 Student (${deptShort})`,
      TEACHER: `👨‍🏫 Faculty (${deptShort})`,
      DEPT_ADMIN: `🏛️ HOD (${deptShort})`,
      ADMIN: '🛡️ University Admin'
    };
    activeTierPill.textContent = roleLabels[role] || role;
  }

  if (activeTierAccessTag) {
    activeTierAccessTag.textContent = role === 'ADMIN' ? 'Super Admin' : `${deptShort} Isolated`;
  }

  if (activeTierFootnote) {
    activeTierFootnote.textContent = role === 'STUDENT'
      ? `🔒 Department isolation active. Viewing ${deptShort} & Campus notices only.`
      : role === 'ADMIN'
        ? '🛡️ Full institutional privileges. Cross-department visibility active.'
        : `🔒 Authenticated for ${deptShort}. Viewing ${deptShort} & Campus notices only.`;
  }

  // Publisher button strictly controlled by RBAC
  const publisherSection = document.getElementById('publisherSection');
  if (publisherSection) {
    publisherSection.style.display = APP_STATE.currentUser.canPublish ? 'block' : 'none';
  }

  // Restrict composer department selection according to role
  const composeDept = document.getElementById('composeDept');
  if (composeDept) {
    if (role === 'TEACHER') {
      composeDept.innerHTML = `
        <option value="${userDept}" selected>${deptFull}</option>
      `;
    } else if (role === 'DEPT_ADMIN') {
      composeDept.innerHTML = `
        <option value="${userDept}" selected>${deptFull}</option>
        <option value="ALL">Campus-Wide (All Faculty & Students)</option>
      `;
    } else {
      composeDept.innerHTML = `
        <option value="ALL" selected>Campus-Wide (All Faculty & Students)</option>
        <option value="CSE">Computer Science & Engineering (CSE)</option>
        <option value="EEE">Electrical & Electronic Engineering (EEE)</option>
        <option value="BBA">School of Business Administration (BBA)</option>
        <option value="LAW">Department of Law & Justice (LAW)</option>
      `;
    }
  }

  // Populate department filter in Top Bar with strict role scoping
  const deptSelect = document.getElementById('deptSelect');
  if (deptSelect) {
    if (role === 'ADMIN') {
      deptSelect.innerHTML = `
        <option value="ALL" selected>All Departments</option>
        <option value="CSE">Computer Science (CSE)</option>
        <option value="EEE">Electrical Engineering (EEE)</option>
        <option value="BBA">Business Administration (BBA)</option>
        <option value="LAW">School of Law (LAW)</option>
      `;
    } else {
      deptSelect.innerHTML = `
        <option value="ALL" selected>All My Notices (${deptShort} + Campus)</option>
        <option value="MY_DEPT">${deptShort} Department Only</option>
        <option value="CAMPUS">Campus-Wide Broadcasts Only</option>
      `;
    }
    APP_STATE.selectedDepartment = 'ALL';
  }

  // Re-render feed
  noticeRepository.getAllNotices().then(renderNoticeCards);
}

function showAuthScreen() {
  document.getElementById('authScreen').style.display = 'flex';
  document.getElementById('dashboardScreen').style.display = 'none';
}

function showDashboardScreen() {
  document.getElementById('authScreen').style.display = 'none';
  document.getElementById('dashboardScreen').style.display = 'flex';
}

// Active attachment state in composer
let activeComposedAttachment = null;

function setComposedAttachment(name, size, type, headline = null, table = null, dataUrl = null) {
  activeComposedAttachment = { name, size, type, headline, table, dataUrl };
  const icon = type === 'PDF' ? '📄' : '📝';
  document.getElementById('selectedFileIcon').textContent = icon;
  document.getElementById('selectedFileName').textContent = name;
  document.getElementById('selectedFileSize').textContent = size;
  document.getElementById('dropzonePrompt').style.display = 'none';
  document.getElementById('dropzoneSelected').style.display = 'flex';
}

function clearComposedAttachment() {
  activeComposedAttachment = null;
  const input = document.getElementById('composeAttachmentInput');
  if (input) input.value = '';
  document.getElementById('dropzonePrompt').style.display = 'flex';
  document.getElementById('dropzoneSelected').style.display = 'none';
}

// ==========================================
// 6. EVENT LISTENERS & INITIALIZATION
// ==========================================

document.addEventListener('DOMContentLoaded', () => {

  // 1. Theme Setup
  document.documentElement.setAttribute('data-theme', APP_STATE.theme);
  document.getElementById('btnThemeToggle').addEventListener('click', () => {
    APP_STATE.theme = APP_STATE.theme === 'light' ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', APP_STATE.theme);
    localStorage.setItem('notifyy_theme', APP_STATE.theme);
  });

  // 2. Auth Role Tabs & Department Handling
  let selectedAuthRole = 'STUDENT';
  const authRoleTabs = document.getElementById('authRoleTabs');
  const authDeptGroup = document.getElementById('authDeptGroup');
  const authDeptSelect = document.getElementById('authDepartment');

  const updateLoginEmailPlaceholder = () => {
    const emailInput = document.getElementById('loginEmail');
    if (!emailInput) return;
    const curDept = (authDeptSelect ? authDeptSelect.value : 'CSE').toLowerCase();
    if (selectedAuthRole === 'ADMIN') {
      emailInput.value = 'admin@univ.edu';
    } else if (selectedAuthRole === 'STUDENT') {
      emailInput.value = `student.${curDept}@univ.edu`;
    } else if (selectedAuthRole === 'TEACHER') {
      emailInput.value = `faculty.${curDept}@univ.edu`;
    } else if (selectedAuthRole === 'DEPT_ADMIN') {
      emailInput.value = `hod.${curDept}@univ.edu`;
    }
  };

  if (authRoleTabs) {
    authRoleTabs.addEventListener('click', (e) => {
      const tab = e.target.closest('.role-tab');
      if (!tab) return;
      authRoleTabs.querySelectorAll('.role-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      selectedAuthRole = tab.dataset.role;

      if (selectedAuthRole === 'ADMIN') {
        if (authDeptGroup) authDeptGroup.style.display = 'none';
      } else {
        if (authDeptGroup) authDeptGroup.style.display = 'block';
      }
      updateLoginEmailPlaceholder();
    });
  }

  if (authDeptSelect) {
    authDeptSelect.addEventListener('change', () => {
      updateLoginEmailPlaceholder();
    });
  }

  // 3. Login Form Submit
  const authLoginForm = document.getElementById('authLoginForm');
  if (authLoginForm) {
    authLoginForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const email = document.getElementById('loginEmail').value.trim();
      const deptId = selectedAuthRole === 'ADMIN' ? 'ALL' : (authDeptSelect ? authDeptSelect.value : 'CSE');
      applyUserRole(selectedAuthRole, email, deptId);
      localStorage.setItem('notifyy_session', JSON.stringify({ role: selectedAuthRole, email, deptId }));
      showDashboardScreen();
      showToast(`Welcome to Notifyy! Signed in as ${APP_STATE.currentUser.name}`);
    });
  }

  // 4. Sign Out Handlers
  const handleSignOut = () => {
    localStorage.removeItem('notifyy_session');
    showAuthScreen();
    showToast('Signed out of institutional portal');
  };

  const btnSignOutSidebar = document.getElementById('btnSignOutSidebar');
  if (btnSignOutSidebar) btnSignOutSidebar.addEventListener('click', handleSignOut);

  const btnSignOutTop = document.getElementById('btnSignOutTop');
  if (btnSignOutTop) btnSignOutTop.addEventListener('click', handleSignOut);

  // Check existing session or initialize default
  const savedSession = localStorage.getItem('notifyy_session');
  if (savedSession) {
    try {
      const session = JSON.parse(savedSession);
      applyUserRole(session.role, session.email, session.deptId || 'CSE');
      showDashboardScreen();
    } catch {
      applyUserRole('STUDENT', 'student.cse@univ.edu', 'CSE');
      showDashboardScreen();
    }
  } else {
    applyUserRole('STUDENT', 'student.cse@univ.edu', 'CSE');
    showDashboardScreen();
  }

  // 5. Composer Attachment Dropzone & File Input Handlers
  const fileDropzone = document.getElementById('fileDropzone');
  const fileInput = document.getElementById('composeAttachmentInput');
  const btnRemoveAttachment = document.getElementById('btnRemoveAttachment');

  if (fileDropzone && fileInput) {
    fileDropzone.addEventListener('click', (e) => {
      if (e.target.closest('#btnRemoveAttachment')) return;
      fileInput.click();
    });

    fileInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;

      const sizeStr = file.size > 1024 * 1024 
        ? `${(file.size / (1024 * 1024)).toFixed(1)} MB` 
        : `${Math.round(file.size / 1024)} KB`;

      const type = file.name.toLowerCase().endsWith('.docx') || file.name.toLowerCase().endsWith('.doc') 
        ? 'DOCX' 
        : 'PDF';

      const reader = new FileReader();
      reader.onload = (uploadEvent) => {
        const dataUrl = uploadEvent.target.result;
        setComposedAttachment(
          file.name,
          sizeStr,
          type,
          `OFFICIAL INSTITUTIONAL NOTICE — ${file.name.replace(/\.[^/.]+$/, '').toUpperCase()}`,
          `
            <table>
              <thead>
                <tr><th>Document Property</th><th>Details</th></tr>
              </thead>
              <tbody>
                <tr><td>Uploaded Document</td><td>${escapeHtml(file.name)}</td></tr>
                <tr><td>File Size</td><td>${sizeStr}</td></tr>
                <tr><td>Security Verification</td><td>SHA-256 Verified Institutional Certificate</td></tr>
                <tr><td>Department Seal</td><td>Official Department Seal Authenticated</td></tr>
              </tbody>
            </table>
          `,
          dataUrl
        );
        showToast(`📎 Attached document: ${file.name} (${sizeStr})`);
      };
      reader.readAsDataURL(file);
    });

    // Drag & drop support
    fileDropzone.addEventListener('dragover', (e) => {
      e.preventDefault();
      fileDropzone.style.borderColor = 'var(--primary)';
      fileDropzone.style.backgroundColor = 'var(--primary-light)';
    });

    fileDropzone.addEventListener('dragleave', () => {
      fileDropzone.style.borderColor = '';
      fileDropzone.style.backgroundColor = '';
    });

    fileDropzone.addEventListener('drop', (e) => {
      e.preventDefault();
      fileDropzone.style.borderColor = '';
      fileDropzone.style.backgroundColor = '';
      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        fileInput.files = e.dataTransfer.files;
        const event = new Event('change');
        fileInput.dispatchEvent(event);
      }
    });
  }

  if (btnRemoveAttachment) {
    btnRemoveAttachment.addEventListener('click', (e) => {
      e.stopPropagation();
      clearComposedAttachment();
      showToast('Attachment removed from notice');
    });
  }

  // Quick Preset Sample Documents
  document.querySelectorAll('.sample-file-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const name = btn.dataset.name;
      const type = btn.dataset.type;
      const size = btn.dataset.size;

      let tableContent = null;
      if (name.includes('Exam_Routine')) {
        tableContent = `
          <table>
            <thead>
              <tr><th>Course Code</th><th>Course Title</th><th>Exam Date</th><th>Time Slot</th><th>Assigned Hall</th></tr>
            </thead>
            <tbody>
              <tr><td>CSE 420</td><td>Distributed Systems</td><td>April 05, 2026</td><td>09:30 AM - 12:30 PM</td><td>Auditorium 2</td></tr>
              <tr><td>CSE 312</td><td>Operating Systems</td><td>April 08, 2026</td><td>01:30 PM - 04:30 PM</td><td>Computer Lab 4 &amp; 5</td></tr>
              <tr><td>CSE 211</td><td>Data Structures &amp; Algorithms</td><td>April 12, 2026</td><td>09:30 AM - 12:30 PM</td><td>Hall 304, 305</td></tr>
            </tbody>
          </table>
        `;
      } else if (name.includes('Rubric')) {
        tableContent = `
          <table>
            <thead>
              <tr><th>Criterion</th><th>Weight</th><th>Evaluation Standard</th></tr>
            </thead>
            <tbody>
              <tr><td>Correctness &amp; Concurrency</td><td>40%</td><td>Thread-safe synchronization passing all test suites</td></tr>
              <tr><td>Code Architecture &amp; Modularization</td><td>30%</td><td>Clean SOLID principles, zero memory leaks</td></tr>
              <tr><td>Technical Report</td><td>30%</td><td>Benchmarking performance and profiling graphs</td></tr>
            </tbody>
          </table>
        `;
      } else {
        tableContent = `
          <table>
            <thead>
              <tr><th>Section</th><th>Directive</th><th>Target Audience</th></tr>
            </thead>
            <tbody>
              <tr><td>Section 1</td><td>Compliance with campus electrical energy saving protocols</td><td>All Academic Buildings</td></tr>
              <tr><td>Section 2</td><td>Emergency power backup routing for research laboratories</td><td>Faculty and Researchers</td></tr>
            </tbody>
          </table>
        `;
      }

      setComposedAttachment(name, size, type, `OFFICIAL DOCUMENT: ${name.toUpperCase()}`, tableContent);
      showToast(`📎 Attached sample: ${name}`);
    });
  });

  // 3. Category Filter Chips
  const categoryChips = document.getElementById('categoryChips');
  categoryChips.addEventListener('click', (e) => {
    const chip = e.target.closest('.chip');
    if (!chip) return;
    categoryChips.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
    chip.classList.add('active');
    APP_STATE.selectedCategory = chip.dataset.category;
    noticeRepository.getAllNotices().then(renderNoticeCards);
  });

  // 4. Department Filter
  document.getElementById('deptSelect').addEventListener('change', (e) => {
    APP_STATE.selectedDepartment = e.target.value;
    noticeRepository.getAllNotices().then(renderNoticeCards);
  });

  // 5. Sidebar Nav Filter Tabs
  document.querySelectorAll('.nav-menu .nav-item').forEach(item => {
    item.addEventListener('click', () => {
      document.querySelectorAll('.nav-menu .nav-item').forEach(i => i.classList.remove('active'));
      item.classList.add('active');
      APP_STATE.activeFilterTab = item.dataset.filter;
      noticeRepository.getAllNotices().then(renderNoticeCards);
    });
  });

  // 6. Global Search with Clear Button
  const searchInput = document.getElementById('globalSearchInput');
  const clearBtn = document.getElementById('btnClearSearch');

  searchInput.addEventListener('input', (e) => {
    APP_STATE.searchQuery = e.target.value;
    clearBtn.style.display = APP_STATE.searchQuery ? 'block' : 'none';
    noticeRepository.getAllNotices().then(renderNoticeCards);
  });

  clearBtn.addEventListener('click', () => {
    searchInput.value = '';
    APP_STATE.searchQuery = '';
    clearBtn.style.display = 'none';
    noticeRepository.getAllNotices().then(renderNoticeCards);
  });

  document.getElementById('btnResetFilters').addEventListener('click', () => {
    APP_STATE.selectedCategory = 'ALL';
    APP_STATE.selectedDepartment = 'ALL';
    APP_STATE.searchQuery = '';
    APP_STATE.activeFilterTab = 'all';

    categoryChips.querySelectorAll('.chip').forEach((c, idx) => {
      c.classList.toggle('active', idx === 0);
    });
    document.getElementById('deptSelect').value = 'ALL';
    searchInput.value = '';
    clearBtn.style.display = 'none';

    noticeRepository.getAllNotices().then(renderNoticeCards);
  });

  // 7. Modal Handlers
  const composerModal = document.getElementById('composerModal');
  const detailsModal = document.getElementById('detailsModal');
  const docViewerModal = document.getElementById('docViewerModal');

  document.getElementById('btnOpenComposer').addEventListener('click', () => {
    composerModal.style.display = 'flex';
  });

  document.getElementById('btnCloseComposer').addEventListener('click', () => {
    composerModal.style.display = 'none';
  });

  document.getElementById('btnCancelCompose').addEventListener('click', () => {
    composerModal.style.display = 'none';
  });

  document.getElementById('btnCloseDetails').addEventListener('click', () => {
    detailsModal.style.display = 'none';
  });

  document.getElementById('btnCopyModalNotice').addEventListener('click', () => {
    if (activeModalNotice) copyNoticeToClipboard(activeModalNotice);
  });

  document.getElementById('btnShareModalNotice').addEventListener('click', () => {
    if (activeModalNotice) shareNotice(activeModalNotice);
  });

  // Attachment Actions in Details Modal
  const btnOpenDocViewer = document.getElementById('btnOpenDocViewer');
  if (btnOpenDocViewer) {
    btnOpenDocViewer.addEventListener('click', () => {
      if (activeModalNotice && activeModalNotice.attachment) {
        openDocViewerModal(activeModalNotice);
      }
    });
  }

  const btnDownloadAttachment = document.getElementById('btnDownloadAttachment');
  if (btnDownloadAttachment) {
    btnDownloadAttachment.addEventListener('click', () => {
      if (activeModalNotice && activeModalNotice.attachment) {
        downloadDocumentFile(activeModalNotice);
      }
    });
  }

  // In-App Document Viewer Controls
  const btnCloseDocViewer = document.getElementById('btnCloseDocViewer');
  if (btnCloseDocViewer) {
    btnCloseDocViewer.addEventListener('click', () => {
      docViewerModal.style.display = 'none';
    });
  }

  // Multi-Page Document Tabs
  const btnTabDocPage1 = document.getElementById('btnTabDocPage1');
  const btnTabDocPage2 = document.getElementById('btnTabDocPage2');
  const docViewerPage2Content = document.getElementById('docViewerPage2Content');
  const docViewerParagraph = document.getElementById('docViewerParagraph');
  const docTableWrapper = document.getElementById('docTableWrapper');

  if (btnTabDocPage1 && btnTabDocPage2) {
    btnTabDocPage1.addEventListener('click', () => {
      btnTabDocPage1.classList.add('active');
      btnTabDocPage2.classList.remove('active');
      if (docViewerPage2Content) docViewerPage2Content.style.display = 'none';
      if (docViewerParagraph) docViewerParagraph.style.display = 'block';
      if (docTableWrapper && docTableWrapper.innerHTML.trim()) {
        docTableWrapper.style.display = 'block';
      }
    });

    btnTabDocPage2.addEventListener('click', () => {
      btnTabDocPage2.classList.add('active');
      btnTabDocPage1.classList.remove('active');
      if (docViewerPage2Content) docViewerPage2Content.style.display = 'block';
      if (docViewerParagraph) docViewerParagraph.style.display = 'none';
      if (docTableWrapper) docTableWrapper.style.display = 'none';
    });
  }

  const btnZoomIn = document.getElementById('btnZoomIn');
  if (btnZoomIn) {
    btnZoomIn.addEventListener('click', () => {
      if (currentDocZoom < 1.4) {
        currentDocZoom += 0.1;
        updateDocZoom();
      }
    });
  }

  const btnZoomOut = document.getElementById('btnZoomOut');
  if (btnZoomOut) {
    btnZoomOut.addEventListener('click', () => {
      if (currentDocZoom > 0.7) {
        currentDocZoom -= 0.1;
        updateDocZoom();
      }
    });
  }

  const btnViewerPrint = document.getElementById('btnViewerPrint');
  if (btnViewerPrint) {
    btnViewerPrint.addEventListener('click', () => {
      const realPdfIframe = document.getElementById('realPdfIframe');
      if (realPdfIframe && realPdfIframe.style.display !== 'none' && realPdfIframe.contentWindow) {
        try {
          realPdfIframe.contentWindow.print();
          return;
        } catch {
          // Fall through to window.print()
        }
      }
      window.print();
    });
  }

  const btnViewerDownload = document.getElementById('btnViewerDownload');
  if (btnViewerDownload) {
    btnViewerDownload.addEventListener('click', () => {
      if (activeModalNotice && activeModalNotice.attachment) {
        downloadDocumentFile(activeModalNotice);
      }
    });
  }

  // Character counters
  const titleInput = document.getElementById('composeTitle');
  const contentInput = document.getElementById('composeContent');
  titleInput.addEventListener('input', () => {
    document.getElementById('titleCharCount').textContent = titleInput.value.length;
  });
  contentInput.addEventListener('input', () => {
    document.getElementById('contentCharCount').textContent = contentInput.value.length;
  });

  // Notice Form Submit
  document.getElementById('noticeComposerForm').addEventListener('submit', async (e) => {
    e.preventDefault();

    const roleConfig = ROLES_CONFIG[APP_STATE.currentRole];
    const category = document.getElementById('composeCategory').value;
    const dept = document.getElementById('composeDept').value;
    const title = titleInput.value.trim();
    const content = contentInput.value.trim();

    const newNotice = {
      title,
      content,
      publisherName: roleConfig.userName,
      publisherRole: APP_STATE.currentRole,
      targetDepartment: dept,
      targetAudience: dept === 'ALL' ? 'Campus-Wide' : `${dept} Department`,
      category,
      urgency: category === 'URGENT' ? 'CRITICAL' : 'NORMAL',
      attachment: activeComposedAttachment ? { ...activeComposedAttachment } : null
    };

    await noticeRepository.publishNotice(newNotice);
    showToast('🚀 Notice broadcasted with official attachment!');

    // Reset and close
    e.target.reset();
    clearComposedAttachment();
    document.getElementById('titleCharCount').textContent = '0';
    document.getElementById('contentCharCount').textContent = '0';
    composerModal.style.display = 'none';
  });

  // 8. Simulation Trigger (Live Real-Time Event Simulation)
  document.getElementById('btnSimulateNotice').addEventListener('click', async () => {
    const simNotices = [
      {
        title: '⚡ Emergency: Weather Alert & Online Shift',
        content: 'Due to severe weather warnings, all in-person classes after 2:00 PM are shifted online via Google Meet. Check class portals for meeting links.',
        publisherName: 'Office of the Vice Chancellor',
        publisherRole: 'ADMIN',
        targetDepartment: 'ALL',
        targetAudience: 'Campus-Wide',
        category: 'URGENT',
        urgency: 'CRITICAL',
        attachment: {
          name: 'Severe_Weather_Contingency_Directive.pdf',
          type: 'PDF',
          size: '680 KB',
          headline: 'EMERGENCY WEATHER CONTINGENCY PLAN',
          table: `
            <table>
              <thead>
                <tr><th>Time Window</th><th>Online Platform</th><th>Support Hotline</th></tr>
              </thead>
              <tbody>
                <tr><td>02:00 PM - 06:00 PM</td><td>Google Meet Institutional</td><td>Ext: 401, 402</td></tr>
              </tbody>
            </table>
          `
        }
      },
      {
        title: '📢 Special Seminar: Generative AI in Healthcare',
        content: 'Distinguished lecture by MIT research fellow on transformer models in genomic medicine. Location: Central Auditorium at 04:00 PM.',
        publisherName: 'CSE Research Committee',
        publisherRole: 'DEPT_ADMIN',
        targetDepartment: 'CSE',
        targetAudience: 'Faculty & Researchers',
        category: 'EVENT',
        urgency: 'NORMAL',
        attachment: {
          name: 'GenAI_Healthcare_Keynote_Abstract.pdf',
          type: 'PDF',
          size: '1.2 MB',
          headline: 'SYMPOSIUM KEYNOTE ABSTRACT & SPEAKER PROFILE'
        }
      }
    ];

    const randomNotice = simNotices[Math.floor(Math.random() * simNotices.length)];
    await noticeRepository.publishNotice(randomNotice);
    showToast('⚡ Live Sync Event: New broadcast received across devices!');
  });

  // 9. Mobile Sidebar Toggle
  const sidebar = document.getElementById('sidebar');
  document.getElementById('btnToggleSidebar').addEventListener('click', () => {
    sidebar.classList.toggle('open');
  });

  // 10. Subscribe to Real-Time Repository Stream
  noticeRepository.subscribe((notices) => {
    renderNoticeCards(notices);
  });
});

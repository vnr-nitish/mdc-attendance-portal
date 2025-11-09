

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, sendPasswordResetEmail, deleteUser, updatePassword } from 'firebase/auth';
import { getFirestore, collection, addDoc, onSnapshot, updateDoc, doc, deleteDoc, setDoc, serverTimestamp, getDoc } from 'firebase/firestore';

const App = () => {
  // State for Firebase services and user information
  const [db, setDb] = useState(null);
  const [auth, setAuth] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [adminPassword, setAdminPassword] = useState('Meta@1234');
  const profileDropdownRef = useRef(null);
  const [remainingTime, setRemainingTime] = useState(1800);


  // State for UI navigation and Admin Panel view
  const [view, setView] = useState('login'); // 'login', 'register', 'userDashboard', 'adminDashboard'
  const [adminView, setAdminView] = useState('dashboard'); // 'dashboard', 'manageUsers', 'attendanceSlots'
  const [showProfileDropdown, setShowProfileDropdown] = useState(false);

  // State for forms and messages
  const [loginForm, setLoginForm] = useState({ email: '', password: '' });
  const [registerForm, setRegisterForm] = useState({
    photo: null, username: '', email: '', contact: '', year: '', regNo: '', program: '', domain: '', position: '', password: ''
  });
  const [message, setMessage] = useState(''); // Global message for main screen
  const [modalMessage, setModalMessage] = useState(''); // Message for inside modals
  const [allUsers, setAllUsers] = useState([]);
  const [editingUser, setEditingUser] = useState(null);
  const [deletingUser, setDeletingUser] = useState(null);
  const [deletingSlot, setDeletingSlot] = useState(null);
  const [showRegistrationSuccess, setShowRegistrationSuccess] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterDomain, setFilterDomain] = useState('all');
  const [filterYear, setFilterYear] = useState('all');
  const [filterPosition, setFilterPosition] = useState('all');


  // State for Attendance Slots
  const [attendanceSlots, setAttendanceSlots] = useState([]);
  const [showCreateSlot, setShowCreateSlot] = useState(false);
  const [newSlotForm, setNewSlotForm] = useState({ slotType: '', slotName: '', date: '', venue: '', timings: '' });
  const [editingSlot, setEditingSlot] = useState(null);
  const [eligibleUsers, setEligibleUsers] = useState([]);
  const [eligibleUserSearch, setEligibleUserSearch] = useState('');
  const [markingAttendanceForSlot, setMarkingAttendanceForSlot] = useState(null);
  const [slotAttendance, setSlotAttendance] = useState([]); // Array of { userId, isPresent }
  const [attendanceSearchTerm, setAttendanceSearchTerm] = useState('');
  const [attendanceFilterDomain, setAttendanceFilterDomain] = useState('all');
  const [attendanceFilterPosition, setAttendanceFilterPosition] = useState('all');
  const previousSlotAttendanceRef = useRef(null);
  const [showUndoToast, setShowUndoToast] = useState(false);
  const undoTimerRef = useRef(null);
  const [slotTypeFilter, setSlotTypeFilter] = useState('all');
  const [slotMonthFilter, setSlotMonthFilter] = useState('all');
  const [slotYearFilter, setSlotYearFilter] = useState('all');
  const [showImportModal, setShowImportModal] = useState(false);
  const [importFile, setImportFile] = useState(null);

  // State for Dashboard
  const [showMemberAttendanceDetails, setShowMemberAttendanceDetails] = useState(false);
  const [selectedMember, setSelectedMember] = useState(null);
  const [showViolationModal, setShowViolationModal] = useState(false);
  const [violationModalMember, setViolationModalMember] = useState(null);
  const [dashboardFilterMonth, setDashboardFilterMonth] = useState('all');
  const [dashboardFilterYear, setDashboardFilterYear] = useState('all');
  const [dashboardFilterDomain, setDashboardFilterDomain] = useState('all');
  const [dashboardFilterPosition, setDashboardFilterPosition] = useState('all');
  const [dashboardFilterAttendance, setDashboardFilterAttendance] = useState('all');

  // User Dashboard State
  const [showEditProfileModal, setShowEditProfileModal] = useState(false);
  const [showChangePasswordModal, setShowChangePasswordModal] = useState(false);
  const [userProfile, setUserProfile] = useState(null);
  const [passwordForm, setPasswordForm] = useState({ currentPassword: '', newPassword: '' });
  const [passwordChangeMessage, setPasswordChangeMessage] = useState('');
  const [userDashboardFilters, setUserDashboardFilters] = useState({ slotType: 'all', status: 'all', fromDate: '', toDate: '' });
  const [showForgotPasswordModal, setShowForgotPasswordModal] = useState(false);

  
  // Your web app's Firebase configuration
  const firebaseConfig = useMemo(() => ({
    apiKey: "AIzaSyDcXyskaSXag5vebXR0BZtoFDZW1-BW5ZQ",
    authDomain: "mdc-attendance-portal.firebaseapp.com",
    projectId: "mdc-attendance-portal",
    storageBucket: "mdc-attendance-portal.firebasestorage.app",
    messagingSenderId: "68450083483",
    appId: "1:68450083483:web:35aa3c2da24aba1a9fdc3e"
  }), []);

  const appId = firebaseConfig.appId;

  // Domain and Position dropdown options (custom order for display)
  const domainPriority = ["EB", "DataVerse", "WebArcs", "CP", "Content", "Design", "PR", "Photography"];
  const yearPriority = ["4th year", "3rd year", "2nd year", "1st year"];
  const positionPriority = [
    "President",
    "Vice President",
    "Secretary",
    "Head of Operations",
    "Technical Head",
    "Creative Head",
    "Domain Lead",
    "Member"
  ];
  const domains = ["WebArcs", "DataVerse", "CP", "Content", "Design", "PR", "Photography", "EB"];
  const positions = ["President", "Vice President", "Secretary", "Head of Operations", "Technical Head", "Creative Head", "Domain Lead", "Member"];
  const years = ["1st year", "2nd year", "3rd year", "4th year"];
  const slotTypes = ["Event", "Domain Meeting", "Core Team Meeting"];
  const slotTypesMap = {
    'event': 'Event',
    'coreteammeeting': 'Core Team Meeting',
    'domainmeeting': 'Domain Meeting'
  };

  const normalizeSlotType = (type) => type.toLowerCase().replace(/\s/g, '');


  // Initialize Firebase and Auth State
  useEffect(() => {
    const app = initializeApp(firebaseConfig);
    const authInstance = getAuth(app);
    const dbInstance = getFirestore(app);

    setAuth(authInstance);
    setDb(dbInstance);
    
    // Preload login image
    const loginImage = new Image();
    loginImage.src = "https://i.imghippo.com/files/hmwO3797DM.jpg";

    // Check session storage for admin state
    const savedIsAdmin = sessionStorage.getItem('isAdmin');
    if (savedIsAdmin === 'true') {
      setIsAdmin(true);
      setView('adminDashboard');
    }

    const unsubscribe = onAuthStateChanged(authInstance, async (user) => {
      if (user) {
        const userDocRef = doc(dbInstance, `/artifacts/${appId}/public/data/users`, user.uid);
        const userDoc = await getDoc(userDocRef);
        if (userDoc.exists()) {
          setUserProfile({ id: user.uid, ...userDoc.data() });
          setView('userDashboard');
        }
      } else {
        setUserProfile(null);
        if (sessionStorage.getItem('isAdmin') !== 'true') {
            setView('login');
        }
      }
      setIsAuthReady(true);
    });

    return () => unsubscribe();
  }, [appId, firebaseConfig]);

  // Fetch all data from Firestore after login/auth is ready
  useEffect(() => {
    if (!isAuthReady || !db || (!isAdmin && !userProfile)) {
      return;
    }

    const usersCollectionPath = `/artifacts/${appId}/public/data/users`;
    const unsubUsers = onSnapshot(collection(db, usersCollectionPath), (snapshot) => {
      setAllUsers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => console.error("Error fetching users:", error));

    const slotsCollectionPath = `/artifacts/${appId}/public/data/attendance_slots`;
    const unsubSlots = onSnapshot(collection(db, slotsCollectionPath), (snapshot) => {
      setAttendanceSlots(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => console.error("Error fetching slots:", error));

    return () => {
      unsubUsers();
      unsubSlots();
    };
  }, [isAuthReady, db, isAdmin, userProfile, appId]);

  // Effect for auto-clearing the main page message after 1 second
  useEffect(() => {
    if (message) {
      const timer = setTimeout(() => {
        setMessage('');
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [message]);
  
  // Effect for auto-clearing modal messages
  useEffect(() => {
    if (modalMessage) {
      const timer = setTimeout(() => {
        setModalMessage('');
      }, 2000); // Give a bit more time to read modal messages
      return () => clearTimeout(timer);
    }
  }, [modalMessage]);

  // Effect for closing dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (profileDropdownRef.current && !profileDropdownRef.current.contains(event.target)) {
        setShowProfileDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Effect for scroll-locking the body when any modal is open
  useEffect(() => {
    const isAnyModalOpen = 
      showRegistrationSuccess || 
      showCreateSlot || 
      showImportModal || 
      showMemberAttendanceDetails ||
      showEditProfileModal ||
      showChangePasswordModal ||
      showForgotPasswordModal ||
      !!editingSlot ||
      !!editingUser ||
      !!deletingUser ||
      !!deletingSlot;

    if (isAnyModalOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'auto';
    }

    // Cleanup function to restore scroll on component unmount
    return () => {
      document.body.style.overflow = 'auto';
    };
  }, [
    showRegistrationSuccess, 
    showCreateSlot, 
    showImportModal, 
    showMemberAttendanceDetails, 
    showEditProfileModal, 
    showChangePasswordModal, 
    showForgotPasswordModal,
    editingSlot,
    editingUser,
    deletingUser,
    deletingSlot
  ]);

  // Effect for inactivity logout timer
  useEffect(() => {
    let inactivityTimeout;

    const handleInactivityLogout = () => {
      // Log out and reset state
      sessionStorage.removeItem('isAdmin');
      setView('login');
      setIsAdmin(false);
      setUserProfile(null);
      setLoginForm({ email: '', password: '' });
      setMessage('You have been logged out due to inactivity.');
    };

    const resetInactivityTimer = () => {
      clearTimeout(inactivityTimeout);
      setRemainingTime(1800); // Reset display timer
      // Set timeout for 30 minutes (1800000 milliseconds)
      inactivityTimeout = setTimeout(handleInactivityLogout, 1800000);
    };

    if (isAdmin || userProfile) {
      const events = ['mousemove', 'mousedown', 'keypress', 'scroll'];
      events.forEach(event => window.addEventListener(event, resetInactivityTimer));
      resetInactivityTimer(); // Start the timer

      return () => { // Cleanup function
        clearTimeout(inactivityTimeout);
        events.forEach(event => window.removeEventListener(event, resetInactivityTimer));
      };
    }
  }, [isAdmin, userProfile]);

  // Effect for countdown display timer
  useEffect(() => {
    if (isAdmin || userProfile) {
        const timer = setInterval(() => {
            setRemainingTime(prevTime => {
                if (prevTime <= 1) {
                    clearInterval(timer);
                    return 0;
                }
                return prevTime - 1;
            });
        }, 1000);

        return () => clearInterval(timer);
    }
  }, [isAdmin, userProfile]);


  // Handle user registration
  const handleRegister = async (e) => {
    e.preventDefault();
    setMessage('');

    const requiredFields = ['username', 'password', 'email', 'contact', 'year', 'regNo', 'program', 'domain', 'position'];
    for (const field of requiredFields) {
      if (!registerForm[field]) {
        setMessage(`Please fill out the '${field}' field.`);
        return;
      }
    }
    
    if (!registerForm.photo) {
      setMessage("Please upload a photograph.");
      return;
    }

    // Password validation
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{6,}$/;
    if (!passwordRegex.test(registerForm.password)) {
      setMessage("Password must be at least 6 characters and contain one uppercase, one lowercase, one number, and one special character.");
      return;
    }

    // Contact number validation
    if (!/^\d{10}$/.test(registerForm.contact)) {
      setMessage("Contact number must be exactly 10 digits.");
      return;
    }

    // Convert photo to Base64 and check size before creating user
    const reader = new FileReader();
    reader.readAsDataURL(registerForm.photo);
    reader.onloadend = async () => {
      const photoBase64 = reader.result;
      const photoSizeInBytes = photoBase64.length * 0.75; // Approximation for Base64 size
      
      if (photoSizeInBytes > 1000000) { // 1MB limit
        setMessage("Photo size is too large. Maximum size is 1MB.");
        return;
      }

      try {
        // Create user in Firebase Auth
        const userCredential = await createUserWithEmailAndPassword(auth, registerForm.email, registerForm.password);
        const user = userCredential.user;

        // Add user data to Firestore with 'pending' status, using uid as doc id
        try {
          const usersCollectionPath = `/artifacts/${appId}/public/data/users`;
          const userDocRef = doc(db, usersCollectionPath, user.uid);
          await setDoc(userDocRef, {
            ...registerForm,
            photo: photoBase64,
            status: 'pending',
            isAdmin: false,
            createdAt: serverTimestamp()
          });
          setShowRegistrationSuccess(true);
          setRegisterForm({
            photo: null, username: '', email: '', contact: '', year: '', regNo: '', program: '', domain: '', position: '', password: ''
          });
        } catch (e) {
          console.error("Error during Firestore registration: ", e.message);
          setMessage("Registration failed. Please try again.");
          // If Firestore fails, delete the Auth user to prevent orphan accounts
          await deleteUser(user);
        }
      } catch (e) {
        console.error("Error during Firebase Auth registration: ", e.message);
        if (e.code === 'auth/email-already-in-use') {
          setMessage("Registration failed. An account with this email already exists.");
        } else {
          setMessage("Registration failed. Please try again.");
        }
      }
    };
    reader.onerror = (error) => {
      console.error("Error converting file to Base64:", error);
      setMessage("Failed to read photo. Please try again.");
    };
  };

  // Handle user login
  const handleLogin = async (e) => {
    e.preventDefault();
    setMessage('');
    if (!db || !auth || !loginForm.email || !loginForm.password) {
      setMessage("Please enter email and password.");
      return;
    }

    // Hardcoded admin credentials for demonstration
    const isAdminUser = loginForm.email === 'mdc_vsp@gitam.in' && loginForm.password === adminPassword;
    
    if (isAdminUser) {
      sessionStorage.setItem('isAdmin', 'true');
      setIsAdmin(true);
      setView('adminDashboard');
      setAdminView('dashboard');
      setMessage('Admin login successful!');
      return;
    }

    try {
      // Sign in user with Firebase Auth
      const userCredential = await signInWithEmailAndPassword(auth, loginForm.email, loginForm.password);
      const user = userCredential.user;

      // Get user data from Firestore
      const usersCollectionPath = `/artifacts/${appId}/public/data/users`;
      const userDocRef = doc(db, usersCollectionPath, user.uid);
      const userDoc = await getDoc(userDocRef);

      if (!userDoc.exists()) {
        setMessage("User data not found. Please contact the admin.");
        return;
      }
      
      const userData = userDoc.data();

      if (userData.status === 'pending') {
        setMessage("Your account is pending admin approval. You cannot log in yet.");
        return;
      }

      if (userData.status === 'inactive') {
        setMessage("Your account is inactive. Please contact the admin.");
        return;
      }

      // User login successful
      setIsAdmin(userData.isAdmin || false);
      setUserProfile({ id: user.uid, ...userData });
      setView('userDashboard');
      setMessage("Login successful!");
    } catch (e) {
      console.error("Error during login: ", e.message);
      setMessage("Login failed. Invalid email or password.");
    }
  };
  
  const handleLogout = () => {
    sessionStorage.removeItem('isAdmin');
    setIsAdmin(false);
    setUserProfile(null);
    setView('login');
    setMessage('');
    setLoginForm({ email: '', password: '' });
    setShowProfileDropdown(false);
    if(auth) auth.signOut();
  };

  // Handle forgot password request
  const handleForgotPassword = async (e) => {
    e.preventDefault();
    setModalMessage('');
    const emailToReset = e.target.email.value;
    if (!emailToReset) {
      setModalMessage("Please enter your email address.");
      return;
    }
    
    try {
        await sendPasswordResetEmail(auth, emailToReset);
        setModalMessage("A password reset email has been sent to your address. Please check your inbox.");
        setTimeout(() => {
          setShowForgotPasswordModal(false);
          setModalMessage('');
        }, 1000)
    } catch (e) {
        console.error("Error sending password reset email:", e.message);
        setModalMessage("Failed to send password reset email. Please ensure the email is valid and try again.");
    }
  };

  // Handle admin actions (users)
  const handleToggleStatus = async (user) => {
    if (!db || !isAdmin) return;
    try {
      let newStatus;
      if (user.status === 'active') {
          newStatus = 'inactive';
      } else {
          // This handles both 'inactive' and 'pending' statuses
          newStatus = 'active';
      }
      const userDocRef = doc(db, `/artifacts/${appId}/public/data/users`, user.id);
      await updateDoc(userDocRef, { status: newStatus });
      setMessage(`User ${user.email} status changed to ${newStatus}.`);
    } catch (e) {
      console.error("Error updating user status: ", e.message);
      setMessage("Failed to update user status. Please try again.");
    }
  };

  const handleDeleteUser = async (user) => {
    if (!db || !isAdmin) return;
    setModalMessage('');
    setDeletingUser(user);
  };

  const confirmDelete = async () => {
    if (!db || !isAdmin || !deletingUser) return;
    try {
      // Deleting a user from Firebase Auth by an admin is not possible from the client-side SDK.
      // The auth account will become an orphan but will be unusable as the Firestore doc is deleted.
      
      // Delete the user's Firestore document
      const userDocRef = doc(db, `/artifacts/${appId}/public/data/users`, deletingUser.id);
      await deleteDoc(userDocRef);
      
      setMessage(`User ${deletingUser.username} has been deleted.`);
      setDeletingUser(null);
    } catch (e) {
      console.error("Error deleting user: ", e.message);
      setMessage("Failed to delete user. Please try again.");
      setDeletingUser(null);
    }
  };

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    if (!db || !isAdmin || !editingUser) return;

    try {
      const userDocRef = doc(db, `/artifacts/${appId}/public/data/users`, editingUser.id);
      await updateDoc(userDocRef, {
        username: editingUser.username,
        email: editingUser.email,
        contact: editingUser.contact,
        year: editingUser.year,
        regNo: editingUser.regNo,
        program: editingUser.program,
        domain: editingUser.domain,
        position: editingUser.position
      });
      setModalMessage(`User ${editingUser.username} details updated successfully.`);
      setTimeout(() => {
        setEditingUser(null);
        setModalMessage('');
      }, 1000);
    } catch (e) {
      console.error("Error updating user: ", e.message);
      setMessage("Failed to update user details. Please try again.");
    }
  };
  
  // Calculate user counts
  const totalUsers = allUsers.length;
  const activeUsersCount = allUsers.filter(user => user.status === 'active').length;
  const inactiveUsersCount = allUsers.filter(user => user.status === 'inactive').length;
  const pendingUsersCount = allUsers.filter(user => user.status === 'pending').length;

  // Custom sort function for users
  function userSort(a, b) {
    // 1. Domain priority
    const domainA = domainPriority.indexOf(a.domain);
    const domainB = domainPriority.indexOf(b.domain);
    if (domainA !== domainB) return domainA - domainB;
    // 2. For EB domain, sort by position
    if (a.domain === "EB" && b.domain === "EB") {
      const posA = positionPriority.indexOf(a.position);
      const posB = positionPriority.indexOf(b.position);
      if (posA !== posB) return posA - posB;
      // fallback: alphabetical by name
      return (a.username || '').localeCompare(b.username || '');
    }
    // 3. For other domains, sort by year then regNo
    const yearA = yearPriority.indexOf(a.year);
    const yearB = yearPriority.indexOf(b.year);
    if (yearA !== yearB) return yearA - yearB;
    const regA = a.regNo || '';
    const regB = b.regNo || '';
    const numA = parseInt(regA, 10);
    const numB = parseInt(regB, 10);
    if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
    return regA.localeCompare(regB);
  }

  // Filter and search logic
  const filteredUsers = allUsers.filter(user => {
    const matchesSearch = searchTerm === '' ||
      user.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = filterStatus === 'all' || user.status === filterStatus;
    const matchesDomain = filterDomain === 'all' || user.domain === filterDomain;
    const matchesYear = filterYear === 'all' || user.year === filterYear;
    const matchesPosition = filterPosition === 'all' || user.position === filterPosition;

    return matchesSearch && matchesStatus && matchesDomain && matchesYear && matchesPosition;
  }).sort(userSort);
  
  const downloadUsersCSV = () => {
    const header = ['Full Name', 'Email', 'Contact', 'Year', 'Reg No', 'Program', 'Domain', 'Position', 'Status'];
    const rows = filteredUsers.map(user => 
      [
        `"${user.username}"`, 
        user.email, 
        user.contact, 
        user.year, 
        user.regNo, 
        user.program, 
        user.domain, 
        user.position, 
        user.status
      ].join(',')
    );

    const csvContent = [header.join(','), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', 'mdc_users_list.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleToggleEligibleUser = (userId) => {
    setEligibleUsers(prev => 
      prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId]
    );
  };

  const handleSelectAllEligible = () => {
    const activeUserIds = allUsers.filter(u => u.status === 'active').map(u => u.id);
    setEligibleUsers(activeUserIds);
  };

  const handleDeselectAllEligible = () => {
    setEligibleUsers([]);
  };

  // Handle admin actions (attendance slots)
  const handleCreateSlot = async (e) => {
    e.preventDefault();
    if (!db || !isAdmin) return;
    
    if (!newSlotForm.slotType || !newSlotForm.slotName || !newSlotForm.date) {
        setModalMessage("Slot Type, Slot Name, and Date are mandatory.");
        return;
    }
    
    if (eligibleUsers.length === 0) {
      setModalMessage("Please select at least one eligible member for this slot.");
      return;
    }

    try {
      const slotsCollectionPath = `/artifacts/${appId}/public/data/attendance_slots`;
      await addDoc(collection(db, slotsCollectionPath), {
        ...newSlotForm,
        eligibleUserIds: eligibleUsers,
        createdAt: serverTimestamp(),
        attendance: [], // Initialize with an empty array for attendance
      });
      setModalMessage("Attendance slot created successfully.");
      setNewSlotForm({ slotType: '', slotName: '', date: '', venue: '', timings: '' });
      setEligibleUsers([]);
      setTimeout(() => {
        setShowCreateSlot(false);
        setModalMessage('');
      }, 1000);
    } catch (e) {
      console.error("Error creating slot:", e.message);
      setModalMessage("Failed to create attendance slot. Please try again.");
    }
  };

  const handleEditSlot = async (e) => {
    e.preventDefault();
    if (!db || !isAdmin || !editingSlot) return;
    
    if (eligibleUsers.length === 0) {
      setModalMessage("Please select at least one eligible member for this slot.");
      return;
    }
    
    try {
        const slotDocRef = doc(db, `/artifacts/${appId}/public/data/attendance_slots`, editingSlot.id);
        const { id, ...slotData } = editingSlot;
        await updateDoc(slotDocRef, {
          ...slotData,
          eligibleUserIds: eligibleUsers,
        });
        setModalMessage("Slot updated successfully.");
        setTimeout(() => {
          setEditingSlot(null);
          setModalMessage('');
          setEligibleUsers([]);
          setEligibleUserSearch('');
        }, 1000);
    } catch (e) {
        console.error("Error updating slot:", e);
        setModalMessage("Failed to update slot. Please try again.");
    }
  };

  const handleDeleteSlot = (slot) => {
    if (!db || !isAdmin) return;
    setModalMessage('');
    setDeletingSlot(slot);
  };

  const confirmDeleteSlot = async () => {
    if (!db || !isAdmin || !deletingSlot) return;
    try {
      const slotDocRef = doc(db, `/artifacts/${appId}/public/data/attendance_slots`, deletingSlot.id);
      await deleteDoc(slotDocRef);
      setMessage("Attendance slot deleted successfully.");
      setDeletingSlot(null);
    } catch (e) {
      console.error("Error deleting slot:", e.message);
      setMessage("Failed to delete attendance slot. Please try again.");
      setDeletingSlot(null);
    }
  };

  const handleMarkAttendance = (slot) => {
    setModalMessage('');
    setMarkingAttendanceForSlot(slot);
    
    const eligibleIds = slot.eligibleUserIds || [];
    let usersForAttendance;

    if (eligibleIds.length > 0) {
      // New logic: Only use eligible users for this slot
      usersForAttendance = allUsers.filter(user => eligibleIds.includes(user.id) && user.status === 'active');
    } else {
      // Fallback for old slots: Use all active users
      usersForAttendance = allUsers.filter(user => user.status === 'active');
    }

    const initialAttendance = usersForAttendance.map(user => {
      const attendanceRecord = slot.attendance.find(a => a.userId === user.id);
      return {
        ...user,
        isPresent: attendanceRecord ? attendanceRecord.isPresent : false,
      };
    });
    setSlotAttendance(initialAttendance);
  };

  const handleToggleAttendance = (userId, isPresent) => {
    setSlotAttendance(prevAttendance => 
      prevAttendance.map(user => 
        user.id === userId ? { ...user, isPresent: isPresent } : user
      )
    );
  };

  // Bulk apply present/absent to either visible rows (filtered) or all eligible rows
  const applyBulk = (isPresent) => {
    if (!markingAttendanceForSlot) return;
    // capture previous state for undo
    previousSlotAttendanceRef.current = slotAttendance.map(u => ({ id: u.id, isPresent: u.isPresent }));

  // apply to all current slotAttendance rows (these are the eligible users for the slot)
  const targetIds = slotAttendance.map(u => u.id);

    setSlotAttendance(prev => prev.map(u => targetIds.includes(u.id) ? { ...u, isPresent } : u));

    // show undo toast for 6 seconds
    setShowUndoToast(true);
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
    undoTimerRef.current = setTimeout(() => {
      setShowUndoToast(false);
      previousSlotAttendanceRef.current = null;
    }, 6000);
  };

  const markAllPresent = () => applyBulk(true);
  const markAllAbsent = () => applyBulk(false);

  const undoBulk = () => {
    if (!previousSlotAttendanceRef.current) return;
    setSlotAttendance(prev => prev.map(u => {
      const prevRec = previousSlotAttendanceRef.current.find(p => p.id === u.id);
      return prevRec ? { ...u, isPresent: prevRec.isPresent } : u;
    }));
    previousSlotAttendanceRef.current = null;
    setShowUndoToast(false);
    if (undoTimerRef.current) { clearTimeout(undoTimerRef.current); undoTimerRef.current = null; }
  };

  const handleSaveAttendance = async () => {
    if (!db || !isAdmin || !markingAttendanceForSlot) return;
    try {
      const slotDocRef = doc(db, `/artifacts/${appId}/public/data/attendance_slots`, markingAttendanceForSlot.id);
      const attendanceToSave = slotAttendance.map(user => ({
        userId: user.id,
        isPresent: user.isPresent,
        username: user.username,
        domain: user.domain,
        position: user.position,
      }));
      await updateDoc(slotDocRef, { attendance: attendanceToSave });
      setMessage("Attendance saved successfully.");
      setMarkingAttendanceForSlot(null);
      setAttendanceSearchTerm('');
      setAttendanceFilterDomain('all');
      setAttendanceFilterPosition('all');
    } catch (e) {
      console.error("Error saving attendance:", e.message);
      setMessage("Failed to save attendance. Please try again.");
    }
  };

  const handleExportAttendance = () => {
    if (!markingAttendanceForSlot || slotAttendance.length === 0) {
      setMessage("No attendance data to export.");
      return;
    }

    const header = ['Full Name', 'email', 'status'];
    const rows = slotAttendance.map(user => 
      [user.username, user.email, user.isPresent ? 'present' : 'absent'].join(',')
    );

    const csvContent = [header.join(','), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    const fileName = `attendance_${markingAttendanceForSlot.slotName.replace(/ /g, '_')}_${markingAttendanceForSlot.date}.csv`;
    link.setAttribute('download', fileName);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDownloadTemplate = () => {
    const activeUsers = allUsers.filter(user => user.status === 'active');
    if (activeUsers.length === 0) {
        setModalMessage("There are no active users to include in the template.");
        return;
    }

    const header = ['Full Name', 'email', 'status'];
    const rows = activeUsers.map(user => 
      [user.username, user.email, 'absent'].join(',') // Default status is 'absent'
    );
    
    const csvContent = [header.join(','), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', 'attendance_template.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleImportAttendance = () => {
    if (!importFile) {
      setModalMessage("Please select a file to import.");
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const csvData = event.target.result;
      const lines = csvData.split('\n');
      if (lines.length < 2) {
        setModalMessage("Invalid CSV file. It must contain headers and at least one data row.");
        return;
      }

      const headers = lines[0].trim().toLowerCase().split(',');
      const emailIndex = headers.indexOf('email');
      const statusIndex = headers.indexOf('status');

      if (emailIndex === -1 || statusIndex === -1) {
        setModalMessage("CSV file must contain 'email' and 'status' columns.");
        return;
      }

      const updatedAttendance = [...slotAttendance];
      let updatedCount = 0;

      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (line) {
          const values = line.split(',');
          const email = values[emailIndex]?.trim();
          const status = values[statusIndex]?.trim().toLowerCase();
          
          const userIndex = updatedAttendance.findIndex(user => user.email === email);
          if (userIndex !== -1) {
            updatedAttendance[userIndex].isPresent = (status === 'present');
            updatedCount++;
          }
        }
      }

      setSlotAttendance(updatedAttendance);
      setModalMessage(`${updatedCount} records updated successfully from the imported file.`);
      setImportFile(null);
      setTimeout(() => {
        setShowImportModal(false);
        setModalMessage('');
      }, 1000);
    };

    reader.onerror = () => {
      setModalMessage("Error reading the file.");
    };

    reader.readAsText(importFile);
  };

  const filteredAttendanceList = slotAttendance.filter(user => {
    const matchesSearch = attendanceSearchTerm === '' || user.username.toLowerCase().includes(attendanceSearchTerm.toLowerCase());
    const matchesDomain = attendanceFilterDomain === 'all' || user.domain === attendanceFilterDomain;
    const matchesPosition = attendanceFilterPosition === 'all' || user.position === attendanceFilterPosition;
    return matchesSearch && matchesDomain && matchesPosition;
  });

  const presentCount = filteredAttendanceList.filter(user => user.isPresent).length;
  const absentCount = filteredAttendanceList.filter(user => !user.isPresent).length;
  
  const getAttendanceSummary = (userId, type) => {
    const relevantSlots = attendanceSlots.filter(slot => {
        if (!slot.attendance || slot.attendance.length === 0) return false;
        const normalizedSlotTypeFromData = normalizeSlotType(slot.slotType);
        return (normalizedSlotTypeFromData === type || type === 'all') && slot.attendance.some(a => a.userId === userId);
    });

    const attendedSessions = relevantSlots.filter(slot =>
      slot.attendance.some(a => a.userId === userId && a.isPresent)
    ).length;

    const totalSessions = relevantSlots.length;

    return `${attendedSessions} / ${totalSessions}`;
  };

  const getAttendancePercentage = (userId, type) => {
    const relevantSlots = attendanceSlots.filter(slot => {
        if (!slot.attendance || slot.attendance.length === 0) return false;
        const normalizedSlotTypeFromData = normalizeSlotType(slot.slotType);
        return (normalizedSlotTypeFromData === type || type === 'all') && slot.attendance.some(a => a.userId === userId);
    });
    
    const attendedSessions = relevantSlots.filter(slot =>
      slot.attendance.some(a => a.userId === userId && a.isPresent)
    ).length;

    const totalSessions = relevantSlots.length;
    
    if (totalSessions === 0) return '0.0%';
    const percentage = (attendedSessions / totalSessions) * 100;
    return `${percentage.toFixed(1)}%`;
  };

  // Render attendance percentage with conditional red font based on thresholds:
  // - overall (type === 'all'): red if < 75%
  // - per-type (event, coreteammeeting, domainmeeting): red if < 50%
  const renderAttendanceWithColor = (userId, type) => {
    const pctStr = getAttendancePercentage(userId, type);
    const pctNum = parseFloat(pctStr) || 0;
    const isOverall = type === 'all';
    const threshold = isOverall ? 75 : 50;
  const className = pctNum < threshold ? 'text-red-600' : '';
    return <span className={className}>{pctStr}</span>;
  };

  const calculateAverageAttendanceRate = () => {
    const activeUsers = allUsers.filter(user => user.status === 'active');
    if (activeUsers.length === 0 || attendanceSlots.length === 0) {
      return '0.0%';
    }
  
    const totalPresent = attendanceSlots.reduce((total, slot) => {
      return total + slot.attendance.filter(a => a.isPresent).length;
    }, 0);
  
    const totalPossibleAttendance = activeUsers.length * attendanceSlots.length;
    if (totalPossibleAttendance === 0) return '0.0%';
  
    const averageRate = (totalPresent / totalPossibleAttendance) * 100;
    return `${averageRate.toFixed(1)}%`;
  };

  const downloadCSV = () => {
    const activeUsers = allUsers.filter(user => user.status === 'active');
    const header = [
      'Full Name',
      'Domain',
      'Position',
      'Overall Attendance (%)',
      'Events (%)',
      'Core Team (%)',
      'Domain M. (%)'
    ];

    const rows = activeUsers.map(user => {
      const overall = getAttendancePercentage(user.id, 'all');
      const events = getAttendancePercentage(user.id, 'event');
      const coreTeam = getAttendancePercentage(user.id, 'coreteammeeting');
      const domainM = getAttendancePercentage(user.id, 'domainmeeting');
      return [
        user.username,
        user.domain,
        user.position,
        overall,
        events,
        coreTeam,
        domainM
      ].join(',');
    });

    const csvContent = [header.join(','), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.setAttribute('download', 'attendance_report.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDownloadMemberAttendance = (member) => {
    if (!member) return;
    // Use the already-computed memberAttendanceDetails filtered by selectedMember
    const rowsData = attendanceSlots.filter(slot =>
      slot.attendance.some(a => a.userId === member.id) &&
      (dashboardFilterMonth === 'all' || new Date(slot.date).getMonth().toString() === dashboardFilterMonth) &&
      (dashboardFilterYear === 'all' || new Date(slot.date).getFullYear().toString() === dashboardFilterYear)
    ).map(slot => {
      const attendanceRecord = slot.attendance.find(a => a.userId === member.id);
      return {
        slotName: slot.slotName,
        slotType: slotTypesMap[normalizeSlotType(slot.slotType)] || slot.slotType,
        date: formatDate(slot.date),
        timings: slot.timings,
        status: attendanceRecord ? (attendanceRecord.isPresent ? 'Present' : 'Absent') : 'Absent'
      };
    }).sort((a,b) => {
      // sort by original date asc using parsed date from dd-mm-yyyy
      const parseDDMMYYYY = (s) => {
        const [d,m,y] = s.split('-'); return new Date(`${y}-${m}-${d}`);
      };
      return parseDDMMYYYY(a.date) - parseDDMMYYYY(b.date);
    });

    const header = ['Slot Name', 'Slot Type', 'Date', 'Timings', 'Status'];
    const rows = rowsData.map(r => [r.slotName, r.slotType, r.date, r.timings, r.status].map(cell => `"${String(cell).replace(/"/g,'""')}"`).join(','));
    const csvContent = [header.join(','), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `${member.username.replace(/\s+/g,'_')}_attendance.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };
  
  const handleViewMemberDetails = (member) => {
    setModalMessage('');
    setSelectedMember(member);
    setShowMemberAttendanceDetails(true);
  };

  const memberAttendanceDetails = selectedMember ? attendanceSlots.filter(slot =>
    slot.attendance.some(a => a.userId === selectedMember.id) &&
    (dashboardFilterMonth === 'all' || new Date(slot.date).getMonth().toString() === dashboardFilterMonth) &&
    (dashboardFilterYear === 'all' || new Date(slot.date).getFullYear().toString() === dashboardFilterYear)
  ).sort((a,b) => new Date(a.date) - new Date(b.date)).map(slot => {
    const attendanceRecord = slot.attendance.find(a => a.userId === selectedMember.id);
    return {
      ...slot,
      isPresent: attendanceRecord ? attendanceRecord.isPresent : false,
      status: attendanceRecord ? (attendanceRecord.isPresent ? 'Present' : 'Absent') : 'Absent'
    };
  }) : [];
  
  // User Profile and Password Management
  const handleEditProfile = async (e) => {
    e.preventDefault();
    try {
      const userDocRef = doc(db, `/artifacts/${appId}/public/data/users`, userProfile.id);
      await updateDoc(userDocRef, {
        username: userProfile.username,
        email: userProfile.email,
        contact: userProfile.contact,
        year: userProfile.year,
        regNo: userProfile.regNo,
        program: userProfile.program,
        domain: userProfile.domain,
        position: userProfile.position,
        photo: userProfile.photo,
      });
      setModalMessage("Profile updated successfully!");
      setTimeout(() => {
        setShowEditProfileModal(false);
        setModalMessage('');
      }, 1000);
    } catch (e) {
      console.error("Error updating profile:", e);
      setModalMessage("Failed to update profile.");
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    setPasswordChangeMessage('');
    
    // Admin password change logic
    if (isAdmin) {
      if (passwordForm.currentPassword !== adminPassword) {
        setPasswordChangeMessage("Incorrect current password.");
        return;
      }
      if (passwordForm.newPassword === '') {
        setPasswordChangeMessage("New password cannot be empty.");
        return;
      }
      if (passwordForm.newPassword === adminPassword) {
        setPasswordChangeMessage("New password cannot be the same as the old password.");
        return;
      }
      setAdminPassword(passwordForm.newPassword);
      setPasswordChangeMessage("Admin password changed successfully!");
      setPasswordForm({ currentPassword: '', newPassword: '' });
      setTimeout(() => {
        setShowChangePasswordModal(false);
        setPasswordChangeMessage('');
      }, 1000);
      return;
    }

    // User password change logic
    const user = auth.currentUser;
    if (!user) {
      setPasswordChangeMessage("No user is currently logged in.");
      return;
    }
    
    // Password validation
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{6,}$/;
    if (!passwordRegex.test(passwordForm.newPassword)) {
      setPasswordChangeMessage("New password must be at least 6 characters and contain one uppercase, one lowercase, one number, and one special character.");
      return;
    }

    try {
      await updatePassword(user, passwordForm.newPassword);
      setPasswordChangeMessage("Password changed successfully!");
      setPasswordForm({ currentPassword: '', newPassword: '' });
      setTimeout(() => {
        setShowChangePasswordModal(false);
        setPasswordChangeMessage('');
      }, 1000);
    } catch (e) {
      console.error("Error changing password:", e);
      setPasswordChangeMessage("Failed to change password. Please re-login and try again.");
    }
  };

  const handlePhotoUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onloadend = () => {
        setUserProfile({ ...userProfile, photo: reader.result });
      };
    }
  };

  // User Dashboard Attendance Records
  const userAttendanceRecords = attendanceSlots.filter(slot =>
    slot.attendance.some(a => a.userId === userProfile?.id)
  ).filter(slot => {
    const isCorrectType = userDashboardFilters.slotType === 'all' || normalizeSlotType(slot.slotType) === userDashboardFilters.slotType;
    const isCorrectStatus = userDashboardFilters.status === 'all' || (userDashboardFilters.status === 'present' && slot.attendance.find(a => a.userId === userProfile.id)?.isPresent) || (userDashboardFilters.status === 'absent' && !slot.attendance.find(a => a.userId === userProfile.id)?.isPresent);
    
    const slotDate = new Date(slot.date);
    const fromDate = userDashboardFilters.fromDate ? new Date(userDashboardFilters.fromDate) : null;
    const toDate = userDashboardFilters.toDate ? new Date(userDashboardFilters.toDate) : null;
    const isCorrectDate = (!fromDate || slotDate >= fromDate) && (!toDate || slotDate <= toDate);

    return isCorrectType && isCorrectStatus && isCorrectDate;
  }).map(slot => {
    const attendanceRecord = slot.attendance.find(a => a.userId === userProfile.id);
    return {
      ...slot,
      isPresent: attendanceRecord ? attendanceRecord.isPresent : false,
      status: attendanceRecord ? (attendanceRecord.isPresent ? 'Present' : 'Absent') : 'Absent'
    };
  });

  // getSlotTiming was removed because it was defined but never used.

  const formatTime = (seconds) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${String(minutes).padStart(2, '0')}m : ${String(remainingSeconds).padStart(2, '0')}s`;
  };

  // Format ISO-ish date strings (YYYY-MM-DD or full ISO) to DD-MM-YYYY for display
  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    // If already in YYYY-MM-DD, split
    if (/^\d{4}-\d{1,2}-\d{1,2}$/.test(dateStr)) {
      const [y, m, d] = dateStr.split('-');
      return `${d.padStart(2,'0')}-${m.padStart(2,'0')}-${y}`;
    }
    // Try parsing other date formats
    const dt = new Date(dateStr);
    if (isNaN(dt)) return dateStr;
    const dd = String(dt.getDate()).padStart(2, '0');
    const mm = String(dt.getMonth() + 1).padStart(2, '0');
    const yyyy = dt.getFullYear();
    return `${dd}-${mm}-${yyyy}`;
  };

  // Memoize violations map for performance (recompute when users or slots change)
  const violationsMap = useMemo(() => {
    const computeConsecutiveAbsenceViolationsForUser = (userId, slots) => {
      if (!userId || !Array.isArray(slots) || slots.length === 0) {
        return { violationCount: 0, violations: [] };
      }
  
      const relevantSlots = slots
        .slice()
        .sort((a, b) => new Date(a.date) - new Date(b.date))
        .filter(slot => {
          if (!slot) return false;
          const hasEligibleList = Array.isArray(slot.eligibleUserIds) && slot.eligibleUserIds.length > 0;
          if (hasEligibleList) return slot.eligibleUserIds.includes(userId);
          // legacy: include if attendance entry exists for user
          return Array.isArray(slot.attendance) && slot.attendance.some(a => a.userId === userId);
        });
  
      const statusArr = relevantSlots.map(slot => {
        const rec = Array.isArray(slot.attendance) ? slot.attendance.find(a => a.userId === userId) : null;
        const hasEligibleList = Array.isArray(slot.eligibleUserIds) && slot.eligibleUserIds.length > 0;
        const isPresent = rec ? !!rec.isPresent : (hasEligibleList ? false : false);
        return {
          slotId: slot.id,
          date: slot.date,
          slotName: slot.slotName || '',
          isPresent
        };
      });
  
      const violations = [];
      for (let i = 0; i <= statusArr.length - 3; i++) {
        const window = statusArr.slice(i, i + 3);
        if (window.every(s => !s.isPresent)) {
          violations.push({
            slotIds: window.map(w => w.slotId),
            dates: window.map(w => formatDate(w.date)),
            slotNames: window.map(w => w.slotName)
          });
        }
      }
  
      return { violationCount: violations.length, violations };
    };
  
    const map = {};
    if (!Array.isArray(allUsers) || !Array.isArray(attendanceSlots)) return map;
    allUsers.forEach(user => {
      if (!user || user.status !== 'active') return;
      map[user.id] = computeConsecutiveAbsenceViolationsForUser(user.id, attendanceSlots);
    });
    return map;
  }, [allUsers, attendanceSlots]);

  
  // Nav bar and main content
  const renderNav = () => (
    <nav className="bg-[#2a7b6a] text-white px-4 py-4 flex justify-between items-center rounded-b-xl shadow-lg">
      <h1 className="text-xl sm:text-2xl font-bold">
        Meta Developer Communities
      </h1>
      <div className="flex items-center space-x-4">
          {isAdmin ? (
            <div className="hidden md:flex space-x-4">
              <button onClick={() => { setAdminView('dashboard'); setMarkingAttendanceForSlot(null); setShowProfileDropdown(false); }} className={`px-4 py-2 rounded-full font-medium ${adminView === 'dashboard' ? 'bg-[#1e5a4f] text-white shadow-md' : 'text-gray-200 hover:text-white'}`}>
                Dashboard
              </button>
              <button onClick={() => { setAdminView('manageUsers'); setMarkingAttendanceForSlot(null); setShowProfileDropdown(false); }} className={`px-4 py-2 rounded-full font-medium ${adminView === 'manageUsers' ? 'bg-[#1e5a4f] text-white shadow-md' : 'text-gray-200 hover:text-white'}`}>
                Manage Users
              </button>
              <button onClick={() => { setAdminView('attendanceSlots'); setMarkingAttendanceForSlot(null); setShowProfileDropdown(false); }} className={`px-4 py-2 rounded-full font-medium ${adminView === 'attendanceSlots' ? 'bg-[#1e5a4f] text-white shadow-md' : 'text-gray-200 hover:text-white'}`}>
                Attendance Slots
              </button>
            </div>
          ) : null}
          {(isAdmin || userProfile) && (
              <div className="flex items-center text-sm font-mono bg-black bg-opacity-20 px-3 py-1 rounded-full">
                  <span>Session</span>
                  <svg className="animate-spin h-4 w-4 mx-2 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <span>: {formatTime(remainingTime)}</span>
              </div>
          )}
          <div 
            className="relative"
            ref={profileDropdownRef}
          >
            {userProfile && !isAdmin ? (
              <button onClick={() => setShowProfileDropdown(prev => !prev)} className="w-10 h-10 rounded-full bg-white flex items-center justify-center text-gray-700 transition-transform transform hover:scale-110">
                {userProfile.photo ? (
                  <img src={userProfile.photo} alt="Profile" className="w-full h-full rounded-full object-cover" />
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M17.982 18.725A7.488 7.488 0 0012 15.75a7.488 7.488 0 00-5.982 2.975m11.963 0a7.5 7.5 0 10-11.963 0m11.963 0A8.966 8.966 0 0112 21a8.966 8.966 0 01-5.982-2.275M15 9.75a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                )}
              </button>
            ) : isAdmin ? (
              <button onClick={() => setShowProfileDropdown(prev => !prev)} className="w-10 h-10 rounded-full bg-white flex items-center justify-center text-gray-700 transition-transform transform hover:scale-110">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17.982 18.725A7.488 7.488 0 0012 15.75a7.488 7.488 0 00-5.982 2.975m11.963 0a7.5 7.5 0 10-11.963 0m11.963 0A8.966 8.966 0 0112 21a8.966 8.966 0 01-5.982-2.275M15 9.75a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </button>
            ) : null}
            {showProfileDropdown && (
              <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg py-1 z-20">
                {!isAdmin && (
                  <button onClick={() => { setModalMessage(''); setShowEditProfileModal(true); setShowProfileDropdown(false); }} className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 w-full text-left">
                    Edit Details
                  </button>
                )}
                <button onClick={() => { setPasswordChangeMessage(''); setShowChangePasswordModal(true); setShowProfileDropdown(false); setPasswordForm({ currentPassword: '', newPassword: '' }); }} className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 w-full text-left">
                  Change Password
                </button>
                <button onClick={handleLogout} className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 w-full text-left">
                  Logout
                </button>
              </div>
            )}
          </div>
      </div>
    </nav>
  );

  const renderContent = () => {
    switch (view) {
      case 'register':
        return (
          <div className="flex items-center justify-center p-4">
            <div className="w-full max-w-xl bg-white rounded-lg shadow-xl p-8 space-y-6">
              <h2 className="text-2xl font-bold text-center text-gray-800">Register New Member</h2>
              {message && (
                <div className="text-center text-sm font-medium text-red-500">
                  {message}
                </div>
              )}
              <form onSubmit={handleRegister} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium">Photograph <span className="text-red-500">*</span></label>
                  <input type="file" onChange={(e) => setRegisterForm({ ...registerForm, photo: e.target.files[0] })} className="mt-1 block w-full text-gray-900 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-gray-50 file:text-gray-700 hover:file:bg-gray-100" />
                </div>
                <div>
                  <label className="block text-sm font-medium">Full Name <span className="text-red-500">*</span></label>
                  <input type="text" placeholder="Enter full name" value={registerForm.username} onChange={(e) => setRegisterForm({ ...registerForm, username: e.target.value })} className="w-full p-3 rounded-lg bg-gray-100 border border-gray-300" />
                </div>
                <div>
                  <label className="block text-sm font-medium">Password <span className="text-red-500">*</span></label>
                  <input type="password" placeholder="Create a password" value={registerForm.password} onChange={(e) => setRegisterForm({ ...registerForm, password: e.target.value })} className="w-full p-3 rounded-lg bg-gray-100 border border-gray-300" />
                </div>
                <div>
                  <label className="block text-sm font-medium">Email <span className="text-red-500">*</span></label>
                  <input type="email" placeholder="Enter your email" value={registerForm.email} onChange={(e) => setRegisterForm({ ...registerForm, email: e.target.value })} className="w-full p-3 rounded-lg bg-gray-100 border border-gray-300" />
                </div>
                <div>
                  <label className="block text-sm font-medium">Contact Number <span className="text-red-500">*</span></label>
                  <input type="tel" placeholder="Enter your contact number" value={registerForm.contact} onChange={(e) => setRegisterForm({ ...registerForm, contact: e.target.value })} className="w-full p-3 rounded-lg bg-gray-100 border border-gray-300" />
                </div>
                <div>
                  <label className="block text-sm font-medium">Year of Study <span className="text-red-500">*</span></label>
                  <select value={registerForm.year} onChange={(e) => setRegisterForm({ ...registerForm, year: e.target.value })} className="w-full p-3 rounded-lg bg-gray-100 border border-gray-300">
                    <option value="">Select your year</option>
                    {years.map(y => <option key={y} value={y}>{y}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium">Registration Number <span className="text-red-500">*</span></label>
                  <input type="text" placeholder="Enter your registration number" value={registerForm.regNo} onChange={(e) => setRegisterForm({ ...registerForm, regNo: e.target.value })} className="w-full p-3 rounded-lg bg-gray-100 border border-gray-300" />
                </div>
                <div>
                  <label className="block text-sm font-medium">Program <span className="text-red-500">*</span></label>
                  <input type="text" placeholder="Enter your program" value={registerForm.program} onChange={(e) => setRegisterForm({ ...registerForm, program: e.target.value })} className="w-full p-3 rounded-lg bg-gray-100 border border-gray-300" />
                </div>
                <div>
                  <label className="block text-sm font-medium">Domain <span className="text-red-500">*</span></label>
                  <select value={registerForm.domain} onChange={(e) => setRegisterForm({ ...registerForm, domain: e.target.value })} className="w-full p-3 rounded-lg bg-gray-100 border border-gray-300">
                    <option value="">Select Domain</option>
                    {domains.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium">Position <span className="text-red-500">*</span></label>
                  <select value={registerForm.position} onChange={(e) => setRegisterForm({ ...registerForm, position: e.target.value })} className="w-full p-3 rounded-lg bg-gray-100 border border-gray-300">
                    <option value="">Select Position</option>
                    {positions.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
                <div className="flex flex-col sm:flex-row space-y-4 sm:space-y-0 sm:space-x-4">
                  <button type="submit" className="w-full py-2 px-4 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-full shadow-lg transition-colors">Register</button>
                  <button type="button" onClick={() => setView('login')} className="w-full py-2 px-4 bg-gray-200 hover:bg-gray-300 text-gray-800 font-semibold rounded-full transition-colors">Back to Login</button>
                </div>
              </form>
            </div>
          </div>
        );

      case 'adminDashboard':
        return (
          <div className="min-h-screen bg-gray-100 text-gray-900">
            <div>
              {adminView === 'dashboard' && (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="bg-blue-100 p-4 rounded-lg shadow-md text-center text-blue-800">
                      <p className="text-sm font-medium">Active Users</p>
                      <p className="text-2xl font-bold">{activeUsersCount}</p>
                    </div>
                    <div className="bg-yellow-100 p-4 rounded-lg shadow-md text-center text-yellow-800">
                      <p className="text-sm font-medium">Pending Approvals</p>
                      <p className="text-2xl font-bold">{pendingUsersCount}</p>
                    </div>
                    <div className="bg-purple-100 p-4 rounded-lg shadow-md text-center text-purple-800">
                      <p className="text-sm font-medium">Total Slots</p>
                      <p className="text-2xl font-bold">{attendanceSlots.length}</p>
                    </div>
                    <div className="bg-pink-100 p-4 rounded-lg shadow-md text-center text-pink-800">
                      <p className="text-sm font-medium">Avg. Attendance Rate</p>
                      <p className="text-2xl font-bold">{calculateAverageAttendanceRate()}</p>
                    </div>
                  </div>

                  <h3 className="text-xl font-semibold text-gray-800 mt-8">Member Attendance Overview</h3>
                  <div className="flex flex-wrap items-center space-y-4 sm:space-y-0 sm:space-x-4">
                    <select
                      value={dashboardFilterAttendance}
                      onChange={(e) => setDashboardFilterAttendance(e.target.value)}
                      className="w-full sm:w-auto p-3 rounded-lg bg-gray-100 border border-gray-300"
                    >
                      <option value="all">All Attendance %</option>
                      <option value="0-25">0-25%</option>
                      <option value="26-50">26-50%</option>
                      <option value="51-75">51-75%</option>
                      <option value="76-100">76-100%</option>
                    </select>
                    <select
                      value={dashboardFilterDomain}
                      onChange={(e) => setDashboardFilterDomain(e.target.value)}
                      className="w-full sm:w-auto p-3 rounded-lg bg-gray-100 border border-gray-300"
                    >
                      <option value="all">All Domains</option>
                      {domains.map(d => <option key={d} value={d}>{d}</option>)}
                    </select>
                    <select
                      value={dashboardFilterPosition}
                      onChange={(e) => setDashboardFilterPosition(e.target.value)}
                      className="w-full sm:w-auto p-3 rounded-lg bg-gray-100 border border-gray-300"
                    >
                      <option value="all">All Positions</option>
                      {positions.map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                    <button onClick={downloadCSV} className="w-full sm:w-auto py-2 px-6 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-full shadow-lg transition-colors">
                      Download CSV
                    </button>
                  </div>
                  
                  <div className="overflow-x-auto mt-4">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Full Name</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Domain</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Position</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Overall (%)</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Events (%)</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Core Team (%)</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Domain M. (%)</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Violation</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Details</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {allUsers.filter(user => user.status === 'active' &&
                          (dashboardFilterDomain === 'all' || user.domain === dashboardFilterDomain) &&
                          (dashboardFilterPosition === 'all' || user.position === dashboardFilterPosition)
                        ).sort(userSort).map(user => {
                          const overallPercentage = parseFloat(getAttendancePercentage(user.id, 'all'));
                          const matchesAttendanceFilter = dashboardFilterAttendance === 'all' || 
                            (dashboardFilterAttendance === '0-25' && overallPercentage >= 0 && overallPercentage <= 25) ||
                            (dashboardFilterAttendance === '26-50' && overallPercentage > 25 && overallPercentage <= 50) ||
                            (dashboardFilterAttendance === '51-75' && overallPercentage > 50 && overallPercentage <= 75) ||
                            (dashboardFilterAttendance === '76-100' && overallPercentage > 75 && overallPercentage <= 100);
                          
                          if (!matchesAttendanceFilter) return null;

                          return (
                            <tr key={user.id}>
                              <td className="px-6 py-4 whitespace-nowrap">{user.username}</td>
                              <td className="px-6 py-4 whitespace-nowrap">{user.domain}</td>
                              <td className="px-6 py-4 whitespace-nowrap">{user.position}</td>
                              <td className="px-6 py-4 whitespace-nowrap">{renderAttendanceWithColor(user.id, 'all')}</td>
                              <td className="px-6 py-4 whitespace-nowrap">{renderAttendanceWithColor(user.id, 'event')}</td>
                              <td className="px-6 py-4 whitespace-nowrap">{renderAttendanceWithColor(user.id, 'coreteammeeting')}</td>
                              <td className="px-6 py-4 whitespace-nowrap">{renderAttendanceWithColor(user.id, 'domainmeeting')}</td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                {(() => {
                                  const v = violationsMap[user.id] || { violationCount: 0, violations: [] };
                                  if (v.violationCount === 0) {
                                    return <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">No</span>;
                                  }
                                  return (
                                    <div className="flex items-center space-x-2">
                                      <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-red-100 text-red-800">Yes</span>
                                      <button onClick={() => { setViolationModalMember(user); setShowViolationModal(true); }} className="text-sm font-semibold text-red-600">({v.violationCount})</button>
                                    </div>
                                  );
                                })()}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <button onClick={() => handleViewMemberDetails(user)}>
                                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6 text-gray-600">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.577 3.01 9.964 7.822.13.438.13.921 0 1.359C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.577-3.01-9.964-7.822z" />
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                  </svg>
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
              {adminView === 'manageUsers' && (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
                    <div className="bg-blue-100 p-4 rounded-lg shadow-md text-center text-blue-800">
                      <p className="text-sm font-medium">Total Users</p>
                      <p className="text-2xl font-bold">{totalUsers}</p>
                    </div>
                    <div className="bg-green-100 p-4 rounded-lg shadow-md text-center text-green-800">
                      <p className="text-sm font-medium">Active Users</p>
                      <p className="text-2xl font-bold">{activeUsersCount}</p>
                    </div>
                    <div className="bg-red-100 p-4 rounded-lg shadow-md text-center text-red-800">
                      <p className="text-sm font-medium">Inactive Users</p>
                      <p className="text-2xl font-bold">{inactiveUsersCount}</p>
                    </div>
                    <div className="bg-yellow-100 p-4 rounded-lg shadow-md text-center text-yellow-800">
                      <p className="text-sm font-medium">Pending Approvals</p>
                      <p className="text-2xl font-bold">{pendingUsersCount}</p>
                    </div>
                  </div>

                  <div className="mt-6 flex flex-wrap items-center space-y-4 sm:space-y-0 sm:space-x-4">
                    <input
                      type="text"
                      placeholder="Search users..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full sm:w-auto p-3 rounded-lg bg-gray-100 border border-gray-300"
                    />
                    <select
                      value={filterStatus}
                      onChange={(e) => setFilterStatus(e.target.value)}
                      className="w-full sm:w-auto p-3 rounded-lg bg-gray-100 border border-gray-300"
                    >
                      <option value="all">All Statuses</option>
                      <option value="active">Active</option>
                      <option value="inactive">Inactive</option>
                      <option value="pending">Pending Approval</option>
                    </select>
                     <select
                      value={filterDomain}
                      onChange={(e) => setFilterDomain(e.target.value)}
                      className="w-full sm:w-auto p-3 rounded-lg bg-gray-100 border border-gray-300"
                    >
                      <option value="all">All Domains</option>
                      {domains.map(d => <option key={d} value={d}>{d}</option>)}
                    </select>
                    <select
                      value={filterYear}
                      onChange={(e) => setFilterYear(e.target.value)}
                      className="w-full sm:w-auto p-3 rounded-lg bg-gray-100 border border-gray-300"
                    >
                      <option value="all">All Years</option>
                      {years.map(y => <option key={y} value={y}>{y}</option>)}
                    </select>
                    <select
                      value={filterPosition}
                      onChange={(e) => setFilterPosition(e.target.value)}
                      className="w-full sm:w-auto p-3 rounded-lg bg-gray-100 border border-gray-300"
                    >
                      <option value="all">All Positions</option>
                      {positions.map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                    <button onClick={downloadUsersCSV} className="w-full sm:w-auto py-2 px-6 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-full shadow-lg transition-colors">
                      Download CSV
                    </button>
                  </div>

                  <h3 className="text-xl font-semibold text-gray-800 mt-6">All Members</h3>
                  {filteredUsers.length > 0 ? (
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Photo</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Full Name</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Contact</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Reg No</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Program</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Year</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Domain</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Position</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {filteredUsers.map(user => (
                            <tr key={user.id}>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <img 
                                  src={user.photo || `https://placehold.co/48x48/2a7b6a/FFFFFF?text=${user.username.charAt(0).toUpperCase()}`} 
                                  alt={`${user.username}`} 
                                  className="w-12 h-12 rounded-full object-cover"
                                  onError={(e) => { e.target.onerror = null; e.target.src=`https://placehold.co/48x48/2a7b6a/FFFFFF?text=${user.username.charAt(0).toUpperCase()}`; }}
                                />
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">{user.username}</td>
                              <td className="px-6 py-4 whitespace-nowrap">{user.email}</td>
                              <td className="px-6 py-4 whitespace-nowrap">{user.contact}</td>
                              <td className="px-6 py-4 whitespace-nowrap">{user.regNo}</td>
                              <td className="px-6 py-4 whitespace-nowrap">{user.program}</td>
                              <td className="px-6 py-4 whitespace-nowrap">{user.year}</td>
                              <td className="px-6 py-4 whitespace-nowrap">{user.domain}</td>
                              <td className="px-6 py-4 whitespace-nowrap">{user.position}</td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${user.status === 'active' ? 'bg-green-100 text-green-800' : user.status === 'inactive' ? 'bg-red-100 text-red-800' : 'bg-yellow-100 text-yellow-800'}`}>
                                  {user.status.charAt(0).toUpperCase() + user.status.slice(1)}
                                </span>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                <div className="flex space-x-2 justify-end">
                                  <button
                                    onClick={() => handleToggleStatus(user)}
                                    className={`${user.status === 'active' ? 'text-red-600 hover:text-red-900' : 'text-green-600 hover:text-green-900'} font-semibold`}
                                  >
                                    {user.status === 'active' ? 'Deactivate' : 'Activate'}
                                  </button>
                                  <button
                                    onClick={() => { setModalMessage(''); setEditingUser(user); }}
                                    className="text-indigo-600 hover:text-indigo-900 font-semibold"
                                  >
                                    Edit
                                  </button>
                                  <button
                                    onClick={() => handleDeleteUser(user)}
                                    className="text-gray-600 hover:text-gray-900 font-semibold"
                                  >
                                    Delete
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p className="text-center text-gray-500">No users found.</p>
                  )}
                </>
              )}
              {adminView === 'attendanceSlots' && (
                <>
                {markingAttendanceForSlot ? (
                  <div className="min-h-screen bg-gray-100 p-4 sm:p-8">
                    <div className="flex justify-between items-center">
                      <h2 className="text-2xl font-bold text-gray-800">Mark Attendance for {markingAttendanceForSlot.slotName}</h2>
                      <div className="flex space-x-2">
                          <button onClick={handleExportAttendance} className="py-2 px-4 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-full shadow-lg transition-colors">Export to CSV</button>
                          <button onClick={() => { setModalMessage(''); setShowImportModal(true); }} className="py-2 px-4 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-full shadow-lg transition-colors">Import from CSV</button>

                          {/* Bulk scope and buttons removed per UI change; small quick-controls are in the table header under 'Status' */}

                          <button onClick={() => setMarkingAttendanceForSlot(null)} className="py-2 px-6 bg-gray-200 hover:bg-gray-300 text-gray-800 font-semibold rounded-full shadow-lg transition-colors">
                            Back to Slots
                          </button>
                      </div>
                    </div>

                    <div className="flex flex-col sm:flex-row items-center justify-between mt-4">
                      <div className="flex space-x-2">
                        <span className="text-green-600 font-bold">Present: {presentCount}</span>
                        <span className="text-red-600 font-bold">Absent: {absentCount}</span>
                      </div>
                      <div className="flex space-x-2 mt-4 sm:mt-0">
                        <input
                          type="text"
                          placeholder="Search..."
                          value={attendanceSearchTerm}
                          onChange={(e) => setAttendanceSearchTerm(e.target.value)}
                          className="p-2 rounded-lg bg-gray-100 border border-gray-300"
                        />
                        <select
                          value={attendanceFilterDomain}
                          onChange={(e) => setAttendanceFilterDomain(e.target.value)}
                          className="p-2 rounded-lg bg-gray-100 border border-gray-300"
                        >
                          <option value="all">All Domains</option>
                          {domains.map(d => <option key={d} value={d}>{d}</option>)}
                        </select>
                        <select
                          value={attendanceFilterPosition}
                          onChange={(e) => setAttendanceFilterPosition(e.target.value)}
                          className="p-2 rounded-lg bg-gray-100 border border-gray-300"
                        >
                          <option value="all">All Positions</option>
                          {positions.map(p => <option key={p} value={p}>{p}</option>)}
                        </select>
                      </div>
                    </div>
                    
                    <div className="mt-6 overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Full Name</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              <div className="flex flex-col">
                                <span className="uppercase text-xs font-medium text-gray-500">Status</span>
                                <div className="mt-2 flex items-center space-x-4">
                                  <label className="inline-flex items-center space-x-2 cursor-pointer">
                                    <button onClick={markAllPresent} aria-label="Mark all present" title="Mark all Present" className="bulk-circle present">
                                      <span className="bulk-dot" aria-hidden="true"></span>
                                    </button>
                                    <span className="text-sm text-gray-700 capitalize">All Present</span>
                                  </label>
                                  <label className="inline-flex items-center space-x-2 cursor-pointer">
                                    <button onClick={markAllAbsent} aria-label="Mark all absent" title="Mark all Absent" className="bulk-circle absent">
                                      <span className="bulk-dot" aria-hidden="true"></span>
                                    </button>
                                    <span className="text-sm text-gray-700 capitalize">All Absent</span>
                                  </label>
                                </div>
                              </div>
                            </th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {filteredAttendanceList.length > 0 ? (
                            filteredAttendanceList.slice().sort(userSort).map(user => (
                              <tr key={user.id}>
                                <td className="px-6 py-4 whitespace-nowrap">{user.username}</td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                  <label className="inline-flex items-center space-x-2">
                                      <input
                                        type="radio"
                                        name={`status-${user.id}`}
                                        value="present"
                                        checked={user.isPresent}
                                        onChange={() => handleToggleAttendance(user.id, true)}
                                        className="custom-radio custom-radio-green"
                                      />
                                    <span>Present</span>
                                  </label>
                                  <label className="inline-flex items-center ml-4 space-x-2">
                                    <input
                                        type="radio"
                                        name={`status-${user.id}`}
                                        value="absent"
                                        checked={!user.isPresent}
                                        onChange={() => handleToggleAttendance(user.id, false)}
                                        className="custom-radio custom-radio-red"
                                      />
                                    <span>Absent</span>
                                  </label>
                                </td>
                              </tr>
                            ))
                          ) : (
                            <tr>
                              <td colSpan="2" className="px-6 py-4 text-center text-gray-500">
                                No eligible users found for this slot.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                    <div className="flex justify-end mt-4">
                      <button onClick={handleSaveAttendance} className="py-2 px-6 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-full shadow-lg transition-colors">
                        Save Attendance
                      </button>
                    </div>
                    {showUndoToast && (
                      <div className="fixed bottom-6 right-6 z-50">
                        <div className="bg-gray-900 text-white px-4 py-2 rounded-lg shadow-lg flex items-center space-x-4">
                          <span>Bulk change applied</span>
                          <button onClick={undoBulk} className="underline text-sm">Undo</button>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                <>
                  <div className="flex justify-between items-center mt-6">
                    <div className="flex space-x-4">
                      <button onClick={() => { setModalMessage(''); const activeUsers = allUsers.filter(u => u.status === 'active').map(u => u.id); setEligibleUsers(activeUsers); setEligibleUserSearch(''); setShowCreateSlot(true); }} className="py-2 px-6 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-full shadow-lg transition-colors">
                        Create Slot
                      </button>
                      <select
                        value={slotTypeFilter}
                        onChange={(e) => setSlotTypeFilter(e.target.value)}
                        className="p-2 rounded-lg bg-gray-100 border border-gray-300"
                      >
                        <option value="all">All Slots</option>
                        {slotTypes.map(type => (
                          <option key={type} value={type}>{type}</option>
                        ))}
                      </select>
                      <select
                        value={slotMonthFilter}
                        onChange={(e) => setSlotMonthFilter(e.target.value)}
                        className="p-2 rounded-lg bg-gray-100 border border-gray-300"
                      >
                        <option value="all">All Months</option>
                        {Array.from({length: 12}, (_, i) => <option key={i} value={i}>{new Date(0, i).toLocaleString('default', { month: 'long' })}</option>)}
                      </select>
                      <select
                        value={slotYearFilter}
                        onChange={(e) => setSlotYearFilter(e.target.value)}
                        className="p-2 rounded-lg bg-gray-100 border border-gray-300"
                      >
                        <option value="all">All Years</option>
                        {Array.from(new Set(attendanceSlots.map(s => new Date(s.date).getFullYear()))).map(y => <option key={y} value={y}>{y}</option>)}
                      </select>
                    </div>
                  </div>
                  <h3 className="text-xl font-semibold text-gray-800 mt-6">All Attendance Slots</h3>
                  {attendanceSlots.filter(slot => 
                    (slotTypeFilter === 'all' || slot.slotType === slotTypeFilter) &&
                    (slotMonthFilter === 'all' || new Date(slot.date).getMonth().toString() === slotMonthFilter) &&
                    (slotYearFilter === 'all' || new Date(slot.date).getFullYear().toString() === slotYearFilter)
                  ).length > 0 ? (
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Slot Name</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Venue</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Timings</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {[...attendanceSlots.filter(slot => 
                            (slotTypeFilter === 'all' || slot.slotType === slotTypeFilter) &&
                            (slotMonthFilter === 'all' || new Date(slot.date).getMonth().toString() === slotMonthFilter) &&
                            (slotYearFilter === 'all' || new Date(slot.date).getFullYear().toString() === slotYearFilter)
                          )].sort((a,b) => new Date(a.date) - new Date(b.date)).map(slot => (
                            <tr key={slot.id}>
                              <td className="px-6 py-4 whitespace-nowrap">{slot.slotName}</td>
                              <td className="px-6 py-4 whitespace-nowrap">{slot.slotType}</td>
                              <td className="px-6 py-4 whitespace-nowrap">{formatDate(slot.date)}</td>
                              <td className="px-6 py-4 whitespace-nowrap">{slot.venue}</td>
                              <td className="px-6 py-4 whitespace-nowrap">{slot.timings}</td>
                              <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                <div className="flex space-x-4">
                                  <button onClick={() => handleMarkAttendance(slot)} className="text-green-600 hover:text-green-900 font-semibold">Mark Attendance</button>
                                  <button onClick={() => { setModalMessage(''); setEligibleUsers(slot.eligibleUserIds || allUsers.filter(u => u.status === 'active').map(u => u.id)); setEditingSlot(slot); }} className="text-indigo-600 hover:text-indigo-900 font-semibold">Edit</button>
                                  <button onClick={() => handleDeleteSlot(slot)} className="text-red-600 hover:text-red-900 font-semibold">Delete</button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p className="text-center text-gray-500 mt-6">No attendance slots found for the selected filters.</p>
                  )}
                </>
                )}
                </>
              )}
            </div>
          </div>
        );

      case 'userDashboard':
        return (
          <div className="min-h-screen bg-gray-100 text-gray-900">
            <div>
              <h2 className="text-2xl font-bold text-gray-800 text-center mb-4">My Dashboard</h2>
              {userProfile && (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="bg-blue-100 p-4 rounded-lg shadow-md text-center text-blue-800">
                      <p className="text-sm font-medium">Overall Attendance</p>
                      <p className="text-2xl font-bold">{getAttendancePercentage(userProfile.id, 'all')}</p>
                      <p className="text-sm">{getAttendanceSummary(userProfile.id, 'all')}</p>
                    </div>
                    <div className="bg-yellow-100 p-4 rounded-lg shadow-md text-center text-yellow-800">
                      <p className="text-sm font-medium">Events Attendance</p>
                      <p className="text-2xl font-bold">{getAttendancePercentage(userProfile.id, 'event')}</p>
                      <p className="text-sm">{getAttendanceSummary(userProfile.id, 'event')}</p>
                    </div>
                    <div className="bg-green-100 p-4 rounded-lg shadow-md text-center text-green-800">
                      <p className="text-sm font-medium">Core Team Meetings</p>
                      <p className="text-2xl font-bold">{getAttendancePercentage(userProfile.id, 'coreteammeeting')}</p>
                      <p className="text-sm">{getAttendanceSummary(userProfile.id, 'coreteammeeting')}</p>
                    </div>
                    <div className="bg-purple-100 p-4 rounded-lg shadow-md text-center text-purple-800">
                      <p className="text-sm font-medium">Domain Meetings</p>
                      <p className="text-2xl font-bold">{getAttendancePercentage(userProfile.id, 'domainmeeting')}</p>
                      <p className="text-sm">{getAttendanceSummary(userProfile.id, 'domainmeeting')}</p>
                    </div>
                  </div>

                  <h3 className="text-xl font-semibold text-gray-800 mt-8">My Attendance Records</h3>
                  <div className="flex flex-wrap items-center space-y-4 sm:space-y-0 sm:space-x-4">
                    <select
                      value={userDashboardFilters.slotType}
                      onChange={(e) => setUserDashboardFilters({ ...userDashboardFilters, slotType: e.target.value })}
                      className="w-full sm:w-auto p-3 rounded-lg bg-gray-100 border border-gray-300"
                    >
                      <option value="all">All Slot Types</option>
                      {slotTypes.map(t => <option key={t} value={normalizeSlotType(t)}>{t}</option>)}
                    </select>
                    <select
                      value={userDashboardFilters.status}
                      onChange={(e) => setUserDashboardFilters({ ...userDashboardFilters, status: e.target.value })}
                      className="w-full sm:w-auto p-3 rounded-lg bg-gray-100 border border-gray-300"
                    >
                      <option value="all">All Statuses</option>
                      <option value="present">Present</option>
                      <option value="absent">Absent</option>
                    </select>
                    <input
                      type="date"
                      value={userDashboardFilters.fromDate}
                      onChange={(e) => setUserDashboardFilters({ ...userDashboardFilters, fromDate: e.target.value })}
                      className="w-full sm:w-auto p-3 rounded-lg bg-gray-100 border border-gray-300"
                    />
                    <span className="text-gray-500">to</span>
                    <input
                      type="date"
                      value={userDashboardFilters.toDate}
                      onChange={(e) => setUserDashboardFilters({ ...userDashboardFilters, toDate: e.target.value })}
                      className="w-full sm:w-auto p-3 rounded-lg bg-gray-100 border border-gray-300"
                    />
                  </div>
                  
                  <div className="overflow-x-auto mt-4">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Slot Name</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Slot Type</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Timings</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {userAttendanceRecords.map(slot => (
                          <tr key={slot.id}>
                            <td className="px-6 py-4 whitespace-nowrap">{slot.slotName}</td>
                            <td className="px-6 py-4 whitespace-nowrap">{slotTypesMap[normalizeSlotType(slot.slotType)] || slot.slotType}</td>
                            <td className="px-6 py-4 whitespace-nowrap">{formatDate(slot.date)}</td>
                            <td className="px-6 py-4 whitespace-nowrap">{slot.timings}</td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${slot.attendance.find(a => a.userId === userProfile.id)?.isPresent ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                                {slot.attendance.find(a => a.userId === userProfile.id)?.isPresent ? 'Present' : 'Absent'}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>
          </div>
        );

      case 'login':
      default:
         return (
          <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
             {!isAuthReady ? (
               <div>Loading...</div>
             ) : (
            <div className="w-full max-w-sm bg-white rounded-lg shadow-xl p-8 space-y-6">
              <h2 className="text-2xl font-bold text-center text-gray-800">Login</h2>
              {message && (
                <div className="text-center text-sm font-medium text-red-500">
                  {message}
                </div>
              )}
              <form onSubmit={handleLogin} className="space-y-4">
                <input type="email" placeholder="Email" value={loginForm.email} onChange={(e) => setLoginForm({ ...loginForm, email: e.target.value })} className="w-full p-3 rounded-lg bg-gray-100 border border-gray-300" />
                <input type="password" placeholder="Password" value={loginForm.password} onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })} className="w-full p-3 rounded-lg bg-gray-100 border border-gray-300" />
                <div className="space-y-4">
                  <button type="submit" className="w-full py-3 px-6 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-full shadow-lg transition-colors">Login</button>
                  <button type="button" onClick={() => setView('register')} className="w-full py-3 px-6 bg-gray-200 hover:bg-gray-300 text-gray-800 font-semibold rounded-full transition-colors">Register New Account</button>
                  <div className="text-center">
                    <button type="button" onClick={() => { setModalMessage(''); setShowForgotPasswordModal(true); }} className="text-sm text-green-600 hover:underline">Forgot Password?</button>
                  </div>
                </div>
              </form>
            </div>
             )}
          </div>
        );
    }
  };

  return (
    <div className="min-h-screen bg-[#F5F5DC]">
      {(view === 'login' || view === 'register') ? (
        <div className="min-h-screen grid grid-cols-1 md:grid-cols-2">
          <div className="hidden md:flex flex-col items-center justify-center bg-[#2a7b6a] text-white p-12">
            <img 
              src="https://imgpx.com/WAerOknABX2d.jpg" 
              alt="MDC Team" 
              className="w-full h-auto rounded-2xl shadow-2xl object-cover mb-8"
              onError={(e) => { e.target.onerror = null; e.target.src='https://placehold.co/800x600/1e5a4f/FFFFFF?text=MDC+Team+Photo'; }}
            />
            <h1 className="text-5xl font-bold">My-MDC</h1>
            <p className="mt-4 text-center">Your unified portal for attendance and member management.</p>
          </div>
          <div className="flex items-center justify-center p-4">
            {renderContent()}
          </div>
        </div>
      ) : (
        <div className="min-h-screen bg-[#F5F5DC]">
          {renderNav()}
          {message && (
            <div className="m-4 p-3 text-center font-medium text-white bg-blue-500 rounded-lg shadow-md">
              {message}
            </div>
          )}
          <div className="px-4 py-4">
            {renderContent()}
          </div>
        </div>
      )}

      {showRegistrationSuccess && (
        <div className="fixed inset-0 bg-gray-900 bg-opacity-75 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-sm text-center">
            <h3 className="text-xl font-bold mb-4 text-green-600">Registration Successful!</h3>
            <p className="mb-4 text-gray-700">Your account has been created and is now pending admin approval. You will be able to log in once it has been approved.</p>
            <button onClick={() => { setShowRegistrationSuccess(false); setView('login'); }} className="py-2 px-6 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-full shadow-lg transition-colors">
              OK
            </button>
          </div>
        </div>
      )}

      {(showCreateSlot || editingSlot) && (
        <div className="fixed inset-0 bg-gray-900 bg-opacity-75 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-2xl max-h-[90vh] flex flex-col">
            <h3 className="text-xl font-bold text-center mb-4">{editingSlot ? `Edit Slot: ${editingSlot.slotName}` : "Create New Slot"}</h3>
            {modalMessage && (
              <div className={`text-center text-sm font-medium mb-4 ${modalMessage.includes('successfully') ? 'text-green-500' : 'text-red-500'}`}>
                {modalMessage}
              </div>
            )}
            <form onSubmit={editingSlot ? handleEditSlot : handleCreateSlot} className="flex-grow overflow-y-auto pr-2">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium">Slot Type <span className="text-red-500">*</span></label>
                  <select value={editingSlot ? editingSlot.slotType : newSlotForm.slotType} onChange={(e) => editingSlot ? setEditingSlot({ ...editingSlot, slotType: e.target.value }) : setNewSlotForm({ ...newSlotForm, slotType: e.target.value })} className="w-full p-3 rounded-lg bg-gray-100 border border-gray-300">
                    <option value="">Select Slot Type</option>
                    {slotTypes.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium">Slot Name <span className="text-red-500">*</span></label>
                  <input type="text" placeholder="Slot Name" value={editingSlot ? editingSlot.slotName : newSlotForm.slotName} onChange={(e) => editingSlot ? setEditingSlot({ ...editingSlot, slotName: e.target.value }) : setNewSlotForm({ ...newSlotForm, slotName: e.target.value })} className="w-full p-3 rounded-lg bg-gray-100 border border-gray-300" />
                </div>
                <div>
                  <label className="block text-sm font-medium">Date <span className="text-red-500">*</span></label>
                  <input type="date" value={editingSlot ? editingSlot.date : newSlotForm.date} onChange={(e) => editingSlot ? setEditingSlot({ ...editingSlot, date: e.target.value }) : setNewSlotForm({ ...newSlotForm, date: e.target.value })} className="w-full p-3 rounded-lg bg-gray-100 border border-gray-300" />
                </div>
                <div>
                  <label className="block text-sm font-medium">Venue</label>
                  <input type="text" placeholder="Venue" value={editingSlot ? editingSlot.venue : newSlotForm.venue} onChange={(e) => editingSlot ? setEditingSlot({ ...editingSlot, venue: e.target.value }) : setNewSlotForm({ ...newSlotForm, venue: e.target.value })} className="w-full p-3 rounded-lg bg-gray-100 border border-gray-300" />
                </div>
                <div className="col-span-1 md:col-span-2">
                  <label className="block text-sm font-medium">Timings</label>
                  <input type="text" placeholder="Timings (e.g., 10:00 AM - 12:00 PM)" value={editingSlot ? editingSlot.timings : newSlotForm.timings} onChange={(e) => editingSlot ? setEditingSlot({ ...editingSlot, timings: e.target.value }) : setNewSlotForm({ ...newSlotForm, timings: e.target.value })} className="w-full p-3 rounded-lg bg-gray-100 border border-gray-300" />
                </div>
              </div>
              
              <div className="mt-6">
                <h4 className="text-lg font-semibold mb-2">Eligible Members</h4>
                <div className="flex justify-between items-center mb-2">
                  <input
                    type="text"
                    placeholder="Search members..."
                    value={eligibleUserSearch}
                    onChange={(e) => setEligibleUserSearch(e.target.value)}
                    className="w-1/2 p-2 rounded-lg bg-gray-100 border border-gray-300"
                  />
                  <div className="flex space-x-2">
                    <button type="button" onClick={handleSelectAllEligible} className="text-sm text-blue-600 font-semibold">Select All</button>
                    <button type="button" onClick={handleDeselectAllEligible} className="text-sm text-red-600 font-semibold">Deselect All</button>
                  </div>
                </div>
                <div className="max-h-48 overflow-y-auto border rounded-lg p-2">
                  {allUsers.filter(u => u.status === 'active' && u.username.toLowerCase().includes(eligibleUserSearch.toLowerCase())).map(user => (
                    <div key={user.id} className="flex items-center space-x-2 p-1">
                      <input
                        type="checkbox"
                        id={`eligible-${user.id}`}
                        checked={eligibleUsers.includes(user.id)}
                        onChange={() => handleToggleEligibleUser(user.id)}
                        className="h-4 w-4 text-indigo-600 border-gray-300 rounded"
                      />
                      <label htmlFor={`eligible-${user.id}`}>{user.username}</label>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex justify-end space-x-4 mt-4 pt-4 border-t">
                <button type="button" onClick={() => { setShowCreateSlot(false); setEditingSlot(null); setEligibleUsers([]); setEligibleUserSearch(''); }} className="py-2 px-4 bg-gray-200 hover:bg-gray-300 text-gray-800 font-semibold rounded-full transition-colors">Cancel</button>
                <button type="submit" className="py-2 px-4 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-full shadow-lg transition-colors">{editingSlot ? 'Save Changes' : 'Create'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
      
      {showImportModal && (
        <div className="fixed inset-0 bg-gray-900 bg-opacity-75 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md text-center">
            <h3 className="text-xl font-bold mb-4">Import Attendance from CSV</h3>
            {modalMessage && (
                <div className={`text-center text-sm font-medium mb-4 ${modalMessage.includes('successfully') ? 'text-green-500' : 'text-red-500'}`}>
                    {modalMessage}
                </div>
            )}
            <div className="text-left mb-4 p-4 bg-gray-100 rounded-lg">
              <p className="font-semibold">Instructions:</p>
              <ol className="list-decimal list-inside text-sm">
                <li>Download the template. It contains all active members.</li>
                <li>Edit the 'status' column to 'present' for attended members.</li>
                <li>The 'Full Name' column is for your reference and will be ignored.</li>
                <li>Choose the edited file and click "Upload and Apply".</li>
              </ol>
            </div>
            <button onClick={handleDownloadTemplate} className="w-full py-2 px-4 mb-4 bg-gray-200 hover:bg-gray-300 text-gray-800 font-semibold rounded-full transition-colors">Download Template (Active Users)</button>
            
            <input 
              type="file" 
              accept=".csv"
              onChange={(e) => setImportFile(e.target.files[0])}
              className="w-full mb-4 text-gray-900 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-gray-50 file:text-gray-700 hover:file:bg-gray-100"
            />
            
            <div className="flex justify-center space-x-4">
              <button onClick={() => { setShowImportModal(false); setImportFile(null); }} className="py-2 px-4 bg-gray-200 hover:bg-gray-300 text-gray-800 font-semibold rounded-full transition-colors">Cancel</button>
              <button onClick={handleImportAttendance} className="py-2 px-4 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-full shadow-lg transition-colors">Upload and Apply</button>
            </div>
          </div>
        </div>
      )}

      {editingUser && (
        <div className="fixed inset-0 bg-gray-900 bg-opacity-75 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md">
            <h3 className="text-xl font-bold text-center mb-4">Edit User: {editingUser.username}</h3>
            {modalMessage && (
                <div className={`text-center text-sm font-medium mb-4 ${modalMessage.includes('successfully') ? 'text-green-500' : 'text-red-500'}`}>
                    {modalMessage}
                </div>
            )}
            <form onSubmit={handleSaveEdit} className="space-y-4">
              <input type="text" placeholder="Full Name" value={editingUser.username || ''} onChange={(e) => setEditingUser({ ...editingUser, username: e.target.value })} className="w-full p-3 rounded-lg bg-gray-100 border border-gray-300" />
              <input type="email" placeholder="Email" value={editingUser.email || ''} onChange={(e) => setEditingUser({ ...editingUser, email: e.target.value })} className="w-full p-3 rounded-lg bg-gray-100 border border-gray-300" />
              <input type="tel" placeholder="Contact Number" value={editingUser.contact || ''} onChange={(e) => setEditingUser({ ...editingUser, contact: e.target.value })} className="w-full p-3 rounded-lg bg-gray-100 border border-gray-300" />
              <select value={editingUser.year || ''} onChange={(e) => setEditingUser({ ...editingUser, year: e.target.value })} className="w-full p-3 rounded-lg bg-gray-100 border border-gray-300">
                <option value="">Year of Study</option>
                {years.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
              <input type="text" placeholder="Registration Number" value={editingUser.regNo || ''} onChange={(e) => setEditingUser({ ...editingUser, regNo: e.target.value })} className="w-full p-3 rounded-lg bg-gray-100 border border-gray-300" />
              <input type="text" placeholder="Program" value={editingUser.program || ''} onChange={(e) => setEditingUser({ ...editingUser, program: e.target.value })} className="w-full p-3 rounded-lg bg-gray-100 border border-gray-300" />
              <select value={editingUser.domain || ''} onChange={(e) => setEditingUser({ ...editingUser, domain: e.target.value })} className="w-full p-3 rounded-lg bg-gray-100 border border-gray-300">
                <option value="">Select Domain</option>
                {domains.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
              <select value={editingUser.position || ''} onChange={(e) => setEditingUser({ ...editingUser, position: e.target.value })} className="w-full p-3 rounded-lg bg-gray-100 border border-gray-300">
                <option value="">Select Position</option>
                {positions.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
              <div className="flex justify-end space-x-4 mt-4">
                <button type="button" onClick={() => setEditingUser(null)} className="py-2 px-4 bg-gray-200 hover:bg-gray-300 text-gray-800 font-semibold rounded-full transition-colors">Cancel</button>
                <button type="submit" className="py-2 px-4 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-full shadow-lg transition-colors">Save Changes</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {deletingUser && (
        <div className="fixed inset-0 bg-gray-900 bg-opacity-75 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-sm text-center">
            <h3 className="text-xl font-bold mb-4">Confirm Deletion</h3>
            <p className="mb-4">Are you sure you want to delete user "{deletingUser.username}"? This action cannot be undone.</p>
            <div className="flex justify-center space-x-4">
              <button onClick={() => setDeletingUser(null)} className="py-2 px-4 bg-gray-200 hover:bg-gray-300 text-gray-800 font-semibold rounded-full transition-colors">Cancel</button>
              <button onClick={confirmDelete} className="py-2 px-4 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-full shadow-lg transition-colors">Delete</button>
            </div>
          </div>
        </div>
      )}
      
      {deletingSlot && (
        <div className="fixed inset-0 bg-gray-900 bg-opacity-75 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-sm text-center">
            <h3 className="text-xl font-bold mb-4">Confirm Deletion</h3>
            <p className="mb-4">Are you sure you want to delete the slot "{deletingSlot.slotName}"? This action cannot be undone.</p>
            <div className="flex justify-center space-x-4">
              <button onClick={() => setDeletingSlot(null)} className="py-2 px-4 bg-gray-200 hover:bg-gray-300 text-gray-800 font-semibold rounded-full transition-colors">Cancel</button>
              <button onClick={confirmDeleteSlot} className="py-2 px-4 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-full shadow-lg transition-colors">Delete</button>
            </div>
          </div>
        </div>
      )}
      
      {showMemberAttendanceDetails && selectedMember && (
        <div className="fixed inset-0 bg-gray-900 bg-opacity-75 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-3xl max-h-screen overflow-y-auto space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-xl font-bold">
                {selectedMember.username}'s Attendance Details
              </h3>
              <div className="flex items-center space-x-2">
                <button onClick={() => handleDownloadMemberAttendance(selectedMember)} className="py-1 px-3 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-md text-sm border">
                  Download CSV
                </button>
                <button onClick={() => setShowMemberAttendanceDetails(false)} className="text-gray-500 hover:text-gray-700">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-blue-100 p-4 rounded-lg shadow-md text-center text-blue-800">
                <p className="font-semibold">Events Attended</p>
                <p className="text-2xl font-bold">{getAttendanceSummary(selectedMember.id, 'event')}</p>
              </div>
              <div className="bg-yellow-100 p-4 rounded-lg shadow-md text-center text-yellow-800">
                <p className="font-semibold">Core Team Meetings</p>
                <p className="text-2xl font-bold">{getAttendanceSummary(selectedMember.id, 'coreteammeeting')}</p>
              </div>
              <div className="bg-green-100 p-4 rounded-lg shadow-md text-center text-green-800">
                <p className="font-semibold">Domain Meetings</p>
                <p className="text-2xl font-bold">{getAttendanceSummary(selectedMember.id, 'domainmeeting')}</p>
              </div>
            </div>

            <div className="flex space-x-4 mt-4">
              <select
                value={dashboardFilterMonth}
                onChange={(e) => setDashboardFilterMonth(e.target.value)}
                className="w-full p-3 rounded-lg bg-gray-100 border border-gray-300"
              >
                <option value="all">All Months</option>
                {Array.from({length: 12}, (_, i) => <option key={i} value={i}>{new Date(0, i).toLocaleString('default', { month: 'long' })}</option>)}
              </select>
              <select
                value={dashboardFilterYear}
                onChange={(e) => setDashboardFilterYear(e.target.value)}
                className="w-full p-3 rounded-lg bg-gray-100 border border-gray-300"
              >
                <option value="all">All Years</option>
                {Array.from(new Set(attendanceSlots.map(s => new Date(s.date).getFullYear()))).map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>

            <div className="overflow-x-auto max-h-64">
              <table className="min-w-full bg-white rounded-xl overflow-hidden">
                <thead className="bg-gray-50 sticky top-0">
                  <tr>
                    <th className="py-3 px-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Slot Name</th>
                    <th className="py-3 px-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Date</th>
                    <th className="py-3 px-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {memberAttendanceDetails.map(slot => (
                    <tr key={slot.id}>
                      <td className="px-6 py-4 whitespace-nowrap">{slot.slotName}</td>
                      <td className="px-6 py-4 whitespace-nowrap">{formatDate(slot.date)}</td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${slot.isPresent ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                          {slot.isPresent ? 'Present' : 'Absent'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            
          </div>
        </div>
      )}

      {showViolationModal && violationModalMember && (
        <div className="fixed inset-0 bg-gray-900 bg-opacity-75 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-3xl max-h-screen overflow-y-auto space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-xl font-bold">
                {violationModalMember.username}'s Violation Details
              </h3>
              <button onClick={() => { setShowViolationModal(false); setViolationModalMember(null); }} className="text-gray-500 hover:text-gray-700">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="space-y-2">
              {(() => {
                const v = violationsMap[violationModalMember.id] || { violationCount: 0, violations: [] };
                if (v.violationCount === 0) return <p className="text-gray-600">No violations found for this member.</p>;
                return (
                  <div className="space-y-3">
                    <p className="text-sm text-gray-600">Total violations: <span className="font-semibold text-red-600">{v.violationCount}</span></p>
                    <div className="space-y-2">
                      {v.violations.map((grp, idx) => (
                        <div key={idx} className="p-3 border rounded-lg bg-red-50">
                          <p className="text-sm font-semibold">Violation #{idx + 1}</p>
                          <p className="text-sm">Slots: {grp.slotNames.join(' • ')}</p>
                          <p className="text-sm text-gray-600">Dates: {grp.dates.join(' → ')}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      )}

      {showEditProfileModal && userProfile && (
        <div className="fixed inset-0 bg-gray-900 bg-opacity-75 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md max-h-screen overflow-y-auto">
            <h3 className="text-xl font-bold text-center mb-4">Edit Your Profile</h3>
            {modalMessage && (
                <div className={`text-center text-sm font-medium mb-4 ${modalMessage.includes('successfully') ? 'text-green-500' : 'text-red-500'}`}>
                    {modalMessage}
                </div>
            )}
            <form onSubmit={handleEditProfile} className="space-y-4">
              <div className="flex justify-center mb-4">
                {userProfile.photo ? (
                  <img src={userProfile.photo} alt="Profile" className="w-24 h-24 rounded-full object-cover" />
                ) : (
                  <div className="w-24 h-24 rounded-full bg-gray-300 flex items-center justify-center text-4xl font-bold">{userProfile.username.charAt(0).toUpperCase()}</div>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium">Full Name</label>
                <input type="text" value={userProfile.username || ''} onChange={(e) => setUserProfile({ ...userProfile, username: e.target.value })} className="w-full p-3 rounded-lg bg-gray-100 border border-gray-300" />
              </div>
              <div>
                <label className="block text-sm font-medium">Email</label>
                <input type="email" value={userProfile.email || ''} onChange={(e) => setUserProfile({ ...userProfile, email: e.target.value })} className="w-full p-3 rounded-lg bg-gray-100 border border-gray-300" />
              </div>
              <div>
                <label className="block text-sm font-medium">Contact Number</label>
                <input type="tel" value={userProfile.contact || ''} onChange={(e) => setUserProfile({ ...userProfile, contact: e.target.value })} className="w-full p-3 rounded-lg bg-gray-100 border border-gray-300" />
              </div>
              <div>
                <label className="block text-sm font-medium">Year of Study</label>
                <select value={userProfile.year || ''} onChange={(e) => setUserProfile({ ...userProfile, year: e.target.value })} className="w-full p-3 rounded-lg bg-gray-100 border border-gray-300">
                  {years.map(y => <option key={y} value={y}>{y}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium">Registration Number</label>
                <input type="text" value={userProfile.regNo || ''} onChange={(e) => setUserProfile({ ...userProfile, regNo: e.target.value })} className="w-full p-3 rounded-lg bg-gray-100 border border-gray-300" />
              </div>
              <div>
                <label className="block text-sm font-medium">Program</label>
                <input type="text" placeholder="Enter your program" value={userProfile.program} onChange={(e) => setUserProfile({ ...userProfile, program: e.target.value })} className="w-full p-3 rounded-lg bg-gray-100 border border-gray-300" />
              </div>
              <div>
                <label className="block text-sm font-medium">Domain</label>
                <select value={userProfile.domain || ''} onChange={(e) => setUserProfile({ ...userProfile, domain: e.target.value })} className="w-full p-3 rounded-lg bg-gray-100 border border-gray-300">
                  {domains.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium">Position</label>
                <select value={userProfile.position || ''} onChange={(e) => setUserProfile({ ...userProfile, position: e.target.value })} className="w-full p-3 rounded-lg bg-gray-100 border border-gray-300">
                {positions.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium">Change Photo</label>
                <input type="file" onChange={handlePhotoUpload} className="mt-1 block w-full text-gray-900 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-gray-50 file:text-gray-700 hover:file:bg-gray-100" />
              </div>
              <div className="flex justify-end space-x-4 mt-4">
                <button type="button" onClick={() => setShowEditProfileModal(false)} className="py-2 px-4 bg-gray-200 hover:bg-gray-300 text-gray-800 font-semibold rounded-full transition-colors">Cancel</button>
                <button type="submit" className="py-2 px-4 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-full shadow-lg transition-colors">Save Changes</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showChangePasswordModal && (
        <div className="fixed inset-0 bg-gray-900 bg-opacity-75 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-sm">
            <h3 className="text-xl font-bold text-center mb-4">Change Password</h3>
            {passwordChangeMessage && (
              <div className={`text-center text-sm font-medium mb-4 ${passwordChangeMessage.includes('successfully') ? 'text-green-500' : 'text-red-500'}`}>
                {passwordChangeMessage}
              </div>
            )}
            <form onSubmit={handleChangePassword} className="space-y-4">
              <div>
                <label className="block text-sm font-medium">Current Password</label>
                <input type="password" value={passwordForm.currentPassword} onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })} className="w-full p-3 rounded-lg bg-gray-100 border border-gray-300" />
              </div>
              <div>
                <label className="block text-sm font-medium">New Password</label>
                <input type="password" value={passwordForm.newPassword} onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })} className="w-full p-3 rounded-lg bg-gray-100 border border-gray-300" />
              </div>
              <div className="flex justify-end space-x-4 mt-4">
                <button type="button" onClick={() => setShowChangePasswordModal(false)} className="py-2 px-4 bg-gray-200 hover:bg-gray-300 text-gray-800 font-semibold rounded-full transition-colors">Cancel</button>
                <button type="submit" className="py-2 px-4 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-full shadow-lg transition-colors">Change Password</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showForgotPasswordModal && (
        <div className="fixed inset-0 bg-gray-900 bg-opacity-75 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-sm text-center">
            <h3 className="text-xl font-bold mb-4">Forgot Password?</h3>
            {modalMessage && (
                <div className={`text-center text-sm font-medium mb-4 ${modalMessage.includes('sent') ? 'text-green-500' : 'text-red-500'}`}>
                    {modalMessage}
                </div>
            )}
            <p className="mb-4">Enter your email and a password reset email will be sent to your account.</p>
            <form onSubmit={handleForgotPassword} className="space-y-4">
              <input type="email" name="email" placeholder="Enter your email" className="w-full p-3 rounded-lg bg-gray-100 border border-gray-300" required />
              <div className="flex justify-center space-x-4">
                <button type="button" onClick={() => setShowForgotPasswordModal(false)} className="py-2 px-4 bg-gray-200 hover:bg-gray-300 text-gray-800 font-semibold rounded-full transition-colors">Cancel</button>
                <button type="submit" className="py-2 px-4 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-full shadow-lg transition-colors">Send Reset Email</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;


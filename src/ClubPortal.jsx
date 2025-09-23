import React, { useState, useEffect } from 'react';
import { useMemo } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, sendPasswordResetEmail, deleteUser, updatePassword } from 'firebase/auth';
import { getFirestore, collection, addDoc, onSnapshot, query, updateDoc, doc, deleteDoc, setDoc, serverTimestamp, getDoc } from 'firebase/firestore';

const App = () => {
  // State for Firebase services and user information
  const [db, setDb] = useState(null);
  const [auth, setAuth] = useState(null);
  // Removed unused userId state
  const [isAdmin, setIsAdmin] = useState(false);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [adminPassword, setAdminPassword] = useState('Meta@1234');


  // State for UI navigation and Admin Panel view
  const [view, setView] = useState('login'); // 'login', 'register', 'userDashboard', 'adminDashboard'
  const [adminView, setAdminView] = useState('dashboard'); // 'dashboard', 'manageUsers', 'attendanceSlots'
  const [showProfileDropdown, setShowProfileDropdown] = useState(false);

  // State for forms and messages
  const [loginForm, setLoginForm] = useState({ email: '', password: '' });
  const [registerForm, setRegisterForm] = useState({
    photo: null, username: '', email: '', contact: '', year: '', regNo: '', program: '', domain: '', position: '', password: ''
  });
  const [message, setMessage] = useState('');
  const [allUsers, setAllUsers] = useState([]);
  const [editingUser, setEditingUser] = useState(null);
  const [deletingUser, setDeletingUser] = useState(null);
  const [showRegistrationSuccess, setShowRegistrationSuccess] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');

  // State for Attendance Slots
  const [attendanceSlots, setAttendanceSlots] = useState([]);
  const [showCreateSlot, setShowCreateSlot] = useState(false);
  const [newSlotForm, setNewSlotForm] = useState({ slotType: '', slotName: '', date: '', venue: '', timings: '' });
  const [editingSlot, setEditingSlot] = useState(null);
  const [markingAttendanceForSlot, setMarkingAttendanceForSlot] = useState(null);
  const [slotAttendance, setSlotAttendance] = useState([]); // Array of { userId, isPresent }
  const [attendanceSearchTerm, setAttendanceSearchTerm] = useState('');
  const [attendanceFilterDomain, setAttendanceFilterDomain] = useState('all');
  const [attendanceFilterPosition, setAttendanceFilterPosition] = useState('all');
  const [slotTypeFilter, setSlotTypeFilter] = useState('all');
  const [slotMonthFilter, setSlotMonthFilter] = useState('all');
  const [slotYearFilter, setSlotYearFilter] = useState('all');

  // State for Dashboard
  const [showMemberAttendanceDetails, setShowMemberAttendanceDetails] = useState(false);
  const [selectedMember, setSelectedMember] = useState(null);
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

  // Domain and Position dropdown options
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
    
    // The onAuthStateChanged listener is now for tracking changes, not for initial sign-in
    const unsubscribe = onAuthStateChanged(authInstance, async (user) => {
      if (user) {
        // setUserId(user.uid); // Removed unused userId assignment
        // Also fetch user profile from Firestore
        const userDocRef = doc(dbInstance, `/artifacts/${appId}/public/data/users`, user.uid);
        const userDoc = await getDoc(userDocRef);
        if (userDoc.exists()) {
          setUserProfile({ id: user.uid, ...userDoc.data() });
        }
      } else {
        // setUserId(null); // Removed unused userId assignment
        setUserProfile(null);
      }
      setIsAuthReady(true);
    });

    return () => unsubscribe();
  }, [appId, firebaseConfig]);

  // Firestore listener for all users (Admin view)
  useEffect(() => {
    if (isAuthReady && db && isAdmin) {
      const usersCollectionPath = `/artifacts/${appId}/public/data/users`;
      const q = query(collection(db, usersCollectionPath));

      const unsubscribe = onSnapshot(q, (snapshot) => {
        const users = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        setAllUsers(users);
      }, (error) => {
        console.error("Firestore snapshot error:", error);
        setMessage("Failed to load users for admin panel.");
      });

      return () => unsubscribe();
    }
  }, [isAuthReady, db, isAdmin, appId]);

  // Firestore listener for attendance slots (Admin view)
  useEffect(() => {
    if (isAuthReady && db) {
      const slotsCollectionPath = `/artifacts/${appId}/public/data/attendance_slots`;
      const q = query(collection(db, slotsCollectionPath));

      const unsubscribe = onSnapshot(q, (snapshot) => {
        const slots = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        setAttendanceSlots(slots);
      }, (error) => {
        console.error("Firestore snapshot error:", error);
        setMessage("Failed to load attendance slots.");
      });

      return () => unsubscribe();
    }
  }, [isAuthReady, db, appId]);
  
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
      // setUserId(user.uid); // Removed unused userId assignment
      setIsAdmin(userData.isAdmin || false);
      setUserProfile({ id: user.uid, ...userData });
      setView('userDashboard');
      setMessage("Login successful!");
    } catch (e) {
      console.error("Error during login: ", e.message);
      setMessage("Login failed. Invalid email or password.");
    }
  };

  // Handle forgot password request
  const handleForgotPassword = async (e) => {
    e.preventDefault();
    setMessage('');
    const emailToReset = e.target.email.value;
    if (!emailToReset) {
      setMessage("Please enter your email address.");
      return;
    }
    
    try {
        await sendPasswordResetEmail(auth, emailToReset);
        setMessage("A password reset email has been sent to your address. Please check your inbox.");
        setShowForgotPasswordModal(false);
    } catch (e) {
        console.error("Error sending password reset email:", e.message);
        setMessage("Failed to send password reset email. Please ensure the email is valid and try again.");
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
    setDeletingUser(user);
  };

  const confirmDelete = async () => {
    if (!db || !isAdmin || !deletingUser) return;
    try {
      // First, delete the user from Firebase Authentication
      const userToDelete = auth.currentUser;
      if (userToDelete.uid === deletingUser.id) {
        await deleteUser(userToDelete);
      }

      // Then, delete the user's Firestore document
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
      setMessage(`User ${editingUser.username} details updated successfully.`);
      setEditingUser(null);
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

  // Filter and search logic
  const filteredUsers = allUsers.filter(user => {
    const matchesSearch = searchTerm === '' ||
      user.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesFilter = filterStatus === 'all' || user.status === filterStatus;

    return matchesSearch && matchesFilter;
  });

  // Handle admin actions (attendance slots)
  const handleCreateSlot = async (e) => {
    e.preventDefault();
    if (!db || !isAdmin) return;
    
    if (!newSlotForm.slotType || !newSlotForm.slotName || !newSlotForm.date) {
        setMessage("Slot Type, Slot Name, and Date are mandatory.");
        return;
    }

    try {
      const slotsCollectionPath = `/artifacts/${appId}/public/data/attendance_slots`;
      await addDoc(collection(db, slotsCollectionPath), {
        ...newSlotForm,
        createdAt: serverTimestamp(),
        attendance: [], // Initialize with an empty array for attendance
      });
      setMessage("Attendance slot created successfully.");
      setShowCreateSlot(false);
      setNewSlotForm({ slotType: '', slotName: '', date: '', venue: '', timings: '' });
    } catch (e) {
      console.error("Error creating slot:", e.message);
      setMessage("Failed to create attendance slot. Please try again.");
    }
  };

  const handleEditSlot = async (e) => {
    e.preventDefault();
    if (!db || !isAdmin || !editingSlot) return;
    try {
      const slotDocRef = doc(db, `/artifacts/${appId}/public/data/attendance_slots`, editingSlot.id);
      await updateDoc(slotDocRef, {
        slotName: editingSlot.slotName,
        slotType: editingSlot.slotType,
        date: editingSlot.date,
        venue: editingSlot.venue,
        timings: editingSlot.timings,
      });
      setMessage("Attendance slot updated successfully.");
      setEditingSlot(null);
    } catch (e) {
      console.error("Error editing slot:", e.message);
      setMessage("Failed to update attendance slot. Please try again.");
    }
  };

  const handleDeleteSlot = async (slot) => {
    if (!db || !isAdmin) return;
    try {
      const slotDocRef = doc(db, `/artifacts/${appId}/public/data/attendance_slots`, slot.id);
      await deleteDoc(slotDocRef);
      setMessage("Attendance slot deleted successfully.");
    } catch (e) {
      console.error("Error deleting slot:", e.message);
      setMessage("Failed to delete attendance slot. Please try again.");
    }
  };

  const handleMarkAttendance = (slot) => {
    setMarkingAttendanceForSlot(slot);
    // Initialize attendance list with all ACTIVE users marked as absent
    const activeUsers = allUsers.filter(user => user.status === 'active');
    const initialAttendance = activeUsers.map(user => {
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
      'Username',
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
  
  const handleViewMemberDetails = (member) => {
    setSelectedMember(member);
    setShowMemberAttendanceDetails(true);
  };

  const memberAttendanceDetails = selectedMember ? attendanceSlots.filter(slot =>
    slot.attendance.some(a => a.userId === selectedMember.id) &&
    (dashboardFilterMonth === 'all' || new Date(slot.date).getMonth().toString() === dashboardFilterMonth) &&
    (dashboardFilterYear === 'all' || new Date(slot.date).getFullYear().toString() === dashboardFilterYear)
  ).map(slot => {
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
      setMessage("Profile updated successfully!");
      setShowEditProfileModal(false);
    } catch (e) {
      console.error("Error updating profile:", e);
      setMessage("Failed to update profile.");
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
      }, 500);
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
      }, 500);
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

  // Removed unused getSlotTiming function

  
  // Nav bar and main content
  const renderNav = () => (
    <nav className="bg-[#2a7b6a] text-white px-4 py-4 flex justify-between items-center rounded-b-xl shadow-lg">
      <h1 className="text-xl sm:text-2xl font-bold">
        Meta Developer Communities
      </h1>
      {isAdmin ? (
        <div className="flex space-x-4">
          <button onClick={() => { setAdminView('dashboard'); setMarkingAttendanceForSlot(null); }} className={`px-4 py-2 rounded-full font-medium ${adminView === 'dashboard' ? 'bg-[#1e5a4f] text-white shadow-md' : 'text-gray-200 hover:text-white'}`}>
            Dashboard
          </button>
          <button onClick={() => { setAdminView('manageUsers'); setMarkingAttendanceForSlot(null); }} className={`px-4 py-2 rounded-full font-medium ${adminView === 'manageUsers' ? 'bg-[#1e5a4f] text-white shadow-md' : 'text-gray-200 hover:text-white'}`}>
            Manage Users
          </button>
          <button onClick={() => { setAdminView('attendanceSlots'); setMarkingAttendanceForSlot(null); }} className={`px-4 py-2 rounded-full font-medium ${adminView === 'attendanceSlots' ? 'bg-[#1e5a4f] text-white shadow-md' : 'text-gray-200 hover:text-white'}`}>
            Attendance Slots
          </button>
        </div>
      ) : null}
      <div className="relative">
        {userProfile && !isAdmin ? (
          <button onClick={() => setShowProfileDropdown(!showProfileDropdown)} className="w-10 h-10 rounded-full bg-white flex items-center justify-center text-gray-700 transition-transform transform hover:scale-110">
            {userProfile.photo ? (
              <img src={userProfile.photo} alt="Profile" className="w-full h-full rounded-full object-cover" />
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                <path strokeLinecap="round" strokeLinejoin="round" d="M17.982 18.725A7.488 7.488 0 0012 15.75a7.488 7.488 0 00-5.982 2.975m11.963 0a7.5 7.5 0 10-11.963 0m11.963 0A8.966 8.966 0 0112 21a8.966 8.966 0 01-5.982-2.275M15 9.75a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            )}
          </button>
        ) : isAdmin ? (
          <button onClick={() => setShowProfileDropdown(!showProfileDropdown)} className="w-10 h-10 rounded-full bg-white flex items-center justify-center text-gray-700 transition-transform transform hover:scale-110">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
              <path strokeLinecap="round" strokeLinejoin="round" d="M17.982 18.725A7.488 7.488 0 0012 15.75a7.488 7.488 0 00-5.982 2.975m11.963 0a7.5 7.5 0 10-11.963 0m11.963 0A8.966 8.966 0 0112 21a8.966 8.966 0 01-5.982-2.275M15 9.75a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </button>
        ) : null}
        {showProfileDropdown && (
          <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg py-1 z-20">
            {!isAdmin && (
              <button onClick={() => { setShowEditProfileModal(true); setShowProfileDropdown(false); }} className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 w-full text-left">
                Edit Details
              </button>
            )}
            <button onClick={() => { setShowChangePasswordModal(true); setShowProfileDropdown(false); setPasswordForm({ currentPassword: '', newPassword: '' }); setPasswordChangeMessage(''); }} className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 w-full text-left">
              Change Password
            </button>
            <button onClick={() => { setView('login'); setIsAdmin(false); setMessage(''); setLoginForm({ email: '', password: '' }); setShowProfileDropdown(false); }} className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 w-full text-left">
              Logout
            </button>
          </div>
        )}
      </div>
    </nav>
  );

  const renderContent = () => {
    switch (view) {
      case 'register':
        return (
          <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
            <div className="w-full max-w-lg bg-white rounded-lg shadow-xl p-8 space-y-6">
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
                  <label className="block text-sm font-medium">Username <span className="text-red-500">*</span></label>
                  <input type="text" placeholder="Enter username" value={registerForm.username} onChange={(e) => setRegisterForm({ ...registerForm, username: e.target.value })} className="w-full p-3 rounded-lg bg-gray-100 border border-gray-300" />
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
                  <button type="submit" className="w-full py-3 px-6 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-full shadow-lg transition-colors">Register</button>
                  <button type="button" onClick={() => setView('login')} className="w-full py-3 px-6 bg-gray-200 hover:bg-gray-300 text-gray-800 font-semibold rounded-full transition-colors">Back to Login</button>
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
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Username</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Domain</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Position</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Overall (%)</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Events (%)</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Core Team (%)</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Domain M. (%)</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Details</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {allUsers.filter(user => user.status === 'active' &&
                          (dashboardFilterDomain === 'all' || user.domain === dashboardFilterDomain) &&
                          (dashboardFilterPosition === 'all' || user.position === dashboardFilterPosition)
                        ).map(user => {
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
                              <td className="px-6 py-4 whitespace-nowrap">{getAttendancePercentage(user.id, 'all')}</td>
                              <td className="px-6 py-4 whitespace-nowrap">{getAttendancePercentage(user.id, 'event')}</td>
                              <td className="px-6 py-4 whitespace-nowrap">{getAttendancePercentage(user.id, 'coreteammeeting')}</td>
                              <td className="px-6 py-4 whitespace-nowrap">{getAttendancePercentage(user.id, 'domainmeeting')}</td>
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

                  <div className="mt-6 flex flex-col sm:flex-row items-center space-y-4 sm:space-y-0 sm:space-x-4">
                    <input
                      type="text"
                      placeholder="Search users..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full sm:w-1/2 p-3 rounded-lg bg-gray-100 border border-gray-300"
                    />
                    <select
                      value={filterStatus}
                      onChange={(e) => setFilterStatus(e.target.value)}
                      className="w-full sm:w-auto p-3 rounded-lg bg-gray-100 border border-gray-300"
                    >
                      <option value="all">All Users</option>
                      <option value="active">Active</option>
                      <option value="inactive">Inactive</option>
                      <option value="pending">Pending Approval</option>
                    </select>
                  </div>

                  <h3 className="text-xl font-semibold text-gray-800 mt-6">All Members</h3>
                  {filteredUsers.length > 0 ? (
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Photo</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Username</th>
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
                                {user.photo ? <img src={user.photo} alt={`${user.username}`} className="w-12 h-12 rounded-full object-cover" /> : <div className="w-12 h-12 rounded-full bg-gray-300 flex items-center justify-center text-lg font-bold">{user.username.charAt(0).toUpperCase()}</div>}
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
                                    onClick={() => setEditingUser(user)}
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
                      <button onClick={() => setMarkingAttendanceForSlot(null)} className="py-2 px-6 bg-gray-200 hover:bg-gray-300 text-gray-800 font-semibold rounded-full shadow-lg transition-colors">
                        Back to Slots
                      </button>
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
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">User Name</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {filteredAttendanceList.length > 0 ? (
                            filteredAttendanceList.map(user => (
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
                                      className="form-radio text-green-600"
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
                                      className="form-radio text-red-600"
                                    />
                                    <span>Absent</span>
                                  </label>
                                </td>
                              </tr>
                            ))
                          ) : (
                            <tr>
                              <td colSpan="2" className="px-6 py-4 text-center text-gray-500">
                                No active users found.
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
                  </div>
                ) : (
                <>
                  <div className="flex justify-between items-center mt-6">
                    <div className="flex space-x-4">
                      <button onClick={() => setShowCreateSlot(true)} className="py-2 px-6 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-full shadow-lg transition-colors">
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
                          {attendanceSlots.filter(slot => 
                            (slotTypeFilter === 'all' || slot.slotType === slotTypeFilter) &&
                            (slotMonthFilter === 'all' || new Date(slot.date).getMonth().toString() === slotMonthFilter) &&
                            (slotYearFilter === 'all' || new Date(slot.date).getFullYear().toString() === slotYearFilter)
                          ).map(slot => (
                            <tr key={slot.id}>
                              <td className="px-6 py-4 whitespace-nowrap">{slot.slotName}</td>
                              <td className="px-6 py-4 whitespace-nowrap">{slot.slotType}</td>
                              <td className="px-6 py-4 whitespace-nowrap">{slot.date}</td>
                              <td className="px-6 py-4 whitespace-nowrap">{slot.venue}</td>
                              <td className="px-6 py-4 whitespace-nowrap">{slot.timings}</td>
                              <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                <div className="flex space-x-4">
                                  <button onClick={() => handleMarkAttendance(slot)} className="text-green-600 hover:text-green-900 font-semibold">Mark Attendance</button>
                                  <button onClick={() => setEditingSlot(slot)} className="text-indigo-600 hover:text-indigo-900 font-semibold">Edit</button>
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
                            <td className="px-6 py-4 whitespace-nowrap">{slot.date}</td>
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
                    <button type="button" onClick={() => setShowForgotPasswordModal(true)} className="text-sm text-green-600 hover:underline">Forgot Password?</button>
                  </div>
                </div>
              </form>
            </div>
          </div>
        );
    }
  };

  return (
    <div className="min-h-screen bg-[#F5F5DC]">
      {(view === 'login' || view === 'register') ? (
        <div className="min-h-screen flex items-center justify-center p-4">
          <div className="w-full max-w-lg">
            {renderContent()}
          </div>
        </div>
      ) : (
        <div className="min-h-screen bg-[#F5F5DC]">
          {renderNav()}
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

      {showCreateSlot && (
        <div className="fixed inset-0 bg-gray-900 bg-opacity-75 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md">
            <h3 className="text-xl font-bold text-center mb-4">Create New Slot</h3>
            {message && (
              <div className="text-center text-sm font-medium text-red-500 mb-4">
                {message}
              </div>
            )}
            <form onSubmit={handleCreateSlot} className="space-y-4">
              <div>
                <label className="block text-sm font-medium">Slot Type <span className="text-red-500">*</span></label>
                <select value={newSlotForm.slotType} onChange={(e) => setNewSlotForm({ ...newSlotForm, slotType: e.target.value })} className="w-full p-3 rounded-lg bg-gray-100 border border-gray-300">
                  <option value="">Select Slot Type</option>
                  {slotTypes.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium">Slot Name <span className="text-red-500">*</span></label>
                <input type="text" placeholder="Slot Name" value={newSlotForm.slotName} onChange={(e) => setNewSlotForm({ ...newSlotForm, slotName: e.target.value })} className="w-full p-3 rounded-lg bg-gray-100 border border-gray-300" />
              </div>
              <div>
                <label className="block text-sm font-medium">Date <span className="text-red-500">*</span></label>
                <input type="date" value={newSlotForm.date} onChange={(e) => setNewSlotForm({ ...newSlotForm, date: e.target.value })} className="w-full p-3 rounded-lg bg-gray-100 border border-gray-300" />
              </div>
              <div>
                <label className="block text-sm font-medium">Venue</label>
                <input type="text" placeholder="Venue" value={newSlotForm.venue} onChange={(e) => setNewSlotForm({ ...newSlotForm, venue: e.target.value })} className="w-full p-3 rounded-lg bg-gray-100 border border-gray-300" />
              </div>
              <div>
                <label className="block text-sm font-medium">Timings</label>
                <input type="text" placeholder="Timings (e.g., 10:00 AM - 12:00 PM)" value={newSlotForm.timings} onChange={(e) => setNewSlotForm({ ...newSlotForm, timings: e.target.value })} className="w-full p-3 rounded-lg bg-gray-100 border border-gray-300" />
              </div>
              <div className="flex justify-end space-x-4 mt-4">
                <button type="button" onClick={() => setShowCreateSlot(false)} className="py-2 px-4 bg-gray-200 hover:bg-gray-300 text-gray-800 font-semibold rounded-full transition-colors">Cancel</button>
                <button type="submit" className="py-2 px-4 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-full shadow-lg transition-colors">Create</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {editingSlot && (
        <div className="fixed inset-0 bg-gray-900 bg-opacity-75 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md">
            <h3 className="text-xl font-bold text-center mb-4">Edit Slot: {editingSlot.slotName}</h3>
            <form onSubmit={handleEditSlot} className="space-y-4">
              <select value={editingSlot.slotType} onChange={(e) => setEditingSlot({ ...editingSlot, slotType: e.target.value })} className="w-full p-3 rounded-lg bg-gray-100 border border-gray-300">
                {slotTypes.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
              <input type="text" placeholder="Slot Name" value={editingSlot.slotName} onChange={(e) => setEditingSlot({ ...editingSlot, slotName: e.target.value })} className="w-full p-3 rounded-lg bg-gray-100 border border-gray-300" />
              <input type="date" value={editingSlot.date} onChange={(e) => setEditingSlot({ ...editingSlot, date: e.target.value })} className="w-full p-3 rounded-lg bg-gray-100 border border-gray-300" />
              <input type="text" placeholder="Venue" value={editingSlot.venue} onChange={(e) => setEditingSlot({ ...editingSlot, venue: e.target.value })} className="w-full p-3 rounded-lg bg-gray-100 border border-gray-300" />
              <input type="text" placeholder="Timings (e.g., 10:00 AM - 12:00 PM)" value={editingSlot.timings} onChange={(e) => setEditingSlot({ ...editingSlot, timings: e.target.value })} className="w-full p-3 rounded-lg bg-gray-100 border border-gray-300" />
              <div className="flex justify-end space-x-4 mt-4">
                <button type="button" onClick={() => setEditingSlot(null)} className="py-2 px-4 bg-gray-200 hover:bg-gray-300 text-gray-800 font-semibold rounded-full transition-colors">Cancel</button>
                <button type="submit" className="py-2 px-4 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-full shadow-lg transition-colors">Save Changes</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {editingUser && (
        <div className="fixed inset-0 bg-gray-900 bg-opacity-75 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md">
            <h3 className="text-xl font-bold text-center mb-4">Edit User: {editingUser.username}</h3>
            <form onSubmit={handleSaveEdit} className="space-y-4">
              <input type="text" placeholder="Username" value={editingUser.username || ''} onChange={(e) => setEditingUser({ ...editingUser, username: e.target.value })} className="w-full p-3 rounded-lg bg-gray-100 border border-gray-300" />
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
      
      {showMemberAttendanceDetails && selectedMember && (
        <div className="fixed inset-0 bg-gray-900 bg-opacity-75 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-3xl max-h-screen overflow-y-auto space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-xl font-bold">
                {selectedMember.username}'s Attendance Details
              </h3>
              <button onClick={() => setShowMemberAttendanceDetails(false)} className="text-gray-500 hover:text-gray-700">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
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
                      <td className="px-6 py-4 whitespace-nowrap">{slot.date}</td>
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

      {showEditProfileModal && userProfile && (
        <div className="fixed inset-0 bg-gray-900 bg-opacity-75 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md max-h-screen overflow-y-auto">
            <h3 className="text-xl font-bold text-center mb-4">Edit Your Profile</h3>
            <form onSubmit={handleEditProfile} className="space-y-4">
              <div className="flex justify-center mb-4">
                {userProfile.photo ? (
                  <img src={userProfile.photo} alt="Profile" className="w-24 h-24 rounded-full object-cover" />
                ) : (
                  <div className="w-24 h-24 rounded-full bg-gray-300 flex items-center justify-center text-4xl font-bold">{userProfile.username.charAt(0).toUpperCase()}</div>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium">Username</label>
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
                <input type="text" value={userProfile.program || ''} onChange={(e) => setUserProfile({ ...userProfile, program: e.target.value })} className="w-full p-3 rounded-lg bg-gray-100 border border-gray-300" />
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

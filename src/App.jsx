import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import './App.css';
import { db, auth } from './firebase'; 
import { collection, query, onSnapshot, addDoc, serverTimestamp, doc, deleteDoc, updateDoc, setDoc, getDoc, where, getDocs, limit } from 'firebase/firestore'; 
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged, sendPasswordResetEmail, updateProfile, GoogleAuthProvider, signInWithPopup } from "firebase/auth";
import { 
  IoMenu, IoSearchOutline, IoSettingsOutline, IoPersonOutline, IoMoonOutline, 
  IoCloseOutline, IoLogOutOutline, IoHappyOutline, IoPaperPlane, IoAttach, 
  IoCheckmarkDoneOutline, IoCheckmarkOutline, IoEllipsisVertical, 
  IoCallOutline, IoVideocamOutline, IoMicOutline, IoMicOffOutline, IoVideocamOffOutline, IoVolumeHighOutline,
  IoImageOutline, IoPeopleOutline, IoCameraOutline, IoTrashOutline, IoBanOutline, IoLockClosedOutline,
  IoQrCodeOutline, IoShareSocialOutline, IoShieldCheckmarkOutline, IoAddCircle, IoArrowUndoOutline, IoStopCircleOutline,
  IoArrowDownOutline, IoArrowUpOutline, IoLogoGoogle, IoPencil, IoText, IoEyeOutline, IoEyeOffOutline, IoBookmarkOutline,
  IoCopyOutline, IoDownloadOutline, IoMegaphoneOutline, IoArchiveOutline
} from "react-icons/io5";

const compressImage = (file) => {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target.result;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_DIM = 800; 
        let width = img.width; let height = img.height;
        if (width > height && width > MAX_DIM) { height *= MAX_DIM / width; width = MAX_DIM; } 
        else if (height > MAX_DIM) { width *= MAX_DIM / height; height = MAX_DIM; }
        canvas.width = width; canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.6)); 
      };
    };
  });
};

const blobToBase64 = (blob) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
};

const formatText = (text) => {
    if (!text) return text;
    let formattedText = text.replace(/(https?:\/\/[^\s]+)/g, '<a href="$1" target="_blank" rel="noopener noreferrer" style="color:#4dabf7; text-decoration:underline;">$1</a>');
    formattedText = formattedText.replace(/\*(.*?)\*/g, '<strong>$1</strong>');
    formattedText = formattedText.replace(/_(.*?)_/g, '<em>$1</em>');
    return <span dangerouslySetInnerHTML={{ __html: formattedText }} />;
};

const formatTime = (seconds) => { 
    if (!seconds || isNaN(seconds)) return "00:00";
    const mins = Math.floor(seconds / 60); 
    const secs = seconds % 60; 
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`; 
};

// 🌟 FUTURISTIC FEATURE: Text-to-Speech Engine
const speakText = (text) => {
    if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel(); 
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = 1.0;
        utterance.pitch = 1.1;
        window.speechSynthesis.speak(utterance);
    } else {
        alert("Text-to-speech not supported in this browser.");
    }
};

function App() {
  const [user, setUser] = useState(null);
  const [username, setUsername] = useState('');
  const [aboutMe, setAboutMe] = useState('Available'); 
  
  const [chatWith, setChatWith] = useState(() => {
      try {
          const saved = sessionStorage.getItem('tc_lastChat');
          if (saved) return JSON.parse(saved);
      } catch(e) {}
      return { name: "Select a chat", type: "contact", pfp: null, desc: "" };
  });

  useEffect(() => {
      if (chatWith && chatWith.name !== "Select a chat") {
          sessionStorage.setItem('tc_lastChat', JSON.stringify(chatWith));
      }
  }, [chatWith]);

  const [currentMessages, setCurrentMessages] = useState([]); 
  const [searchQuery, setSearchQuery] = useState('');
  const [contacts, setContacts] = useState([]);
  const [globalSearchResults, setGlobalSearchResults] = useState([]); 
  
  const [sidebarTab, setSidebarTab] = useState('chats'); 
  const [toastMsg, setToastMsg] = useState(null); 
  const [appLoaded, setAppLoaded] = useState(false); 

  const [showMenuDropdown, setShowMenuDropdown] = useState(false);
  const [activeStoryView, setActiveStoryView] = useState(null);
  const [stories, setStories] = useState([]);
  const [pfp, setPfp] = useState(null);
  const [tempPfp, setTempPfp] = useState(null);
  const [tempName, setTempName] = useState('');
  const [tempAbout, setTempAbout] = useState(''); 

  const [input, setInput] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLogin, setIsLogin] = useState(true);
  const [isLoading, setIsLoading] = useState(false); 
  
  const [showDrawer, setShowDrawer] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [activeSettingMenu, setActiveSettingMenu] = useState('main'); 
  const [showEmojis, setShowEmojis] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [showNewGroup, setShowNewGroup] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [chatUserStatus, setChatUserStatus] = useState(null); 
  const [viewImage, setViewImage] = useState(null);
  const [showChatInfo, setShowChatInfo] = useState(false);
  const [infoTab, setInfoTab] = useState('media');
  const [replyTo, setReplyTo] = useState(null);
  const [blockedContacts, setBlockedContacts] = useState([]);
  const [archivedChats, setArchivedChats] = useState([]); 
  const [privacySettings, setPrivacySettings] = useState({ lastSeen: true, readReceipts: true });
  const [chatWallpaper, setChatWallpaper] = useState(localStorage.getItem('tcWallpaper') || 'none');

  const [imagePreview, setImagePreview] = useState(null);
  const [showImageEditor, setShowImageEditor] = useState(false);
  const [editImageURL, setEditImageURL] = useState(null);
  const canvasRef = useRef(null);
  const [editorMode, setEditorMode] = useState('draw'); 
  const [drawColor, setDrawColor] = useState('#ff0000');
  const [stampText, setStampText] = useState('😀');
  const [isDrawing, setIsDrawing] = useState(false);
  const [isViewOnce, setIsViewOnce] = useState(false); 

  const [audioPreview, setAudioPreview] = useState(null);
  const [previewCaption, setPreviewCaption] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [recTimer, setRecTimer] = useState(0);

  const [activeReactionMsg, setActiveReactionMsg] = useState(null);
  const reactionEmojis = useMemo(() => ['❤️', '😂', '😮', '😢', '🙏', '👍', '🔥', '💯'], []);
  
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const recIntervalRef = useRef(null);
  const touchTimerRef = useRef(null); 
  const [unreadCounts, setUnreadCounts] = useState({});
  const [groups, setGroups] = useState([]);
  const emojis = useMemo(() => ['😀','😂','😍','🙏','👍','🔥','❤️','💪','🎉', '✨', '🥺', '😎', '💯', '🤔', '🙌', '💡', '🌟'], []);

  const messagesEndRef = useRef(null);
  let contactTouchTimer = null;
  
  // Clean user search input (removes all spaces and makes lowercase)
  const safeSearchQuery = searchQuery?.replace(/\s+/g, '')?.toLowerCase() || "";

  const scrollToBottom = useCallback(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), []);
  useEffect(() => { scrollToBottom(); }, [currentMessages, scrollToBottom]);

  const toggleTheme = () => { setIsDarkMode(!isDarkMode); localStorage.setItem('tcTheme', !isDarkMode ? 'dark' : 'light'); };
  const changeWallpaper = (bg) => { setChatWallpaper(bg); localStorage.setItem('tcWallpaper', bg); };

  const getChatId = useCallback((user1, user2, isGroup) => {
    if (isGroup) return user2;
    return [user1, user2].sort().join('_');
  }, []);

  const showToast = (msg) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3000);
  };

  const copyToClipboard = (text) => {
      if(!text) return;
      navigator.clipboard.writeText(text);
      showToast("Copied to clipboard! 📋");
  };

  const downloadImage = (base64Data, filename = 'download.jpg') => {
      const link = document.createElement('a');
      link.href = base64Data;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      showToast("Image downloading... 🖼️");
  };

  useEffect(() => {
    if ("Notification" in window && Notification.permission !== "granted" && Notification.permission !== "denied") {
        Notification.requestPermission();
    }
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setAppLoaded(true);
      if (currentUser) {
        setUser(currentUser);
        
        let uName = currentUser.displayName; 
        if (!uName) {
            if (currentUser.email) { uName = currentUser.email.split('@')[0]; } 
            else { uName = "User_" + Math.floor(Math.random() * 100000); }
            updateProfile(currentUser, { displayName: uName }).catch(()=>{});
        }
        
        setUsername(uName);

        const userRef = doc(db, 'users', uName);
        const snap = await getDoc(userRef);
        
        if (!snap.exists()) {
             await setDoc(userRef, { 
                username: uName, email: currentUser.email || null, phoneNumber: currentUser.phoneNumber || null, 
                isOnline: true, contacts: [], groups: [], blockedContacts: [], archivedChats: [], privacy: { lastSeen: true, readReceipts: true }, pfp: currentUser.photoURL || null, about: "Available"
            });
            if (currentUser.photoURL) setPfp(currentUser.photoURL);
        } else {
             await updateDoc(userRef, { isOnline: true, lastSeen: serverTimestamp() });
             const data = snap.data();
             if(data.about) setAboutMe(data.about);
             if(data.archivedChats) setArchivedChats(data.archivedChats);
             if(data.pfp) setPfp(data.pfp);
        }
      } else {
        setUser(null); setUsername(''); setPfp(null); setContacts([]); setAboutMe('Available'); setArchivedChats([]);
      }
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!username) return;
    const userRef = doc(db, 'users', username);
    const unsubUser = onSnapshot(userRef, (docSnap) => {
        if (docSnap.exists()) {
            const data = docSnap.data();
            if (data.pfp) setPfp(data.pfp);
            if (data.contacts) setContacts(data.contacts);
            if (data.groups) setGroups(data.groups);
            if (data.blockedContacts) { setBlockedContacts(data.blockedContacts); localStorage.setItem('tcBlockedContacts', JSON.stringify(data.blockedContacts)); }
            if (data.archivedChats) setArchivedChats(data.archivedChats);
            if (data.privacy) setPrivacySettings(data.privacy);
            if (data.about) setAboutMe(data.about);
        }
    });
    return () => unsubUser();
  }, [username]);

  useEffect(() => {
      if(user && username) {
          const userRef = doc(db, 'users', username);
          const handleOffline = () => { updateDoc(userRef, { isOnline: false, lastSeen: serverTimestamp() }).catch(() => {}); };
          window.addEventListener('beforeunload', handleOffline);
          return () => { handleOffline(); window.removeEventListener('beforeunload', handleOffline); };
      }
  }, [user, username]);

  useEffect(() => {
    const savedTheme = localStorage.getItem('tcTheme');
    if (savedTheme === 'dark') setIsDarkMode(true);
  }, []);

  useEffect(() => {
      if(!username) return;
      const q = query(collection(db, 'messages'), where('recipient', '==', username));
      
      const unsub = onSnapshot(q, (snap) => {
          const counts = {};
          snap.docs.forEach(msgDoc => {
              const data = msgDoc.data();
              if(data.status === 'sent' || data.status === 'delivered') {
                  if(data.sender !== chatWith.name && data.sender !== username) { 
                      counts[data.sender] = (counts[data.sender] || 0) + 1;
                  }
              }
              setContacts(prevContacts => {
                  if (data.sender !== username && !prevContacts.find(c => c.name === data.sender)) {
                      const newContact = { name: data.sender, pfp: null, desc: "Tap to chat", about: "Available" };
                      const updatedContacts = [newContact, ...prevContacts];
                      updateDoc(doc(db, 'users', username), { contacts: updatedContacts }).catch(()=>{});
                      return updatedContacts;
                  }
                  return prevContacts;
              });
          });
          setUnreadCounts(counts);
      });
      return () => unsub();
  }, [username, chatWith.name]);

  useEffect(() => {
    if(!user || !username) return;
    const q = query(collection(db, 'stories'));
    const unsubStories = onSnapshot(q, (snapshot) => {
        const now = Date.now();
        const loadedStories = [];
        snapshot.docs.forEach(docSnap => {
            const data = docSnap.data();
            const storyTime = data.createdAt?.toMillis() || now;
            if(now - storyTime < 24 * 60 * 60 * 1000) { loadedStories.push({ id: docSnap.id, ...data }); } 
            else { deleteDoc(docSnap.ref).catch(()=>{}); }
        });
        loadedStories.sort((a,b) => (b.createdAt?.toMillis()||0) - (a.createdAt?.toMillis()||0));
        setStories(loadedStories);
    });
    return () => unsubStories();
  }, [user, username]);

  // 🌟 ULTRA SMART SEARCH ENGINE 🌟
  useEffect(() => {
    const fetchSearch = async () => {
      if (safeSearchQuery.length < 1) { setGlobalSearchResults([]); return; }
      try {
          let results = [];
          const qName = query(collection(db, 'users'), limit(150));
          const nameSnap = await getDocs(qName);

          nameSnap.forEach(d => {
              const data = d.data();
              if(data.username) {
                  const dbNameClean = data.username.replace(/\s+/g, '').toLowerCase();
                  if(dbNameClean.includes(safeSearchQuery) && data.username !== username) {
                      results.push(data);
                  }
              }
          });
          setGlobalSearchResults(results);
      } catch(e) {}
    };
    const debounce = setTimeout(() => { fetchSearch(); }, 400);
    return () => clearTimeout(debounce);
  }, [safeSearchQuery, username]);

  useEffect(() => {
    if(user && chatWith.type === 'contact' && chatWith.name !== "Select a chat" && chatWith.name !== username) {
      const unsubscribeUser = onSnapshot(doc(db, 'users', chatWith.name), (docSnap) => {
        if(docSnap.exists()) setChatUserStatus(docSnap.data()); else setChatUserStatus(null);
      }, () => {});
      return () => unsubscribeUser();
    } else { setChatUserStatus(null); }
  }, [user, chatWith.name, chatWith.type, username]);

  useEffect(() => {
    if (!user || !username || chatWith.name === "Select a chat") { setCurrentMessages([]); return; }
    const chatId = getChatId(username, chatWith.name, chatWith.type === 'group');
    
    const q = query(collection(db, 'messages'), where("chatId", "==", chatId));

    const unsubscribeMsg = onSnapshot(q, (snapshot) => { 
      let allMsgs = snapshot.docs.map(msgDoc => ({ id: msgDoc.id, ...msgDoc.data() }));
      allMsgs.sort((a, b) => (a.createdAt?.toMillis() || 0) - (b.createdAt?.toMillis() || 0));
      
      setCurrentMessages(allMsgs);

      allMsgs.forEach(msg => {
        if (msg.recipient === username && msg.sender === chatWith.name && msg.sender !== username) {
           if (msg.status !== 'seen' && privacySettings.readReceipts) { updateDoc(doc(db, 'messages', msg.id), { status: 'seen' }).catch(()=>{}); }
        } else if (msg.recipient === username && msg.status === 'sent') { updateDoc(doc(db, 'messages', msg.id), { status: 'delivered' }).catch(()=>{}); }
      });
    }, (error) => console.error("Fetch Error: ", error));
    return () => unsubscribeMsg();
  }, [user, chatWith.name, chatWith.type, username, privacySettings.readReceipts, getChatId]);

  const toggleArchive = async (contactName) => {
    if(contactName === username) return;
    let newList;
    if(archivedChats.includes(contactName)) {
        newList = archivedChats.filter(c => c !== contactName);
        showToast(`${contactName} unarchived.`);
    } else {
        newList = [...archivedChats, contactName];
        showToast(`Chat archived. 🗃️`);
        if(sidebarTab === 'archived' && newList.length === 0) setSidebarTab('chats');
    }
    setArchivedChats(newList);
    try { await updateDoc(doc(db, 'users', username), { archivedChats: newList }); } catch(e) {}
  };

  const handleRemoveContact = async (contactName) => {
    if(contactName === username) return; 
    if(window.confirm(`Remove ${contactName} from your chats? This will also delete messages locally.`)) {
        const newContacts = contacts.filter(c => c.name !== contactName);
        setContacts(newContacts);
        try { await updateDoc(doc(db, 'users', username), { contacts: newContacts }); } catch(e){}
        try {
            const chatIdToDelete = getChatId(username, contactName, false);
            const q = query(collection(db, 'messages'), where("chatId", "==", chatIdToDelete));
            const snap = await getDocs(q);
            snap.forEach(document => { deleteDoc(doc(db, 'messages', document.id)).catch(()=>{}); });
        } catch(e) {}
        if(chatWith.name === contactName) { setChatWith({ name: "Select a chat", type: "contact", pfp: null, desc: "" }); setShowChatInfo(false); }
    }
  };

  const onContactTouchStart = (cName) => { contactTouchTimer = setTimeout(() => handleRemoveContact(cName), 800); };
  const onContactTouchEnd = () => { clearTimeout(contactTouchTimer); };

  const togglePrivacy = (key) => {
    const newSettings = { ...privacySettings, [key]: !privacySettings[key] };
    setPrivacySettings(newSettings);
    localStorage.setItem('tcPrivacy', JSON.stringify(newSettings));
    try { updateDoc(doc(db, 'users', username), { privacy: newSettings }); } catch(e) {}
  };

  const deleteMessage = async (msgId) => { if(window.confirm("Delete this message for everyone?")) { try { await deleteDoc(doc(db, 'messages', msgId)); } catch(e) {} } };
  const clearChat = () => { if(window.confirm(`Are you sure you want to delete all messages here?`)) { currentMessages.forEach(m => { deleteDoc(doc(db, 'messages', m.id)).catch(()=>{}); }); setShowChatInfo(false); } };

  const toggleBlock = (contactName) => {
    if(contactName === username) return;
    let newList;
    if(blockedContacts.includes(contactName)) { newList = blockedContacts.filter(c => c !== contactName); showToast(`${contactName} Unblocked.`); } 
    else { if(window.confirm(`Block ${contactName}? They won't be able to message you.`)) { newList = [...blockedContacts, contactName]; setShowChatInfo(false); } else return; }
    setBlockedContacts(newList); localStorage.setItem('tcBlockedContacts', JSON.stringify(newList));
    try { updateDoc(doc(db, 'users', username), { blockedContacts: newList }); } catch(e) {}
  };

  const isBlocked = useMemo(() => blockedContacts.includes(chatWith.name), [blockedContacts, chatWith.name]);

  const handleTouchStart = (msgId, sender) => { if(sender !== username) return; touchTimerRef.current = setTimeout(() => { deleteMessage(msgId); }, 800); };
  const handleTouchEnd = () => { clearTimeout(touchTimerRef.current); };

  const handleStoryUpload = async (e) => {
      const file = e.target.files[0];
      if(!file) return;
      try {
          const base64Image = await compressImage(file);
          if (base64Image.length > 1040000) return showToast("Image is too large!");
          await addDoc(collection(db, 'stories'), { sender: username, pfp: pfp, image: base64Image, createdAt: serverTimestamp() });
          showToast("Story uploaded successfully! ✨");
      } catch(e) { showToast("Failed to upload story"); }
      e.target.value = null; 
  };

  const handleReaction = async (msgId, currentReaction) => {
    const newReaction = currentReaction === '❤️' ? null : '❤️';
    try { await updateDoc(doc(db, 'messages', msgId), { reaction: newReaction }); } catch(err) {}
  };

  const handleReactionSelect = async (msgId, emoji) => {
      try { await updateDoc(doc(db, 'messages', msgId), { reaction: emoji }); } catch(err) {}
      setActiveReactionMsg(null);
  };

  const handleImageSelect = async (e) => {
    const file = e.target.files[0];
    if (file) { 
        const base64Raw = await compressImage(file);
        setEditImageURL(base64Raw);
        setShowImageEditor(true); 
    }
    e.target.value = null; 
  };

  const initCanvas = useCallback(() => {
      const canvas = canvasRef.current;
      if (!canvas || !editImageURL) return;
      const ctx = canvas.getContext('2d');
      const img = new Image();
      img.onload = () => {
          canvas.width = img.width;
          canvas.height = img.height;
          ctx.drawImage(img, 0, 0);
      };
      img.src = editImageURL;
  }, [editImageURL]);

  useEffect(() => { if (showImageEditor) { initCanvas(); } }, [showImageEditor, initCanvas]);

  const getCanvasCoordinates = (e) => {
      const canvas = canvasRef.current;
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      const clientX = e.clientX || (e.touches && e.touches[0].clientX);
      const clientY = e.clientY || (e.touches && e.touches[0].clientY);
      return { x: (clientX - rect.left) * scaleX, y: (clientY - rect.top) * scaleY };
  };

  const startCanvasAction = (e) => {
      const { x, y } = getCanvasCoordinates(e);
      const ctx = canvasRef.current.getContext('2d');
      if (editorMode === 'draw') { setIsDrawing(true); ctx.beginPath(); ctx.moveTo(x, y); } 
      else if (editorMode === 'text') { ctx.font = 'bold 50px Arial'; ctx.fillStyle = drawColor; ctx.fillText(stampText, x, y); }
  };

  const drawOnCanvas = (e) => {
      if (!isDrawing || editorMode !== 'draw') return;
      e.preventDefault();
      const { x, y } = getCanvasCoordinates(e);
      const ctx = canvasRef.current.getContext('2d');
      ctx.lineTo(x, y); ctx.strokeStyle = drawColor; ctx.lineWidth = 8; ctx.lineCap = 'round'; ctx.stroke();
  };

  const stopCanvasAction = () => { if (isDrawing) { setIsDrawing(false); canvasRef.current.getContext('2d').closePath(); } };

  const saveEditedImage = () => {
      const finalImageBase64 = canvasRef.current.toDataURL('image/jpeg', 0.8);
      setImagePreview(finalImageBase64); 
      setShowImageEditor(false);
      setPreviewCaption('');
  };

  const ensureMutualContact = async () => {
    if (chatWith.type !== 'contact' || chatWith.name === username) return; 
    
    let recipientAbout = "Available";
    try {
        const recipientDoc = await getDoc(doc(db, 'users', chatWith.name));
        if (recipientDoc.exists()) {
            const recData = recipientDoc.data();
            recipientAbout = recData.about || "Available";
            const recContacts = recData.contacts || [];
            if (!recContacts.find(c => c.name === username)) {
                const myInfo = { name: username, pfp: pfp, desc: "New message", about: aboutMe };
                updateDoc(doc(db, 'users', chatWith.name), { contacts: [myInfo, ...recContacts] }).catch(()=>{});
            }
        }
    } catch(e) {}

    if (!contacts.find(c => c.name === chatWith.name)) {
        const newMyContacts = [{ name: chatWith.name, pfp: chatWith.pfp, desc: "Tap to chat", about: recipientAbout }, ...contacts];
        updateDoc(doc(db, 'users', username), { contacts: newMyContacts }).catch(()=>{});
    }
  };

  const confirmSendImage = async () => {
    if (!imagePreview) return;
    const timeString = new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
    const captionToSave = previewCaption;
    const imageToSend = imagePreview; 
    
    if (imageToSend.length > 1040000) return alert("Edited Image is too large for database! Try clearing some drawings.");

    setImagePreview(null); setPreviewCaption('');

    try {
      const msgData = { text: captionToSave, sender: username, recipient: chatWith.name, chatId: getChatId(username, chatWith.name, chatWith.type === 'group'), status: "sent", time: timeString, replyTo: replyTo ? replyTo.text || 'Image' : null, replySender: replyTo ? replyTo.sender : null };
      await addDoc(collection(db, 'messages'), { ...msgData, image: imageToSend, isViewOnce: isViewOnce, participants: [username, chatWith.name], createdAt: serverTimestamp() }); 
      await ensureMutualContact(); 
      setIsViewOnce(false);
    } catch(err) { alert("Image upload failed! " + err.message); }
    setReplyTo(null);
  };

  const handleViewOnceClick = async (msgId, base64Image, sender) => {
      setViewImage(base64Image);
      if (sender !== username || chatWith.name === username) {
          try { await deleteDoc(doc(db, 'messages', msgId)); } catch(e) {}
      }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
          audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: false } 
      });
      let mimeType = 'audio/webm';
      if (MediaRecorder.isTypeSupported('audio/mp4')) { mimeType = 'audio/mp4'; }

      const recorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = recorder;
      audioChunksRef.current = [];
      
      recorder.ondataavailable = e => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
      
      recorder.onstop = async () => {
        setIsRecording(false);
        clearInterval(recIntervalRef.current);
        const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
        audioChunksRef.current = [];
        setAudioPreview({ blob: audioBlob, url: URL.createObjectURL(audioBlob) });
        stream.getTracks().forEach(track => track.stop()); 
      };
      
      recorder.start(); 
      setIsRecording(true);
      setRecTimer(0);
      recIntervalRef.current = setInterval(() => setRecTimer(p => p + 1), 1000);
    } catch(err) { alert("Mic permission denied or unsupported device!"); setIsRecording(false); }
  };

  useEffect(() => {
    if (isRecording && recTimer >= 60) {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
          try { mediaRecorderRef.current.stop(); } catch(e) {}
      }
    }
  }, [recTimer, isRecording]);

  const stopAndPreviewAudio = () => { 
      if (mediaRecorderRef.current && isRecording) { 
          try { mediaRecorderRef.current.stop(); } catch(e) {} 
      } 
  };

  const confirmSendAudio = async () => {
    if (!audioPreview) return;
    const { blob } = audioPreview;
    const timeString = new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
    setAudioPreview(null);

    try {
      const base64Audio = await blobToBase64(blob);
      if (base64Audio.length > 1040000) return alert("Recording is too long!");

      const msgData = { text: "🎙️ Voice Note", sender: username, recipient: chatWith.name, chatId: getChatId(username, chatWith.name, chatWith.type === 'group'), status: "sent", time: timeString };
      await addDoc(collection(db, 'messages'), { ...msgData, audio: base64Audio, participants: [username, chatWith.name], createdAt: serverTimestamp() });
      await ensureMutualContact(); 
    } catch(err) { alert("Audio upload failed! " + err.message); }
  };

  let typingTimeout = useRef(null);
  const handleInputChange = useCallback((e) => { 
    setInput(e.target.value); 
    if(!privacySettings.lastSeen || chatWith.name === username) return; 
    updateDoc(doc(db, 'users', username), { typingTo: chatWith.name }).catch(()=>{});
    clearTimeout(typingTimeout.current);
    typingTimeout.current = setTimeout(() => { updateDoc(doc(db, 'users', username), { typingTo: null }).catch(()=>{}); }, 2000);
  }, [username, chatWith.name, privacySettings.lastSeen]);
  
  const sendMessage = useCallback(async (e) => {
    if (e) e.preventDefault();
    if (input.trim() === "" || isBlocked) return;
    const timeString = new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
    
    const msgData = { text: input, sender: username, recipient: chatWith.name, chatId: getChatId(username, chatWith.name, chatWith.type === 'group'), status: "sent", time: timeString, reaction: null, replyTo: replyTo ? replyTo.text || 'Image' : null, replySender: replyTo ? replyTo.sender : null };
    setInput(''); setShowEmojis(false); setReplyTo(null);

    try { 
      await addDoc(collection(db, 'messages'), { ...msgData, participants: [username, chatWith.name], createdAt: serverTimestamp() }); 
      if(chatWith.name !== username) updateDoc(doc(db, 'users', username), { typingTo: null }).catch(()=>{});
      await ensureMutualContact(); 
    } catch(err) { alert("Failed to send message: " + err.message); }
  }, [input, isBlocked, username, chatWith, replyTo, getChatId, ensureMutualContact]);
  
  const createNewGroup = () => { 
    if(newGroupName.trim() !== '') { 
      const newGroups = [{ name: newGroupName, desc: "New Group", icon: null, admin: username, members: [username] }, ...groups];
      setGroups(newGroups); updateDoc(doc(db, 'users', username), { groups: newGroups }).catch(()=>{});
      setNewGroupName(''); setShowNewGroup(false); setChatWith({ name: newGroupName, type: 'group', pfp: null, desc: "New Group" }); 
    } 
  };
  const currentGroup = useMemo(() => chatWith.type === 'group' ? groups.find(g => g.name === chatWith.name) : null, [chatWith, groups]);

  const handleGroupAvatarUpload = async (e) => {
    const file = e.target.files[0];
    if (file && currentGroup) {
      if(currentGroup.admin !== username) return showToast("Only Admin can change picture!");
      try {
        const base64Image = await compressImage(file);
        setGroups(groups.map(g => g.name === chatWith.name ? { ...g, icon: base64Image } : g)); 
        setChatWith({ ...chatWith, pfp: base64Image });
      } catch(err) {}
    }
  };

  const handleGoogleSignIn = async () => {
    setIsLoading(true);
    try {
        const provider = new GoogleAuthProvider();
        await signInWithPopup(auth, provider);
    } catch (err) { alert("Google Sign-In Failed: " + err.message); } 
    finally { setIsLoading(false); }
  };

  const handleAuth = async (e) => { 
    e.preventDefault(); 
    setIsLoading(true);
    try { 
        if (isLogin) { await signInWithEmailAndPassword(auth, email, password); } 
        else { await createUserWithEmailAndPassword(auth, email, password); } 
    } catch (err) { alert("Error: " + err.message); } 
    finally { setIsLoading(false); }
  };
  
  const handleForgotPassword = async () => { if (!email) return showToast("Enter your email address first!"); try { await sendPasswordResetEmail(auth, email); showToast("Password reset link sent!"); } catch (err) { alert("Error: " + err.message); } };
  const handleLogout = async () => { try { await signOut(auth); setShowSettings(false); setShowDrawer(false); setChatWith({ name: "Select a chat", type: "contact", pfp: null, desc: "" }); } catch(err) { alert(err.message); } };

  const handleProfilePicUpload = async (e) => {
    if(e.target.files[0]){
        try { const compressed = await compressImage(e.target.files[0]); setTempPfp(compressed); } catch(err) {}
    }
    e.target.value = null; 
  };

  const saveProfile = async () => { 
    const finalName = tempName.trim(); 
    if(!finalName) return showToast("Name cannot be empty");
    
    if(finalName !== username) { 
        const checkDoc = await getDoc(doc(db, 'users', finalName)); 
        if(checkDoc.exists()) return showToast("Username taken! Try another."); 
    }
    if(user) { 
        try { 
            let finalPfpUrl = pfp; 
            if (tempPfp) { finalPfpUrl = tempPfp; }
            if (finalName !== username) {
                await setDoc(doc(db, 'users', finalName), { username: finalName, pfp: finalPfpUrl, about: tempAbout || 'Available', email: user.email || null, phoneNumber: user.phoneNumber || null, isOnline: true, contacts: contacts || [], groups: groups || [], privacy: privacySettings, archivedChats: archivedChats }, { merge: true }); 
                await deleteDoc(doc(db, 'users', username)); 
            } else { await updateDoc(doc(db, 'users', username), { pfp: finalPfpUrl, about: tempAbout || 'Available' }); }
            
            const authUpdateData = { displayName: finalName };
            if (finalPfpUrl && !finalPfpUrl.startsWith('data:image')) { authUpdateData.photoURL = finalPfpUrl; }
            await updateProfile(auth.currentUser, authUpdateData);
            
            setUsername(finalName); setPfp(finalPfpUrl); setAboutMe(tempAbout || 'Available'); setActiveSettingMenu('main'); showToast("Profile updated! 🚀"); 
        } catch(err) { showToast("Failed to update profile: " + err.message); } 
    } 
  };
  
  const openEditProfile = () => { setTempName(username); setTempPfp(pfp); setTempAbout(aboutMe); setActiveSettingMenu('editProfile'); };
  const copyProfileLink = () => { navigator.clipboard.writeText(`Hey! Join me on Telechat. Search my exact username: ${username}`); showToast("Profile link copied! 🔗"); };

  const mediaMessages = useMemo(() => currentMessages.filter(m => m.image), [currentMessages]);
  
  let displayStatus = "Offline"; 
  if (isBlocked) { displayStatus = "Blocked"; } 
  else if (chatWith.name === "Select a chat") { displayStatus = ""; } 
  else if (chatWith.name === username) { displayStatus = "Saved Messages"; }
  else if (chatWith.type === 'group') { displayStatus = `${currentGroup?.members?.length || 0} members`; } 
  else if (chatUserStatus) {
     if (chatUserStatus.typingTo === username) { displayStatus = "Typing..."; } 
     else if (chatUserStatus.isOnline) { displayStatus = "Online"; } 
     else if (chatUserStatus.privacy?.lastSeen === false) { displayStatus = "Online"; } 
     else if (chatUserStatus.lastSeen) { try { const date = chatUserStatus.lastSeen.toDate(); displayStatus = `last seen at ${date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}`; } catch(e) { displayStatus = "Offline"; } } 
     else { displayStatus = "Online"; }
  }

  const uniqueStories = useMemo(() => Array.from(new Map(stories.map(s => [s.sender, s])).values()), [stories]);

  const memoizedChatList = useMemo(() => {
     if (sidebarTab === 'calls') {
         return (
                 <div className="tc-coming-soon-wrapper">
                     <div className="tc-soon-icon"><IoCallOutline size={50} color="#fff" /></div>
                     <h2>Voice & Video Calls</h2>
                     <p>We are working on bringing you high-quality, secure calls.</p>
                     <div className="tc-soon-badge">Coming Soon in V2.0 🚀</div>
                 </div>
         )
     } else if (sidebarTab === 'archived') {
         return (
             <>
                 <div className="tc-archived-header" onClick={() => setSidebarTab('chats')}>
                     <IoArrowUndoOutline size={20}/> <span>Back to Chats</span>
                 </div>
                 {archivedChats.length === 0 ? (
                     <div style={{padding: '20px', textAlign: 'center', color: '#888', fontSize: '14px'}}>No archived chats.</div>
                 ) : (
                     <>
                        {groups.filter(g => archivedChats.includes(g.name)).map((g, i) => (
                          <div key={'arch_group_'+i} className={`tc-chat-tile ${chatWith.name === g.name ? 'active' : ''}`} onClick={() => { setChatWith({ name: g.name, type: 'group', pfp: g.icon, desc: `${g.members?.length || 0} members` }); setInfoTab('members'); }}>
                              <div className="tc-tile-avatar group">{g.icon ? <img src={g.icon} alt="G" /> : g.name[0]?.toUpperCase() || "?"}</div>
                              <div className="tc-tile-info">
                                  <div className="tc-tile-top"><span className="tc-tile-name">{g.name}</span></div>
                                  <div className="tc-tile-bottom">{g.members?.length || 0} members</div>
                              </div>
                          </div>
                        ))}
                        {contacts.filter(c => archivedChats.includes(c.name)).map((c, i) => (
                          <div key={'arch_contact_'+i} className={`tc-chat-tile ${chatWith.name === c.name ? 'active' : ''}`} 
                               onClick={() => { setChatWith({ name: c.name, type: 'contact', pfp: c.pfp, desc: c.about || "Tap to chat" }); setInfoTab('media'); }}
                               onContextMenu={(e) => { e.preventDefault(); toggleArchive(c.name); }}>
                              <div className="tc-tile-avatar contact">{c.pfp ? <img src={c.pfp} alt="C" style={{width:'100%', height:'100%', borderRadius:'50%', objectFit:'cover'}}/> : c.name[0]?.toUpperCase() || "?"}</div>
                              <div className="tc-tile-info">
                                  <div className="tc-tile-top">
                                      <span className="tc-tile-name">{c.name}</span>
                                      {unreadCounts[c.name] && <span className="unread-badge">{unreadCounts[c.name]}</span>}
                                  </div>
                                  <div className="tc-tile-bottom">{c.desc}</div>
                              </div>
                          </div>
                        ))}
                     </>
                 )}
             </>
         )
     } else {
         return (
             <>
               {!searchQuery && archivedChats.length > 0 && (
                   <div className="tc-archived-tile-main" onClick={() => setSidebarTab('archived')}>
                       <div className="arch-icon"><IoArchiveOutline size={20}/></div>
                       <div className="arch-text">Archived</div>
                       <div className="arch-count">{archivedChats.length}</div>
                   </div>
               )}

               {!searchQuery && (
                   <div className={`tc-chat-tile ${chatWith.name === username ? 'active' : ''}`} onClick={() => { setChatWith({ name: username, type: 'contact', pfp: pfp, desc: "Your personal cloud storage" }); }}>
                       <div className="tc-tile-avatar contact" style={{background: 'linear-gradient(135deg, #0088cc, #005580)', color: 'white', boxShadow: '0 4px 10px rgba(0,136,204,0.3)'}}><IoBookmarkOutline size={24}/></div>
                       <div className="tc-tile-info">
                           <div className="tc-tile-top"><span className="tc-tile-name" style={{fontWeight: 'bold', color: '#0088cc'}}>Saved Messages</span></div>
                           <div className="tc-tile-bottom">Save notes and media here</div>
                       </div>
                   </div>
               )}

               {searchQuery && globalSearchResults.length > 0 && (
                  <div className="tc-global-results-container" style={{marginBottom: '15px'}}>
                      <div style={{padding: '10px 15px', fontSize: '12px', fontWeight: 'bold', color: '#888', textTransform: 'uppercase', letterSpacing: '1px'}}>🌍 Global Search</div>
                      {globalSearchResults.map((u, i) => (
                          <div key={'glob_'+i} className="tc-chat-tile" onClick={() => { setChatWith({ name: u.username, type: 'contact', pfp: u.pfp, desc: u.about || "Available" }); setSearchQuery(''); }}>
                              <div className="tc-tile-avatar contact">{u.pfp ? <img src={u.pfp} alt="U" style={{width:'100%', height:'100%', borderRadius:'50%', objectFit:'cover'}}/> : u.username[0]?.toUpperCase() || "?"}</div>
                              <div className="tc-tile-info">
                                  <div className="tc-tile-top"><span className="tc-tile-name" style={{color: '#0088cc'}}>{u.username}</span></div>
                                  <div className="tc-tile-bottom">{u.about || "Available"}</div>
                              </div>
                          </div>
                      ))}
                      <hr style={{borderTop: '1px solid #eee', margin: '5px 0'}}/>
                  </div>
               )}

               {groups.filter(g => {
                   if (archivedChats.includes(g.name) || !g.members?.includes(username)) return false;
                   const cleanGroup = (g.name || "").replace(/\s+/g, '').toLowerCase();
                   return cleanGroup.includes(safeSearchQuery);
               }).map((g, i) => (
                  <div key={'group_'+i} className={`tc-chat-tile ${chatWith.name === g.name ? 'active' : ''}`} onClick={() => { setChatWith({ name: g.name, type: 'group', pfp: g.icon, desc: `${g.members?.length || 0} members` }); setInfoTab('members'); }}>
                      <div className="tc-tile-avatar group">{g.icon ? <img src={g.icon} alt="G" /> : g.name[0]?.toUpperCase() || "?"}</div>
                      <div className="tc-tile-info">
                          <div className="tc-tile-top"><span className="tc-tile-name">{g.name}</span></div>
                          <div className="tc-tile-bottom">{g.members?.length || 0} members</div>
                      </div>
                  </div>
               ))}

               {contacts.filter(c => {
                   if(c.name === username || archivedChats.includes(c.name)) return false;
                   const cleanContact = (c.name || "").replace(/\s+/g, '').toLowerCase();
                   return cleanContact.includes(safeSearchQuery);
               }).map((c, i) => (
                  <div key={'contact_'+i} className={`tc-chat-tile ${chatWith.name === c.name ? 'active' : ''}`} 
                       onClick={() => { setChatWith({ name: c.name, type: 'contact', pfp: c.pfp, desc: c.about || "Tap to chat" }); setInfoTab('media'); }}
                       onContextMenu={(e) => { e.preventDefault(); handleRemoveContact(c.name); }}
                       onTouchStart={() => onContactTouchStart(c.name)} onTouchEnd={onContactTouchEnd} onTouchMove={onContactTouchEnd}>
                      <div className="tc-tile-avatar contact">{c.pfp ? <img src={c.pfp} alt="C" style={{width:'100%', height:'100%', borderRadius:'50%', objectFit:'cover'}}/> : c.name[0]?.toUpperCase() || "?"}</div>
                      <div className="tc-tile-info">
                          <div className="tc-tile-top">
                              <span className="tc-tile-name">{c.name}</span>
                              {unreadCounts[c.name] && <span className="unread-badge">{unreadCounts[c.name]}</span>}
                          </div>
                          <div className="tc-tile-bottom">{c.desc}</div>
                      </div>
                  </div>
               ))}
               
               {searchQuery && globalSearchResults.length === 0 && !contacts.find(c => (c.name || "").replace(/\s+/g, '').toLowerCase().includes(safeSearchQuery)) && !groups.find(g => (g.name || "").replace(/\s+/g, '').toLowerCase().includes(safeSearchQuery)) && (
                  <div style={{padding: '20px', textAlign: 'center', color: '#888', fontSize: '14px'}}>No users found matching "{searchQuery}"</div>
               )}
             </>
         )
     }
  }, [sidebarTab, username, searchQuery, safeSearchQuery, globalSearchResults, groups, contacts, chatWith, unreadCounts, pfp, archivedChats]);

  const memoizedMessages = useMemo(() => {
      if (chatWith.name === "Select a chat") {
          return <div className="tc-empty-state">Welcome to Telechat! Select a chat to start messaging. ✨</div>;
      }
      if (currentMessages.length === 0) {
          return <div className="tc-empty-state">{chatWith.name === username ? "Save your notes, links, and media here. Everything is synced securely. ☁️" : "No messages yet. Start the conversation! 💬"}</div>;
      }
      
      return currentMessages.map((msg) => (
           <div key={msg.id} className={`tc-msg-row ${msg.sender === username && chatWith.name !== username ? 'sent' : 'received'}`}>
               
               <div className="tc-bubble tc-bubble-relative" onDoubleClick={() => handleReaction(msg.id, msg.reaction)} onContextMenu={(e) => { e.preventDefault(); if(msg.sender === username) deleteMessage(msg.id); }}>
                   
                   <div className="tc-msg-actions-hover">
                       {msg.image && !msg.isViewOnce && (
                           <div className="tc-action-trigger tooltip-wrapper" onClick={(e) => { e.stopPropagation(); downloadImage(msg.image, `Telechat_Image_${msg.time}.jpg`); }}><IoDownloadOutline size={16}/><span className="tooltip">Download</span></div>
                       )}
                       {msg.text && msg.text !== "🎙️ Voice Note" && (
                           <>
                             <div className="tc-action-trigger tooltip-wrapper" onClick={(e) => { e.stopPropagation(); copyToClipboard(msg.text); }}><IoCopyOutline size={16}/><span className="tooltip">Copy</span></div>
                             <div className="tc-action-trigger tooltip-wrapper" onClick={(e) => { e.stopPropagation(); speakText(msg.text); }}><IoMegaphoneOutline size={16}/><span className="tooltip">Read Aloud</span></div>
                           </>
                       )}
                       <div className="tc-action-trigger tooltip-wrapper" onClick={(e) => { e.stopPropagation(); setActiveReactionMsg(activeReactionMsg === msg.id ? null : msg.id); }}><IoHappyOutline size={16}/><span className="tooltip">React</span></div>
                       <div className="tc-action-trigger tooltip-wrapper" onClick={() => setReplyTo(msg)}><IoArrowUndoOutline size={18}/><span className="tooltip">Reply</span></div>
                   </div>

                   {activeReactionMsg === msg.id && (
                       <div className="tc-reaction-popover" onClick={(e) => e.stopPropagation()}>
                           {reactionEmojis.map(emoji => ( <span key={emoji} onClick={() => handleReactionSelect(msg.id, emoji)}>{emoji}</span> ))}
                       </div>
                   )}

                   {chatWith.type === 'group' && msg.sender !== username && <div className="tc-msg-sender">{msg.sender}</div>}
                   {msg.replyTo && (<div className="tc-msg-reply-block"><div className="reply-sender">{msg.replySender}</div><div className="reply-text">{msg.replyTo.length > 30 ? msg.replyTo.substring(0,30)+'...' : msg.replyTo}</div></div>)}
                   
                   <div style={{display: 'flex', flexDirection: 'column', gap: '5px'}}>
                       {msg.image && (
                           msg.isViewOnce ? (
                              <div className="tc-view-once-msg" onClick={() => handleViewOnceClick(msg.id, msg.image, msg.sender)}>
                                  <IoEyeOutline size={24} color="#0088cc" />
                                  <span>Photo (View Once)</span>
                              </div>
                           ) : (
                              <img src={msg.image} className="tc-msg-media" onClick={() => setViewImage(msg.image)} alt="media" style={{borderRadius: '8px', maxWidth: '100%', cursor: 'pointer'}} />
                           )
                       )}
                       {msg.audio && <audio src={msg.audio} controls className="tc-msg-audio" style={{ outline: 'none' }} />}
                       {msg.text && msg.text !== "🎙️ Voice Note" && ( <div className="tc-msg-content"><span className="tc-msg-text">{formatText(msg.text)}</span></div> )}
                   </div>

                   <div className="tc-msg-meta">
                       <span className="tc-msg-time">{msg.time || "12:00"}</span>
                       {msg.sender === username && chatWith.name !== username && (
                           <span className="tc-msg-ticks">
                               {msg.status === 'sent' && <IoCheckmarkOutline size={16} color="#aaa" />}
                               {msg.status === 'delivered' && <IoCheckmarkDoneOutline size={16} color="#aaa" />}
                               {msg.status === 'seen' && <IoCheckmarkDoneOutline size={16} color="#4dabf7" />}
                           </span>
                       )}
                   </div>
                   {msg.reaction && <div className="tc-reaction-badge">{msg.reaction}</div>}
               </div>
           </div>
      ));
  }, [currentMessages, chatWith, username, activeReactionMsg, reactionEmojis]);

  const [showScrollBtn, setShowScrollBtn] = useState(false);
  
  const handleScroll = (e) => {
      const bottom = e.target.scrollHeight - e.target.scrollTop === e.target.clientHeight;
      setShowScrollBtn(!bottom);
  };

  if (!appLoaded) {
      return (
          <div style={{width: '100vw', height: '100vh', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', background: '#0088cc', color: 'white'}}>
              <h1 style={{fontSize: '40px', fontWeight: 'bold', margin: '0 0 20px 0', letterSpacing: '2px', animation: 'pulse 1.5s infinite'}}>TELECHAT</h1>
              <div className="loader"></div>
              <style>{`@keyframes pulse { 0% { opacity: 1; } 50% { opacity: 0.5; } 100% { opacity: 1; } } .loader { border: 4px solid rgba(255,255,255,0.3); border-top: 4px solid white; border-radius: 50%; width: 40px; height: 40px; animation: spin 1s linear infinite; } @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
          </div>
      )
  }

  return (
    // 🌟 ADDED chat-active CLASS FOR MOBILE TRANSITION 🌟
    <div className={`tc-app ${isDarkMode ? 'dark-mode' : ''} ${chatWith.name !== "Select a chat" ? 'chat-active' : ''}`}>
      
      {toastMsg && (
          <div className="tc-toast-notification">
              {toastMsg}
          </div>
      )}

      {viewImage && (
          <div className="tc-image-viewer" onClick={() => setViewImage(null)}>
              <div style={{ position: 'absolute', top: '20px', right: '20px', display: 'flex', gap: '15px' }}>
                  <button onClick={(e) => { e.stopPropagation(); downloadImage(viewImage, 'Telechat_Image.jpg'); }} style={{ background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: '50%', padding: '10px', color: 'white', cursor: 'pointer', backdropFilter: 'blur(5px)' }}>
                      <IoDownloadOutline size={28} />
                  </button>
                  <button onClick={() => setViewImage(null)} style={{ background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: '50%', padding: '10px', color: 'white', cursor: 'pointer', backdropFilter: 'blur(5px)' }}>
                      <IoCloseOutline size={28} />
                  </button>
              </div>
              <img src={viewImage} alt="preview" onClick={(e) => e.stopPropagation()} style={{ maxHeight: '90vh', maxWidth: '90vw', objectFit: 'contain', borderRadius: '10px', boxShadow: '0 10px 30px rgba(0,0,0,0.5)' }} />
          </div>
      )}
      
      {activeStoryView && (
          <div className="tc-story-viewer" onClick={() => setActiveStoryView(null)}>
              <div className="tc-story-progress-bar"><div className="tc-progress-fill"></div></div>
              <div className="tc-story-header">
                  <img src={activeStoryView.pfp || "https://cdn.pixabay.com/photo/2015/10/05/22/37/blank-profile-picture-973460_1280.png"} alt="dp" />
                  <span>{activeStoryView.sender}</span>
                  <IoCloseOutline size={30} onClick={() => setActiveStoryView(null)} style={{marginLeft:'auto', cursor:'pointer'}}/>
              </div>
              <img src={activeStoryView.image} className="tc-story-main-img" alt="story" onClick={(e)=>e.stopPropagation()} />
          </div>
      )}

      {showImageEditor && (
        <div className="tc-preview-overlay">
          <div className="tc-editor-box">
             <div className="tc-editor-header">
                <h3>Edit Photo</h3>
                <IoCloseOutline size={28} style={{cursor:'pointer'}} onClick={() => {setShowImageEditor(false); setEditImageURL(null);}} />
             </div>
             <div className="tc-canvas-container">
                 <canvas ref={canvasRef} className="tc-drawing-canvas" onMouseDown={startCanvasAction} onMouseMove={drawOnCanvas} onMouseUp={stopCanvasAction} onMouseLeave={stopCanvasAction} onTouchStart={startCanvasAction} onTouchMove={drawOnCanvas} onTouchEnd={stopCanvasAction} />
             </div>
             <div className="tc-editor-tools">
                 <div className="tool-group">
                     <button className={`tool-btn ${editorMode === 'draw' ? 'active' : ''}`} onClick={()=>setEditorMode('draw')}><IoPencil size={20}/> Draw</button>
                     <button className={`tool-btn ${editorMode === 'text' ? 'active' : ''}`} onClick={()=>setEditorMode('text')}><IoText size={20}/> Emoji/Text</button>
                     <button className="tool-btn danger" onClick={initCanvas}><IoTrashOutline size={20}/> Reset</button>
                 </div>
                 {editorMode === 'draw' && (
                     <div className="tool-colors">
                         {['#ff0000', '#00ff00', '#0088cc', '#ffffff', '#000000', '#ffff00'].map(c => ( <div key={c} className={`color-dot ${drawColor === c ? 'active' : ''}`} style={{background: c}} onClick={()=>setDrawColor(c)} /> ))}
                     </div>
                 )}
                 {editorMode === 'text' && (
                     <div className="tool-text-input"><input type="text" value={stampText} onChange={(e)=>setStampText(e.target.value)} placeholder="Type emoji/text, click image to stamp" /></div>
                 )}
             </div>
             <button className="tc-btn-primary full-width" onClick={saveEditedImage} style={{marginTop:'15px'}}>Done Editing</button>
          </div>
        </div>
      )}

      {(imagePreview || audioPreview) && (
        <div className="tc-preview-overlay">
          <div className="tc-preview-box">
            <h3>Review Before Sending</h3>
            {imagePreview && (
               <>
                 <div className="tc-preview-img-container"><img src={imagePreview} alt="Preview" className="tc-preview-img" /></div>
                 <div className="tc-view-once-toggle" onClick={() => setIsViewOnce(!isViewOnce)}>
                     {isViewOnce ? <IoEyeOutline size={24} color="#0088cc"/> : <IoEyeOffOutline size={24} color="#888"/>}
                     <span style={{ color: isViewOnce ? '#0088cc' : '#888', fontWeight: 'bold' }}>Send as View Once</span>
                 </div>
                 <input type="text" placeholder="Add a caption..." value={previewCaption} onChange={(e) => setPreviewCaption(e.target.value)} className="tc-preview-caption-input" autoFocus />
               </>
            )}
            {audioPreview && (
               <div className="tc-preview-audio-container" style={{padding: '15px 0'}}>
                 <p style={{color: '#888', fontSize: '13px', marginBottom: '10px'}}>Listen to your recording:</p>
                 <audio src={audioPreview.url} controls style={{ display: 'block', width: '100%', height: '50px', background: '#f4f6f8', borderRadius: '25px', outline: 'none' }} />
               </div>
            )}
            <div className="tc-preview-actions" style={{marginTop: '15px'}}>
              <button className="tc-btn-secondary" onClick={() => { setImagePreview(null); setAudioPreview(null); setPreviewCaption(''); setIsViewOnce(false); }}>Cancel</button>
              <button className="tc-btn-primary" onClick={imagePreview ? confirmSendImage : confirmSendAudio}>Send <IoPaperPlane style={{marginLeft: '5px'}}/></button>
            </div>
          </div>
        </div>
      )}

      {showSettings && (
        <div className="tc-modal-overlay" onClick={() => {setShowSettings(false); setActiveSettingMenu('main');}}>
          <div className="tc-modal" onClick={(e) => e.stopPropagation()}>
            <div className="tc-modal-header">
                <h3>
                  {activeSettingMenu === 'main' ? 'Settings' : activeSettingMenu === 'blocked' ? 'Blocked Contacts' : activeSettingMenu === 'privacy' ? 'Privacy Settings' : activeSettingMenu === 'account' ? 'Account & Security' : activeSettingMenu === 'share' ? 'Share Profile' : activeSettingMenu === 'wallpaper' ? 'Chat Wallpaper' : 'Edit Profile'}
                </h3>
                <IoCloseOutline size={28} className="tc-icon-btn" onClick={() => setShowSettings(false)} />
            </div>
            
            {activeSettingMenu === 'main' ? (
              <div className="tc-settings-content">
                <div className="tc-profile-card" style={{ background: 'linear-gradient(135deg, #f0f7ff, #e0f0ff)', border: '1px solid #cce4ff', borderRadius: '15px', padding: '20px', marginBottom: '20px' }}>
                    <div className="tc-avatar-xl" style={{ boxShadow: '0 4px 15px rgba(0,136,204,0.3)' }}>{pfp ? <img src={pfp} alt="pfp" /> : username[0]?.toUpperCase() || "?"}</div>
                    <div className="tc-profile-details">
                        <h2 style={{ color: '#0088cc' }}>{username}</h2>
                        <span style={{ color: '#555', fontSize: '14px', marginTop: '5px', fontStyle: 'italic' }}>"{aboutMe}"</span>
                    </div>
                </div>
                <div className="tc-setting-list">
                    <div className="tc-setting-item" onClick={() => setActiveSettingMenu('account')}><IoShieldCheckmarkOutline size={22} className="tc-s-icon"/> <span>Account & Security</span></div>
                    <div className="tc-setting-item" onClick={openEditProfile}><IoPersonOutline size={22} className="tc-s-icon"/> <span>Edit Profile</span></div>
                    <div className="tc-setting-item" onClick={() => setActiveSettingMenu('wallpaper')}><IoImageOutline size={22} className="tc-s-icon"/> <span>Chat Wallpaper</span></div>
                    <div className="tc-setting-item" onClick={() => setActiveSettingMenu('privacy')}><IoLockClosedOutline size={22} className="tc-s-icon"/> <span>Privacy</span></div>
                    <div className="tc-setting-item" onClick={() => setActiveSettingMenu('blocked')}><IoBanOutline size={22} className="tc-s-icon"/> <span>Blocked Contacts</span></div>
                    <div className="tc-setting-item" onClick={toggleTheme}>
                        <IoMoonOutline size={22} className="tc-s-icon" /> <span>Dark Mode</span>
                        <div className={`tc-toggle ${isDarkMode ? 'active' : ''}`}><div className="tc-toggle-circle"></div></div>
                    </div>
                    <div className="tc-setting-item tc-danger" onClick={handleLogout}><IoLogOutOutline size={22} className="tc-s-icon"/> <span>Log Out</span></div>
                </div>
              </div>
            ) : activeSettingMenu === 'wallpaper' ? (
              <div className="tc-settings-content">
                 <div className="tc-wallpaper-grid">
                    <div className={`wall-option ${chatWallpaper === 'none' ? 'active' : ''}`} style={{background: '#f4f6f8'}} onClick={()=>changeWallpaper('none')}>Default</div>
                    <div className={`wall-option ${chatWallpaper === 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)' ? 'active' : ''}`} style={{background: 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)'}} onClick={()=>changeWallpaper('linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)')}>Cloudy</div>
                    <div className={`wall-option ${chatWallpaper === 'linear-gradient(to right, #4facfe 0%, #00f2fe 100%)' ? 'active' : ''}`} style={{background: 'linear-gradient(to right, #4facfe 0%, #00f2fe 100%)', color: 'white'}} onClick={()=>changeWallpaper('linear-gradient(to right, #4facfe 0%, #00f2fe 100%)')}>Ocean</div>
                    <div className={`wall-option ${chatWallpaper === 'linear-gradient(to top, #a18cd1 0%, #fbc2eb 100%)' ? 'active' : ''}`} style={{background: 'linear-gradient(to top, #a18cd1 0%, #fbc2eb 100%)', color: 'white'}} onClick={()=>changeWallpaper('linear-gradient(to top, #a18cd1 0%, #fbc2eb 100%)')}>Sunset</div>
                    <div className={`wall-option ${chatWallpaper === '#121212' ? 'active' : ''}`} style={{background: '#121212', color: 'white'}} onClick={()=>changeWallpaper('#121212')}>Dark Solid</div>
                 </div>
                 <button className="tc-btn-secondary full-width" style={{marginTop:'20px'}} onClick={() => setActiveSettingMenu('main')}>Back</button>
              </div>
            ) : activeSettingMenu === 'account' ? (
              <div className="tc-settings-content">
                 <div className="tc-setting-list">
                     <div className="tc-setting-item" style={{flexDirection: 'column', alignItems: 'flex-start', padding: '15px'}}><strong>Linked Email</strong><span style={{color: '#888'}}>{user?.email || "Not linked"}</span></div>
                     <div className="tc-setting-item tc-danger" onClick={() => {if(user?.email) { sendPasswordResetEmail(auth, user.email).then(()=>showToast('Reset link sent!')).catch(e=>showToast(e.message)) } else { showToast("Email not linked!") }}}>
                         <IoLockClosedOutline size={22} className="tc-s-icon"/> <span>Reset Password</span>
                     </div>
                 </div>
                 <button className="tc-btn-secondary full-width" style={{marginTop:'20px'}} onClick={() => setActiveSettingMenu('main')}>Back</button>
              </div>
            ) : activeSettingMenu === 'share' ? (
              <div className="tc-settings-content" style={{textAlign: 'center'}}>
                 <div style={{background: 'white', padding: '15px', borderRadius: '15px', display: 'inline-block', marginBottom: '20px', boxShadow: '0 5px 15px rgba(0,0,0,0.1)'}}><img src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=telechat:${username}`} alt="QR Code" /></div>
                 <h2 style={{margin: '0 0 20px 0'}}>{username}</h2>
                 <button className="tc-btn-primary full-width" onClick={copyProfileLink}><IoShareSocialOutline size={20} style={{marginRight: '10px'}}/> Copy Profile Link</button>
                 <button className="tc-btn-secondary full-width" style={{marginTop:'15px'}} onClick={() => setActiveSettingMenu('main')}>Back</button>
              </div>
            ) : activeSettingMenu === 'privacy' ? (
              <div className="tc-settings-content">
                 <div className="tc-setting-list">
                     <div className="tc-setting-item" onClick={() => togglePrivacy('lastSeen')}>
                         <div style={{display:'flex', flexDirection:'column'}}><span>Last Seen & Online</span></div>
                         <div className={`tc-toggle ${privacySettings.lastSeen ? 'active' : ''}`}><div className="tc-toggle-circle"></div></div>
                     </div>
                     <div className="tc-setting-item" onClick={() => togglePrivacy('readReceipts')}>
                         <div style={{display:'flex', flexDirection:'column'}}><span>Read Receipts</span></div>
                         <div className={`tc-toggle ${privacySettings.readReceipts ? 'active' : ''}`}><div className="tc-toggle-circle"></div></div>
                     </div>
                 </div>
                 <button className="tc-btn-secondary full-width" style={{marginTop:'20px'}} onClick={() => setActiveSettingMenu('main')}>Back</button>
              </div>
            ) : activeSettingMenu === 'blocked' ? (
              <div className="tc-settings-content tc-blocked-list">
                 {blockedContacts.length === 0 ? ( <p style={{textAlign:'center', color:'#888', margin:'20px 0'}}>No blocked contacts.</p> ) : ( blockedContacts.map(b => ( <div key={b} className="tc-blocked-row"><div className="tc-blocked-name">{b}</div><button className="tc-unblock-btn" onClick={() => toggleBlock(b)}>Unblock</button></div> )) )}
                 <button className="tc-btn-secondary full-width" style={{marginTop:'20px'}} onClick={() => setActiveSettingMenu('main')}>Back</button>
              </div>
            ) : activeSettingMenu === 'editProfile' ? (
              <div className="tc-settings-content tc-edit-profile">
                <div className="tc-avatar-edit-container">
                   <div className="tc-avatar-xxl">
                      {tempPfp ? <img src={tempPfp} alt="pfp" /> : tempName[0]?.toUpperCase() || "?"}
                      <label htmlFor="pfp-upload" className="tc-avatar-overlay"><IoCameraOutline size={32} color="white"/></label>
                      <input type="file" id="pfp-upload" onChange={handleProfilePicUpload} style={{display:'none'}} accept="image/*" />
                   </div>
                   {tempPfp && <span className="tc-remove-link" onClick={() => setTempPfp(null)}>Remove Photo</span>}
                </div>
                <div className="tc-form-group">
                   <label>Username</label>
                   <input type="text" value={tempName} onChange={(e) => setTempName(e.target.value)} className="tc-input-modern" />
                </div>
                <div className="tc-form-group" style={{marginTop: '15px'}}>
                   <label>About (Bio)</label>
                   <input type="text" value={tempAbout} onChange={(e) => setTempAbout(e.target.value)} className="tc-input-modern" placeholder="Available" maxLength={50} />
                </div>
                <div className="tc-btn-row">
                    <button className="tc-btn-secondary" onClick={() => setActiveSettingMenu('main')}>Cancel</button>
                    <button className="tc-btn-primary" onClick={saveProfile}>Save</button>
                </div>
              </div>
            ) : ( <div className="tc-settings-content"><button className="tc-btn-secondary full-width" onClick={() => setActiveSettingMenu('main')}>Back</button></div> )}
          </div>
        </div>
      )}

      <div className={`tc-drawer-overlay ${showDrawer ? 'show' : ''}`} onClick={() => setShowDrawer(false)}>
        <div className={`tc-drawer ${showDrawer ? 'open' : ''}`} onClick={(e) => e.stopPropagation()}>
            <div className="tc-drawer-header">
                <div className="tc-drawer-pfp">{pfp ? <img src={pfp} alt="pfp" /> : username[0]?.toUpperCase() || "?"}</div>
                <div className="tc-drawer-info">
                  <div className="tc-drawer-name">{username}</div>
                  <div style={{color: 'rgba(255,255,255,0.7)', fontSize: '12px', fontStyle: 'italic'}}>"{aboutMe}"</div>
                  <IoMoonOutline className="tc-drawer-theme" size={24} onClick={toggleTheme} style={{ top: '20px' }} />
                </div>
            </div>
            <div className="tc-drawer-body">
                <div className="tc-drawer-item" onClick={() => { setShowDrawer(false); setChatWith({ name: username, type: 'contact', pfp: pfp, desc: "Your personal cloud storage" }); }}>
                    <IoBookmarkOutline size={22} color="#0088cc" /> <span style={{fontWeight: 'bold', color: '#0088cc'}}>Saved Messages</span>
                </div>
                <hr style={{margin: '10px 0', border: 'none', borderTop: '1px solid #eee'}} />

                <div className="tc-drawer-item" onClick={() => { setShowDrawer(false); setShowSettings(true); setActiveSettingMenu('share'); }}><IoQrCodeOutline size={22}/> <span>Share Profile</span></div>
                <div className="tc-drawer-item" onClick={() => { setShowDrawer(false); setShowNewGroup(true); }}><IoPeopleOutline size={22}/> <span>New Group</span></div>
                <div className="tc-drawer-item" onClick={() => { setShowDrawer(false); setShowSettings(true); setActiveSettingMenu('main'); }}><IoSettingsOutline size={22}/> <span>Settings</span></div>
            </div>
        </div>
      </div>

      {showNewGroup && (
        <div className="tc-modal-overlay" onClick={() => setShowNewGroup(false)}>
          <div className="tc-modal" onClick={(e) => e.stopPropagation()}>
            <div className="tc-modal-header">
                <h3>Create Group</h3>
                <IoCloseOutline size={28} className="tc-icon-btn" onClick={() => setShowNewGroup(false)} />
            </div>
            <div className="tc-settings-content tc-edit-profile">
               <div className="tc-form-group">
                  <input type="text" value={newGroupName} onChange={(e) => setNewGroupName(e.target.value)} className="tc-input-modern" placeholder="Group Name" autoFocus />
               </div>
               <div className="tc-btn-row">
                   <button className="tc-btn-secondary" onClick={() => setShowNewGroup(false)}>Cancel</button>
                   <button className="tc-btn-primary" onClick={createNewGroup}>Create</button>
               </div>
            </div>
          </div>
        </div>
      )}

      {!user ? (
        <div className="tc-auth-container">
            <div className="tc-auth-box">
              <h2>Telechat</h2>
              <p>{isLogin ? "Sign in to continue" : "Create your account"}</p>
              
              <form onSubmit={handleAuth} className="tc-auth-form">
                 <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="tc-auth-input" placeholder="Email" required />
                 <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="tc-auth-input" placeholder="Password" required minLength="6" />
                 <button type="submit" className="tc-btn-primary" disabled={isLoading}>{isLoading ? "Processing..." : (isLogin ? "Log In" : "Sign Up")}</button>
              </form>

              <div className="tc-auth-divider"><span>OR</span></div>
              <button onClick={handleGoogleSignIn} className="tc-btn-secondary google-btn" disabled={isLoading}>
                 <IoLogoGoogle size={20} style={{marginRight: '10px'}} /> Continue with Google
              </button>
              
              <div className="tc-auth-links" style={{marginTop: '25px'}}>
                {isLogin && ( <span onClick={handleForgotPassword} style={{color: '#ff4d4f', fontWeight: 'bold', display: 'block', marginBottom: '10px'}}>Forgot Password?</span> )}
                <span onClick={() => setIsLogin(!isLogin)}>{isLogin ? "Don't have an account? Sign Up" : "Already have an account? Log In"}</span>
              </div>
            </div>
        </div>
      ) : (
      <>
        <div className="tc-sidebar">
          <div className="tc-stories-container">
             <div className="tc-story-item add-story-btn">
                <div className="tc-story-avatar-wrap" onClick={() => document.getElementById('storyUploadInput').click()}>
                   {pfp ? <img src={pfp} alt="my-dp" /> : username[0]?.toUpperCase() || "?"}
                   <IoAddCircle size={24} className="tc-story-add-icon" />
                </div>
                <span>My Status</span>
                <input type="file" id="storyUploadInput" style={{display:'none'}} onChange={handleStoryUpload} accept="image/*" />
             </div>
             {uniqueStories.map((s, i) => (
                <div key={s.id} className="tc-story-item" onClick={() => setActiveStoryView(s)}>
                   <div className="tc-story-avatar-wrap active-border"><img src={s.pfp || "https://cdn.pixabay.com/photo/2015/10/05/22/37/blank-profile-picture-973460_1280.png"} alt="dp" /></div>
                   <span>{s.sender}</span>
                </div>
             ))}
          </div>

          <div className="tc-sidebar-search">
             <IoMenu size={32} className="tc-hamburger" onClick={() => setShowDrawer(true)} />
             <div className="tc-search-wrapper">
                <IoSearchOutline className="tc-search-icon" size={20} />
                <input type="text" placeholder="Search by name..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
             </div>
          </div>
          
          <div className="tc-sidebar-tabs">
             <div className={sidebarTab === 'chats' ? 'active' : ''} onClick={() => setSidebarTab('chats')}>Chats</div>
             <div className={sidebarTab === 'calls' ? 'active' : ''} onClick={() => setSidebarTab('calls')}>Calls</div>
          </div>

          <div className="tc-chat-list">
             {memoizedChatList}
          </div>
        </div>

        <div className="tc-main" style={{ position: 'relative' }}>
            <div className="tc-chat-header">
                {/* 🌟 MOBILE BACK BUTTON 🌟 */}
                <div className="tc-mobile-back" onClick={() => { setChatWith({ name: "Select a chat", type: "contact", pfp: null, desc: "" }); setShowChatInfo(false); }}>
                    <IoArrowUndoOutline size={26} />
                </div>

                <div className="tc-header-profile" onClick={() => chatWith.name !== username && setShowChatInfo(true)} style={{ cursor: chatWith.name === username ? 'default' : 'pointer' }}>
                    <div className="tc-header-avatar">
                        {chatWith.name === username ? <IoBookmarkOutline size={26} color="#0088cc"/> : (chatWith.pfp ? <img src={chatWith.pfp} alt="pfp" /> : chatWith.name[0]?.toUpperCase() || "?")}
                    </div>
                    <div className="tc-header-text">
                        <h3>{chatWith.name === username ? "Saved Messages" : chatWith.name} {isBlocked && <span style={{fontSize:'12px', color:'red'}}>(Blocked)</span>}</h3>
                        
                        {displayStatus === 'Typing...' ? ( <span className="tc-typing-indicator">Typing<span>.</span><span>.</span><span>.</span></span> ) : ( <span className="tc-status">{displayStatus}</span> )}
                    </div>
                </div>
                <div className="tc-header-actions" style={{position: 'relative'}}>
                    <IoCallOutline size={22} className={`tc-h-icon ${chatWith.name === "Select a chat" || chatWith.name === username ? 'disabled':''}`} onClick={() => chatWith.name !== "Select a chat" && chatWith.name !== username && showToast("📞 Voice Calls are coming in the next update!")} />
                    <IoVideocamOutline size={24} className={`tc-h-icon ${chatWith.name === "Select a chat" || chatWith.name === username ? 'disabled':''}`} onClick={() => chatWith.name !== "Select a chat" && chatWith.name !== username && showToast("🎥 Video Calls are coming in the next update!")} />
                    
                    <IoEllipsisVertical size={24} className="tc-h-icon" onClick={() => chatWith.name !== "Select a chat" && setShowMenuDropdown(!showMenuDropdown)} />
                    {showMenuDropdown && (
                        <div className="tc-dropdown-menu">
                           {chatWith.name !== username && chatWith.name !== "Select a chat" && (
                               <div onClick={() => { toggleArchive(chatWith.name); setShowMenuDropdown(false); }}>
                                   {archivedChats.includes(chatWith.name) ? 'Unarchive Chat' : 'Archive Chat'}
                               </div>
                           )}
                           {chatWith.name !== username && <div onClick={() => { setShowChatInfo(true); setShowMenuDropdown(false); }}>Contact Info</div>}
                           <div onClick={() => { clearChat(); setShowMenuDropdown(false); }}>Clear Chat</div>
                           {chatWith.type === 'contact' && chatWith.name !== username && (<div className="tc-danger-text" onClick={() => { handleRemoveContact(chatWith.name); setShowMenuDropdown(false); }}>Remove Contact</div>)}
                        </div>
                    )}
                </div>
            </div>
            
            <div className="tc-messages-area" onScroll={handleScroll} onClick={()=> { setShowMenuDropdown(false); setActiveReactionMsg(null); }} style={{ background: chatWallpaper !== 'none' ? chatWallpaper : '' }}>
                {memoizedMessages}
                <div ref={messagesEndRef} />

                {showScrollBtn && (
                    <button className="tc-scroll-bottom-btn" onClick={scrollToBottom}>
                        <IoArrowDownOutline size={20} />
                    </button>
                )}
            </div>

            <div className="tc-input-section" onClick={()=>setShowMenuDropdown(false)}>
                {isBlocked ? (
                   <div className="tc-blocked-banner">You blocked this contact. Unblock to send a message.</div>
                ) : chatWith.name === "Select a chat" ? (
                   <div className="tc-blocked-banner" style={{background: 'transparent'}}></div>
                ) : (
                  <>
                    {replyTo && (
                       <div className="tc-active-reply-bar">
                          <div className="reply-bar-accent"></div>
                          <div className="reply-bar-content"><div className="rb-sender">Replying to {replyTo.sender}</div><div className="rb-text">{replyTo.text ? (replyTo.text.length > 40 ? replyTo.text.substring(0,40)+'...' : replyTo.text) : 'Media attachment'}</div></div>
                          <IoCloseOutline size={24} className="rb-close" onClick={() => setReplyTo(null)} />
                       </div>
                    )}
                    {showEmojis && (<div className="tc-emoji-bar">{emojis.map((e, idx) => (<span key={idx} onClick={() => setInput(prev => prev + e)} className="tc-emoji">{e}</span>))}</div>)}
                    <div className="tc-input-bar">
                        <label htmlFor="tc-upload" className="tc-input-action"><IoAttach size={26} /></label>
                        <input type="file" id="tc-upload" onChange={handleImageSelect} style={{display: 'none'}} />
                        
                        {isRecording ? (
                            <div className="tc-recording-ui">
                                <div className="audio-wave">
                                    <span style={{animationDelay: '0s'}}></span><span style={{animationDelay: '0.1s'}}></span><span style={{animationDelay: '0.2s'}}></span><span style={{animationDelay: '0.3s'}}></span><span style={{animationDelay: '0.4s'}}></span>
                                </div>
                                <span className="rec-timer">{formatTime(recTimer)}</span>
                                <button className="tc-stop-listen-btn" onClick={stopAndPreviewAudio}>Stop & Listen</button>
                            </div>
                        ) : (
                            <form onSubmit={sendMessage} className="tc-text-form">
                                <input type="text" value={input} onChange={handleInputChange} placeholder="Type a message (use *bold*, _italic_, or links)..." className="tc-main-input" />
                            </form>
                        )}

                        <div className="tc-input-action" onClick={() => setShowEmojis(!showEmojis)}><IoHappyOutline size={26} /></div>
                        <div className={`tc-send-btn ${input.trim() || isRecording ? 'active' : 'mic-mode'} ${isRecording ? 'recording-pulse' : ''}`} onClick={input.trim() ? sendMessage : (isRecording ? stopAndPreviewAudio : startRecording)}>
                            {input.trim() ? <IoPaperPlane size={22} style={{marginLeft: '-2px'}} /> : (isRecording ? <IoStopCircleOutline size={24} color="#ff4d4f" /> : <IoMicOutline size={24} />)}
                        </div>
                    </div>
                  </>
                )}
            </div>

            {showChatInfo && chatWith.name !== "Select a chat" && chatWith.name !== username && (
              <div className="tc-chat-info-sidebar">
                 <div className="tc-chat-info-header">
                    <IoCloseOutline size={28} onClick={() => setShowChatInfo(false)} style={{cursor: 'pointer'}} />
                    <h3>{chatWith.type === 'group' ? 'Group Info' : 'Contact Info'}</h3>
                 </div>
                 <div className="tc-chat-info-body">
                    <div className="tc-chat-info-avatar" style={{position: 'relative'}}>
                       {chatWith.pfp ? <img src={chatWith.pfp} alt="profile" /> : chatWith.name[0]?.toUpperCase() || "?"}
                       {chatWith.type === 'group' && currentGroup?.admin === username && (
                         <><label htmlFor="group-dp-upload" className="tc-group-dp-overlay"><IoCameraOutline size={28} color="white"/></label><input type="file" id="group-dp-upload" onChange={handleGroupAvatarUpload} style={{display: 'none'}} /></>
                       )}
                    </div>
                    <h2 style={{margin: '0 0 5px 0', fontSize: '22px'}}>{chatWith.name}</h2>
                    <p style={{margin: '0', color: '#888', fontStyle: 'italic'}}>"{chatWith.type === 'group' ? `${currentGroup?.members?.length || 0} members` : chatWith.desc}"</p>
                    
                    <div className="tc-chat-info-tabs" style={{ marginTop: '20px' }}>
                       <div className={infoTab === 'media' ? 'active' : ''} onClick={() => setInfoTab('media')}><IoImageOutline size={20}/> Media</div>
                       {chatWith.type === 'group' && (<div className={infoTab === 'members' ? 'active' : ''} onClick={() => setInfoTab('members')}><IoPeopleOutline size={20}/> Members</div>)}
                    </div>
                    <div className="tc-chat-info-content">
                       {infoTab === 'media' && (mediaMessages.length > 0 ? (<div className="tc-media-grid">{mediaMessages.map(m => (<img key={m.id} src={m.image} onClick={() => setViewImage(m.image)} alt="media" />))}</div>) : (<div className="tc-empty-info">No media shared yet.</div>))}
                       {chatWith.type === 'contact' && (
                         <div className="tc-chat-info-actions" style={{marginTop: '30px', display:'flex', flexDirection:'column', gap:'10px'}}>
                           <button className="tc-action-btn-danger" onClick={clearChat}><IoTrashOutline size={20} style={{marginRight: '8px'}}/> Delete Chat</button>
                           <button className="tc-action-btn-danger" onClick={() => toggleBlock(chatWith.name)}><IoBanOutline size={20} style={{marginRight: '8px'}}/> {isBlocked ? 'Unblock Contact' : 'Block Contact'}</button>
                         </div>
                       )}
                    </div>
                 </div>
              </div>
            )}
        </div>
      </>
      )}

      <style>{`
        /* ✨ HIGH-END CSS STYLES ✨ */
        .tc-sidebar-tabs { display: flex; width: 100%; border-bottom: 1px solid #eee; background: #fff; }
        .dark-mode .tc-sidebar-tabs { border-bottom: 1px solid #2a2a2a; background: #1e1e1e; }
        .tc-sidebar-tabs div { flex: 1; text-align: center; padding: 12px; font-weight: 600; color: #888; cursor: pointer; transition: 0.3s; }
        .tc-sidebar-tabs div.active { color: #0088cc; border-bottom: 3px solid #0088cc; }
        
        .tc-toast-notification { position: fixed; top: 20px; left: 50%; transform: translateX(-50%); background: rgba(0,0,0,0.85); color: white; padding: 12px 24px; border-radius: 30px; font-weight: bold; font-size: 14px; z-index: 999999; box-shadow: 0 4px 15px rgba(0,0,0,0.3); backdrop-filter: blur(10px); animation: dropDown 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275), fadeOut 0.5s ease 2.5s forwards; }
        @keyframes dropDown { from { top: -50px; opacity: 0; } to { top: 20px; opacity: 1; } }
        @keyframes fadeOut { to { opacity: 0; top: -50px; visibility: hidden; } }

        .tc-coming-soon-wrapper { padding: 40px 20px; text-align: center; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; color: #555; }
        .dark-mode .tc-coming-soon-wrapper { color: #ccc; }
        .tc-soon-icon { width: 100px; height: 100px; background: linear-gradient(135deg, #0088cc, #005580); border-radius: 50%; display: flex; justify-content: center; align-items: center; margin-bottom: 20px; box-shadow: 0 10px 20px rgba(0, 136, 204, 0.3); animation: floatIcon 3s ease-in-out infinite; }
        @keyframes floatIcon { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-10px); } }
        .tc-soon-badge { margin-top: 20px; background: rgba(0, 136, 204, 0.1); color: #0088cc; font-weight: bold; padding: 5px 15px; border-radius: 20px; font-size: 12px; text-transform: uppercase; letter-spacing: 1px; }
        
        /* 🌟 ARCHIVED TILE STYLES 🌟 */
        .tc-archived-tile-main { display: flex; align-items: center; padding: 12px 15px; cursor: pointer; transition: 0.2s; border-bottom: 1px solid #f1f1f1; background: #fafafa; }
        .dark-mode .tc-archived-tile-main { background: #1a1a1a; border-bottom-color: #2a2a2a; }
        .tc-archived-tile-main:hover { background: #f0f0f0; }
        .dark-mode .tc-archived-tile-main:hover { background: #222; }
        .arch-icon { color: #888; margin-right: 15px; }
        .arch-text { flex: 1; font-weight: bold; color: #555; }
        .dark-mode .arch-text { color: #aaa; }
        .arch-count { color: #0088cc; font-weight: bold; font-size: 13px; }
        .tc-archived-header { display: flex; align-items: center; gap: 10px; padding: 15px; background: #0088cc; color: white; font-weight: bold; cursor: pointer; box-shadow: 0 2px 5px rgba(0,0,0,0.1); }
        .tc-archived-header:hover { background: #0077b3; }

        .tc-auth-divider { display: flex; align-items: center; text-align: center; margin: 20px 0; color: #aaa; font-size: 14px; }
        .tc-auth-divider::before, .tc-auth-divider::after { content: ''; flex: 1; border-bottom: 1px solid #ddd; }
        .tc-auth-divider span { padding: 0 10px; font-weight: bold; }
        .dark-mode .tc-auth-divider::before, .dark-mode .tc-auth-divider::after { border-bottom: 1px solid #333; }
        .google-btn { display: flex; align-items: center; justify-content: center; background: white; border: 1px solid #ddd; color: #333; font-weight: bold; width: 100%; transition: 0.2s; cursor: pointer; }
        .google-btn:hover { background: #f9f9f9; box-shadow: 0 2px 5px rgba(0,0,0,0.1); }
        .dark-mode .google-btn { background: #1e1e1e; border-color: #333; color: white; }
        .dark-mode .google-btn:hover { background: #2a2a2a; }

        .tc-wallpaper-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 15px; }
        .wall-option { height: 80px; border-radius: 10px; border: 2px solid #ddd; cursor: pointer; display: flex; align-items: center; justify-content: center; font-weight: bold; color: #333; transition: 0.2s; overflow: hidden; }
        .wall-option.active { border: 3px solid #0088cc; transform: scale(1.05); }

        .tc-editor-box { background: white; padding: 20px; border-radius: 15px; width: 95vw; max-width: 600px; text-align: center; box-shadow: 0 10px 40px rgba(0,0,0,0.3); animation: popIn 0.3s ease; display: flex; flex-direction: column; max-height: 90vh;}
        .dark-mode .tc-editor-box { background: #1e1e1e; color: white; border: 1px solid #333; }
        .tc-editor-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px; border-bottom: 1px solid #eee; padding-bottom: 10px; }
        .dark-mode .tc-editor-header { border-bottom-color: #333; }
        .tc-canvas-container { flex: 1; width: 100%; display: flex; justify-content: center; align-items: center; background: #000; border-radius: 10px; overflow: hidden; margin-bottom: 15px; position: relative; min-height: 250px;}
        .tc-drawing-canvas { max-width: 100%; max-height: 50vh; object-fit: contain; cursor: crosshair; }
        
        .tc-editor-tools { display: flex; flex-direction: column; gap: 15px; width: 100%; }
        .tool-group { display: flex; justify-content: center; gap: 10px; }
        .tool-btn { padding: 8px 15px; border-radius: 20px; border: 1px solid #ddd; background: #f9f9f9; display: flex; align-items: center; gap: 5px; cursor: pointer; font-weight: bold; transition: 0.2s; }
        .tool-btn.active { background: #0088cc; color: white; border-color: #0088cc; }
        .tool-btn.danger { color: #ff4d4f; border-color: #ff4d4f; }
        .dark-mode .tool-btn { background: #2a2a2a; color: #ccc; border-color: #444; }
        .dark-mode .tool-btn.active { background: #4dabf7; color: white; }
        .tool-colors { display: flex; justify-content: center; gap: 10px; }
        .color-dot { width: 30px; height: 30px; border-radius: 50%; cursor: pointer; border: 2px solid transparent; transition: 0.2s; box-shadow: 0 2px 5px rgba(0,0,0,0.2); }
        .color-dot.active { border-color: #0088cc; transform: scale(1.1); }
        .tool-text-input input { width: 90%; padding: 12px; border-radius: 8px; border: 1px solid #ccc; font-size: 16px; text-align: center; }

        .tc-msg-audio { display: block !important; width: 220px !important; height: 45px !important; outline: none; margin: 5px 0; border-radius: 20px; background: transparent; }

        .tc-typing-indicator { color: #0088cc; font-weight: bold; font-style: italic; }
        .tc-typing-indicator span { animation: blink 1.4s infinite both; }
        .tc-typing-indicator span:nth-child(2) { animation-delay: 0.2s; }
        .tc-typing-indicator span:nth-child(3) { animation-delay: 0.4s; }
        @keyframes blink { 0% { opacity: 0.2; } 20% { opacity: 1; } 100% { opacity: 0.2; } }
        .tc-recording-ui { flex: 1; display: flex; align-items: center; gap: 10px; padding-left: 10px; justify-content: space-between; }
        .audio-wave { display: flex; gap: 4px; align-items: center; height: 30px; }
        .audio-wave span { width: 4px; background: #ff4d4f; border-radius: 2px; animation: wave 1.2s infinite ease-in-out; height: 10px; }
        @keyframes wave { 0%, 100% { height: 10px; } 50% { height: 25px; } }
        .rec-timer { font-weight: bold; color: #ff4d4f; font-family: monospace; font-size: 15px; }
        .tc-stop-listen-btn { background: #ff4d4f; color: white; border: none; padding: 6px 12px; border-radius: 15px; font-size: 12px; font-weight: bold; cursor: pointer; box-shadow: 0 2px 5px rgba(255,77,79,0.3); }

        .tc-msg-actions-hover { position: absolute; right: -120px; top: 50%; transform: translateY(-50%); display: flex; gap: 6px; opacity: 0; transition: 0.3s; z-index: 5; }
        .tc-msg-row.sent .tc-msg-actions-hover { right: auto; left: -120px; flex-direction: row-reverse; }
        .tc-msg-row:hover .tc-msg-actions-hover { opacity: 1; }
        .tc-action-trigger { color: #888; background: rgba(255,255,255,0.9); border-radius: 50%; padding: 8px; box-shadow: 0 4px 10px rgba(0,0,0,0.15); cursor: pointer; display: flex; align-items: center; justify-content: center; backdrop-filter: blur(5px); transition: 0.2s; position: relative; }
        .dark-mode .tc-action-trigger { background: rgba(42,42,42,0.9); color: #ccc; box-shadow: 0 4px 10px rgba(0,0,0,0.5); }
        .tc-action-trigger:hover { background: #0088cc; color: #fff; transform: scale(1.1); }
        .dark-mode .tc-action-trigger:hover { background: #4dabf7; }
        
        .tooltip-wrapper .tooltip { visibility: hidden; width: max-content; background-color: rgba(0,0,0,0.8); color: #fff; text-align: center; border-radius: 6px; padding: 4px 8px; position: absolute; z-index: 1; bottom: 125%; left: 50%; transform: translateX(-50%); opacity: 0; transition: opacity 0.3s; font-size: 11px; }
        .tooltip-wrapper:hover .tooltip { visibility: visible; opacity: 1; }

        .tc-reaction-popover { position: absolute; top: -50px; right: 0; background: rgba(255,255,255,0.95); border-radius: 30px; padding: 6px 12px; display: flex; gap: 10px; box-shadow: 0 10px 25px rgba(0,0,0,0.2); animation: popIn 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275); z-index: 10; backdrop-filter: blur(10px); }
        .tc-msg-row.sent .tc-reaction-popover { right: auto; left: 0; }
        .dark-mode .tc-reaction-popover { background: rgba(42,42,42,0.95); border: 1px solid #444; }
        .tc-reaction-popover span { font-size: 22px; cursor: pointer; transition: 0.2s; display: inline-block; }
        .tc-reaction-popover span:hover { transform: scale(1.4) translateY(-5px); }

        .tc-scroll-bottom-btn { position: absolute; right: 20px; bottom: 80px; background: white; border: 1px solid #ddd; width: 45px; height: 45px; border-radius: 50%; display: flex; justify-content: center; align-items: center; cursor: pointer; box-shadow: 0 5px 15px rgba(0,0,0,0.2); color: #555; z-index: 100; animation: popIn 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275); transition: 0.2s; }
        .tc-scroll-bottom-btn:hover { background: #0088cc; color: white; border-color: #0088cc; transform: translateY(-3px); }
        .dark-mode .tc-scroll-bottom-btn { background: #2a2a2a; border-color: #444; color: #ccc; }
        .dark-mode .tc-scroll-bottom-btn:hover { background: #4dabf7; color: white; }

        .tc-chat-info-sidebar { position: absolute; right: 0; top: 0; bottom: 0; width: 340px; background: #ffffff; z-index: 100; border-left: 1px solid #ddd; display: flex; flex-direction: column; animation: slideInRight 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275); }
        .dark-mode .tc-chat-info-sidebar { background: #121212; border-left: 1px solid #2a2a2a; }
        @keyframes slideInRight { from { transform: translateX(100%); } to { transform: translateX(0); } }
        .tc-chat-info-header { display: flex; align-items: center; padding: 20px; gap: 15px; border-bottom: 1px solid #eee; }
        .dark-mode .tc-chat-info-header { border-bottom: 1px solid #2a2a2a; color: white; }
        .tc-chat-info-body { padding: 20px; display: flex; flex-direction: column; align-items: center; flex: 1; }
        .tc-chat-info-avatar { width: 130px; height: 130px; border-radius: 50%; background: linear-gradient(135deg, #0088cc, #005580); color: white; display: flex; align-items: center; justify-content: center; font-size: 50px; margin-bottom: 15px; box-shadow: 0 10px 20px rgba(0,0,0,0.15); overflow: hidden; }
        .tc-chat-info-avatar img { width: 100%; height: 100%; object-fit: cover; }
        .tc-action-btn-danger { width: 100%; padding: 15px; background: transparent; color: #ff4d4f; border: 1px solid #ff4d4f; border-radius: 10px; font-weight: bold; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: 0.2s; }
        .tc-action-btn-danger:hover { background: #fff1f0; }
        .dark-mode .tc-action-btn-danger:hover { background: rgba(255,77,79,0.1); }
        .tc-blocked-banner { width: 100%; padding: 15px; text-align: center; background: #f4f6f8; color: #888; border-radius: 10px; font-weight: 500; }
        .dark-mode .tc-blocked-banner { background: #1e1e1e; color: #aaa; }
        .tc-blocked-row { display: flex; justify-content: space-between; align-items: center; padding: 15px; border-bottom: 1px solid #eee; }
        .dark-mode .tc-blocked-row { border-bottom-color: #333; }
        .tc-blocked-name { display: flex; align-items: center; gap: 15px; font-weight: bold; }
        .tc-blocked-avatar { width: 40px; height: 40px; background: #bbb; color: white; border-radius: 50%; display: flex; justify-content: center; align-items: center; }
        .tc-unblock-btn { background: #0088cc; color: white; border: none; padding: 8px 15px; border-radius: 20px; cursor: pointer; }
        
        .tc-preview-overlay { position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background: rgba(0,0,0,0.85); display: flex; justify-content: center; align-items: center; z-index: 99999; backdrop-filter: blur(8px); }
        .tc-preview-box { background: white; padding: 25px; border-radius: 20px; width: 90vw; max-width: 450px; text-align: center; box-shadow: 0 15px 50px rgba(0,0,0,0.4); animation: popIn 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275); }
        .dark-mode .tc-preview-box { background: #1e1e1e; color: white; border: 1px solid #333; }
        .tc-preview-img-container { width: 100%; height: 45vh; display: flex; justify-content: center; align-items: center; background: #000; border-radius: 12px; overflow: hidden; margin: 15px 0; }
        .tc-preview-img { max-width: 100%; max-height: 100%; object-fit: contain; }
        .tc-preview-caption-input { width: 100%; padding: 15px; border-radius: 12px; border: 1px solid #ddd; font-size: 15px; margin-bottom: 15px; outline: none; background: #f9f9f9; box-sizing: border-box; transition: 0.3s; }
        .tc-preview-caption-input:focus { border-color: #0088cc; box-shadow: 0 0 0 3px rgba(0,136,204,0.1); }
        .dark-mode .tc-preview-caption-input { background: #2a2a2a; border-color: #444; color: white; }
        .tc-preview-actions { display: flex; gap: 15px; justify-content: space-between; margin-top: 10px; }
        .tc-preview-actions button { flex: 1; padding: 12px; font-size: 16px; border-radius: 12px; cursor: pointer; font-weight: bold; border: none; transition: 0.2s; }
        .tc-btn-secondary { background: #e1e1e1; color: #333; }
        .tc-btn-secondary:hover { background: #d1d1d1; }
        .tc-btn-primary { background: #0088cc; color: white; }
        .tc-btn-primary:hover { background: #0077b3; transform: translateY(-2px); }
        .tc-h-icon.disabled { opacity: 0.3; cursor: not-allowed; }
        .tc-msg-ticks { display: flex; align-items: center; margin-left: 5px; margin-top: 2px; }
        .tc-group-dp-overlay { position: absolute; bottom: 0; left: 0; width: 100%; height: 40%; background: rgba(0,0,0,0.5); display: flex; justify-content: center; align-items: center; cursor: pointer; opacity: 0; transition: 0.3s; backdrop-filter: blur(2px); }
        .tc-chat-info-avatar:hover .tc-group-dp-overlay { opacity: 1; }
        .tc-chat-info-tabs { display: flex; width: 100%; border-bottom: 1px solid #eee; margin-top: 25px; margin-bottom: 20px; }
        .dark-mode .tc-chat-info-tabs { border-bottom: 1px solid #2a2a2a; }
        .tc-chat-info-tabs div { flex: 1; display: flex; align-items: center; justify-content: center; padding: 10px; cursor: pointer; font-weight: 500; color: #777; transition: 0.2s; font-size: 14px; }
        .tc-chat-info-tabs div.active { color: #0088cc; border-bottom: 3px solid #0088cc; }
        .tc-media-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; width: 100%; }
        .tc-media-grid img { width: 100%; aspect-ratio: 1; object-fit: cover; border-radius: 8px; cursor: pointer; transition: transform 0.2s; box-shadow: 0 2px 5px rgba(0,0,0,0.1); }
        .tc-media-grid img:hover { transform: scale(1.05); z-index: 2; position: relative; }
        .tc-empty-info { text-align: center; color: #aaa; margin-top: 30px; font-size: 15px; }
        .tc-bubble-relative { position: relative; }
        .tc-reaction-badge { position: absolute; bottom: -12px; right: 10px; background: #ffffff; border: 1px solid #e1e1e1; border-radius: 20px; padding: 3px 8px; font-size: 14px; box-shadow: 0 4px 10px rgba(0,0,0,0.15); animation: popIn 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275); user-select: none; z-index: 2; }
        .dark-mode .tc-reaction-badge { background: #1e1e1e; border-color: #333; }
        .tc-active-reply-bar { display: flex; align-items: center; background: rgba(244,246,248,0.9); border-top: 1px solid #eee; padding: 10px 15px; position: relative; backdrop-filter: blur(5px); }
        .dark-mode .tc-active-reply-bar { background: rgba(30,30,30,0.9); border-color: #2a2a2a; }
        .reply-bar-accent { width: 4px; height: 35px; background: #0088cc; border-radius: 2px; margin-right: 12px; }
        .reply-bar-content { flex: 1; display: flex; flex-direction: column; }
        .rb-sender { color: #0088cc; font-weight: bold; font-size: 13px; }
        .rb-text { color: #666; font-size: 13px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 90%; }
        .dark-mode .rb-text { color: #aaa; }
        .rb-close { color: #888; cursor: pointer; transition: 0.2s; }
        .rb-close:hover { color: #ff4d4f; transform: scale(1.2); }
        .tc-msg-reply-block { background: rgba(0,0,0,0.05); border-left: 3px solid #0088cc; padding: 6px 12px; border-radius: 6px; margin-bottom: 8px; cursor: pointer; transition: 0.2s; }
        .tc-msg-reply-block:hover { background: rgba(0,0,0,0.08); }
        .dark-mode .tc-msg-reply-block { background: rgba(255,255,255,0.1); border-left-color: #4dabf7; }
        .tc-msg-reply-block .reply-sender { font-size: 12px; font-weight: bold; color: #0088cc; }
        .dark-mode .tc-msg-reply-block .reply-sender { color: #4dabf7; }
        .tc-msg-reply-block .reply-text { font-size: 13px; opacity: 0.85; }
        .tc-send-btn.mic-mode { background: transparent; color: #888; box-shadow: none; cursor: pointer; }
        .tc-send-btn.mic-mode:hover { color: #0088cc; background: rgba(0, 136, 204, 0.1); }
        .dark-mode .tc-send-btn.mic-mode:hover { color: #4dabf7; background: rgba(77, 171, 247, 0.1); }
        .recording-pulse { animation: pulseRed 1.5s infinite; color: #ff4d4f !important; }
        @keyframes pulseRed { 0% { transform: scale(1); } 50% { transform: scale(1.15); } 100% { transform: scale(1); } }
        @keyframes popIn { 0% { transform: scale(0.8); opacity: 0; } 100% { transform: scale(1); opacity: 1; } }
        
        .tc-dropdown-menu { position: absolute; top: 40px; right: 20px; background: rgba(255,255,255,0.95); box-shadow: 0 10px 30px rgba(0,0,0,0.2); border-radius: 12px; z-index: 1000; width: 180px; overflow: hidden; animation: popIn 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275); backdrop-filter: blur(10px); }
        .dark-mode .tc-dropdown-menu { background: rgba(30,30,30,0.95); border: 1px solid #444; }
        .tc-dropdown-menu div { padding: 12px 15px; cursor: pointer; font-size: 14px; font-weight: 500; border-bottom: 1px solid #f1f1f1; transition: 0.2s; }
        .dark-mode .tc-dropdown-menu div { border-bottom-color: #2a2a2a; color: #ccc; }
        .tc-dropdown-menu div:hover { background: rgba(0,136,204,0.1); color: #0088cc; }
        .dark-mode .tc-dropdown-menu div:hover { background: rgba(77,171,247,0.15); color: #4dabf7; }
        .tc-danger-text { color: #ff4d4f !important; }
        
        .tc-stories-container { display: flex; gap: 15px; padding: 15px; overflow-x: auto; border-bottom: 1px solid #eee; background: #fff; scrollbar-width: none; }
        .dark-mode .tc-stories-container { background: #121212; border-bottom-color: #2a2a2a; }
        .tc-stories-container::-webkit-scrollbar { display: none; }
        .tc-story-item { display: flex; flex-direction: column; align-items: center; cursor: pointer; min-width: 65px; transition: 0.2s; }
        .tc-story-item:hover { transform: translateY(-2px); }
        .tc-story-avatar-wrap { width: 55px; height: 55px; border-radius: 50%; padding: 3px; position: relative; background: #eee; display: flex; justify-content: center; align-items: center; font-size: 24px; color: #888; }
        .tc-story-avatar-wrap.active-border { background: linear-gradient(45deg, #f09433 0%, #e6683c 25%, #dc2743 50%, #cc2366 75%, #bc1888 100%); }
        .tc-story-avatar-wrap img { width: 100%; height: 100%; border-radius: 50%; object-fit: cover; border: 2px solid white; }
        .dark-mode .tc-story-avatar-wrap img { border-color: #121212; }
        .tc-story-add-icon { position: absolute; bottom: -2px; right: -2px; color: #0088cc; background: white; border-radius: 50%; box-shadow: 0 2px 5px rgba(0,0,0,0.2); }
        .tc-story-item span { font-size: 11px; margin-top: 5px; color: #555; max-width: 60px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-weight: 500; }
        .dark-mode .tc-story-item span { color: #aaa; }
        
        .tc-story-viewer { position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background: #000; z-index: 999999; display: flex; flex-direction: column; }
        .tc-story-progress-bar { width: 100%; height: 4px; background: rgba(255,255,255,0.2); position: absolute; top: 0; left: 0; }
        .tc-progress-fill { height: 100%; background: #fff; animation: storyProgress 5s linear forwards; box-shadow: 0 0 10px rgba(255,255,255,0.8); }
        @keyframes storyProgress { from { width: 0%; } to { width: 100%; } }
        .tc-story-header { display: flex; align-items: center; padding: 20px; color: white; gap: 15px; position: absolute; top: 10px; width: 100%; box-sizing: border-box; background: linear-gradient(to bottom, rgba(0,0,0,0.8), transparent); }
        .tc-story-header img { width: 40px; height: 40px; border-radius: 50%; object-fit: cover; border: 2px solid white; }
        .tc-story-header span { font-weight: bold; text-shadow: 1px 1px 2px rgba(0,0,0,0.5); font-size: 16px; }
        .tc-story-main-img { width: 100%; height: 100%; object-fit: contain; }

        .tc-global-search-card { display: flex; align-items: center; background: linear-gradient(135deg, #f0f7ff 0%, #e0f0ff 100%); border: 1px solid #cce4ff; padding: 15px; margin: 15px 10px; border-radius: 15px; cursor: pointer; transition: all 0.3s ease; box-shadow: 0 4px 15px rgba(0, 136, 204, 0.1); }
        .tc-global-search-card:hover { transform: translateY(-2px); box-shadow: 0 6px 20px rgba(0, 136, 204, 0.2); background: linear-gradient(135deg, #e0f0ff 0%, #d0e8ff 100%); }
        .dark-mode .tc-global-search-card { background: linear-gradient(135deg, #1a2a3a 0%, #121e2b 100%); border-color: #2a3a4a; box-shadow: 0 4px 15px rgba(0, 0, 0, 0.3); }
        .dark-mode .tc-global-search-card:hover { background: linear-gradient(135deg, #1f3347 0%, #162635 100%); }
        
        .unread-badge { background: #25D366; color: white; font-size: 11px; font-weight: bold; padding: 2px 6px; border-radius: 10px; margin-left: 10px; box-shadow: 0 2px 5px rgba(37,211,102,0.4); }
        .tc-view-once-toggle { display: flex; align-items: center; justify-content: center; gap: 10px; margin: 15px 0; cursor: pointer; background: #f4f6f8; padding: 10px; border-radius: 10px; border: 1px solid #ddd; transition: 0.2s; }
        .dark-mode .tc-view-once-toggle { background: #2a2a2a; border-color: #444; }
        .tc-view-once-msg { display: flex; align-items: center; gap: 8px; background: rgba(0, 136, 204, 0.1); padding: 12px 20px; border-radius: 10px; cursor: pointer; font-weight: bold; color: #0088cc; font-style: italic; }
        .dark-mode .tc-view-once-msg { background: rgba(77, 171, 247, 0.15); color: #4dabf7; }

        /* 🌟 MOBILE RESPONSIVE WP STYLE STYLES 🌟 */
        .tc-mobile-back { display: none; }
        
        @media (max-width: 768px) {
            .tc-sidebar { width: 100vw !important; flex: none !important; display: flex; }
            .tc-main { display: none; width: 100vw !important; }
            
            /* Jab chat open ho */
            .tc-app.chat-active .tc-sidebar { display: none !important; }
            .tc-app.chat-active .tc-main { 
                display: flex !important; 
                flex-direction: column; 
                position: fixed; 
                top: 0; left: 0; 
                height: 100vh; 
                z-index: 1000; 
                background: white; 
            }
            .dark-mode .tc-app.chat-active .tc-main { background: #121212; }
            
            /* Back button dikhane ke liye */
            .tc-mobile-back { display: flex !important; margin-right: 15px; cursor: pointer; color: #555; align-items: center; justify-content: center; }
            .dark-mode .tc-mobile-back { color: #ccc; }
            
            /* Auth aur Info screens ko mobile pe thik karna */
            .tc-auth-box { width: 90vw !important; }
            .tc-chat-info-sidebar { width: 100vw !important; }
            .tc-modal { width: 95vw !important; }
        }
      `}</style>
    </div>
  );
}

export default App;
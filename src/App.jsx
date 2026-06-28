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
  IoCopyOutline, IoDownloadOutline, IoMegaphoneOutline, IoArchiveOutline, IoVolumeMuteOutline, IoCheckmarkCircle,
  IoPinOutline, IoNotificationsOffOutline, IoTimeOutline, IoArrowForwardOutline, IoCashOutline, IoStatsChartOutline, IoRocketOutline, IoWalletOutline,
  IoBarChartOutline, IoChevronBackOutline, IoChevronForwardOutline, IoFlashOutline, IoHelpCircleOutline
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
    let formattedText = text.replace(/```([\s\S]*?)```/g, '<div style="background:rgba(0,0,0,0.05); padding:10px; border-radius:8px; font-family:monospace; overflow-x:auto; border: 1px solid rgba(0,0,0,0.1); margin: 5px 0;"><code style="white-space: pre-wrap;">$1</code></div>');
    formattedText = formattedText.replace(/(https?:\/\/[^\s]+)/g, '<a href="$1" target="_blank" rel="noopener noreferrer" style="color:#4dabf7; text-decoration:underline;">$1</a>');
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

// ⚡ PERFORMANCE UPGRADE: Memoized Message Component (Taaki chat fast load ho)
const MessageBubble = React.memo(({ msg, username, chatWith, currentGroup, isElite, isBroadcast, reactionEmojis, handleReaction, handlePinMessage, setForwardMsg, pushHistoryState, downloadImage, copyToClipboard, speakText, setActiveReactionMsg, activeReactionMsg, setReplyTo, handleReactionSelect, handleViewOnceClick, setViewImage }) => {
    
    // Check if message is locked and user hasn't reacted yet
    const isLockedForUser = msg.isLocked && msg.sender !== username && !msg.reactedBy?.includes(username);

    return (
        <div className={`tc-msg-row ${msg.sender === username && chatWith.name !== username ? 'sent' : 'received'}`}>
            <div className={`tc-bubble tc-bubble-relative ${isBroadcast ? 'tc-broadcast-highlight' : ''} ${msg.isMystery ? 'mystery-bubble' : ''} ${msg.isLocked ? 'locked-bubble' : ''}`} onDoubleClick={() => msg.type !== 'poll' && handleReaction(msg.id, msg.reaction)} onContextMenu={(e) => { e.preventDefault(); }}>
                
                <div className="tc-msg-actions-hover">
                    {(chatWith.type === 'channel' || chatWith.type === 'group') && currentGroup?.admin === username && !msg.isMystery && (
                        <div className="tc-action-trigger tooltip-wrapper" onClick={(e) => { e.stopPropagation(); handlePinMessage(msg.id, msg.isPinned); }}>
                            <IoPinOutline size={16}/>
                            <span className="tooltip">{msg.isPinned ? 'Remove Spotlight' : 'Add Spotlight'}</span>
                        </div>
                    )}
                    <div className="tc-action-trigger tooltip-wrapper" onClick={(e) => { e.stopPropagation(); setForwardMsg(msg); pushHistoryState(); }}><IoArrowForwardOutline size={18}/><span className="tooltip">Forward</span></div>
                    {msg.image && !msg.isViewOnce && !isLockedForUser && (
                        <div className="tc-action-trigger tooltip-wrapper" onClick={(e) => { e.stopPropagation(); downloadImage(msg.image, `Telechat_Image_${msg.time}.jpg`); }}><IoDownloadOutline size={16}/><span className="tooltip">Download</span></div>
                    )}
                    {msg.text && msg.text !== "🎙️ Voice Note" && msg.type !== 'poll' && !isLockedForUser && (
                        <>
                          <div className="tc-action-trigger tooltip-wrapper" onClick={(e) => { e.stopPropagation(); copyToClipboard(msg.text); }}><IoCopyOutline size={16}/><span className="tooltip">Copy</span></div>
                          <div className="tc-action-trigger tooltip-wrapper" onClick={(e) => { e.stopPropagation(); speakText(msg.text); }}><IoMegaphoneOutline size={16}/><span className="tooltip">Read Aloud</span></div>
                        </>
                    )}
                    <div className="tc-action-trigger tooltip-wrapper" onClick={(e) => { e.stopPropagation(); setActiveReactionMsg(activeReactionMsg === msg.id ? null : msg.id); }}><IoHappyOutline size={16}/><span className="tooltip">React</span></div>
                    {!isLockedForUser && <div className="tc-action-trigger tooltip-wrapper" onClick={() => setReplyTo(msg)}><IoArrowUndoOutline size={18}/><span className="tooltip">Reply</span></div>}
                </div>

                {activeReactionMsg === msg.id && (
                    <div className="tc-reaction-popover" onClick={(e) => e.stopPropagation()}>
                        {reactionEmojis.map(emoji => ( <span key={emoji} onClick={() => handleReactionSelect(msg.id, emoji)}>{emoji}</span> ))}
                    </div>
                )}

                {(chatWith.type === 'group' || chatWith.type === 'channel') && msg.sender !== username && (
                    <div className="tc-msg-sender" style={{ fontSize: '12px', color: '#0088cc', marginBottom: '4px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        {msg.isMystery ? '👻 Mystery Whisper' : msg.sender}
                        {currentGroup?.admin === msg.sender && !msg.isMystery && <IoCheckmarkCircle color="#4dabf7" size={14} title="Admin" />}
                        {isElite && currentGroup?.admin !== msg.sender && !msg.isMystery && <span title="Top Fan" style={{color: '#ff9c6e', display:'flex', alignItems:'center'}}><IoRocketOutline size={14}/> Elite</span>}
                        {msg.isLocked && <IoLockClosedOutline color="#faad14" size={12}/>}
                        {isBroadcast && (
                            <span style={{background: '#0088cc', color: 'white', padding: '2px 6px', borderRadius: '4px', fontSize: '9px', marginLeft: '5px', display: 'inline-flex', alignItems: 'center', gap: '2px'}}><IoMegaphoneOutline size={10}/> Broadcast</span>
                        )}
                        {msg.isSilent && (
                            <span style={{background: '#888', color: 'white', padding: '2px 6px', borderRadius: '4px', fontSize: '9px', marginLeft: '5px', display: 'inline-flex', alignItems: 'center', gap: '2px'}}><IoNotificationsOffOutline size={10}/> Silent</span>
                        )}
                    </div>
                )}
                
                {msg.isForwarded && (
                    <div style={{fontSize: '11px', color: '#888', fontStyle: 'italic', marginBottom: '4px', display:'flex', alignItems:'center', gap:'3px'}}><IoArrowForwardOutline size={10}/> Forwarded</div>
                )}
                {msg.replyTo && !isLockedForUser && (<div className="tc-msg-reply-block"><div className="reply-sender">{msg.replySender}</div><div className="reply-text">{msg.replyTo.length > 30 ? msg.replyTo.substring(0,30)+'...' : msg.replyTo}</div></div>)}
                
                <div style={{display: 'flex', flexDirection: 'column', gap: '5px'}}>
                    {/* 🔒 Locked Content Logic */}
                    {isLockedForUser ? (
                        <div className="tc-locked-content" onClick={(e) => { e.stopPropagation(); setActiveReactionMsg(msg.id); }}>
                            <IoLockClosedOutline size={30} color="#faad14" />
                            <span>React to Unlock Content</span>
                        </div>
                    ) : (
                        <>
                            {msg.image && (
                                msg.isViewOnce ? (
                                    <div className="tc-view-once-msg" onClick={() => handleViewOnceClick(msg.id, msg.image, msg.sender)}>
                                        <IoEyeOutline size={24} color="#0088cc" />
                                        <span>Photo (View Once)</span>
                                    </div>
                                ) : (
                                    <img src={msg.image} className="tc-msg-media" onClick={() => { pushHistoryState(); setViewImage(msg.image); }} alt="media" style={{borderRadius: '8px', maxWidth: '100%', cursor: 'pointer'}} />
                                )
                            )}
                            {msg.audio && <audio src={msg.audio} controls className="tc-msg-audio" style={{ outline: 'none' }} />}
                            
                            {msg.text && msg.text !== "🎙️ Voice Note" && msg.type !== 'poll' && (
                                <div className="tc-msg-content"><span className="tc-msg-text">{formatText(msg.text)}</span></div>
                            )}
                        </>
                    )}
                </div>

                <div className="tc-msg-meta" style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '5px' }}>
                    {msg.isSelfDestruct && <IoTimeOutline size={12} color="#ff4d4f" style={{marginRight: '2px'}} title="Self-Destructs in 10s" />}
                    {chatWith.type === 'channel' && (
                        <span className="tc-msg-views" style={{ display: 'inline-flex', alignItems: 'center', fontSize: '11px', color: '#888', marginRight: '4px' }}>
                            <IoEyeOutline size={13} style={{ marginRight: '2px' }} /> {msg.views || 1}
                        </span>
                    )}
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
    );
});

function App() {
  const [user, setUser] = useState(null);
  const [username, setUsername] = useState('');
  const [aboutMe, setAboutMe] = useState('Available'); 
  
  const [chatWith, setChatWith] = useState({ name: "Select a chat", type: "contact", pfp: null, desc: "" });

  const [currentMessages, setCurrentMessages] = useState([]); 
  const [searchQuery, setSearchQuery] = useState('');
  const [contacts, setContacts] = useState([]);
  const [globalSearchResults, setGlobalSearchResults] = useState([]); 
  const [globalChannelResults, setGlobalChannelResults] = useState([]);
  
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
  
  const [showNewChannel, setShowNewChannel] = useState(false);
  const [newChannelName, setNewChannelName] = useState('');
  const [isPublicChannel, setIsPublicChannel] = useState(true);
  const [customLink, setCustomLink] = useState(''); 
  const [requireApproval, setRequireApproval] = useState(false); 
  const [newChatPfp, setNewChatPfp] = useState(null); 
  
  const [showAddMember, setShowAddMember] = useState(false);
  const [newMemberName, setNewMemberName] = useState('');

  const [chatUserStatus, setChatUserStatus] = useState(null); 
  const [viewImage, setViewImage] = useState(null);
  const [showChatInfo, setShowChatInfo] = useState(false);
  const [infoTab, setInfoTab] = useState('media');
  const [replyTo, setReplyTo] = useState(null);
  const [blockedContacts, setBlockedContacts] = useState([]);
  const [archivedChats, setArchivedChats] = useState([]); 
  const [pinnedChats, setPinnedChats] = useState([]); 
  const [privacySettings, setPrivacySettings] = useState({ lastSeen: true, readReceipts: true });
  const [chatWallpaper, setChatWallpaper] = useState(localStorage.getItem('tcWallpaper') || 'none');
  const [isMuted, setIsMuted] = useState(false);
  const [isSilentBroadcast, setIsSilentBroadcast] = useState(false); 
  const [hidePinnedMessage, setHidePinnedMessage] = useState(false); 
  const [forwardMsg, setForwardMsg] = useState(null); 
  
  const [showMonetization, setShowMonetization] = useState(false);
  const [showAnalytics, setShowAnalytics] = useState(false);

  const [showPollCreator, setShowPollCreator] = useState(false);
  const [pollQuestion, setPollQuestion] = useState('');
  const [pollOptions, setPollOptions] = useState(['', '']);
  const [spotlightIndex, setSpotlightIndex] = useState(0);

  const [showMagicMenu, setShowMagicMenu] = useState(false);
  const [activeVibe, setActiveVibe] = useState(null);
  const [floatingEmojis, setFloatingEmojis] = useState([]); // 🎈 LIVE REACTIONS

  const [imagePreview, setImagePreview] = useState(null);
  const [showImageEditor, setShowImageEditor] = useState(false);
  const [editImageURL, setEditImageURL] = useState(null);
  const canvasRef = useRef(null);
  const [editorMode, setEditorMode] = useState('draw'); 
  const [drawColor, setDrawColor] = useState('#ff0000');
  const [stampText, setStampText] = useState('😀');
  const [isDrawing, setIsDrawing] = useState(false);
  const [isViewOnce, setIsViewOnce] = useState(false); 
  const [isSelfDestruct, setIsSelfDestruct] = useState(false); 

  const [audioPreview, setAudioPreview] = useState(null);
  const [previewCaption, setPreviewCaption] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [recTimer, setRecTimer] = useState(0);

  const [activeReactionMsg, setActiveReactionMsg] = useState(null);
  const reactionEmojis = useMemo(() => ['❤️', '😂', '😮', '😢', '🙏', '👍', '🔥', '💯'], []);
  
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const recIntervalRef = useRef(null);
  let contactTouchTimer = null;
  const [unreadCounts, setUnreadCounts] = useState({});
  const [groups, setGroups] = useState([]); 
  const emojis = useMemo(() => ['😀','😂','😍','🙏','👍','🔥','❤️','💪','🎉', '✨', '🥺', '😎', '💯', '🤔', '🙌', '💡', '🌟'], []);

  const messagesEndRef = useRef(null);
  const [showScrollBtn, setShowScrollBtn] = useState(false);
  const safeSearchQuery = searchQuery?.replace(/\s+/g, '')?.toLowerCase() || "";

  useEffect(() => {
      setReplyTo(null);
      setShowScrollBtn(false);
      setHidePinnedMessage(false);
      setSpotlightIndex(0);
  }, [chatWith.name]);

  useEffect(() => {
    const handlePopState = (e) => {
      if (showPollCreator) { setShowPollCreator(false); }
      else if (showMonetization) { setShowMonetization(false); }
      else if (showAnalytics) { setShowAnalytics(false); }
      else if (showMagicMenu) { setShowMagicMenu(false); }
      else if (forwardMsg) { setForwardMsg(null); }
      else if (showImageEditor) { setShowImageEditor(false); }
      else if (imagePreview || audioPreview) { setImagePreview(null); setAudioPreview(null); }
      else if (activeStoryView) { setActiveStoryView(null); }
      else if (viewImage) { setViewImage(null); }
      else if (showAddMember) { setShowAddMember(false); }
      else if (showChatInfo) { setShowChatInfo(false); }
      else if (showMenuDropdown) { setShowMenuDropdown(false); }
      else if (showSettings) { setShowSettings(false); }
      else if (showNewGroup) { setShowNewGroup(false); setNewChatPfp(null); }
      else if (showNewChannel) { setShowNewChannel(false); setNewChatPfp(null); }
      else if (showDrawer) { setShowDrawer(false); }
      else if (chatWith.name !== "Select a chat") { 
        setChatWith({ name: "Select a chat", type: "contact", pfp: null, desc: "" }); 
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [chatWith, showAddMember, showChatInfo, showSettings, showDrawer, showNewGroup, showNewChannel, viewImage, activeStoryView, imagePreview, audioPreview, showImageEditor, showMenuDropdown, forwardMsg, showMonetization, showAnalytics, showPollCreator, showMagicMenu]);

  const pushHistoryState = () => { window.history.pushState({ opened: true }, ""); };
  const scrollToBottom = useCallback(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), []);
  useEffect(() => { scrollToBottom(); }, [currentMessages, scrollToBottom]);

  const toggleTheme = () => { setIsDarkMode(!isDarkMode); localStorage.setItem('tcTheme', !isDarkMode ? 'dark' : 'light'); };
  const changeWallpaper = (bg) => { setChatWallpaper(bg); localStorage.setItem('tcWallpaper', bg); };

  const getChatId = useCallback((user1, user2, isGroupOrChannel) => {
    if (isGroupOrChannel) return user2;
    return [user1, user2].sort().join('_');
  }, []);

  const showToast = (msg) => { setToastMsg(msg); setTimeout(() => setToastMsg(null), 3000); };
  const copyToClipboard = (text) => { if(!text) return; navigator.clipboard.writeText(text); showToast("Copied to clipboard! 📋"); };
  const downloadImage = (base64Data, filename = 'download.jpg') => { const link = document.createElement('a'); link.href = base64Data; link.download = filename; document.body.appendChild(link); link.click(); document.body.removeChild(link); showToast("Image downloading... 🖼️"); };

  useEffect(() => { if ("Notification" in window && Notification.permission !== "granted" && Notification.permission !== "denied") { Notification.requestPermission(); } }, []);

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
                isOnline: true, contacts: [], groups: [], blockedContacts: [], archivedChats: [], pinnedChats: [], privacy: { lastSeen: true, readReceipts: true }, pfp: currentUser.photoURL || null, about: "Available", lastSeen: serverTimestamp()
            });
            if (currentUser.photoURL) setPfp(currentUser.photoURL);
        } else {
             await updateDoc(userRef, { isOnline: true, lastSeen: serverTimestamp() });
             const data = snap.data();
             if(data.about) setAboutMe(data.about);
             if(data.archivedChats) setArchivedChats(data.archivedChats);
             if(data.pinnedChats) setPinnedChats(data.pinnedChats);
             if(data.pfp) setPfp(data.pfp);
        }
      } else {
        setUser(null); setUsername(''); setPfp(null); setContacts([]); setAboutMe('Available'); setArchivedChats([]); setPinnedChats([]);
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
            if (data.pinnedChats) setPinnedChats(data.pinnedChats);
            if (data.privacy) setPrivacySettings(data.privacy);
            if (data.about) setAboutMe(data.about);
        }
    });
    return () => unsubUser();
  }, [username]);

  useEffect(() => {
      if(user && username) {
          const userRef = doc(db, 'users', username);
          updateDoc(userRef, { isOnline: true, lastSeen: serverTimestamp() }).catch(()=>{});

          const handleOffline = () => { updateDoc(userRef, { isOnline: false, lastSeen: serverTimestamp() }).catch(() => {}); };
          window.addEventListener('beforeunload', handleOffline);

          const handleVisibilityChange = () => {
              if (document.hidden) { updateDoc(userRef, { isOnline: false, lastSeen: serverTimestamp() }).catch(()=>{}); } 
              else { updateDoc(userRef, { isOnline: true, lastSeen: serverTimestamp() }).catch(()=>{}); }
          };
          document.addEventListener("visibilitychange", handleVisibilityChange);

          const heartbeatInterval = setInterval(() => {
              if (!document.hidden) {
                  updateDoc(userRef, { isOnline: true, lastSeen: serverTimestamp() }).catch(()=>{});
              }
          }, 60000); 

          return () => { 
              handleOffline(); 
              window.removeEventListener('beforeunload', handleOffline); 
              document.removeEventListener("visibilitychange", handleVisibilityChange); 
              clearInterval(heartbeatInterval);
          };
      }
  }, [user, username]);

  useEffect(() => {
      if(!username) return;
      const q = query(collection(db, 'messages'), where('recipient', '==', username));
      const unsub = onSnapshot(q, (snap) => {
          const counts = {};
          snap.docs.forEach(msgDoc => {
              const data = msgDoc.data();
              if(data.status === 'sent' || data.status === 'delivered') {
                  if(data.sender !== chatWith.name && data.sender !== username) { counts[data.sender] = (counts[data.sender] || 0) + 1; }
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

  useEffect(() => {
    const fetchSearch = async () => {
      if (safeSearchQuery.length < 1) { setGlobalSearchResults([]); setGlobalChannelResults([]); return; }
      try {
          let userResults = []; let channelResults = [];
          const qName = query(collection(db, 'users'), limit(150));
          const nameSnap = await getDocs(qName);

          nameSnap.forEach(d => {
              const data = d.data();
              if(data.username) {
                  const dbNameClean = data.username.replace(/\s+/g, '').toLowerCase();
                  if(dbNameClean.includes(safeSearchQuery) && data.username !== username) { userResults.push(data); }
              }
              if(data.groups) {
                  data.groups.forEach(g => {
                      if(g.type === 'channel' && g.visibility === 'public') {
                          const cleanChan = (g.name || "").replace(/\s+/g, '').toLowerCase();
                          if(cleanChan.includes(safeSearchQuery) && !channelResults.find(c => c.name === g.name)) { channelResults.push(g); }
                      }
                  });
              }
          });
          setGlobalSearchResults(userResults); setGlobalChannelResults(channelResults);
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
    const chatId = getChatId(username, chatWith.name, chatWith.type === 'group' || chatWith.type === 'channel');
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

  const currentGroup = useMemo(() => (chatWith.type === 'group' || chatWith.type === 'channel') ? groups.find(g => g.name === chatWith.name) : null, [chatWith, groups]);

  const isChannelOrGroupMember = useMemo(() => {
      if (chatWith.type !== 'channel' && chatWith.type !== 'group') return true;
      return currentGroup?.members?.includes(username) || false;
  }, [chatWith, currentGroup, username]);

  const [showMilestone, setShowMilestone] = useState(false);
  useEffect(() => {
      if (currentGroup && (chatWith.type === 'channel' || chatWith.type === 'group')) {
          const membersCount = currentGroup.members.length;
          if (membersCount > 1 && (membersCount % 5 === 0 || membersCount % 10 === 0)) {
              const milestoneKey = `milestone_${currentGroup.name}_${membersCount}`;
              if (!localStorage.getItem(milestoneKey)) {
                  setShowMilestone(true);
                  localStorage.setItem(milestoneKey, 'true');
                  setTimeout(() => setShowMilestone(false), 5000);
              }
          }
      }
  }, [currentGroup, chatWith.type]);

  useEffect(() => {
    const latestVibeMsg = currentMessages.filter(m => m.vibe).pop();
    if (latestVibeMsg && latestVibeMsg.status !== 'seen' && latestVibeMsg.sender !== username) {
        setActiveVibe(latestVibeMsg.vibe);
        updateDoc(doc(db, 'messages', latestVibeMsg.id), { status: 'seen' }).catch(()=>{});
        setTimeout(() => setActiveVibe(null), 4000); 
    }
  }, [currentMessages, username]);

  const toggleArchive = async (contactName) => {
    if(contactName === username) return;
    let newList;
    if(archivedChats.includes(contactName)) {
        newList = archivedChats.filter(c => c !== contactName); showToast(`${contactName} unarchived.`);
    } else {
        newList = [...archivedChats, contactName]; showToast(`Chat archived. 🗃️`);
        if(sidebarTab === 'archived' && newList.length === 0) setSidebarTab('chats');
    }
    setArchivedChats(newList);
    try { await updateDoc(doc(db, 'users', username), { archivedChats: newList }); } catch(e) {}
  };

  const togglePinChat = async (contactName) => {
    if(contactName === username) return;
    let newList;
    if(pinnedChats.includes(contactName)) {
        newList = pinnedChats.filter(c => c !== contactName); showToast(`${contactName} unpinned.`);
    } else {
        if(pinnedChats.length >= 3) return showToast("You can only pin up to 3 chats!");
        newList = [...pinnedChats, contactName]; showToast(`${contactName} pinned to top! 📌`);
    }
    setPinnedChats(newList);
    try { await updateDoc(doc(db, 'users', username), { pinnedChats: newList }); } catch(e) {}
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
        if(chatWith.name === contactName) { setChatWith({ name: "Select a chat", type: "contact", pfp: null, desc: "" }); setShowChatInfo(false); window.history.back(); }
    }
  };

  const handleRemoveMember = async (memberName) => {
      if (!currentGroup || currentGroup.admin !== username) return;
      if (window.confirm(`Are you sure you want to remove ${memberName} from this ${chatWith.type}?`)) {
          const updatedGroup = { ...currentGroup, members: currentGroup.members.filter(m => m !== memberName) };
          const newGroups = groups.map(g => g.name === chatWith.name ? updatedGroup : g);
          setGroups(newGroups); 
          await updateDoc(doc(db, 'users', username), { groups: newGroups }).catch(()=>{});
          showToast(`${memberName} removed successfully! 🗑️`);
      }
  };

  const approveUser = async (targetUser) => {
      if (!currentGroup || currentGroup.admin !== username) return;
      const updatedGroup = { 
          ...currentGroup, 
          members: [...currentGroup.members, targetUser],
          pendingMembers: (currentGroup.pendingMembers || []).filter(u => u !== targetUser)
      };
      const myNewGroups = groups.map(g => g.name === chatWith.name ? updatedGroup : g);
      setGroups(myNewGroups);
      await updateDoc(doc(db, 'users', username), { groups: myNewGroups });

      try {
          const userDoc = await getDoc(doc(db, 'users', targetUser));
          if (userDoc.exists()) {
              const userData = userDoc.data();
              const userGroups = userData.groups || [];
              if (!userGroups.find(g => g.name === updatedGroup.name)) {
                  await updateDoc(doc(db, 'users', targetUser), { groups: [updatedGroup, ...userGroups] });
              }
          }
      } catch(e) {}
      showToast(`${targetUser} approved! ✅`);
  };

  const rejectUser = async (targetUser) => {
      if (!currentGroup || currentGroup.admin !== username) return;
      const updatedGroup = { 
          ...currentGroup, 
          pendingMembers: (currentGroup.pendingMembers || []).filter(u => u !== targetUser)
      };
      const myNewGroups = groups.map(g => g.name === chatWith.name ? updatedGroup : g);
      setGroups(myNewGroups);
      await updateDoc(doc(db, 'users', username), { groups: myNewGroups });
      showToast(`${targetUser} request declined. ❌`);
  };

  const togglePrivacy = (key) => {
    const newSettings = { ...privacySettings, [key]: !privacySettings[key] };
    setPrivacySettings(newSettings);
    localStorage.setItem('tcPrivacy', JSON.stringify(newSettings));
    try { updateDoc(doc(db, 'users', username), { privacy: newSettings }); } catch(e) {}
  };

  const deleteMessage = async (msgId) => { if(window.confirm("Delete this message for everyone?")) { try { await deleteDoc(doc(db, 'messages', msgId)); } catch(e) {} } };
  const clearChat = () => { if(window.confirm(`Are you sure you want to delete all messages here?`)) { currentMessages.forEach(m => { deleteDoc(doc(db, 'messages', m.id)).catch(()=>{}); }); setShowChatInfo(false); window.history.back(); } };

  const toggleBlock = (contactName) => {
    if(contactName === username) return;
    let newList;
    if(blockedContacts.includes(contactName)) { newList = blockedContacts.filter(c => c !== contactName); showToast(`${contactName} Unblocked.`); } 
    else { if(window.confirm(`Block ${contactName}? They won't be able to message you.`)) { newList = [...blockedContacts, contactName]; setShowChatInfo(false); window.history.back(); } else return; }
    setBlockedContacts(newList); localStorage.setItem('tcBlockedContacts', JSON.stringify(newList));
    try { updateDoc(doc(db, 'users', username), { blockedContacts: newList }); } catch(e) {}
  };

  const isBlocked = useMemo(() => blockedContacts.includes(chatWith.name), [blockedContacts, chatWith.name]);

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

  const handleNewChatPfpUpload = async (e) => {
      const file = e.target.files[0];
      if (file) {
          try {
              const compressed = await compressImage(file);
              setNewChatPfp(compressed);
          } catch(err) { showToast("Error setting image"); }
      }
      e.target.value = null;
  };

  // 🎈 Trigger Floating Animation logic
  const triggerFloatingEmoji = (emoji) => {
      const newEmoji = { id: Date.now(), emoji, left: Math.random() * 80 + 10 };
      setFloatingEmojis(prev => [...prev, newEmoji]);
      setTimeout(() => {
          setFloatingEmojis(prev => prev.filter(e => e.id !== newEmoji.id));
      }, 2000);
  };

  const handleReaction = async (msgId, currentReaction) => {
    const newReaction = currentReaction === '❤️' ? null : '❤️';
    try { 
        await updateDoc(doc(db, 'messages', msgId), { reaction: newReaction }); 
        if(newReaction) triggerFloatingEmoji(newReaction);
    } catch(err) {}
  };
  const handleReactionSelect = async (msgId, emoji) => { 
      try { 
          const msgRef = doc(db, 'messages', msgId);
          const msgSnap = await getDoc(msgRef);
          
          if(msgSnap.exists()) {
              const msgData = msgSnap.data();
              // Unlocking Locked Message Logic
              if(msgData.isLocked && !msgData.reactedBy?.includes(username)) {
                  const updatedReactedBy = [...(msgData.reactedBy || []), username];
                  await updateDoc(msgRef, { reaction: emoji, reactedBy: updatedReactedBy });
                  showToast("Content Unlocked! 🔓");
              } else {
                  await updateDoc(msgRef, { reaction: emoji }); 
              }
              triggerFloatingEmoji(emoji);
          }
      } catch(err) {} 
      setActiveReactionMsg(null); 
  };

  const handleImageSelect = async (e) => {
    const file = e.target.files[0];
    if (file) { const base64Raw = await compressImage(file); setEditImageURL(base64Raw); pushHistoryState(); setShowImageEditor(true); setShowMagicMenu(false); }
    e.target.value = null; 
  };

  const initCanvas = useCallback(() => {
      const canvas = canvasRef.current;
      if (!canvas || !editImageURL) return;
      const ctx = canvas.getContext('2d');
      const img = new Image();
      img.onload = () => { canvas.width = img.width; canvas.height = img.height; ctx.drawImage(img, 0, 0); };
      img.src = editImageURL;
  }, [editImageURL]);

  useEffect(() => { if (showImageEditor) { initCanvas(); } }, [showImageEditor, initCanvas]);

  const getCanvasCoordinates = (e) => {
      const canvas = canvasRef.current; const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width; const scaleY = canvas.height / rect.height;
      const clientX = e.clientX || (e.touches && e.touches[0].clientX); const clientY = e.clientY || (e.touches && e.touches[0].clientY);
      return { x: (clientX - rect.left) * scaleX, y: (clientY - rect.top) * scaleY };
  };

  const startCanvasAction = (e) => {
      const { x, y } = getCanvasCoordinates(e); const ctx = canvasRef.current.getContext('2d');
      if (editorMode === 'draw') { setIsDrawing(true); ctx.beginPath(); ctx.moveTo(x, y); } 
      else if (editorMode === 'text') { ctx.font = 'bold 50px Arial'; ctx.fillStyle = drawColor; ctx.fillText(stampText, x, y); }
  };
  const drawOnCanvas = (e) => {
      if (!isDrawing || editorMode !== 'draw') return; e.preventDefault();
      const { x, y } = getCanvasCoordinates(e); const ctx = canvasRef.current.getContext('2d');
      ctx.lineTo(x, y); ctx.strokeStyle = drawColor; ctx.lineWidth = 8; ctx.lineCap = 'round'; ctx.stroke();
  };
  const stopCanvasAction = () => { if (isDrawing) { setIsDrawing(false); canvasRef.current.getContext('2d').closePath(); } };

  const saveEditedImage = () => {
      const finalImageBase64 = canvasRef.current.toDataURL('image/jpeg', 0.8);
      setImagePreview(finalImageBase64); setShowImageEditor(false); window.history.back(); pushHistoryState(); setPreviewCaption('');
  };

  const ensureMutualContact = async (targetChatName, targetChatType) => {
    if (targetChatType !== 'contact' || targetChatName === username) return; 
    let recipientAbout = "Available";
    try {
        const recipientDoc = await getDoc(doc(db, 'users', targetChatName));
        if (recipientDoc.exists()) {
            const recData = recipientDoc.data(); recipientAbout = recData.about || "Available";
            const recContacts = recData.contacts || [];
            if (!recContacts.find(c => c.name === username)) {
                const myInfo = { name: username, pfp: pfp, desc: "New message", about: aboutMe };
                updateDoc(doc(db, 'users', targetChatName), { contacts: [myInfo, ...recContacts] }).catch(()=>{});
            }
        }
    } catch(e) {}
    if (!contacts.find(c => c.name === targetChatName)) {
        const newMyContacts = [{ name: targetChatName, pfp: null, desc: "Tap to chat", about: recipientAbout }, ...contacts];
        updateDoc(doc(db, 'users', username), { contacts: newMyContacts }).catch(()=>{});
    }
  };

  const confirmSendImage = async () => {
    if (!imagePreview) return;
    const timeString = new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
    if (imagePreview.length > 1040000) return alert("Edited Image is too large for database! Try clearing some drawings.");
    setImagePreview(null); setPreviewCaption(''); window.history.back();

    try {
      const msgData = { text: previewCaption, sender: username, recipient: chatWith.name, chatId: getChatId(username, chatWith.name, chatWith.type === 'group' || chatWith.type === 'channel'), status: "sent", time: timeString, replyTo: replyTo ? replyTo.text || 'Image' : null, replySender: replyTo ? replyTo.sender : null };
      const newMsg = await addDoc(collection(db, 'messages'), { ...msgData, image: imagePreview, isViewOnce: isViewOnce, isSelfDestruct: isSelfDestruct, participants: [username, chatWith.name], createdAt: serverTimestamp() }); 
      await ensureMutualContact(chatWith.name, chatWith.type); setIsViewOnce(false); setIsSelfDestruct(false);

      if (isSelfDestruct) {
        setTimeout(() => { deleteDoc(doc(db, 'messages', newMsg.id)).catch(()=>{}); }, 10000); 
      }
    } catch(err) { alert("Image upload failed! " + err.message); }
    setReplyTo(null);
  };

  const handleViewOnceClick = async (msgId, base64Image, sender) => {
      pushHistoryState(); setViewImage(base64Image);
      if (sender !== username || chatWith.name === username) { try { await deleteDoc(doc(db, 'messages', msgId)); } catch(e) {} }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: false } });
      let mimeType = 'audio/webm'; if (MediaRecorder.isTypeSupported('audio/mp4')) { mimeType = 'audio/mp4'; }
      const recorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = recorder; audioChunksRef.current = [];
      recorder.ondataavailable = e => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
      
      recorder.onstop = async () => {
        setIsRecording(false); clearInterval(recIntervalRef.current);
        const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
        audioChunksRef.current = []; pushHistoryState(); setAudioPreview({ blob: audioBlob, url: URL.createObjectURL(audioBlob) });
        stream.getTracks().forEach(track => track.stop()); 
      };
      
      recorder.start(); setIsRecording(true); setRecTimer(0);
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

  const stopAndPreviewAudio = () => { if (mediaRecorderRef.current && isRecording) { try { mediaRecorderRef.current.stop(); } catch(e) {} } };

  const confirmSendAudio = async () => {
    if (!audioPreview) return;
    const { blob } = audioPreview; const timeString = new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
    setAudioPreview(null); window.history.back();
    try {
      const base64Audio = await blobToBase64(blob);
      if (base64Audio.length > 2000000) return alert("Recording is too large!"); 
      const msgData = { text: "🎙️ Voice Note", sender: username, recipient: chatWith.name, chatId: getChatId(username, chatWith.name, chatWith.type === 'group' || chatWith.type === 'channel'), status: "sent", time: timeString };
      await addDoc(collection(db, 'messages'), { ...msgData, audio: base64Audio, participants: [username, chatWith.name], createdAt: serverTimestamp() });
      await ensureMutualContact(chatWith.name, chatWith.type); 
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
  
  const sendMessage = useCallback(async (e, customData = null) => {
    if (e && e.preventDefault) e.preventDefault();
    const finalInput = customData ? customData.text : input.trim();
    if (!finalInput || isBlocked) return;

    const timeString = new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
    const msgData = { 
        text: finalInput, 
        sender: username, 
        recipient: chatWith.name, 
        chatId: getChatId(username, chatWith.name, chatWith.type === 'group' || chatWith.type === 'channel'), 
        status: "sent", 
        time: timeString, 
        reaction: null, 
        replyTo: replyTo ? replyTo.text || 'Image' : null, 
        replySender: replyTo ? replyTo.sender : null, 
        isSilent: isSilentBroadcast,
        isMystery: customData?.isMystery || false,
        vibe: customData?.vibe || null,
        isLocked: customData?.isLocked || false, // 🔒 Locked Bonus Feature
        reactedBy: [] 
    };

    if(!customData) { setInput(''); setShowEmojis(false); }
    setReplyTo(null);

    try { 
      await addDoc(collection(db, 'messages'), { ...msgData, participants: [username, chatWith.name], createdAt: serverTimestamp() }); 
      if(chatWith.name !== username) updateDoc(doc(db, 'users', username), { typingTo: null }).catch(()=>{});
      await ensureMutualContact(chatWith.name, chatWith.type); 
    } catch(err) { alert("Failed to send message: " + err.message); }
  }, [input, isBlocked, username, chatWith, replyTo, getChatId, ensureMutualContact, isSilentBroadcast]);
  
  const executeForward = async (targetChat) => {
      if(!forwardMsg) return;
      const timeString = new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
      const isGroupOrChannel = targetChat.type === 'group' || targetChat.type === 'channel';
      const fChatId = getChatId(username, targetChat.name, isGroupOrChannel);
      
      const msgData = { 
          text: forwardMsg.text, 
          image: forwardMsg.image || null,
          audio: forwardMsg.audio || null,
          sender: username, 
          recipient: targetChat.name, 
          chatId: fChatId, 
          status: "sent", 
          time: timeString, 
          isForwarded: true 
      };

      setForwardMsg(null); window.history.back(); showToast(`Forwarded to ${targetChat.name} 🚀`);

      try {
          await addDoc(collection(db, 'messages'), { ...msgData, participants: [username, targetChat.name], createdAt: serverTimestamp() });
          await ensureMutualContact(targetChat.name, targetChat.type);
      } catch(err) { showToast("Failed to forward message!"); }
  };

  const handlePinMessage = async (msgId, isPinned) => {
      try {
          await updateDoc(doc(db, 'messages', msgId), { isPinned: !isPinned });
          showToast(!isPinned ? "Message added to Spotlight! 📌" : "Removed from Spotlight");
          setHidePinnedMessage(false);
      } catch (e) { showToast("Failed to pin message."); }
  };

  const handleAddPollOption = () => { if(pollOptions.length < 5) setPollOptions([...pollOptions, '']); };
  const sendPoll = async () => {
      if(!pollQuestion.trim() || pollOptions.filter(o => o.trim()).length < 2) return showToast("Question & min 2 options required!");
      const finalOpts = pollOptions.filter(o => o.trim()).map(opt => ({ text: opt, votes: [] }));
      const timeString = new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
      const msgData = { text: pollQuestion, type: 'poll', pollOptions: finalOpts, sender: username, recipient: chatWith.name, chatId: getChatId(username, chatWith.name, chatWith.type === 'group' || chatWith.type === 'channel'), status: "sent", time: timeString };
      
      setShowPollCreator(false); setPollQuestion(''); setPollOptions(['', '']); window.history.back();
      try { await addDoc(collection(db, 'messages'), { ...msgData, participants: [username, chatWith.name], createdAt: serverTimestamp() }); } catch(err) {}
  };

  const handleVote = async (msgId, pollOptions, optionIndex) => {
      const userAlreadyVoted = pollOptions.some(opt => opt.votes.includes(username));
      if (userAlreadyVoted) return showToast("Already voted!");
      const updatedOptions = [...pollOptions]; updatedOptions[optionIndex].votes.push(username);
      try { await updateDoc(doc(db, 'messages', msgId), { pollOptions: updatedOptions }); } catch(e) {}
  };

  const createNewGroup = () => { 
    if(newGroupName.trim() !== '') { 
      const generatedLink = isPublicChannel ? `telechat.com/c/${customLink || newGroupName.replace(/\s+/g, '')}` : `telechat.com/join/${Math.random().toString(36).substring(7)}`;
      const newGroupObj = { 
          name: newGroupName, 
          desc: isPublicChannel ? "Public Group" : "Private Group", 
          icon: newChatPfp, 
          admin: username, 
          members: [username], 
          pendingMembers: [],
          type: 'group', 
          visibility: isPublicChannel ? 'public' : 'private', 
          link: generatedLink,
          approvalRequired: !isPublicChannel ? requireApproval : false 
      };
      const newGroups = [newGroupObj, ...groups];
      setGroups(newGroups); updateDoc(doc(db, 'users', username), { groups: newGroups }).catch(()=>{});
      setNewGroupName(''); setCustomLink(''); setNewChatPfp(null); setShowNewGroup(false); setChatWith({ name: newGroupName, type: 'group', pfp: newChatPfp, desc: newGroupObj.desc }); 
      window.history.back();
    } 
  };
  
  const createNewChannel = () => { 
    if(newChannelName.trim() !== '') { 
      const generatedLink = isPublicChannel ? `telechat.com/c/${customLink || newChannelName.replace(/\s+/g, '')}` : `telechat.com/join/${Math.random().toString(36).substring(7)}`;
      const newChannelObj = { 
          name: newChannelName, 
          desc: isPublicChannel ? "Public Channel" : "Private Channel", 
          icon: newChatPfp, 
          admin: username, 
          members: [username], 
          pendingMembers: [],
          type: 'channel', 
          visibility: isPublicChannel ? 'public' : 'private', 
          link: generatedLink,
          approvalRequired: !isPublicChannel ? requireApproval : false 
      };
      const newGroups = [newChannelObj, ...groups];
      setGroups(newGroups); updateDoc(doc(db, 'users', username), { groups: newGroups }).catch(()=>{});
      setNewChannelName(''); setCustomLink(''); setNewChatPfp(null); setShowNewChannel(false); setChatWith({ name: newChannelName, type: 'channel', pfp: newChatPfp, desc: newChannelObj.desc }); 
      window.history.back();
    } 
  };

  const joinPublicChannel = async () => {
      if(!currentGroup) return;
      
      if (currentGroup.visibility === 'private' && currentGroup.approvalRequired) {
          const adminDoc = await getDoc(doc(db, 'users', currentGroup.admin));
          if (adminDoc.exists()) {
              const adminData = adminDoc.data();
              const adminGroups = adminData.groups || [];
              const adminGroupIndex = adminGroups.findIndex(g => g.name === currentGroup.name);
              if (adminGroupIndex > -1) {
                  const targetGroup = adminGroups[adminGroupIndex];
                  targetGroup.pendingMembers = [...(targetGroup.pendingMembers || []), username];
                  adminGroups[adminGroupIndex] = targetGroup;
                  await updateDoc(doc(db, 'users', currentGroup.admin), { groups: adminGroups });
              }
          }
          showToast("Join Request Sent to Admin! ⏳");
          return;
      }

      const updatedChan = { ...currentGroup, members: [...currentGroup.members, username] };
      const myNewGroups = [updatedChan, ...groups.filter(g => g.name !== chatWith.name)];
      setGroups(myNewGroups); await updateDoc(doc(db, 'users', username), { groups: myNewGroups });
      
      if (currentGroup.admin !== username) {
          const adminDoc = await getDoc(doc(db, 'users', currentGroup.admin));
          if (adminDoc.exists()) {
              const adminData = adminDoc.data();
              const adminGroups = adminData.groups || [];
              const adminGroupIndex = adminGroups.findIndex(g => g.name === currentGroup.name);
              if (adminGroupIndex > -1) {
                  const targetGroup = adminGroups[adminGroupIndex];
                  if (!targetGroup.members.includes(username)) {
                      targetGroup.members.push(username);
                      adminGroups[adminGroupIndex] = targetGroup;
                      await updateDoc(doc(db, 'users', currentGroup.admin), { groups: adminGroups });
                  }
              }
          }
      }
      showToast(`Joined ${chatWith.name} successfully! 🚀`);
  };

  const copyChannelLink = () => {
    if(currentGroup?.link) { copyToClipboard(currentGroup.link); } 
    else { const link = `https://telechat.com/join/${chatWith.name.replace(/\s+/g, '')}`; copyToClipboard(link); }
  };

  const handleAddMember = async () => {
    if(!newMemberName.trim()) return;
    const targetName = newMemberName.trim();
    if(currentGroup.members.includes(targetName)) { showToast("Already added!"); return; }
    
    try {
        const userDoc = await getDoc(doc(db, 'users', targetName));
        if (!userDoc.exists()) { showToast("User not found!"); return; }
        
        const updatedGroup = { ...currentGroup, members: [...currentGroup.members, targetName] };
        const myNewGroups = groups.map(g => g.name === chatWith.name ? updatedGroup : g);
        setGroups(myNewGroups); await updateDoc(doc(db, 'users', username), { groups: myNewGroups });

        const targetData = userDoc.data(); const targetGroups = targetData.groups || [];
        if (!targetGroups.find(g => g.name === chatWith.name)) { await updateDoc(doc(db, 'users', targetName), { groups: [updatedGroup, ...targetGroups] }); }

        setShowAddMember(false); setNewMemberName(''); window.history.back(); showToast(`${targetName} added successfully! 🎉`);
    } catch(e) { showToast("Error adding member"); }
  };

  const handleDeleteGroupOrChannel = async () => {
    if (window.confirm(`Are you sure you want to delete ${chatWith.name}? This will remove it for everyone.`)) {
        const chatIdToDelete = getChatId(username, chatWith.name, true);
        const q = query(collection(db, 'messages'), where("chatId", "==", chatIdToDelete));
        const snap = await getDocs(q); snap.forEach(document => { deleteDoc(doc(db, 'messages', document.id)).catch(()=>{}); });

        const newGroups = groups.filter(g => g.name !== chatWith.name);
        setGroups(newGroups); await updateDoc(doc(db, 'users', username), { groups: newGroups });
        setChatWith({ name: "Select a chat", type: "contact", pfp: null, desc: "" }); setShowChatInfo(false); showToast("Deleted successfully!");
    }
  };

  const handleLeaveGroupOrChannel = async () => {
    if (window.confirm(`Are you sure you want to leave ${chatWith.name}?`)) {
        const updatedGroup = { ...currentGroup, members: currentGroup.members.filter(m => m !== username) };
        const newGroups = groups.map(g => g.name === chatWith.name ? updatedGroup : g);
        setGroups(newGroups); await updateDoc(doc(db, 'users', username), { groups: newGroups });
        setChatWith({ name: "Select a chat", type: "contact", pfp: null, desc: "" }); setShowChatInfo(false); showToast("You left the chat.");
    }
  };

  const handleGroupAvatarUpload = async (e) => {
    const file = e.target.files[0];
    if (file && currentGroup) {
      if(currentGroup.admin !== username) return showToast("Only Admin can change picture!");
      try { const base64Image = await compressImage(file); setGroups(groups.map(g => g.name === chatWith.name ? { ...g, icon: base64Image } : g)); setChatWith({ ...chatWith, pfp: base64Image }); } catch(err) {}
    }
  };

  const handleGoogleSignIn = async () => { setIsLoading(true); try { const provider = new GoogleAuthProvider(); await signInWithPopup(auth, provider); } catch (err) { alert("Google Sign-In Failed: " + err.message); } finally { setIsLoading(false); } };
  const handleAuth = async (e) => { e.preventDefault(); setIsLoading(true); try { if (isLogin) { await signInWithEmailAndPassword(auth, email, password); } else { await createUserWithEmailAndPassword(auth, email, password); } } catch (err) { alert("Error: " + err.message); } finally { setIsLoading(false); } };
  const handleForgotPassword = async () => { if (!email) return showToast("Enter your email address first!"); try { await sendPasswordResetEmail(auth, email); showToast("Password reset link sent!"); } catch (err) { alert("Error: " + err.message); } };
  const handleLogout = async () => { try { await signOut(auth); setShowSettings(false); setShowDrawer(false); setChatWith({ name: "Select a chat", type: "contact", pfp: null, desc: "" }); } catch(err) { alert(err.message); } };

  const handleProfilePicUpload = async (e) => { if(e.target.files[0]){ try { const compressed = await compressImage(e.target.files[0]); setTempPfp(compressed); } catch(err) {} } e.target.value = null; };

  const saveProfile = async () => { 
    const finalName = tempName.trim(); if(!finalName) return showToast("Name cannot be empty");
    if(finalName !== username) { const checkDoc = await getDoc(doc(db, 'users', finalName)); if(checkDoc.exists()) return showToast("Username taken! Try another."); }
    if(user) { 
        try { 
            let finalPfpUrl = pfp; if (tempPfp) { finalPfpUrl = tempPfp; }
            if (finalName !== username) {
                await setDoc(doc(db, 'users', finalName), { username: finalName, pfp: finalPfpUrl, about: tempAbout || 'Available', email: user.email || null, phoneNumber: user.phoneNumber || null, isOnline: true, contacts: contacts || [], groups: groups || [], privacy: privacySettings, archivedChats: archivedChats, pinnedChats: pinnedChats, lastSeen: serverTimestamp() }, { merge: true }); 
                await deleteDoc(doc(db, 'users', username)); 
            } else { await updateDoc(doc(db, 'users', username), { pfp: finalPfpUrl, about: tempAbout || 'Available' }); }
            
            const authUpdateData = { displayName: finalName };
            if (finalPfpUrl && !finalPfpUrl.startsWith('data:image')) { authUpdateData.photoURL = finalPfpUrl; }
            await updateProfile(auth.currentUser, authUpdateData);
            
            setUsername(finalName); setPfp(finalPfpUrl); setAboutMe(tempAbout || 'Available'); setActiveSettingMenu('main'); showToast("Profile updated! 🌟"); 
        } catch(err) { showToast("Failed to update profile: " + err.message); } 
    } 
  };
  
  const openEditProfile = () => { setTempName(username); setTempPfp(pfp); setTempAbout(aboutMe); setActiveSettingMenu('editProfile'); };
  const copyProfileLink = () => { navigator.clipboard.writeText(`Hey! Join me on Telechat. Search my exact username: ${username}`); showToast("Profile link copied! 🔗"); };

  const mediaMessages = useMemo(() => currentMessages.filter(m => m.image), [currentMessages]);
  const pinnedMessages = useMemo(() => currentMessages.filter(m => m.isPinned), [currentMessages]);
  
  let displayStatus = ""; 
  if (isBlocked) { displayStatus = "Blocked"; } 
  else if (chatWith.name === "Select a chat") { displayStatus = ""; } 
  else if (chatWith.name === username) { displayStatus = "Saved Messages"; } 
  else if (chatWith.type === 'group') { displayStatus = `${currentGroup?.members?.length || 0} members`; } 
  else if (chatWith.type === 'channel') { displayStatus = `${currentGroup?.members?.length || 0} subscribers`; } 
  else if (chatUserStatus) {
      if (chatUserStatus.typingTo === username) { displayStatus = "Typing..."; } 
      else if (chatUserStatus.privacy?.lastSeen === false) { displayStatus = ""; } 
      else if (chatUserStatus.lastSeen) { 
          try { 
              let date;
              if (typeof chatUserStatus.lastSeen.toDate === 'function') { date = chatUserStatus.lastSeen.toDate(); } 
              else if (chatUserStatus.lastSeen.seconds) { date = new Date(chatUserStatus.lastSeen.seconds * 1000); } 
              else { date = new Date(chatUserStatus.lastSeen); }

              const now = new Date(); 
              const diffInSeconds = (now - date) / 1000;
              
              if (chatUserStatus.isOnline && diffInSeconds < 120) { displayStatus = "Online"; } 
              else {
                  const isToday = now.toDateString() === date.toDateString();
                  const yesterday = new Date(now); yesterday.setDate(now.getDate() - 1); const isYesterday = yesterday.toDateString() === date.toDateString();
                  const timeStr = date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
                  if (isToday) { displayStatus = `last seen today at ${timeStr}`; } 
                  else if (isYesterday) { displayStatus = `last seen yesterday at ${timeStr}`; } 
                  else { displayStatus = `last seen on ${date.toLocaleDateString()} at ${timeStr}`; }
              }
          } catch(e) { displayStatus = ""; } 
      } else { displayStatus = ""; }
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
                          <div key={'arch_group_'+i} className={`tc-chat-tile ${chatWith.name === g.name ? 'active' : ''}`} onClick={() => { pushHistoryState(); setChatWith({ name: g.name, type: g.type || 'group', pfp: g.icon, desc: `${g.members?.length || 0} ${g.type==='channel'?'subscribers':'members'}` }); setInfoTab('members'); }}>
                              <div className="tc-tile-avatar group">{g.icon ? <img src={g.icon} alt="G" /> : g.name[0]?.toUpperCase() || "?"}</div>
                              <div className="tc-tile-info">
                                  <div className="tc-tile-top"><span className="tc-tile-name">{g.name}</span></div>
                                  <div className="tc-tile-bottom">{g.members?.length || 0} {g.type==='channel'?'subscribers':'members'}</div>
                              </div>
                          </div>
                        ))}
                        {contacts.filter(c => archivedChats.includes(c.name)).map((c, i) => (
                          <div key={'arch_contact_'+i} className={`tc-chat-tile ${chatWith.name === c.name ? 'active' : ''}`} 
                               onClick={() => { pushHistoryState(); setChatWith({ name: c.name, type: 'contact', pfp: c.pfp, desc: c.about || "Tap to chat" }); setInfoTab('media'); }}
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
         const unarchivedGroups = groups.filter(g => !archivedChats.includes(g.name) && g.members?.includes(username));
         const unarchivedContacts = contacts.filter(c => c.name !== username && !archivedChats.includes(c.name));
         
         const allChats = [
             ...unarchivedGroups.map(g => ({ ...g, isGroupOrChannel: true })),
             ...unarchivedContacts.map(c => ({ ...c, isGroupOrChannel: false }))
         ].filter(item => {
             const cleanName = (item.name || "").replace(/\s+/g, '').toLowerCase();
             return cleanName.includes(safeSearchQuery);
         });

         const pinnedItems = allChats.filter(item => pinnedChats.includes(item.name));
         const unpinnedItems = allChats.filter(item => !pinnedChats.includes(item.name));

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
                   <div className={`tc-chat-tile ${chatWith.name === username ? 'active' : ''}`} onClick={() => { pushHistoryState(); setChatWith({ name: username, type: 'contact', pfp: pfp, desc: "Your personal cloud storage" }); }}>
                       <div className="tc-tile-avatar contact" style={{background: 'linear-gradient(135deg, #0088cc, #005580)', color: 'white', boxShadow: '0 4px 10px rgba(0,136,204,0.3)'}}><IoBookmarkOutline size={24}/></div>
                       <div className="tc-tile-info">
                           <div className="tc-tile-top"><span className="tc-tile-name" style={{fontWeight: 'bold', color: '#0088cc'}}>Saved Messages</span></div>
                           <div className="tc-tile-bottom">Save notes and media here</div>
                       </div>
                   </div>
               )}

               {searchQuery && (
                  <div className="tc-global-results-container" style={{marginBottom: '15px'}}>
                      {globalChannelResults.length > 0 && <div style={{padding: '10px 15px', fontSize: '12px', fontWeight: 'bold', color: '#0088cc', textTransform: 'uppercase', letterSpacing: '1px'}}>📢 Public Channels</div>}
                      {globalChannelResults.map((chan, i) => (
                          <div key={'glob_chan_'+i} className="tc-chat-tile" onClick={() => { pushHistoryState(); setChatWith({ name: chan.name, type: 'channel', pfp: chan.icon, desc: chan.desc || "Public Channel" }); setSearchQuery(''); }}>
                              <div className="tc-tile-avatar group">{chan.icon ? <img src={chan.icon} alt="C" /> : chan.name[0]?.toUpperCase() || "📢"}</div>
                              <div className="tc-tile-info">
                                  <div className="tc-tile-top"><span className="tc-tile-name" style={{color: '#0088cc'}}>{chan.name}</span></div>
                                  <div className="tc-tile-bottom">{chan.members?.length || 0} subscribers</div>
                              </div>
                          </div>
                      ))}

                      {globalSearchResults.length > 0 && <div style={{padding: '10px 15px', fontSize: '12px', fontWeight: 'bold', color: '#888', textTransform: 'uppercase', letterSpacing: '1px'}}>🌍 Global Search Users</div>}
                      {globalSearchResults.map((u, i) => (
                          <div key={'glob_'+i} className="tc-chat-tile" onClick={() => { pushHistoryState(); setChatWith({ name: u.username, type: 'contact', pfp: u.pfp, desc: u.about || "Available" }); setSearchQuery(''); }}>
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

               {pinnedItems.map((item, i) => (
                  <div key={'pinned_'+i} className={`tc-chat-tile pinned ${chatWith.name === item.name ? 'active' : ''}`} 
                       onClick={() => { pushHistoryState(); setChatWith({ name: item.name, type: item.isGroupOrChannel ? (item.type || 'group') : 'contact', pfp: item.isGroupOrChannel ? item.icon : item.pfp, desc: item.isGroupOrChannel ? `${item.members?.length || 0} ${item.type==='channel'?'subscribers':'members'}` : (item.about || "Tap to chat") }); if(item.isGroupOrChannel) setInfoTab('members'); else setInfoTab('media'); }}
                       onContextMenu={(e) => { e.preventDefault(); if(!item.isGroupOrChannel) handleRemoveContact(item.name); }}>
                      <div className={`tc-tile-avatar ${item.isGroupOrChannel ? 'group' : 'contact'}`}>{ (item.isGroupOrChannel ? item.icon : item.pfp) ? <img src={item.isGroupOrChannel ? item.icon : item.pfp} alt="DP" style={{width:'100%', height:'100%', borderRadius:'50%', objectFit:'cover'}}/> : item.name[0]?.toUpperCase() || "?"}</div>
                      <div className="tc-tile-info">
                          <div className="tc-tile-top">
                              <span className="tc-tile-name">{item.name}</span>
                              <div style={{display:'flex', alignItems: 'center', gap: '5px'}}>
                                 <IoPinOutline size={14} color="#0088cc"/>
                                 {unreadCounts[item.name] && <span className="unread-badge">{unreadCounts[item.name]}</span>}
                              </div>
                          </div>
                          <div className="tc-tile-bottom">{item.isGroupOrChannel ? `${item.members?.length || 0} ${item.type==='channel'?'subscribers':'members'}` : item.desc}</div>
                      </div>
                  </div>
               ))}

               {unpinnedItems.map((item, i) => (
                  <div key={'unpinned_'+i} className={`tc-chat-tile ${chatWith.name === item.name ? 'active' : ''}`} 
                       onClick={() => { pushHistoryState(); setChatWith({ name: item.name, type: item.isGroupOrChannel ? (item.type || 'group') : 'contact', pfp: item.isGroupOrChannel ? item.icon : item.pfp, desc: item.isGroupOrChannel ? `${item.members?.length || 0} ${item.type==='channel'?'subscribers':'members'}` : (item.about || "Tap to chat") }); if(item.isGroupOrChannel) setInfoTab('members'); else setInfoTab('media'); }}
                       onContextMenu={(e) => { e.preventDefault(); if(!item.isGroupOrChannel) handleRemoveContact(item.name); }}>
                      <div className={`tc-tile-avatar ${item.isGroupOrChannel ? 'group' : 'contact'}`}>{ (item.isGroupOrChannel ? item.icon : item.pfp) ? <img src={item.isGroupOrChannel ? item.icon : item.pfp} alt="DP" style={{width:'100%', height:'100%', borderRadius:'50%', objectFit:'cover'}}/> : item.name[0]?.toUpperCase() || "?"}</div>
                      <div className="tc-tile-info">
                          <div className="tc-tile-top">
                              <span className="tc-tile-name">{item.name}</span>
                              {unreadCounts[item.name] && <span className="unread-badge">{unreadCounts[item.name]}</span>}
                          </div>
                          <div className="tc-tile-bottom">
                              {item.isGroupOrChannel ? `${item.members?.length || 0} ${item.type==='channel'?'subscribers':'members'}` : item.desc}
                              {!item.isGroupOrChannel && item.name !== username && <span style={{fontSize:'10px', color:'#ff9c6e', display:'inline-flex', alignItems:'center', marginLeft:'5px'}}><IoFlashOutline/> Lv.2</span>}
                          </div>
                      </div>
                  </div>
               ))}
             </>
         )
     }
  }, [sidebarTab, username, searchQuery, safeSearchQuery, globalSearchResults, globalChannelResults, groups, contacts, chatWith, unreadCounts, pfp, archivedChats, pinnedChats]);

  // 🌟 LEADERBOARD & TOP FANS 🌟
  const leaderBoard = useMemo(() => {
    if (!currentGroup) return [];
    const memberStats = {};
    currentMessages.forEach(m => {
        if (currentGroup.members.includes(m.sender)) {
            memberStats[m.sender] = (memberStats[m.sender] || 0) + 1;
        }
    });
    return Object.entries(memberStats).sort((a,b) => b[1] - a[1]).slice(0, 3);
  }, [currentMessages, currentGroup]);
  const topFans = useMemo(() => leaderBoard.map(l => l[0]), [leaderBoard]);

  const handleScroll = (e) => {
      const { scrollTop, scrollHeight, clientHeight } = e.target;
      const isBottom = Math.abs(scrollHeight - scrollTop - clientHeight) <= 5;
      setShowScrollBtn(!isBottom);
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
    <div className={`tc-app ${isDarkMode ? 'dark-mode' : ''} ${chatWith.name !== "Select a chat" ? 'chat-active' : ''}`}>
      
      {toastMsg && <div className="tc-toast-notification">{toastMsg}</div>}

      {/* 🌟 VIBE SCREEN TAKEOVER 🌟 */}
      {activeVibe === 'party' && <div className="vibe-takeover party">🎉 LET'S PARTY! 🎊</div>}
      {activeVibe === 'shake' && <div className="vibe-takeover shake">💣 BOOM!</div>}

      {/* 🎈 LIVE FLOATING REACTIONS */}
      <div className="tc-floating-reactions-container">
          {floatingEmojis.map(item => (
              <div key={item.id} className="floating-emoji" style={{left: `${item.left}%`}}>{item.emoji}</div>
          ))}
      </div>

      {/* 🌟 Milestone Celebration Animation 🌟 */}
      {showMilestone && (
          <div className="tc-milestone-overlay">
              <div className="milestone-text">🎉 New Milestone Reached! 🎉</div>
              <div className="confetti-container">
                  {[...Array(20)].map((_, i) => <div key={i} className={`confetti-piece p-${i}`}></div>)}
              </div>
          </div>
      )}

      {/* 🌟 Poll Creator Modal 🌟 */}
      {showPollCreator && (
          <div className="tc-modal-overlay" onClick={() => {setShowPollCreator(false); window.history.back();}}>
              <div className="tc-modal" onClick={e => e.stopPropagation()}>
                  <div className="tc-modal-header">
                      <h3>Create a Poll</h3>
                      <IoCloseOutline size={28} className="tc-icon-btn" onClick={() => {setShowPollCreator(false); window.history.back();}} />
                  </div>
                  <div className="tc-settings-content">
                      <input type="text" placeholder="Ask a question..." value={pollQuestion} onChange={e => setPollQuestion(e.target.value)} className="tc-input-modern" style={{marginBottom: '15px'}} />
                      {pollOptions.map((opt, idx) => (
                          <input key={idx} type="text" placeholder={`Option ${idx + 1}`} value={opt} onChange={e => {const newOpts = [...pollOptions]; newOpts[idx] = e.target.value; setPollOptions(newOpts);}} className="tc-input-modern" style={{marginBottom: '10px'}} />
                      ))}
                      {pollOptions.length < 5 && <button className="tc-btn-secondary" style={{marginBottom: '15px', padding: '8px'}} onClick={handleAddPollOption}>+ Add Option</button>}
                      <button className="tc-btn-primary full-width" onClick={sendPoll}>Send Poll</button>
                  </div>
              </div>
          </div>
      )}

      {/* 🌟 Coming Soon Modal 🌟 */}
      {(showMonetization || showAnalytics) && (
          <div className="tc-modal-overlay" onClick={() => {setShowMonetization(false); setShowAnalytics(false); window.history.back();}}>
              <div className="tc-modal tc-coming-soon-modal" onClick={e => e.stopPropagation()}>
                  <div className="tc-modal-header" style={{borderBottom: 'none'}}>
                      <IoCloseOutline size={28} className="tc-icon-btn" style={{marginLeft: 'auto'}} onClick={() => {setShowMonetization(false); setShowAnalytics(false); window.history.back();}} />
                  </div>
                  <div className="tc-coming-soon-wrapper" style={{paddingTop: '0'}}>
                      <div className="tc-soon-icon" style={{background: 'linear-gradient(135deg, #faad14, #d48806)'}}>
                          {showMonetization ? <IoCashOutline size={50} color="#fff" /> : <IoStatsChartOutline size={50} color="#fff" />}
                      </div>
                      <h2 style={{color: isDarkMode?'white':'#333'}}>{showMonetization ? 'Monetization Studio' : 'Channel Analytics'}</h2>
                      <p style={{textAlign: 'center', color: '#888'}}>Ye feature developers aur channel admins ke liye abhi test kiya ja raha hai. <br/>Aap future updates mein ads run kar payenge!</p>
                      <div className="tc-soon-badge" style={{background: '#fffbe6', color: '#d48806', border: '1px solid #ffe58f'}}>Coming Soon 🚀</div>
                  </div>
              </div>
          </div>
      )}

      {forwardMsg && (
          <div className="tc-modal-overlay" onClick={() => {setForwardMsg(null); window.history.back();}}>
              <div className="tc-modal tc-forward-modal" onClick={e => e.stopPropagation()}>
                  <div className="tc-modal-header">
                      <h3>Forward to...</h3>
                      <IoCloseOutline size={28} className="tc-icon-btn" onClick={() => {setForwardMsg(null); window.history.back();}} />
                  </div>
                  <div className="tc-forward-list">
                      <div className="section-title">Recent Chats</div>
                      {contacts.filter(c => c.name !== username).map(c => (
                          <div key={'fwd_'+c.name} className="tc-fwd-item" onClick={() => executeForward(c)}>
                              <div className="tc-tile-avatar contact">{c.pfp ? <img src={c.pfp} alt="dp"/> : c.name[0]?.toUpperCase()}</div>
                              <span>{c.name}</span>
                          </div>
                      ))}
                      {groups.filter(g => g.members?.includes(username)).map(g => (
                          <div key={'fwd_'+g.name} className="tc-fwd-item" onClick={() => executeForward(g)}>
                              <div className="tc-tile-avatar group">{g.icon ? <img src={g.icon} alt="dp"/> : g.name[0]?.toUpperCase()}</div>
                              <span>{g.name}</span>
                          </div>
                      ))}
                  </div>
              </div>
          </div>
      )}

      {viewImage && (
          <div className="tc-image-viewer" onClick={() => { setViewImage(null); window.history.back(); }}>
              <div style={{ position: 'absolute', top: '20px', right: '20px', display: 'flex', gap: '15px' }}>
                  <button onClick={(e) => { e.stopPropagation(); downloadImage(viewImage, 'Telechat_Image.jpg'); }} style={{ background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: '50%', padding: '10px', color: 'white', cursor: 'pointer', backdropFilter: 'blur(5px)' }}>
                      <IoDownloadOutline size={28} />
                  </button>
                  <button onClick={() => { setViewImage(null); window.history.back(); }} style={{ background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: '50%', padding: '10px', color: 'white', cursor: 'pointer', backdropFilter: 'blur(5px)' }}>
                      <IoCloseOutline size={28} />
                  </button>
              </div>
              <img src={viewImage} alt="preview" onClick={(e) => e.stopPropagation()} style={{ maxHeight: '90vh', maxWidth: '90vw', objectFit: 'contain', borderRadius: '10px', boxShadow: '0 10px 30px rgba(0,0,0,0.5)' }} />
          </div>
      )}
      
      {activeStoryView && (
          <div className="tc-story-viewer" onClick={() => { setActiveStoryView(null); window.history.back(); }}>
              <div className="tc-story-progress-bar"><div className="tc-progress-fill"></div></div>
              <div className="tc-story-header">
                  <img src={activeStoryView.pfp || "https://cdn.pixabay.com/photo/2015/10/05/22/37/blank-profile-picture-973460_1280.png"} alt="dp" />
                  <span>{activeStoryView.sender}</span>
                  <IoCloseOutline size={30} onClick={() => { setActiveStoryView(null); window.history.back(); }} style={{marginLeft:'auto', cursor:'pointer'}}/>
              </div>
              <img src={activeStoryView.image} className="tc-story-main-img" alt="story" onClick={(e)=>e.stopPropagation()} />
          </div>
      )}

      {showImageEditor && (
        <div className="tc-preview-overlay">
          <div className="tc-editor-box">
             <div className="tc-editor-header">
                <h3>Edit Photo</h3>
                <IoCloseOutline size={28} style={{cursor:'pointer'}} onClick={() => {setShowImageEditor(false); setEditImageURL(null); window.history.back();}} />
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
                 
                 <div style={{display:'flex', gap:'10px', justifyContent:'center'}}>
                     <div className="tc-view-once-toggle" style={{flex: 1}} onClick={() => { setIsViewOnce(!isViewOnce); setIsSelfDestruct(false); }}>
                         {isViewOnce ? <IoEyeOutline size={20} color="#0088cc"/> : <IoEyeOffOutline size={20} color="#888"/>}
                         <span style={{ color: isViewOnce ? '#0088cc' : '#888', fontWeight: 'bold', fontSize: '13px' }}>View Once</span>
                     </div>
                     <div className="tc-view-once-toggle" style={{flex: 1}} onClick={() => { setIsSelfDestruct(!isSelfDestruct); setIsViewOnce(false); }}>
                         {isSelfDestruct ? <IoTimeOutline size={20} color="#ff4d4f"/> : <IoTimeOutline size={20} color="#888"/>}
                         <span style={{ color: isSelfDestruct ? '#ff4d4f' : '#888', fontWeight: 'bold', fontSize: '13px' }}>Self-Destruct</span>
                     </div>
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
              <button className="tc-btn-secondary" onClick={() => { setImagePreview(null); setAudioPreview(null); setPreviewCaption(''); setIsViewOnce(false); setIsSelfDestruct(false); window.history.back(); }}>Cancel</button>
              <button className="tc-btn-primary" onClick={imagePreview ? confirmSendImage : confirmSendAudio}>Send <IoPaperPlane style={{marginLeft: '5px'}}/></button>
            </div>
          </div>
        </div>
      )}

      {showSettings && (
        <div className="tc-modal-overlay" onClick={() => {setShowSettings(false); setActiveSettingMenu('main'); window.history.back();}}>
          <div className="tc-modal" onClick={(e) => e.stopPropagation()}>
            <div className="tc-modal-header">
                <h3>
                  {activeSettingMenu === 'main' ? 'Settings' : activeSettingMenu === 'blocked' ? 'Blocked Contacts' : activeSettingMenu === 'privacy' ? 'Privacy Settings' : activeSettingMenu === 'account' ? 'Account & Security' : activeSettingMenu === 'share' ? 'Share Profile' : activeSettingMenu === 'wallpaper' ? 'Chat Wallpaper' : 'Edit Profile'}
                </h3>
                <IoCloseOutline size={28} className="tc-icon-btn" onClick={() => {setShowSettings(false); window.history.back();}} />
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

      <div className={`tc-drawer-overlay ${showDrawer ? 'show' : ''}`} onClick={() => {setShowDrawer(false); window.history.back();}}>
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
                <div className="tc-drawer-item" onClick={() => { setShowDrawer(false); window.history.back(); pushHistoryState(); setChatWith({ name: username, type: 'contact', pfp: pfp, desc: "Your personal cloud storage" }); }}>
                    <IoBookmarkOutline size={22} color="#0088cc" /> <span style={{fontWeight: 'bold', color: '#0088cc'}}>Saved Messages</span>
                </div>
                <hr style={{margin: '10px 0', border: 'none', borderTop: '1px solid #eee'}} />

                <div className="tc-drawer-item" onClick={() => { setShowDrawer(false); pushHistoryState(); setShowSettings(true); setActiveSettingMenu('share'); }}><IoQrCodeOutline size={22}/> <span>Share Profile</span></div>
                
                <div className="tc-drawer-item" onClick={() => { setShowDrawer(false); pushHistoryState(); setShowNewGroup(true); setNewChatPfp(null); setCustomLink(''); }}><IoPeopleOutline size={22}/> <span>New Group</span></div>
                <div className="tc-drawer-item" onClick={() => { setShowDrawer(false); pushHistoryState(); setShowNewChannel(true); setNewChatPfp(null); setCustomLink(''); }}><IoMegaphoneOutline size={22}/> <span>New Channel</span></div>
                
                <div className="tc-drawer-item" onClick={() => { setShowDrawer(false); pushHistoryState(); setShowSettings(true); setActiveSettingMenu('main'); }}><IoSettingsOutline size={22}/> <span>Settings</span></div>
            </div>
        </div>
      </div>

      {showAddMember && (
        <div className="tc-modal-overlay" onClick={() => {setShowAddMember(false); setNewMemberName(''); window.history.back();}}>
          <div className="tc-modal" onClick={(e) => e.stopPropagation()}>
            <div className="tc-modal-header">
                <h3>Add to {chatWith.type === 'channel' ? 'Channel' : 'Group'}</h3>
                <IoCloseOutline size={28} className="tc-icon-btn" onClick={() => {setShowAddMember(false); setNewMemberName(''); window.history.back();}} />
            </div>
            <div className="tc-settings-content tc-edit-profile">
               <div className="tc-form-group" style={{ position: 'relative' }}>
                  <input type="text" value={newMemberName} onChange={(e) => setNewMemberName(e.target.value)} className="tc-input-modern" placeholder="Search contact to add..." autoFocus />
                  
                  {newMemberName.trim().length > 0 && (
                     <div style={{ position: 'absolute', top: '100%', left: 0, width: '100%', background: isDarkMode ? '#1e1e1e' : 'white', border: `1px solid ${isDarkMode ? '#333' : '#ddd'}`, borderRadius: '8px', zIndex: 10, maxHeight: '150px', overflowY: 'auto', boxShadow: '0 4px 10px rgba(0,0,0,0.1)', marginTop: '5px' }}>
                         {contacts.filter(c => c.name.toLowerCase().includes(newMemberName.toLowerCase()) && !currentGroup?.members?.includes(c.name)).map(c => (
                                 <div key={'add_sugg_'+c.name} style={{ padding: '10px 15px', borderBottom: `1px solid ${isDarkMode ? '#333' : '#eee'}`, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px' }} onClick={() => setNewMemberName(c.name)}>
                                     <div style={{ width: '30px', height: '30px', borderRadius: '50%', background: '#0088cc', display: 'flex', justifyContent: 'center', alignItems: 'center', color: 'white', fontSize: '12px' }}>
                                         {c.pfp ? <img src={c.pfp} alt="dp" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} /> : c.name[0]?.toUpperCase()}
                                     </div>
                                     <span style={{ color: isDarkMode ? '#ccc' : '#333', fontWeight: '500' }}>{c.name}</span>
                                 </div>
                         ))}
                         {contacts.filter(c => c.name.toLowerCase().includes(newMemberName.toLowerCase()) && !currentGroup?.members?.includes(c.name)).length === 0 && (
                             <div style={{ padding: '10px', textAlign: 'center', color: '#888', fontSize: '12px' }}>No matching contacts found.</div>
                         )}
                     </div>
                  )}
               </div>
               
               <div className="tc-btn-row" style={{ marginTop: '20px' }}>
                   <button className="tc-btn-secondary" onClick={() => {setShowAddMember(false); setNewMemberName(''); window.history.back();}}>Cancel</button>
                   <button className="tc-btn-primary" onClick={handleAddMember}>Add</button>
               </div>
            </div>
          </div>
        </div>
      )}

      {showNewGroup && (
        <div className="tc-modal-overlay" onClick={() => {setShowNewGroup(false); setNewChatPfp(null); window.history.back();}}>
          <div className="tc-modal" onClick={(e) => e.stopPropagation()}>
            <div className="tc-modal-header">
                <h3>Create Group</h3>
                <IoCloseOutline size={28} className="tc-icon-btn" onClick={() => {setShowNewGroup(false); setNewChatPfp(null); window.history.back();}} />
            </div>
            <div className="tc-settings-content tc-edit-profile">
               
               <div className="tc-avatar-edit-container" style={{marginBottom: '15px'}}>
                   <div className="tc-avatar-xxl">
                      {newChatPfp ? <img src={newChatPfp} alt="dp" /> : <IoPeopleOutline size={40} color="#ccc" />}
                      <label htmlFor="new-group-pfp" className="tc-avatar-overlay"><IoCameraOutline size={32} color="white"/></label>
                      <input type="file" id="new-group-pfp" onChange={handleNewChatPfpUpload} style={{display:'none'}} accept="image/*" />
                   </div>
               </div>

               <div className="tc-form-group">
                  <input type="text" value={newGroupName} onChange={(e) => setNewGroupName(e.target.value)} className="tc-input-modern" placeholder="Group Name" autoFocus />
               </div>

               <div className="tc-channel-privacy-selector" style={{ display: 'flex', gap: '20px', margin: '15px 0', justifyContent: 'center' }}>
                   <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                       <input type="radio" name="grpPrivacy" checked={isPublicChannel === true} onChange={() => setIsPublicChannel(true)} />
                       <span><strong>Public</strong></span>
                   </label>
                   <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                       <input type="radio" name="grpPrivacy" checked={isPublicChannel === false} onChange={() => setIsPublicChannel(false)} />
                       <span><strong>Private</strong></span>
                   </label>
               </div>

               {isPublicChannel ? (
                   <div className="tc-form-group">
                      <div className="tc-input-prefix-wrapper" style={{display:'flex', alignItems:'center', background: isDarkMode?'#2a2a2a':'#f9f9f9', border:`1px solid ${isDarkMode?'#444':'#ddd'}`, borderRadius:'12px', overflow:'hidden'}}>
                          <span style={{padding: '0 10px', color: '#888', fontSize:'14px'}}>telechat.com/c/</span>
                          <input type="text" value={customLink} onChange={(e) => setCustomLink(e.target.value)} style={{flex: 1, border: 'none', outline: 'none', background: 'transparent', padding: '12px 0', color: isDarkMode?'white':'#333'}} placeholder="custom_name" />
                      </div>
                   </div>
               ) : (
                   <div className="tc-form-group" style={{textAlign: 'left'}}>
                       <label style={{display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer'}}>
                           <input type="checkbox" checked={requireApproval} onChange={(e) => setRequireApproval(e.target.checked)} style={{width: '18px', height: '18px'}} />
                           <span>Require Admin Approval for new members</span>
                       </label>
                   </div>
               )}

               <div className="tc-btn-row" style={{marginTop:'20px'}}>
                   <button className="tc-btn-secondary" onClick={() => {setShowNewGroup(false); setNewChatPfp(null); window.history.back();}}>Cancel</button>
                   <button className="tc-btn-primary" onClick={createNewGroup}>Create</button>
               </div>
            </div>
          </div>
        </div>
      )}

      {showNewChannel && (
        <div className="tc-modal-overlay" onClick={() => {setShowNewChannel(false); setNewChatPfp(null); window.history.back();}}>
          <div className="tc-modal" onClick={(e) => e.stopPropagation()}>
            <div className="tc-modal-header">
                <h3>Create Channel</h3>
                <IoCloseOutline size={28} className="tc-icon-btn" onClick={() => {setShowNewChannel(false); setNewChatPfp(null); window.history.back();}} />
            </div>
            <div className="tc-settings-content tc-edit-profile">
               
               <div className="tc-avatar-edit-container" style={{marginBottom: '15px'}}>
                   <div className="tc-avatar-xxl">
                      {newChatPfp ? <img src={newChatPfp} alt="dp" /> : <IoMegaphoneOutline size={40} color="#ccc" />}
                      <label htmlFor="new-chan-pfp" className="tc-avatar-overlay"><IoCameraOutline size={32} color="white"/></label>
                      <input type="file" id="new-chan-pfp" onChange={handleNewChatPfpUpload} style={{display:'none'}} accept="image/*" />
                   </div>
               </div>

               <div className="tc-form-group">
                  <input type="text" value={newChannelName} onChange={(e) => setNewChannelName(e.target.value)} className="tc-input-modern" placeholder="Channel Name" autoFocus />
               </div>
               
               <div className="tc-channel-privacy-selector" style={{ display: 'flex', gap: '20px', margin: '15px 0', justifyContent: 'center' }}>
                   <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                       <input type="radio" name="chanPrivacy" checked={isPublicChannel === true} onChange={() => setIsPublicChannel(true)} />
                       <span><strong>Public</strong></span>
                   </label>
                   <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                       <input type="radio" name="chanPrivacy" checked={isPublicChannel === false} onChange={() => setIsPublicChannel(false)} />
                       <span><strong>Private</strong></span>
                   </label>
               </div>

               {isPublicChannel ? (
                   <div className="tc-form-group">
                      <div className="tc-input-prefix-wrapper" style={{display:'flex', alignItems:'center', background: isDarkMode?'#2a2a2a':'#f9f9f9', border:`1px solid ${isDarkMode?'#444':'#ddd'}`, borderRadius:'12px', overflow:'hidden'}}>
                          <span style={{padding: '0 10px', color: '#888', fontSize:'14px'}}>telechat.com/c/</span>
                          <input type="text" value={customLink} onChange={(e) => setCustomLink(e.target.value)} style={{flex: 1, border: 'none', outline: 'none', background: 'transparent', padding: '12px 0', color: isDarkMode?'white':'#333'}} placeholder="custom_name" />
                      </div>
                      <p style={{fontSize: '11px', color: '#888', textAlign: 'left', marginTop: '5px'}}>Anyone can find this channel in search.</p>
                   </div>
               ) : (
                   <div className="tc-form-group" style={{textAlign: 'left'}}>
                       <label style={{display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer'}}>
                           <input type="checkbox" checked={requireApproval} onChange={(e) => setRequireApproval(e.target.checked)} style={{width: '18px', height: '18px'}} />
                           <span>Require Admin Approval for new subscribers</span>
                       </label>
                       <p style={{fontSize: '11px', color: '#888', marginTop: '5px'}}>People can only join via invite link.</p>
                   </div>
               )}

               <div className="tc-btn-row" style={{ marginTop: '20px' }}>
                   <button className="tc-btn-secondary" onClick={() => {setShowNewChannel(false); setNewChatPfp(null); window.history.back();}}>Cancel</button>
                   <button className="tc-btn-primary" onClick={createNewChannel}>Create</button>
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
                <div key={s.id} className="tc-story-item" onClick={() => {pushHistoryState(); setActiveStoryView(s);}}>
                   <div className="tc-story-avatar-wrap active-border"><img src={s.pfp || "https://cdn.pixabay.com/photo/2015/10/05/22/37/blank-profile-picture-973460_1280.png"} alt="dp" /></div>
                   <span>{s.sender}</span>
                </div>
             ))}
          </div>

          <div className="tc-sidebar-search">
             <IoMenu size={32} className="tc-hamburger" onClick={() => {pushHistoryState(); setShowDrawer(true);}} />
             <div className="tc-search-wrapper">
                 <IoSearchOutline className="tc-search-icon" size={20} />
                 <input type="text" placeholder="Search users & public channels..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
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
                <div className="tc-mobile-back" onClick={() => { window.history.back(); setChatWith({ name: "Select a chat", type: "contact", pfp: null, desc: "" }); setShowChatInfo(false); }}>
                    <IoArrowUndoOutline size={26} />
                </div>

                <div className="tc-header-profile" onClick={() => chatWith.name !== username && setShowChatInfo(true)} style={{ cursor: chatWith.name === username ? 'default' : 'pointer' }}>
                    <div className="tc-header-avatar">
                        {chatWith.name === username ? <IoBookmarkOutline size={26} color="#0088cc"/> : (chatWith.pfp ? <img src={chatWith.pfp} alt="pfp" /> : chatWith.name[0]?.toUpperCase() || "?")}
                    </div>
                    <div className="tc-header-text">
                        <h3 style={{display:'flex', alignItems:'center', gap:'5px'}}>
                            {chatWith.name === username ? "Saved Messages" : chatWith.name} 
                            {isBlocked && <span style={{fontSize:'12px', color:'red'}}>(Blocked)</span>}
                        </h3>
                        {displayStatus === 'Typing...' ? ( <span className="tc-typing-indicator">Typing<span>.</span><span>.</span><span>.</span></span> ) : ( <span className="tc-status">{displayStatus}</span> )}
                    </div>
                </div>
                <div className="tc-header-actions" style={{position: 'relative'}}>
                    {chatWith.type === 'channel' ? (
                        <div className="tc-h-icon" onClick={() => { setIsMuted(!isMuted); showToast(isMuted ? "Channel Unmuted 🔊" : "Channel Muted 🔕"); }}>
                            {isMuted ? <IoVolumeMuteOutline size={24} color="red" /> : <IoVolumeHighOutline size={24} />}
                        </div>
                    ) : (
                        <>
                          <IoCallOutline size={22} className={`tc-h-icon ${chatWith.name === "Select a chat" || chatWith.name === username ? 'disabled':''}`} onClick={() => chatWith.name !== "Select a chat" && chatWith.name !== username && showToast("📞 Voice Calls are coming in the next update!")} />
                          <IoVideocamOutline size={24} className={`tc-h-icon ${chatWith.name === "Select a chat" || chatWith.name === username ? 'disabled':''}`} onClick={() => chatWith.name !== "Select a chat" && chatWith.name !== username && showToast("🎥 Video Calls are coming in the next update!")} />
                        </>
                    )}
                    
                    <IoEllipsisVertical size={24} className="tc-h-icon" onClick={() => chatWith.name !== "Select a chat" && setShowMenuDropdown(!showMenuDropdown)} />
                    {showMenuDropdown && (
                        <div className="tc-dropdown-menu">
                           
                           {chatWith.name !== "Select a chat" && (
                               <div onClick={() => { togglePinChat(chatWith.name); setShowMenuDropdown(false); }}>
                                   {pinnedChats.includes(chatWith.name) ? 'Unpin from Top' : 'Pin to Top'}
                               </div>
                           )}

                           {chatWith.name !== username && chatWith.name !== "Select a chat" && (
                               <div onClick={() => { toggleArchive(chatWith.name); setShowMenuDropdown(false); }}>
                                   {archivedChats.includes(chatWith.name) ? 'Unarchive Chat' : 'Archive Chat'}
                               </div>
                           )}
                           {chatWith.name !== username && <div onClick={() => { pushHistoryState(); setShowChatInfo(true); setShowMenuDropdown(false); }}>Contact Info</div>}
                           <div onClick={() => { clearChat(); setShowMenuDropdown(false); }}>Clear Chat</div>
                           {chatWith.type === 'contact' && chatWith.name !== username && (<div className="tc-danger-text" onClick={() => { handleRemoveContact(chatWith.name); setShowMenuDropdown(false); }}>Remove Contact</div>)}
                        </div>
                    )}
                </div>
            </div>
            
            <div className="tc-messages-area" onScroll={handleScroll} onClick={()=> { setShowMenuDropdown(false); setActiveReactionMsg(null); setShowMagicMenu(false); }} style={{ background: chatWallpaper !== 'none' ? chatWallpaper : '' }}>
                
                {/* 🌟 Spotlight Feature 🌟 */}
                {!hidePinnedMessage && (chatWith.type === 'channel' || chatWith.type === 'group') && pinnedMessages.length > 0 && (
                    <div className="tc-spotlight-banner">
                       <div className="spotlight-content" onClick={scrollToBottom}>
                           <div className="spotlight-title"><IoMegaphoneOutline size={14}/> Spotlight ({spotlightIndex + 1}/{pinnedMessages.length})</div>
                           <div className="spotlight-text">{pinnedMessages[spotlightIndex].text ? pinnedMessages[spotlightIndex].text.substring(0,60) + '...' : 'Media Attachment'}</div>
                       </div>
                       {pinnedMessages.length > 1 && (
                           <div className="spotlight-nav">
                               <IoChevronBackOutline size={20} onClick={(e) => { e.stopPropagation(); setSpotlightIndex((prev) => prev === 0 ? pinnedMessages.length - 1 : prev - 1); }} />
                               <IoChevronForwardOutline size={20} onClick={(e) => { e.stopPropagation(); setSpotlightIndex((prev) => (prev + 1) % pinnedMessages.length); }} />
                           </div>
                       )}
                    </div>
                )}

                {/* MEMOIZED MESSAGES */}
                {chatWith.name === "Select a chat" ? (
                    <div className="tc-empty-state">Welcome to Telechat! Select a chat to start messaging. ✨</div>
                ) : currentMessages.length === 0 ? (
                    <div className="tc-empty-state">{chatWith.name === username ? "Save your notes, links, and media here. Everything is synced securely. ☁️" : "No messages yet. Start the conversation! 💬"}</div>
                ) : (
                    currentMessages.map(msg => (
                        <MessageBubble 
                            key={msg.id}
                            msg={msg}
                            username={username}
                            chatWith={chatWith}
                            currentGroup={currentGroup}
                            isElite={topFans.includes(msg.sender) && (chatWith.type === 'group' || chatWith.type === 'channel')}
                            isBroadcast={chatWith.type === 'channel' && currentGroup?.admin === msg.sender && !msg.isSilent}
                            reactionEmojis={reactionEmojis}
                            handleReaction={handleReaction}
                            handlePinMessage={handlePinMessage}
                            setForwardMsg={setForwardMsg}
                            pushHistoryState={pushHistoryState}
                            downloadImage={downloadImage}
                            copyToClipboard={copyToClipboard}
                            speakText={speakText}
                            setActiveReactionMsg={setActiveReactionMsg}
                            activeReactionMsg={activeReactionMsg}
                            setReplyTo={setReplyTo}
                            handleReactionSelect={handleReactionSelect}
                            handleViewOnceClick={handleViewOnceClick}
                            setViewImage={setViewImage}
                        />
                    ))
                )}
                
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
                ) : !isChannelOrGroupMember ? (
                   <button className="tc-btn-primary full-width" onClick={joinPublicChannel} style={{ padding: '16px', fontSize: '16px', fontWeight: 'bold', borderRadius: '12px', cursor: 'pointer' }}>
                       JOIN CHANNEL 📢
                   </button>
                ) : chatWith.type === 'channel' && currentGroup?.admin !== username ? (
                   <div className="tc-blocked-banner">📢 Only Admins can send messages here.</div>
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
                        
                        {/* 🌟 Magic Menu Toggle 🌟 */}
                        <div className="tc-input-action" onClick={() => setShowMagicMenu(!showMagicMenu)}><IoAddCircle size={28} color="#0088cc" /></div>

                        {showMagicMenu && (
                          <div className="magic-menu">
                              <label htmlFor="tc-upload" style={{margin:0, padding:0}}><div style={{width:'100%'}}><IoAttach/> Photo/Video</div></label>
                              <input type="file" id="tc-upload" onChange={handleImageSelect} style={{display: 'none'}} />
                              {(chatWith.type === 'group' || chatWith.type === 'channel') && <div onClick={() => {setShowMagicMenu(false); pushHistoryState(); setShowPollCreator(true);}}><IoBarChartOutline/> Poll</div>}
                              {(chatWith.type === 'channel' || chatWith.type === 'group') && currentGroup?.admin === username && <div onClick={() => {setShowMagicMenu(false); const msg = prompt("Enter text for Locked Post (Users must react to read):"); if(msg) sendMessage(null, {text: msg, isLocked: true});}}><IoLockClosedOutline/> Secret Post</div>}
                              <div onClick={() => {setShowMagicMenu(false); sendMessage(null, {text: "🎉 Just dropped a vibe!", vibe: "party"});}}><IoRocketOutline/> Party Vibe</div>
                              <div onClick={() => {setShowMagicMenu(false); sendMessage(null, {text: "💣 Shook the screen!", vibe: "shake"});}}><IoFlashOutline/> Shake Vibe</div>
                              {chatWith.type === 'contact' && <div onClick={() => {setShowMagicMenu(false); const msg = prompt("Enter mystery message:"); if(msg) sendMessage(null, {text: msg, isMystery: true});}}><IoHelpCircleOutline/> Mystery Drop</div>}
                          </div>
                        )}
                        
                        {chatWith.type === 'channel' && currentGroup?.admin === username && (
                            <div className="tc-input-action" onClick={() => {setIsSilentBroadcast(!isSilentBroadcast); showToast(isSilentBroadcast ? "Normal Mode 🔊" : "Silent Broadcast 🔕");}} style={{marginRight: '5px'}}>
                                {isSilentBroadcast ? <IoNotificationsOffOutline size={24} color="#888" title="Silent Broadcast"/> : <IoMegaphoneOutline size={24} color="#0088cc" title="Normal Broadcast"/>}
                            </div>
                        )}

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
                                <input type="text" value={input} onChange={handleInputChange} placeholder={chatWith.type === 'channel' ? "Broadcast a message to channel..." : "Type a message..."} className="tc-main-input" />
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
              <div className="tc-chat-sidebar tc-chat-info-sidebar">
                 <div className="tc-chat-info-header">
                    <IoCloseOutline size={28} onClick={() => {setShowChatInfo(false); window.history.back();}} style={{cursor: 'pointer'}} />
                    <h3>{(chatWith.type === 'group' || chatWith.type === 'channel') ? 'Info' : 'Contact Info'}</h3>
                 </div>
                 <div className="tc-chat-info-body">
                    <div className="tc-chat-info-avatar" style={{position: 'relative'}}>
                       {chatWith.pfp ? <img src={chatWith.pfp} alt="profile" /> : chatWith.name[0]?.toUpperCase() || "?"}
                       {(chatWith.type === 'group' || chatWith.type === 'channel') && currentGroup?.admin === username && (
                         <><label htmlFor="group-dp-upload" className="tc-group-dp-overlay"><IoCameraOutline size={28} color="white"/></label><input type="file" id="group-dp-upload" onChange={handleGroupAvatarUpload} style={{display: 'none'}} /></>
                       )}
                    </div>
                    <h2 style={{margin: '0 0 5px 0', fontSize: '22px'}}>{chatWith.name}</h2>
                    
                    {(chatWith.type === 'channel' || chatWith.type === 'group') && (
                        <div style={{background: isDarkMode ? '#1e1e1e' : '#f4f6f8', padding: '10px 15px', borderRadius: '10px', marginTop: '10px', fontSize: '13px', width: '90%', textAlign: 'center'}}>
                            <span style={{fontWeight: 'bold', color: '#0088cc', display: 'block', marginBottom: '4px'}}>About</span>
                            {chatWith.desc || "Welcome to our chat! Be respectful to everyone."}
                        </div>
                    )}

                    {/* 🌟 Coming Soon Buttons For Monetization 🌟 */}
                    {chatWith.type === 'channel' && currentGroup?.admin === username && (
                        <div style={{display:'flex', gap:'10px', width:'90%', marginTop:'15px'}}>
                            <button className="tc-action-btn-primary" style={{flex:1, background:'#fff3bf', color:'#d48806', border:'1px solid #ffe066', padding:'10px'}} onClick={() => {pushHistoryState(); setShowMonetization(true);}}>
                               <IoCashOutline size={20} style={{marginRight:'5px'}}/> Earn/Promote
                            </button>
                            <button className="tc-action-btn-primary" style={{flex:1, background:'#e3fafc', color:'#0b7285', border:'1px solid #99e9f2', padding:'10px'}} onClick={() => {pushHistoryState(); setShowAnalytics(true);}}>
                               <IoStatsChartOutline size={20} style={{marginRight:'5px'}}/> Analytics
                            </button>
                        </div>
                    )}
                    
                    <div className="tc-chat-info-tabs" style={{ marginTop: '20px' }}>
                       <div className={infoTab === 'media' ? 'active' : ''} onClick={() => setInfoTab('media')}><IoImageOutline size={20}/> Media</div>
                       {(chatWith.type === 'group' || chatWith.type === 'channel') && (<div className={infoTab === 'members' ? 'active' : ''} onClick={() => setInfoTab('members')}><IoPeopleOutline size={20}/> {chatWith.type==='channel'?'Subscribers':'Members'}</div>)}
                    </div>
                    <div className="tc-chat-info-content" style={{width: '100%'}}>
                       
                       {infoTab === 'media' && (mediaMessages.length > 0 ? (<div className="tc-media-grid">{mediaMessages.map(m => (<img key={m.id} src={m.image} onClick={() => {pushHistoryState(); setViewImage(m.image);}} alt="media" />))}</div>) : (<div className="tc-empty-info">No media shared yet.</div>))}
                       
                       {infoTab === 'members' && currentGroup && (
                           <div className="tc-members-list" style={{width: '100%', marginTop: '10px'}}>
                               
                               {/* 🌟 NEW: Leaderboard Bonus Feature 🌟 */}
                               {leaderBoard.length > 0 && (
                                   <div className="tc-leaderboard" style={{background: isDarkMode?'#1e1e1e':'linear-gradient(135deg, #fffbe6, #fff1b8)', padding: '15px', borderRadius: '12px', marginBottom: '20px', border: isDarkMode?'1px solid #333':'1px solid #ffe58f'}}>
                                       <h4 style={{margin: '0 0 10px 0', color: '#d48806', display: 'flex', alignItems: 'center', gap: '5px'}}><IoRocketOutline size={18}/> Top Active Members</h4>
                                       {leaderBoard.map((stat, idx) => (
                                           <div key={'lb_'+idx} style={{display: 'flex', justifyContent: 'space-between', fontSize: '13px', padding: '5px 0', borderBottom: idx!==leaderBoard.length-1?'1px solid rgba(0,0,0,0.05)':'none'}}>
                                               <span style={{fontWeight: 'bold', color: isDarkMode?'#ccc':'#555'}}>#{idx+1} {stat[0]} {stat[0] === username ? '(You)' : ''}</span>
                                               <span style={{color: '#888'}}>{stat[1]} msgs</span>
                                           </div>
                                       ))}
                                   </div>
                               )}

                               {currentGroup.admin === username && currentGroup.pendingMembers?.length > 0 && (
                                   <div className="tc-pending-section" style={{marginBottom: '20px', background: isDarkMode?'#1e1e1e':'#fff9e6', border: `1px solid ${isDarkMode?'#333':'#ffe58f'}`, borderRadius: '10px', padding: '10px'}}>
                                       <h4 style={{margin: '0 0 10px 0', color: '#d48806', fontSize: '13px'}}>Pending Join Requests ({currentGroup.pendingMembers.length})</h4>
                                       {currentGroup.pendingMembers.map(pending => (
                                           <div key={'req_'+pending} style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px', fontSize: '14px'}}>
                                               <span style={{fontWeight: 'bold'}}>{pending}</span>
                                               <div style={{display:'flex', gap:'5px'}}>
                                                   <button onClick={()=>approveUser(pending)} style={{background:'#25D366', color:'white', border:'none', padding:'4px 8px', borderRadius:'5px', cursor:'pointer', fontSize:'12px'}}>Approve</button>
                                                   <button onClick={()=>rejectUser(pending)} style={{background:'#ff4d4f', color:'white', border:'none', padding:'4px 8px', borderRadius:'5px', cursor:'pointer', fontSize:'12px'}}>Decline</button>
                                               </div>
                                           </div>
                                       ))}
                                   </div>
                               )}

                               <div style={{fontWeight: 'bold', marginBottom: '10px', color: '#888', fontSize: '12px', textTransform: 'uppercase'}}>{currentGroup.members.length} {chatWith.type === 'channel' ? 'Subscribers' : 'Members'}</div>
                               
                               {currentGroup.members.map((member, idx) => (
                                   <div key={idx} style={{display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 0', borderBottom: `1px solid ${isDarkMode ? '#333' : '#eee'}`}}>
                                       <div style={{width: '35px', height: '35px', borderRadius: '50%', background: 'linear-gradient(135deg, #0088cc, #005580)', color: 'white', display: 'flex', justifyContent: 'center', alignItems: 'center', fontWeight: 'bold'}}>{member[0].toUpperCase()}</div>
                                       <div style={{flex: 1, display: 'flex', flexDirection: 'column'}}>
                                           <span style={{fontWeight: 'bold', color: isDarkMode ? '#ccc' : '#333'}}>{member} {member === username ? '(You)' : ''}</span>
                                           {currentGroup.admin === member && <span style={{fontSize: '11px', color: '#4dabf7', fontWeight: 'bold'}}>Admin</span>}
                                       </div>
                                       {currentGroup.admin === username && member !== username && (
                                           <div onClick={() => handleRemoveMember(member)} style={{background: 'rgba(255,77,79,0.1)', padding: '6px', borderRadius: '50%', cursor: 'pointer', transition: '0.2s'}}>
                                              <IoTrashOutline size={18} color="#ff4d4f" title={`Remove ${member}`} />
                                           </div>
                                       )}
                                   </div>
                               ))}
                           </div>
                       )}

                       {(chatWith.type === 'group' || chatWith.type === 'channel') && (
                           <div className="tc-chat-info-actions" style={{marginTop: '25px', display:'flex', flexDirection:'column', gap:'10px', width: '100%'}}>
                               
                               <button className="tc-action-btn-primary" onClick={copyChannelLink}>
                                   <IoShareSocialOutline size={20} style={{marginRight: '8px'}}/> Share Link
                               </button>
                               
                               {currentGroup?.admin === username && (
                                   <button className="tc-action-btn-primary" onClick={() => {pushHistoryState(); setShowAddMember(true);}}>
                                       <IoAddCircle size={20} style={{marginRight: '8px'}}/> Add {chatWith.type === 'channel' ? 'Subscriber' : 'Member'}
                                   </button>
                               )}

                               {currentGroup?.admin === username ? (
                                   <button className="tc-action-btn-danger" onClick={handleDeleteGroupOrChannel}>
                                       <IoTrashOutline size={20} style={{marginRight: '8px'}}/> Delete {chatWith.type === 'channel' ? 'Channel' : 'Group'}
                                   </button>
                               ) : (
                                   <button className="tc-action-btn-danger" onClick={handleLeaveGroupOrChannel}>
                                       <IoLogOutOutline size={20} style={{marginRight: '8px'}}/> Leave {chatWith.type === 'channel' ? 'Channel' : 'Group'}
                                   </button>
                               )}
                           </div>
                       )}

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

        /* 🌟 NEW: Broadcast CSS Animations 🌟 */
        .tc-broadcast-highlight { border: 2px solid #faad14 !important; animation: pulseGlow 2.5s infinite; }
        @keyframes pulseGlow { 0% { box-shadow: 0 0 5px rgba(250, 173, 20, 0.2); } 50% { box-shadow: 0 0 20px rgba(250, 173, 20, 0.6); } 100% { box-shadow: 0 0 5px rgba(250, 173, 20, 0.2); } }

        /* ✨ CSS FOR NEW ADDICTIVE FEATURES ✨ */
        .tc-spotlight-banner { position: sticky; top: 0; z-index: 10; background: linear-gradient(90deg, #e6f7ff, #bae0ff); padding: 8px 15px; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #91caff; cursor: pointer; box-shadow: 0 2px 10px rgba(0,136,204,0.1); }
        .dark-mode .tc-spotlight-banner { background: linear-gradient(90deg, #112a45, #001529); border-color: #003a8c; }
        .spotlight-content { flex: 1; display: flex; flex-direction: column; }
        .spotlight-title { color: #0050b3; font-weight: bold; font-size: 12px; display: flex; align-items: center; gap: 5px; }
        .dark-mode .spotlight-title { color: #69c0ff; }
        .spotlight-text { font-size: 13px; color: #333; margin-top: 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 90%; }
        .dark-mode .spotlight-text { color: #ccc; }
        .spotlight-nav { display: flex; gap: 10px; color: #0050b3; }
        .spotlight-nav svg { cursor: pointer; background: rgba(255,255,255,0.5); border-radius: 50%; padding: 2px; transition:0.2s; }
        .spotlight-nav svg:hover { background: rgba(255,255,255,0.8); }

        .tc-poll-container { background: rgba(0,0,0,0.03); border: 1px solid rgba(0,0,0,0.05); padding: 12px; border-radius: 12px; min-width: 200px; margin-top: 5px; }
        .dark-mode .tc-poll-container { background: rgba(255,255,255,0.05); border-color: rgba(255,255,255,0.1); }
        .tc-poll-question { font-weight: bold; margin-bottom: 10px; display: flex; align-items: center; gap: 8px; color: #0088cc; }
        .tc-poll-option { position: relative; background: rgba(0,0,0,0.05); padding: 10px; border-radius: 8px; margin-bottom: 6px; cursor: pointer; overflow: hidden; display: flex; justify-content: space-between; transition: 0.2s; }
        .tc-poll-option:hover { background: rgba(0,0,0,0.1); }
        .tc-poll-option.voted { border: 1px solid #0088cc; font-weight: bold; }
        .tc-poll-bg { position: absolute; left: 0; top: 0; height: 100%; background: rgba(0, 136, 204, 0.2); z-index: 1; transition: width 0.4s ease-out; }
        .tc-poll-text { position: relative; z-index: 2; }
        .tc-poll-percent { position: relative; z-index: 2; font-size: 12px; color: #555; }
        .tc-poll-total { font-size: 11px; color: #888; text-align: right; margin-top: 5px; }

        /* Magic Menu */
        .magic-menu { position: absolute; bottom: 70px; left: 15px; background: white; box-shadow: 0 10px 30px rgba(0,0,0,0.2); border-radius: 15px; padding: 10px; z-index: 100; animation: popIn 0.2s ease; display: flex; flex-direction: column; gap: 5px; width: 180px; }
        .dark-mode .magic-menu { background: #1e1e1e; border: 1px solid #333; }
        .magic-menu div { padding: 10px; font-weight: 500; cursor: pointer; display: flex; align-items: center; gap: 10px; border-radius: 8px; transition: 0.2s; color: #333; }
        .dark-mode .magic-menu div { color: #ccc; }
        .magic-menu div:hover { background: #f0f7ff; color: #0088cc; }
        .dark-mode .magic-menu div:hover { background: #2a2a2a; color: #4dabf7; }
        
        /* Mystery Bubble */
        .mystery-bubble { background: linear-gradient(135deg, #2b2b2b, #1a1a1a) !important; color: white !important; border: 1px solid #444; font-style: italic; box-shadow: 0 5px 15px rgba(0,0,0,0.3); }
        .mystery-bubble .tc-msg-text { color: white !important; }

        /* Locked Post Additions */
        .locked-bubble { background: linear-gradient(135deg, #fffbe6, #fff1b8) !important; border: 1px solid #ffe58f !important; }
        .dark-mode .locked-bubble { background: linear-gradient(135deg, #433306, #2b2004) !important; border: 1px solid #5c450a !important; }
        .tc-locked-content { display: flex; flex-direction: column; align-items: center; gap: 10px; padding: 15px 20px; font-weight: bold; color: #d48806; cursor: pointer; text-align: center; }
        .tc-locked-content:hover { filter: brightness(1.1); }
        
        /* Vibes Takeover */
        .vibe-takeover { position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; z-index: 999999; display: flex; justify-content: center; align-items: center; font-size: 50px; font-weight: 900; color: white; pointer-events: none; text-shadow: 0 10px 30px rgba(0,0,0,0.5); text-align: center; }
        .vibe-takeover.party { background: rgba(0,0,0,0.5); animation: rainbow 0.5s infinite, pop 0.5s ease; }
        .vibe-takeover.shake { background: rgba(255,0,0,0.4); animation: earthquake 0.1s infinite; }
        @keyframes rainbow { 0% { color: #ff4d4f; } 33% { color: #52c41a; } 66% { color: #1890ff; } 100% { color: #faad14; } }
        @keyframes earthquake { 0% { transform: translate(10px, 10px); } 25% { transform: translate(-10px, -10px); } 50% { transform: translate(10px, -10px); } 75% { transform: translate(-10px, 10px); } 100% { transform: translate(0, 0); } }

        /* Floating Reactions */
        .tc-floating-reactions-container { position: fixed; bottom: 80px; left: 0; width: 100vw; height: 50vh; pointer-events: none; z-index: 900; overflow: hidden; }
        .floating-emoji { position: absolute; bottom: 0; font-size: 30px; animation: floatEmoji 2s ease-out forwards; opacity: 1; }
        @keyframes floatEmoji { 0% { transform: translateY(0) scale(0.5); opacity: 1; } 50% { transform: translateY(-30vh) scale(1.5); opacity: 1; } 100% { transform: translateY(-50vh) scale(1); opacity: 0; } }

        .tc-milestone-overlay { position: absolute; top: 65px; left: 0; width: 100%; height: calc(100% - 65px); pointer-events: none; z-index: 50; display: flex; justify-content: center; overflow: hidden; }
        .milestone-text { position: absolute; top: 20px; background: linear-gradient(45deg, #ff4d4f, #faad14, #52c41a, #1890ff); -webkit-background-clip: text; color: transparent; font-size: 24px; font-weight: bold; animation: popInCenter 0.5s ease-out, floatUp 4s forwards; text-shadow: 0 0 10px rgba(255,255,255,0.5); }
        @keyframes popInCenter { 0% { transform: scale(0.5); opacity: 0; } 100% { transform: scale(1); opacity: 1; } }
        @keyframes floatUp { 0% { top: 20px; opacity: 1; } 80% { opacity: 1; } 100% { top: -50px; opacity: 0; } }
        .confetti-container { position: absolute; width: 100%; height: 100%; }
        .confetti-piece { position: absolute; width: 10px; height: 10px; background: #faad14; opacity: 0; animation: fall 3s linear forwards; }
        .confetti-piece:nth-child(even) { background: #1890ff; border-radius: 50%; }
        .confetti-piece:nth-child(3n) { background: #ff4d4f; }
        @keyframes fall { 0% { transform: translateY(-20px) rotate(0deg); opacity: 1; } 100% { transform: translateY(100vh) rotate(360deg); opacity: 0; } }
        .p-0 { left: 5%; animation-delay: 0s; } .p-1 { left: 15%; animation-delay: 0.2s; } .p-2 { left: 25%; animation-delay: 0.1s; } .p-3 { left: 35%; animation-delay: 0.3s; }
        .p-4 { left: 45%; animation-delay: 0.5s; } .p-5 { left: 55%; animation-delay: 0.1s; } .p-6 { left: 65%; animation-delay: 0.4s; } .p-7 { left: 75%; animation-delay: 0.2s; }
        .p-8 { left: 85%; animation-delay: 0.6s; } .p-9 { left: 95%; animation-delay: 0.3s; } .p-10 { left: 10%; animation-delay: 0.7s; } .p-11 { left: 20%; animation-delay: 0.4s; }

        .tc-coming-soon-wrapper { padding: 40px 20px; text-align: center; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; color: #555; }
        .dark-mode .tc-coming-soon-wrapper { color: #ccc; }
        .tc-soon-icon { width: 100px; height: 100px; background: linear-gradient(135deg, #0088cc, #005580); border-radius: 50%; display: flex; justify-content: center; align-items: center; margin-bottom: 20px; box-shadow: 0 10px 20px rgba(0, 136, 204, 0.3); animation: floatIcon 3s ease-in-out infinite; }
        @keyframes floatIcon { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-10px); } }
        .tc-soon-badge { margin-top: 20px; background: rgba(0, 136, 204, 0.1); color: #0088cc; font-weight: bold; padding: 5px 15px; border-radius: 20px; font-size: 12px; text-transform: uppercase; letter-spacing: 1px; }
        
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

        .tc-chat-tile.pinned { background: rgba(0, 136, 204, 0.05); border-left: 3px solid #0088cc; }
        .dark-mode .tc-chat-tile.pinned { background: rgba(77, 171, 247, 0.05); border-left-color: #4dabf7; }

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

        .tc-msg-actions-hover { position: absolute; right: -140px; top: 50%; transform: translateY(-50%); display: flex; gap: 6px; opacity: 0; transition: 0.3s; z-index: 5; }
        .tc-msg-row.sent .tc-msg-actions-hover { right: auto; left: -140px; flex-direction: row-reverse; }
        .tc-msg-row:hover .tc-msg-actions-hover { opacity: 1; }
        .tc-action-trigger { color: #888; background: rgba(255,255,255,0.9); border-radius: 50%; padding: 8px; box-shadow: 0 4px 10px rgba(0,0,0,0.15); cursor: pointer; display: flex; align-items: center; justify-content: center; backdrop-filter: blur(5px); transition: 0.2s; position: relative; }
        .dark-mode .tc-action-trigger { background: rgba(42,42,42,0.9); color: #ccc; box-shadow: 0 4px 10px rgba(0,0,0,0.5); }
        .tc-action-trigger:hover { background: #0088cc; color: #fff; transform: scale(1.1); }
        .dark-mode .tc-action-trigger:hover { background: #4dabf7; }
        
        .tooltip-wrapper .tooltip { visibility: hidden; width: max-content; background-color: rgba(0,0,0,0.8); color: #fff; text-align: center; border-radius: 6px; padding: 4px 8px; position: absolute; z-index: 1; bottom: 125%; left: 50%; transform: translateX(-50%); opacity: 0; transition: opacity 0.3s; font-size: 11px; }
        .tooltip-wrapper:hover .tooltip { visibility: visible; opacity: 1; }

        .tc-reaction-popover { position: absolute; top: -50px; right: 0; background: rgba(255,255,255,0.95); border-radius: 30px; padding: 6px 12px; display: flex; gap: 10px; box-shadow: 0 10px 25px rgba(0,0,0,0.2); animation: popIn 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275); z-index: 10; backdrop-filter: blur(10px); }
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
        .tc-chat-info-body { padding: 20px; display: flex; flex-direction: column; align-items: center; flex: 1; overflow-y: auto; }
        .tc-chat-info-avatar { width: 130px; height: 130px; border-radius: 50%; background: linear-gradient(135deg, #0088cc, #005580); color: white; display: flex; align-items: center; justify-content: center; font-size: 50px; margin-bottom: 15px; box-shadow: 0 10px 20px rgba(0,0,0,0.15); overflow: hidden; }
        .tc-chat-info-avatar img { width: 100%; height: 100%; object-fit: cover; }
        
        .tc-action-btn-primary { width: 100%; padding: 15px; background: rgba(0, 136, 204, 0.1); color: #0088cc; border: 1px solid #0088cc; border-radius: 10px; font-weight: bold; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: 0.2s; }
        .tc-action-btn-primary:hover { background: #0088cc; color: white; }
        .dark-mode .tc-action-btn-primary { background: rgba(77, 171, 247, 0.1); color: #4dabf7; border-color: #4dabf7; }
        .dark-mode .tc-action-btn-primary:hover { background: #4dabf7; color: white; }

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

        /* 🌟 FORWARD MODAL STYLES 🌟 */
        .tc-forward-modal { max-height: 80vh; display: flex; flex-direction: column; }
        .tc-forward-list { overflow-y: auto; padding: 15px; }
        .tc-forward-list .section-title { font-size: 12px; font-weight: bold; color: #888; text-transform: uppercase; margin-bottom: 10px; }
        .tc-fwd-item { display: flex; align-items: center; gap: 10px; padding: 12px; border-bottom: 1px solid #eee; cursor: pointer; transition: 0.2s; }
        .dark-mode .tc-fwd-item { border-bottom-color: #333; }
        .tc-fwd-item:hover { background: #f4f6f8; }
        .dark-mode .tc-fwd-item:hover { background: #2a2a2a; }

        /* 🌟 Coming Soon Modal 🌟 */
        .tc-coming-soon-modal { max-height: 85vh; display: flex; flex-direction: column; }

        /* 🌟 Pinned Message Styling 🌟 */
        .tc-pinned-message { position: sticky; top: 0; left: 0; width: 100%; background: rgba(255,255,255,0.9); border-bottom: 1px solid #eee; display: flex; align-items: center; padding: 8px 15px; z-index: 10; backdrop-filter: blur(5px); box-sizing: border-box; }
        .dark-mode .tc-pinned-message { background: rgba(30,30,30,0.9); border-bottom-color: #2a2a2a; }
        .pin-bar { width: 3px; height: 30px; background: #0088cc; border-radius: 2px; margin-right: 10px; cursor: pointer; }
        .pin-content { flex: 1; display: flex; flex-direction: column; cursor: pointer; }
        .pin-title { color: #0088cc; font-size: 12px; font-weight: bold; }
        .pin-text { color: #666; font-size: 13px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 90%; }
        .dark-mode .pin-text { color: #aaa; }
        .pin-close:hover { color: #ff4d4f !important; }

        /* 🌟 HEADER FIXES FOR MOBILE 🌟 */
        .tc-chat-header { display: flex; align-items: center; padding: 10px 15px; height: 65px; border-bottom: 1px solid #eee; background: white; z-index: 10; width: 100%; box-sizing: border-box; }
        .dark-mode .tc-chat-header { background: #1e1e1e; border-bottom: 1px solid #2a2a2a; }
        .tc-header-profile { display: flex; align-items: center; gap: 12px; flex: 1; min-width: 0; }
        .tc-header-text { display: flex; flex-direction: column; min-width: 0; }
        .tc-header-text h3 { margin: 0; font-size: 16px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 100%; }

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
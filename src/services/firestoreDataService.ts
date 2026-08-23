import {
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  addDoc,
  serverTimestamp,
  onSnapshot,
  Unsubscribe,
} from 'firebase/firestore';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  User as FirebaseUser,
} from 'firebase/auth';
import { db, auth } from './firebase';
import { BotConfig, UserAccount, AuthSession, ChatMessage } from '../types';

export class FirestoreDataService {
  // Save user profile to Firestore
  public static async saveUserProfile(user: UserAccount): Promise<void> {
    try {
      const userRef = doc(db, 'users', user.id);
      await setDoc(userRef, {
        ...user,
        updatedAt: serverTimestamp(),
      }, { merge: true });
    } catch (err) {
      console.warn('[Firestore] Failed to save user profile:', err);
    }
  }

  // Get user profile from Firestore by email or ID
  public static async getUserProfile(userIdOrEmail: string): Promise<UserAccount | null> {
    try {
      // First try by ID
      const userRef = doc(db, 'users', userIdOrEmail);
      const docSnap = await getDoc(userRef);
      if (docSnap.exists()) {
        return docSnap.data() as UserAccount;
      }

      // Try searching by email
      const usersQuery = query(collection(db, 'users'), where('email', '==', userIdOrEmail.toLowerCase().trim()), limit(1));
      const querySnap = await getDocs(usersQuery);
      if (!querySnap.empty) {
        return querySnap.docs[0].data() as UserAccount;
      }
    } catch (err) {
      console.warn('[Firestore] Failed to retrieve user profile:', err);
    }
    return null;
  }

  // Save bot configuration to Firestore
  public static async saveBotConfig(userId: string, config: BotConfig): Promise<boolean> {
    try {
      const configRef = doc(db, 'bot_configs', userId);
      await setDoc(configRef, {
        userId,
        config,
        updatedAt: new Date().toISOString(),
        timestamp: serverTimestamp(),
      }, { merge: true });
      return true;
    } catch (err) {
      console.warn('[Firestore] Failed to save bot configuration:', err);
      return false;
    }
  }

  // Load bot configuration from Firestore
  public static async loadBotConfig(userId: string): Promise<BotConfig | null> {
    try {
      const configRef = doc(db, 'bot_configs', userId);
      const docSnap = await getDoc(configRef);
      if (docSnap.exists()) {
        const data = docSnap.data();
        return data.config as BotConfig;
      }
    } catch (err) {
      console.warn('[Firestore] Failed to load bot configuration:', err);
    }
    return null;
  }

  // Save a chat message to Firestore for multi-device synchronization
  public static async saveChatMessage(msg: ChatMessage, userId: string): Promise<void> {
    try {
      const messagesCol = collection(db, 'chat_messages');
      await addDoc(messagesCol, {
        ...msg,
        userId,
        createdAt: serverTimestamp(),
      });
    } catch (err) {
      console.warn('[Firestore] Failed to save chat message:', err);
    }
  }

  // Listen to real-time chat messages
  public static subscribeToChatMessages(
    userId: string,
    callback: (messages: ChatMessage[]) => void
  ): Unsubscribe {
    const q = query(
      collection(db, 'chat_messages'),
      where('userId', '==', userId),
      orderBy('createdAt', 'asc'),
      limit(50)
    );

    return onSnapshot(q, (snapshot) => {
      const msgs: ChatMessage[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        msgs.push({
          id: doc.id,
          sender: data.sender,
          text: data.text,
          timestamp: data.timestamp,
          platform: data.platform,
          provider: data.provider,
          isCommand: data.isCommand,
          imageUrl: data.imageUrl,
          fileName: data.fileName,
        } as ChatMessage);
      });
      callback(msgs);
    }, (err) => {
      console.warn('[Firestore] Real-time chat sync notice:', err);
    });
  }
}

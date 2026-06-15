import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut } from 'firebase/auth';
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({
    tabManager: persistentMultipleTabManager()
  })
}, firebaseConfig.firestoreDatabaseId); /* CRITICAL: The app will break without this line */
export const auth = getAuth();
export const googleProvider = new GoogleAuthProvider();

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errMsg = error instanceof Error ? error.message : String(error);
  const errCode = (error as any)?.code || '';

  const errInfo: FirestoreErrorInfo = {
    error: errMsg,
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error event: ', JSON.stringify(errInfo));

  const isSecurityError = 
    errCode === 'permission-denied' || 
    errMsg.toLowerCase().includes('permission') || 
    errMsg.toLowerCase().includes('insufficient');

  if (isSecurityError) {
    throw new Error(JSON.stringify(errInfo));
  } else {
    // Graceful Handling for offline/unavailable connection warnings:
    console.warn(`Firestore background connection is offline or unavailable. Operating normally in offline mode: [${errCode}] ${errMsg}`);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('firestore-offline-status', { detail: errInfo }));
    }
  }
}

// Validation helper connection check (required by the skill)
export async function validateFirestoreConnection() {
  try {
    const { doc, getDocFromServer } = await import('firebase/firestore');
    await getDocFromServer(doc(db, '_connection_test_collection_', '_ping_'));
  } catch (error: any) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.warn("Firebase client reports being offline.", error);
    }
  }
}
validateFirestoreConnection();

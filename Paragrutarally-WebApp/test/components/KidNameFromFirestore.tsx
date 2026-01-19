import React, { useEffect, useState } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/firebase/config.js';

type KidNameFromFirestoreProps = {
  kidId: string;
};

export default function KidNameFromFirestore({ kidId }: KidNameFromFirestoreProps) {
  const [state, setState] = useState<
    | { status: 'loading' }
    | { status: 'not-found' }
    | { status: 'error' }
    | { status: 'loaded'; fullName: string }
  >({ status: 'loading' });

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const snapshot = await getDoc(doc(db, 'kids', kidId));
        if (cancelled) return;

        if (!snapshot.exists()) {
          setState({ status: 'not-found' });
          return;
        }

        const data = snapshot.data();
        const firstName = data?.personalInfo?.firstName ?? data?.firstName ?? '';
        const lastName = data?.personalInfo?.lastName ?? data?.lastName ?? '';
        const fullName = `${firstName} ${lastName}`.trim();

        setState({ status: 'loaded', fullName: fullName || 'Unnamed kid' });
      } catch {
        if (!cancelled) setState({ status: 'error' });
      }
    }

    setState({ status: 'loading' });
    load();

    return () => {
      cancelled = true;
    };
  }, [kidId]);

  if (state.status === 'loading') {
    return (
      <div role="status" aria-label="Loading kid">
        Loading kid…
      </div>
    );
  }

  if (state.status === 'error') {
    return <div role="alert">Failed to load kid.</div>;
  }

  if (state.status === 'not-found') {
    return <div>Kid not found.</div>;
  }

  return <h1>Kid: {state.fullName}</h1>;
}

